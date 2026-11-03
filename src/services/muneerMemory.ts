// Mémoire de « منير » : ce que le gérant lui apprend (informations, façon d'écrire, « مهارات »).
// Gardée sur l'appareil et envoyée avec chaque message du gérant pour que l'IA l'applique.
import { loadJSON, saveJSON } from './storage';

export type MemoryKind = 'fact' | 'style' | 'skill';
export interface MemoryItem {
  id: string;
  kind: MemoryKind;
  text: string;
  at: string;
}

const KEY = 'alwassit777.muneer.memory.v1';
const MAX_ITEMS = 60;
const listeners = new Set<() => void>();

export const getMemory = (): MemoryItem[] => loadJSON<MemoryItem[]>(KEY, []);

function save(items: MemoryItem[]) {
  saveJSON(KEY, items.slice(0, MAX_ITEMS));
  listeners.forEach((l) => l());
}

export function onMemoryChange(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

export function remember(kind: MemoryKind, text: string): MemoryItem | null {
  const clean = norm(text).slice(0, 400);
  if (clean.length < 3) return null;
  const items = getMemory();
  const existing = items.find((m) => norm(m.text) === clean);
  if (existing) return existing;
  const item: MemoryItem = { id: `mem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`, kind, text: clean, at: new Date().toISOString() };
  save([item, ...items]);
  return item;
}

// Oublie par identifiant, ou par mots contenus dans le texte.
export function forget(query: string): MemoryItem[] {
  const q = norm(query).toLowerCase();
  if (!q) return [];
  const items = getMemory();
  const removed = items.filter((m) => m.id === query || m.text.toLowerCase().includes(q));
  if (removed.length) save(items.filter((m) => !removed.includes(m)));
  return removed;
}

export const forgetById = (id: string) => save(getMemory().filter((m) => m.id !== id));

// Version envoyée au serveur (sans identifiants ni dates).
export const memoryForServer = () => getMemory().map((m) => ({ kind: m.kind, text: m.text }));

// Photo de l'avatar (choisie par le gérant), en petite image JPEG.
const AVATAR_KEY = 'alwassit777.muneer.avatar.v1';
export const getAvatar = (): string | null => loadJSON<string | null>(AVATAR_KEY, null);
export function setAvatar(dataUrl: string | null) {
  saveJSON(AVATAR_KEY, dataUrl);
  listeners.forEach((l) => l());
}
