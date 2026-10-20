import React, { useEffect, useState } from 'react';
import { Check, Pencil, Plus, Trash2 } from 'lucide-react';
import { PosterData, ensureFonts } from '../services/posterMaker';
import { PosterTemplate, renderPreview } from '../services/posterTemplates';

// Case « القالب » : vignettes de chaque modèle avec les photos et informations du bien.
interface Props {
  templates: PosterTemplate[];
  selectedId: string;
  data: PosterData;
  photos: HTMLImageElement[];
  onSelect: (id: string) => void;
  onAdd: () => void;
  onEdit: (t: PosterTemplate) => void;
  onDelete: (t: PosterTemplate) => void;
}

export const TemplatePicker: React.FC<Props> = ({ templates, selectedId, data, photos, onSelect, onAdd, onEdit, onDelete }) => {
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    const id = setTimeout(async () => {
      await ensureFonts();
      const out: Record<string, string> = {};
      for (const t of templates) {
        const c = document.createElement('canvas');
        renderPreview(c, data, photos, t, 300);
        out[t.id] = c.toDataURL('image/jpeg', 0.75);
        await new Promise((r) => setTimeout(r, 0)); // laisse respirer l'interface
      }
      if (alive) setThumbs(out);
    }, 350);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [templates, data, photos]);

  const current = templates.find((t) => t.id === selectedId);

  return (
    <section className="bg-white rounded-3xl p-4 sm:p-5 border border-[#ececec] shadow-sm space-y-3">
      <h2 className="text-lg font-black">القالب</h2>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
        {templates.map((t) => {
          const on = t.id === selectedId;
          return (
            <button key={t.id} onClick={() => onSelect(t.id)} className="shrink-0 snap-start flex flex-col items-center gap-1.5 cursor-pointer">
              <span className={`relative block h-44 rounded-xl overflow-hidden bg-[#eee] ${on ? 'ring-4 ring-[#e3131b]' : 'ring-1 ring-[#e5e5e5]'}`}>
                {thumbs[t.id] ? <img src={thumbs[t.id]} alt="" className="h-full w-auto" /> : <span className="block h-full w-36 animate-pulse" />}
                {on && (
                  <span className="absolute top-1.5 left-1.5 w-7 h-7 rounded-full bg-[#e3131b] text-white flex items-center justify-center">
                    <Check className="w-4 h-4" />
                  </span>
                )}
              </span>
              <span className={`text-xs font-bold ${on ? 'text-[#e3131b]' : 'text-[#555]'}`}>{t.name}</span>
            </button>
          );
        })}
        <button onClick={onAdd} className="shrink-0 snap-start flex flex-col items-center gap-1.5 cursor-pointer">
          <span className="h-44 w-32 rounded-xl border-2 border-dashed border-[#f3a3a6] bg-[#fff5f5] text-[#e3131b] flex flex-col items-center justify-center gap-1">
            <Plus className="w-8 h-8" />
            <span className="text-sm font-black">قالب جديد</span>
          </span>
          <span className="text-xs font-bold text-[#555]">من صورة</span>
        </button>
      </div>
      {current?.kind === 'custom' && (
        <div className="flex gap-2">
          <button onClick={() => onEdit(current)} className="flex-1 py-2.5 rounded-2xl bg-[#f1f1f1] font-bold text-sm flex items-center justify-center gap-1 cursor-pointer">
            <Pencil className="w-4 h-4" /> تعديل القالب
          </button>
          <button onClick={() => onDelete(current)} className="py-2.5 px-4 rounded-2xl bg-[#fff0f0] text-[#e3131b] font-bold text-sm flex items-center gap-1 cursor-pointer">
            <Trash2 className="w-4 h-4" /> حذف
          </button>
        </div>
      )}
    </section>
  );
};
