import React, { useEffect, useRef, useState } from 'react';
import {
  Upload,
  Home,
  Sparkles,
  Loader2,
  X,
  FileText,
  Wand2,
  Film,
  Image as ImageIcon,
  Send,
  CalendarClock,
  Copy,
  CheckCircle,
  AlertTriangle,
  Rocket,
} from 'lucide-react';
import { Language, ListingType, PropertyType } from '../types';
import { ServerStatus, fetchServerStatus } from '../services/adsApi';
import { isFirebaseEnabled } from '../services/firebase';
import { STUDIO_LANGUAGES, STUDIO_PLATFORMS, StudioLanguage, StudioNetwork, studioSpec } from '../services/studioPlatforms';
import {
  EMPTY_INFO,
  StudioFile,
  StudioInfo,
  StudioPost,
  enhanceImage,
  extractInfo,
  generatePosts,
  isVerticalVideo,
  publishMetaDirect,
  schedulePost,
  toProperty,
  uploadMedia,
} from '../services/studioApi';
import { recordSlideshow, renderPoster } from '../services/visualMaker';
import { LoginCard, SignOutButton, useAuthUser } from './AuthGate';

interface PublishStudioViewProps {
  language: Language;
}

const TYPES: { id: PropertyType; ar: string }[] = [
  { id: 'Appartement', ar: 'شقة' }, { id: 'Villa', ar: 'فيلا' }, { id: 'Maison', ar: 'منزل' }, { id: 'Terrain', ar: 'أرض' },
  { id: 'Local Commercial', ar: 'محل تجاري' }, { id: 'Bureau', ar: 'مكتب' }, { id: 'Immeuble', ar: 'عمارة' }, { id: 'Riad', ar: 'رياض' }, { id: 'Ferme', ar: 'ضيعة' },
];
const DEALS: { id: ListingType; fr: string; ar: string; en: string }[] = [
  { id: 'vente', fr: 'Vente', ar: 'للبيع', en: 'Sale' },
  { id: 'location', fr: 'Location', ar: 'للكراء', en: 'Rent' },
  { id: 'neuf', fr: 'Projet neuf', ar: 'مشروع جديد', en: 'New project' },
];

