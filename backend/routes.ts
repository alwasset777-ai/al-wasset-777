// Routes /api du وكيل الوسيط 777 : conversation, recherche, documents, WhatsApp, tâches, rappels.
import express from 'express';
import type { AgentTask, WaThread } from '../src/agent/types.js';
import { toWaNumber } from '../src/agent/normalize.js';
import { analyzeClientThread, draftDocument, runAgentChat, runSearch } from './agentBrain.js';
import { cronTick } from './cron.js';
import { adminAuth, isAdmin, requireAdmin } from './firebaseAdmin.js';
import { aiEnabled } from './gemini.js';
import { handleOwnerMessage } from './ownerChannel.js';
import { store } from './store.js';
import {
  VERIFY_TOKEN,
  handleClientMessage,
  isOwner,
  parseWebhook,
  recordOutgoing,
  sendText,
  verifySignature,
  waStatus,
} from './whatsapp.js';

const router = express.Router();
const CRON_SECRET = process.env.CRON_SECRET;
export const cronEnabled = Boolean(CRON_SECRET);

// Même règle que l'assistant d'origine : gérant connecté quand Firebase est configuré.
async function allowAgent(req: express.Request, res: express.Response): Promise<boolean> {
  if (adminAuth && !(await isAdmin(req))) {
    res.status(401).json({ error: 'Connexion requise' });
    return false;
  }
  if (!aiEnabled) {
    res.status(503).json({ error: 'GEMINI_API_KEY non configurée' });
    return false;
  }
  return true;
}

const fail = (res: express.Response, label: string, err: unknown, status = 502) => {
  console.error(`${label} :`, err);
  res.status(status).json({ error: (err as Error)?.message || label });
};

// ---- Conversation avec l'agent (application) ----

router.post('/agent/chat', async (req, res) => {
  if (!(await allowAgent(req, res))) return;
  const { messages, context, persona, files, audio } = req.body || {};
  if (!Array.isArray(messages) || (messages.length === 0 && !audio)) {
    res.status(400).json({ error: 'Messages manquants' });
    return;
  }
  try {
    res.json(await runAgentChat({ messages, context, persona, files: Array.isArray(files) ? files : [], audio, channel: 'app' }));
  } catch (err) {
    fail(res, 'Assistant indisponible', err);
  }
});

router.post('/agent/search', async (req, res) => {
  if (!(await allowAgent(req, res))) return;
  const { query, urls, language } = req.body || {};
  if (typeof query !== 'string' || !query.trim()) {
    res.status(400).json({ error: 'Recherche vide' });
    return;
  }
  try {
    res.json(await runSearch(query.slice(0, 1000), Array.isArray(urls) ? urls.filter((u) => typeof u === 'string') : [], language));
  } catch (err) {
    fail(res, 'Recherche impossible', err);
  }
});

router.post('/agent/document', async (req, res) => {
  if (!(await allowAgent(req, res))) return;
  const { kind, details, language } = req.body || {};
  try {
    res.json(await draftDocument(String(kind || 'أخرى'), String(details || ''), language === 'fr' ? 'fr' : 'ar'));
  } catch (err) {
    fail(res, 'Rédaction impossible', err);
  }
});

// L'application envoie au serveur la liste des biens (pour répondre aux clients WhatsApp)
// et, sans Firestore côté serveur, une copie des réglages, de la mémoire et des rendez-vous.
router.post('/agent/sync', async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  const { catalog, settings, memory, clients, appointments, registry } = req.body || {};
  try {
    if (Array.isArray(catalog)) await store.setState('catalog', catalog.slice(0, 200));
    if (store.kind === 'memory') {
      if (settings && typeof settings === 'object') await store.setState('settings', settings);
      if (Array.isArray(memory)) await store.setState('memory', memory);
      if (Array.isArray(clients)) await store.replaceAll('clients', clients.map((c: any) => ({ ...c, id: String(c.id) })));
      if (Array.isArray(appointments)) await store.replaceAll('appointments', appointments);
      if (Array.isArray(registry)) await store.replaceAll('registry', registry);
    }
    res.json({ ok: true, store: store.kind });
  } catch (err) {
    fail(res, 'Synchronisation impossible', err, 500);
  }
});

// ---- Tâches en attente (créées depuis WhatsApp) ----

router.get('/agent/tasks', async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  try {
    res.json({ tasks: await store.listTasks() });
  } catch (err) {
    fail(res, 'Tâches indisponibles', err, 500);
  }
});

