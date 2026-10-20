import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, ChevronLeft, ChevronsUp, Download, LayoutTemplate, Loader2, Pencil, Plus, Send, Share2, Sparkles, Star, X } from 'lucide-react';
import { siFacebook, siInstagram, siThreads, siTiktok, siX, siYoutube } from 'simple-icons';
import { PropertyType } from '../types';
import { ServerStatus, fetchServerStatus } from '../services/adsApi';
import { isFirebaseEnabled } from '../services/firebase';
import { DEAL_LABELS, FEATURES, PosterData, PosterDeal, TYPE_LABELS, drawPoster, ensureFonts, headlineOf } from '../services/posterMaker';
import { BUILTIN_TEMPLATES, CustomTemplate, DEFAULT_TEMPLATE, PosterTemplate, templateBlob, templateVideo } from '../services/posterTemplates';
import { deleteTemplate, listTemplates, saveTemplate } from '../services/templateStore';
import { loadImageTemplates } from '../services/imageTemplates';
import { StudioNetwork, studioSpec } from '../services/studioPlatforms';
import {
  StudioPhoto,
  StudioPost,
  StudioTarget,
  downloadFile,
  fullText,
  generatePosts,
  isNetwork,
  loadPhoto,
  publishMetaDirect,
  schedulePost,
  shareImage,
  uploadMedia,
} from '../services/studioApi';
import { LoginCard, SignOutButton, useAuthUser } from './AuthGate';
import { TemplateEditor } from './TemplateEditor';
import { TemplatePicker } from './TemplatePicker';

// « صانع الإعلانات » : une case photos (5 au maximum), une case informations, les plateformes avec
// le modèle choisi pour chacune, puis un bouton → une affiche par plateforme, à sa taille.

type Target = Extract<StudioTarget, 'facebook' | 'instagram' | 'tiktok' | 'youtube' | 'upscrolled' | 'linkedin' | 'twitter' | 'threads'>;

interface TargetSpec {
  id: Target;
  label: string;
  logo: React.ReactNode;
  bg: string;
  size: [number, number];
}

const svg = (path: string) => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor" aria-hidden="true">
    <path d={path} />
  </svg>
);
const net = (id: StudioNetwork) => studioSpec(id);

const TARGETS: TargetSpec[] = [
  { id: 'facebook', label: 'Facebook', logo: svg(siFacebook.path), bg: '#0866ff', size: net('facebook').size },
  { id: 'instagram', label: 'Instagram', logo: svg(siInstagram.path), bg: 'linear-gradient(45deg,#feda75,#fa7e1e,#d62976,#962fbf,#4f5bd5)', size: net('instagram').size },
  { id: 'tiktok', label: 'TikTok', logo: svg(siTiktok.path), bg: '#111111', size: net('tiktok').size },
  { id: 'youtube', label: 'YouTube', logo: svg(siYoutube.path), bg: '#ff0000', size: net('youtube').size },
  // UpScrolled : pas d'API de publication → partage depuis le téléphone.
  { id: 'upscrolled', label: 'UpScrolled', logo: <ChevronsUp className="w-7 h-7" strokeWidth={3} />, bg: 'linear-gradient(135deg,#00c2a8,#0a6cff)', size: [1080, 1350] },
  { id: 'linkedin', label: 'LinkedIn', logo: <span className="font-black text-xl leading-none">in</span>, bg: '#0a66c2', size: net('linkedin').size },
  { id: 'twitter', label: 'X', logo: svg(siX.path), bg: '#000000', size: net('twitter').size },
  { id: 'threads', label: 'Threads', logo: svg(siThreads.path), bg: '#111111', size: net('threads').size },
];
const target = (id: StudioTarget) => TARGETS.find((x) => x.id === id)!;

const MAX_PHOTOS = 5;
const FEATURE_TITLES = FEATURES.map((f) => f.title);
const PREFS_KEY = 'studio.platforms'; // plateformes cochées + modèle de chacune (sur cet appareil)

