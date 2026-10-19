import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Download, ImagePlus, Loader2, Plus, Rocket, Send, Share2, Sparkles, Star, X } from 'lucide-react';
import { siBluesky, siFacebook, siGoogle, siInstagram, siThreads, siTiktok, siWhatsapp, siYoutube } from 'simple-icons';
import { Language, ListingType, PropertyType } from '../types';
import { ServerStatus, fetchServerStatus } from '../services/adsApi';
import { isFirebaseEnabled } from '../services/firebase';
import { DEAL_LABELS, PosterData, TYPE_LABELS, drawPoster, ensureFonts, posterBlob, posterVideo } from '../services/posterMaker';
import { STUDIO_LANGUAGES, STUDIO_PLATFORMS, StudioLanguage, StudioNetwork } from '../services/studioPlatforms';
import {
  StudioPhoto,
  StudioPost,
  StudioTarget,
  downloadFile,
  fullText,
  generatePosts,
  loadPhoto,
  publishMetaDirect,
  schedulePost,
  shareImage,
  uploadMedia,
} from '../services/studioApi';
import { LoginCard, SignOutButton, useAuthUser } from './AuthGate';

interface PublishStudioViewProps {
  language: Language;
}

interface TargetSpec {
  id: StudioTarget;
  label: string;
  path: string; // logo officiel (simple-icons)
  color: string;
  bg?: string;
  size: [number, number];
  format: string;
}

const LOGOS: Record<StudioTarget, string> = {
  facebook: siFacebook.path, instagram: siInstagram.path, tiktok: siTiktok.path, youtube: siYoutube.path,
  threads: siThreads.path, gmb: siGoogle.path, bluesky: siBluesky.path, whatsapp: siWhatsapp.path,
};

const TARGETS: TargetSpec[] = [
  ...STUDIO_PLATFORMS.map((p) => ({
    id: p.id, label: p.label, path: LOGOS[p.id], color: p.color, size: p.size, format: p.format,
    bg: p.id === 'instagram' ? 'linear-gradient(45deg,#feda75,#fa7e1e,#d62976,#962fbf,#4f5bd5)' : undefined,
  })),
  { id: 'whatsapp', label: 'WhatsApp', path: LOGOS.whatsapp, color: '#25d366', size: [1080, 1920], format: 'Statut' },
];
const target = (id: StudioTarget) => TARGETS.find((x) => x.id === id)!;

const FEATURES = ['مصعد', 'موقف سيارات', 'مرآب', 'مسبح', 'حديقة', 'شرفة', 'مفروشة', 'مطبخ مجهز', 'تدفئة مركزية', 'إطلالة رائعة', 'قريب من المدارس', 'رسم عقاري'];

const EMPTY: PosterData = {
  deal: 'vente', type: 'Appartement', city: 'مكناس', district: '', surface: 0, bedrooms: 0, bathrooms: 0, price: '', features: [],
};

