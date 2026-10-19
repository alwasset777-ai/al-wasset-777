// « استوديو النشر » : textes des publications (IA ou modèles Al Wassit), hébergement des affiches
// (Firebase Storage) et publication via Metricool (server.ts → metricool.ts) ou directement via Meta.
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { AdLanguage, AdPlatform, Property } from '../types';
import { agencyProfile as A } from '../data/agencyProfile';
import { buildHashtags, generateTemplateText } from './adGenerator';
import { getIdToken, isFirebaseEnabled, requireStorage } from './firebase';
import { DEAL_LABELS, PosterData, TYPE_LABELS, formatPrice } from './posterMaker';
import { StudioLanguage, StudioNetwork, studioSpec } from './studioPlatforms';

// Plateformes de Metricool + WhatsApp (partage depuis le téléphone, sans API de publication).
export type StudioTarget = StudioNetwork | 'whatsapp';

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

// Bien « virtuel » à partir de la fiche : sert aux modèles de texte quand l'IA n'est pas disponible.
function toProperty(d: PosterData, description: string): Property {
  const type = d.type || 'Appartement';
  const price = formatPrice(d.price);
  return {
    id: 0,
    titleFr: `${TYPE_LABELS[type].fr} ${DEAL_LABELS[d.deal].fr.toLowerCase()}${d.district ? ` – ${d.district}` : ''}`,
    titleAr: `${TYPE_LABELS[type].ar} ${DEAL_LABELS[d.deal].ar}${d.district ? ` في ${d.district}` : ''}`,
    type,
    listingType: d.deal,
    price: 0,
    priceFormattedFr: price || 'Prix sur demande',
    priceFormattedAr: price || 'الثمن عند الطلب',
    city: d.city,
    district: d.district || d.city,
    address: '',
    surface: d.surface,
    rooms: d.bedrooms,
    bedrooms: d.bedrooms,
    bathrooms: d.bathrooms,
    status: 'Disponible',
    images: [],
    descriptionFr: description,
    descriptionAr: description,
    features: d.features,
    lat: 0,
    lng: 0,
    agent: { name: A.managerFr, agency: A.nameFr, phone: A.phonesLocal[0], whatsapp: A.whatsapp, email: '', avatar: '', rating: 5, reviewCount: 0 },
    dateAdded: new Date().toISOString(),
  };
}

// Plateforme du moteur de modèles la plus proche (longueur et ton), quand l'IA n'est pas disponible.
const TEMPLATE_OF: Record<StudioTarget, AdPlatform> = {
  facebook: 'facebook', instagram: 'instagram', tiktok: 'tiktok', youtube: 'facebook', threads: 'threads', gmb: 'avito', bluesky: 'x', whatsapp: 'whatsapp',
};

function templatePost(p: Property, target: StudioTarget, lang: StudioLanguage): StudioPost {
  const spec = target === 'whatsapp' ? { maxChars: 4000, maxHashtags: 0, title: false } : studioSpec(target);
  const tpl = TEMPLATE_OF[target];
  // Bilingue : texte arabe puis français, hashtags des deux langues.
  const langs: AdLanguage[] = lang === 'ar+fr' ? ['ar', 'fr'] : [lang];
  const hashtags = Array.from(new Set(langs.flatMap((l) => buildHashtags(p, tpl, l)))).slice(0, spec.maxHashtags);
  const budget = Math.floor((spec.maxChars - hashtags.join(' ').length - 2) / langs.length);
  return {
    target,
    text: langs.map((l) => generateTemplateText(p, tpl, l).slice(0, budget)).join('\n\n'),
    hashtags,
    title: spec.title ? `${p.titleAr} – ${p.priceFormattedAr}`.slice(0, 90) : '',
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
  const networks = targets.filter((t): t is StudioNetwork => t !== 'whatsapp');
  const info = { ...d, type: d.type || 'Appartement', listingType: d.deal, features: d.features.join('، '), description };
  let ai: { platform: StudioNetwork; text: string; hashtags: string[]; title: string }[] = [];
  if (networks.length) {
    try {
      ai = (await post<{ posts: typeof ai }>('/api/studio/posts', { files: photosForAI(photos), info, platforms: networks, language: lang })).posts;
    } catch {
      // IA indisponible : modèles Al Wassit ci-dessous.
    }
  }
  const p = toProperty(d, description);
  return targets.map((target): StudioPost => {
    const found = ai.find((x) => x.platform === target);
    return found ? { target, text: found.text, hashtags: found.hashtags, title: found.title, source: 'ia', status: 'brouillon' } : templatePost(p, target, lang);
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
