// Appel à l'agent IA côté serveur (server.ts → Gemini). La clé API reste sur le serveur.
// En cas d'indisponibilité, l'appelant retombe sur les modèles locaux.
import { AdLanguage, AdPlatform, Property } from '../types';
import { platformSpec } from './adGenerator';

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
      headers: { 'Content-Type': 'application/json' },
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
