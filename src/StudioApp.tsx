import React from 'react';
import { Settings } from 'lucide-react';
import { PublishStudioView } from './components/PublishStudioView';
import { openAgencySettings, useAgency } from './components/AgencySettingsPanel';

// Application « صانع الإعلانات » (/studio) : uniquement le créateur d'affiches, sans le site public.
// Chaque agence y met ses propres informations (roue dentée → إعدادات الوكالة).
export const StudioApp: React.FC = () => {
  const a = useAgency();
  return (
    <div dir="rtl" className="min-h-screen bg-[#f6f6f6] font-tajawal">
      <header className="sticky top-0 z-30 bg-[#111] text-white shadow-md">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          {a.logo ? (
            <img src={a.logo} alt="" className="w-12 h-12 rounded-full bg-white object-contain p-1" />
          ) : (
            <img src="/icons/studio-192.png" alt="" className="w-12 h-12 rounded-full bg-white" />
          )}
          <div className="leading-tight flex-1 min-w-0">
            <h1 className="font-black text-lg truncate">{a.name.trim() ? `صانع إعلانات ${a.name.trim()}` : 'صانع الإعلانات العقارية'}</h1>
            <p className="text-xs text-white/60">صور + معلومات ← صورة إعلانية جاهزة</p>
          </div>
          <button onClick={openAgencySettings} aria-label="إعدادات الوكالة" className="w-11 h-11 shrink-0 rounded-full bg-white/10 flex items-center justify-center cursor-pointer">
            <Settings className="w-6 h-6" />
          </button>
        </div>
      </header>
      <main className="px-4 pt-5">
        <PublishStudioView />
      </main>
    </div>
  );
};
