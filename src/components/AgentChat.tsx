import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { Property } from '../types';
import { settingsStore, useStore } from '../agent/stores';
import { dismissToast, tasksLive, toastsLive, waLive } from '../agent/live';
import { canInstallApp, onInstallAvailable, promptInstall, isStandalone } from '../services/pwa';
import { AgentAvatar } from './agent/Avatar';
import { AgentConversation } from './agent/AgentConversation';

interface AgentChatProps {
  properties: Property[];
  onNavigate: (tab: string) => void;
  onOpenSection: (section: string) => void;
  hideBubble: boolean; // déjà sur la page « الوكيل »
}

// Bulle du personnage « وكيل الوسيط 777 » sur toutes les pages (réservée au gérant connecté).
export const AgentChat: React.FC<AgentChatProps> = ({ properties, onNavigate, onOpenSection, hideBubble }) => {
  const settings = useStore(settingsStore);
  const toasts = useStore(toastsLive);
  const wa = useStore(waLive);
  const tasks = useStore(tasksLive);
  const [open, setOpen] = useState(false);
  const [installable, setInstallable] = useState(canInstallApp());

  useEffect(() => onInstallAvailable(() => setInstallable(true)), []);
  useEffect(() => {
    if (hideBubble) setOpen(false);
  }, [hideBubble]);

  const badge = wa.threads.filter((t) => t.unread).length + tasks.filter((t) => t.status === 'pending').length;

  const navigate = (tab: string) => {
    onNavigate(tab);
    if (window.innerWidth < 640) setOpen(false); // sur téléphone, on ferme pour voir la page
  };

  return (
    <>
      {/* Alertes (rappels, messages, rapport) */}
      {toasts.length > 0 && (
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
      )}

      {!open && !hideBubble && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 end-5 z-50 flex items-center gap-2 ps-1.5 pe-4 py-1.5 rounded-full text-white shadow-2xl hover:scale-105 transition-transform cursor-pointer"
          style={{ background: settings.colors.primary }}
          aria-label={settings.name}
        >
          <span className="relative">
            <AgentAvatar settings={settings} size={44} />
            {badge > 0 && (
              <span className="absolute -top-1 -end-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-[10px] font-black flex items-center justify-center">{badge}</span>
            )}
          </span>
          <span className="text-sm font-extrabold">كلّم الوكيل</span>
        </button>
      )}

      {open && !hideBubble && (
        <div className="fixed z-50 inset-0 sm:inset-auto sm:bottom-5 sm:end-5 sm:w-[420px] sm:h-[680px] sm:max-h-[88vh] bg-white sm:rounded-3xl shadow-2xl border border-[#f0e4e2] flex flex-col overflow-hidden">
          {installable && !isStandalone() && (
            <button
              onClick={async () => setInstallable(!(await promptInstall()))}
              className="flex items-center justify-center gap-2 py-2 bg-[#fff0ed] text-[#ff6f61] text-xs font-extrabold cursor-pointer"
            >
              <Download className="w-4 h-4" /> ثبّت التطبيق على هذا الهاتف
            </button>
          )}
          <div className="flex-1 min-h-0">
            <AgentConversation properties={properties} onNavigate={navigate} variant="panel" onClose={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
};
