// Rapport quotidien (même texte dans l'application, à voix haute et sur WhatsApp).
import type { ClientLead } from '../types';
import type { AgentTask, Appointment, WaThread } from './types';
import { fmtTime, localDay, zoned } from './time.js';

export interface ReportData {
  appointments: Appointment[];
  clients: ClientLead[];
  registry?: Array<{ createdAt?: string; propertyType?: string; location?: string }>;
  threads?: WaThread[];
  tasks?: AgentTask[];
  ads?: { toReview: number; scheduledToday: number; published: number };
  now?: Date;
}

export interface DailyReport {
  title: string;
  text: string;
  counts: { today: number; tomorrow: number; newClients: number; hotLeads: number; waOpen: number; waNew: number; registryNew: number; tasks: number };
}

const DAY = 24 * 3600 * 1000;

export function buildDailyReport(d: ReportData): DailyReport {
  const now = d.now || new Date();
  const z = zoned(now);
  const tomorrow = zoned(new Date(now.getTime() + DAY)).date;
  const since = now.getTime() - DAY;
  const created = (x: { createdAt?: string; dateAdded?: string }) => Date.parse(x.createdAt || x.dateAdded || '') || 0;

  const active = d.appointments.filter((a) => a.status === 'مبرمج').sort((a, b) => (a.at < b.at ? -1 : 1));
  const today = active.filter((a) => localDay(a.at) === z.date);
  const tmrw = active.filter((a) => localDay(a.at) === tomorrow);
  const newClients = d.clients.filter((c) => created(c) >= since);
  const threads = d.threads || [];
  const waOpen = threads.filter((t) => t.status === 'open' && t.messages[t.messages.length - 1]?.from === 'client');
  const waNew = threads.filter((t) => Date.parse(t.messages[0]?.at || t.lastAt) >= since);
  // Clients sérieux : WhatsApp + fiches récentes, sans compter deux fois le même numéro.
  const key = (phone: string) => phone.replace(/\D/g, '').slice(-9);
  const hotPhones = new Set([
    ...threads.filter((t) => t.status === 'open' && t.lead?.score === 'جاد').map((t) => key(t.phone)),
    ...newClients.filter((c) => c.score === 'جاد').map((c) => key(c.phone) || c.name),
  ]);
  const hot = [...hotPhones];
  const registryNew = (d.registry || []).filter((r) => (Date.parse(r.createdAt || '') || 0) >= since);
  const tasks = (d.tasks || []).filter((t) => t.status === 'pending');

  const line = (a: Appointment) => ` • ${fmtTime(a.at)} — ${a.kind} — ${a.title}${a.clientName ? ` (${a.clientName})` : ''}${a.place ? ` – ${a.place}` : ''}`;
  const out: string[] = [];
  out.push(`📅 مواعيد اليوم: ${today.length}`);
  today.slice(0, 8).forEach((a) => out.push(line(a)));
  out.push(`📅 مواعيد غدا: ${tmrw.length}`);
  tmrw.slice(0, 5).forEach((a) => out.push(line(a)));
  out.push(`👥 زبناء جدد (24 ساعة): ${newClients.length}`);
  newClients.slice(0, 5).forEach((c) => out.push(` • ${c.name} — ${c.requestType} ${c.propType}${c.budget ? ` — ${c.budget.toLocaleString('fr-MA')} DH` : ''}${c.score ? ` (${c.score})` : ''}`));
  if (d.threads) {
    out.push(`💬 واتساب: ${waNew.length} محادثات جديدة، ${waOpen.length} بلا جواب`);
    waOpen.slice(0, 5).forEach((t) => out.push(` • ${t.name}${t.lead ? ` (${t.lead.score})` : ''}: ${t.messages[t.messages.length - 1]?.text.slice(0, 80)}`));
  }
  out.push(`⭐ زبناء جادين خاصهم المتابعة: ${hot.length}`);
  if (d.registry) out.push(`🗂️ عقارات جديدة فالسجل (24 ساعة): ${registryNew.length}`);
  if (d.ads) out.push(`📢 الإعلانات: ${d.ads.toReview} للمراجعة، ${d.ads.scheduledToday} مبرمجة اليوم، ${d.ads.published} منشورة`);
  if (d.tasks) out.push(`✅ مهام بانتظار موافقتك: ${tasks.length}`);

  return {
    title: `📊 تقرير ${z.weekday} ${z.date}`,
    text: out.join('\n'),
    counts: {
      today: today.length,
      tomorrow: tmrw.length,
      newClients: newClients.length,
      hotLeads: hot.length,
      waOpen: waOpen.length,
      waNew: waNew.length,
      registryNew: registryNew.length,
      tasks: tasks.length,
    },
  };
}
