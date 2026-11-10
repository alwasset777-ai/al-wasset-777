// « 🏆 إنجازاتي » : ce que monymounir a réellement fait pour le bureau (chiffres enregistrés, rien d'inventé).
import React, { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import { agentLogStore } from '../services/agentLog';
import { appointmentsStore, clientsStore } from '../services/officeStores';
import { registryStore } from '../services/registryStore';
import { getMemory } from '../services/muneerMemory';
import { growthSummary } from '../agent/executor';
import { MILESTONES_MAD } from '../services/growthStore';
import { agencyProfile } from '../data/agencyProfile';

const fmt = (n: number) => n.toLocaleString('fr-FR').replace(/ /g, ' ');
const ago = (iso: string) => {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 1) return 'دابا';
  if (m < 60) return `قبل ${m} دقيقة`;
  const h = Math.round(m / 60);
  if (h < 24) return `قبل ${h} ساعة`;
  return `قبل ${Math.round(h / 24)} يوم`;
};

export const AchievementsPanel: React.FC<{ onAsk: (q: string) => void }> = ({ onAsk }) => {
  const [log] = agentLogStore.use();
  const [clients] = clientsStore.use();
  const [appointments] = appointmentsStore.use();
  const [registryCount, setRegistryCount] = useState<number | null>(null);
  useEffect(() => {
    registryStore.getAll().then((x) => setRegistryCount(x.length)).catch(() => setRegistryCount(null));
  }, [log]);

  const g = growthSummary();
  const c = (k: string) => log.counts[k] || 0;
  const done = Object.values(log.counts).reduce((a, b) => a + b, 0);
  const next = g.nextMilestoneMad;
  const prev = [...MILESTONES_MAD].reverse().find((m) => next === null || m < next) ?? 0;
  const base = g.milestonesReached.length <= 1 ? g.totalMad : g.thisMonthMad;
  const pct = next ? Math.min(100, Math.round((base / next) * 100)) : 100;
  const contacted = g.prospects.total - (g.prospects.byStatus['à vérifier'] || 0);
  const upcoming = appointments.filter((a) => a.status !== 'annulé' && Date.parse(a.at) >= Date.now()).length;

  const tiles: { n: number | string; label: string }[] = [
    { n: c('add_client'), label: 'زبناء زدتهم' },
    { n: c('add_appointment'), label: 'مواعيد حطيتها' },
    { n: c('create_ads'), label: 'مرات وجدت إعلانات' },
    { n: c('prepare_whatsapp'), label: 'رسائل واتساب' },
    { n: c('read_document'), label: 'وثائق قريتها' },
    { n: getMemory().length, label: 'حوايج تعلمتها' },
  ];

  return (
    <div dir="rtl" className="mx-3 mt-3 p-3 rounded-2xl bg-[#111111] border-2 border-[#d71920] text-white space-y-3 max-h-[60vh] overflow-y-auto">
      <div className="flex items-center gap-2 text-sm font-black">
        <Trophy className="w-4 h-4 text-red-400" /> إنجازات <span dir="ltr">{agencyProfile.agentNameAr}</span>
        <span className="ms-auto text-[10px] font-bold text-white/60">{done} عمل منذ {new Date(log.since).toLocaleDateString('fr-FR')}</span>
      </div>

      <div className="rounded-xl bg-white/10 p-2.5 space-y-1.5">
        <div className="flex items-baseline justify-between text-xs font-bold">
          <span>💰 المداخيل «النمو»</span>
          <span className="text-lg font-black text-red-400" dir="ltr">{fmt(g.totalMad)} MAD</span>
        </div>
        <div className="h-2 rounded-full bg-white/15 overflow-hidden">
          <div className="h-full bg-[#d71920] rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="text-[10px] text-white/70">
          {next === null
            ? 'وصلنا كاع المراحل 🎉'
            : next === 1
              ? 'الهدف الجاي: أول درهم من الوكالات'
              : <>الهدف الجاي: <span dir="ltr">{fmt(next)}</span> درهم هاد الشهر (من <span dir="ltr">{fmt(prev)}</span>)</>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl bg-white/10 p-2 text-center">
            <div className="text-xl font-black">{t.n}</div>
            <div className="text-[10px] text-white/75 leading-tight">{t.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-xl bg-white/10 p-2">🏢 وكالات تواصلنا معها: <b>{contacted}</b> / {g.prospects.total}</div>
        <div className="rounded-xl bg-white/10 p-2">⏰ تذكيرات فاتو: <b className={g.followUpsDue.length ? 'text-red-400' : ''}>{g.followUpsDue.length}</b></div>
        <div className="rounded-xl bg-white/10 p-2">👥 الزبناء فالمكتب: <b>{clients.length}</b></div>
        <div className="rounded-xl bg-white/10 p-2">📅 مواعيد جاية: <b>{upcoming}</b></div>
        <div className="rounded-xl bg-white/10 p-2 col-span-2">🗂️ العقارات فالسجل: <b>{registryCount ?? '…'}</b></div>
      </div>

      {log.recent.length > 0 ? (
        <div className="space-y-1">
          <div className="text-[11px] font-bold text-white/70">آخر ما درت</div>
          {log.recent.slice(0, 6).map((e, i) => (
            <div key={i} className="flex justify-between gap-2 text-[11px] bg-white/5 rounded-lg px-2 py-1">
              <span className="truncate">✅ {e.label}</span>
              <span className="text-white/50 shrink-0">{ago(e.at)}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-white/70">مازال ما درت حتى عمل. عطيني أول مهمة 👇</p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {['فين وصلنا فالنمو؟', 'شكون من وكالة خاصني نعاود ليها؟', 'عطيني تقرير اليوم'].map((q) => (
          <button key={q} onClick={() => onAsk(q)} className="px-2.5 py-1 rounded-full bg-white/15 hover:bg-white/25 text-[11px] font-bold cursor-pointer">
            {q}
          </button>
        ))}
      </div>
    </div>
  );
};
