// Le gérant parle à son agent depuis WhatsApp (texte, vocal, photo).
// Les actions simples sont faites tout de suite (si Firestore est relié) ; les actions sensibles
// deviennent des « tâches » qu'il valide dans l'application.
import type { ClientLead } from '../src/types.js';
import type { AgentAction, AgentSettings, AgentTask, Appointment, MemoryItem } from '../src/agent/types.js';
import { appointmentChanges, clientChanges, makeAppointment, makeClient } from '../src/agent/normalize.js';
import { buildDailyReport } from '../src/agent/report.js';
import { AGENCY_TZ, zoned } from '../src/agent/time.js';
import { draftDocument, runAgentChat, runSearch } from './agentBrain.js';
import { newServerId, store } from './store.js';
import { sendLongText, type IncomingMessage } from './whatsapp.js';

type OwnerMsg = { role: 'user' | 'assistant'; text: string; at: string };

export async function loadReportText(): Promise<string> {
  const [appointments, clients, registry, threads, tasks] = await Promise.all([
    store.list<Appointment>('appointments'),
    store.list<ClientLead>('clients'),
    store.list<{ createdAt?: string }>('registry'),
    store.listThreads(),
    store.listTasks(),
  ]);
  const r = buildDailyReport({ appointments, clients, registry, threads, tasks });
  return `${r.title}\n\n${r.text}`;
}

// Contexte pour l'agent, construit à partir des données du serveur.
async function serverContext(settings: Partial<AgentSettings>) {
  const [catalog, clients, appointments, registry, memory, threads] = await Promise.all([
    store.getState<unknown[]>('catalog', []),
    store.list<ClientLead>('clients'),
    store.list<Appointment>('appointments'),
    store.list<Record<string, unknown>>('registry'),
    store.getState<MemoryItem[]>('memory', []),
    store.listThreads(),
  ]);
  const soon = Date.now() - 24 * 3600 * 1000;
  return {
    today: zoned().iso,
    timezone: AGENCY_TZ,
    properties: catalog,
    registry: registry.slice(0, 60).map((r) => ({
      id: r.id, type: r.propertyType, owner: r.owner, ownerPhone: r.ownerPhone, location: r.location, surface: r.surface, price: r.price,
    })),
    clients: clients.slice(0, 80).map((c) => ({
      id: String(c.id), name: c.name, phone: c.phone, request: c.requestType, type: c.propType, budget: c.budget, area: c.area, status: c.status, score: c.score,
    })),
    appointments: appointments
      .filter((a) => Date.parse(a.at) >= soon)
      .sort((a, b) => (a.at < b.at ? -1 : 1))
      .slice(0, 40)
      .map((a) => ({ id: a.id, title: a.title, at: a.at, kind: a.kind, client: a.clientName, phone: a.clientPhone, place: a.place, status: a.status })),
    ads: {},
    whatsapp: {
      open: threads.filter((t) => t.status === 'open').slice(0, 15).map((t) => ({
        phone: t.phone, name: t.name, score: t.lead?.score, last: t.messages[t.messages.length - 1]?.text.slice(0, 200),
      })),
    },
    memory: memory.map((m) => ({ id: m.id, text: m.text })),
    outfits: (settings.photos || []).map((p) => p.label),
  };
}

async function addTask(action: AgentAction, note: string): Promise<void> {
  const task: AgentTask = { id: newServerId('task'), createdAt: new Date().toISOString(), source: 'whatsapp', note, action, status: 'pending' };
  await store.saveTask(task);
}

