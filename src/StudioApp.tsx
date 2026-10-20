import React from 'react';
import { PublishStudioView } from './components/PublishStudioView';

// Application personnelle du gérant (/studio) : uniquement le « صانع الإعلانات », sans le site public.
export const StudioApp: React.FC = () => (
  <div dir="rtl" className="min-h-screen bg-[#f6f6f6] font-tajawal">
    <header className="sticky top-0 z-30 bg-[#111] text-white shadow-md">
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
        <img src="/icons/studio-192.png" alt="إعلانات 777" className="w-11 h-11 rounded-xl bg-white" />
        <div className="leading-tight">
          <h1 className="font-black text-lg">صانع إعلانات الوسيط 777</h1>
          <p className="text-xs text-white/60">صور + معلومات ← صورة إعلانية جاهزة</p>
        </div>
      </div>
    </header>
    <main className="px-4 pt-5">
      <PublishStudioView />
    </main>
  </div>
);
