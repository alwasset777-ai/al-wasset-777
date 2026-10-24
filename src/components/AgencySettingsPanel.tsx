import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Building2, Check, ImagePlus, Loader2, Pencil, Settings, Trash2 } from 'lucide-react';
import { useBackClose } from '../hooks/useBackClose';
import { AgencySettings, agency, loadAgency, onAgencyChange, saveAgency, shrinkLogo } from '../services/agencySettings';

// Paramètres de l'application : informations de l'agence qui apparaissent sur toutes les affiches.
// Ouverts par la roue dentée de l'en-tête (openAgencySettings) ou par la carte « وكالتي ».

const OPEN_EVENT = 'studio:agency-settings';
export const openAgencySettings = () => window.dispatchEvent(new Event(OPEN_EVENT));

// Informations de l'agence, mises à jour dès qu'elles changent.
export function useAgency(): AgencySettings {
  const [a, setA] = useState(agency());
  useEffect(() => {
    const off = onAgencyChange(() => setA(agency()));
    loadAgency().then(() => setA(agency()));
    return off;
  }, []);
  return a;
}

const input = 'w-full p-3 rounded-2xl bg-[#f6f6f6] border border-[#ececec] text-base focus:outline-none focus:border-[#e3131b]';
const label = 'text-xs font-bold text-[#5f5f5f]';

