// Connexion à Firebase (Google) : authentification, base Firestore et stockage des fichiers.
// La configuration web Firebase n'est pas secrète ; la sécurité vient des règles (firestore.rules, storage.rules).
// Sans configuration (variables VITE_FIREBASE_*), l'application reste en mode local sur l'appareil.
import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  type Auth,
  type User,
} from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

// Valeurs injectées par le serveur à l'exécution (secrets AI Studio / Cloud Run), sinon celles de la construction.
const runtime: Record<string, unknown> = (typeof window !== 'undefined' && (window as any).__APP_CONFIG__) || {};
const env: Partial<ImportMetaEnv> = {
  ...(import.meta.env ?? {}),
  ...Object.fromEntries(Object.entries(runtime).filter(([, v]) => typeof v === 'string' && v !== '')),
};

const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  appId: env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseEnabled = Boolean(config.apiKey && config.projectId && config.storageBucket);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

if (isFirebaseEnabled) {
  app = initializeApp(config);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
}

export function requireDb(): Firestore {
  if (!db) throw new Error('Firebase non configuré');
  return db;
}

export function requireStorage(): FirebaseStorage {
  if (!storage) throw new Error('Firebase non configuré');
  return storage;
}

export function onUserChange(cb: (user: User | null) => void): () => void {
  if (!auth) {
    cb(null);
    return () => {};
  }
  return onAuthStateChanged(auth, cb);
}

export async function signIn(email: string, password: string): Promise<void> {
  if (!auth) throw new Error('Firebase non configuré');
  await signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function signOut(): Promise<void> {
  if (auth) await fbSignOut(auth);
}

// Jeton envoyé au serveur (server.ts) pour prouver que c'est bien le gérant qui publie.
export async function getIdToken(): Promise<string | null> {
  return auth?.currentUser ? auth.currentUser.getIdToken() : null;
}
