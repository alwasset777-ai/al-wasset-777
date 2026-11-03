// Petite base locale au-dessus d'IndexedDB (gratuite, hors-ligne, privée).
import type { CollectionName } from './types';

const DB_NAME = 'wakil';
const DB_VERSION = 1;
export const COLLECTIONS: CollectionName[] = [
  'profile',
  'projects',
  'chats',
  'messages',
  'tasks',
  'agents',
  'tools',
  'files',
  'memory',
  'settings',
  'logs',
];

let dbPromise: Promise<IDBDatabase> | null = null;
const listeners = new Map<CollectionName, Set<() => void>>();

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of COLLECTIONS) {
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, { keyPath: 'id' });
          if (name === 'messages') store.createIndex('chatId', 'chatId');
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(name: CollectionName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(name, mode);
        const store = t.objectStore(name);
        const req = fn(store);
        let result: T;
        if (req) req.onsuccess = () => (result = req.result);
        t.oncomplete = () => resolve(result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      }),
  );
}

function emit(name: CollectionName) {
  listeners.get(name)?.forEach((l) => l());
}

export const db = {
  async all<T>(name: CollectionName): Promise<T[]> {
    const rows = await tx<T[]>(name, 'readonly', (s) => s.getAll() as IDBRequest<T[]>);
    return (rows || []).filter((r) => !(r as { deleted?: boolean }).deleted);
  },
  async allIncludingDeleted<T>(name: CollectionName): Promise<T[]> {
    return (await tx<T[]>(name, 'readonly', (s) => s.getAll() as IDBRequest<T[]>)) || [];
  },
  async byIndex<T>(name: CollectionName, index: string, value: IDBValidKey): Promise<T[]> {
    const rows = await tx<T[]>(name, 'readonly', (s) => s.index(index).getAll(value) as IDBRequest<T[]>);
    return (rows || []).filter((r) => !(r as { deleted?: boolean }).deleted);
  },
  async get<T>(name: CollectionName, id: string): Promise<T | undefined> {
    const row = await tx<T | undefined>(name, 'readonly', (s) => s.get(id) as IDBRequest<T | undefined>);
    if (row && (row as { deleted?: boolean }).deleted) return undefined;
    return row;
  },
  async getRaw<T>(name: CollectionName, id: string): Promise<T | undefined> {
    return tx<T | undefined>(name, 'readonly', (s) => s.get(id) as IDBRequest<T | undefined>);
  },
  async put<T extends { id: string }>(name: CollectionName, value: T, silent = false): Promise<T> {
    await tx(name, 'readwrite', (s) => s.put(value));
    if (!silent) emit(name);
    onWrite?.(name, value);
    return value;
  },
  async putMany<T extends { id: string }>(name: CollectionName, values: T[]): Promise<void> {
    if (!values.length) return;
    await tx(name, 'readwrite', (s) => {
      for (const v of values) s.put(v);
    });
    emit(name);
  },
  /** Suppression douce : garde une trace pour la synchronisation. */
  async remove(name: CollectionName, id: string): Promise<void> {
    const row = await tx<Record<string, unknown> | undefined>(name, 'readonly', (s) => s.get(id) as IDBRequest);
    if (!row) return;
    await db.put(name, { ...row, id, deleted: true, updatedAt: Date.now(), content: undefined } as { id: string });
  },
  async hardClear(name: CollectionName): Promise<void> {
    await tx(name, 'readwrite', (s) => s.clear());
    emit(name);
  },
  subscribe(name: CollectionName, fn: () => void): () => void {
    if (!listeners.has(name)) listeners.set(name, new Set());
    listeners.get(name)!.add(fn);
    return () => listeners.get(name)!.delete(fn);
  },
  emit,
};

/** Crochet appelé à chaque écriture (utilisé par la synchro cloud). */
let onWrite: ((name: CollectionName, value: unknown) => void) | undefined;
export function setWriteHook(fn: typeof onWrite) {
  onWrite = fn;
}

export function uid(prefix = ''): string {
  const r = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return prefix + r.replace(/-/g, '').slice(0, 20);
}

export function now() {
  return Date.now();
}
