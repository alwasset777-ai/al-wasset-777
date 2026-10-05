// WhatsApp Business Platform (API Cloud de Meta) : réception des messages, envoi des réponses validées.
// Les messages des numéros du gérant (WHATSAPP_OWNER_NUMBERS) sont des ordres pour l'agent ;
// les autres sont des clients : l'agent les évalue et prépare une réponse que le gérant valide dans l'application.
import crypto from 'node:crypto';
import type { WaMessage, WaThread } from '../src/agent/types.js';
import { toWaNumber } from '../src/agent/normalize.js';
import { analyzeClientThread, transcribe } from './agentBrain.js';
import { aiEnabled, type InlineFile } from './gemini.js';
import { store } from './store.js';

const GRAPH = `${process.env.META_GRAPH_URL || 'https://graph.facebook.com'}/${process.env.META_GRAPH_VERSION || 'v21.0'}`;
const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
export const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const APP_SECRET = process.env.WHATSAPP_APP_SECRET || process.env.META_APP_SECRET;
export const OWNER_NUMBERS = (process.env.WHATSAPP_OWNER_NUMBERS || '').split(',').map(toWaNumber).filter(Boolean);

export const waStatus = {
  configured: Boolean(TOKEN && PHONE_ID),
  webhook: Boolean(VERIFY_TOKEN && APP_SECRET),
  owners: OWNER_NUMBERS.length,
};

export const isOwner = (num: string) => OWNER_NUMBERS.includes(toWaNumber(num));

// ---- Envoi ----

