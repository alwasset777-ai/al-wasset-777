// Ce que l'agent sait (contexte) et ce qu'il fait (actions), avec la règle d'accord du gérant :
// publication, message à un client, suppression et prix demandent toujours une validation.
import type { Property } from '../types';
import type { AgentAction, AgentContext, AgentMessage, AgentSettings, MemoryItem } from './types';
import { appointmentChanges, clientChanges, isValidDate, makeAppointment, makeClient, toWaNumber } from './normalize';
import { buildDailyReport } from './report';
import { AGENCY_TZ, fmtDayTime, zoned } from './time';
import { appointmentsStore, clientsStore, memoryStore, settingsStore } from './stores';
import { inboxLive, registryLive, tasksLive, waLive, upsertThread } from './live';
import { clientMatchesProperty } from './executor';
import { draftDocument, searchWeb, sendWhatsApp } from './api';
import { registryStore } from '../services/registryStore';
import { generateDrafts, getDrafts } from '../services/adsStore';
import { PLATFORMS } from '../services/adGenerator';

const TABS = ['ads', 'crm', 'home', 'agent', 'legal'];
const ALL_PLATFORMS = PLATFORMS.map((p) => p.id);
const LANGS = ['ar', 'darija', 'fr'];
const newId = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// ---------- Contexte envoyé avec chaque message ----------

export function buildContext(properties: Property[]): AgentContext {
  const drafts = getDrafts();
  const z = zoned();
  const count = (s: string) => drafts.filter((d) => d.status === s).length;
  const soon = Date.now() - 24 * 3600 * 1000;
  const settings = settingsStore.get();
  return {
    today: `${z.iso} (${z.weekday})`,
    timezone: AGENCY_TZ,
    properties: properties.slice(0, 80).map((p) => ({
      id: p.id, title: p.titleAr || p.titleFr, type: p.type, deal: p.listingType, city: p.city, district: p.district,
      surface: p.surface, rooms: p.rooms, price: p.priceFormattedFr, status: p.status,
    })),
    registry: registryLive.get().slice(0, 60).map((r) => ({
      id: r.id, type: r.propertyType, owner: r.owner, ownerPhone: r.ownerPhone, location: r.location, surface: r.surface,
      price: r.price, notes: r.notes.slice(0, 200), files: r.photos.length + r.videos.length + r.documents.length, createdAt: r.createdAt,
    })),
    clients: clientsStore.get().slice(0, 80).map((c) => ({
      id: String(c.id), name: c.name, phone: c.phone, request: c.requestType, type: c.propType, budget: c.budget, area: c.area,
      status: c.status, score: c.score, notes: c.notes.slice(0, 200), added: c.createdAt || c.dateAdded,
    })),
    appointments: appointmentsStore
      .get()
      .filter((a) => Date.parse(a.at) >= soon)
      .slice(0, 40)
      .map((a) => ({ id: a.id, title: a.title, at: a.at, kind: a.kind, client: a.clientName, phone: a.clientPhone, place: a.place, status: a.status })),
    ads: {
      toReview: count('brouillon'), approved: count('approuvé'), scheduled: count('programmé'), published: count('publié'),
      leads: drafts.reduce((a, d) => a + (d.stats?.leads || 0), 0), messages: drafts.reduce((a, d) => a + (d.stats?.messages || 0), 0),
    },
    whatsapp: {
      connected: Boolean(waLive.get().status?.configured),
      open: waLive.get().threads.filter((t) => t.status === 'open').slice(0, 15).map((t) => ({
        phone: t.phone, name: t.name, score: t.lead?.score, last: t.messages[t.messages.length - 1]?.text.slice(0, 200), suggestion: t.suggestion?.slice(0, 300),
      })),
    },
    // Demandes envoyées par les clients du site (bulle « مساعد الزبائن », formulaire de visite).
    siteRequests: inboxLive.get().slice(0, 15).map((r) => ({
      kind: r.kind, name: r.name, phone: r.phone, message: r.message.slice(0, 200), property: r.propertyTitle, preferredAt: r.preferredAt, at: r.createdAt,
    })),
    // Correspondances clients ↔ biens (type, budget, quartier) : les « opportunités » du bureau.
    opportunities: clientsStore
      .get()
      .filter((c) => c.status === 'نشط' || c.status === 'في المتابعة')
      .flatMap((c) => properties.map((p) => ({ c, p, score: clientMatchesProperty(c, p) })))
      .filter((m) => m.score >= 50)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((m) => ({ clientId: String(m.c.id), client: m.c.name, propertyId: m.p.id, property: m.p.titleAr || m.p.titleFr, price: m.p.priceFormattedFr, score: m.score })),
    memory: memoryStore.get().map((m) => ({ id: m.id, text: m.text })),
    outfits: settings.photos.map((p) => p.label),
  };
}

