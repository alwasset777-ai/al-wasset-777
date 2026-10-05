import React from 'react';
import { X } from 'lucide-react';
import { dismissToast, toastsLive } from '../../agent/live';
import { useStore } from '../../agent/stores';

// Alertes du وكيل pour le gérant (rappels, nouveaux messages WhatsApp, rapport du jour).
export const AgentToasts: React.FC<{ onOpenSection: (section: string) => void }> = ({ onOpenSection }) => {
  const toasts = useStore(toastsLive);
  if (toasts.length === 0) return null;
  return (
    <div className="fixed z-[55] top-20 inset-x-3 sm:inset-x-auto sm:end-5 sm:w-80 space-y-2" dir="rtl">
      {toasts.map((t) => (
        <div key={t.id} className="flex items-start gap-2 p-3 rounded-2xl bg-white shadow-xl border border-[#f0e4e2]">
          <button
            className="flex-1 text-start cursor-pointer"
            onClick={() => {
              if (t.section) onOpenSection(t.section);
              dismissToast(t.id);
            }}
          >
            <div className="text-sm font-extrabold">{t.title}</div>
            {t.body && <div className="text-xs text-[#7a5c58] mt-0.5">{t.body}</div>}
          </button>
          <button onClick={() => dismissToast(t.id)} className="p-1 cursor-pointer" aria-label="إغلاق">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
