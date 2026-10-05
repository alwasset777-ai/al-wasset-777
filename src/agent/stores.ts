// Données du وكيل الوسيط 777 dans l'application : réglages, mémoire, conversation, clients, rendez-vous.
// En ligne (Firebase, synchronisé téléphone ↔ ordinateur) quand il est configuré, sinon sur l'appareil.
import { useSyncExternalStore } from 'react';
import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import type { Appointment, ClientLead, StoredFileRef } from '../types';
import type { AgentMessage, AgentSettings, MemoryItem } from './types';
import { isFirebaseEnabled, onUserChange, requireDb, requireStorage } from '../services/firebase';
import { loadJSON, saveJSON } from '../services/storage';
import { deleteFile, getFile, putFile } from '../services/fileStore';
import { mockClientLeads } from '../data/mockData';

const LOCAL_PREFIX = 'alwassit777.agent.';
// Firestore refuse les valeurs « undefined ».
const clean = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

type Listener = () => void;

// Abonnement Firestore actif seulement quand le gérant est connecté.
function whenSignedIn(start: () => () => void, onSignedOut: () => void) {
  let stop: (() => void) | null = null;
  onUserChange((user) => {
    stop?.();
    stop = null;
    if (user) stop = start();
    else onSignedOut();
  });
}

// ---------- Document unique (agent_state/{clé}) ----------

export interface DocStore<T> {
  get(): T;
  set(next: T | ((prev: T) => T)): Promise<void>;
  subscribe(l: Listener): () => void;
}