// Liste des biens envoyée au serveur pour répondre aux clients WhatsApp (sans les propriétaires).
export function buildCatalog(properties: Property[]) {
  return [
    ...properties.slice(0, 80).map((p) => ({
      ref: `#${p.id}`, title: p.titleAr || p.titleFr, type: p.type, deal: p.listingType, city: p.city, district: p.district,
      surface: p.surface, rooms: p.rooms, price: p.priceFormattedFr, features: p.features?.slice(0, 8),
    })),
    ...registryLive.get().slice(0, 60).map((r) => ({ ref: r.id, type: r.propertyType, location: r.location, surface: r.surface, price: r.price })),
  ];
}

// ---------- Vérification des actions proposées ----------

export function validateAction(a: AgentAction, properties: Property[]): AgentAction | null {
  const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  switch (a.type) {
    case 'open':
      return TABS.includes(a.tab) ? a : null;
    case 'generate_ads': {
      const id = Number(a.propertyId);
      if (!properties.some((p) => p.id === id)) return null;
      const platforms = (a.platforms || []).filter((x) => ALL_PLATFORMS.includes(x));
      const languages = (a.languages || []).filter((x) => LANGS.includes(x));
      return { ...a, propertyId: id, platforms: platforms.length ? platforms : ALL_PLATFORMS, languages: languages.length ? languages : ['ar', 'darija', 'fr'] };
    }
    case 'remember':
      return s(a.text) ? { ...a, text: s(a.text).slice(0, 500) } : null;
    case 'forget':
      return memoryStore.get().some((m) => m.id === a.id) ? a : null;
    case 'add_client':
      return a.client && (s(a.client.name) || s(a.client.phone)) ? a : null;
    case 'update_client':
    case 'delete_client':
      return clientsStore.get().some((c) => String(c.id) === String(a.id)) ? a : null;
    case 'add_registry':
      return a.entry && typeof a.entry === 'object' ? a : null;
    case 'update_registry':
      return registryLive.get().some((r) => r.id === a.id) && a.changes ? a : null;
    case 'add_appointment':
      return a.appointment && isValidDate(a.appointment.at) ? a : null;
    case 'update_appointment':
    case 'delete_appointment':
      return appointmentsStore.get().some((x) => x.id === a.id) ? a : null;
    case 'whatsapp_reply':
      return toWaNumber(a.to).length >= 9 && s(a.text) ? { ...a, to: toWaNumber(a.to) } : null;
    case 'web_search':
      return s(a.query) ? a : null;
    case 'draft_document':
      return a ? { ...a, details: s(a.details) } : null;
    case 'daily_report':
      return a;
    case 'set_outfit':
      return settingsStore.get().photos.length ? a : null;
    default:
      return null;
  }
}

export type ActionMode = 'auto' | 'confirm' | 'review';

// review = carte modifiable avant validation ; confirm = simple accord.
export function actionMode(a: AgentAction, settings: AgentSettings): ActionMode {
  if (a.type === 'add_registry' || a.type === 'whatsapp_reply') return 'review';
  if (a.type === 'delete_client' || a.type === 'delete_appointment' || a.type === 'update_registry') return 'confirm';
  if (a.type === 'update_client' && a.changes?.budget !== undefined) return 'confirm';
  const readOnly = ['open', 'web_search', 'draft_document', 'daily_report', 'set_outfit', 'remember'];
  if (settings.confirmAll && !readOnly.includes(a.type)) return 'confirm';
  return 'auto';
}

