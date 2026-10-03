import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Megaphone,
  Sparkles,
  CheckCircle,
  XCircle,
  CalendarDays,
  BarChart3,
  Copy,
  ExternalLink,
  Image as ImageIcon,
  Video,
  RefreshCw,
  Trash2,
  Clock,
  Send,
  Loader2,
  Bell,
} from 'lucide-react';
import { AdDraft, AdLanguage, AdPlatform, AdStats, Language, Property } from '../types';
import {
  AD_LANGUAGES,
  PLATFORMS,
  fullPostText,
  localDayKey,
  planSchedule,
  platformSpec,
  shareUrl,
} from '../services/adGenerator';
import { AUTO_PLATFORMS, ServerStatus, fetchServerStatus, publishToMeta } from '../services/adsApi';
import { EMPTY_STATS, generateDrafts, makeDraft, useAdDrafts } from '../services/adsStore';
import { isFirebaseEnabled } from '../services/firebase';
import { LoginCard, SignOutButton, useAuthUser } from './AuthGate';
import { canRecordVideo, downloadBlob, recordSlideshow, renderPoster } from '../services/visualMaker';
import { loadJSON, saveJSON } from '../services/storage';

interface AdsAgentViewProps {
  properties: Property[];
  language: Language;
}

type SubTab = 'create' | 'review' | 'calendar' | 'results';

const SETTINGS_KEY = 'alwassit777.ads.settings.v1';

const STAT_LABELS: { key: keyof AdStats; fr: string; ar: string; en: string }[] = [
  { key: 'views', fr: 'Vues', ar: 'مشاهدات', en: 'Views' },
  { key: 'likes', fr: "J'aime", ar: 'إعجابات', en: 'Likes' },
  { key: 'comments', fr: 'Commentaires', ar: 'تعليقات', en: 'Comments' },
  { key: 'shares', fr: 'Partages', ar: 'مشاركات', en: 'Shares' },
  { key: 'messages', fr: 'Messages', ar: 'رسائل', en: 'Messages' },
  { key: 'leads', fr: 'Clients sérieux', ar: 'زبائن جديون', en: 'Qualified leads' },
];

const STATUS_STYLE: Record<AdDraft['status'], string> = {
  brouillon: 'bg-amber-50 text-amber-700',
  approuvé: 'bg-sky-50 text-sky-700',
  programmé: 'bg-violet-50 text-violet-700',
  publié: 'bg-green-50 text-green-700',
  rejeté: 'bg-gray-100 text-gray-500',
};

