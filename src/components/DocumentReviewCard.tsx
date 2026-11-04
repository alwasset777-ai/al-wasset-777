// Fiche proposée par « منير » après lecture d'un document : le gérant vérifie, corrige, puis enregistre.
import React, { useState } from 'react';
import { Check, FileText, X } from 'lucide-react';
import type { RegistryFields } from '../services/registryStore';
import { DOC_TYPE_LABELS, ReadDocumentResult } from '../services/documentReader';

const TYPES = ['شقة', 'فيلا', 'منزل', 'أرض', 'محل تجاري', 'مكتب', 'عمارة', 'رياض', 'ضيعة'];

interface Props {
  fileName: string;
  read: ReadDocumentResult;
  initial: RegistryFields;
  saving: boolean;
  onSave: (fields: RegistryFields) => void;
  onCancel: () => void;
}

export const DocumentReviewCard: React.FC<Props> = ({ fileName, read, initial, saving, onSave, onCancel }) => {
  const [f, setF] = useState<RegistryFields>(initial);
  const input = 'w-full p-2 rounded-lg border border-[#f0e4e2] bg-white text-xs';
  const field = (key: keyof RegistryFields, label: string, ltr = false) => (
    <label className="block space-y-0.5">
      <span className="text-[10px] font-bold text-[#7a5c58]">{label}</span>
      <input value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })} dir={ltr ? 'ltr' : 'auto'} className={input} />
    </label>
  );
  return (
    <div dir="rtl" className="rounded-2xl border-2 border-[#ff6f61]/40 bg-white p-3 space-y-2 text-[#281715]">
      <div className="flex items-center gap-2 text-xs font-extrabold">
        <FileText className="w-4 h-4 text-[#ff6f61]" />
        {DOC_TYPE_LABELS[read.docType] || 'وثيقة'} · <span className="font-normal text-[#7a5c58] truncate">{fileName}</span>
      </div>
      <p className="text-[11px] text-[#7a5c58]">راجع المعلومات وصحّحها إلا كان شي غلط، من بعد سجّلها فـ«سجل العقارات». الوثيقة كتتحفظ مع الفيشة.</p>
      {read.unreadable && <p className="text-[11px] font-bold text-amber-700 bg-amber-50 rounded-lg p-2">⚠️ ما بانش مزيان: {read.unreadable}</p>}
      <label className="block space-y-0.5">
        <span className="text-[10px] font-bold text-[#7a5c58]">نوع العقار</span>
        <select value={f.propertyType} onChange={(e) => setF({ ...f, propertyType: e.target.value })} className={input}>
          {TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        {field('owner', 'المالك')}
        {field('ownerPhone', 'الهاتف', true)}
        {field('surface', 'المساحة')}
        {field('price', 'الثمن')}
      </div>
      {field('location', 'الموقع / العنوان')}
      <label className="block space-y-0.5">
        <span className="text-[10px] font-bold text-[#7a5c58]">ملاحظات</span>
        <textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} rows={3} dir="auto" className={input} />
      </label>
      <div className="flex gap-2">
        <button type="button" disabled={saving || !f.owner.trim()} onClick={() => onSave(f)} className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-[#1f3a2e] text-white text-xs font-extrabold disabled:opacity-40 cursor-pointer">
          <Check className="w-4 h-4" /> {saving ? 'كيتسجل…' : 'سجّل فالسجل'}
        </button>
        <button type="button" disabled={saving} onClick={onCancel} className="px-3 flex items-center gap-1 rounded-xl border border-[#f0e4e2] text-xs font-bold cursor-pointer">
          <X className="w-4 h-4" /> إلغاء
        </button>
      </div>
      <p className="text-[10px] text-[#99807d]">🔒 الوثيقة كتتقرا بالذكاء الاصطناعي ديال Google (Gemini). ما تصيفطش وثائق حساسة إلا كنتي متفق مع مولاها.</p>
    </div>
  );
};