// Description courte (affichée sur les cartes d'accord).
export function describeAction(a: AgentAction): string {
  switch (a.type) {
    case 'open': return `فتح قسم «${a.tab}»`;
    case 'generate_ads': return `تحضير إعلانات للعقار #${a.propertyId}`;
    case 'remember': return `حفظ فالذاكرة: ${a.text}`;
    case 'forget': return 'حذف معلومة من الذاكرة';
    case 'add_client': return `زبون جديد: ${a.client.name || a.client.phone}`;
    case 'update_client': return `تعديل الزبون: ${clientsStore.get().find((c) => String(c.id) === String(a.id))?.name || a.id}`;
    case 'delete_client': return `حذف الزبون: ${clientsStore.get().find((c) => String(c.id) === String(a.id))?.name || a.id}`;
    case 'add_registry': return 'بطاقة جديدة فسجل العقارات';
    case 'update_registry': {
      const r = registryLive.get().find((x) => x.id === a.id);
      const changes = Object.entries(a.changes || {}).map(([k, v]) => `${k}: ${v}`).join('، ');
      return `تعديل بطاقة ${r ? `${r.propertyType} – ${r.owner}` : a.id} (${changes})`;
    }
    case 'add_appointment': return `موعد: ${a.appointment.title} — ${isValidDate(a.appointment.at) ? fmtDayTime(a.appointment.at) : ''}`;
    case 'update_appointment': return `تعديل الموعد: ${appointmentsStore.get().find((x) => x.id === a.id)?.title || a.id}`;
    case 'delete_appointment': return `حذف الموعد: ${appointmentsStore.get().find((x) => x.id === a.id)?.title || a.id}`;
    case 'whatsapp_reply': return `رسالة واتساب إلى ${a.name || a.to}`;
    case 'web_search': return `بحث: ${a.query}`;
    case 'draft_document': return `تحرير وثيقة: ${a.kind.replace(/_/g, ' ')}`;
    case 'daily_report': return 'تقرير اليوم';
    case 'set_outfit': return `تبديل اللبسة: ${a.label}`;
  }
}

// ---------- Exécution ----------

export interface ExecDeps {
  properties: Property[];
  onNavigate: (tab: string) => void;
  files?: Blob[]; // pièces jointes du message (rangées dans le registre si demandé)
  fileNames?: string[];
}

export interface ExecResult {
  text: string;
  extra?: Partial<AgentMessage>; // message supplémentaire (recherche, document, rapport)
}

export function reportNow(): { title: string; text: string } {
  const drafts = getDrafts();
  const today = zoned().date;
  const r = buildDailyReport({
    appointments: appointmentsStore.get(),
    clients: clientsStore.get(),
    registry: registryLive.get(),
    threads: waLive.get().loaded && !waLive.get().error ? waLive.get().threads : undefined,
    tasks: tasksLive.get(),
    siteRequests: inboxLive.get(),
    ads: {
      toReview: drafts.filter((d) => d.status === 'brouillon').length,
      scheduledToday: drafts.filter((d) => d.status === 'programmé' && d.scheduledAt && zoned(new Date(d.scheduledAt)).date === today).length,
      published: drafts.filter((d) => d.status === 'publié').length,
    },
  });
  return { title: r.title, text: r.text };
}