export const AdsAgentView: React.FC<AdsAgentViewProps> = ({ properties, language }) => {
  const isAr = language === 'ar';
  const isEn = language === 'en';
  const t = (fr: string, ar: string, en: string) => (isAr ? ar : isEn ? en : fr);

  const [tab, setTab] = useState<SubTab>('create');
  const [drafts, setDrafts] = useAdDrafts();
  const [settings, setSettings] = useState(() => ({ perDay: 6, autoPublish: false, ...loadJSON<{ perDay?: number; autoPublish?: boolean }>(SETTINGS_KEY, {}) }));
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [publishing, setPublishing] = useState<string | null>(null);
  const inFlight = useRef(new Set<string>());
  const autoFailed = useRef(new Set<string>()); // pas de nouvel essai automatique après un échec
  const user = useAuthUser();
  const [selectedPropId, setSelectedPropId] = useState<number | null>(properties[0]?.id ?? null);
  const [platforms, setPlatforms] = useState<AdPlatform[]>(PLATFORMS.map((p) => p.id));
  const [languages, setLanguages] = useState<AdLanguage[]>(['ar', 'darija', 'fr']);
  const [generating, setGenerating] = useState<{ done: number; total: number } | null>(null);
  const [busyVisual, setBusyVisual] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => saveJSON(SETTINGS_KEY, settings), [settings]);
  useEffect(() => {
    fetchServerStatus().then(setServerStatus);
  }, [user]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  const propertyById = (id: number) => properties.find((p) => p.id === id);
  const update = (id: string, patch: Partial<AdDraft>) =>
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));

  const toReview = drafts.filter((d) => d.status === 'brouillon');
  const approved = drafts.filter((d) => d.status === 'approuvé');
  const scheduled = drafts.filter((d) => d.status === 'programmé').sort((a, b) => (a.scheduledAt! < b.scheduledAt! ? -1 : 1));
  const published = drafts.filter((d) => d.status === 'publié');
  const scheduledByDay = scheduled.reduce<Record<string, AdDraft[]>>((acc, d) => {
    const key = localDayKey(new Date(d.scheduledAt!));
    (acc[key] ||= []).push(d);
    return acc;
  }, {});
  const dueNow = scheduled.filter((d) => new Date(d.scheduledAt!).getTime() <= now);

  // ---------- Génération ----------
  const handleGenerate = async () => {
    const p = selectedPropId != null ? propertyById(selectedPropId) : undefined;
    if (!p || !platforms.length || !languages.length) return;
    const created = await generateDrafts(p, platforms, languages, (done, total) => setGenerating({ done, total }));
    setGenerating(null);
    const aiCount = created.filter((d) => d.source === 'ia').length;
    setToast(
      t(
        `${created.length} annonces prêtes à valider${aiCount ? ` (${aiCount} par l'IA)` : ' (modèles Al Wassit)'}`,
        `${created.length} إعلان جاهز للمراجعة`,
        `${created.length} ads ready for review`
      )
    );
    setTab('review');
  };

  const handleRegenerate = async (d: AdDraft) => {
    const p = propertyById(d.propertyId);
    if (!p) return;
    const fresh = await makeDraft(p, d.platform, d.language);
    update(d.id, { text: fresh.text, hashtags: fresh.hashtags, source: fresh.source });
  };

  // ---------- Calendrier / publication ----------
  const handleAutoPlan = () => {
    const plan = planSchedule(drafts, settings.perDay);
    const count = Object.keys(plan).length;
    setDrafts((prev) => prev.map((d) => (plan[d.id] ? { ...d, status: 'programmé', scheduledAt: plan[d.id] } : d)));
    setToast(t(`${count} publications programmées`, `تمت برمجة ${count} منشور`, `${count} posts scheduled`));
  };

  const copyText = async (d: AdDraft) => {
    try {
      await navigator.clipboard.writeText(fullPostText(d));
      setToast(t('Texte copié', 'تم نسخ النص', 'Text copied'));
    } catch {
      setToast(t('Copie impossible : sélectionnez le texte manuellement', 'تعذر النسخ', 'Copy failed'));
    }
  };

  // Publication directe possible : plateforme Meta configurée sur le serveur + gérant connecté.
  const canAutoPublish = (platform: AdPlatform) =>
    AUTO_PLATFORMS.includes(platform) && !!user && !!serverStatus?.meta[platform as 'facebook' | 'instagram'];

  const publishDirect = async (d: AdDraft) => {
    const p = propertyById(d.propertyId);
    if (!p || inFlight.current.has(d.id)) return;
    inFlight.current.add(d.id);
    setPublishing(d.id);
    try {
      const externalId = await publishToMeta(d, p);
      update(d.id, { status: 'publié', publishedAt: new Date().toISOString(), externalId });
      setToast(t(`Publié sur ${platformSpec(d.platform).label} ✅`, `تم النشر على ${platformSpec(d.platform).label} ✅`, `Published on ${platformSpec(d.platform).label} ✅`));
    } catch (e) {
      autoFailed.current.add(d.id);
      setToast(t(`Échec de publication : ${(e as Error).message}`, `فشل النشر: ${(e as Error).message}`, `Publish failed: ${(e as Error).message}`));
    } finally {
      inFlight.current.delete(d.id);
      setPublishing(null);
    }
  };

  // Publication automatique à l'heure prévue (annonces déjà approuvées), tant que l'application est ouverte.
  useEffect(() => {
    if (!settings.autoPublish) return;
    const next = dueNow.find((d) => canAutoPublish(d.platform) && !inFlight.current.has(d.id) && !autoFailed.current.has(d.id));
    if (next) publishDirect(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, settings.autoPublish, serverStatus, user, drafts]);

  const handlePublish = async (d: AdDraft) => {
    if (canAutoPublish(d.platform)) return publishDirect(d);
    await copyText(d);
    const url = shareUrl(d.platform, fullPostText(d));
    if (url) window.open(url, '_blank', 'noopener');
    update(d.id, { status: 'publié', publishedAt: new Date().toISOString() });
  };

  const handleVisual = async (d: AdDraft, kind: 'poster' | 'video') => {
    const p = propertyById(d.propertyId);
    if (!p) return;
    const format = platformSpec(d.platform).format;
    setBusyVisual(`${d.id}-${kind}`);
    try {
      const blob = kind === 'poster' ? await renderPoster(p, format) : await recordSlideshow(p, format);
      downloadBlob(blob, `alwassit777-${d.platform}-${p.id}.${kind === 'poster' ? 'png' : 'webm'}`);
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setBusyVisual(null);
    }
  };

  // ---------- Résultats ----------
  const totals = useMemo(() => {
    const sum = { ...EMPTY_STATS };
    published.forEach((d) => (Object.keys(sum) as (keyof AdStats)[]).forEach((k) => (sum[k] += d.stats[k] || 0)));
    return sum;
  }, [published]);

  const byPlatform = useMemo(
    () =>
      PLATFORMS.map((spec) => {
        const posts = published.filter((d) => d.platform === spec.id);
        const s = { ...EMPTY_STATS };
        posts.forEach((d) => (Object.keys(s) as (keyof AdStats)[]).forEach((k) => (s[k] += d.stats[k] || 0)));
        return { spec, count: posts.length, stats: s };
      }).filter((r) => r.count > 0),
    [published]
  );

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString(isAr ? 'ar-MA' : isEn ? 'en-GB' : 'fr-FR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  const toLocalInput = (iso: string) => {
    const d = new Date(iso);
    return `${localDayKey(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const langLabel = (l: AdLanguage) => AD_LANGUAGES.find((x) => x.id === l)!.label;
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const tabBtn = (id: SubTab, icon: React.ReactNode, label: string, count?: number) => (
    <button
      onClick={() => setTab(id)}
      className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
        tab === id ? 'bg-[#ff6f61] text-white shadow-md shadow-[#ff6f61]/25' : 'text-[#7a5c58] hover:bg-white'
      }`}
    >
      {icon}
      <span>{label}</span>
      {count ? <span className={`px-1.5 rounded-md text-[10px] ${tab === id ? 'bg-white/25' : 'bg-[#fff0ed] text-[#ff6f61]'}`}>{count}</span> : null}
    </button>
  );

  const selectedProp = selectedPropId != null ? propertyById(selectedPropId) : undefined;

  return (
    <div className="space-y-6 pb-16">
      {/* En-tête */}
      <div className="bg-gradient-to-br from-[#281715] to-[#4a2a26] rounded-3xl p-6 sm:p-8 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[#ffb4aa] text-xs font-bold">
            <Megaphone className="w-4 h-4" />
            {t('Agent publicitaire IA', 'وكيل الإعلانات الذكي', 'AI advertising agent')}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black">{t('Publicités Al Wassit 777', 'إعلانات الوسيط 777', 'Al Wassit 777 Ads')}</h1>
          <p className="text-sm text-white/75 max-w-2xl">
            {t(
              "L'agent rédige vos annonces dans votre style (arabe, darija, français), crée les visuels, planifie plusieurs posts par jour et suit les résultats. Rien ne part sans votre validation.",
              'الوكيل يكتب إعلاناتك بأسلوبك (العربية، الدارجة، الفرنسية)، يصمم الصور والفيديو، يبرمج عدة منشورات في اليوم ويتابع النتائج. لا شيء يُنشر بدون موافقتك.',
              'The agent writes your ads in your own voice (Arabic, Darija, French), creates visuals, schedules several posts a day and tracks results. Nothing goes out without your approval.'
            )}
          </p>
        </div>
        {dueNow.length > 0 && (
          <button
            onClick={() => setTab('calendar')}
            className="flex items-center gap-2 bg-[#ff6f61] px-4 py-3 rounded-2xl text-sm font-extrabold animate-pulse cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            {t(`${dueNow.length} à publier maintenant`, `${dueNow.length} للنشر الآن`, `${dueNow.length} due now`)}
          </button>
        )}
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t('À valider', 'للمراجعة', 'To review'), value: toReview.length, color: 'text-amber-600' },
          { label: t('Programmées', 'مبرمجة', 'Scheduled'), value: scheduled.length, color: 'text-violet-600' },
          { label: t('Publiées', 'منشورة', 'Published'), value: published.length, color: 'text-green-600' },
          { label: t('Clients sérieux', 'زبائن جديون', 'Qualified leads'), value: totals.leads, color: 'text-[#ff6f61]' },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-3xl p-5 border border-[#f0e4e2] shadow-xs">
            <span className="text-xs font-bold text-[#7a5c58]">{k.label}</span>
            <div className={`text-2xl font-black mt-1 ${k.color}`}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Onglets */}
      <div className="flex items-center gap-2 border-b border-[#f2e6e4] pb-4 overflow-x-auto">
        {tabBtn('create', <Sparkles className="w-4 h-4" />, t('Créer', 'إنشاء', 'Create'))}
        {tabBtn('review', <CheckCircle className="w-4 h-4" />, t('À valider', 'للمراجعة', 'Review'), toReview.length)}
        {tabBtn('calendar', <CalendarDays className="w-4 h-4" />, t('Calendrier', 'الجدولة', 'Calendar'), approved.length + scheduled.length)}
        {tabBtn('results', <BarChart3 className="w-4 h-4" />, t('Résultats', 'النتائج', 'Results'))}
      </div>

      {/* ---------- Créer ---------- */}
      {tab === 'create' && (
        <div className="space-y-6">
          <section className="bg-white rounded-3xl p-5 border border-[#f0e4e2] space-y-3">
            <h2 className="text-sm font-extrabold">{t('1. Choisissez le bien', '1. اختر العقار', '1. Pick the property')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[420px] overflow-y-auto pe-1">
              {properties.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPropId(p.id)}
                  className={`flex gap-3 p-2 rounded-2xl border text-start transition-all cursor-pointer ${
                    selectedPropId === p.id ? 'border-[#ff6f61] bg-[#fff0ed] ring-2 ring-[#ff6f61]/30' : 'border-[#f0e4e2] hover:bg-[#fff8f7]'
                  }`}
                >
                  <img src={p.images[0]} alt="" className="w-20 h-20 rounded-xl object-cover shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold line-clamp-2">{isAr ? p.titleAr : p.titleFr}</div>
                    <div className="text-[11px] text-[#7a5c58] mt-1">{p.city} • {p.surface} m²</div>
                    <div className="text-xs font-black text-[#ff6f61] mt-1">{isAr ? p.priceFormattedAr : p.priceFormattedFr}</div>
                    <div className="text-[10px] text-[#99807d] mt-0.5">
                      {p.images.length} {t('photos', 'صور', 'photos')}{p.videos?.length ? ` • ${p.videos.length} ${t('vidéos', 'فيديو', 'videos')}` : ''}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-3xl p-5 border border-[#f0e4e2] space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold">{t('2. Plateformes', '2. المنصات', '2. Platforms')}</h2>
              <button
                onClick={() => setPlatforms(platforms.length === PLATFORMS.length ? [] : PLATFORMS.map((p) => p.id))}
                className="text-xs font-bold text-[#ff6f61] cursor-pointer"
              >
                {platforms.length === PLATFORMS.length ? t('Tout décocher', 'إلغاء الكل', 'Clear all') : t('Tout cocher', 'تحديد الكل', 'Select all')}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((spec) => {
                const on = platforms.includes(spec.id);
                return (
                  <button
                    key={spec.id}
                    onClick={() => setPlatforms(toggle(platforms, spec.id))}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${on ? 'text-white border-transparent' : 'text-[#5a4340] border-[#f0e4e2] bg-white'}`}
                    style={on ? { background: spec.color } : undefined}
                  >
                    {spec.label}
                    {spec.kind === 'portal' && <span className="opacity-75"> • {t('portail', 'بوابة', 'portal')}</span>}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="bg-white rounded-3xl p-5 border border-[#f0e4e2] space-y-3">
            <h2 className="text-sm font-extrabold">{t('3. Langues', '3. اللغات', '3. Languages')}</h2>
            <div className="flex flex-wrap gap-2">
              {AD_LANGUAGES.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setLanguages(toggle(languages, l.id))}
                  className={`px-4 py-2 rounded-xl text-sm font-bold border cursor-pointer ${
                    languages.includes(l.id) ? 'bg-[#281715] text-white border-transparent' : 'border-[#f0e4e2] text-[#5a4340]'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </section>

          <button
            onClick={handleGenerate}
            disabled={!selectedProp || !platforms.length || !languages.length || !!generating}
            className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-[#ff6f61] text-white font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-[#ff6f61]/25 disabled:opacity-50 cursor-pointer"
          >
            {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            {generating
              ? t(`Rédaction… ${generating.done}/${generating.total}`, `جاري الكتابة… ${generating.done}/${generating.total}`, `Writing… ${generating.done}/${generating.total}`)
              : t(
                  `Générer ${platforms.length * languages.length} annonces`,
                  `إنشاء ${platforms.length * languages.length} إعلان`,
                  `Generate ${platforms.length * languages.length} ads`
                )}
          </button>
        </div>
      )}

      {/* ---------- À valider ---------- */}
      {tab === 'review' && (
        <div className="space-y-4">
          {toReview.length === 0 ? (
            <EmptyState text={t('Aucune annonce en attente. Créez-en depuis l’onglet « Créer ».', 'لا توجد إعلانات في الانتظار.', 'Nothing to review yet.')} />
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setDrafts((prev) => prev.map((d) => (d.status === 'brouillon' ? { ...d, status: 'approuvé' } : d)))}
                  className="px-4 py-2 rounded-xl bg-green-600 text-white text-xs font-bold cursor-pointer"
                >
                  {t(`Tout approuver (${toReview.length})`, `الموافقة على الكل (${toReview.length})`, `Approve all (${toReview.length})`)}
                </button>
              </div>
              {toReview.map((d) => {
                const spec = platformSpec(d.platform);
                const len = fullPostText(d).length;
                return (
                  <div key={d.id} className="bg-white rounded-3xl p-5 border border-[#f0e4e2] space-y-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <PlatformChip id={d.platform} />
                      <span className="px-2 py-0.5 rounded-md bg-[#fff0ed] text-[#ff6f61] font-bold">{langLabel(d.language)}</span>
                      <span className="text-[#7a5c58] font-semibold truncate max-w-[50%]">{d.propertyTitle}</span>
                      <span className="ms-auto text-[10px] font-bold text-[#99807d]">{d.source === 'ia' ? '✨ IA' : t('Modèle', 'نموذج', 'Template')}</span>
                    </div>
                    <textarea
                      value={d.text}
                      onChange={(e) => update(d.id, { text: e.target.value })}
                      dir={d.language === 'fr' ? 'ltr' : 'rtl'}
                      rows={Math.min(14, Math.max(4, d.text.split('\n').length + 1))}
                      className="w-full p-3 rounded-2xl bg-[#fff8f7] border border-[#f0e4e2] text-sm focus:outline-none focus:ring-2 focus:ring-[#ff6f61]"
                    />
                    {spec.maxHashtags > 0 && (
                      <input
                        value={d.hashtags.join(' ')}
                        onChange={(e) => update(d.id, { hashtags: e.target.value.split(/\s+/).filter(Boolean) })}
                        dir="auto"
                        className="w-full p-2.5 rounded-xl bg-[#fff8f7] border border-[#f0e4e2] text-xs text-[#0a66c2] focus:outline-none focus:ring-2 focus:ring-[#ff6f61]"
                      />
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[11px] font-bold ${len > spec.maxChars ? 'text-red-600' : 'text-[#99807d]'}`}>
                        {len}/{spec.maxChars}
                      </span>
                      <div className="ms-auto flex flex-wrap gap-2">
                        <button onClick={() => handleRegenerate(d)} className="px-3 py-2 rounded-xl border border-[#f0e4e2] text-xs font-bold flex items-center gap-1 cursor-pointer">
                          <RefreshCw className="w-3.5 h-3.5" /> {t('Réécrire', 'إعادة الكتابة', 'Rewrite')}
                        </button>
                        <button onClick={() => update(d.id, { status: 'rejeté' })} className="px-3 py-2 rounded-xl border border-[#f0e4e2] text-xs font-bold text-gray-600 flex items-center gap-1 cursor-pointer">
                          <XCircle className="w-3.5 h-3.5" /> {t('Rejeter', 'رفض', 'Reject')}
                        </button>
                        <button
                          onClick={() => update(d.id, { status: 'approuvé' })}
                          disabled={len > spec.maxChars}
                          className="px-3 py-2 rounded-xl bg-green-600 text-white text-xs font-bold flex items-center gap-1 disabled:opacity-40 cursor-pointer"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> {t('Approuver', 'موافقة', 'Approve')}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* ---------- Calendrier ---------- */}
      {tab === 'calendar' && (
        <div className="space-y-4">
          {/* Connexion Facebook / Instagram */}
          <div className="bg-white rounded-3xl p-5 border border-[#f0e4e2] space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-extrabold me-auto">{t('Publication automatique', 'النشر التلقائي', 'Automatic publishing')}</h2>
              {(['facebook', 'instagram'] as const).map((pl) => (
                <span key={pl} className={`px-2 py-1 rounded-lg text-[11px] font-bold ${serverStatus?.meta[pl] ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {platformSpec(pl).label} : {serverStatus?.meta[pl] ? t('connecté', 'مربوط', 'connected') : t('non connecté', 'غير مربوط', 'not connected')}
                </span>
              ))}
              {user && <SignOutButton user={user} />}
            </div>
            {isFirebaseEnabled && user === null && <LoginCard title={t('Connexion du gérant', 'دخول المدير', 'Manager sign-in')} />}
            <label className="flex items-center gap-2 text-sm font-bold">
              <input
                type="checkbox"
                checked={settings.autoPublish}
                onChange={(e) => setSettings({ ...settings, autoPublish: e.target.checked })}
                className="w-4 h-4 accent-[#ff6f61]"
              />
              {t(
                'Publier automatiquement sur Facebook et Instagram à l’heure prévue',
                'النشر تلقائياً على فيسبوك وإنستغرام في الوقت المبرمج',
                'Auto-publish to Facebook and Instagram at the scheduled time'
              )}
            </label>
            <p className="text-[11px] text-[#99807d]">
              {t(
                'Seules les annonces que vous avez approuvées sont publiées. L’application doit rester ouverte (ordinateur ou téléphone) pour publier à l’heure. Les autres réseaux restent en « copier + ouvrir ».',
                'لا يُنشر إلا ما وافقت عليه. يجب أن يبقى التطبيق مفتوحاً (حاسوب أو هاتف) لينشر في الوقت. باقي المنصات تبقى بطريقة «نسخ وفتح».',
                'Only approved ads are published. Keep the app open to publish on time. Other networks remain copy + open.'
              )}
            </p>
          </div>

          <div className="bg-white rounded-3xl p-5 border border-[#f0e4e2] flex flex-col sm:flex-row sm:items-center gap-3">
            <label className="text-sm font-bold flex items-center gap-2">
              {t('Publications par jour', 'عدد المنشورات في اليوم', 'Posts per day')}
              <input
                type="number"
                min={1}
                max={30}
                value={settings.perDay}
                onChange={(e) => setSettings({ ...settings, perDay: Math.max(1, Math.min(30, Number(e.target.value) || 1)) })}
                className="w-20 p-2 rounded-xl border border-[#f0e4e2] text-center"
              />
            </label>
            <button
              onClick={handleAutoPlan}
              disabled={!approved.length}
              className="sm:ms-auto px-4 py-2.5 rounded-xl bg-[#281715] text-white text-sm font-bold flex items-center gap-2 disabled:opacity-40 cursor-pointer"
            >
              <Clock className="w-4 h-4" />
              {t(`Planifier aux meilleures heures (${approved.length})`, `برمجة في أفضل الأوقات (${approved.length})`, `Auto-schedule (${approved.length})`)}
            </button>
          </div>

          {scheduled.length === 0 ? (
            <EmptyState text={t('Aucune publication programmée. Approuvez des annonces puis cliquez sur « Planifier ».', 'لا توجد منشورات مبرمجة.', 'No scheduled posts yet.')} />
          ) : (
            (Object.entries(scheduledByDay) as [string, AdDraft[]][]).map(([day, items]) => (
              <div key={day} className="space-y-2">
                <h3 className="text-xs font-extrabold text-[#7a5c58] uppercase">
                  {new Date(`${day}T12:00`).toLocaleDateString(isAr ? 'ar-MA' : isEn ? 'en-GB' : 'fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  <span className="ms-2 text-[#ff6f61]">({items.length})</span>
                </h3>
                {items.map((d) => {
                  const due = new Date(d.scheduledAt!).getTime() <= now;
                  return (
                    <div key={d.id} className={`bg-white rounded-2xl p-4 border flex flex-col lg:flex-row lg:items-center gap-3 ${due ? 'border-[#ff6f61] ring-2 ring-[#ff6f61]/20' : 'border-[#f0e4e2]'}`}>
                      <div className="flex items-center gap-2 lg:w-64 shrink-0">
                        <input
                          type="datetime-local"
                          value={toLocalInput(d.scheduledAt!)}
                          onChange={(e) => e.target.value && update(d.id, { scheduledAt: new Date(e.target.value).toISOString() })}
                          className="p-1.5 rounded-lg border border-[#f0e4e2] text-xs"
                        />
                        <PlatformChip id={d.platform} />
                      </div>
                      <p className="text-xs text-[#5a4340] line-clamp-2 flex-1" dir={d.language === 'fr' ? 'ltr' : 'rtl'}>{d.text}</p>
                      <div className="flex flex-wrap gap-2 shrink-0">
                        <IconBtn onClick={() => copyText(d)} title={t('Copier', 'نسخ', 'Copy')}><Copy className="w-4 h-4" /></IconBtn>
                        <IconBtn onClick={() => handleVisual(d, 'poster')} title={t('Affiche', 'صورة', 'Poster')} busy={busyVisual === `${d.id}-poster`}>
                          <ImageIcon className="w-4 h-4" />
                        </IconBtn>
                        {canRecordVideo() && (
                          <IconBtn onClick={() => handleVisual(d, 'video')} title={t('Vidéo', 'فيديو', 'Video')} busy={busyVisual === `${d.id}-video`}>
                            <Video className="w-4 h-4" />
                          </IconBtn>
                        )}
                        <IconBtn onClick={() => update(d.id, { status: 'approuvé', scheduledAt: undefined })} title={t('Retirer du calendrier', 'إزالة من الجدولة', 'Unschedule')}>
                          <Trash2 className="w-4 h-4" />
                        </IconBtn>
                        <button
                          onClick={() => handlePublish(d)}
                          disabled={publishing === d.id}
                          className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer ${due ? 'bg-[#ff6f61] text-white' : 'bg-[#fff0ed] text-[#ff6f61]'}`}
                        >
                          {publishing === d.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                          {canAutoPublish(d.platform) ? t('Publier maintenant', 'انشر الآن', 'Publish now') : t('Publier', 'نشر', 'Publish')}
                          {!canAutoPublish(d.platform) && <ExternalLink className="w-3 h-3 opacity-70" />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
          <p className="text-[11px] text-[#99807d]">
            {t(
              'Facebook et Instagram (une fois connectés) : publication directe avec l’affiche. Autres réseaux : « Publier » copie le texte et ouvre la plateforme ; téléchargez l’affiche ou la vidéo pour l’ajouter au post.',
              'فيسبوك وإنستغرام (بعد الربط): نشر مباشر مع الصورة. باقي المنصات: «نشر» ينسخ النص ويفتح المنصة، وحمّل الصورة أو الفيديو لإضافتها.',
              'Facebook and Instagram (once connected): direct publishing with the poster. Other networks: “Publish” copies the text and opens the platform.'
            )}
          </p>
        </div>
      )}

      {/* ---------- Résultats ---------- */}
      {tab === 'results' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {STAT_LABELS.map((s) => (
              <div key={s.key} className="bg-white rounded-2xl p-4 border border-[#f0e4e2]">
                <div className="text-[11px] font-bold text-[#7a5c58]">{t(s.fr, s.ar, s.en)}</div>
                <div className="text-xl font-black mt-1">{totals[s.key].toLocaleString()}</div>
              </div>
            ))}
          </div>

          {byPlatform.length > 0 && (
            <div className="bg-white rounded-3xl border border-[#f0e4e2] overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-[#fff8f7] text-[#7a5c58]">
                  <tr>
                    <th className="p-3 text-start">{t('Plateforme', 'المنصة', 'Platform')}</th>
                    <th className="p-3">{t('Posts', 'منشورات', 'Posts')}</th>
                    {STAT_LABELS.map((s) => <th key={s.key} className="p-3">{t(s.fr, s.ar, s.en)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {byPlatform.map((r) => (
                    <tr key={r.spec.id} className="border-t border-[#f2e6e4] text-center">
                      <td className="p-3 text-start"><PlatformChip id={r.spec.id} /></td>
                      <td className="p-3 font-bold">{r.count}</td>
                      {STAT_LABELS.map((s) => <td key={s.key} className="p-3">{r.stats[s.key].toLocaleString()}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {published.length === 0 ? (
            <EmptyState text={t('Les résultats apparaîtront ici après vos premières publications.', 'ستظهر النتائج هنا بعد أول منشوراتك.', 'Results will appear after your first posts.')} />
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-[#7a5c58]">
                {t(
                  'Mettez à jour les chiffres de chaque post (visibles dans les statistiques de chaque réseau).',
                  'حدّث أرقام كل منشور (من إحصائيات كل منصة).',
                  'Update each post’s numbers from the network’s insights.'
                )}
              </p>
              {published.map((d) => (
                <div key={d.id} className="bg-white rounded-2xl p-4 border border-[#f0e4e2] space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <PlatformChip id={d.platform} />
                    <span className="font-bold truncate max-w-[60%]">{d.propertyTitle}</span>
                    <span className="ms-auto text-[#99807d]">{d.publishedAt && fmtDate(d.publishedAt)}</span>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {STAT_LABELS.map((s) => (
                      <label key={s.key} className="text-[10px] font-bold text-[#7a5c58] space-y-1">
                        <span>{t(s.fr, s.ar, s.en)}</span>
                        <input
                          type="number"
                          min={0}
                          value={d.stats[s.key]}
                          onChange={(e) => update(d.id, { stats: { ...d.stats, [s.key]: Math.max(0, Number(e.target.value) || 0) } })}
                          className="w-full p-2 rounded-lg border border-[#f0e4e2] text-sm text-[#281715]"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {drafts.length > 0 && (
            <div className="bg-white rounded-3xl p-5 border border-[#f0e4e2]">
              <h3 className="text-sm font-extrabold mb-3">{t('Historique', 'السجل', 'History')}</h3>
              <div className="flex flex-wrap gap-2">
                {(['brouillon', 'approuvé', 'programmé', 'publié', 'rejeté'] as const).map((s) => (
                  <span key={s} className={`px-3 py-1 rounded-lg text-xs font-bold ${STATUS_STYLE[s]}`}>
                    {s} : {drafts.filter((d) => d.status === s).length}
                  </span>
                ))}
                <button
                  onClick={() => setDrafts((prev) => prev.filter((d) => d.status !== 'rejeté'))}
                  className="ms-auto text-xs font-bold text-[#99807d] hover:text-red-600 cursor-pointer"
                >
                  {t('Supprimer les rejetées', 'حذف المرفوضة', 'Delete rejected')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 inset-x-0 mx-auto w-fit max-w-[90vw] bg-[#281715] text-white text-sm font-bold px-5 py-3 rounded-2xl shadow-xl z-50">
          {toast}
        </div>
      )}
    </div>
  );
};

const PlatformChip: React.FC<{ id: AdPlatform }> = ({ id }) => {
  const spec = platformSpec(id);
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold text-white" style={{ background: spec.color }}>
      {spec.label}
    </span>
  );
};

const EmptyState: React.FC<{ text: string }> = ({ text }) => (
  <div className="text-center py-14 bg-white rounded-3xl border border-[#f0e4e2] p-8 text-xs text-[#7a5c58]">{text}</div>
);

const IconBtn: React.FC<{ onClick: () => void; title: string; busy?: boolean; children: React.ReactNode }> = ({ onClick, title, busy, children }) => (
  <button
    onClick={onClick}
    title={title}
    disabled={busy}
    className="p-2 rounded-xl border border-[#f0e4e2] text-[#5a4340] hover:bg-[#fff0ed] hover:text-[#ff6f61] disabled:opacity-50 cursor-pointer"
  >
    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : children}
  </button>
);
