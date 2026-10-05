// Firebase côté serveur : vérification du gérant (toujours) et base Firestore (si un compte de service est fourni).
// FIREBASE_SERVICE_ACCOUNT = contenu JSON du compte de service (ou ce JSON encodé en base64).
// Sans ce compte, WhatsApp et les rappels fonctionnent en mémoire (perdus au redémarrage du serveur).
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type express from 'express';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
export const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

function readServiceAccount(): Record<string, string> | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8'));
  } catch {
    console.error('FIREBASE_SERVICE_ACCOUNT illisible : JSON du compte de service attendu');
    return null;
  }
}

const serviceAccount = readServiceAccount();
const projectId = PROJECT_ID || serviceAccount?.project_id;

let app: App | null = null;
if (projectId) {
  app =
    getApps()[0] ||
    initializeApp(serviceAccount ? { credential: cert(serviceAccount as any), projectId } : { projectId });
}

export const adminAuth = app ? getAuth(app) : null;
export const adminDb: Firestore | null = app && serviceAccount ? getFirestore(app) : null;

// Vérifie le jeton Firebase envoyé par l'application : seul le gérant (ADMIN_EMAILS) est accepté.
export async function isAdmin(req: express.Request): Promise<boolean> {
  if (!adminAuth) return false;
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  if (!token) return false;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const email = (decoded.email || '').toLowerCase();
    // Liste obligatoire : sans ADMIN_EMAILS, personne n'est autorisé.
    return Boolean(email && ADMIN_EMAILS.includes(email));
  } catch {
    return false;
  }
}

// Accès aux données de l'agent (clients, WhatsApp) : gérant connecté obligatoire.
// Sans Firebase, autorisé uniquement en développement (ordinateur local).
export async function requireAdmin(req: express.Request, res: express.Response): Promise<boolean> {
  if (adminAuth ? await isAdmin(req) : process.env.NODE_ENV !== 'production') return true;
  res.status(401).json({ error: adminAuth ? 'Connexion du gérant requise' : 'Firebase non configuré' });
  return false;
}