router.post('/agent/tasks/:id', async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  const status = req.body?.status;
  if (status !== 'done' && status !== 'rejected') {
    res.status(400).json({ error: 'Statut invalide' });
    return;
  }
  const task = (await store.listTasks()).find((t) => t.id === req.params.id);
  if (!task) {
    res.status(404).json({ error: 'Tâche introuvable' });
    return;
  }
  const updated: AgentTask = { ...task, status };
  await store.saveTask(updated);
  res.json({ task: updated });
});

// ---- WhatsApp : boîte de réception du gérant ----

router.get('/whatsapp/threads', async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  try {
    res.json({ threads: await store.listThreads(), status: waStatus, store: store.kind });
  } catch (err) {
    fail(res, 'Conversations indisponibles', err, 500);
  }
});

router.post('/whatsapp/send', async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  const { to, text } = req.body || {};
  if (typeof to !== 'string' || !toWaNumber(to) || typeof text !== 'string' || !text.trim()) {
    res.status(400).json({ error: 'Numéro ou message manquant' });
    return;
  }
  try {
    const id = await sendText(to, text);
    res.json({ id, thread: await recordOutgoing(to, text.trim(), id) });
  } catch (err) {
    fail(res, 'Envoi WhatsApp impossible', err);
  }
});

router.post('/whatsapp/threads/:id', async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  const thread = await store.getThread(req.params.id);
  if (!thread) {
    res.status(404).json({ error: 'Conversation introuvable' });
    return;
  }
  const { status, unread, name, suggestion } = req.body || {};
  const updated: WaThread = {
    ...thread,
    ...(status === 'open' || status === 'done' ? { status } : {}),
    ...(typeof unread === 'boolean' ? { unread } : {}),
    ...(typeof name === 'string' && name.trim() ? { name: name.trim().slice(0, 80) } : {}),
    ...(typeof suggestion === 'string' ? { suggestion: suggestion.slice(0, 4000) } : {}),
  };
  await store.saveThread(updated);
  res.json({ thread: updated });
});

router.post('/whatsapp/threads/:id/suggest', async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  if (!aiEnabled) {
    res.status(503).json({ error: 'GEMINI_API_KEY non configurée' });
    return;
  }
  const thread = await store.getThread(req.params.id);
  if (!thread) {
    res.status(404).json({ error: 'Conversation introuvable' });
    return;
  }
  try {
    const analysis = await analyzeClientThread(thread, await store.getState('catalog', []));
    const updated: WaThread = { ...thread, lead: analysis.lead, suggestion: analysis.suggestion || undefined };
    await store.saveThread(updated);
    res.json({ thread: updated });
  } catch (err) {
    fail(res, 'Analyse impossible', err);
  }
});

// Vérification du webhook par Meta (une seule fois, lors de la configuration).
router.get('/whatsapp/webhook', (req, res) => {
  if (VERIFY_TOKEN && req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === VERIFY_TOKEN) {
    res.status(200).send(String(req.query['hub.challenge'] ?? ''));
    return;
  }
  res.sendStatus(403);
});

// Messages reçus. On traite avant de répondre (les serveurs « serverless » s'arrêtent après la réponse),
// avec une limite de temps pour que Meta ne renvoie pas le message.
router.post('/whatsapp/webhook', async (req, res) => {
  if (!waStatus.webhook) {
    res.sendStatus(503);
    return;
  }
  if (!verifySignature((req as any).rawBody, req.header('x-hub-signature-256'))) {
    res.sendStatus(401);
    return;
  }
  const work = (async () => {
    for (const msg of await parseWebhook(req.body)) {
      try {
        if (isOwner(msg.from)) {
          if (aiEnabled) await handleOwnerMessage(msg);
          else await sendText(msg.from, 'الذكاء الاصطناعي غير مفعّل بعد (GEMINI_API_KEY).');
        } else {
          await handleClientMessage(msg);
        }
      } catch (err) {
        console.error('Webhook WhatsApp :', err);
      }
    }
  })();
  await Promise.race([work, new Promise((r) => setTimeout(r, 15000))]);
  res.sendStatus(200);
});

// ---- Rappels et rapport du matin ----

router.all('/cron/tick', async (req, res) => {
  const key = req.header('x-cron-key') || String(req.query.key || '');
  if (!CRON_SECRET || key !== CRON_SECRET) {
    res.sendStatus(CRON_SECRET ? 401 : 503);
    return;
  }
  try {
    res.json(await cronTick());
  } catch (err) {
    fail(res, 'Tâche programmée', err, 500);
  }
});

export default router;
