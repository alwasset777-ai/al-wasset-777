import React, { useEffect, useState } from 'react';
import { Volume2, RefreshCw, Trash2, Plus, Check, Ban, Loader2 } from 'lucide-react';
import type { Property } from '../../types';
import type { AgentTask, MemoryItem } from '../../agent/types';
import { appointmentsStore, chatStore, clientsStore, memoryStore, settingsStore, useStore } from '../../agent/stores';
import { healthLive, refreshTasks, refreshWhatsApp, registryLive, tasksLive, waLive } from '../../agent/live';
import { resolveTask } from '../../agent/api';
import { describeAction, executeAction, reportNow, validateAction } from '../../agent/engine';
import { speak } from '../../agent/voice';
import { fmtDayTime } from '../../agent/time';

const box = 'bg-white rounded-3xl border border-[#f0e4e2] p-4';

// ---------- Rapport du jour ----------

export const ReportPanel: React.FC = () => {
  const health = useStore(healthLive);
  // Le rapport se recalcule dès qu'une de ces données change.
  useStore(appointmentsStore);
  useStore(clientsStore);
  useStore(registryLive);
  useStore(waLive);
  useStore(tasksLive);
  const report = reportNow();
  const refresh = () => Promise.all([refreshWhatsApp(), refreshTasks()]);

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="space-y-3" dir="rtl">
      <div className={`${box} space-y-3`}>
        <div className="flex items-center gap-2">
          <h3 className="text-base font-black flex-1">{report.title}</h3>
          <button onClick={refresh} className="p-2 rounded-xl hover:bg-[#fff8f7] cursor-pointer" title="تحديث">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => speak(`${report.title}. ${report.text}`, settingsStore.get().voice)}
            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-[#281715] text-white text-xs font-bold cursor-pointer"
          >
            <Volume2 className="w-4 h-4" /> قرا ليا
          </button>
        </div>
        <pre className="whitespace-pre-wrap font-[inherit] text-sm leading-7">{report.text}</pre>
      </div>
      <p className="text-[11px] text-[#7a5c58]">
        {health?.cron && health.whatsapp?.configured
          ? '✅ التقرير كيوصلك حتى ف واتساب كل صباح.'
          : 'باش يوصلك التقرير ف واتساب كل صباح، شوف الدليل (الجزء السادس: التذكيرات التلقائية).'}
      </p>
    </div>
  );
};

// ---------- Mémoire ----------

export const MemoryPanel: React.FC = () => {
  const memory = useStore(memoryStore);
  const [text, setText] = useState('');

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    const item: MemoryItem = { id: `mem-${Date.now()}`, text: text.trim().slice(0, 500), at: new Date().toISOString() };
    await memoryStore.set((prev) => [...prev, item].slice(-200));
    setText('');
  };

  return (
    <div className="space-y-3" dir="rtl">
      <p className="text-xs text-[#7a5c58]">
        هادشي اللي كيتفكرو الوكيل ديما (تقدر تقول ليه «تفكر بلي...»). المحادثات كتبقى محفوظة حتى هي ف{' '}
        {chatStore.get().length} رسالة.
      </p>
      <form onSubmit={add} className="flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="مثلا: العمولة ديالنا 2.5% ف البيع" className="flex-1 p-2.5 rounded-xl bg-white border border-[#f0e4e2] text-sm" />
        <button type="submit" className="px-3 rounded-xl bg-[#ff6f61] text-white cursor-pointer" aria-label="زيد"><Plus className="w-4 h-4" /></button>
      </form>
      <div className="space-y-2">
        {memory.length === 0 && <div className="py-8 text-center text-xs text-[#99807d]">الذاكرة خاوية.</div>}
        {[...memory].reverse().map((m) => (
          <div key={m.id} className="flex items-start gap-2 p-3 rounded-2xl bg-white border border-[#f0e4e2]">
            <span className="flex-1 text-sm">🧠 {m.text}</span>
            <span className="text-[10px] text-[#99807d] shrink-0">{fmtDayTime(m.at)}</span>
            <button onClick={() => memoryStore.set((prev) => prev.filter((x) => x.id !== m.id))} className="p-1 text-red-600 cursor-pointer" aria-label="حذف">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

// ---------- Tâches envoyées depuis WhatsApp ----------

export const TasksPanel: React.FC<{ properties: Property[]; onNavigate: (tab: string) => void }> = ({ properties, onNavigate }) => {
  const tasks = useStore(tasksLive);
  const [working, setWorking] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const pending = tasks.filter((t) => t.status === 'pending');
  const done = tasks.filter((t) => t.status !== 'pending').slice(0, 10);

  useEffect(() => {
    refreshTasks();
  }, []);

  const approve = async (t: AgentTask) => {
    setWorking(t.id);
    try {
      const action = validateAction(t.action, properties);
      if (!action) throw new Error('المعلومات ما بقاتش صالحة (الزبون ولا الموعد تحذف؟).');
      await executeAction(action, { properties, onNavigate });
      await resolveTask(t.id, 'done');
      await refreshTasks();
    } catch (err) {
      setErrors((e) => ({ ...e, [t.id]: (err as Error).message }));
    } finally {
      setWorking(null);
    }
  };

  const reject = async (t: AgentTask) => {
    await resolveTask(t.id, 'rejected').catch(() => undefined);
    await refreshTasks();
  };

  return (
    <div className="space-y-3" dir="rtl">
      <p className="text-xs text-[#7a5c58]">ملي كتعطي للوكيل خدمة من واتساب وفيها رسالة لزبون، حذف، ثمن ولا نشر، كتبان هنا باش توافق عليها.</p>
      {pending.length === 0 && <div className="py-8 text-center text-xs text-[#99807d]">ما كاين حتى مهمة بانتظار موافقتك ✅</div>}
      {pending.map((t) => (
        <div key={t.id} className={`${box} space-y-2`}>
          <div className="text-[11px] text-[#99807d]">{fmtDayTime(t.createdAt)} • واتساب</div>
          <div className="text-sm font-extrabold">{describeAction(t.action)}</div>
          {t.action.type === 'whatsapp_reply' && <div className="p-2 rounded-xl bg-[#d9fdd3] text-sm whitespace-pre-wrap" dir="auto">{t.action.text}</div>}
          {t.note && <div className="text-xs text-[#7a5c58]">«{t.note.slice(0, 300)}»</div>}
          {errors[t.id] && <div className="text-xs text-red-600">⚠️ {errors[t.id]}</div>}
          <div className="flex gap-2">
            <button onClick={() => approve(t)} disabled={working === t.id} className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-green-600 text-white text-xs font-bold cursor-pointer disabled:opacity-50">
              {working === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} موافق
            </button>
            <button onClick={() => reject(t)} className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-white border border-[#f0e4e2] text-xs font-bold cursor-pointer">
              <Ban className="w-3.5 h-3.5" /> لا
            </button>
          </div>
        </div>
      ))}
      {done.length > 0 && (
        <div className="space-y-1 pt-2">
          <div className="text-xs font-black text-[#99807d]">آخر المهام</div>
          {done.map((t) => (
            <div key={t.id} className="text-xs text-[#7a5c58]">
              {t.status === 'done' ? '✅' : '❌'} {describeAction(t.action)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