const fullText = (p: StudioPost) => (p.hashtags.length ? `${p.text}\n\n${p.hashtags.join(' ')}` : p.text);
const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const PublishStudioView: React.FC<PublishStudioViewProps> = ({ language }) => {
  const isAr = language === 'ar';
  const isEn = language === 'en';
  const t = (fr: string, ar: string, en: string) => (isAr ? ar : isEn ? en : fr);

  const user = useAuthUser();
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [files, setFiles] = useState<StudioFile[]>([]);
  const [info, setInfo] = useState<StudioInfo>(EMPTY_INFO);
  const [platforms, setPlatforms] = useState<StudioNetwork[]>(['facebook', 'instagram', 'tiktok', 'youtube']);
  const [lang, setLang] = useState<StudioLanguage>('ar+fr');
  const [captions, setCaptions] = useState<string[]>([]); // légendes IA des photos, pour la vidéo publicitaire
  const [when, setWhen] = useState<'now' | 'later'>('now');
  const [dateTime, setDateTime] = useState('');
  const [posts, setPosts] = useState<StudioPost[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef(files);
  filesRef.current = files;

  useEffect(() => {
    fetchServerStatus().then(setStatus);
  }, [user]);
  useEffect(() => () => filesRef.current.forEach((f) => URL.revokeObjectURL(f.url)), []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(id);
  }, [toast]);

  const images = files.filter((f) => f.kind === 'image');
  const videos = files.filter((f) => f.kind === 'video');
  const needsLogin = isFirebaseEnabled && user === null;

  // ---------- Carte 1 : fichiers ----------
  const addFiles = async (list: FileList | null) => {
    if (!list) return;
    const added: StudioFile[] = [];
    for (const file of Array.from(list)) {
      const kind = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : file.type === 'application/pdf' ? 'pdf' : null;
      if (!kind) continue;
      if (file.size > 250 * 1024 * 1024) {
        setToast(t(`${file.name} : plus de 250 Mo`, `${file.name}: أكبر من 250 ميغا`, `${file.name}: over 250 MB`));
        continue;
      }
      added.push({
        id: newId(), file, name: file.name, kind, url: URL.createObjectURL(file),
        vertical: kind === 'video' ? await isVerticalVideo(file).catch(() => false) : undefined,
      });
    }
    setFiles((prev) => [...prev, ...added]);
    setCaptions([]);
  };

  const removeFile = (id: string) => {
    const f = files.find((x) => x.id === id);
    if (f) URL.revokeObjectURL(f.url);
    setFiles((prev) => prev.filter((x) => x.id !== id));
    setCaptions([]);
  };

  const addBlob = (blob: Blob, name: string, kind: 'image' | 'video', extra: Partial<StudioFile> = {}) =>
    setFiles((prev) => [...prev, { id: newId(), file: blob, name, kind, url: URL.createObjectURL(blob), ...extra }]);

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

  const handleEnhance = (f: StudioFile) =>
    run(`enhance-${f.id}`, async () => {
      const blob = await enhanceImage(f);
      URL.revokeObjectURL(f.url);
      setFiles((prev) => prev.map((x) => (x.id === f.id ? { ...x, file: blob, url: URL.createObjectURL(blob), aiEnhanced: true } : x)));
      setToast(t('Photo retouchée par l’IA ✨', 'تم تحسين الصورة بالذكاء الاصطناعي ✨', 'Photo enhanced by AI ✨'));
    });

  const handlePoster = () =>
    run('poster', async () => {
      const blob = await renderPoster(toProperty(info, images.map((f) => f.url)), 'square', 'image/jpeg');
      addBlob(blob, 'affiche-alwassit777.jpg', 'image');
    });

  const makeSlideshow = async (): Promise<StudioFile> => {
    const blob = await recordSlideshow(toProperty(info, images.map((f) => f.url)), 'vertical', 3, { captions, bookends: true });
    const f: StudioFile = { id: newId(), file: blob, name: `video-alwassit777.${blob.type === 'video/mp4' ? 'mp4' : 'webm'}`, kind: 'video', url: URL.createObjectURL(blob), vertical: true };
    setFiles((prev) => [...prev, f]);
    return f;
  };

  // ---------- Carte 2 : informations ----------
  const setField = <K extends keyof StudioInfo>(k: K, v: StudioInfo[K]) => setInfo((prev) => ({ ...prev, [k]: v }));

  const handleExtract = () =>
    run('extract', async () => {
      const found = await extractInfo(files);
      setInfo((prev) => ({ ...prev, ...found }));
      setToast(
        Object.keys(found).length
          ? t('Informations remplies : vérifiez-les', 'تم ملء المعلومات، راجعها من فضلك', 'Details filled in: please check them')
          : t('Rien trouvé dans les fichiers', 'لم يتم العثور على معلومات في الملفات', 'Nothing found in the files')
      );
    });

  // ---------- Création et publication ----------
  const handleGenerate = () =>
    run('generate', async () => {
      const { posts: created, captions: found } = await generatePosts(files, info, platforms, lang);
      setPosts(created);
      setCaptions(found);
      if (created.every((p) => p.source === 'modèle'))
        setToast(t('IA indisponible : modèles Al Wassit utilisés', 'الذكاء الاصطناعي غير متوفر: تم استعمال نماذج المكتب', 'AI unavailable: templates used'));
    });

  const updatePost = (platform: StudioNetwork, patch: Partial<StudioPost>) =>
    setPosts((prev) => prev.map((p) => (p.platform === platform ? { ...p, ...patch } : p)));

  const copyPost = async (p: StudioPost) => {
    try {
      await navigator.clipboard.writeText(fullText(p));
      setToast(t('Texte copié', 'تم نسخ النص', 'Text copied'));
    } catch {
      setToast(t('Copie impossible', 'تعذر النسخ', 'Copy failed'));
    }
  };

  const toPublish = posts.filter((p) => p.status !== 'programmé' && p.status !== 'publié');
  const viaMetricool = !!status?.metricool;
  // Sans Metricool : Facebook / Instagram restent publiables tout de suite, gratuitement, via l'API Meta.
  const metaDirect = (id: StudioNetwork) => !viaMetricool && when === 'now' && (id === 'facebook' || id === 'instagram') && !!status?.meta[id];
  const missingFor = (id: StudioNetwork): string | null => {
    const needs = studioSpec(id).needs;
    if (needs === 'video' && !videos.length && !images.length) return t('vidéo ou photos nécessaires', 'يحتاج فيديو أو صور', 'needs a video or photos');
    if (needs === 'media' && !videos.length && !images.length) return t('photo ou vidéo nécessaire', 'يحتاج صورة أو فيديو', 'needs a photo or video');
    return null;
  };

  const handlePublish = () =>
    run('publish', async () => {
      if (when === 'later' && !dateTime) throw new Error(t('Choisissez la date et l’heure', 'اختر التاريخ والساعة', 'Pick a date and time'));
      const batch = newId();
      // YouTube exige une vidéo : diaporama automatique à partir des photos si aucune vidéo n'a été ajoutée.
      let video = videos[0];
      if (viaMetricool && !video && images.length && toPublish.some((p) => studioSpec(p.platform).needs === 'video')) {
        setBusy('slideshow');
        video = await makeSlideshow();
        setBusy('publish');
      }
      const imageUrls = await Promise.all(images.slice(0, viaMetricool ? 10 : 1).map((f) => uploadMedia(batch, f.file, f.name)));
      const videoUrl = video && viaMetricool ? await uploadMedia(batch, video.file, video.name) : undefined;
      let ok = 0;
      for (const p of toPublish) {
        updatePost(p.platform, { status: 'envoi', error: undefined });
        try {
          if (!viaMetricool) {
            if (!metaDirect(p.platform)) throw new Error(t('Nécessite Metricool', 'يحتاج ربط Metricool', 'Needs Metricool'));
            await publishMetaDirect(p.platform as 'facebook' | 'instagram', fullText(p), imageUrls[0]);
            updatePost(p.platform, { status: 'publié' });
            ok++;
            continue;
          }
          const r = await schedulePost({
            network: p.platform,
            text: fullText(p),
            title: p.title || undefined,
            images: imageUrls,
            video: videoUrl,
            vertical: video?.vertical,
            aiImages: images.some((f) => f.aiEnhanced),
            dateTime: when === 'later' ? dateTime : undefined,
          });
          updatePost(p.platform, { status: 'programmé', scheduledFor: r.dateTime });
          ok++;
        } catch (e) {
          updatePost(p.platform, { status: 'erreur', error: (e as Error).message });
        }
      }
      setToast(t(`${ok}/${toPublish.length} publications envoyées`, `تم إرسال ${ok} من ${toPublish.length} منشورات`, `${ok}/${toPublish.length} posts sent`));
    });

  const canPublish = (viaMetricool || toPublish.some((p) => metaDirect(p.platform))) && isFirebaseEnabled && !!user && toPublish.length > 0;

  // ---------- Affichage ----------
  const card = 'bg-white rounded-3xl p-5 border border-[#f0e4e2] space-y-4';
  const input = 'w-full p-2.5 rounded-xl bg-[#fff8f7] border border-[#f0e4e2] text-sm';
  const label = 'text-[11px] font-bold text-[#7a5c58]';
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const pill = (on: boolean, text: string) => (
    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${on ? 'bg-green-500/20 text-green-200' : 'bg-white/10 text-white/60'}`}>
      {on ? '✓' : '✗'} {text}
    </span>
  );

  return (
    <div className="space-y-6 pb-16">
      <div className="bg-gradient-to-br from-[#281715] to-[#4a2a26] rounded-3xl p-6 text-white space-y-3">
        <div className="flex items-center gap-2 text-[#ffb4aa] text-xs font-bold">
          <Rocket className="w-4 h-4" /> {t('Studio de publication', 'استوديو النشر', 'Publishing studio')}
        </div>
        <h1 className="text-2xl sm:text-3xl font-black">{t('Un fichier → toutes vos plateformes', 'ملف واحد ← كل منصاتك', 'One file → all your platforms')}</h1>
        <p className="text-sm text-white/75 max-w-2xl">
          {t(
            'Ajoutez photos, vidéo ou PDF, complétez la fiche du bien, choisissez les plateformes et l’heure. L’IA rédige chaque publication, vous validez, Metricool publie.',
            'أضف الصور أو الفيديو أو ملف PDF، أكمل معلومات العقار، اختر المنصات والوقت. الذكاء الاصطناعي يكتب كل منشور، أنت توافق، وMetricool ينشر في الوقت المحدد.',
            'Add photos, video or PDF, fill in the property, choose platforms and time. AI writes each post, you approve, Metricool publishes.'
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {pill(!!status?.ai, t('IA', 'الذكاء الاصطناعي', 'AI'))}
          {pill(!!status?.metricool, 'Metricool')}
          {pill(isFirebaseEnabled, t('Hébergement des médias', 'استضافة الصور', 'Media hosting'))}
          {user && <SignOutButton user={user} />}
        </div>
      </div>

      {needsLogin && <LoginCard title={t('Connexion du gérant', 'دخول المدير', 'Manager sign-in')} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ---------- Carte 1 : fichiers ---------- */}
        <section className={card}>
          <h2 className="text-sm font-extrabold flex items-center gap-2">
            <Upload className="w-4 h-4 text-[#ff6f61]" /> {t('1. Photos, vidéo, PDF', '1. الصور والفيديو والملفات', '1. Photos, video, PDF')}
          </h2>
          <button
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              addFiles(e.dataTransfer.files);
            }}
            className="w-full border-2 border-dashed border-[#ffb4aa] rounded-2xl p-6 text-center bg-[#fff8f7] hover:bg-[#fff0ed] cursor-pointer"
          >
            <Upload className="w-8 h-8 mx-auto text-[#ff6f61]" />
            <div className="text-sm font-extrabold mt-2">{t('Touchez pour ajouter des fichiers', 'اضغط هنا لإضافة الملفات', 'Tap to add files')}</div>
            <div className="text-[11px] text-[#99807d] mt-1">{t('Photos, vidéos (max 250 Mo), PDF', 'صور، فيديو (حتى 250 ميغا)، PDF', 'Photos, videos (max 250 MB), PDF')}</div>
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*,video/*,application/pdf"
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = '';
            }}
          />

          {files.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {files.map((f) => (
                <div key={f.id} className="relative rounded-xl overflow-hidden border border-[#f0e4e2] aspect-square bg-[#fff8f7]">
                  {f.kind === 'image' && <img src={f.url} alt="" className="w-full h-full object-cover" />}
                  {f.kind === 'video' && <video src={f.url} muted playsInline className="w-full h-full object-cover" />}
                  {f.kind === 'pdf' && (
                    <div className="w-full h-full flex flex-col items-center justify-center p-1 text-center">
                      <FileText className="w-7 h-7 text-[#ff6f61]" />
                      <span className="text-[9px] font-bold mt-1 line-clamp-2 break-all">{f.name}</span>
                    </div>
                  )}
                  {f.kind === 'video' && <Film className="absolute bottom-1 start-1 w-4 h-4 text-white drop-shadow" />}
                  {f.aiEnhanced && <span className="absolute bottom-1 start-1 text-[9px] font-black bg-violet-600 text-white px-1 rounded">IA</span>}
                  <button onClick={() => removeFile(f.id)} className="absolute top-1 end-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                  {f.kind === 'image' && !f.aiEnhanced && status?.ai && (
                    <button
                      onClick={() => handleEnhance(f)}
                      disabled={!!busy}
                      title={t('Retoucher avec l’IA', 'تحسين بالذكاء الاصطناعي', 'Enhance with AI')}
                      className="absolute bottom-1 end-1 w-7 h-7 rounded-full bg-white/90 text-violet-700 flex items-center justify-center cursor-pointer disabled:opacity-50"
                    >
                      {busy === `enhance-${f.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {images.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button onClick={handlePoster} disabled={!!busy} className="px-3 py-2 rounded-xl border border-[#f0e4e2] text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
                {busy === 'poster' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
                {t('Affiche avec logo', 'تصميم إعلان بشعار المكتب', 'Branded poster')}
              </button>
              <button onClick={() => run('slideshow', async () => void (await makeSlideshow()))} disabled={!!busy} className="px-3 py-2 rounded-xl border border-[#f0e4e2] text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
                {busy === 'slideshow' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Film className="w-3.5 h-3.5" />}
                {busy === 'slideshow' ? t('Vidéo en cours…', 'جاري صنع الفيديو…', 'Making video…') : t('Vidéo publicitaire (gratuite)', 'فيديو إعلاني مجاني من الصور', 'Free ad video')}
              </button>
            </div>
          )}
          {images.some((f) => f.aiEnhanced) && (
            <p className="text-[11px] text-violet-700 font-semibold">
              {t(
                'Photos retouchées par l’IA : elles seront déclarées « contenu IA » sur Instagram et TikTok.',
                'الصور المحسّنة بالذكاء الاصطناعي ستُعلَن كـ«محتوى ذكاء اصطناعي» في إنستغرام وتيك توك.',
                'AI-enhanced photos will be labelled as AI content on Instagram and TikTok.'
              )}
            </p>
          )}
        </section>

        {/* ---------- Carte 2 : informations du bien ---------- */}
        <section className={card}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-extrabold flex items-center gap-2">
              <Home className="w-4 h-4 text-[#ff6f61]" /> {t('2. Informations du bien', '2. معلومات العقار', '2. Property details')}
            </h2>
            {status?.ai && files.length > 0 && (
              <button onClick={handleExtract} disabled={!!busy} className="px-3 py-1.5 rounded-xl bg-violet-50 text-violet-700 text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50">
                {busy === 'extract' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {t('Remplir depuis les fichiers', 'املأ من الملفات', 'Fill from files')}
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className={label}>{t('Type', 'النوع', 'Type')}</span>
              <select value={info.type} onChange={(e) => setField('type', e.target.value as PropertyType)} className={input}>
                <option value="">—</option>
                {TYPES.map((x) => <option key={x.id} value={x.id}>{isAr ? x.ar : x.id}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className={label}>{t('Transaction', 'العملية', 'Deal')}</span>
              <select value={info.listingType} onChange={(e) => setField('listingType', e.target.value as ListingType)} className={input}>
                {DEALS.map((d) => <option key={d.id} value={d.id}>{t(d.fr, d.ar, d.en)}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className={label}>{t('Ville', 'المدينة', 'City')}</span>
              <input value={info.city} onChange={(e) => setField('city', e.target.value)} className={input} />
            </label>
            <label className="space-y-1">
              <span className={label}>{t('Quartier', 'الحي', 'District')}</span>
              <input value={info.district} onChange={(e) => setField('district', e.target.value)} className={input} />
            </label>
            <label className="space-y-1">
              <span className={label}>{t('Surface (m²)', 'المساحة (م²)', 'Area (m²)')}</span>
              <input type="number" min={0} value={info.surface || ''} onChange={(e) => setField('surface', Number(e.target.value) || 0)} className={input} />
            </label>
            <label className="space-y-1">
              <span className={label}>{t('Prix', 'الثمن', 'Price')}</span>
              <input value={info.price} placeholder={t('ex. 950 000 DH', 'مثلاً 950.000 درهم', 'e.g. 950,000 MAD')} onChange={(e) => setField('price', e.target.value)} className={input} />
            </label>
            <label className="space-y-1">
              <span className={label}>{t('Chambres', 'غرف النوم', 'Bedrooms')}</span>
              <input type="number" min={0} value={info.bedrooms || ''} onChange={(e) => setField('bedrooms', Number(e.target.value) || 0)} className={input} />
            </label>
            <label className="space-y-1">
              <span className={label}>{t('Salles de bain', 'الحمامات', 'Bathrooms')}</span>
              <input type="number" min={0} value={info.bathrooms || ''} onChange={(e) => setField('bathrooms', Number(e.target.value) || 0)} className={input} />
            </label>
          </div>
          <label className="block space-y-1">
            <span className={label}>{t('Atouts (séparés par des virgules)', 'المميزات (مفصولة بفاصلة)', 'Highlights (comma separated)')}</span>
            <input value={info.features} placeholder={t('ascenseur, parking, vue dégagée', 'مصعد، موقف سيارات، إطلالة', 'elevator, parking, view')} onChange={(e) => setField('features', e.target.value)} className={input} />
          </label>
          <label className="block space-y-1">
            <span className={label}>{t('Description / remarques', 'الوصف / ملاحظات', 'Description / notes')}</span>
            <textarea rows={3} value={info.description} onChange={(e) => setField('description', e.target.value)} className={input} />
          </label>
        </section>
      </div>

      {/* ---------- Plateformes, langue, programme ---------- */}
      <section className={card}>
        <h2 className="text-sm font-extrabold flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-[#ff6f61]" /> {t('3. Où et quand publier ?', '3. أين ومتى تنشر؟', '3. Where and when?')}
        </h2>
        <div className="flex flex-wrap gap-2">
          {STUDIO_PLATFORMS.map((spec) => {
            const on = platforms.includes(spec.id);
            return (
              <button
                key={spec.id}
                onClick={() => setPlatforms(toggle(platforms, spec.id))}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${on ? 'text-white border-transparent' : 'text-[#5a4340] border-[#f0e4e2] bg-white'}`}
                style={on ? { background: spec.color } : undefined}
              >
                {spec.label}
                {spec.needs === 'video' && <span className="opacity-75"> • {t('vidéo', 'فيديو', 'video')}</span>}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {STUDIO_LANGUAGES.map((l) => (
            <button
              key={l.id}
              onClick={() => setLang(l.id)}
              className={`px-4 py-2 rounded-xl text-sm font-bold border cursor-pointer ${lang === l.id ? 'bg-[#281715] text-white border-transparent' : 'border-[#f0e4e2] text-[#5a4340]'}`}
            >
              {l.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm font-bold">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" checked={when === 'now'} onChange={() => setWhen('now')} /> {t('Maintenant', 'الآن', 'Now')}
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" checked={when === 'later'} onChange={() => setWhen('later')} /> {t('À une date précise', 'في وقت محدد', 'At a set time')}
          </label>
          {when === 'later' && (
            <input type="datetime-local" value={dateTime} onChange={(e) => setDateTime(e.target.value)} className="p-2 rounded-xl bg-[#fff8f7] border border-[#f0e4e2] text-sm" dir="ltr" />
          )}
        </div>
        {platforms.map((id) => missingFor(id) && (
          <p key={id} className="text-[11px] text-amber-700 font-semibold flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> {studioSpec(id).label} : {missingFor(id)}
          </p>
        ))}
        <button
          onClick={handleGenerate}
          disabled={!platforms.length || !!busy || (!files.length && !info.description && !info.surface)}
          className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-[#ff6f61] text-white font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-[#ff6f61]/25 disabled:opacity-50 cursor-pointer"
        >
          {busy === 'generate' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
          {busy === 'generate'
            ? t('Rédaction en cours…', 'جاري كتابة المنشورات…', 'Writing…')
            : t(`Créer ${platforms.length} publications`, `أنشئ ${platforms.length} منشورات`, `Create ${platforms.length} posts`)}
        </button>
      </section>

      {/* ---------- Aperçu et validation ---------- */}
      {posts.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-extrabold">{t('4. Vérifiez puis publiez', '4. راجع ثم انشر', '4. Review, then publish')}</h2>
          {posts.map((p) => {
            const spec = studioSpec(p.platform);
            const len = fullText(p).length;
            return (
              <div key={p.platform} className="bg-white rounded-3xl p-5 border border-[#f0e4e2] space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-lg text-white font-bold" style={{ background: spec.color }}>{spec.label}</span>
                  <span className="text-[10px] font-bold text-[#99807d]">{p.source === 'ia' ? '✨ IA' : t('Modèle', 'نموذج', 'Template')}</span>
                  {p.status === 'programmé' && (
                    <span className="flex items-center gap-1 text-green-700 font-bold">
                      <CheckCircle className="w-3.5 h-3.5" /> {t('Programmé', 'مبرمج', 'Scheduled')} {p.scheduledFor?.replace('T', ' ').slice(0, 16)}
                    </span>
                  )}
                  {p.status === 'publié' && (
                    <span className="flex items-center gap-1 text-green-700 font-bold">
                      <CheckCircle className="w-3.5 h-3.5" /> {t('Publié', 'تم النشر', 'Published')}
                    </span>
                  )}
                  {p.status === 'envoi' && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#ff6f61]" />}
                  <span className={`ms-auto text-[10px] font-bold ${len > spec.maxChars ? 'text-red-600' : 'text-[#99807d]'}`}>{len}/{spec.maxChars}</span>
                  <button onClick={() => copyPost(p)} className="p-1.5 rounded-lg hover:bg-[#fff0ed] cursor-pointer" title={t('Copier', 'نسخ', 'Copy')}>
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  {p.status !== 'programmé' && p.status !== 'publié' && (
                    <button onClick={() => setPosts((prev) => prev.filter((x) => x.platform !== p.platform))} className="p-1.5 rounded-lg hover:bg-[#fff0ed] cursor-pointer" title={t('Retirer', 'حذف', 'Remove')}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {spec.title && (
                  <input value={p.title} onChange={(e) => updatePost(p.platform, { title: e.target.value })} placeholder={t('Titre', 'العنوان', 'Title')} className={`${input} font-bold`} />
                )}
                <textarea rows={6} value={p.text} onChange={(e) => updatePost(p.platform, { text: e.target.value })} className={input} />
                {spec.maxHashtags > 0 && (
                  <input
                    value={p.hashtags.join(' ')}
                    onChange={(e) => updatePost(p.platform, { hashtags: e.target.value.split(/\s+/).filter(Boolean) })}
                    className={`${input} text-[#ff6f61] font-semibold`}
                    dir="auto"
                  />
                )}
                {p.error && <p className="text-xs text-red-600 font-bold">{p.error}</p>}
              </div>
            );
          })}

          {!status?.metricool && (
            <p className="text-xs text-amber-700 font-semibold">
              {t(
                'Metricool n’est pas relié : seuls Facebook et Instagram (si Meta est configuré) peuvent être publiés maintenant, gratuitement. Pour les autres, copiez le texte.',
                'Metricool غير مربوط: يمكن النشر الآن مجاناً على فيسبوك وإنستغرام فقط (إذا كان ربط Meta مفعّلاً). للمنصات الأخرى انسخ النص.',
                'Metricool not linked: only Facebook and Instagram (if Meta is set up) can be published now, for free. Copy the text for others.'
              )}
            </p>
          )}
          <button
            onClick={handlePublish}
            disabled={!canPublish || !!busy}
            className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-green-600 text-white font-extrabold flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 cursor-pointer"
          >
            {busy === 'publish' || busy === 'slideshow' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            {busy === 'slideshow'
              ? t('Vidéo pour YouTube…', 'جاري صنع فيديو يوتيوب…', 'Making YouTube video…')
              : busy === 'publish'
              ? t('Envoi…', 'جاري الإرسال…', 'Sending…')
              : when === 'now'
              ? t(`Publier sur ${toPublish.length} plateformes`, `انشر على ${toPublish.length} منصات`, `Publish to ${toPublish.length} platforms`)
              : t(`Programmer ${toPublish.length} publications`, `برمج ${toPublish.length} منشورات`, `Schedule ${toPublish.length} posts`)}
          </button>
        </section>
      )}

      {toast && (
        <div className="fixed bottom-6 inset-x-0 mx-auto w-fit max-w-[90vw] bg-[#281715] text-white text-sm font-bold px-5 py-3 rounded-2xl shadow-xl z-50">{toast}</div>
      )}
    </div>
  );
};
