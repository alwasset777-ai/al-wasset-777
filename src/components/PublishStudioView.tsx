import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, Download, ImagePlus, Loader2, Pencil, Plus, Send, Share2, Sparkles, Star, X } from 'lucide-react';
import { siBluesky, siFacebook, siGoogle, siInstagram, siThreads, siTiktok, siWhatsapp, siYoutube } from 'simple-icons';
import { ListingType, PropertyType } from '../types';
import { ServerStatus, fetchServerStatus } from '../services/adsApi';
import { isFirebaseEnabled } from '../services/firebase';
import { DEAL_LABELS, FEATURES, PosterData, TYPE_LABELS, drawPoster, ensureFonts, headlineOf } from '../services/posterMaker';
import {
  BUILTIN_TEMPLATES,
  CustomTemplate,
  DEFAULT_TEMPLATE,
  PosterTemplate,
  nativeSize,
  templateBlob,
  templateVideo,
} from '../services/posterTemplates';
import { deleteTemplate, listTemplates, saveTemplate } from '../services/templateStore';
import { STUDIO_PLATFORMS, StudioNetwork } from '../services/studioPlatforms';
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
import { TemplateEditor } from './TemplateEditor';
import { TemplatePicker } from './TemplatePicker';

// « صانع الإعلانات » : une case photos, une case informations, un bouton → l'affiche publicitaire.
// La publication sur les plateformes vient ensuite, sous l'affiche.

interface TargetSpec {
  id: StudioTarget;
  label: string;
  path: string; // logo officiel (simple-icons)
  color: string;
  bg?: string;
  size: [number, number];
}

const LOGOS: Record<StudioTarget, string> = {
  facebook: siFacebook.path, instagram: siInstagram.path, tiktok: siTiktok.path, youtube: siYoutube.path,
  threads: siThreads.path, gmb: siGoogle.path, bluesky: siBluesky.path, whatsapp: siWhatsapp.path,
};

const TARGETS: TargetSpec[] = [
  ...STUDIO_PLATFORMS.map((p) => ({
    id: p.id, label: p.label, path: LOGOS[p.id], color: p.color, size: p.size,
    bg: p.id === 'instagram' ? 'linear-gradient(45deg,#feda75,#fa7e1e,#d62976,#962fbf,#4f5bd5)' : undefined,
  })),
  { id: 'whatsapp', label: 'WhatsApp', path: LOGOS.whatsapp, color: '#25d366', size: [1080, 1920] },
];
const target = (id: StudioTarget) => TARGETS.find((x) => x.id === id)!;

const FEATURE_TITLES = FEATURES.map((f) => f.title);
const MAX_FEATURES = 4; // places prévues sur l'affiche
const TEMPLATE_KEY = 'studio.template'; // dernier modèle choisi (sur cet appareil)

const readTemplateId = () => {
  try {
    return localStorage.getItem(TEMPLATE_KEY) || DEFAULT_TEMPLATE.id;
  } catch {
    return DEFAULT_TEMPLATE.id;
  }
};

// Modèle du gérant prêt à dessiner : son image de fond chargée.
function toTemplate(tpl: CustomTemplate): Promise<PosterTemplate | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ kind: 'custom', id: tpl.id, name: tpl.name, tpl, bgImg: img });
    img.onerror = () => resolve(null);
    img.src = URL.createObjectURL(tpl.bg);
  });
}

const EMPTY: PosterData = {
  deal: 'vente', type: 'Appartement', headline: '', city: 'مكناس', district: '', surface: 0, surfaceMax: 0, bedrooms: 0, bathrooms: 0, price: '', features: [],
};

