// Création de fiches propres (client, rendez-vous) à partir de ce que l'agent propose.
// Utilisé par l'application et par le serveur (WhatsApp) : aucun import autre que des types.
import type { ClientLead } from '../types';
import type { Appointment, AppointmentFields, AppointmentKind, AppointmentStatus, ClientFields, LeadScore } from './types';

const str = (v: unknown, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : typeof v === 'number' ? String(v) : '');
const num = (v: unknown) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T): T => (list.includes(v as T) ? (v as T) : fallback);

export const APPOINTMENT_KINDS: readonly AppointmentKind[] = ['زيارة', 'اجتماع', 'توقيع', 'مكالمة', 'أخرى'];
export const APPOINTMENT_STATUSES: readonly AppointmentStatus[] = ['مبرمج', 'تم', 'ملغى'];
export const LEAD_SCORES: readonly LeadScore[] = ['جاد', 'متوسط', 'ضعيف'];
const CLIENT_STATUSES = ['نشط', 'في المتابعة', 'منجز', 'ملغى'] as const;

export const isValidDate = (iso: unknown) => typeof iso === 'string' && !Number.isNaN(Date.parse(iso));

export function makeAppointment(
  f: AppointmentFields,
  opts: { id?: string; source?: Appointment['source']; remindBeforeMin?: number } = {}
): Appointment | null {
  if (!isValidDate(f.at)) return null;
  return {
    id: opts.id || `rdv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: str(f.title, 160) || 'موعد',
    at: new Date(f.at).toISOString(),
    kind: oneOf(f.kind, APPOINTMENT_KINDS, 'زيارة'),
    durationMin: Math.min(Math.max(Math.round(num(f.durationMin)) || 30, 5), 600),
    clientName: str(f.clientName, 120),
    clientPhone: str(f.clientPhone, 40),
    place: str(f.place, 200),
    notes: str(f.notes, 1000),
    status: oneOf(f.status, APPOINTMENT_STATUSES, 'مبرمج'),
    remindBeforeMin: opts.remindBeforeMin ?? 60,
    source: opts.source || 'agent',
    createdAt: new Date().toISOString(),
  };
}

export function appointmentChanges(changes: Partial<AppointmentFields>): Partial<Appointment> {
  const out: Partial<Appointment> = {};
  if (changes.title !== undefined) out.title = str(changes.title, 160);
  if (changes.at !== undefined && isValidDate(changes.at)) {
    out.at = new Date(changes.at).toISOString();
    out.reminded = {};
  }
  if (changes.kind !== undefined) out.kind = oneOf(changes.kind, APPOINTMENT_KINDS, 'زيارة');
  if (changes.status !== undefined) out.status = oneOf(changes.status, APPOINTMENT_STATUSES, 'مبرمج');
  if (changes.durationMin !== undefined) out.durationMin = Math.round(num(changes.durationMin)) || 30;
  for (const k of ['clientName', 'clientPhone', 'place', 'notes'] as const) if (changes[k] !== undefined) out[k] = str(changes[k], 1000);
  return out;
}

export type StoredClient = ClientLead;

export function makeClient(f: ClientFields, opts: { id?: number; source?: ClientLead['source'] } = {}): StoredClient | null {
  const name = str(f.name, 120);
  const phone = str(f.phone, 40);
  if (!name && !phone) return null;
  return {
    id: opts.id ?? Date.now(),
    name: name || phone,
    phone,
    category: f.category === 'شركة' ? 'شركة' : 'فرد',
    requestType: str(f.requestType, 40) || 'شراء',
    propType: str(f.propType, 40) || 'شقة',
    budget: num(f.budget),
    area: str(f.area, 120),
    status: oneOf(f.status, CLIENT_STATUSES, 'نشط'),
    score: f.score ? oneOf(f.score, LEAD_SCORES, 'متوسط') : undefined,
    notes: str(f.notes, 2000),
    linkedPropIds: [],
    dateAdded: new Date().toISOString().split('T')[0],
    source: opts.source || 'agent',
    createdAt: new Date().toISOString(),
  };
}

export function clientChanges(changes: Partial<ClientFields>): Partial<StoredClient> {
  const out: Partial<StoredClient> = {};
  for (const k of ['name', 'phone', 'requestType', 'propType', 'area', 'notes'] as const) if (changes[k] !== undefined) out[k] = str(changes[k], 2000);
  if (changes.category !== undefined) out.category = changes.category === 'شركة' ? 'شركة' : 'فرد';
  if (changes.budget !== undefined) out.budget = num(changes.budget);
  if (changes.status !== undefined) out.status = oneOf(changes.status, CLIENT_STATUSES, 'نشط');
  if (changes.score !== undefined) out.score = oneOf(changes.score, LEAD_SCORES, 'متوسط');
  out.updatedAt = new Date().toISOString();
  return out;
}

// Numéro marocain → format international WhatsApp (212...).
export function toWaNumber(phone: string): string {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0') && d.length === 10) d = `212${d.slice(1)}`;
  return d;
}
