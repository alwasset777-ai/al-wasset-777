import React, { useEffect, useRef, useState } from 'react';
import { Check, ImagePlus, Loader2, Trash2, X } from 'lucide-react';
import { PosterData, ensureFonts } from '../services/posterMaker';
import { BLOCK_LABELS, BlockKind, CustomTemplate, TemplateBlock, drawCustomBlocks } from '../services/posterTemplates';

// Éditeur d'un modèle du gérant : une image de fond, puis des zones déplaçables (photos, titre, prix…).
// Une zone avec un « fond » cache le texte d'exemple de l'image.

type Img = HTMLImageElement;

interface Props {
  initial?: CustomTemplate;
  data: PosterData;
  photos: Img[];
  onSave: (t: CustomTemplate) => Promise<void>;
  onClose: () => void;
}

const KINDS: BlockKind[] = ['photo', 'headline', 'subtitle', 'price', 'address', 'specs', 'features', 'phone', 'logo', 'qr'];
const COLORS = ['#ffffff', '#121212', '#e3131b', '#1b2a49', '#2e3a40', '#857669', '#6e8d82'];
const MAX_W = 1600; // l'image de fond est réduite pour rester légère

function loadImg(src: string): Promise<Img> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('صورة غير صالحة'));
    img.src = src;
  });
}

