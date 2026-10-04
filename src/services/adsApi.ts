// Appel à l'agent IA côté serveur (server.ts → Gemini). La clé API reste sur le serveur.
// En cas d'indisponibilité, l'appelant retombe sur les modèles locaux.
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { AdDraft, AdLanguage, AdPlatform, Property } from '../types';
import { fullPostText, platformSpec } from './adGenerator';
import { getIdToken, isFirebaseEnabled, requireStorage } from './firebase';
import { renderPoster } from './visualMaker';

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getIdToken().catch(() => null);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface ServerStatus {
  ai: boolean;
  auth: boolean;
  meta: { facebook: boolean; instagram: boolean };
}

export async function fetchServerStatus(): Promise<ServerStatus | null> {
  try {
    const res = await fetch('/api/health');
    if (!res.ok) return null;
    const data = await res.json();
    return { ai: !!data.ai, auth: !!data.auth, meta: { facebook: !!data.meta?.facebook, instagram: !!data.meta?.instagram } };
  } catch {
    return null;
  }
}

export const AUTO_PLATFORMS: AdPlatform[] = ['facebook', 'instagram'];

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// Publie directement sur la Page Facebook / le compte Instagram : affiche JPEG + texte validé.
export async function publishToMeta(d: AdDraft, property: Property): Promise<string> {
  const jpeg = await renderPoster(property, platformSpec(d.platform).format, 'image/jpeg');
  let imageUrl: string | undefined;
  if (isFirebaseEnabled) {
    const r = ref(requireStorage(), `ads/${d.id}.jpg`);
    await uploadBytes(r, jpeg, { contentType: 'image/jpeg' });
    imageUrl = await getDownloadURL(r);
  } else if (d.platform === 'instagram') {
    throw new Error('Instagram nécessite Firebase pour héberger l’image');
  }
  const res = await fetch('/api/meta/publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({
      platform: d.platform,
      caption: fullPostText(d),
      imageUrl,
      jpegBase64: imageUrl ? undefined : await blobToBase64(jpeg),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  return String(data.id);
}

export interface AiAdResult {
  text: string;
  hashtags: string[];
}

export async function generateAdWithAI(
  property: Property,
  platform: AdPlatform,
  language: AdLanguage
): Promise<AiAdResult | null> {
  const spec = platformSpec(platform);
  try {
    const res = await fetch('/api/ads/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({
        platform,
        platformLabel: spec.label,
        maxChars: spec.maxChars,
        maxHashtags: spec.maxHashtags,
        kind: spec.kind,
        language,
        property: {
          titleFr: property.titleFr,
          titleAr: property.titleAr,
          type: property.type,
          listingType: property.listingType,
          price: property.priceFormattedFr,
          city: property.city,
          district: property.district,
          surface: property.surface,
          bedrooms: property.bedrooms,
          bathrooms: property.bathrooms,
          features: property.features,
          descriptionFr: property.descriptionFr,
          descriptionAr: property.descriptionAr,
        },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data?.text !== 'string' || !data.text.trim()) return null;
    return {
      text: data.text.trim(),
      hashtags: Array.isArray(data.hashtags) ? data.hashtags.filter((h: unknown) => typeof h === 'string').slice(0, spec.maxHashtags) : [],
    };
  } catch {
    return null;
  }
}
