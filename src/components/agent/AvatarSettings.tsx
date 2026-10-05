import React, { useEffect, useRef, useState } from 'react';
import { Upload, Trash2, Star, Play, Loader2, Bell } from 'lucide-react';
import type { AgentSettings, AvatarLook, AvatarPhoto, Personality } from '../../agent/types';
import { DEFAULT_SETTINGS, deleteAvatarPhoto, photoUrl, saveAvatarPhoto, settingsStore, useStore } from '../../agent/stores';
import { resizeImage } from '../../agent/media';
import { listVoices, onVoicesReady, speak, speechSupported } from '../../agent/voice';
import { enableNotifications, notificationsSupported } from '../../agent/runtime';
import { AgentAvatar, activePhoto } from './Avatar';

const SKINS = ['#f1c9a5', '#e0ac7e', '#c68e6a', '#a86f4c', '#7c4a2d'];
const HAIR: Array<[AvatarLook['hair'], string]> = [['short', 'قصير'], ['curly', 'مجعد'], ['long', 'طويل'], ['bald', 'أصلع'], ['hijab', 'حجاب']];
const BEARD: Array<[AvatarLook['beard'], string]> = [['none', 'بلا لحية'], ['short', 'لحية خفيفة'], ['full', 'لحية كاملة']];
const OUTFITS: Array<[AvatarLook['outfit'], string]> = [['djellaba', 'جلابة'], ['suit', 'كوستيم'], ['casual', 'عادي'], ['caftan', 'قفطان']];
const OUTFIT_COLORS: Record<AvatarLook['outfit'], string> = { djellaba: '#f1ebe0', suit: '#2b3040', casual: '#3c6e91', caftan: '#7a1f3d' };
const PERSONALITIES: Array<[Personality, string]> = [['friendly', 'ضحوك ومرح'], ['serious', 'جدّي'], ['formal', 'رسمي ومحترم']];

const box = 'bg-white rounded-3xl border border-[#f0e4e2] p-4 space-y-3';
const label = 'text-xs font-extrabold text-[#5a4340]';
const input = 'w-full p-2.5 rounded-xl bg-[#fff8f7] border border-[#f0e4e2] text-sm focus:outline-none focus:ring-2 focus:ring-[#ff6f61]';
const chip = (on: boolean) => `px-3 py-1.5 rounded-full text-xs font-bold border cursor-pointer ${on ? 'bg-[#281715] text-white border-[#281715]' : 'bg-white border-[#f0e4e2] text-[#5a4340]'}`;

// Réglage de la bouche : on touche la photo à l'endroit de la bouche.
const MouthPicker: React.FC<{ photo: AvatarPhoto; onChange: (m: AvatarPhoto['mouth']) => void }> = ({ photo, onChange }) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    photoUrl(photo.file).then(setUrl);
  }, [photo.file.id, photo.file.url]);
  if (!url) return null;
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-[#7a5c58]">ضغط على الفم فالصورة باش يتحرك مزيان ملي كيهضر، ومن بعد ظبّط عرض الفم.</p>
      <div
        className="relative w-full max-w-xs mx-auto cursor-crosshair select-none"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          onChange({ ...photo.mouth, x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
        }}
      >
        <img src={url} alt="" className="w-full rounded-2xl" draggable={false} />
        <span
          className="absolute border-2 border-[#ff6f61] rounded-full pointer-events-none"
          style={{
            left: `${(photo.mouth.x - photo.mouth.w / 2) * 100}%`,
            top: `${photo.mouth.y * 100}%`,
            width: `${photo.mouth.w * 100}%`,
            height: 10,
            transform: 'translateY(-50%)',
          }}
        />
      </div>
      <label className="flex items-center gap-2 text-[11px] font-bold">
        عرض الفم
        <input type="range" min={0.06} max={0.4} step={0.01} value={photo.mouth.w} onChange={(e) => onChange({ ...photo.mouth, w: Number(e.target.value) })} className="flex-1" />
      </label>
    </div>
  );
};