async function shrink(file: Blob): Promise<{ blob: Blob; width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImg(url);
    const s = Math.min(1, MAX_W / img.width);
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * s);
    c.height = Math.round(img.height * s);
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('صورة غير صالحة'))), 'image/jpeg', 0.9));
    return { blob, width: c.width, height: c.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export const TemplateEditor: React.FC<Props> = ({ initial, data, photos, onSave, onClose }) => {
  const [bg, setBg] = useState<{ blob: Blob; img: Img; width: number; height: number } | null>(null);
  const [blocks, setBlocks] = useState<TemplateBlock[]>(initial?.blocks ?? []);
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState(initial?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const drag = useRef<{ id: string; mode: 'move' | 'size'; px: number; py: number; b: TemplateBlock } | null>(null);

  // Modèle existant : recharger son image.
  useEffect(() => {
    if (!initial) return;
    const url = URL.createObjectURL(initial.bg);
    loadImg(url).then((img) => setBg({ blob: initial.bg, img, width: initial.width, height: initial.height }));
    return () => URL.revokeObjectURL(url);
  }, [initial]);

  // Aperçu réel (image + zones remplies avec les informations du bien).
  useEffect(() => {
    if (!bg || !canvasRef.current) return;
    let alive = true;
    const id = requestAnimationFrame(async () => {
      await ensureFonts();
      const c = canvasRef.current;
      if (!alive || !c) return;
      const W = 720;
      const H = Math.round((W * bg.height) / bg.width);
      c.width = W;
      c.height = H;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(bg.img, 0, 0, W, H);
      drawCustomBlocks(ctx, blocks, data, photos, W, H);
    });
    return () => {
      alive = false;
      cancelAnimationFrame(id);
    };
  }, [bg, blocks, data, photos]);

  const pickImage = async (f: File | undefined) => {
    if (!f) return;
    setError(null);
    try {
      const { blob, width, height } = await shrink(f);
      const img = await loadImg(URL.createObjectURL(blob));
      setBg({ blob, img, width, height });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const sel = blocks.find((b) => b.id === selected);
  const update = (id: string, patch: Partial<TemplateBlock>) => setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));

  const addBlock = (kind: BlockKind) => {
    if (!bg) return;
    const n = blocks.length;
    const off = (n % 5) * 0.04;
    const ratio = bg.width / bg.height;
    const photoCount = blocks.filter((b) => b.kind === 'photo').length;
    const base: TemplateBlock = { id: `${Date.now()}-${n}`, kind, x: 0.2 + off, y: 0.15 + off, w: 0.6, h: 0.08 };
    const b: TemplateBlock =
      kind === 'photo'
        ? { ...base, w: 0.5, h: 0.3, photo: Math.min(4, photoCount + 1), shape: 'round' }
        : kind === 'logo'
          ? { ...base, w: 0.34, h: (0.34 * ratio) / 2.1, fill: '#ffffff' }
          : kind === 'qr'
            ? { ...base, w: 0.2, h: 0.2 * ratio }
            : kind === 'features' || kind === 'phone'
              ? { ...base, h: 0.14, color: '#ffffff', fill: null, align: 'right' }
              : { ...base, h: kind === 'headline' ? 0.1 : 0.07, color: '#ffffff', fill: null, align: 'center' };
    setBlocks((prev) => [...prev, b]);
    setSelected(b.id);
  };

  // Déplacement / redimensionnement au doigt ou à la souris.
  const onDown = (e: React.PointerEvent, b: TemplateBlock, mode: 'move' | 'size') => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { id: b.id, mode, px: e.clientX, py: e.clientY, b };
    setSelected(b.id);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const rect = stageRef.current?.getBoundingClientRect();
    if (!d || !rect) return;
    const dx = (e.clientX - d.px) / rect.width;
    const dy = (e.clientY - d.py) / rect.height;
    if (d.mode === 'move') update(d.id, { x: clamp(d.b.x + dx, 0, 1 - d.b.w), y: clamp(d.b.y + dy, 0, 1 - d.b.h) });
    else update(d.id, { w: clamp(d.b.w + dx, 0.04, 1 - d.b.x), h: clamp(d.b.h + dy, 0.03, 1 - d.b.y) });
  };
  const onUp = () => (drag.current = null);

  const save = async () => {
    if (!bg) return setError('اختر صورة القالب أولاً');
    if (!blocks.length) return setError('أضف خانة واحدة على الأقل (صورة أو عنوان…)');
    setSaving(true);
    try {
      await onSave({
        id: initial?.id ?? `c-${Date.now()}`,
        name: name.trim() || 'قالب جديد',
        bg: bg.blob,
        width: bg.width,
        height: bg.height,
        blocks,
        created: initial?.created ?? Date.now(),
      });
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  const btn = (on: boolean) =>
    `px-3 py-2 rounded-xl text-sm font-bold border cursor-pointer ${on ? 'bg-[#121212] text-white border-transparent' : 'bg-white border-[#e5e5e5] text-[#333]'}`;
  const swatches = (value: string | null | undefined, set: (c: string | null) => void, allowNone: boolean) => (
    <div className="flex flex-wrap items-center gap-2">
      {allowNone && (
        <button onClick={() => set(null)} className={btn(!value)}>
          بدون
        </button>
      )}
      {COLORS.map((c) => (
        <button
          key={c}
          onClick={() => set(c)}
          aria-label={c}
          className={`w-9 h-9 rounded-full border-2 cursor-pointer ${value === c ? 'border-[#e3131b] scale-110' : 'border-[#ddd]'}`}
          style={{ background: c }}
        />
      ))}
      <input type="color" value={value || '#ffffff'} onChange={(e) => set(e.target.value)} className="w-10 h-9 rounded cursor-pointer" aria-label="لون آخر" />
    </div>
  );

  return (
    <div dir="rtl" className="fixed inset-0 z-50 bg-[#f6f6f6] overflow-y-auto font-tajawal">
      <div className="sticky top-0 z-10 bg-[#111] text-white px-4 py-3 flex items-center gap-3">
        <button onClick={onClose} aria-label="إغلاق" className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center cursor-pointer">
          <X className="w-5 h-5" />
        </button>
        <h2 className="font-black text-lg flex-1">{initial ? 'تعديل القالب' : 'قالب جديد'}</h2>
        <button onClick={save} disabled={saving} className="px-4 py-2 rounded-xl bg-[#e3131b] font-black flex items-center gap-1 cursor-pointer disabled:opacity-60">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} حفظ
        </button>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4 pb-24">
        {error && <p className="p-3 rounded-2xl bg-[#fff0f0] text-[#e3131b] font-bold text-sm">{error}</p>}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            pickImage(e.target.files?.[0]);
            e.target.value = '';
          }}
        />

        {!bg ? (
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full aspect-[4/5] rounded-3xl border-2 border-dashed border-[#f3a3a6] bg-[#fff5f5] text-[#e3131b] flex flex-col items-center justify-center gap-2 cursor-pointer"
          >
            <ImagePlus className="w-12 h-12" />
            <span className="font-black text-lg">اختر صورة القالب</span>
            <span className="text-sm text-[#a55] px-8 text-center">صورة القالب كما هي (من Canva أو غيره). بعد ذلك تضع فوقها أماكن الصور والمعلومات.</span>
          </button>
        ) : (
          <>
            <p className="text-sm text-[#555] leading-relaxed">
              اضغط على خانة لإضافتها، ثم <b>اسحبها</b> فوق مكانها في الصورة، و<b>كبّرها</b> من الزاوية الحمراء. لتغطية كتابة المثال القديمة اختر «لون الخلفية».
            </p>
            <div
              ref={stageRef}
              className="relative w-full rounded-2xl overflow-hidden shadow-lg select-none"
              style={{ aspectRatio: `${bg.width} / ${bg.height}`, touchAction: 'none' }}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              onPointerDown={() => setSelected(null)}
            >
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
              {blocks.map((b) => (
                <div
                  key={b.id}
                  onPointerDown={(e) => onDown(e, b, 'move')}
                  className={`absolute cursor-move ${b.id === selected ? 'outline outline-2 outline-[#e3131b] bg-[#e3131b]/10' : 'outline outline-1 outline-dashed outline-white/90'}`}
                  style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%`, borderRadius: b.shape === 'circle' ? '50%' : undefined }}
                >
                  <span className="absolute -top-0 right-0 px-1.5 py-0.5 text-[10px] font-black bg-[#121212]/80 text-white rounded-bl-lg pointer-events-none">
                    {BLOCK_LABELS[b.kind]}
                    {b.kind === 'photo' ? ` ${b.photo}` : ''}
                  </span>
                  {b.id === selected && (
                    <span
                      onPointerDown={(e) => onDown(e, b, 'size')}
                      className="absolute -bottom-3 -right-3 w-7 h-7 rounded-full bg-[#e3131b] border-2 border-white cursor-nwse-resize"
                    />
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => fileRef.current?.click()} className="text-sm font-bold text-[#e3131b] underline cursor-pointer">
              تغيير صورة القالب
            </button>

            <section className="bg-white rounded-3xl p-4 border border-[#ececec] space-y-3">
              <h3 className="font-black">أضف خانة</h3>
              <div className="flex flex-wrap gap-2">
                {KINDS.map((k) => (
                  <button key={k} onClick={() => addBlock(k)} className={btn(false)}>
                    + {BLOCK_LABELS[k]}
                  </button>
                ))}
              </div>
            </section>

            {sel && (
              <section className="bg-white rounded-3xl p-4 border border-[#e3131b]/40 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-black">
                    {BLOCK_LABELS[sel.kind]}
                    {sel.kind === 'photo' ? ` ${sel.photo}` : ''}
                  </h3>
                  <button
                    onClick={() => {
                      setBlocks((prev) => prev.filter((b) => b.id !== sel.id));
                      setSelected(null);
                    }}
                    className="px-3 py-2 rounded-xl bg-[#fff0f0] text-[#e3131b] font-bold text-sm flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" /> حذف
                  </button>
                </div>
                {sel.kind === 'photo' ? (
                  <>
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="text-xs font-bold text-[#5f5f5f]">أي صورة:</span>
                      {[1, 2, 3, 4].map((n) => (
                        <button key={n} onClick={() => update(sel.id, { photo: n })} className={btn(sel.photo === n)}>
                          {n === 1 ? '1 (الرئيسية)' : n}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="text-xs font-bold text-[#5f5f5f]">الشكل:</span>
                      {(
                        [
                          ['rect', 'مربع'],
                          ['round', 'زوايا مدورة'],
                          ['circle', 'دائرة'],
                        ] as const
                      ).map(([s, l]) => (
                        <button key={s} onClick={() => update(sel.id, { shape: s })} className={btn((sel.shape ?? 'round') === s)}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    {sel.kind !== 'logo' && sel.kind !== 'qr' && (
                      <>
                        <span className="text-xs font-bold text-[#5f5f5f]">لون الكتابة</span>
                        {swatches(sel.color, (c) => update(sel.id, { color: c || '#ffffff' }), false)}
                        <div className="flex gap-2">
                          {(
                            [
                              ['right', 'يمين'],
                              ['center', 'وسط'],
                              ['left', 'يسار'],
                            ] as const
                          ).map(([a, l]) => (
                            <button key={a} onClick={() => update(sel.id, { align: a })} className={btn((sel.align ?? 'center') === a)}>
                              {l}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                    {sel.kind !== 'qr' && (
                      <>
                        <span className="text-xs font-bold text-[#5f5f5f]">لون الخلفية (لتغطية الكتابة القديمة)</span>
                        {swatches(sel.fill, (c) => update(sel.id, { fill: c }), true)}
                      </>
                    )}
                  </>
                )}
              </section>
            )}

            <label className="block space-y-1">
              <span className="text-xs font-bold text-[#5f5f5f]">اسم القالب</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثلاً: قالب الفيلات"
                className="w-full p-3 rounded-2xl bg-white border border-[#ececec] text-base focus:outline-none focus:border-[#e3131b]"
              />
            </label>
          </>
        )}
      </div>
    </div>
  );
};
