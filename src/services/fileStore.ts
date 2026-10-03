// Stockage local des fichiers (photos, vidéos, documents) dans IndexedDB.
// localStorage est trop petit pour des fichiers ; IndexedDB garde les Blobs sur l'appareil.
const DB_NAME = 'alwassit777-files';
const STORE = 'files';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = op(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(req.result as T);
        tx.onerror = () => reject(tx.error);
      })
  );
}

export const putFile = (id: string, file: Blob) => run<void>('readwrite', (s) => s.put(file, id));
export const getFile = (id: string) => run<Blob | undefined>('readonly', (s) => s.get(id));
export const deleteFile = (id: string) => run<void>('readwrite', (s) => s.delete(id));
