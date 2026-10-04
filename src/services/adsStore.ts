// Annonces partagées entre l'onglet « Publicités » et l'assistant de discussion.
// Un seul état en mémoire, sauvegardé dans le navigateur et synchronisé entre onglets.
import { useEffect, useState } from 'react';
import { AdDraft, AdLanguage, AdPlatform, AdStats, Property } from '../types';
import { buildHashtags, fitToPlatform, generateTemplateText, propertyTitle } from './adGenerator';
import { generateAdWithAI } from './adsApi';
import { loadJSON, saveJSON } from './storage';

const DRAFTS_KEY = 'alwassit777.ads.drafts.v1';

export const EMPTY_STATS: AdStats = { views: 0, likes: 0, comments: 0, shares: 0, messages: 0, leads: 0 };

let drafts: AdDraft[] = loadJSON<AdDraft[]>(DRAFTS_KEY, []);
const listeners = new Set<(d: AdDraft[]) => void>();

function emit() {
  listeners.forEach((l) => l(drafts));
}

export function getDrafts(): AdDraft[] {
  return drafts;
}

export function setDrafts(next: AdDraft[] | ((prev: AdDraft[]) => AdDraft[])) {
  drafts = typeof next === 'function' ? next(drafts) : next;
  saveJSON(DRAFTS_KEY, drafts);
  emit();
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === DRAFTS_KEY) {
      drafts = loadJSON<AdDraft[]>(DRAFTS_KEY, []);
      emit();
    }
  });
}

export function useAdDrafts(): [AdDraft[], typeof setDrafts] {
  const [state, setState] = useState(drafts);
  useEffect(() => {
    listeners.add(setState);
    setState(drafts);
    return () => {
      listeners.delete(setState);
    };
  }, []);
  return [state, setDrafts];
}

// Rédige une annonce (IA si disponible, sinon modèle Al Wassit).
export async function makeDraft(p: Property, platform: AdPlatform, lang: AdLanguage): Promise<AdDraft> {
  const ai = await generateAdWithAI(p, platform, lang);
  const hashtags = ai?.hashtags.length ? ai.hashtags : buildHashtags(p, platform, lang);
  const text = fitToPlatform(ai ? ai.text : generateTemplateText(p, platform, lang), platform, hashtags);
  return {
    id: `ad-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    propertyId: p.id,
    propertyTitle: propertyTitle(p),
    platform,
    language: lang,
    text,
    hashtags,
    status: 'brouillon',
    source: ai ? 'ia' : 'modèle',
    createdAt: new Date().toISOString(),
    stats: { ...EMPTY_STATS },
  };
}

// Génère toutes les combinaisons plateforme × langue par petits lots, puis les ajoute « à valider ».
export async function generateDrafts(
  p: Property,
  platforms: AdPlatform[],
  languages: AdLanguage[],
  onProgress?: (done: number, total: number) => void
): Promise<AdDraft[]> {
  const combos = platforms.flatMap((pl) => languages.map((lg) => [pl, lg] as const));
  const created: AdDraft[] = [];
  onProgress?.(0, combos.length);
  for (let i = 0; i < combos.length; i += 4) {
    const batch = await Promise.all(combos.slice(i, i + 4).map(([pl, lg]) => makeDraft(p, pl, lg)));
    created.push(...batch);
    onProgress?.(created.length, combos.length);
  }
  setDrafts((prev) => [...created, ...prev]);
  return created;
}