async function execute(actions: AgentAction[], settings: Partial<AgentSettings>, userText: string) {
  const notes: string[] = [];
  const longTexts: string[] = [];
  let tasks = 0;
  // Sans Firestore, l'application ne voit pas les données du serveur : tout passe par une tâche.
  const direct = store.kind === 'firestore';
  for (const a of actions) {
    try {
      switch (a.type) {
        case 'remember': {
          const memory = await store.getState<MemoryItem[]>('memory', []);
          await store.setState('memory', [...memory, { id: newServerId('mem'), text: String(a.text).slice(0, 500), at: new Date().toISOString() }].slice(-200));
          break;
        }
        case 'forget': {
          const memory = await store.getState<MemoryItem[]>('memory', []);
          await store.setState('memory', memory.filter((m) => m.id !== a.id));
          break;
        }
        case 'add_client': {
          const c = direct ? makeClient(a.client, { source: 'whatsapp' }) : null;
          if (c) {
            await store.put('clients', String(c.id), c);
            notes.push(`✅ تزاد الزبون: ${c.name}`);
          } else if (!direct) {
            await addTask(a, userText);
            tasks++;
          }
          break;
        }
        case 'update_client':
          if (direct) {
            await store.patch('clients', String(a.id), clientChanges(a.changes || {}));
          } else {
            await addTask(a, userText);
            tasks++;
          }
          break;
        case 'add_appointment': {
          const rdv = direct ? makeAppointment(a.appointment, { source: 'whatsapp', remindBeforeMin: settings.reminders?.beforeMin }) : null;
          if (rdv) {
            await store.put('appointments', rdv.id, rdv);
            notes.push(`📅 تزاد الموعد: ${rdv.title}`);
          } else if (!direct) {
            await addTask(a, userText);
            tasks++;
          }
          break;
        }
        case 'update_appointment':
          if (direct) {
            await store.patch('appointments', String(a.id), appointmentChanges(a.changes || {}));
          } else {
            await addTask(a, userText);
            tasks++;
          }
          break;
        case 'web_search': {
          const r = await runSearch(a.query, a.urls);
          longTexts.push(`🔎 ${r.text}${r.sources.length ? `\n\nالمصادر:\n${r.sources.map((s) => s.url).join('\n')}` : ''}`);
          break;
        }
        case 'draft_document': {
          const doc = await draftDocument(a.kind, a.details, a.language);
          longTexts.push(`📄 ${doc.title}\n\n${doc.text}`);
          break;
        }
        case 'daily_report':
          longTexts.push(await loadReportText());
          break;
        case 'open':
          break;
        default:
          // Message client, suppression, prix, annonces, registre, tenue : validation dans l'application.
          await addTask(a, userText);
          tasks++;
      }
    } catch (err) {
      console.error('Action WhatsApp :', a.type, err);
      notes.push('⚠️ وقع مشكل ف واحد العملية، عاود من التطبيق.');
    }
  }
  if (tasks) notes.push(`📝 ${tasks} ${tasks === 1 ? 'مهمة' : 'مهام'} بانتظار موافقتك ف التطبيق (الوكيل ← المهام).`);
  return { notes, longTexts };
}

export async function handleOwnerMessage(msg: IncomingMessage): Promise<void> {
  const history = await store.getState<OwnerMsg[]>('owner_chat', []);
  const audio = msg.kind === 'audio' ? msg.file : undefined;
  const files = msg.file && msg.kind !== 'audio' ? [msg.file] : [];
  history.push({ role: 'user', text: msg.text || (audio ? '(رسالة صوتية)' : '…'), at: msg.at });

  const settings = await store.getState<Partial<AgentSettings>>('settings', {});
  const res = await runAgentChat({
    messages: history,
    context: await serverContext(settings),
    persona: { name: settings.name, gender: settings.gender, personality: settings.personality, extraInstructions: settings.extraInstructions },
    files,
    audio,
    channel: 'whatsapp',
  });
  if (res.transcript) history[history.length - 1].text = `🎤 ${res.transcript}`;
  const { notes, longTexts } = await execute(res.actions, settings, history[history.length - 1].text);
  const reply = [res.reply, ...notes].filter(Boolean).join('\n\n') || '👍';
  await sendLongText(msg.from, reply);
  for (const t of longTexts) await sendLongText(msg.from, t);
  history.push({ role: 'assistant', text: reply, at: new Date().toISOString() });
  await store.setState('owner_chat', history.slice(-30));
}
