// « استوديو النشر » : préparation des fichiers pour l'IA, rédaction, retouche photo,
// hébergement des médias (Firebase Storage) et programmation via Metricool (server.ts → metricool.ts).
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { AdLanguage, AdPlatform, ListingType, Property, PropertyType } from '../types';
import { agencyProfile as A } from '../data/agencyProfile';
import { buildHashtags, generateTemplateText } from './adGenerator';
import { getIdToken, isFirebaseEnabled, requireStorage } from './firebase';
import { StudioLanguage, StudioNetwork, studioSpec } from './studioPlatforms';

export interface StudioFile {
  id: string;
  file: Blob;
  name: string;
  kind: 'image' | 'video' | 'pdf';
  url: string; // aperçu local (objectURL)
  vertical?: boolean;
  aiEnhanced?: boolean;
}

export interface StudioInfo {
  type: PropertyType | '';
  listingType: ListingType | '';
  city: string;
  district: string;
  surface: number;
  bedrooms: number;
  bathrooms: number;
  price: string;
  features: string;
  description: string;
}

export interface StudioPost {
  platform: StudioNetwork;
  text: string;
  hashtags: string[];
  title: string;
  source: 'ia' | 'modèle';
  status: 'brouillon' | 'envoi' | 'programmé' | 'publié' | 'erreur';
  error?: string;
  scheduledFor?: string;
}

export const EMPTY_INFO: StudioInfo = {
  type: '', listingType: 'vente', city: 'Meknès', district: '', surface: 0, bedrooms: 0, bathrooms: 0, price: '', features: '', description: '',
};

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

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function canvasToJpeg(source: CanvasImageSource, w: number, h: number, max: number): Promise<Blob> {
  const scale = Math.min(1, max / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext('2d')!.drawImage(source, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Conversion image impossible'))), 'image/jpeg', 0.85)
  );
}

async function shrinkImage(blob: Blob, max = 1024): Promise<Blob> {
  const bmp = await createImageBitmap(blob);
  try {
    return await canvasToJpeg(bmp, bmp.width, bmp.height, max);
  } finally {
    bmp.close();
  }
}

function loadVideo(blob: Blob): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.onloadeddata = () => resolve(v);
    v.onerror = () => reject(new Error('Vidéo illisible'));
    v.src = URL.createObjectURL(blob);
  });
}

// Quelques images de la vidéo, pour que l'IA « voie » le bien sans envoyer toute la vidéo.
async function videoFrames(blob: Blob, count = 3): Promise<Blob[]> {
  const v = await loadVideo(blob);
  const frames: Blob[] = [];
  try {
    for (let i = 1; i <= count; i++) {
      await new Promise<void>((resolve) => {
        v.onseeked = () => resolve();
        v.currentTime = (v.duration || 1) * (i / (count + 1));
      });
      frames.push(await canvasToJpeg(v, v.videoWidth, v.videoHeight, 768));
    }
  } finally {
    URL.revokeObjectURL(v.src);
  }
  return frames;
}

export async function isVerticalVideo(blob: Blob): Promise<boolean> {
  const v = await loadVideo(blob);
  URL.revokeObjectURL(v.src);
  return v.videoHeight > v.videoWidth;
}

// Fichiers réduits envoyés à l'IA (≈ 4 Mo au maximum, limite du serveur), dans l'ordre :
// photos (photoCount, pour les légendes de la vidéo), images des vidéos, puis PDF.
// Priorité de place : PDF, puis photos, puis images des vidéos.
export async function prepareForAI(files: StudioFile[]): Promise<{ parts: InlineFile[]; photoCount: number; skipped: string[] }> {
  const skipped: string[] = [];
  let total = 0;
  const encode = async (b: Blob, mimeType: string, name: string, out: InlineFile[]) => {
    const data = await blobToBase64(b);
    if (total + data.length > 4_000_000) return skipped.push(name);
    total += data.length;
    out.push({ mimeType, data });
  };
  const pdfs: InlineFile[] = [];
  const photos: InlineFile[] = [];
  const frames: InlineFile[] = [];
  for (const f of files.filter((x) => x.kind === 'pdf')) {
    if (f.file.size > 2_800_000) skipped.push(f.name);
    else await encode(f.file, 'application/pdf', f.name, pdfs);
  }
  for (const f of files.filter((x) => x.kind === 'image').slice(0, 8)) await encode(await shrinkImage(f.file), 'image/jpeg', f.name, photos);
  for (const f of files.filter((x) => x.kind === 'video').slice(0, 2)) {
    for (const frame of await videoFrames(f.file).catch(() => [])) await encode(frame, 'image/jpeg', f.name, frames);
  }
  return { parts: [...photos, ...frames, ...pdfs], photoCount: photos.length, skipped };
}

export async function extractInfo(files: StudioFile[]): Promise<Partial<StudioInfo>> {
  const { parts } = await prepareForAI(files);
  const { info } = await post<{ info: Record<string, unknown> }>('/api/studio/extract', { files: parts });
  const num = (v: unknown) => (typeof v === 'number' && v > 0 ? v : 0);
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  return {
    ...(str(info.type) ? { type: str(info.type) as PropertyType } : {}),
    ...(str(info.listingType) ? { listingType: str(info.listingType) as ListingType } : {}),
    ...(str(info.city) ? { city: str(info.city) } : {}),
    ...(str(info.district) ? { district: str(info.district) } : {}),
    ...(num(info.surface) ? { surface: num(info.surface) } : {}),
    ...(num(info.bedrooms) ? { bedrooms: num(info.bedrooms) } : {}),
    ...(num(info.bathrooms) ? { bathrooms: num(info.bathrooms) } : {}),
    ...(str(info.price) ? { price: str(info.price) } : {}),
    ...(Array.isArray(info.features) && info.features.length ? { features: info.features.filter((x) => typeof x === 'string').join('، ') } : {}),
    ...(str(info.description) ? { description: str(info.description) } : {}),
  };
}

