import React, { useEffect, useState } from 'react';
import { RefreshCw, Send, Sparkles, CheckCircle2, UserPlus, ArrowRight, Loader2, Phone } from 'lucide-react';
import type { LeadScore, WaThread } from '../../agent/types';
import { refreshSuggestion, sendWhatsApp, updateThread } from '../../agent/api';
import { refreshWhatsApp, upsertThread, waLive } from '../../agent/live';
import { clientsStore, useStore } from '../../agent/stores';
import { makeClient } from '../../agent/normalize';
import { fmtDayTime, fmtTime, localDay, zoned } from '../../agent/time';

const SCORE_STYLE: Record<LeadScore, string> = {
  جاد: 'bg-green-100 text-green-800',
  متوسط: 'bg-amber-100 text-amber-800',
  ضعيف: 'bg-gray-100 text-gray-600',
};

const when = (iso: string) => (localDay(iso) === zoned().date ? fmtTime(iso) : fmtDayTime(iso));

// Boîte WhatsApp : l'agent classe chaque client et prépare la réponse ; le gérant l'envoie (ou la modifie).
export const WhatsAppInbox: React.FC = () => {
  const wa = useStore(waLive);
  const clients = useStore(clientsStore);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState<'send' | 'suggest' | 'refresh' | null>(null);
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [error, setError] = useState<string | null>(null);

  const thread = wa.threads.find((t) => t.id === selected) || null;
  const list = wa.threads.filter((t) => filter === 'all' || t.status === 'open');

  useEffect(() => {
    setDraft(thread?.suggestion || '');
    setError(null);
    if (thread?.unread) updateThread(thread.id, { unread: false }).then((r) => upsertThread(r.thread)).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, thread?.suggestion]);

  const run = async (kind: 'send' | 'suggest' | 'refresh', fn: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const send = (t: WaThread) =>
    run('send', async () => {
      if (!window.confirm(`نصيفط هاد الرسالة لـ ${t.name}؟`)) return;
      const r = await sendWhatsApp(t.phone, draft);
      upsertThread(r.thread);
      setDraft('');
    });

  const suggest = (t: WaThread) => run('suggest', async () => upsertThread((await refreshSuggestion(t.id)).thread));
  const close = (t: WaThread) =>
    run('refresh', async () => upsertThread((await updateThread(t.id, { status: t.status === 'open' ? 'done' : 'open' })).thread));

  const inCrm = (t: WaThread) => clients.some((c) => c.phone.replace(/\D/g, '').slice(-9) === t.phone.slice(-9));
  const addToCrm = async (t: WaThread) => {
    const c = makeClient(
      {
        name: t.name,
        phone: `0${t.phone.slice(-9)}`,
        requestType: t.lead?.intent,
        propType: t.lead?.propType,
        budget: Number(String(t.lead?.budget || '').replace(/[^\d]/g, '')) || 0,
        area: t.lead?.area,
        score: t.lead?.score,
        notes: t.lead?.reason,
      },
      { source: 'whatsapp' }
    );
    if (c) await clientsStore.put(c);
  };

  if (!wa.loaded) return <div className="py-12 text-center"><Loader2 className="w-5 h-5 animate-spin inline" /></div>;

  return (
    <div className="space-y-3" dir="rtl">
      {!wa.status?.configured && (
        <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
          <div className="font-extrabold">واتساب ما مربوطش بعد</div>
          <p>
            باش الوكيل يقرا رسائل الزبناء ويحضّر الردود، خاص ربط رقم WhatsApp Business بـ Meta (الدليل: docs/SETUP-AR.md ← الجزء الخامس).
            دابا، ملي توافق على رد، كيتحل ليك واتساب بالرسالة واجدة.
          </p>
        </div>
      )}
      {wa.error && <div className="p-2 rounded-xl bg-red-50 text-[11px] text-red-700">{wa.error}</div>}
      {wa.store === 'memory' && wa.status?.configured && (
        <div className="p-2 rounded-xl bg-amber-50 text-[11px] text-amber-800">
          ⚠️ الرسائل محفوظة غير فذاكرة الخادم (كتمسح ملي يتعاود التشغيل). زيد FIREBASE_SERVICE_ACCOUNT (الدليل).
        </div>
      )}

      <div className="grid md:grid-cols-[300px_1fr] gap-3">
        {/* Liste */}
        <div className={`bg-white rounded-3xl border border-[#f0e4e2] overflow-hidden ${thread ? 'hidden md:block' : ''}`}>
          <div className="flex items-center gap-2 p-3 border-b border-[#f0e4e2]">
            <button onClick={() => setFilter('open')} className={`px-2.5 py-1 rounded-full text-[11px] font-bold cursor-pointer ${filter === 'open' ? 'bg-[#281715] text-white' : 'bg-[#fff8f7]'}`}>مفتوحة</button>
            <button onClick={() => setFilter('all')} className={`px-2.5 py-1 rounded-full text-[11px] font-bold cursor-pointer ${filter === 'all' ? 'bg-[#281715] text-white' : 'bg-[#fff8f7]'}`}>الكل</button>
            <button onClick={() => run('refresh', refreshWhatsApp)} className="ms-auto p-1.5 rounded-lg hover:bg-[#fff8f7] cursor-pointer" title="تحديث">
              <RefreshCw className={`w-4 h-4 ${busy === 'refresh' ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto divide-y divide-[#f6eeec]">
            {list.length === 0 && <div className="p-6 text-center text-xs text-[#99807d]">ما كاين حتى محادثة.</div>}
            {list.map((t) => (
              <button key={t.id} onClick={() => setSelected(t.id)} className={`w-full text-start p-3 hover:bg-[#fff8f7] cursor-pointer ${selected === t.id ? 'bg-[#fff8f7]' : ''}`}>
                <div className="flex items-center gap-2">
                  {t.unread && <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />}
                  <span className="text-sm font-extrabold truncate flex-1">{t.name}</span>
                  {t.lead && <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${SCORE_STYLE[t.lead.score]}`}>{t.lead.score}</span>}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] text-[#7a5c58] truncate flex-1">{t.messages[t.messages.length - 1]?.text}</span>
                  <span className="text-[10px] text-[#99807d] shrink-0">{when(t.lastAt)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Conversation */}
        {thread ? (
          <div className="bg-white rounded-3xl border border-[#f0e4e2] flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 p-3 border-b border-[#f0e4e2]">
              <button onClick={() => setSelected(null)} className="md:hidden p-1 cursor-pointer" aria-label="رجوع"><ArrowRight className="w-4 h-4" /></button>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-black truncate">{thread.name}</div>
                <a href={`tel:+${thread.phone}`} className="text-[11px] text-[#7a5c58] flex items-center gap-1" dir="ltr"><Phone className="w-3 h-3" /> +{thread.phone}</a>
              </div>
              {!inCrm(thread) && (
                <button onClick={() => addToCrm(thread)} className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-[#fff8f7] text-[11px] font-bold cursor-pointer">
                  <UserPlus className="w-3.5 h-3.5" /> زيد للزبناء
                </button>
              )}
              <button onClick={() => close(thread)} className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-[#fff8f7] text-[11px] font-bold cursor-pointer">
                <CheckCircle2 className="w-3.5 h-3.5" /> {thread.status === 'open' ? 'سالي' : 'عاود فتح'}
              </button>
            </div>
            {thread.lead && (
              <div className="px-3 py-2 bg-[#fff8f7] text-[11px] text-[#5a4340] flex flex-wrap gap-x-3 gap-y-1">
                <span className={`px-2 py-0.5 rounded-full font-bold ${SCORE_STYLE[thread.lead.score]}`}>{thread.lead.score}</span>
                {thread.lead.intent && <span>🎯 {thread.lead.intent}</span>}
                {thread.lead.propType && <span>🏠 {thread.lead.propType}</span>}
                {thread.lead.budget && <span>💰 {thread.lead.budget}</span>}
                {thread.lead.area && <span>📍 {thread.lead.area}</span>}
                {thread.lead.reason && <span className="w-full text-[#7a5c58]">{thread.lead.reason}</span>}
              </div>
            )}
            <div className="flex-1 max-h-[45vh] overflow-y-auto p-3 space-y-2 bg-[#efeae2]">
              {thread.messages.map((m) => (
                <div key={m.id} className={`flex ${m.from === 'client' ? 'justify-start' : 'justify-end'}`}>
                  <div dir="auto" className={`max-w-[80%] px-3 py-2 rounded-xl text-sm whitespace-pre-wrap ${m.from === 'client' ? 'bg-white' : 'bg-[#d9fdd3]'}`}>
                    {m.text}
                    <div className="text-[10px] text-[#99807d] mt-0.5 text-end">{when(m.at)}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-[#f0e4e2] space-y-2">
              <div className="flex items-center gap-2 text-[11px] font-extrabold text-[#ff6f61]">
                <Sparkles className="w-3.5 h-3.5" /> الرد المقترح (تقدر تبدّلو)
                <button onClick={() => suggest(thread)} disabled={busy !== null} className="ms-auto flex items-center gap-1 text-[#7a5c58] cursor-pointer disabled:opacity-50">
                  {busy === 'suggest' ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} اقتراح جديد
                </button>
              </div>
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={4} dir="auto" placeholder="كتب الرد…" className="w-full p-2.5 rounded-xl bg-[#fff8f7] border border-[#f0e4e2] text-sm focus:outline-none focus:ring-2 focus:ring-[#ff6f61]" />
              {error && <div className="text-[11px] text-red-600">{error}</div>}
              {wa.status?.configured ? (
                <button onClick={() => send(thread)} disabled={!draft.trim() || busy !== null} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-600 text-white text-sm font-bold cursor-pointer disabled:opacity-50">
                  {busy === 'send' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 rotate-180" />} موافق، صيفط
                </button>
              ) : (
                <a
                  href={`https://wa.me/${thread.phone}?text=${encodeURIComponent(draft)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-600 text-white text-sm font-bold"
                >
                  <Send className="w-4 h-4 rotate-180" /> حل واتساب بهاد الرد
                </a>
              )}
            </div>
          </div>
        ) : (
          <div className="hidden md:flex items-center justify-center rounded-3xl border border-dashed border-[#f0e4e2] text-xs text-[#99807d] p-10">
            ختار محادثة باش تشوف الرد اللي حضّر الوكيل.
          </div>
        )}
      </div>
    </div>
  );
};
