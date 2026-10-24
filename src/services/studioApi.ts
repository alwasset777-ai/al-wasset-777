// « استوديو النشر » : textes des publications (IA ou textes prêts avec les informations de l'agence), hébergement des affiches
// (Firebase Storage) et publication via Metricool (server.ts → metricool.ts) ou directement via Meta.
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { agency, agencyPhones } from './agencySettings';
import { getIdToken, isFirebaseEnabled, requireStorage } from './firebase';
import { DEAL_LABELS, PosterData, TYPE_LABELS, formatPrice, headlineOf } from './posterMaker';
import { STUDIO_NETWORK_IDS, StudioLanguage, StudioNetwork, studioSpec } from './studioPlatforms';

// Plateformes de Metricool + WhatsApp et UpScrolled (partage depuis le téléphone, sans API de publication).
export type StudioTarget = StudioNetwork | 'whatsapp' | 'upscrolled';

export const isNetwork = (t: StudioTarget): t is StudioNetwork => STUDIO_NETWORK_IDS.includes(t as StudioNetwork);

export interface StudioPhoto {
  id: string;
  file: Blob;
  url: string; // aperçu local (objectURL)
  img: HTMLImageElement;
}

export interface StudioPost {
  target: StudioTarget;
  text: string;
  hashtags: string[];
  title: string;
  source: 'ia' | 'modèle';
  status: 'brouillon' | 'envoi' | 'programmé' | 'publié' | 'erreur';
  error?: string;
  scheduledFor?: string;
}

type InlineFile = { mimeType: string; data: string };

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getIdToken().catch(() => null);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  return data as T;
}

export function loadPhoto(file: Blob): Promise<StudioPhoto> {
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, file, url, img });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image illisible'));
    };
    img.src = url;
  });
}

