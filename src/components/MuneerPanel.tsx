import React, { useEffect, useRef, useState } from 'react';
import { Brain, Camera, CheckCircle2, Plus, RotateCcw, Trash2, XCircle } from 'lucide-react';
import { agencyProfile } from '../data/agencyProfile';
import { forgetById, getAvatar, getMemory, MemoryItem, MemoryKind, onMemoryChange, remember, setAvatar } from '../services/muneerMemory';

const KIND_LABEL: Record<MemoryKind, string> = { fact: 'معلومة', style: 'أسلوب', skill: 'مهارة' };
const KIND_COLOR: Record<MemoryKind, string> = { fact: 'bg-sky-100 text-sky-800', style: 'bg-amber-100 text-amber-800', skill: 'bg-emerald-100 text-emerald-800' };

interface Health {
  ai?: boolean;
  managerKey?: boolean;
  whatsapp?: boolean;
}

// Réduit la photo choisie à 256 px (JPEG) pour la garder sur l'appareil.
function shrinkPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const size = 256;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      const s = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(img.src);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

// Panneau « شنو تعلم منير » : souvenirs, مهارات, photo de l'avatar et état des branchements.
export const MuneerPanel: React.FC = () => {
  const [items, setItems] = useState<MemoryItem[]>(getMemory());
  const [photo, setPhoto] = useState<string | null>(getAvatar());
  const [kind, setKind] = useState<MemoryKind>('skill');
  const [text, setText] = useState('');
  const [health, setHealth] = useState<Health | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(
    () =>
      onMemoryChange(() => {
        setItems(getMemory());
        setPhoto(getAvatar());
      }),
    []
  );
  useEffect(() => {
    fetch('/api/health')
      .then((r) => (r.ok ? r.json() : null))
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (remember(kind, text)) setText('');
  };

  const Status: React.FC<{ ok?: boolean; label: string; hint: string }> = ({ ok, label, hint }) => (
    <div className="flex items-start gap-2 text-[11px]">
      {ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <XCircle className="w-4 h-4 text-[#c0392b] shrink-0" />}
      <div>
        <span className="font-extrabold">{label}</span>
        {!ok && <span className="text-[#7a5c58]"> — {hint}</span>}
      </div>
    </div>
  );

  return (
    <div className="p-3 border-b border-[#f0e4e2] bg-[#fff8f7] space-y-3 max-h-[60vh] overflow-y-auto" dir="rtl">
      <div className="flex items-center gap-2 text-sm font-black">
        <Brain className="w-4 h-4 text-[#ff6f61]" /> شنو تعلم {agencyProfile.agentNameAr} معاك
      </div>
      <p className="text-[11px] text-[#7a5c58] leading-relaxed">
        قول ليه ف المحادثة: «تعلّم: …» ولا «من دابا كي نقول ليك تقرير، عطيني المواعيد والزبناء الجداد». ولا زيدها هنا.
      </p>

      <form onSubmit={add} className="flex gap-1.5">
        <select value={kind} onChange={(e) => setKind(e.target.value as MemoryKind)} className="rounded-xl border border-[#f0e4e2] text-xs px-1.5 bg-white">
          <option value="skill">مهارة</option>
          <option value="fact">معلومة</option>
          <option value="style">أسلوب</option>
        </select>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="مثلا: الزبناء ديال فاس كنعطيهم الأولوية"
          className="flex-1 min-w-0 rounded-xl border border-[#f0e4e2] text-xs p-2 bg-white"
        />
        <button type="submit" disabled={text.trim().length < 3} className="px-2.5 rounded-xl bg-[#281715] text-white disabled:opacity-40 cursor-pointer" aria-label="زيد">
          <Plus className="w-4 h-4" />
        </button>
      </form>

      {items.length === 0 ? (
        <div className="text-[11px] text-[#99807d]">باقي ما تعلم والو. علّمه أول حاجة دابا 🙂</div>
      ) : (
        <ul className="space-y-1.5">
          {items.map((m) => (
            <li key={m.id} className="flex items-start gap-2 bg-white border border-[#f0e4e2] rounded-xl p-2">
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black shrink-0 ${KIND_COLOR[m.kind]}`}>{KIND_LABEL[m.kind]}</span>
              <span className="flex-1 text-xs leading-relaxed" dir="auto">{m.text}</span>
              <button onClick={() => forgetById(m.id)} className="p-1 text-[#99807d] hover:text-[#c0392b] cursor-pointer" aria-label="انسى">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-[#f0e4e2] text-xs font-bold cursor-pointer">
          <Camera className="w-3.5 h-3.5" /> {photo ? `بدّل صورة ${agencyProfile.agentNameAr}` : `حط صورتك لـ${agencyProfile.agentNameAr}`}
        </button>
        {photo && (
          <button onClick={() => setAvatar(null)} className="flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs text-[#7a5c58] cursor-pointer">
            <RotateCcw className="w-3.5 h-3.5" /> رجّع الشعار
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) setAvatar(await shrinkPhoto(f).catch(() => null));
            e.target.value = '';
          }}
        />
      </div>

      <div className="space-y-1 pt-1 border-t border-[#f0e4e2]">
        <div className="text-[11px] font-black pt-2">الحالة</div>
        {health === null ? (
          <div className="text-[11px] text-[#c0392b]">الخادم ما كيجاوبش دابا.</div>
        ) : (
          <>
            <Status ok={health.ai} label={`الذكاء ديال ${agencyProfile.agentNameAr}`} hint="خاص المفتاح GEMINI_API_KEY ف Vercel" />
            <Status ok={health.managerKey} label="كلمة السر ديال المدير" hint="خاص MANAGER_KEY ف Vercel" />
            <Status ok={health.whatsapp} label={`${agencyProfile.agentNameAr} ف واتساب`} hint="شوف الدليل: الجزء الخامس" />
          </>
        )}
      </div>
    </div>
  );
};
