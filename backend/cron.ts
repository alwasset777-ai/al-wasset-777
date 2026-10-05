// Tâches programmées : rappels de rendez-vous et rapport du matin envoyés au gérant sur WhatsApp.
// Appelé toutes les 5 à 10 minutes par un service gratuit (cron-job.org, Cloud Scheduler) : /api/cron/tick?key=CRON_SECRET
import type { Appointment } from '../src/types.js';
import type { AgentSettings } from '../src/agent/types.js';
import { fmtDayTime, zoned } from '../src/agent/time.js';
import { loadReportText } from './ownerChannel.js';
import { store } from './store.js';
import { OWNER_NUMBERS, notifyOwners, waStatus } from './whatsapp.js';

interface CronState {
  sent: Record<string, number>; // clé → date d'envoi (ms)
  reportDay?: string;
}

export async function cronTick(now = new Date()) {
  if (!waStatus.configured || OWNER_NUMBERS.length === 0) return { skipped: 'WhatsApp non configuré (WHATSAPP_* / WHATSAPP_OWNER_NUMBERS)' };
  const settings = await store.getState<Partial<AgentSettings>>('settings', {});
  const state = await store.getState<CronState>('cron', { sent: {} });
  const t = now.getTime();
  let reminders = 0;
  let changed = false;

  if (settings.reminders?.enabled !== false) {
    // Rappels possibles jusqu'à 24 h avant : on ne lit que les rendez-vous des prochaines 25 heures.
    const appointments = await store.appointmentsBetween<Appointment>(
      new Date(t - 10 * 60 * 1000).toISOString(),
      new Date(t + 25 * 3600 * 1000).toISOString()
    );
    for (const a of appointments) {
      const at = Date.parse(a.at);
      if (a.status !== 'confirmé' || !Number.isFinite(at) || at < t - 10 * 60 * 1000) continue;
      const before = (a.remindBeforeMin || settings.reminders?.beforeMin || 60) * 60 * 1000;
      const key = `${a.id}@${a.at}`;
      if (t >= at - before && !state.sent[key]) {
        await notifyOwners(
          `⏰ تذكير: ${a.kind || 'موعد'} — ${a.title}\n🕒 ${fmtDayTime(a.at)}${a.clientName ? `\n👤 ${a.clientName}${a.clientPhone ? ` (${a.clientPhone})` : ''}` : ''}${a.place ? `\n📍 ${a.place}` : ''}${a.notes ? `\n📝 ${a.notes}` : ''}`
        );
        state.sent[key] = t;
        reminders++;
        changed = true;
      }
    }
  }

  let report = false;
  const z = zoned(now);
  if (settings.dailyReport?.enabled !== false && z.hour >= (settings.dailyReport?.hour ?? 8) && state.reportDay !== z.date) {
    await notifyOwners(`صباح الخير ☀️\n\n${await loadReportText()}`);
    state.reportDay = z.date;
    report = true;
    changed = true;
  }

  // On oublie les rappels de plus de 3 jours.
  for (const [k, v] of Object.entries(state.sent)) {
    if (t - v > 3 * 24 * 3600 * 1000) {
      delete state.sent[k];
      changed = true;
    }
  }
  if (changed) await store.setState('cron', state);
  return { reminders, report };
}