export const AgencySettingsHost: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<AgencySettings>(agency());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  useBackClose(open, () => setOpen(false));

  useEffect(() => {
    const show = () => {
      loadAgency().then(() => {
        const a = agency();
        setForm({ ...a, phones: a.phones.length ? [...a.phones] : [''] });
        setError(null);
        setOpen(true);
      });
    };
    window.addEventListener(OPEN_EVENT, show);
    return () => window.removeEventListener(OPEN_EVENT, show);
  }, []);

  if (!open) return null;

  const set = <K extends keyof AgencySettings>(k: K, v: AgencySettings[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setPhone = (i: number, v: string) => set('phones', form.phones.map((p, j) => (j === i ? v : p)));

  const pickLogo = async (f: File | undefined) => {
    if (!f) return;
    try {
      set('logo', await shrinkLogo(f));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const save = async () => {
    setBusy(true);
    const ok = await saveAgency(form);
    setBusy(false);
    if (!ok) return setError('لم تُحفظ المعلومات في هذا الهاتف (الشعار ثقيل؟ جرّب صورة أصغر)');
    setOpen(false);
  };

  const field = (k: 'name' | 'slogan' | 'address' | 'city' | 'whatsapp', text: string, placeholder = '', ltr = false) => (
    <label className="block space-y-1">
      <span className={label}>{text}</span>
      <input value={form[k]} onChange={(e) => set(k, e.target.value)} placeholder={placeholder} dir={ltr ? 'ltr' : undefined} className={input} />
    </label>
  );
  const link = (k: 'website' | 'facebook' | 'instagram' | 'tiktok' | 'youtube', text: string, placeholder: string) => (
    <label className="block space-y-1">
      <span className={label}>{text}</span>
      <input value={form[k]} onChange={(e) => set(k, e.target.value)} placeholder={placeholder} dir="ltr" className={`${input} text-left`} />
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={() => setOpen(false)}>
      <div dir="rtl" className="font-tajawal w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-[#f6f6f6] rounded-t-3xl sm:rounded-3xl p-4 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <Settings className="w-6 h-6 text-[#e3131b]" />
          <h2 className="font-black text-lg flex-1">إعدادات الوكالة</h2>
          <button onClick={() => setOpen(false)} className="px-3 py-2 rounded-xl bg-white font-bold text-sm flex items-center gap-1 cursor-pointer">
            <ArrowRight className="w-4 h-4" /> رجوع
          </button>
        </div>
        <p className="text-xs text-[#777] font-semibold leading-relaxed">
          هذه المعلومات تظهر على كل الإعلانات (الشعار، الاسم، الهاتف، العنوان، الشبكات الاجتماعية). تبقى محفوظة في هذا الهاتف فقط.
        </p>

        <section className="bg-white rounded-3xl p-4 border border-[#ececec] space-y-3">
          <h3 className="font-black">الشعار والاسم</h3>
          <div className="flex items-center gap-3">
            {form.logo ? (
              <div className="w-24 h-24 shrink-0 relative rounded-2xl border border-[#ececec] bg-white flex items-center justify-center">
                <img src={form.logo} alt="الشعار" className="max-w-[85%] max-h-[85%] object-contain" />
                <button onClick={() => set('logo', '')} aria-label="حذف الشعار" className="absolute top-1 left-1 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center cursor-pointer">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => logoRef.current?.click()} aria-label="تغيير الشعار" className="absolute bottom-1 right-1 w-7 h-7 rounded-full bg-white text-[#e3131b] border border-[#f3a3a6] flex items-center justify-center cursor-pointer">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => logoRef.current?.click()}
                className="w-24 h-24 shrink-0 rounded-2xl border-2 border-dashed border-[#f3a3a6] bg-[#fff5f5] flex flex-col items-center justify-center gap-1 text-[#e3131b] cursor-pointer"
              >
                <ImagePlus className="w-7 h-7" />
                <span className="text-xs font-extrabold">أضف الشعار</span>
              </button>
            )}
            <p className="text-xs text-[#888] font-semibold leading-relaxed">صورة PNG بخلفية شفافة تعطي أجمل نتيجة.</p>
            <input
              ref={logoRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                pickLogo(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </div>
          {field('name', 'اسم الوكالة', 'مثال: وكالة النور العقارية')}
          {field('slogan', 'شعار قصير (اختياري)', 'مثال: شريكك في السكن')}
        </section>

        <section className="bg-white rounded-3xl p-4 border border-[#ececec] space-y-3">
          <h3 className="font-black">الهاتف والعنوان</h3>
          {form.phones.map((p, i) => (
            <div key={i} className="flex items-end gap-2">
              <label className="block space-y-1 flex-1">
                <span className={label}>رقم الهاتف {form.phones.length > 1 ? i + 1 : ''}</span>
                <input value={p} onChange={(e) => setPhone(i, e.target.value)} placeholder="06 00 00 00 00" inputMode="tel" dir="ltr" className={`${input} text-left`} />
              </label>
              {form.phones.length > 1 && (
                <button onClick={() => set('phones', form.phones.filter((_, j) => j !== i))} aria-label="حذف الرقم" className="mb-1 w-11 h-11 rounded-2xl bg-[#fff0f0] text-[#e3131b] flex items-center justify-center cursor-pointer">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
          {form.phones.length < 3 && (
            <button onClick={() => set('phones', [...form.phones, ''])} className="text-sm font-bold text-[#e3131b] cursor-pointer">
              + رقم آخر
            </button>
          )}
          {field('whatsapp', 'رقم واتساب (لرمز QR) — فارغ = الرقم الأول', '06 00 00 00 00', true)}
          {field('address', 'العنوان', 'مثال: شارع محمد الخامس، رقم 12')}
          {field('city', 'المدينة', 'مثال: مكناس')}
        </section>

        <section className="bg-white rounded-3xl p-4 border border-[#ececec] space-y-3">
          <h3 className="font-black">الموقع والشبكات الاجتماعية</h3>
          {link('facebook', 'فيسبوك', 'facebook.com/…')}
          {link('instagram', 'إنستغرام', '@…')}
          {link('tiktok', 'تيك توك', '@…')}
          {link('youtube', 'يوتيوب', 'youtube.com/@…')}
          {link('website', 'الموقع الإلكتروني', 'www.…')}
        </section>

        {error && <p className="text-sm text-red-600 font-bold">{error}</p>}
        <button onClick={save} disabled={busy} className="w-full py-4 rounded-2xl bg-[#e3131b] text-white font-black flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60">
          {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />} حفظ
        </button>
      </div>
    </div>
  );
};

// Carte « وكالتي » en haut du « صانع الإعلانات » : rappel de remplir les paramètres, ou résumé de l'agence.
export const AgencyCard: React.FC = () => {
  const a = useAgency();
  const empty = !a.name.trim() && !a.logo && !a.phones.some((p) => p.trim());
  if (empty)
    return (
      <button
        onClick={openAgencySettings}
        className="w-full text-right bg-[#fff5f5] border-2 border-dashed border-[#f3a3a6] rounded-3xl p-4 flex items-center gap-3 cursor-pointer"
      >
        <span className="w-12 h-12 shrink-0 rounded-2xl bg-[#e3131b] text-white flex items-center justify-center">
          <Building2 className="w-6 h-6" />
        </span>
        <span className="flex-1">
          <span className="block font-black text-[#e3131b]">أدخل معلومات وكالتك أولاً</span>
          <span className="block text-xs text-[#777] font-semibold">الشعار، الاسم، الهاتف، العنوان والشبكات — لتظهر على كل الإعلانات</span>
        </span>
        <Settings className="w-5 h-5 text-[#e3131b]" />
      </button>
    );
  return (
    <button onClick={openAgencySettings} className="w-full text-right bg-white border border-[#ececec] rounded-3xl p-3 flex items-center gap-3 shadow-sm cursor-pointer">
      {a.logo ? (
        <img src={a.logo} alt="" className="w-12 h-12 shrink-0 rounded-xl object-contain bg-[#f6f6f6]" />
      ) : (
        <span className="w-12 h-12 shrink-0 rounded-xl bg-[#f1f1f1] text-[#999] flex items-center justify-center">
          <Building2 className="w-6 h-6" />
        </span>
      )}
      <span className="flex-1 min-w-0">
        <span className="block font-black truncate">{a.name || 'وكالتي'}</span>
        <span className="block text-xs text-[#888] font-semibold truncate" dir="ltr">
          {a.phones.filter((p) => p.trim()).join('  |  ')}
        </span>
      </span>
      <span className="text-xs font-bold text-[#e3131b] flex items-center gap-1">
        <Settings className="w-4 h-4" /> الإعدادات
      </span>
    </button>
  );
};
