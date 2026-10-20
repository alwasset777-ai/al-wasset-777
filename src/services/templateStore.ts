// Modèles ajoutés par le gérant, enregistrés dans le navigateur (IndexedDB) : image de fond + zones.
// Ils restent sur l'appareil où ils ont été créés.
import type { CustomTemplate } from './posterTemplates';

const DB = 'alwasset-studio';
const STORE = 'templates';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Stockage indisponible'));
  });
}

async function run<T>(mode: IDBTransactionMode, job: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const req = job(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Stockage indisponible'));
  }).finally(() => db.close());
}

export async function listTemplates(): Promise<CustomTemplate[]> {
  if (typeof indexedDB === 'undefined') return [];
  const all = await run<CustomTemplate[]>('readonly', (s) => s.getAll() as IDBRequest<CustomTemplate[]>).catch(() => []);
  return all.sort((a, b) => a.created - b.created);
}

export const saveTemplate = (t: CustomTemplate) => run('readwrite', (s) => s.put(t));

export const deleteTemplate = (id: string) => run('readwrite', (s) => s.delete(id));