const BrandLogo: React.FC<{ path: string; className?: string }> = ({ path, className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <path d={path} />
  </svg>
);

const RED = 'bg-[#e3131b]';

export const PublishStudioView: React.FC = () => {
  const user = useAuthUser();
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [photos, setPhotos] = useState<StudioPhoto[]>([]);
  const [data, setData] = useState<PosterData>(EMPTY);
  const [customFeature, setCustomFeature] = useState('');
  const [poster, setPoster] = useState<{ blob: Blob; url: string } | null>(null);
  const [selected, setSelected] = useState<StudioTarget[]>(['facebook', 'instagram', 'tiktok', 'whatsapp']);
  const [when, setWhen] = useState<'now' | 'later'>('now');
  const [dateTime, setDateTime] = useState('');
  const [posts, setPosts] = useState<StudioPost[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [customTpls, setCustomTpls] = useState<PosterTemplate[]>([]);
  const [templateId, setTemplateId] = useState(readTemplateId);
  const [editor, setEditor] = useState<{ initial?: CustomTemplate } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
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
  useEffect(() => () => poster && URL.revokeObjectURL(poster.url), [poster]);
  useEffect(() => setPosts([]), [poster, selected]);

  const imgs = useMemo(() => photos.map((p) => p.img), [photos]);

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
  }, []);
  const templates = useMemo(() => [...BUILTIN_TEMPLATES, ...customTpls], [customTpls]);
  const template = templates.find((t) => t.id === templateId) ?? DEFAULT_TEMPLATE;
  const mainSize = nativeSize(template); // affiche principale : format d'origine du modèle
  const chooseTemplate = (id: string) => {
    setTemplateId(id);
    try {
      localStorage.setItem(TEMPLATE_KEY, id);
    } catch {
      // stockage indisponible : le choix vaut pour cette visite
    }
  };
  const handleSaveTemplate = async (t: CustomTemplate) => {
    await saveTemplate(t);
    await reloadTemplates();
    chooseTemplate(t.id);
    setEditor(null);
    setToast('تم حفظ القالب');
  };
  const handleDeleteTemplate = async (t: PosterTemplate) => {
    if (t.kind !== 'custom' || !window.confirm(`حذف القالب «${t.name}»؟`)) return;
    await deleteTemplate(t.id);
    await reloadTemplates();
    chooseTemplate(DEFAULT_TEMPLATE.id);
  };

  // ---------- Photos ----------
  const addPhotos = async (list: FileList | null) => {
    if (!list) return;
    const room = 4 - photos.length;
    const files = Array.from(list).filter((f) => f.type.startsWith('image/')).slice(0, Math.max(0, room));
    if (Array.from(list).length > room) setToast('أقصى عدد 4 صور');
    const loaded = (await Promise.all(files.map((f) => loadPhoto(f).catch(() => null)))).filter((p): p is StudioPhoto => !!p);
    setPhotos((prev) => [...prev, ...loaded].slice(0, 4));
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
    if (data.features.length >= MAX_FEATURES) return setToast('أقصى عدد 4 مميزات في الصورة');
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

  // ---------- Le bouton : photos + informations + modèle → affiche ----------
  const handleMake = () =>
    run('make', async () => {
      if (!photos.length) throw new Error('أضف صورة واحدة على الأقل');
      const blob = await templateBlob(data, imgs, ...mainSize, template);
      setPoster({ blob, url: URL.createObjectURL(blob) });
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

  // Nom en lettres latines : les navigateurs ignorent souvent les noms de fichier en arabe.
  const fileName = (id: StudioTarget | 'affiche', ext = 'jpg') =>
    `alwasset777-${id}-${(id === 'affiche' ? mainSize : target(id).size).join('x')}.${ext}`;
  const blobFor = (id: StudioTarget) => templateBlob(data, imgs, ...target(id).size, template);

  const handleShare = () =>
    run('share', async () => {
      if (!poster) return;
      const how = await shareImage(poster.blob, fileName('affiche'), headlineOf(data));
      if (how === 'downloaded') setToast('تم تحميل الصورة');
    });

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

  // ---------- Publication sur les plateformes ----------
  const viaMetricool = !!status?.metricool;
  const metaDirect = (id: StudioTarget) => !viaMetricool && when === 'now' && (id === 'facebook' || id === 'instagram') && !!status?.meta[id];
  const toPublish = posts.filter((p) => p.target !== 'whatsapp' && p.status !== 'programmé' && p.status !== 'publié');
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
        const id = p.target as StudioNetwork;
        updatePost(id, { status: 'envoi', error: undefined });
        try {
          if (!viaMetricool && !metaDirect(id)) throw new Error('يحتاج ربط Metricool');
          const imageUrl = await uploadMedia(batch, await blobFor(id), fileName(id));
          if (!viaMetricool) {
            await publishMetaDirect(id as 'facebook' | 'instagram', fullText(p), imageUrl);
            updatePost(id, { status: 'publié' });
          } else {
            // YouTube n'accepte que la vidéo : l'affiche devient un Short de 8 secondes.
            const video = id === 'youtube' ? await uploadMedia(batch, await templateVideo(data, imgs, ...target(id).size, template), fileName(id, 'mp4')) : undefined;
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
      setToast(`تم إرسال ${ok} من ${toPublish.length} منشورات`);
    });

  const sharePost = (p: StudioPost) =>
    run(`share-${p.target}`, async () => {
      const how = await shareImage(await blobFor(p.target), fileName(p.target), fullText(p));
      if (how === 'downloaded') {
        await navigator.clipboard?.writeText(fullText(p)).catch(() => {});
        setToast('تم تحميل الصورة ونسخ النص: ألصقهما في واتساب');
      }
    });

  // ---------- Affichage ----------
  const card = 'bg-white rounded-3xl p-4 sm:p-5 border border-[#ececec] shadow-sm space-y-4';
  const input = 'w-full p-3 rounded-2xl bg-[#f6f6f6] border border-[#ececec] text-base focus:outline-none focus:border-[#e3131b]';
  const label = 'text-xs font-bold text-[#5f5f5f]';
  const chip = (on: boolean) =>
    `px-3.5 py-2 rounded-full text-sm font-bold border cursor-pointer transition-colors ${on ? 'bg-[#121212] text-white border-transparent' : 'border-[#e5e5e5] text-[#333] bg-white'}`;

  const slot = (i: number) => {
    const p = photos[i];
    const big = i === 0;
    const size = big ? 'col-span-3 aspect-[16/10]' : 'aspect-square';
    if (!p)
      return (
        <button
          key={`empty-${i}`}
          onClick={() => inputRef.current?.click()}
          className={`${size} rounded-2xl border-2 border-dashed border-[#f3a3a6] bg-[#fff5f5] flex flex-col items-center justify-center gap-1 text-[#e3131b] cursor-pointer`}
        >
          {big ? <ImagePlus className="w-9 h-9" /> : <Plus className="w-6 h-6" />}
          <span className={`${big ? 'text-base' : 'text-xs'} font-extrabold`}>{big ? 'أضف الصورة الرئيسية' : 'صورة'}</span>
        </button>
      );
    return (
      <div key={p.id} className={`${size} relative rounded-2xl overflow-hidden`}>
        <img src={p.url} alt="" className="w-full h-full object-cover" />
        <button onClick={() => removePhoto(p.id)} aria-label="حذف" className="absolute top-2 left-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center cursor-pointer">
          <X className="w-4 h-4" />
        </button>
        {big ? (
          <span className={`absolute bottom-2 right-2 px-2.5 py-1 rounded-lg ${RED} text-white text-xs font-black`}>الرئيسية</span>
        ) : (
          <button onClick={() => makeMain(p.id)} aria-label="اجعلها الرئيسية" className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-white/90 text-amber-500 flex items-center justify-center cursor-pointer">
            <Star className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  };

  const numberField = (k: 'surface' | 'surfaceMax' | 'bedrooms' | 'bathrooms', text: string) => (
    <label className="space-y-1">
      <span className={label}>{text}</span>
      <input type="number" min={0} inputMode="numeric" value={data[k] || ''} onChange={(e) => set(k, Number(e.target.value) || 0)} className={input} />
    </label>
  );

  return (
    <div ref={topRef} dir="rtl" className="font-tajawal max-w-2xl mx-auto space-y-5 pb-28 scroll-mt-24">
      {/* ================= Résultat : l'affiche ================= */}
      {poster ? (
        <>
          <section className={card}>
            <img src={poster.url} alt="الإعلان" className="w-full rounded-2xl shadow-lg" />
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => downloadFile(poster.blob, fileName('affiche'))} className="py-3.5 rounded-2xl bg-[#121212] text-white font-black flex flex-col items-center gap-1 cursor-pointer">
                <Download className="w-5 h-5" /> <span className="text-sm">تحميل</span>
              </button>
              <button onClick={handleShare} disabled={!!busy} className="py-3.5 rounded-2xl bg-[#25d366] text-white font-black flex flex-col items-center gap-1 cursor-pointer disabled:opacity-50">
                {busy === 'share' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Share2 className="w-5 h-5" />} <span className="text-sm">مشاركة</span>
              </button>
              <button onClick={() => setPoster(null)} className="py-3.5 rounded-2xl bg-[#f1f1f1] text-[#121212] font-black flex flex-col items-center gap-1 cursor-pointer">
                <Pencil className="w-5 h-5" /> <span className="text-sm">تعديل</span>
              </button>
            </div>
          </section>

          {/* ---------- Publication ---------- */}
          <section className={card}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black">انشر على المنصات</h2>
              {user && <SignOutButton user={user} />}
            </div>
            <div className="grid grid-cols-4 gap-3">
              {TARGETS.map((p) => {
                const on = selected.includes(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelected((prev) => (prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id]))}
                    className="flex flex-col items-center gap-1 cursor-pointer"
                    aria-pressed={on}
                  >
                    <span
                      className={`relative w-14 h-14 rounded-2xl flex items-center justify-center ${on ? 'text-white shadow-md' : 'bg-[#f1f1f1] text-[#b5b5b5]'}`}
                      style={on ? { background: p.bg || p.color } : undefined}
                    >
                      <BrandLogo path={p.path} className="w-7 h-7" />
                      {on && (
                        <span className={`absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full ${RED} border-2 border-white flex items-center justify-center`}>
                          <Check className="w-3 h-3 text-white" strokeWidth={4} />
                        </span>
                      )}
                    </span>
                    <span className="text-[11px] font-bold text-[#333]">{p.label}</span>
                  </button>
                );
              })}
            </div>
            <button onClick={downloadAll} disabled={!!busy || !selected.length} className="w-full py-3 rounded-2xl border border-[#e5e5e5] text-sm font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
              {busy === 'download' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              تحميل الإعلان بمقاس كل منصة
            </button>

            {needsLogin && <LoginCard title="دخول المدير للنشر" />}

            {!posts.length ? (
              <button onClick={handlePrepare} disabled={!selected.length || !!busy} className="w-full py-3.5 rounded-2xl bg-[#121212] text-white font-black flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
                {busy === 'prepare' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                {busy === 'prepare' ? 'جاري كتابة النصوص…' : `اكتب نصوص المنشورات (${selected.length})`}
              </button>
            ) : (
              <div className="space-y-3">
                {posts.map((p) => {
                  const spec = target(p.target);
                  return (
                    <div key={p.target} className="rounded-2xl border border-[#ececec] p-3 space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="w-7 h-7 rounded-lg flex items-center justify-center text-white" style={{ background: spec.bg || spec.color }}>
                          <BrandLogo path={spec.path} className="w-4 h-4" />
                        </span>
                        <span className="font-black">{spec.label}</span>
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
                      {p.target === 'whatsapp' && (
                        <button onClick={() => sharePost(p)} disabled={!!busy} className="w-full py-2.5 rounded-xl bg-[#25d366] text-white text-sm font-black flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
                          <Share2 className="w-4 h-4" /> شارك في واتساب
                        </button>
                      )}
                      {p.error && <p className="text-xs text-red-600 font-bold">{p.error}</p>}
                    </div>
                  );
                })}
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
                {toPublish.length > 0 && (
                  <button onClick={handlePublish} disabled={!canPublish || !!busy} className="w-full py-4 rounded-2xl bg-green-600 text-white font-black flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
                    {busy === 'publish' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    {busy === 'publish' ? 'جاري الإرسال…' : when === 'now' ? `انشر على ${toPublish.length} منصات` : `برمج ${toPublish.length} منشورات`}
                  </button>
                )}
              </div>
            )}
          </section>
        </>
      ) : (
        <>
          {/* ================= 1. Photos ================= */}
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
              <span className="text-xs font-bold text-[#999]">{photos.length}/4</span>
            </div>
            <div className="grid grid-cols-3 gap-2">{[0, 1, 2, 3].map(slot)}</div>
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

          {/* ================= 2. Modèle ================= */}
          <TemplatePicker
            templates={templates}
            selectedId={template.id}
            data={data}
            photos={imgs}
            onSelect={chooseTemplate}
            onAdd={() => setEditor({})}
            onEdit={(t) => t.kind === 'custom' && setEditor({ initial: t.tpl })}
            onDelete={handleDeleteTemplate}
          />

          {/* ================= 3. Informations ================= */}
          <section className={card}>
            <h2 className="text-lg font-black">معلومات العقار</h2>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(DEAL_LABELS) as ListingType[]).map((k) => (
                <button
                  key={k}
                  onClick={() => set('deal', k)}
                  className={`py-3 rounded-2xl text-base font-black border cursor-pointer ${data.deal === k ? `${RED} text-white border-transparent` : 'border-[#e5e5e5] text-[#333]'}`}
                >
                  {DEAL_LABELS[k].ar}
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
              {numberField('surface', 'المساحة (م²)')}
              {numberField('surfaceMax', 'إلى (م²، اختياري)')}
              {numberField('bedrooms', 'الغرف')}
              {numberField('bathrooms', 'الحمامات')}
            </div>
            <div className="space-y-2">
              <span className={label}>
                المميزات ({data.features.length}/{MAX_FEATURES})
              </span>
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

          {/* ================= 4. Le bouton ================= */}
          <div className="fixed bottom-0 inset-x-0 z-40 p-3 bg-gradient-to-t from-white via-white/95 to-transparent">
            <button
              onClick={handleMake}
              disabled={!!busy}
              className={`max-w-2xl mx-auto w-full py-4 rounded-2xl ${RED} text-white text-lg font-black flex items-center justify-center gap-2 shadow-xl shadow-red-600/30 cursor-pointer disabled:opacity-60`}
            >
              {busy === 'make' ? <Loader2 className="w-6 h-6 animate-spin" /> : <Sparkles className="w-6 h-6" />}
              {busy === 'make' ? 'جاري التصميم…' : 'اصنع الإعلان'}
              <ArrowRight className="w-5 h-5 rotate-180" />
            </button>
          </div>
        </>
      )}

      {editor && <TemplateEditor initial={editor.initial} data={data} photos={imgs} onSave={handleSaveTemplate} onClose={() => setEditor(null)} />}

      {toast && <div className="fixed top-6 inset-x-0 mx-auto w-fit max-w-[90vw] bg-[#121212] text-white text-sm font-bold px-5 py-3 rounded-2xl shadow-xl z-50">{toast}</div>}
    </div>
  );
};

// Pré-chargement des polices et du logo dès l'ouverture, pour que le premier rendu soit immédiat.
if (typeof window !== 'undefined') ensureFonts();
// Rendu d'aperçu utilisé par les tests visuels.
export { drawPoster };
