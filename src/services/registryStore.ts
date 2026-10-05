// Stockage du registre des biens : en ligne (Firebase) quand il est configuré, sinon sur l'appareil.
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { RegistryProperty, StoredFileRef } from '../types';
import { isFirebaseEnabled, requireDb, requireStorage } from './firebase';
import { loadJSON, saveJSON } from './storage';
import { deleteFile, getFile, putFile } from './fileStore';

const LOCAL_KEY = 'alwassit777.registry.v1';
const COLLECTION = 'registry';

export type NewFiles = { photos: File[]; videos: File[]; documents: File[] };
export type RegistryFields = Omit<RegistryProperty, 'id' | 'photos' | 'videos' | 'documents' | 'createdAt'>;

export interface RegistryStore {
  online: boolean;
  subscribe(cb: (items: RegistryProperty[]) => void, onError?: (e: Error) => void): () => void;
  add(fields: RegistryFields, files: NewFiles): Promise<void>;
  update(item: RegistryProperty, fields: Partial<RegistryFields>): Promise<void>;
  remove(item: RegistryProperty): Promise<void>;
  open(file: StoredFileRef): Promise<Blob | string | undefined>; // Blob (local) ou URL (en ligne)
}

const newId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// ---------- Mode local (navigateur) ----------
function createLocalStore(): RegistryStore {
  let items = loadJSON<RegistryProperty[]>(LOCAL_KEY, []);
  const listeners = new Set<(items: RegistryProperty[]) => void>();
  const emit = () => {
    saveJSON(LOCAL_KEY, items);
    listeners.forEach((l) => l(items));
  };
  const storeFiles = (list: File[]) =>
    Promise.all(
      list.map(async (f) => {
        const id = newId('file');
        await putFile(id, f);
        return { id, name: f.name, type: f.type, size: f.size } as StoredFileRef;
      })
    );
  return {
    online: false,
    subscribe(cb) {
      listeners.add(cb);
      cb(items);
      return () => listeners.delete(cb);
    },
    async add(fields, files) {
      const [photos, videos, documents] = await Promise.all([storeFiles(files.photos), storeFiles(files.videos), storeFiles(files.documents)]);
      items = [{ id: newId('reg'), ...fields, photos, videos, documents, createdAt: new Date().toISOString() }, ...items];
      emit();
    },
    async update(item, fields) {
      items = items.map((x) => (x.id === item.id ? { ...x, ...fields } : x));
      emit();
    },
    async remove(item) {
      await Promise.all([...item.photos, ...item.videos, ...item.documents].map((f) => deleteFile(f.id).catch(() => undefined)));
      items = items.filter((x) => x.id !== item.id);
      emit();
    },
    open: (file) => getFile(file.id),
  };
}

// ---------- Mode en ligne (Firebase) ----------
function createFirebaseStore(): RegistryStore {
  const uploadAll = (entryId: string, list: File[]) =>
    Promise.all(
      list.map(async (f) => {
        const id = newId('file');
        const path = `${COLLECTION}/${entryId}/${id}-${f.name.replace(/[^\w.\-]+/g, '_')}`;
        const r = ref(requireStorage(), path);
        await uploadBytes(r, f, { contentType: f.type || undefined });
        const url = await getDownloadURL(r);
        return { id, name: f.name, type: f.type, size: f.size, path, url } as StoredFileRef;
      })
    );
  return {
    online: true,
    subscribe(cb, onError) {
      const q = query(collection(requireDb(), COLLECTION), orderBy('createdAt', 'desc'));
      return onSnapshot(
        q,
        (snap) => cb(snap.docs.map((d) => ({ ...(d.data() as Omit<RegistryProperty, 'id'>), id: d.id }))),
        (err) => onError?.(err)
      );
    },
    async add(fields, files) {
      const id = newId('reg');
      const [photos, videos, documents] = await Promise.all([uploadAll(id, files.photos), uploadAll(id, files.videos), uploadAll(id, files.documents)]);
      await setDoc(doc(requireDb(), COLLECTION, id), { ...fields, photos, videos, documents, createdAt: new Date().toISOString() });
    },
    async update(item, fields) {
      await setDoc(doc(requireDb(), COLLECTION, item.id), fields, { merge: true });
    },
    async remove(item) {
      await Promise.all(
        [...item.photos, ...item.videos, ...item.documents]
          .filter((f) => f.path)
          .map((f) => deleteObject(ref(requireStorage(), f.path!)).catch(() => undefined))
      );
      await deleteDoc(doc(requireDb(), COLLECTION, item.id));
    },
    open: async (file) => file.url,
  };
}

export const registryStore: RegistryStore = isFirebaseEnabled ? createFirebaseStore() : createLocalStore();