// Bien « virtuel » à partir du formulaire : sert à l'affiche, au diaporama vidéo et aux modèles hors IA.
export function toProperty(info: StudioInfo, images: string[]): Property {
  const type = info.type || 'Appartement';
  return {
    id: 0,
    titleFr: `${type} ${info.district ? `– ${info.district}` : ''}`.trim(),
    titleAr: info.description.split(/[.\n]/)[0]?.slice(0, 60) || `${type} – ${info.district || info.city}`,
    type,
    listingType: info.listingType || 'vente',
    price: 0,
    priceFormattedFr: info.price || 'Prix sur demande',
    priceFormattedAr: info.price || 'الثمن عند الطلب',
    city: info.city,
    district: info.district || info.city,
    address: '',
    surface: info.surface,
    rooms: info.bedrooms,
    bedrooms: info.bedrooms,
    bathrooms: info.bathrooms,
    status: 'Disponible',
    images,
    descriptionFr: info.description,
    descriptionAr: info.description,
    features: info.features.split(/[،,]/).map((x) => x.trim()).filter(Boolean),
    lat: 0,
    lng: 0,
    agent: { name: A.managerFr, agency: A.nameFr, phone: A.phonesLocal[0], whatsapp: A.whatsapp, email: '', avatar: '', rating: 5, reviewCount: 0 },
    dateAdded: new Date().toISOString(),
  };
}

// Plateforme du moteur de modèles la plus proche (longueur et ton), quand l'IA n'est pas disponible.
const TEMPLATE_OF: Record<StudioNetwork, AdPlatform> = {
  facebook: 'facebook', instagram: 'instagram', tiktok: 'tiktok', youtube: 'facebook', threads: 'threads', gmb: 'avito', bluesky: 'x',
};

function templatePost(info: StudioInfo, platform: StudioNetwork, lang: StudioLanguage): StudioPost {
  const spec = studioSpec(platform);
  const p = toProperty(info, []);
  const tpl = TEMPLATE_OF[platform];
  // Bilingue : texte arabe puis français, hashtags des deux langues.
  const langs: AdLanguage[] = lang === 'ar+fr' ? ['ar', 'fr'] : [lang];
  const hashtags = Array.from(new Set(langs.flatMap((l) => buildHashtags(p, tpl, l)))).slice(0, spec.maxHashtags);
  const budget = Math.floor((spec.maxChars - hashtags.join(' ').length - 2) / langs.length);
  return {
    platform,
    text: langs.map((l) => generateTemplateText(p, tpl, l).slice(0, budget)).join('\n\n'),
    hashtags,
    title: spec.title ? `${p.titleFr} – ${p.priceFormattedFr}`.slice(0, 90) : '',
    source: 'modèle',
    status: 'brouillon',
  };
}

export async function generatePosts(
  files: StudioFile[],
  info: StudioInfo,
  platforms: StudioNetwork[],
  lang: StudioLanguage
): Promise<{ posts: StudioPost[]; captions: string[] }> {
  let ai: { platform: StudioNetwork; text: string; hashtags: string[]; title: string }[] = [];
  let captions: string[] = [];
  try {
    const { parts, photoCount } = await prepareForAI(files);
    const res = await post<{ posts: typeof ai; captions?: string[] }>('/api/studio/posts', { files: parts, photoCount, info, platforms, language: lang });
    ai = res.posts;
    captions = res.captions ?? [];
  } catch {
    // IA indisponible : modèles Al Wassit ci-dessous.
  }
  const posts = platforms.map((platform): StudioPost => {
    const found = ai.find((x) => x.platform === platform);
    return found ? { ...found, source: 'ia', status: 'brouillon' } : templatePost(info, platform, lang);
  });
  return { posts, captions };
}

export async function enhanceImage(f: StudioFile): Promise<Blob> {
  const data = await blobToBase64(await shrinkImage(f.file, 1536));
  const out = await post<{ mimeType: string; data: string }>('/api/studio/image', { image: { mimeType: 'image/jpeg', data } });
  return new Blob([Uint8Array.from(atob(out.data), (c) => c.charCodeAt(0))], { type: out.mimeType });
}

// Les plateformes téléchargent les médias depuis un lien public : hébergement sur Firebase Storage.
export async function uploadMedia(batchId: string, blob: Blob, name: string): Promise<string> {
  if (!isFirebaseEnabled) throw new Error('Firebase non configuré : impossible d’héberger les médias');
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
  aiImages?: boolean;
  dateTime?: string; // "YYYY-MM-DDTHH:mm", heure du Maroc
}

export const schedulePost = (p: SchedulePayload) => post<{ id: string; dateTime: string }>('/api/studio/schedule', p);

// Sans Metricool : publication immédiate et gratuite sur la Page Facebook / Instagram (API Meta, voir meta.ts).
export async function publishMetaDirect(platform: 'facebook' | 'instagram', caption: string, imageUrl?: string): Promise<string> {
  const { id } = await post<{ id: string }>('/api/meta/publish', { platform, caption, imageUrl });
  return id;
}