function createDocStore<T>(key: string, fallback: T, normalize: (v: any) => T = (v) => v as T): DocStore<T> {
  const listeners = new Set<Listener>();
  const emit = () => listeners.forEach((l) => l());
  let value: T = isFirebaseEnabled ? fallback : normalize(loadJSON<T>(LOCAL_PREFIX + key, fallback));

  if (isFirebaseEnabled) {
    whenSignedIn(
      () =>
        onSnapshot(
          doc(requireDb(), 'agent_state', key),
          (snap) => {
            value = snap.exists() ? normalize(snap.data().value ?? fallback) : fallback;
            emit();
          },
          () => undefined
        ),
      () => {
        value = fallback;
        emit();
      }
    );
  }

  return {
    get: () => value,
    async set(next) {
      value = typeof next === 'function' ? (next as (p: T) => T)(value) : next;
      emit();
      if (isFirebaseEnabled) await setDoc(doc(requireDb(), 'agent_state', key), { value: clean(value), updatedAt: new Date().toISOString() });
      else saveJSON(LOCAL_PREFIX + key, value);
    },
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

// ---------- Liste de fiches (collection Firestore) ----------
// Deux façons de modifier : put / patch / remove (une fiche), ou set / use (toute la liste, comme
// l'ancien magasin local) ; set compare l'avant/après et n'écrit en ligne que les fiches changées.

export interface ListStore<T extends { id: string | number }> {
  get(): T[];
  put(item: T): Promise<void>;
  patch(id: T['id'], changes: Partial<T>): Promise<void>;
  remove(id: T['id']): Promise<void>;
  set(next: T[] | ((prev: T[]) => T[])): void;
  use(): [T[], (next: T[] | ((prev: T[]) => T[])) => void];
  subscribe(l: Listener): () => void;
}

function createListStore<T extends { id: string | number }>(
  name: string,
  localKey: string,
  sort: (a: T, b: T) => number,
  localSeed: T[] = []
): ListStore<T> {
  const listeners = new Set<Listener>();
  let items: T[] = isFirebaseEnabled ? [] : loadJSON<T[]>(localKey, localSeed);
  const emit = () => {
    items = [...items].sort(sort);
    if (!isFirebaseEnabled) saveJSON(localKey, items);
    listeners.forEach((l) => l());
  };

  if (isFirebaseEnabled) {
    whenSignedIn(
      () =>
        onSnapshot(
          collection(requireDb(), name),
          (snap) => {
            items = snap.docs.map((d) => d.data() as T);
            emit();
          },
          () => undefined
        ),
      () => {
        items = [];
        emit();
      }
    );
  } else if (typeof window !== 'undefined') {
    // Même liste dans tous les onglets ouverts.
    window.addEventListener('storage', (e) => {
      if (e.key !== localKey) return;
      items = loadJSON<T[]>(localKey, localSeed);
      listeners.forEach((l) => l());
    });
  }

  const docRef = (id: T['id']) => doc(requireDb(), name, String(id));
  const set = (next: T[] | ((prev: T[]) => T[])) => {
    const prev = items;
    items = typeof next === 'function' ? (next as (p: T[]) => T[])(prev) : next;
    emit();
    if (!isFirebaseEnabled) return;
    const before = new Map(prev.map((x) => [String(x.id), JSON.stringify(x)]));
    const after = new Set(items.map((x) => String(x.id)));
    items.filter((x) => before.get(String(x.id)) !== JSON.stringify(x)).forEach((x) => setDoc(docRef(x.id), clean(x)).catch(() => undefined));
    [...before.keys()].filter((id) => !after.has(id)).forEach((id) => deleteDoc(doc(requireDb(), name, id)).catch(() => undefined));
  };
  const store: ListStore<T> = {
    get: () => items,
    async put(item) {
      items = [item, ...items.filter((x) => x.id !== item.id)];
      emit();
      if (isFirebaseEnabled) await setDoc(docRef(item.id), clean(item));
    },
    async patch(id, changes) {
      const current = items.find((x) => x.id === id);
      if (!current) throw new Error('Fiche introuvable');
      const next = { ...current, ...changes };
      items = items.map((x) => (x.id === id ? next : x));
      emit();
      if (isFirebaseEnabled) await setDoc(docRef(id), clean(next));
    },
    async remove(id) {
      items = items.filter((x) => x.id !== id);
      emit();
      if (isFirebaseEnabled) await deleteDoc(docRef(id));
    },
    set,
    use() {
      return [useSyncExternalStore(store.subscribe, store.get, store.get), set];
    },
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
  return store;
}

// ---------- Réglages par défaut ----------

export const DEFAULT_SETTINGS: AgentSettings = {
  name: 'وكيل الوسيط 777',
  gender: 'male',
  avatarMode: 'photo',
  photos: [],
  look: { skin: '#c68e6a', hair: 'short', hairColor: '#2b1d16', beard: 'short', outfit: 'djellaba', outfitColor: '#f1ebe0', glasses: false },
  colors: { primary: '#281715', accent: '#ff6f61' },
  voice: { rate: 1, pitch: 1, autoSpeak: true, micMode: 'ai' },
  personality: 'friendly',
  extraInstructions: '',
  confirmAll: false,
  reminders: { enabled: true, beforeMin: 60 },
  dailyReport: { enabled: true, hour: 8 },
};

export function mergeSettings(v: Partial<AgentSettings> | null | undefined): AgentSettings {
  const s = v || {};
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    photos: Array.isArray(s.photos) ? s.photos : [],
    look: { ...DEFAULT_SETTINGS.look, ...(s.look || {}) },
    colors: { ...DEFAULT_SETTINGS.colors, ...(s.colors || {}) },
    voice: { ...DEFAULT_SETTINGS.voice, ...(s.voice || {}) },
    reminders: { ...DEFAULT_SETTINGS.reminders, ...(s.reminders || {}) },
    dailyReport: { ...DEFAULT_SETTINGS.dailyReport, ...(s.dailyReport || {}) },
  };
}

// ---------- Les magasins de l'agent ----------

export const settingsStore = createDocStore<AgentSettings>('settings', DEFAULT_SETTINGS, mergeSettings);
export const memoryStore = createDocStore<MemoryItem[]>('memory', [], (v) => (Array.isArray(v) ? v : []));
export const chatStore = createDocStore<AgentMessage[]>('chat', [], (v) => (Array.isArray(v) ? v : []));

// Clés locales identiques à l'ancien magasin : les données déjà saisies sur l'appareil sont gardées.
export const clientsStore = createListStore<ClientLead>(
  'clients',
  'alwassit777.clients.v1',
  (a, b) => ((b.createdAt || b.dateAdded) > (a.createdAt || a.dateAdded) ? 1 : -1),
  mockClientLeads // exemples affichés seulement en mode local, comme avant
);
export const appointmentsStore = createListStore<Appointment>('appointments', 'alwassit777.appointments.v1', (a, b) => (a.at < b.at ? -1 : 1));

export function useStore<T>(s: { get(): T; subscribe(l: Listener): () => void }): T {
  return useSyncExternalStore(s.subscribe, s.get, s.get);
}

// ---------- Photos du personnage ----------

export async function saveAvatarPhoto(blob: Blob, name: string): Promise<StoredFileRef> {
  const id = `avatar-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  if (isFirebaseEnabled) {
    const path = `agent/photos/${id}.jpg`;
    const r = ref(requireStorage(), path);
    await uploadBytes(r, blob, { contentType: 'image/jpeg' });
    return { id, name, type: 'image/jpeg', size: blob.size, path, url: await getDownloadURL(r) };
  }
  await putFile(id, blob);
  return { id, name, type: 'image/jpeg', size: blob.size };
}

export async function deleteAvatarPhoto(file: StoredFileRef): Promise<void> {
  if (file.path && isFirebaseEnabled) await deleteObject(ref(requireStorage(), file.path)).catch(() => undefined);
  else await deleteFile(file.id).catch(() => undefined);
}

const blobUrls = new Map<string, string>();
export async function photoUrl(file: StoredFileRef): Promise<string | null> {
  if (file.url) return file.url;
  if (blobUrls.has(file.id)) return blobUrls.get(file.id)!;
  const blob = await getFile(file.id).catch(() => undefined);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  blobUrls.set(file.id, url);
  return url;
}