// Photos réduites envoyées à l'IA pour qu'elle décrive ce qu'on voit (≈ 4 Mo au maximum, limite du serveur).
function photosForAI(photos: StudioPhoto[]): InlineFile[] {
  return photos.slice(0, 4).map((p) => {
    const scale = Math.min(1, 1024 / Math.max(p.img.width, p.img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(p.img.width * scale);
    canvas.height = Math.round(p.img.height * scale);
    canvas.getContext('2d')!.drawImage(p.img, 0, 0, canvas.width, canvas.height);
    return { mimeType: 'image/jpeg', data: canvas.toDataURL('image/jpeg', 0.8).split(',')[1] };
  });
}

// Textes prêts quand l'IA n'est pas disponible (ou pour les agences sans compte gérant) :
// construits avec la fiche du bien et les informations de l'agence (paramètres).
const tag = (s: string) => s.replace(/[\s'’-]+/g, '_').replace(/[^\p{L}\p{N}_]/gu, '');

function agencyText(d: PosterData, lang: 'ar' | 'fr', short: boolean): string {
  const a = agency();
  const type = TYPE_LABELS[d.type || 'Appartement'];
  const price = formatPrice(d.price);
  const place = [d.district, d.city].filter(Boolean).join(lang === 'ar' ? '، ' : ', ');
  const phones = agencyPhones();
  if (lang === 'ar') {
    const specs = [d.surface ? `📐 ${d.surface} م²` : '', d.bedrooms ? `🛏 ${d.bedrooms} غرف` : '', d.bathrooms ? `🛁 ${d.bathrooms} حمامات` : ''].filter(Boolean).join(' • ');
    if (short) return [`🏠 ${headlineOf(d)}${place ? ` – ${place}` : ''}`, price ? `💰 ${price}` : '', phones[0] ? `📞 ${phones[0]}` : ''].filter(Boolean).join('\n');
    return [
      `🏠 ${headlineOf(d)}`,
      place ? `📍 ${place}` : '',
      specs,
      ...d.features.map((f) => `✅ ${f}`),
      ...d.extras.map((x) => x.trim()).filter(Boolean).map((x) => `✅ ${x}`),
      price ? `💰 الثمن: ${price}` : '',
      phones.length ? `📞 للتواصل: ${phones.join(' / ')}` : '',
      [a.name, a.address].filter((x) => x.trim()).join(' – '),
    ].filter(Boolean).join('\n');
  }
  const deal = DEAL_LABELS[d.deal].fr.toLowerCase();
  const specs = [d.surface ? `📐 ${d.surface} m²` : '', d.bedrooms ? `🛏 ${d.bedrooms} ch.` : '', d.bathrooms ? `🛁 ${d.bathrooms} sdb` : ''].filter(Boolean).join(' • ');
  if (short) return [`🏠 ${type.fr} ${deal}${place ? ` – ${place}` : ''}`, price ? `💰 ${price}` : ''].filter(Boolean).join('\n');
  return [
    `🏠 ${type.fr} ${deal}`,
    place ? `📍 ${place}` : '',
    specs,
    price ? `💰 Prix : ${price}` : '',
    phones.length ? `📞 Contact : ${phones.join(' / ')}` : '',
    a.name.trim(),
  ].filter(Boolean).join('\n');
}

function templatePost(d: PosterData, target: StudioTarget, lang: StudioLanguage): StudioPost {
  const spec = !isNetwork(target)
    ? { maxChars: target === 'whatsapp' ? 4000 : 2200, maxHashtags: target === 'whatsapp' ? 0 : 10, title: false }
    : studioSpec(target);
  const short = spec.maxChars < 600;
  const langs: ('ar' | 'fr')[] = lang === 'ar+fr' ? (short ? ['ar'] : ['ar', 'fr']) : lang === 'fr' ? ['fr'] : ['ar'];
  const type = TYPE_LABELS[d.type || 'Appartement'];
  const city = d.city || agency().city;
  const tags = [
    city ? `#عقارات_${tag(city)}` : '',
    `#${tag(type.ar)}_${DEAL_LABELS[d.deal].ar.split(' ').pop()}`,
    city && /^[a-z]/i.test(city) ? `#Immobilier${tag(city).replace(/_/g, '')}` : '',
    '#ImmobilierMaroc',
    '#عقارات_المغرب',
    agency().name.trim() ? `#${tag(agency().name)}` : '',
  ].filter((h) => h.length > 1);
  const hashtags = Array.from(new Set(tags)).slice(0, spec.maxHashtags);
  const budget = spec.maxChars - hashtags.join(' ').length - 2;
  return {
    target,
    text: langs.map((l) => agencyText(d, l, short)).join('\n\n').slice(0, budget),
    hashtags,
    title: spec.title ? [headlineOf(d), formatPrice(d.price)].filter(Boolean).join(' – ').slice(0, 90) : '',
    source: 'modèle',
    status: 'brouillon',
  };
}

export async function generatePosts(
  photos: StudioPhoto[],
  d: PosterData,
  description: string,
  targets: StudioTarget[],
  lang: StudioLanguage
): Promise<StudioPost[]> {
  const networks = targets.filter(isNetwork);
  const a = agency();
  const info = {
    ...d,
    type: d.type || 'Appartement',
    listingType: d.deal === 'meuble' ? 'location meublée' : d.deal,
    features: d.features.join('، '),
    description,
    agence: { nom: a.name, telephones: agencyPhones(), adresse: [a.address, a.city].filter(Boolean).join(', ') },
  };
  let ai: { platform: StudioNetwork; text: string; hashtags: string[]; title: string }[] = [];
  if (networks.length) {
    try {
      ai = (await post<{ posts: typeof ai }>('/api/studio/posts', { files: photosForAI(photos), info, platforms: networks, language: lang })).posts;
    } catch {
      // IA indisponible : textes prêts ci-dessous.
    }
  }
  return targets.map((target): StudioPost => {
    const found = ai.find((x) => x.platform === target);
    return found ? { target, text: found.text, hashtags: found.hashtags, title: found.title, source: 'ia', status: 'brouillon' } : templatePost(d, target, lang);
  });
}

export const fullText = (p: Pick<StudioPost, 'text' | 'hashtags'>) => (p.hashtags.length ? `${p.text}\n\n${p.hashtags.join(' ')}` : p.text);

// Les plateformes téléchargent les médias depuis un lien public : hébergement sur Firebase Storage.
export async function uploadMedia(batchId: string, blob: Blob, name: string): Promise<string> {
  if (!isFirebaseEnabled) throw new Error('Firebase non configuré : impossible d’héberger les images');
  const safe = name.replace(/[^\w.-]+/g, '_').slice(-60);
  const r = ref(requireStorage(), `studio/${batchId}/${Date.now()}-${safe}`);
  await uploadBytes(r, blob, { contentType: blob.type || 'application/octet-stream' });
  return getDownloadURL(r);
}

export interface SchedulePayload {
  network: StudioNetwork;
  text: string;
  title?: string;
  images: string[];
  video?: string;
  vertical?: boolean;
  dateTime?: string; // "YYYY-MM-DDTHH:mm", heure du Maroc
}

export const schedulePost = (p: SchedulePayload) => post<{ id: string; dateTime: string }>('/api/studio/schedule', p);

// Sans Metricool : publication immédiate et gratuite sur la Page Facebook / Instagram (API Meta, voir meta.ts).
export async function publishMetaDirect(platform: 'facebook' | 'instagram', caption: string, imageUrl?: string): Promise<string> {
  const { id } = await post<{ id: string }>('/api/meta/publish', { platform, caption, imageUrl });
  return id;
}

// WhatsApp n'a pas d'API de publication : partage de l'affiche depuis le téléphone (ou téléchargement).
export async function shareImage(blob: Blob, name: string, text: string): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], text });
    return 'shared';
  }
  downloadFile(blob, name);
  return 'downloaded';
}

export function downloadFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a); // certains navigateurs ignorent le nom du fichier sinon
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