const EMPTY: PosterData = {
  deal: 'vente', type: 'Appartement', headline: '', city: 'مكناس', district: '', surface: 0, surfaceMax: 0, bedrooms: 0, bathrooms: 0, price: '', features: [],
};

interface Prefs {
  selected: Target[];
  templates: Partial<Record<Target, string>>;
}

function readPrefs(): Prefs {
  const fallback: Prefs = { selected: ['facebook', 'instagram', 'tiktok'], templates: {} };
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) || 'null');
    if (!p || !Array.isArray(p.selected)) return fallback;
    return { selected: p.selected.filter((t: Target) => TARGETS.some((x) => x.id === t)), templates: p.templates || {} };
  } catch {
    return fallback;
  }
}

// Modèle du gérant prêt à dessiner : son image de fond chargée.
function toTemplate(tpl: CustomTemplate): Promise<PosterTemplate | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ kind: 'custom', id: tpl.id, name: tpl.name, tpl, bgImg: img });
    img.onerror = () => resolve(null);
    img.src = URL.createObjectURL(tpl.bg);
  });
}

interface Poster {
  target: Target;
  blob: Blob;
  url: string;
}

const RED = 'bg-[#e3131b]';

export const PublishStudioView: React.FC = () => {
  const user = useAuthUser();
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [photos, setPhotos] = useState<StudioPhoto[]>([]);
  const [data, setData] = useState<PosterData>(EMPTY);
  const [customFeature, setCustomFeature] = useState('');
  const [prefs, setPrefs] = useState<Prefs>(readPrefs);
  const [customTpls, setCustomTpls] = useState<PosterTemplate[]>([]);
  const [imageTpls, setImageTpls] = useState<PosterTemplate[]>([]); // modèles Canva intégrés
  const [pickerFor, setPickerFor] = useState<Target | null>(null);
  const [editor, setEditor] = useState<{ initial?: CustomTemplate } | null>(null);
  const [posters, setPosters] = useState<Poster[] | null>(null);
  const [when, setWhen] = useState<'now' | 'later'>('now');
  const [dateTime, setDateTime] = useState('');
  const [posts, setPosts] = useState<StudioPost[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const photosRef = useRef(photos);
  photosRef.current = photos;
  const postersRef = useRef(posters);
  postersRef.current = posters;

  useEffect(() => {
    fetchServerStatus().then(setStatus);
  }, [user]);
  useEffect(
    () => () => {
      photosRef.current.forEach((p) => URL.revokeObjectURL(p.url));
      postersRef.current?.forEach((p) => URL.revokeObjectURL(p.url));
    },
    []
  );
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      // stockage indisponible : les choix valent pour cette visite
    }
  }, [prefs]);

  const imgs = useMemo(() => photos.map((p) => p.img), [photos]);
  const selected = TARGETS.filter((t) => prefs.selected.includes(t.id)).map((t) => t.id);

  // ---------- Modèles ----------
  const reloadTemplates = async () => {
    const list = (await Promise.all((await listTemplates()).map(toTemplate))).filter((t): t is PosterTemplate => !!t);
    setCustomTpls((prev) => {
      prev.forEach((t) => t.kind === 'custom' && t.bgImg instanceof HTMLImageElement && URL.revokeObjectURL(t.bgImg.src));
      return list;
    });
  };
  useEffect(() => {
    reloadTemplates();
    loadImageTemplates().then(setImageTpls);
  }, []);
  const templates = useMemo(() => [...imageTpls, ...BUILTIN_TEMPLATES, ...customTpls], [imageTpls, customTpls]);
  const tplOf = (id: Target) => templates.find((t) => t.id === prefs.templates[id]) ?? DEFAULT_TEMPLATE;
  const chooseTemplate = (id: Target, templateId: string) => setPrefs((p) => ({ ...p, templates: { ...p.templates, [id]: templateId } }));
  const toggleTarget = (id: Target) =>
    setPrefs((p) => ({ ...p, selected: p.selected.includes(id) ? p.selected.filter((x) => x !== id) : [...p.selected, id] }));

  const handleSaveTemplate = async (t: CustomTemplate) => {
    await saveTemplate(t);
    await reloadTemplates();
    if (pickerFor) chooseTemplate(pickerFor, t.id);
    setEditor(null);
    setToast('تم حفظ القالب');
  };
  const handleDeleteTemplate = async (t: PosterTemplate) => {
    if (t.kind !== 'custom' || !window.confirm(`حذف القالب «${t.name}»؟`)) return;
    await deleteTemplate(t.id);
    await reloadTemplates();
    setPrefs((p) => ({ ...p, templates: Object.fromEntries(Object.entries(p.templates).filter(([, v]) => v !== t.id)) }));
  };

  // ---------- Photos ----------
  const addPhotos = async (list: FileList | null) => {
    if (!list) return;
    const room = MAX_PHOTOS - photos.length;
    const files = Array.from(list).filter((f) => f.type.startsWith('image/')).slice(0, Math.max(0, room));
    if (Array.from(list).length > room) setToast(`أقصى عدد ${MAX_PHOTOS} صور`);
    const loaded = (await Promise.all(files.map((f) => loadPhoto(f).catch(() => null)))).filter((p): p is StudioPhoto => !!p);
    setPhotos((prev) => [...prev, ...loaded].slice(0, MAX_PHOTOS));
  };
  const removePhoto = (id: string) => {
    const p = photos.find((x) => x.id === id);
    if (p) URL.revokeObjectURL(p.url);
    setPhotos((prev) => prev.filter((x) => x.id !== id));
  };
  const makeMain = (id: string) => setPhotos((prev) => [...prev.filter((x) => x.id === id), ...prev.filter((x) => x.id !== id)]);

  // ---------- Informations ----------
  const set = <K extends keyof PosterData>(k: K, v: PosterData[K]) => setData((prev) => ({ ...prev, [k]: v }));
  const toggleFeature = (f: string) => {
    if (data.features.includes(f)) return set('features', data.features.filter((x) => x !== f));
    set('features', [...data.features, f]);
  };
  const addCustomFeature = () => {
    const f = customFeature.trim();
    if (f && !data.features.includes(f)) toggleFeature(f);
    setCustomFeature('');
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

  // ---------- Le bouton : une affiche par plateforme, avec son modèle et à sa taille ----------
  const handleMake = () =>
    run('make', async () => {
      if (!photos.length) throw new Error('أضف صورة واحدة على الأقل');
      if (!selected.length) throw new Error('اختر منصة واحدة على الأقل');
      const cache = new Map<string, Blob>(); // même modèle + même taille = même image
      const out: Poster[] = [];
      for (const id of selected) {
        const t = target(id);
        const tpl = tplOf(id);
        const key = `${tpl.id}|${t.size.join('x')}`;
        if (!cache.has(key)) cache.set(key, await templateBlob(data, imgs, ...t.size, tpl));
        const blob = cache.get(key)!;
        out.push({ target: id, blob, url: URL.createObjectURL(blob) });
      }
      posters?.forEach((p) => URL.revokeObjectURL(p.url));
      setPosters(out);
      setPosts([]);
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

  const backToForm = () => {
    posters?.forEach((p) => URL.revokeObjectURL(p.url));
    setPosters(null);
    setPosts([]);
  };

  // Nom en lettres latines : les navigateurs ignorent souvent les noms de fichier en arabe.
  const fileName = (id: Target, ext = 'jpg') => `alwasset777-${id}-${target(id).size.join('x')}.${ext}`;
  const posterOf = (id: StudioTarget) => posters?.find((p) => p.target === id);

  const sharePoster = (p: Poster, text = headlineOf(data)) =>
    run(`share-${p.target}`, async () => {
      const how = await shareImage(p.blob, fileName(p.target), text);
      if (how === 'downloaded') {
        await navigator.clipboard?.writeText(text).catch(() => {});
        setToast('تم تحميل الصورة ونسخ النص');
      }
    });

  const downloadAll = () =>
    run('download', async () => {
      for (const p of posters ?? []) {
        downloadFile(p.blob, fileName(p.target));
        await new Promise((r) => setTimeout(r, 400));
      }
    });

  // ---------- Publication sur les plateformes ----------
  const viaMetricool = !!status?.metricool;
  const metaDirect = (id: StudioTarget) => !viaMetricool && when === 'now' && (id === 'facebook' || id === 'instagram') && !!status?.meta[id];
  const toPublish = posts.filter((p) => isNetwork(p.target) && p.status !== 'programmé' && p.status !== 'publié');
  const needsLogin = isFirebaseEnabled && user === null;
  const canPublish = !!user && isFirebaseEnabled && toPublish.length > 0 && (viaMetricool || toPublish.some((p) => metaDirect(p.target)));

  const updatePost = (id: StudioTarget, patch: Partial<StudioPost>) =>
    setPosts((prev) => prev.map((p) => (p.target === id ? { ...p, ...patch } : p)));

  const handlePrepare = () =>
    run('prepare', async () => {
      const created = await generatePosts(photos, data, '', selected, 'ar+fr');
      setPosts(created);
      if (created.every((p) => p.source === 'modèle')) setToast('تم استعمال نصوص المكتب الجاهزة (الذكاء الاصطناعي غير متوفر)');
    });

  const handlePublish = () =>
    run('publish', async () => {
      if (when === 'later' && !dateTime) throw new Error('اختر التاريخ والساعة');
      const batch = `${Date.now()}`;
      let ok = 0;
      for (const p of toPublish) {
        const id = p.target as StudioNetwork & Target;
        const poster = posterOf(id);
        updatePost(id, { status: 'envoi', error: undefined });
        try {
          if (!poster) throw new Error('الصورة غير موجودة');
          if (!viaMetricool && !metaDirect(id)) throw new Error('يحتاج ربط Metricool');
          const imageUrl = await uploadMedia(batch, poster.blob, fileName(id));
          if (!viaMetricool) {
            await publishMetaDirect(id as 'facebook' | 'instagram', fullText(p), imageUrl);
            updatePost(id, { status: 'publié' });
          } else {
            // YouTube n'accepte que la vidéo : l'affiche devient un Short de 8 secondes.
            const size = target(id).size;
            const video = id === 'youtube' ? await uploadMedia(batch, await templateVideo(data, imgs, ...size, tplOf(id)), fileName(id, 'mp4')) : undefined;
            const r = await schedulePost({
              network: id,
              text: fullText(p),
              title: p.title || undefined,
              images: [imageUrl],
              video,
              vertical: size[1] > size[0],
              dateTime: when === 'later' ? dateTime : undefined,
            });
            updatePost(id, { status: 'programmé', scheduledFor: r.dateTime });
          }
          ok++;
        } catch (e) {
          updatePost(id, { status: 'erreur', error: (e as Error).message });
        }
      }
      setToast(`تم إرسال ${ok} من ${toPublish.length} منشورات`);
    });

  // ---------- Affichage ----------
  const card = 'bg-white rounded-3xl p-4 sm:p-5 border border-[#ececec] shadow-sm space-y-4';
  const input = 'w-full p-3 rounded-2xl bg-[#f6f6f6] border border-[#ececec] text-base focus:outline-none focus:border-[#e3131b]';
  const label = 'text-xs font-bold text-[#5f5f5f]';
  const chip = (on: boolean) =>
    `px-3.5 py-2 rounded-full text-sm font-bold border cursor-pointer transition-colors ${on ? 'bg-[#121212] text-white border-transparent' : 'border-[#e5e5e5] text-[#333] bg-white'}`;

  const Logo: React.FC<{ t: TargetSpec; on?: boolean; small?: boolean }> = ({ t, on = true, small }) => (
    <span
      className={`${small ? 'w-8 h-8 rounded-lg' : 'w-12 h-12 rounded-2xl'} shrink-0 flex items-center justify-center ${on ? 'text-white' : 'bg-[#f1f1f1] text-[#b5b5b5]'}`}
      style={on ? { background: t.bg } : undefined}
    >
      {t.logo}
    </span>
  );

  const numberField = (k: 'surface' | 'bedrooms' | 'bathrooms', text: string) => (
    <label className="block space-y-1">
      <span className={label}>{text}</span>
      <input type="number" min={0} inputMode="numeric" value={data[k] || ''} onChange={(e) => set(k, Number(e.target.value) || 0)} className={input} />
    </label>
  );

  const picking = pickerFor ? target(pickerFor) : null;

  return (
    <div ref={topRef} dir="rtl" className="font-tajawal max-w-2xl mx-auto space-y-5 pb-28 scroll-mt-24">
      {posters ? (
        <>
          {/* ================= Résultat : une affiche par plateforme ================= */}
          <section className={card}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-black">الإعلانات جاهزة ({posters.length})</h2>
              <button onClick={backToForm} className="px-3 py-2 rounded-xl bg-[#f1f1f1] text-sm font-bold flex items-center gap-1 cursor-pointer">
                <Pencil className="w-4 h-4" /> تعديل
              </button>
            </div>
            <button onClick={downloadAll} disabled={!!busy} className="w-full py-3 rounded-2xl bg-[#121212] text-white font-black flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
              {busy === 'download' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />} تحميل الكل
            </button>
          </section>

          {posters.map((p) => {
            const t = target(p.target);
            return (
              <section key={p.target} className={card}>
                <div className="flex items-center gap-2">
                  <Logo t={t} small />
                  <span className="font-black">{t.label}</span>
                  <span className="text-xs text-[#999] font-bold" dir="ltr">
                    {t.size.join('×')}
                  </span>
                  <span className="text-xs text-[#999] font-bold mr-auto">{tplOf(p.target).name}</span>
                </div>
                <img src={p.url} alt={`الإعلان ${t.label}`} className="w-full rounded-2xl shadow-lg" />
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => downloadFile(p.blob, fileName(p.target))} className="py-3 rounded-2xl bg-[#121212] text-white font-black flex items-center justify-center gap-2 cursor-pointer">
                    <Download className="w-5 h-5" /> تحميل
                  </button>
                  <button
                    onClick={() => sharePoster(p)}
                    disabled={!!busy}
                    className="py-3 rounded-2xl bg-[#25d366] text-white font-black flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {busy === `share-${p.target}` ? <Loader2 className="w-5 h-5 animate-spin" /> : <Share2 className="w-5 h-5" />} مشاركة
                  </button>
                </div>
              </section>
            );
          })}

          {/* ---------- Publication ---------- */}
          <section className={card}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black">النشر</h2>
              {user && <SignOutButton user={user} />}
            </div>
            {needsLogin && <LoginCard title="دخول المدير للنشر" />}

            {!posts.length ? (
              <button onClick={handlePrepare} disabled={!!busy} className="w-full py-3.5 rounded-2xl bg-[#121212] text-white font-black flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
                {busy === 'prepare' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                {busy === 'prepare' ? 'جاري كتابة النصوص…' : `اكتب نصوص المنشورات (${selected.length})`}
              </button>
            ) : (
              <div className="space-y-3">
                {posts.map((p) => {
                  const t = target(p.target);
                  const poster = posterOf(p.target);
                  return (
                    <div key={p.target} className="rounded-2xl border border-[#ececec] p-3 space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Logo t={t} small />
                        <span className="font-black">{t.label}</span>
                        {p.status === 'envoi' && <Loader2 className="w-4 h-4 animate-spin text-[#e3131b]" />}
                        {(p.status === 'programmé' || p.status === 'publié') && (
                          <span className="text-green-700 font-bold flex items-center gap-1 text-xs">
                            <Check className="w-3.5 h-3.5" />
                            {p.status === 'publié' ? 'تم النشر' : `مبرمج ${p.scheduledFor?.replace('T', ' ').slice(0, 16) ?? ''}`}
                          </span>
                        )}
                      </div>
                      {(p.target === 'youtube' || p.target === 'tiktok') && (
                        <input value={p.title} onChange={(e) => updatePost(p.target, { title: e.target.value })} placeholder="العنوان" className={`${input} text-sm font-bold`} />
                      )}
                      <textarea rows={4} value={fullText(p)} onChange={(e) => updatePost(p.target, { text: e.target.value, hashtags: [] })} className={`${input} text-sm`} />
                      {!isNetwork(p.target) && poster && (
                        <button
                          onClick={() => sharePoster(poster, fullText(p))}
                          disabled={!!busy}
                          className="w-full py-2.5 rounded-xl text-white text-sm font-black flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                          style={{ background: t.bg }}
                        >
                          <Share2 className="w-4 h-4" /> شارك في {t.label} من الهاتف
                        </button>
                      )}
                      {p.error && <p className="text-xs text-red-600 font-bold">{p.error}</p>}
                    </div>
                  );
                })}
                {toPublish.length > 0 && (
                  <>
                    <div className="flex flex-wrap items-center gap-4 text-sm font-bold">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" checked={when === 'now'} onChange={() => setWhen('now')} /> الآن
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" checked={when === 'later'} onChange={() => setWhen('later')} /> برمجة
                      </label>
                      {when === 'later' && <input type="datetime-local" value={dateTime} onChange={(e) => setDateTime(e.target.value)} className={`${input} text-sm`} dir="ltr" />}
                    </div>
                    {!viaMetricool && (
                      <p className="text-xs text-amber-700 font-semibold">
                        Metricool غير مربوط: النشر الآن ممكن على فيسبوك وإنستغرام فقط (إذا كان ربط Meta مفعّلاً). للمنصات الأخرى حمّل الصور وانشرها يدوياً.
                      </p>
                    )}
                    <button onClick={handlePublish} disabled={!canPublish || !!busy} className="w-full py-4 rounded-2xl bg-green-600 text-white font-black flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
                      {busy === 'publish' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                      {busy === 'publish' ? 'جاري الإرسال…' : when === 'now' ? `انشر على ${toPublish.length} منصات` : `برمج ${toPublish.length} منشورات`}
                    </button>
                  </>
                )}
              </div>
            )}
          </section>
        </>
      ) : (
        <>
          {/* ================= 1. Photos : un seul carré d'ajout ================= */}
          <section
            className={card}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              addPhotos(e.dataTransfer.files);
            }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black">صور العقار</h2>
              <span className="text-xs font-bold text-[#999]">
                {photos.length}/{MAX_PHOTOS}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {photos.map((p, i) => (
                <div key={p.id} className="aspect-square relative rounded-2xl overflow-hidden">
                  <img src={p.url} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => removePhoto(p.id)} aria-label="حذف" className="absolute top-1.5 left-1.5 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                  {i === 0 ? (
                    <span className={`absolute bottom-1.5 right-1.5 px-2 py-0.5 rounded-lg ${RED} text-white text-[11px] font-black`}>الرئيسية</span>
                  ) : (
                    <button onClick={() => makeMain(p.id)} aria-label="اجعلها الرئيسية" className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full bg-white/90 text-amber-500 flex items-center justify-center cursor-pointer">
                      <Star className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <button
                  onClick={() => inputRef.current?.click()}
                  className="aspect-square rounded-2xl border-2 border-dashed border-[#f3a3a6] bg-[#fff5f5] flex flex-col items-center justify-center gap-1 text-[#e3131b] cursor-pointer"
                >
                  <Plus className="w-8 h-8" />
                  <span className="text-sm font-extrabold">{photos.length ? 'صورة أخرى' : 'أضف الصور'}</span>
                </button>
              )}
            </div>
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

          {/* ================= 2. Informations ================= */}
          <section className={card}>
            <h2 className="text-lg font-black">معلومات العقار</h2>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(DEAL_LABELS) as PosterDeal[]).map((k) => (
                <button
                  key={k}
                  onClick={() => set('deal', k)}
                  className={`py-3 rounded-2xl text-base font-black border cursor-pointer ${data.deal === k ? `${RED} text-white border-transparent` : 'border-[#e5e5e5] text-[#333]'}`}
                >
                  {DEAL_LABELS[k].btn}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(TYPE_LABELS) as PropertyType[]).map((k) => (
                <button key={k} onClick={() => set('type', k)} className={chip(data.type === k)}>
                  {TYPE_LABELS[k].ar}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className={label}>الحي</span>
                <input value={data.district} onChange={(e) => set('district', e.target.value)} placeholder="حمرية" className={input} />
              </label>
              <label className="space-y-1">
                <span className={label}>المدينة</span>
                <input value={data.city} onChange={(e) => set('city', e.target.value)} className={input} />
              </label>
              <label className="space-y-1 col-span-2">
                <span className={label}>الثمن (اختياري)</span>
                <input value={data.price} onChange={(e) => set('price', e.target.value)} placeholder="950 000 درهم" className={`${input} font-bold`} />
              </label>
              <div className="col-span-2">{numberField('surface', 'المساحة (م²)')}</div>
              {numberField('bedrooms', 'الغرف')}
              {numberField('bathrooms', 'الحمامات')}
            </div>
            <div className="space-y-2">
              <span className={label}>
                المميزات{data.features.length ? ` (${data.features.length})` : ''}
              </span>
              <p className="text-[11px] text-[#999] font-semibold">اختر كما تشاء: الأربع الأولى تظهر في الصورة، وكلها تُكتب في نص المنشور.</p>
              <div className="flex flex-wrap gap-2">
                {[...FEATURE_TITLES, ...data.features.filter((f) => !FEATURE_TITLES.includes(f))].map((f) => {
                  const on = data.features.includes(f);
                  return (
                    <button
                      key={f}
                      onClick={() => toggleFeature(f)}
                      className={`px-3.5 py-2 rounded-full text-sm font-bold border cursor-pointer flex items-center gap-1 ${on ? 'bg-[#fff0f0] text-[#e3131b] border-[#f3a3a6]' : 'border-[#e5e5e5] text-[#555] bg-white'}`}
                    >
                      {on && <Check className="w-3.5 h-3.5" />} {f}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <input
                  value={customFeature}
                  onChange={(e) => setCustomFeature(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addCustomFeature()}
                  placeholder="ميزة أخرى…"
                  className={input}
                />
                <button onClick={addCustomFeature} aria-label="إضافة" className="px-4 rounded-2xl bg-[#121212] text-white cursor-pointer">
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>
            <label className="block space-y-1">
              <span className={label}>العنوان الكبير (اختياري)</span>
              <input value={data.headline} onChange={(e) => set('headline', e.target.value)} placeholder={headlineOf({ ...data, headline: '' })} className={`${input} font-black`} />
            </label>
          </section>

          {/* ================= 3. Plateformes + modèle de chacune ================= */}
          <section className={card}>
            <h2 className="text-lg font-black">المنصات</h2>
            <div className="space-y-2">
              {TARGETS.map((t) => {
                const on = prefs.selected.includes(t.id);
                return (
                  <div key={t.id} className={`flex items-center gap-3 p-2 rounded-2xl border ${on ? 'border-[#f3a3a6] bg-[#fffafa]' : 'border-[#ececec]'}`}>
                    <button onClick={() => toggleTarget(t.id)} aria-pressed={on} className="relative cursor-pointer" aria-label={t.label}>
                      <Logo t={t} on={on} />
                      {on && (
                        <span className={`absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full ${RED} border-2 border-white flex items-center justify-center`}>
                          <Check className="w-3 h-3 text-white" strokeWidth={4} />
                        </span>
                      )}
                    </button>
                    <button onClick={() => toggleTarget(t.id)} className="flex-1 min-w-0 text-right cursor-pointer">
                      <span className={`block font-black ${on ? 'text-[#121212]' : 'text-[#999]'}`}>{t.label}</span>
                      <span className="block text-[11px] text-[#999] font-bold" dir="ltr" style={{ textAlign: 'right' }}>
                        {t.size.join('×')}
                      </span>
                    </button>
                    <button
                      onClick={() => setPickerFor(t.id)}
                      className="shrink-0 max-w-[45%] px-3 py-2 rounded-xl bg-[#f6f6f6] border border-[#ececec] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <LayoutTemplate className="w-4 h-4 text-[#e3131b] shrink-0" />
                      <span className="truncate">{prefs.templates[t.id] ? tplOf(t.id).name : 'اختيار القالب'}</span>
                      <ChevronLeft className="w-3.5 h-3.5 shrink-0" />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ================= 4. Le bouton ================= */}
          <div className="fixed bottom-0 inset-x-0 z-40 p-3 bg-gradient-to-t from-white via-white/95 to-transparent">
            <button
              onClick={handleMake}
              disabled={!!busy}
              className={`max-w-2xl mx-auto w-full py-4 rounded-2xl ${RED} text-white text-lg font-black flex items-center justify-center gap-2 shadow-xl shadow-red-600/30 cursor-pointer disabled:opacity-60`}
            >
              {busy === 'make' ? <Loader2 className="w-6 h-6 animate-spin" /> : <Sparkles className="w-6 h-6" />}
              {busy === 'make' ? 'جاري التصميم…' : `اصنع الإعلان${selected.length ? ` (${selected.length})` : ''}`}
              <ArrowRight className="w-5 h-5 rotate-180" />
            </button>
          </div>
        </>
      )}

      {/* ---------- Choix du modèle d'une plateforme ---------- */}
      {picking && !editor && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={() => setPickerFor(null)}>
          <div className="w-full max-w-2xl max-h-[88vh] overflow-y-auto bg-[#f6f6f6] rounded-t-3xl sm:rounded-3xl p-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 p-2">
              <Logo t={picking} small />
              <span className="font-black flex-1">
                {picking.label} <span className="text-xs text-[#999]" dir="ltr">{picking.size.join('×')}</span>
              </span>
              <button onClick={() => setPickerFor(null)} aria-label="إغلاق" className="w-9 h-9 rounded-full bg-white flex items-center justify-center cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <TemplatePicker
              title="اختيار القالب"
              aspect={picking.size[0] / picking.size[1]}
              templates={templates}
              selectedId={tplOf(picking.id).id}
              data={data}
              photos={imgs}
              onSelect={(id) => {
                chooseTemplate(picking.id, id);
                setPickerFor(null);
              }}
              onAdd={() => setEditor({})}
              onEdit={(t) => t.kind === 'custom' && setEditor({ initial: t.tpl })}
              onDelete={handleDeleteTemplate}
            />
          </div>
        </div>
      )}

      {editor && <TemplateEditor initial={editor.initial} data={data} photos={imgs} onSave={handleSaveTemplate} onClose={() => setEditor(null)} />}

      {toast && <div className="fixed top-6 inset-x-0 mx-auto w-fit max-w-[90vw] bg-[#121212] text-white text-sm font-bold px-5 py-3 rounded-2xl shadow-xl z-[60]">{toast}</div>}
    </div>
  );
};

// Pré-chargement des polices et du logo dès l'ouverture, pour que le premier rendu soit immédiat.
if (typeof window !== 'undefined') ensureFonts();
// Rendu d'aperçu utilisé par les tests visuels.
export { drawPoster };
