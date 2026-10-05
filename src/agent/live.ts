// Données vivantes utilisées par l'agent : registre, conversations WhatsApp, tâches en attente, état du serveur.
import type { RegistryProperty } from '../types';
import type { AgentTask, WaThread } from './types';
import { onUserChange } from '../services/firebase';
import { registryStore } from '../services/registryStore';
import { fetchHealth, fetchTasks, fetchThreads, type HealthStatus, type WaStatus } from './api';

type Listener = () => void;

function createLive<T>(initial: T) {
  let value = initial;
  const listeners = new Set<Listener>();
  return {
    get: () => value,
    set(next: T) {
      value = next;
      listeners.forEach((l) => l());
    },
    subscribe(l: Listener) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
}

// ---- Registre (biens + propriétaires) ----

export const registryLive = createLive<RegistryProperty[]>([]);
let stopRegistry: (() => void) | null = null;
const startRegistry = () => {
  stopRegistry?.();
  stopRegistry = registryStore.subscribe((items) => registryLive.set(items), () => registryLive.set([]));
};
if (registryStore.online) {
  onUserChange((user) => {
    stopRegistry?.();
    stopRegistry = null;
    registryLive.set([]);
    if (user) startRegistry();
  });
} else {
  startRegistry();
}

// ---- WhatsApp ----

export interface WaState {
  threads: WaThread[];
  status: WaStatus | null;
  store: string;
  error: string | null;
  loaded: boolean;
}

export const waLive = createLive<WaState>({ threads: [], status: null, store: '', error: null, loaded: false });

export async function refreshWhatsApp(): Promise<void> {
  try {
    const r = await fetchThreads();
    waLive.set({ threads: r.threads, status: r.status, store: r.store, error: null, loaded: true });
  } catch (err) {
    waLive.set({ ...waLive.get(), error: (err as Error).message, loaded: true });
  }
}

export function upsertThread(t: WaThread) {
  const s = waLive.get();
  const threads = [t, ...s.threads.filter((x) => x.id !== t.id)].sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));
  waLive.set({ ...s, threads });
}

// ---- Tâches en attente (envoyées depuis WhatsApp) ----

export const tasksLive = createLive<AgentTask[]>([]);

export async function refreshTasks(): Promise<void> {
  try {
    tasksLive.set(await fetchTasks());
  } catch {
    // serveur sans Firebase en production, ou hors ligne
  }
}

// ---- État du serveur (IA, WhatsApp, Firestore) ----

export const healthLive = createLive<HealthStatus | null>(null);
export const refreshHealth = async () => healthLive.set(await fetchHealth());

// ---- Petites alertes dans l'application (rappels, nouveaux messages, rapport) ----

export interface Toast {
  id: string;
  title: string;
  body?: string;
  section?: string; // sous-onglet de la page « الوكيل » à ouvrir
}

export const toastsLive = createLive<Toast[]>([]);

export function pushToast(t: Omit<Toast, 'id'>) {
  const toast = { ...t, id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` };
  toastsLive.set([...toastsLive.get(), toast].slice(-4));
  setTimeout(() => dismissToast(toast.id), 12000);
}

export const dismissToast = (id: string) => toastsLive.set(toastsLive.get().filter((t) => t.id !== id));