export async function sendText(to: string, text: string): Promise<string> {
  if (!waStatus.configured) throw new Error('WhatsApp non configuré');
  const body = text.trim().slice(0, 4096);
  if (!body) throw new Error('Message vide');
  const res = await fetch(`${GRAPH}/${PHONE_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: toWaNumber(to), type: 'text', text: { body, preview_url: false } }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(data.error?.message || `Erreur WhatsApp (${res.status})`);
  return String(data.messages?.[0]?.id || '');
}

// Message long (contrat, recherche) découpé en plusieurs messages WhatsApp.
export async function sendLongText(to: string, text: string): Promise<void> {
  const chunks: string[] = [];
  let rest = text.trim();
  while (rest.length > 3800) {
    const cut = rest.lastIndexOf('\n', 3800) > 2000 ? rest.lastIndexOf('\n', 3800) : 3800;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut).trim();
  }
  if (rest) chunks.push(rest);
  for (const c of chunks.slice(0, 5)) await sendText(to, c);
}

// Avertit le gérant sur WhatsApp (fonctionne si le gérant a écrit à l'agent dans les dernières 24 h).
export async function notifyOwners(text: string): Promise<void> {
  if (!waStatus.configured) return;
  await Promise.all(OWNER_NUMBERS.map((n) => sendText(n, text).catch((e) => console.warn('Notification WhatsApp :', (e as Error).message))));
}

// Enregistre un message envoyé par l'agence dans la conversation.
export async function recordOutgoing(to: string, text: string, id: string): Promise<WaThread> {
  const num = toWaNumber(to);
  const now = new Date().toISOString();
  const thread = (await store.getThread(num)) || newThread(num, num, now);
  thread.messages.push({ id: id || `out-${Date.now()}`, from: 'agency', text, at: now, kind: 'text' });
  thread.lastAt = now;
  thread.unread = false;
  thread.suggestion = undefined;
  await store.saveThread(thread);
  return thread;
}

// ---- Réception (webhook) ----

export function verifySignature(raw: Buffer | undefined, header: string | undefined): boolean {
  if (!APP_SECRET || !raw || !header?.startsWith('sha256=')) return false;
  const expected = Buffer.from(`sha256=${crypto.createHmac('sha256', APP_SECRET).update(raw).digest('hex')}`);
  const got = Buffer.from(header);
  return expected.length === got.length && crypto.timingSafeEqual(expected, got);
}

async function downloadMedia(mediaId: string): Promise<InlineFile | null> {
  try {
    const meta = await fetch(`${GRAPH}/${mediaId}`, { headers: { Authorization: `Bearer ${TOKEN}` } }).then((r) => r.json());
    if (!meta?.url || (meta.file_size && meta.file_size > 8 * 1024 * 1024)) return null;
    const res = await fetch(meta.url, { headers: { Authorization: `Bearer ${TOKEN}` } });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return { mimeType: String(meta.mime_type || res.headers.get('content-type') || 'application/octet-stream'), data: buf.toString('base64') };
  } catch {
    return null;
  }
}

function newThread(id: string, name: string, now: string): WaThread {
  return { id, phone: id, name, messages: [], lastAt: now, unread: true, status: 'open' };
}

export interface IncomingMessage {
  id: string;
  from: string;
  name: string;
  at: string;
  kind: WaMessage['kind'];
  text: string;
  file?: InlineFile;
}

// Meta renvoie parfois le même événement : on garde les derniers identifiants traités.
const seen = new Set<string>();
const remember = (id: string) => {
  seen.add(id);
  if (seen.size > 500) seen.delete(seen.values().next().value as string);
};

export async function parseWebhook(body: any): Promise<IncomingMessage[]> {
  const out: IncomingMessage[] = [];
  for (const entry of body?.entry || []) {
    for (const change of entry?.changes || []) {
      const value = change?.value;
      if (!value?.messages) continue;
      const names: Record<string, string> = Object.fromEntries((value.contacts || []).map((c: any) => [c.wa_id, c.profile?.name || '']));
      for (const m of value.messages) {
        if (!m?.id || seen.has(m.id)) continue;
        remember(m.id);
        const at = new Date(Number(m.timestamp) * 1000 || Date.now()).toISOString();
        const base = { id: m.id, from: String(m.from), name: names[m.from] || '', at };
        if (m.type === 'text') out.push({ ...base, kind: 'text', text: String(m.text?.body || '') });
        else if (m.type === 'audio') {
          const file = await downloadMedia(m.audio?.id);
          out.push({ ...base, kind: 'audio', text: '', file: file || undefined });
        } else if (m.type === 'image' || m.type === 'document') {
          const media = m[m.type];
          const file = await downloadMedia(media?.id);
          out.push({ ...base, kind: m.type, text: String(media?.caption || media?.filename || ''), file: file || undefined });
        } else if (m.type === 'button') out.push({ ...base, kind: 'text', text: String(m.button?.text || '') });
        else if (m.type === 'interactive') {
          const r = m.interactive?.button_reply || m.interactive?.list_reply;
          out.push({ ...base, kind: 'text', text: String(r?.title || '') });
        } else out.push({ ...base, kind: 'other', text: `[${m.type}]` });
      }
    }
  }
  return out;
}

// Message d'un client : on l'ajoute à sa conversation, on l'évalue et on prépare une réponse à valider.
export async function handleClientMessage(msg: IncomingMessage): Promise<void> {
  const num = toWaNumber(msg.from);
  const existing = await store.getThread(num);
  const thread = existing || newThread(num, msg.name || num, msg.at);
  if (thread.messages.some((m) => m.id === msg.id)) return;

  let text = msg.text;
  if (msg.kind === 'audio') {
    text = msg.file && aiEnabled ? `🎤 ${await transcribe(msg.file).catch(() => '(رسالة صوتية)')}` : '🎤 (رسالة صوتية)';
  } else if (msg.kind === 'image') text = `📷 ${text || 'صورة'}`;
  else if (msg.kind === 'document') text = `📄 ${text || 'وثيقة'}`;

  const lastAt = existing ? Date.parse(existing.lastAt) : 0;
  const isNewConversation = !existing || existing.status === 'done' || Date.now() - lastAt > 6 * 3600 * 1000;
  const previousScore = thread.lead?.score;

  thread.messages.push({ id: msg.id, from: 'client', text, at: msg.at, kind: msg.kind });
  thread.lastAt = msg.at;
  thread.unread = true;
  thread.status = 'open';
  if (msg.name) thread.name = msg.name;
  await store.saveThread(thread);

  if (!aiEnabled) return;
  try {
    const catalog = await store.getState('catalog', []);
    const analysis = await analyzeClientThread(thread, catalog);
    const fresh = (await store.getThread(num)) || thread;
    fresh.lead = analysis.lead;
    fresh.suggestion = analysis.suggestion || undefined;
    if ((!fresh.name || fresh.name === num) && analysis.name) fresh.name = analysis.name;
    await store.saveThread(fresh);

    if (isNewConversation || (analysis.lead.score === 'جاد' && previousScore !== 'جاد')) {
      await notifyOwners(
        `📩 ${fresh.name} (${analysis.lead.score})\n«${text.slice(0, 300)}»\n\n💡 الرد المقترح:\n${analysis.suggestion.slice(0, 600)}\n\nافتح التطبيق ← الوكيل ← واتساب باش توافق ولا تبدّل الرد.`
      );
    }
  } catch (err) {
    console.error('Analyse WhatsApp :', err);
  }
}