export const AvatarSettings: React.FC = () => {
  const settings = useStore(settingsStore);
  const [voices, setVoices] = useState(listVoices());
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [notifState, setNotifState] = useState(notificationsSupported() ? Notification.permission : 'unsupported');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => onVoicesReady(() => setVoices(listVoices())), []);

  const update = (patch: Partial<AgentSettings>) => settingsStore.set((s) => ({ ...s, ...patch }));
  const updateLook = (patch: Partial<AvatarLook>) => settingsStore.set((s) => ({ ...s, look: { ...s.look, ...patch } }));
  const updatePhoto = (id: string, patch: Partial<AvatarPhoto>) =>
    settingsStore.set((s) => ({ ...s, photos: s.photos.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const f of Array.from(files).slice(0, 6)) {
        const blob = await resizeImage(f, 900, 0.88);
        const file = await saveAvatarPhoto(blob, f.name);
        const photo: AvatarPhoto = {
          id: file.id,
          label: `صورة ${settingsStore.get().photos.length + 1}`,
          file,
          mouth: { x: 0.5, y: 0.7, w: 0.16 },
        };
        await settingsStore.set((s) => ({ ...s, avatarMode: 'photo', photos: [...s.photos, photo], activePhotoId: s.activePhotoId || photo.id }));
        setEditing(photo.id);
      }
    } catch {
      window.alert('تعذر حفظ الصورة. تحقق من الاتصال وتسجيل الدخول.');
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = async (p: AvatarPhoto) => {
    if (!window.confirm(`حذف «${p.label}»؟`)) return;
    await settingsStore.set((s) => ({
      ...s,
      photos: s.photos.filter((x) => x.id !== p.id),
      activePhotoId: s.activePhotoId === p.id ? s.photos.find((x) => x.id !== p.id)?.id : s.activePhotoId,
    }));
    await deleteAvatarPhoto(p.file);
  };

  const test = () => speak(`السلام عليكم السي منير، أنا ${settings.name}. واجد نعاونك فالخدمة ديال المكتب.`, settings.voice);
  const shownVoices = voices.filter((v) => /^(ar|fr)/i.test(v.lang));
  const editingPhoto = settings.photos.find((p) => p.id === editing);

  return (
    <div className="grid lg:grid-cols-[280px_1fr] gap-4" dir="rtl">
      {/* Aperçu */}
      <div className={`${box} h-fit lg:sticky lg:top-24 flex flex-col items-center text-center`}>
        <AgentAvatar settings={settings} size={200} photo={editingPhoto} />
        <div className="text-base font-black">{settings.name}</div>
        <button onClick={test} className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#281715] text-white text-xs font-bold cursor-pointer">
          <Play className="w-3.5 h-3.5" /> جرّب الصوت والحركة
        </button>
        {!speechSupported() && <p className="text-[11px] text-red-600">هاد المتصفح ما فيهش القراءة بالصوت.</p>}
      </div>

      <div className="space-y-4">
        {/* Identité */}
        <section className={box}>
          <h3 className="text-sm font-black">الهوية والشخصية</h3>
          <label className="block space-y-1">
            <span className={label}>الاسم</span>
            <input value={settings.name} onChange={(e) => update({ name: e.target.value.slice(0, 40) })} className={input} />
          </label>
          <div className="space-y-1">
            <span className={label}>رجل أو امرأة</span>
            <div className="flex gap-2">
              <button className={chip(settings.gender === 'male')} onClick={() => update({ gender: 'male', look: { ...settings.look, hair: 'short', beard: 'short' } })}>رجل</button>
              <button className={chip(settings.gender === 'female')} onClick={() => update({ gender: 'female', look: { ...settings.look, hair: 'long', beard: 'none', outfit: 'caftan' } })}>امرأة</button>
            </div>
          </div>
          <div className="space-y-1">
            <span className={label}>الطبع</span>
            <div className="flex flex-wrap gap-2">
              {PERSONALITIES.map(([k, l]) => (
                <button key={k} className={chip(settings.personality === k)} onClick={() => update({ personality: k })}>{l}</button>
              ))}
            </div>
          </div>
          <label className="block space-y-1">
            <span className={label}>تعليمات خاصة (كيفاش بغيتيه يهضر ويخدم)</span>
            <textarea
              value={settings.extraInstructions}
              onChange={(e) => update({ extraInstructions: e.target.value.slice(0, 1500) })}
              rows={3}
              placeholder="مثلا: عيّط ليا «السي منير»، ديما فكرني نتصل بالموثق، الثمن ديال العمولة 2.5%..."
              className={input}
            />
          </label>
        </section>

        {/* Apparence */}
        <section className={box}>
          <h3 className="text-sm font-black">الشكل</h3>
          <div className="flex gap-2">
            <button className={chip(settings.avatarMode === 'photo')} onClick={() => update({ avatarMode: 'photo' })}>صورتي</button>
            <button className={chip(settings.avatarMode === 'illustrated')} onClick={() => update({ avatarMode: 'illustrated' })}>شخصية مرسومة</button>
          </div>

          {settings.avatarMode === 'photo' && (
            <div className="space-y-3">
              <p className="text-[11px] text-[#7a5c58]">
                رفع صورة واضحة لوجهك (من القدام، الضوء مزيان). تقدر ترفع بزاف ديال الصور بلبسات مختلفة (جلابة، كوستيم...) وتقول للوكيل «لبس الجلابة».
              </p>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { upload(e.target.files); e.target.value = ''; }} />
              <button onClick={() => fileRef.current?.click()} disabled={uploading} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#ff6f61] text-white text-xs font-bold cursor-pointer disabled:opacity-50">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} رفع صورة
              </button>
              <div className="grid sm:grid-cols-2 gap-3">
                {settings.photos.map((p) => (
                  <div key={p.id} className={`p-2 rounded-2xl border ${activePhoto(settings)?.id === p.id ? 'border-[#ff6f61]' : 'border-[#f0e4e2]'} space-y-2`}>
                    <div className="flex items-center gap-2">
                      <AgentAvatar settings={settings} size={48} photo={p} />
                      <input value={p.label} onChange={(e) => updatePhoto(p.id, { label: e.target.value.slice(0, 30) })} className={`${input} !p-1.5 text-xs`} placeholder="اللبسة" />
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => update({ activePhotoId: p.id })} className="flex-1 flex items-center justify-center gap-1 py-1 rounded-lg bg-[#fff8f7] text-[11px] font-bold cursor-pointer">
                        <Star className="w-3 h-3" /> {activePhoto(settings)?.id === p.id ? 'المستعملة' : 'استعمل'}
                      </button>
                      <button onClick={() => setEditing(editing === p.id ? null : p.id)} className="flex-1 py-1 rounded-lg bg-[#fff8f7] text-[11px] font-bold cursor-pointer">
                        ظبّط الفم
                      </button>
                      <button onClick={() => removePhoto(p)} className="px-2 py-1 rounded-lg bg-[#fff8f7] text-red-600 cursor-pointer" aria-label="حذف">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    {editing === p.id && <MouthPicker photo={p} onChange={(mouth) => updatePhoto(p.id, { mouth })} />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {settings.avatarMode === 'illustrated' && (
            <div className="space-y-3">
              <div className="space-y-1">
                <span className={label}>لون البشرة</span>
                <div className="flex gap-2">
                  {SKINS.map((c) => (
                    <button key={c} onClick={() => updateLook({ skin: c })} className={`w-8 h-8 rounded-full border-2 cursor-pointer ${settings.look.skin === c ? 'border-[#281715]' : 'border-white'}`} style={{ background: c }} />
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <span className={label}>الشعر</span>
                <div className="flex flex-wrap gap-2 items-center">
                  {HAIR.map(([k, l]) => <button key={k} className={chip(settings.look.hair === k)} onClick={() => updateLook({ hair: k })}>{l}</button>)}
                  <input type="color" value={settings.look.hairColor} onChange={(e) => updateLook({ hairColor: e.target.value })} className="w-9 h-9 rounded-lg" title="اللون" />
                </div>
              </div>
              {settings.gender === 'male' && (
                <div className="flex flex-wrap gap-2">
                  {BEARD.map(([k, l]) => <button key={k} className={chip(settings.look.beard === k)} onClick={() => updateLook({ beard: k })}>{l}</button>)}
                </div>
              )}
              <div className="space-y-1">
                <span className={label}>اللبسة</span>
                <div className="flex flex-wrap gap-2 items-center">
                  {OUTFITS.map(([k, l]) => <button key={k} className={chip(settings.look.outfit === k)} onClick={() => updateLook({ outfit: k, outfitColor: OUTFIT_COLORS[k] })}>{l}</button>)}
                  <input type="color" value={settings.look.outfitColor} onChange={(e) => updateLook({ outfitColor: e.target.value })} className="w-9 h-9 rounded-lg" title="اللون" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs font-bold">
                <input type="checkbox" checked={settings.look.glasses} onChange={(e) => updateLook({ glasses: e.target.checked })} /> نظارات
              </label>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#f0e4e2]">
            <span className={label}>ألوان المكتب</span>
            <input type="color" value={settings.colors.primary} onChange={(e) => update({ colors: { ...settings.colors, primary: e.target.value } })} className="w-9 h-9 rounded-lg" title="اللون الأساسي" />
            <input type="color" value={settings.colors.accent} onChange={(e) => update({ colors: { ...settings.colors, accent: e.target.value } })} className="w-9 h-9 rounded-lg" title="اللون الثاني" />
            <button onClick={() => update({ colors: DEFAULT_SETTINGS.colors })} className="text-[11px] font-bold text-[#99807d] underline cursor-pointer">رجّع ألوان الوسيط 777</button>
          </div>
        </section>

        {/* Voix */}
        <section className={box}>
          <h3 className="text-sm font-black">الصوت</h3>
          <label className="block space-y-1">
            <span className={label}>الصوت (أصوات الهاتف المجانية)</span>
            <select value={settings.voice.voiceURI || ''} onChange={(e) => update({ voice: { ...settings.voice, voiceURI: e.target.value || undefined } })} className={input}>
              <option value="">تلقائي (أحسن صوت عربي متوفر)</option>
              {shownVoices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-3 text-xs font-bold">
            السرعة
            <input type="range" min={0.6} max={1.5} step={0.05} value={settings.voice.rate} onChange={(e) => update({ voice: { ...settings.voice, rate: Number(e.target.value) } })} className="flex-1" />
          </label>
          <label className="flex items-center gap-3 text-xs font-bold">
            النبرة
            <input type="range" min={0.5} max={1.6} step={0.05} value={settings.voice.pitch} onChange={(e) => update({ voice: { ...settings.voice, pitch: Number(e.target.value) } })} className="flex-1" />
          </label>
          <label className="flex items-center gap-2 text-xs font-bold">
            <input type="checkbox" checked={settings.voice.autoSpeak} onChange={(e) => update({ voice: { ...settings.voice, autoSpeak: e.target.checked } })} /> يجاوب بالصوت ديما
          </label>
          <div className="space-y-1">
            <span className={label}>فهم الكلام</span>
            <div className="flex flex-wrap gap-2">
              <button className={chip(settings.voice.micMode === 'ai')} onClick={() => update({ voice: { ...settings.voice, micMode: 'ai' } })}>الذكاء الاصطناعي (كيفهم الدارجة مزيان)</button>
              <button className={chip(settings.voice.micMode === 'browser')} onClick={() => update({ voice: { ...settings.voice, micMode: 'browser' } })}>ميكروفون المتصفح (أسرع)</button>
            </div>
          </div>
        </section>

        {/* Comportement */}
        <section className={box}>
          <h3 className="text-sm font-black">الخدمة والتنبيهات</h3>
          <label className="flex items-center gap-2 text-xs font-bold">
            <input type="checkbox" checked={settings.confirmAll} onChange={(e) => update({ confirmAll: e.target.checked })} />
            سولني قبل أي تغيير (حتى زيادة زبون أو موعد)
          </label>
          <p className="text-[11px] text-[#7a5c58]">ديما كيسولك قبل: النشر، إرسال رسالة لزبون، الحذف، وتبديل الأثمنة.</p>
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            <input type="checkbox" checked={settings.reminders.enabled} onChange={(e) => update({ reminders: { ...settings.reminders, enabled: e.target.checked } })} />
            فكرني بالمواعيد قبل
            <select value={settings.reminders.beforeMin} onChange={(e) => update({ reminders: { ...settings.reminders, beforeMin: Number(e.target.value) } })} className="p-1.5 rounded-lg border border-[#f0e4e2]">
              {[15, 30, 60, 120, 1440].map((m) => <option key={m} value={m}>{m === 1440 ? 'نهار' : m >= 60 ? `${m / 60} ساعة` : `${m} دقيقة`}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            <input type="checkbox" checked={settings.dailyReport.enabled} onChange={(e) => update({ dailyReport: { ...settings.dailyReport, enabled: e.target.checked } })} />
            التقرير اليومي مع الساعة
            <select value={settings.dailyReport.hour} onChange={(e) => update({ dailyReport: { ...settings.dailyReport, hour: Number(e.target.value) } })} className="p-1.5 rounded-lg border border-[#f0e4e2]">
              {[6, 7, 8, 9, 10, 12, 18, 20].map((h) => <option key={h} value={h}>{h}:00</option>)}
            </select>
          </div>
          {notifState !== 'unsupported' && notifState !== 'granted' && (
            <button
              onClick={async () => setNotifState((await enableNotifications()) ? 'granted' : Notification.permission)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#fff0ed] text-[#ff6f61] text-xs font-bold cursor-pointer"
            >
              <Bell className="w-4 h-4" /> فعّل التنبيهات فالهاتف
            </button>
          )}
          {notifState === 'granted' && <p className="text-[11px] text-green-700 font-bold">✅ التنبيهات مفعّلة فهاد الجهاز.</p>}
        </section>
      </div>
    </div>
  );
};