const BrandLogo: React.FC<{ path: string; className?: string }> = ({ path, className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <path d={path} />
  </svg>
);

export const PublishStudioView: React.FC<PublishStudioViewProps> = ({ language }) => {
  const isAr = language === 'ar';
  const isEn = language === 'en';
  const t = (fr: string, ar: string, en: string) => (isAr ? ar : isEn ? en : fr);

  const user = useAuthUser();
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [photos, setPhotos] = useState<StudioPhoto[]>([]);
  const [data, setData] = useState<PosterData>(EMPTY);
  const [customFeature, setCustomFeature] = useState('');
  const [notes, setNotes] = useState('');
  const [lang, setLang] = useState<StudioLanguage>('ar+fr');
  const [selected, setSelected] = useState<StudioTarget[]>(['facebook', 'instagram', 'tiktok', 'whatsapp']);
  const [active, setActive] = useState<StudioTarget>('instagram');
  const [when, setWhen] = useState<'now' | 'later'>('now');
  const [dateTime, setDateTime] = useState('');
  const [posts, setPosts] = useState<StudioPost[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const reviewRef = useRef<HTMLDivElement>(null);
  const photosRef = useRef(photos);
  photosRef.current = photos;

  useEffect(() => {
    fetchServerStatus().then(setStatus);
  }, [user]);
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    if (!selected.includes(active) && selected.length) setActive(selected[0]);
  }, [selected, active]);

  const imgs = useMemo(() => photos.map((p) => p.img), [photos]);
  const activeSpec = target(selected.includes(active) ? active : selected[0] ?? 'instagram');

  // Aperçu en direct de l'affiche, redessinée à chaque modification.
  useEffect(() => {
    let cancelled = false;
    ensureFonts().then(() => {
      if (!cancelled && previewRef.current) drawPoster(previewRef.current, data, imgs, ...activeSpec.size);
    });
    return () => {
      cancelled = true;
    };
  }, [data, imgs, activeSpec]);

  // Toute modification invalide les textes déjà préparés.
  useEffect(() => {
    setPosts([]);
  }, [data, photos, selected, lang]);

  // ---------- Photos ----------
  const addPhotos = async (list: FileList | null) => {
    if (!list) return;
    const room = 4 - photos.length;
    const files = Array.from(list).filter((f) => f.type.startsWith('image/')).slice(0, Math.max(0, room));
    if (Array.from(list).length > room) setToast(t('4 photos maximum', 'أقصى عدد 4 صور', '4 photos maximum'));
    const loaded = (await Promise.all(files.map((f) => loadPhoto(f).catch(() => null)))).filter((p): p is StudioPhoto => !!p);
    setPhotos((prev) => [...prev, ...loaded].slice(0, 4));
  };
  const removePhoto = (id: string) => {
    const p = photos.find((x) => x.id === id);
    if (p) URL.revokeObjectURL(p.url);
    setPhotos((prev) => prev.filter((x) => x.id !== id));
  };
  const makeMain = (id: string) => setPhotos((prev) => [...prev.filter((x) => x.id === id), ...prev.filter((x) => x.id !== id)]);

  // ---------- Fiche ----------
  const set = <K extends keyof PosterData>(k: K, v: PosterData[K]) => setData((prev) => ({ ...prev, [k]: v }));
  const toggleFeature = (f: string) =>
    set('features', data.features.includes(f) ? data.features.filter((x) => x !== f) : [...data.features, f]);
  const addCustomFeature = () => {
    const f = customFeature.trim();
    if (f && !data.features.includes(f)) set('features', [...data.features, f]);
    setCustomFeature('');
  };
  const toggleTarget = (id: StudioTarget) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setActive(id);
  };

  const run = async (key: string, job: () => Promise<void>) => {
    setBusy(key);
    try {
      await job();
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  // Nom en lettres latines : les navigateurs ignorent souvent les noms de fichier en arabe.
  const fileName = (id: StudioTarget, ext = 'jpg') => `alwasset777-${id}-${target(id).size.join('x')}.${ext}`;
  const blobFor = (id: StudioTarget) => posterBlob(data, imgs, ...target(id).size);

  const downloadAll = () =>
    run('download', async () => {
      const done = new Set<string>();
      for (const id of selected) {
        const key = target(id).size.join('x');
        if (done.has(key)) continue; // un seul fichier par dimension
        done.add(key);
        downloadFile(await blobFor(id), fileName(id));
        await new Promise((r) => setTimeout(r, 400));
      }
    });

  // ---------- Préparation ----------
  const handlePrepare = () =>
    run('prepare', async () => {
      const created = await generatePosts(photos, data, notes, selected, lang);
      setPosts(created);
      const previews: Record<string, string> = {};
      await ensureFonts();
      for (const id of selected) {
        const [w, h] = target(id).size;
        const c = document.createElement('canvas');
        drawPoster(c, data, imgs, Math.round(w * 0.4), Math.round(h * 0.4));
        previews[id] = c.toDataURL('image/jpeg', 0.85);
      }
      setThumbs(previews);
      if (created.every((p) => p.source === 'modèle'))
        setToast(t('IA indisponible : textes modèles Al Wassit', 'تم استعمال نصوص المكتب الجاهزة (الذكاء الاصطناعي غير متوفر)', 'AI unavailable: template texts used'));
      setTimeout(() => reviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    });

  const updatePost = (id: StudioTarget, patch: Partial<StudioPost>) =>
    setPosts((prev) => prev.map((p) => (p.target === id ? { ...p, ...patch } : p)));

  // ---------- Publication ----------
  const viaMetricool = !!status?.metricool;
  const metaDirect = (id: StudioTarget) => !viaMetricool && when === 'now' && (id === 'facebook' || id === 'instagram') && !!status?.meta[id];
  const toPublish = posts.filter((p) => p.target !== 'whatsapp' && p.status !== 'programmé' && p.status !== 'publié');
  const needsLogin = isFirebaseEnabled && user === null;
  const canPublish = !!user && isFirebaseEnabled && toPublish.length > 0 && (viaMetricool || toPublish.some((p) => metaDirect(p.target)));

  const handlePublish = () =>
    run('publish', async () => {
      if (when === 'later' && !dateTime) throw new Error(t('Choisissez la date et l’heure', 'اختر التاريخ والساعة', 'Pick a date and time'));
      const batch = `${Date.now()}`;
      let ok = 0;
      for (const p of toPublish) {
        const id = p.target as StudioNetwork;
        updatePost(id, { status: 'envoi', error: undefined });
        try {
          if (!viaMetricool && !metaDirect(id)) throw new Error(t('Nécessite Metricool', 'يحتاج ربط Metricool', 'Needs Metricool'));
          const imageUrl = await uploadMedia(batch, await blobFor(id), fileName(id));
          if (!viaMetricool) {
            await publishMetaDirect(id as 'facebook' | 'instagram', fullText(p), imageUrl);
            updatePost(id, { status: 'publié' });
          } else {
            // YouTube n'accepte que la vidéo : l'affiche devient un Short de 8 secondes.
            const video = id === 'youtube' ? await uploadMedia(batch, await posterVideo(data, imgs, ...target(id).size), fileName(id, 'mp4')) : undefined;
            const r = await schedulePost({
              network: id,
              text: fullText(p),
              title: p.title || undefined,
              images: [imageUrl],
              video,
              vertical: target(id).size[1] > target(id).size[0],
              dateTime: when === 'later' ? dateTime : undefined,
            });
            updatePost(id, { status: 'programmé', scheduledFor: r.dateTime });
          }
          ok++;
        } catch (e) {
          updatePost(id, { status: 'erreur', error: (e as Error).message });
        }
      }
      setToast(t(`${ok}/${toPublish.length} publications envoyées`, `تم إرسال ${ok} من ${toPublish.length} منشورات`, `${ok}/${toPublish.length} posts sent`));
    });

  const handleShare = (p: StudioPost) =>
    run(`share-${p.target}`, async () => {
      const how = await shareImage(await blobFor(p.target), fileName(p.target), fullText(p));
      if (how === 'downloaded') {
        await navigator.clipboard?.writeText(fullText(p)).catch(() => {});
        setToast(t('Image téléchargée, texte copié : collez-les dans WhatsApp', 'تم تحميل الصورة ونسخ النص: ألصقهما في واتساب', 'Image downloaded, text copied'));
      }
    });

  // ---------- Affichage ----------
  const card = 'bg-white rounded-3xl p-5 border border-[#f0e4e2] shadow-xs space-y-4';
  const input = 'w-full p-2.5 rounded-xl bg-[#fff8f7] border border-[#f0e4e2] text-sm focus:outline-none focus:border-[#ff6f61]';
  const label = 'text-[11px] font-bold text-[#7a5c58]';
  const ratio = activeSpec.size[1] / activeSpec.size[0];
  const previewMax = ratio > 1.5 ? 300 : ratio > 1.1 ? 380 : 520;
  const slot = (i: number, big = false) => {
    const p = photos[i];
    if (!p)
      return (
        <button
          key={`empty-${i}`}
          onClick={() => inputRef.current?.click()}
          className={`${big ? 'col-span-3 aspect-[16/10]' : 'aspect-square'} rounded-2xl border-2 border-dashed border-[#ffb4aa] bg-[#fff8f7] hover:bg-[#fff0ed] flex flex-col items-center justify-center gap-1 text-[#ff6f61] cursor-pointer`}
        >
          {big ? <ImagePlus className="w-8 h-8" /> : <Plus className="w-5 h-5" />}
          <span className={`${big ? 'text-sm' : 'text-[10px]'} font-extrabold`}>
            {big ? t('Photo principale', 'الصورة الرئيسية', 'Main photo') : t('Photo', 'صورة', 'Photo')}
          </span>
        </button>
      );
    return (
      <div key={p.id} className={`${big ? 'col-span-3 aspect-[16/10]' : 'aspect-square'} relative rounded-2xl overflow-hidden group`}>
        <img src={p.url} alt="" className="w-full h-full object-cover" />
        <button onClick={() => removePhoto(p.id)} className="absolute top-2 end-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center cursor-pointer">
          <X className="w-4 h-4" />
        </button>
        {big ? (
          <span className="absolute bottom-2 start-2 px-2 py-0.5 rounded-lg bg-[#ff6f61] text-white text-[10px] font-black">{t('Principale', 'رئيسية', 'Main')}</span>
        ) : (
          <button onClick={() => makeMain(p.id)} title={t('Mettre en principale', 'اجعلها الرئيسية', 'Make main')} className="absolute bottom-1.5 start-1.5 w-7 h-7 rounded-full bg-white/90 text-amber-500 flex items-center justify-center cursor-pointer">
            <Star className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[#ff6f61] text-xs font-black">
            <Rocket className="w-4 h-4" /> {t('Studio de publication', 'استوديو النشر', 'Publishing studio')}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#281715]">
            {t('Une annonce, toutes vos plateformes', 'إعلان واحد، كل منصاتك', 'One ad, all your platforms')}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
          <span className={`px-2.5 py-1 rounded-full ${status?.metricool ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {status?.metricool ? '✓' : '✗'} Metricool
          </span>
          <span className={`px-2.5 py-1 rounded-full ${status?.ai ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {status?.ai ? '✓' : '✗'} {t('IA', 'الذكاء الاصطناعي', 'AI')}
          </span>
          {user && <SignOutButton user={user} />}
        </div>
      </div>

      {needsLogin && <LoginCard title={t('Connexion du gérant', 'دخول المدير', 'Manager sign-in')} />}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_440px] gap-6 items-start">
        <div className="space-y-5">
          {/* ---------- Photos ---------- */}
          <section
            className={card}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              addPhotos(e.dataTransfer.files);
            }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold">{t('1. Photos du bien', '1. صور العقار', '1. Property photos')}</h2>
              <span className="text-[11px] font-bold text-[#99807d]">{photos.length}/4</span>
            </div>
            <div className="grid grid-cols-3 gap-2">{[0, 1, 2, 3].map((i) => slot(i, i === 0))}</div>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                addPhotos(e.target.files);
                e.target.value = '';
              }}
            />
          </section>

          {/* ---------- Informations ---------- */}
          <section className={card}>
            <h2 className="text-sm font-extrabold">{t('2. Informations du bien', '2. معلومات العقار', '2. Property details')}</h2>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(DEAL_LABELS) as ListingType[]).map((k) => (
                <button
                  key={k}
                  onClick={() => set('deal', k)}
                  className={`py-2.5 rounded-xl text-sm font-black border cursor-pointer ${data.deal === k ? 'bg-[#ff6f61] text-white border-transparent' : 'border-[#f0e4e2] text-[#5a4340]'}`}
                >
                  {isAr ? DEAL_LABELS[k].ar : DEAL_LABELS[k].fr}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(TYPE_LABELS) as PropertyType[]).map((k) => (
                <button
                  key={k}
                  onClick={() => set('type', k)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border cursor-pointer ${data.type === k ? 'bg-[#281715] text-white border-transparent' : 'border-[#f0e4e2] text-[#5a4340]'}`}
                >
                  {isAr ? TYPE_LABELS[k].ar : TYPE_LABELS[k].fr}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <label className="space-y-1">
                <span className={label}>{t('Quartier', 'الحي', 'District')}</span>
                <input value={data.district} onChange={(e) => set('district', e.target.value)} placeholder="حمرية" className={input} />
              </label>
              <label className="space-y-1">
                <span className={label}>{t('Ville', 'المدينة', 'City')}</span>
                <input value={data.city} onChange={(e) => set('city', e.target.value)} className={input} />
              </label>
              <label className="space-y-1 col-span-2 sm:col-span-1">
                <span className={label}>{t('Prix', 'الثمن', 'Price')}</span>
                <input value={data.price} onChange={(e) => set('price', e.target.value)} placeholder="950 000 DH" className={`${input} font-bold`} />
              </label>
              <label className="space-y-1">
                <span className={label}>{t('Surface (m²)', 'المساحة (م²)', 'Area (m²)')}</span>
                <input type="number" min={0} inputMode="numeric" value={data.surface || ''} onChange={(e) => set('surface', Number(e.target.value) || 0)} className={input} />
              </label>
              <label className="space-y-1">
                <span className={label}>{t('Chambres', 'الغرف', 'Bedrooms')}</span>
                <input type="number" min={0} inputMode="numeric" value={data.bedrooms || ''} onChange={(e) => set('bedrooms', Number(e.target.value) || 0)} className={input} />
              </label>
              <label className="space-y-1">
                <span className={label}>{t('Salles de bain', 'الحمامات', 'Bathrooms')}</span>
                <input type="number" min={0} inputMode="numeric" value={data.bathrooms || ''} onChange={(e) => set('bathrooms', Number(e.target.value) || 0)} className={input} />
              </label>
            </div>
            <div className="space-y-2">
              <span className={label}>{t('Atouts (affichés sur l’image)', 'المميزات (تظهر في الصورة)', 'Highlights (shown on the image)')}</span>
              <div className="flex flex-wrap gap-1.5">
                {[...FEATURES, ...data.features.filter((f) => !FEATURES.includes(f))].map((f) => {
                  const on = data.features.includes(f);
                  return (
                    <button
                      key={f}
                      onClick={() => toggleFeature(f)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border cursor-pointer flex items-center gap-1 ${on ? 'bg-[#fff0ed] text-[#ff6f61] border-[#ffb4aa]' : 'border-[#f0e4e2] text-[#7a5c58]'}`}
                    >
                      {on && <Check className="w-3 h-3" />} {f}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <input
                  value={customFeature}
                  onChange={(e) => setCustomFeature(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addCustomFeature()}
                  placeholder={t('Autre atout…', 'ميزة أخرى…', 'Other highlight…')}
                  className={input}
                />
                <button onClick={addCustomFeature} className="px-3 rounded-xl bg-[#281715] text-white cursor-pointer" aria-label="+">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
            <label className="block space-y-1">
              <span className={label}>{t('Notes pour le texte (non affichées sur l’image)', 'ملاحظات للنص (لا تظهر في الصورة)', 'Notes for the text (not on the image)')}</span>
              <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={input} />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <span className={label}>{t('Langue du texte', 'لغة النص', 'Text language')}</span>
              {STUDIO_LANGUAGES.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setLang(l.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border cursor-pointer ${lang === l.id ? 'bg-[#281715] text-white border-transparent' : 'border-[#f0e4e2] text-[#5a4340]'}`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </section>

          {/* ---------- Plateformes ---------- */}
          <section className={card}>
            <h2 className="text-sm font-extrabold">{t('3. Où publier ?', '3. أين تنشر؟', '3. Where to publish?')}</h2>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
              {TARGETS.map((p) => {
                const on = selected.includes(p.id);
                return (
                  <button key={p.id} onClick={() => toggleTarget(p.id)} className="flex flex-col items-center gap-1.5 cursor-pointer group" aria-pressed={on}>
                    <span
                      className={`relative w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${on ? 'text-white shadow-lg scale-105' : 'bg-[#f6efee] text-[#b9a8a5] group-hover:text-[#7a5c58]'}`}
                      style={on ? { background: p.bg || p.color } : undefined}
                    >
                      <BrandLogo path={p.path} className="w-7 h-7" />
                      {on && (
                        <span className="absolute -top-1.5 -end-1.5 w-5 h-5 rounded-full bg-[#ff6f61] border-2 border-white flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" strokeWidth={4} />
                        </span>
                      )}
                    </span>
                    <span className={`text-[10px] font-bold leading-tight text-center ${on ? 'text-[#281715]' : 'text-[#99807d]'}`}>{p.label}</span>
                    <span className="text-[9px] font-semibold text-[#b9a8a5] -mt-1" dir="ltr">{p.format}</span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* ---------- Aperçu en direct ---------- */}
        <aside className="lg:sticky lg:top-24 space-y-4">
          <div className="bg-[#281715] rounded-3xl p-4 space-y-3">
            <div className="flex items-center justify-between text-white">
              <span className="text-xs font-black">{t('Aperçu en direct', 'معاينة مباشرة', 'Live preview')}</span>
              <span className="text-[10px] font-bold text-white/60" dir="ltr">
                {activeSpec.label} · {activeSpec.size[0]}×{activeSpec.size[1]}
              </span>
            </div>
            {selected.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                {selected.map((id) => {
                  const p = target(id);
                  return (
                    <button
                      key={id}
                      onClick={() => setActive(id)}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer transition-all ${activeSpec.id === id ? 'bg-white text-[#281715]' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
                      title={p.label}
                    >
                      <BrandLogo path={p.path} className="w-4.5 h-4.5" />
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex justify-center">
              <canvas ref={previewRef} className="w-full h-auto rounded-2xl shadow-2xl" style={{ maxWidth: previewMax }} />
            </div>
            <button onClick={downloadAll} disabled={!!busy || !selected.length} className="w-full py-2.5 rounded-xl bg-white/10 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
              {busy === 'download' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {t('Télécharger les images', 'تحميل الصور بكل المقاسات', 'Download all sizes')}
            </button>
          </div>

          <div className="bg-white rounded-3xl p-4 border border-[#f0e4e2] space-y-3">
            <div className="flex flex-wrap items-center gap-3 text-sm font-bold">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={when === 'now'} onChange={() => setWhen('now')} /> {t('Maintenant', 'الآن', 'Now')}
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={when === 'later'} onChange={() => setWhen('later')} /> {t('Programmer', 'برمجة', 'Schedule')}
              </label>
            </div>
            {when === 'later' && (
              <input type="datetime-local" value={dateTime} onChange={(e) => setDateTime(e.target.value)} className={input} dir="ltr" />
            )}
            <button
              onClick={handlePrepare}
              disabled={!selected.length || !!busy}
              className="w-full py-4 rounded-2xl bg-[#ff6f61] text-white font-black flex items-center justify-center gap-2 shadow-lg shadow-[#ff6f61]/30 disabled:opacity-50 cursor-pointer"
            >
              {busy === 'prepare' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
              {busy === 'prepare'
                ? t('Préparation…', 'جاري التحضير…', 'Preparing…')
                : t(`Préparer ${selected.length} publications`, `جهّز ${selected.length} منشورات`, `Prepare ${selected.length} posts`)}
            </button>
          </div>
        </aside>
      </div>

      {/* ---------- Vérification et publication ---------- */}
      {posts.length > 0 && (
        <section ref={reviewRef} className="space-y-4 scroll-mt-24">
          <h2 className="text-lg font-black">{t('4. Vérifiez, puis publiez', '4. راجع ثم انشر', '4. Review, then publish')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {posts.map((p) => {
              const spec = target(p.target);
              const max = p.target === 'whatsapp' ? 4000 : STUDIO_PLATFORMS.find((x) => x.id === p.target)!.maxChars;
              const len = fullText(p).length;
              return (
                <div key={p.target} className="bg-white rounded-3xl p-4 border border-[#f0e4e2] flex gap-4">
                  <img src={thumbs[p.target]} alt="" className="w-28 sm:w-32 self-start rounded-xl shadow-md" />
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="w-7 h-7 rounded-lg flex items-center justify-center text-white" style={{ background: spec.bg || spec.color }}>
                        <BrandLogo path={spec.path} className="w-4 h-4" />
                      </span>
                      <span className="font-black">{spec.label}</span>
                      <span className="text-[10px] text-[#99807d]" dir="ltr">{spec.size.join('×')}</span>
                      {p.status === 'envoi' && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#ff6f61]" />}
                      {(p.status === 'programmé' || p.status === 'publié') && (
                        <span className="text-green-700 font-bold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          {p.status === 'publié' ? t('Publié', 'تم النشر', 'Published') : `${t('Programmé', 'مبرمج', 'Scheduled')} ${p.scheduledFor?.replace('T', ' ').slice(0, 16) ?? ''}`}
                        </span>
                      )}
                      <span className={`ms-auto text-[10px] font-bold ${len > max ? 'text-red-600' : 'text-[#99807d]'}`}>{len}/{max}</span>
                    </div>
                    {(p.target === 'youtube' || p.target === 'tiktok') && (
                      <input value={p.title} onChange={(e) => updatePost(p.target, { title: e.target.value })} placeholder={t('Titre', 'العنوان', 'Title')} className={`${input} font-bold`} />
                    )}
                    <textarea rows={5} value={p.text} onChange={(e) => updatePost(p.target, { text: e.target.value })} className={`${input} text-xs`} />
                    {p.hashtags.length > 0 && (
                      <input
                        value={p.hashtags.join(' ')}
                        onChange={(e) => updatePost(p.target, { hashtags: e.target.value.split(/\s+/).filter(Boolean) })}
                        className={`${input} text-xs text-[#ff6f61] font-semibold`}
                        dir="auto"
                      />
                    )}
                    {p.target === 'youtube' && (
                      <p className="text-[10px] text-[#99807d]">{t('YouTube : l’image devient une vidéo Short de 8 s.', 'يوتيوب: تتحول الصورة إلى فيديو قصير (8 ثوانٍ) تلقائياً.', 'YouTube: the image becomes an 8 s Short.')}</p>
                    )}
                    {p.target === 'whatsapp' && (
                      <button onClick={() => handleShare(p)} disabled={!!busy} className="w-full py-2.5 rounded-xl bg-[#25d366] text-white text-xs font-black flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
                        {busy === `share-${p.target}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
                        {t('Partager sur WhatsApp', 'شارك في واتساب (حالة أو مجموعات)', 'Share on WhatsApp')}
                      </button>
                    )}
                    {p.error && <p className="text-xs text-red-600 font-bold">{p.error}</p>}
                  </div>
                </div>
              );
            })}
          </div>

          {!viaMetricool && (
            <p className="text-xs text-amber-700 font-semibold">
              {t(
                'Metricool n’est pas relié : seuls Facebook et Instagram (si Meta est configuré) peuvent être publiés maintenant. Pour les autres, téléchargez les images.',
                'Metricool غير مربوط: يمكن النشر الآن على فيسبوك وإنستغرام فقط (إذا كان ربط Meta مفعّلاً). للمنصات الأخرى حمّل الصور وانشرها يدوياً.',
                'Metricool not linked: only Facebook and Instagram (if Meta is set up) can be published now. Download the images for the others.'
              )}
            </p>
          )}
          {toPublish.length > 0 && (
            <button
              onClick={handlePublish}
              disabled={!canPublish || !!busy}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-green-600 text-white font-black flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 cursor-pointer"
            >
              {busy === 'publish' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              {busy === 'publish'
                ? t('Envoi…', 'جاري الإرسال…', 'Sending…')
                : when === 'now'
                ? t(`Publier sur ${toPublish.length} plateformes`, `انشر على ${toPublish.length} منصات`, `Publish to ${toPublish.length} platforms`)
                : t(`Programmer ${toPublish.length} publications`, `برمج ${toPublish.length} منشورات`, `Schedule ${toPublish.length} posts`)}
            </button>
          )}
        </section>
      )}

      {toast && <div className="fixed top-24 inset-x-0 mx-auto w-fit max-w-[90vw] bg-[#281715] text-white text-sm font-bold px-5 py-3 rounded-2xl shadow-xl z-50">{toast}</div>}
    </div>
  );
};