export async function executeAction(a: AgentAction, deps: ExecDeps): Promise<ExecResult> {
  const settings = settingsStore.get();
  switch (a.type) {
    case 'open':
      deps.onNavigate(a.tab);
      return { text: '' };
    case 'generate_ads': {
      const p = deps.properties.find((x) => x.id === a.propertyId)!;
      const created = await generateDrafts(p, a.platforms || ALL_PLATFORMS, a.languages || ['ar', 'darija', 'fr']);
      return { text: `✅ ${created.length} إعلان جاهز للمراجعة ف«الإعلانات».` };
    }
    case 'remember': {
      const item: MemoryItem = { id: newId('mem'), text: a.text, at: new Date().toISOString() };
      await memoryStore.set((prev) => [...prev, item].slice(-200));
      return { text: `🧠 حفظت: ${a.text}` };
    }
    case 'forget':
      await memoryStore.set((prev) => prev.filter((m) => m.id !== a.id));
      return { text: '🧠 تمسحات من الذاكرة.' };
    case 'add_client': {
      const c = makeClient(a.client, { source: 'agent' });
      if (!c) throw new Error('بيانات ناقصة');
      // Même numéro déjà enregistré : on complète la fiche au lieu d'en créer une deuxième.
      const last9 = (p: string) => p.replace(/\D/g, '').slice(-9);
      const existing = c.phone ? clientsStore.get().find((x) => last9(x.phone) === last9(c.phone)) : undefined;
      if (existing) {
        await clientsStore.patch(existing.id, clientChanges(a.client));
        return { text: `👤 تحدّثات معلومات ${existing.name}` };
      }
      await clientsStore.put(c);
      return { text: `👤 تزاد الزبون: ${c.name}` };
    }
    case 'update_client': {
      const c = clientsStore.get().find((x) => String(x.id) === String(a.id))!;
      await clientsStore.patch(c.id, clientChanges(a.changes || {}));
      return { text: `👤 تبدّلات معلومات ${c.name}` };
    }
    case 'delete_client': {
      const c = clientsStore.get().find((x) => String(x.id) === String(a.id))!;
      await clientsStore.remove(c.id);
      return { text: `🗑️ تحذف الزبون: ${c.name}` };
    }
    case 'add_registry': {
      const e = a.entry;
      const files = a.attachDocuments ? deps.files || [] : [];
      const asFile = (b: Blob, i: number) => (b instanceof File ? b : new File([b], deps.fileNames?.[i] || `document-${i + 1}`, { type: b.type }));
      const all = files.map(asFile);
      await registryStore.add(
        {
          propertyType: e.propertyType || 'شقة', owner: e.owner || '', ownerPhone: e.ownerPhone || '', surface: e.surface || '',
          location: e.location || '', price: e.price || '', notes: e.notes || '',
        },
        { photos: all.filter((f) => f.type.startsWith('image/')), videos: [], documents: all.filter((f) => !f.type.startsWith('image/')) }
      );
      return { text: `🗂️ تزادت البطاقة فسجل العقارات${all.length ? ` (مع ${all.length} ملف)` : ''}.` };
    }
    case 'update_registry': {
      const r = registryLive.get().find((x) => x.id === a.id)!;
      const allowed = ['propertyType', 'owner', 'ownerPhone', 'surface', 'location', 'price', 'notes'] as const;
      const changes = Object.fromEntries(Object.entries(a.changes).filter(([k, v]) => (allowed as readonly string[]).includes(k) && typeof v === 'string'));
      await registryStore.update(r, changes);
      return { text: '🗂️ تبدّلات البطاقة فالسجل.' };
    }
    case 'add_appointment': {
      const rdv = makeAppointment(a.appointment, { source: 'agent', remindBeforeMin: settings.reminders.beforeMin });
      if (!rdv) throw new Error('تاريخ غير صحيح');
      await appointmentsStore.put(rdv);
      return { text: `📅 تزاد الموعد: ${rdv.title} — ${fmtDayTime(rdv.at)}` };
    }
    case 'update_appointment': {
      const x = appointmentsStore.get().find((v) => v.id === a.id)!;
      await appointmentsStore.patch(x.id, appointmentChanges(a.changes || {}));
      return { text: `📅 تبدّل الموعد: ${x.title}` };
    }
    case 'delete_appointment': {
      const x = appointmentsStore.get().find((v) => v.id === a.id)!;
      await appointmentsStore.remove(x.id);
      return { text: `🗑️ تحذف الموعد: ${x.title}` };
    }
    case 'whatsapp_reply': {
      if (waLive.get().status?.configured) {
        const r = await sendWhatsApp(a.to, a.text);
        upsertThread(r.thread);
        return { text: `✅ تصيفطات الرسالة لـ ${a.name || a.to} على واتساب.` };
      }
      // WhatsApp pas encore relié : on ouvre WhatsApp avec le message prêt, le gérant appuie sur « envoyer ».
      window.open(`https://wa.me/${a.to}?text=${encodeURIComponent(a.text)}`, '_blank', 'noopener');
      return { text: '📲 فتحت ليك واتساب بالرسالة واجدة، غير ضغط «إرسال».' };
    }
    case 'web_search': {
      const r = await searchWeb(a.query, a.urls || []);
      return { text: '', extra: { text: `🔎 ${r.text || 'ما لقيت حتى نتيجة موثوقة.'}`, sources: r.sources } };
    }
    case 'draft_document': {
      const doc = await draftDocument(a.kind, a.details, a.language || 'ar');
      return { text: '', extra: { text: `📄 ${doc.title} — المسودة واجدة، ضغط باش تشوفها وتطبعها.`, document: doc } };
    }
    case 'daily_report': {
      const r = reportNow();
      return { text: '', extra: { text: `${r.title}\n\n${r.text}` } };
    }
    case 'set_outfit': {
      const label = a.label.trim();
      const photo = settings.photos.find((p) => p.label === label) || settings.photos.find((p) => p.label.includes(label) || label.includes(p.label));
      if (!photo) throw new Error('ما لقيتش هاد اللبسة');
      await settingsStore.set((s) => ({ ...s, activePhotoId: photo.id, avatarMode: 'photo' }));
      return { text: `👔 لبست «${photo.label}».` };
    }
  }
}
