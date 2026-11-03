// « منير » sur WhatsApp (API WhatsApp Cloud de Meta). Les jetons restent côté serveur.
// Variables Vercel : WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_VERIFY_TOKEN,
// WHATSAPP_APP_SECRET, WHATSAPP_OWNER (numéro(s) du gérant, ex. 212661000000, séparés par des virgules).
import { createHmac, timingSafeEqual } from 'node:crypto';

const GRAPH = `${process.env.META_GRAPH_URL || 'https://graph.facebook.com'}/${process.env.META_GRAPH_VERSION || 'v21.0'}`;
const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const APP_SECRET = process.env.WHATSAPP_APP_SECRET;

export const normalizePhone = (p: string) => {
  const d = p.replace(/[^\d]/g, '');
  if (d.startsWith('00')) return d.slice(2);
  if (d.startsWith('0')) return `212${d.slice(1)}`;
  return d;
};
const OWNERS = (process.env.WHATSAPP_OWNER || '').split(',').map(normalizePhone).filter((n) => n.length >= 9);

export const whatsappEnabled = Boolean(TOKEN && PHONE_ID && VERIFY_TOKEN && APP_SECRET && OWNERS.length);

export const isOwner = (from: string) => OWNERS.includes(normalizePhone(from));

// Étape « Verify » de Meta : renvoie le challenge si le jeton correspond.
export function verifyChallenge(query: Record<string, unknown>): string | null {
  if (!VERIFY_TOKEN) return null;
  return query['hub.mode'] === 'subscribe' && query['hub.verify_token'] === VERIFY_TOKEN && typeof query['hub.challenge'] === 'string'
    ? query['hub.challenge']
    : null;
}

// Chaque message reçu est signé par Meta avec le secret de l'application.
export function validSignature(rawBody: Buffer | undefined, header: unknown): boolean {
  if (!APP_SECRET || !rawBody || typeof header !== 'string' || !header.startsWith('sha256=')) return false;
  const expected = createHmac('sha256', APP_SECRET).update(rawBody).digest();
  const given = Buffer.from(header.slice(7), 'hex');
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export interface IncomingText {
  id: string;
  from: string;
  text: string;
}

// Extrait les messages texte (et les notes vocales/images signalées comme non prises en charge).
export function extractMessages(body: any): (IncomingText & { unsupported?: boolean })[] {
  const out: (IncomingText & { unsupported?: boolean })[] = [];
  for (const entry of Array.isArray(body?.entry) ? body.entry : []) {
    for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
      for (const m of Array.isArray(change?.value?.messages) ? change.value.messages : []) {
        if (typeof m?.id !== 'string' || typeof m?.from !== 'string') continue;
        if (m.type === 'text' && typeof m.text?.body === 'string') out.push({ id: m.id, from: m.from, text: m.text.body.slice(0, 4000) });
        else out.push({ id: m.id, from: m.from, text: '', unsupported: true });
      }
    }
  }
  return out;
}

export async function sendText(to: string, text: string): Promise<void> {
  const res = await fetch(`${GRAPH}/${PHONE_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text.slice(0, 4000) } }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error?.message || `Erreur WhatsApp (${res.status})`);
  }
}
