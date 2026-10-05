// Ce que l'agent fait en arrière-plan quand l'application est ouverte :
// rappels de rendez-vous, alertes WhatsApp, rapport du matin, envoi des données utiles au serveur.
import { useEffect } from 'react';
import type { Property } from '../types';
import { appointmentsStore, clientsStore, memoryStore, settingsStore } from './stores';
import { healthLive, pushToast, refreshHealth, refreshTasks, refreshWhatsApp, registryLive, tasksLive, waLive } from './live';
import { syncToServer } from './api';
import { buildCatalog } from './engine';
import { fmtTime, zoned } from './time';
import { loadJSON, saveJSON } from '../services/storage';

const NOTIFIED_KEY = 'alwassit777.agent.notified.v1';
const REPORT_KEY = 'alwassit777.agent.reportShown.v1';

export const notificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window;

export async function enableNotifications(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  return (await Notification.requestPermission()) === 'granted';
}

// Notification du téléphone (si autorisée) + alerte dans l'application.
async function notify(title: string, body: string, section?: string) {
  pushToast({ title, body, section });
  if (!notificationsSupported() || Notification.permission !== 'granted' || document.visibilityState === 'visible') return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, { body, icon: '/icons/icon-192.png', tag: `${title}-${body}`.slice(0, 60) });
    else new Notification(title, { body, icon: '/icons/icon-192.png' });
  } catch {
    // certains navigateurs refusent les notifications hors service worker
  }
}

function checkReminders() {
  const s = settingsStore.get();
  if (!s.reminders.enabled) return;
  const notified = loadJSON<Record<string, number>>(NOTIFIED_KEY, {});
  const now = Date.now();
  for (const a of appointmentsStore.get()) {
    const at = Date.parse(a.at);
    if (a.status !== 'مبرمج' || !Number.isFinite(at)) continue;
    const before = (a.remindBeforeMin || s.reminders.beforeMin) * 60000;
    const kBefore = `${a.id}@${a.at}:before`;
    const kAt = `${a.id}@${a.at}:at`;
    if (now >= at - before && now < at && !notified[kBefore]) {
      notify(`⏰ ${a.kind} مع ${fmtTime(a.at)}`, `${a.title}${a.clientName ? ` — ${a.clientName}` : ''}${a.place ? ` — ${a.place}` : ''}`, 'appointments');
      notified[kBefore] = now;
    }
    if (now >= at && now < at + 10 * 60000 && !notified[kAt]) {
      notify(`📅 دابا: ${a.title}`, `${a.clientName || ''} ${a.clientPhone || ''}`.trim(), 'appointments');
      notified[kAt] = now;
    }
  }
  for (const [k, v] of Object.entries(notified)) if (now - v > 3 * 24 * 3600 * 1000) delete notified[k];
  saveJSON(NOTIFIED_KEY, notified);
}

function checkDailyReport() {
  const s = settingsStore.get();
  const z = zoned();
  if (!s.dailyReport.enabled || z.hour < s.dailyReport.hour || loadJSON<string>(REPORT_KEY, '') === z.date) return;
  saveJSON(REPORT_KEY, z.date);
  notify('📊 تقرير اليوم واجد', 'ضغط باش تشوفو', 'report');
}

let lastUnread = -1;
let lastTasks = -1;
function watchCounters() {
  const unread = waLive.get().threads.filter((t) => t.unread);
  if (lastUnread >= 0 && unread.length > lastUnread) {
    const t = unread[0];
    notify(`💬 ${t.name}${t.lead ? ` (${t.lead.score})` : ''}`, t.messages[t.messages.length - 1]?.text.slice(0, 120) || '', 'whatsapp');
  }
  lastUnread = unread.length;
  const pending = tasksLive.get().filter((t) => t.status === 'pending').length;
  if (lastTasks >= 0 && pending > lastTasks) notify('📝 مهمة جديدة بانتظار موافقتك', 'من واتساب', 'tasks');
  lastTasks = pending;
}

async function syncNow(properties: Property[]) {
  const payload: Record<string, unknown> = { catalog: buildCatalog(properties) };
  // Serveur sans Firestore : on lui envoie aussi une copie pour les rappels WhatsApp et le contexte.
  if (healthLive.get()?.store === 'memory') {
    const s = settingsStore.get();
    payload.settings = { ...s, photos: s.photos.map((p) => ({ id: p.id, label: p.label })) };
    payload.memory = memoryStore.get();
    payload.clients = clientsStore.get();
    payload.appointments = appointmentsStore.get();
    payload.registry = registryLive.get().map(({ photos, videos, documents, ...r }) => r);
  }
  await syncToServer(payload).catch(() => undefined);
}

export function useAgentRuntime(enabled: boolean, properties: Property[]) {
  useEffect(() => {
    if (!enabled) return;
    refreshHealth();
    const poll = () => {
      if (document.visibilityState !== 'visible') return;
      Promise.all([refreshWhatsApp(), refreshTasks()]).then(watchCounters);
    };
    const tick = () => {
      checkReminders();
      checkDailyReport();
    };
    poll();
    tick();
    const p = setInterval(poll, 45000);
    const t = setInterval(tick, 30000);
    document.addEventListener('visibilitychange', poll);
    return () => {
      clearInterval(p);
      clearInterval(t);
      document.removeEventListener('visibilitychange', poll);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => syncNow(properties), 4000);
    };
    const stops = [settingsStore, memoryStore, clientsStore, appointmentsStore, registryLive, healthLive].map((s) => s.subscribe(schedule));
    schedule();
    return () => {
      clearTimeout(timer);
      stops.forEach((stop) => stop());
    };
  }, [enabled, properties]);
}
