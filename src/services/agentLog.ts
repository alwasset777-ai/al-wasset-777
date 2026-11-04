// Journal des réalisations de l'agent (monymounir) : chaque action réussie qui fait avancer le bureau.
// Gardé sur l'appareil ; sert au panneau « 🏆 إنجازاتي ».
import { createStore } from './createStore';

export interface AgentLogEntry {
  at: string; // ISO
  tool: string;
  label: string;
}

interface AgentLogState {
  since: string;
  counts: Record<string, number>;
  recent: AgentLogEntry[];
}

export const agentLogStore = createStore<AgentLogState>('alwassit777.agent.log.v1', { since: new Date().toISOString(), counts: {}, recent: [] });

// Actions qui comptent comme une réalisation (lectures et recherches exclues).
export const ACHIEVEMENT_LABELS: Record<string, string> = {
  add_client: 'زبون جديد تسجل',
  update_client: 'زبون تحدّث',
  add_appointment: 'موعد تحطّ',
  create_ads: 'إعلانات توجدات',
  prepare_whatsapp: 'رسالة واتساب توجدات',
  remember: 'حاجة جديدة تعلمتها',
  save_agency_prospect: 'وكالة تتبعات',
  add_revenue: 'مدخول تسجل',
  log_growth_signal: 'إشارة مشروع تسجلات',
  read_document: 'وثيقة تقرات وتسجلات',
};

export function logAchievement(tool: string, detail = '') {
  const base = ACHIEVEMENT_LABELS[tool];
  if (!base) return;
  agentLogStore.set((prev) => ({
    since: prev.since,
    counts: { ...prev.counts, [tool]: (prev.counts[tool] || 0) + 1 },
    recent: [{ at: new Date().toISOString(), tool, label: detail ? `${base} · ${detail}` : base }, ...prev.recent].slice(0, 30),
  }));
}
