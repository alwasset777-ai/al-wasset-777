// Données gardées par le serveur pour l'agent : conversations WhatsApp, tâches en attente, état.
// Firestore (compte de service) si disponible ; sinon mémoire + fichier .data/ (perdu sur Cloud Run/Vercel au redémarrage).
import fs from 'node:fs';
import path from 'node:path';
import type { AgentTask, WaThread } from '../src/agent/types.js';
import { adminDb } from './firebaseAdmin.js';

export type DataCollection = 'clients' | 'appointments' | 'registry';

export interface ServerStore {
  kind: 'firestore' | 'memory';
  listThreads(): Promise<WaThread[]>;
  getThread(id: string): Promise<WaThread | null>;
  saveThread(t: WaThread): Promise<void>;
  listTasks(): Promise<AgentTask[]>;
  saveTask(t: AgentTask): Promise<void>;
  getState<T>(key: string, fallback: T): Promise<T>;
  setState(key: string, value: unknown): Promise<void>;
  list<T>(collection: DataCollection): Promise<T[]>;
  // Rendez-vous entre deux dates (ISO) : lecture limitée pour rester dans le quota gratuit de Firestore.
  appointmentsBetween<T>(fromIso: string, toIso: string): Promise<T[]>;
  put(collection: DataCollection, id: string, data: object): Promise<void>;
  patch(collection: DataCollection, id: string, data: object): Promise<void>;
  remove(collection: DataCollection, id: string): Promise<void>;
  replaceAll(collection: DataCollection, items: Array<{ id: string }>): Promise<void>;
}

export const MAX_THREAD_MESSAGES = 150;

// Firestore refuse les valeurs « undefined ».
const clean = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const byLastDesc = (a: WaThread, b: WaThread) => (a.lastAt < b.lastAt ? 1 : -1);

function firestoreStore(): ServerStore {
  const db = adminDb!;
  return {
    kind: 'firestore',
    async listThreads() {
      const snap = await db.collection('wa_threads').orderBy('lastAt', 'desc').limit(100).get();
      return snap.docs.map((d) => ({ ...(d.data() as WaThread), id: d.id }));
    },
    async getThread(id) {
      const d = await db.collection('wa_threads').doc(id).get();
      return d.exists ? ({ ...(d.data() as WaThread), id: d.id }) : null;
    },
    async saveThread(t) {
      await db.collection('wa_threads').doc(t.id).set(clean({ ...t, messages: t.messages.slice(-MAX_THREAD_MESSAGES) }));
    },
    async listTasks() {
      const snap = await db.collection('agent_tasks').orderBy('createdAt', 'desc').limit(50).get();
      return snap.docs.map((d) => ({ ...(d.data() as AgentTask), id: d.id }));
    },
    async saveTask(t) {
      await db.collection('agent_tasks').doc(t.id).set(clean(t));
    },
    async getState(key, fallback) {
      const d = await db.collection('agent_state').doc(key).get();
      return d.exists ? ((d.data() as { value: any }).value ?? fallback) : fallback;
    },
    async setState(key, value) {
      await db.collection('agent_state').doc(key).set(clean({ value, updatedAt: new Date().toISOString() }));
    },
    async list(collection) {
      const snap = await db.collection(collection).limit(500).get();
      return snap.docs.map((d) => ({ ...(d.data() as any), id: d.id }));
    },
    async appointmentsBetween(fromIso, toIso) {
      const snap = await db.collection('appointments').where('at', '>=', fromIso).where('at', '<=', toIso).limit(200).get();
      return snap.docs.map((d) => ({ ...(d.data() as any), id: d.id }));
    },
    async put(collection, id, data) {
      await db.collection(collection).doc(id).set(clean(data));
    },
    async patch(collection, id, data) {
      await db.collection(collection).doc(id).set(clean(data), { merge: true });
    },
    async remove(collection, id) {
      await db.collection(collection).doc(id).delete();
    },
    // Avec Firestore, l'application écrit elle-même ces collections : rien à recopier.
    async replaceAll() {},
  };
}

function memoryStore(): ServerStore {
  const file = path.resolve(process.cwd(), '.data', 'agent-store.json');
  type Db = {
    threads: Record<string, WaThread>;
    tasks: Record<string, AgentTask>;
    state: Record<string, unknown>;
    data: Record<DataCollection, Record<string, any>>;
  };
  let db: Db = { threads: {}, tasks: {}, state: {}, data: { clients: {}, appointments: {}, registry: {} } };
  try {
    db = { ...db, ...JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch {
    // premier démarrage
  }
  let timer: NodeJS.Timeout | null = null;
  const persist = () => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, JSON.stringify(db));
      } catch {
        // disque en lecture seule (Vercel) : on garde en mémoire
      }
    }, 500);
  };
  return {
    kind: 'memory',
    async listThreads() {
      return Object.values(db.threads).sort(byLastDesc).slice(0, 100);
    },
    async getThread(id) {
      return db.threads[id] ? clean(db.threads[id]) : null;
    },
    async saveThread(t) {
      db.threads[t.id] = clean({ ...t, messages: t.messages.slice(-MAX_THREAD_MESSAGES) });
      persist();
    },
    async listTasks() {
      return Object.values(db.tasks).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 50);
    },
    async saveTask(t) {
      db.tasks[t.id] = clean(t);
      persist();
    },
    async getState(key, fallback) {
      return key in db.state ? (clean(db.state[key]) as any) : fallback;
    },
    async setState(key, value) {
      db.state[key] = clean(value);
      persist();
    },
    async list(collection) {
      return Object.values(db.data[collection]) as any[];
    },
    async appointmentsBetween(fromIso, toIso) {
      return Object.values(db.data.appointments).filter((a: any) => a.at >= fromIso && a.at <= toIso) as any[];
    },
    async put(collection, id, data) {
      db.data[collection][id] = clean({ ...data, id });
      persist();
    },
    async patch(collection, id, data) {
      db.data[collection][id] = clean({ ...(db.data[collection][id] || {}), ...data, id });
      persist();
    },
    async remove(collection, id) {
      delete db.data[collection][id];
      persist();
    },
    // Sans Firestore, l'application envoie une copie de ses données (rappels, contexte WhatsApp).
    async replaceAll(collection, items) {
      db.data[collection] = Object.fromEntries(items.map((it) => [it.id, clean(it)]));
      persist();
    },
  };
}

export const store: ServerStore = adminDb ? firestoreStore() : memoryStore();

export const newServerId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
