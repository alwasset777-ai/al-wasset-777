import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Copy, Film, MessageCircle, Share2 } from 'lucide-react';
import { ClientLead, Language } from '../types';
import {
  FILM_LANGUAGES,
  WELCOME_ANCHOR,
  WELCOME_VIDEOS,
  shareWelcomeVideo,
  welcomeAnchor,
  welcomeVideoMessage,
  welcomeVideoWhatsappUrl,
  type ShareOutcome,
} from '../services/welcomeVideo';

const Player: React.FC<{ className?: string; short?: boolean; lang?: Language }> = ({ className = '', short = false, lang = 'ar' }) => (
  <video
    key={`${lang}-${short ? 'short' : 'full'}`}
    src={short ? WELCOME_VIDEOS[lang].short : WELCOME_VIDEOS[lang].full}
    poster={WELCOME_VIDEOS[lang].poster}
    controls
    playsInline
    preload="none"
    className={`w-full aspect-[9/16] rounded-3xl bg-[#241311] object-cover shadow-lg ${className}`}
  />
);

// Choix de la langue du film (arabe, français, anglais).
const LangChips: React.FC<{ value: Language; onChange: (l: Language) => void; dark?: boolean }> = ({ value, onChange, dark = false }) => (
  <div className="grid grid-cols-3 gap-2 text-xs font-bold">
    {FILM_LANGUAGES.map((l) => (
      <button
        key={l.code}
        onClick={() => onChange(l.code)}
        className={`py-2 rounded-xl cursor-pointer ${
          value === l.code ? 'bg-[#ff6f61] text-white' : dark ? 'bg-white/10 text-white' : 'bg-[#fff8f7] border border-[#f0e4e2] text-[#281715]'
        }`}
      >
        {l.label}
      </button>
    ))}
  </div>
);

// Section publique (page d'accueil) : les abonnés regardent la vidéo dans l'application.
export const WelcomeVideoSection: React.FC<{ language: Language }> = ({ language }) => {
  const isAr = language === 'ar';
  const isEn = language === 'en';
  const [short, setShort] = useState(false);
  const [filmLang, setFilmLang] = useState<Language>(language);
  const M = WELCOME_VIDEOS[filmLang].minutes;

  // Le film suit la langue du site (on peut ensuite en choisir une autre).
  useEffect(() => setFilmLang(language), [language]);

  // Lien reçu par WhatsApp (…/#bienvenue, #bienvenue-fr, #bienvenue-en) : film dans cette langue, puis défilement jusqu'à la vidéo.
  useEffect(() => {
    const lang = FILM_LANGUAGES.find((l) => window.location.hash === `#${welcomeAnchor(l.code)}`)?.code;
    if (lang) {
      setFilmLang(lang);
      setTimeout(() => document.getElementById(WELCOME_ANCHOR)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
    }
  }, []);

  return (
    <div id={WELCOME_ANCHOR} className="rounded-3xl bg-[#2a1613] text-white p-6 sm:p-10 flex flex-col md:flex-row items-center gap-8 scroll-mt-24">
      <div className="w-full max-w-[300px] shrink-0">
        <Player short={short} lang={filmLang} />
        <div className="mt-3">
          <LangChips value={filmLang} onChange={setFilmLang} dark />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs font-bold">
          <button onClick={() => setShort(false)} className={`py-2 rounded-xl cursor-pointer ${!short ? 'bg-[#d9b25f] text-[#2b1606]' : 'bg-white/10 text-white'}`}>
            {isAr ? `الفيلم الكامل (${M.full} د)` : isEn ? `Full film (${M.full} min)` : `Film complet (${M.full} min)`}
          </button>
          <button onClick={() => setShort(true)} className={`py-2 rounded-xl cursor-pointer ${short ? 'bg-[#d9b25f] text-[#2b1606]' : 'bg-white/10 text-white'}`}>
            {isAr ? `النسخة القصيرة (${M.short} د)` : isEn ? `Short version (${M.short} min)` : `Version courte (${M.short} min)`}
          </button>
        </div>
      </div>
      <div className="space-y-4 text-center md:text-start" dir={isAr ? 'rtl' : 'ltr'}>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ff6f61]/20 text-[#ff9a8b] text-xs font-bold">
          <Film className="w-3.5 h-3.5" />
          <span>{isAr ? 'الفيلم الترويجي التعليمي' : isEn ? 'Promotional & tutorial film' : 'Film promotionnel et tutoriel'}</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
          {isAr ? 'الوسيط 777… مستقبل مهنتك يبدأ الآن' : isEn ? 'Al Wassit 777: the future of your profession starts now' : 'Al Wassit 777 : l’avenir de votre métier commence maintenant'}
        </h2>
        <p className="text-sm text-[#e8cfcb] leading-relaxed max-w-xl">
          {isAr
            ? 'تطبيق مجموعة الوسيط 777 مشهدا بمشهد: مكتبك العقاري الرقمي، المطابقة الذكية، المساعد الذكي، شبكة 777 وكالة و777 وسيطا و1554 شركة، المشاريع والتمويل، الهبة والحلول القانونية — مع شرح كل خدمة خطوة بخطوة. الانضمام مجاني هذه السنة.'
            : isEn
            ? 'The Al Wassit 777 Group app scene by scene: your digital real-estate office, smart matching, the AI assistant, the network of 777 agencies, 777 brokers and 1554 companies, projects and financing, Al Hiba and legal solutions — every service explained step by step. Joining is free this year.'
            : 'L’application du Groupe Al Wassit 777 scène par scène : votre agence immobilière numérique, le matching intelligent, l’assistant IA, le réseau de 777 agences, 777 intermédiaires et 1554 entreprises, projets et financement, Al Hiba et solutions juridiques — chaque service expliqué étape par étape. Adhésion gratuite cette année.'}
        </p>
        <a
          href={welcomeVideoWhatsappUrl('', undefined, filmLang)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#25d366] hover:bg-[#1fb757] text-white text-sm font-bold"
        >
          <Share2 className="w-4 h-4" />
          <span>{isAr ? 'شارك الفيديو مع أصدقائك' : isEn ? 'Share with friends' : 'Partager avec vos proches'}</span>
        </a>
      </div>
    </div>
  );
};

// Panneau du gérant (CRM) : envoyer la vidéo à chaque client, avec suivi « envoyé ».
export const WelcomeVideoPanel: React.FC<{
  clients: ClientLead[];
  onMarkSent: (id: number) => void;
}> = ({ clients, onMarkSent }) => {
  const [onlyPending, setOnlyPending] = useState(true);
  const [lang, setLang] = useState<Language>('ar');
  const V = WELCOME_VIDEOS[lang];
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sentCount = clients.filter((c) => c.welcomeVideoSentAt).length;
  const shown = useMemo(
    () => (onlyPending ? clients.filter((c) => !c.welcomeVideoSentAt) : clients),
    [clients, onlyPending]
  );

  const notices: Record<ShareOutcome, string | null> = {
    file: 'تم فتح المشاركة: اختر واتساب ثم «قائمة البث» أو المجموعة لإرسال الفيديو للجميع دفعة واحدة.',
    link: 'تمت مشاركة الرابط.',
    copied: 'تم نسخ الرسالة مع رابط الفيديو. ألصقها في واتساب.',
    retry: 'الفيديو جاهز ✅ اضغط مرة أخرى على «مشاركة النسخة القصيرة».',
    cancelled: null,
  };

  const share = async () => {
    setBusy(true);
    setNotice('جاري تجهيز الفيديو…');
    const outcome = await shareWelcomeVideo(lang);
    setBusy(false);
    setNotice(notices[outcome]);
  };

  const copy = async () => {
    await navigator.clipboard?.writeText(welcomeVideoMessage(undefined, lang)).catch(() => undefined);
    setNotice(notices.copied);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6" dir="rtl">
      <div className="space-y-3">
        <Player lang={lang} />
        <LangChips value={lang} onChange={setLang} />
        <a href={V.full} download className="block text-center text-xs font-bold text-[#7a5c58] hover:text-[#ff6f61]">
          تحميل الفيلم الكامل (MP4)
        </a>
        <a href={V.short} download className="block text-center text-xs font-bold text-[#7a5c58] hover:text-[#ff6f61]">
          تحميل النسخة القصيرة (MP4)
        </a>
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-3xl p-5 border border-[#f0e4e2] shadow-sm space-y-3">
          <h2 className="text-base font-extrabold text-[#281715] flex items-center gap-2">
            <Film className="w-5 h-5 text-[#ff6f61]" /> فيلم مجموعة الوسيط 777 لكل مشترك
          </h2>
          <p className="text-xs text-[#7a5c58] leading-relaxed">
            فيلم «الوسيط 777… مستقبل مهنتك يبدأ الآن» ({V.minutes.full} دقيقة، 34 مشهدا مع الشرح خطوة بخطوة) ونسخة قصيرة ({V.minutes.short} دقائق)، بالعربية والفرنسية والإنجليزية.
            اختر لغة الفيلم أولا، ثم أرسل الرابط لكل مشترك بضغطة على «واتساب» بجانب اسمه (الرسالة تُكتب بنفس اللغة)، أو شارك ملف النسخة القصيرة مباشرة في قائمة بث واتساب لإرساله للجميع دفعة واحدة.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={share}
              disabled={busy}
              className="px-4 py-2.5 rounded-xl bg-[#ff6f61] hover:bg-[#e8584a] text-white text-xs font-bold flex items-center gap-2 disabled:opacity-60 cursor-pointer"
            >
              <Share2 className="w-4 h-4" /> مشاركة النسخة القصيرة
            </button>
            <button
              onClick={copy}
              className="px-4 py-2.5 rounded-xl bg-[#fff8f7] border border-[#f0e4e2] text-[#281715] text-xs font-bold flex items-center gap-2 cursor-pointer"
            >
              <Copy className="w-4 h-4" /> نسخ الرسالة والرابط
            </button>
          </div>
          {notice && <p className="text-xs font-bold text-[#2f7a4c]">{notice}</p>}
        </div>

        <div className="bg-white rounded-3xl p-5 border border-[#f0e4e2] shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm font-extrabold text-[#281715]">
              تم الإرسال إلى {sentCount} من {clients.length} زبون
            </div>
            <label className="flex items-center gap-2 text-xs font-bold text-[#7a5c58] cursor-pointer">
              <input type="checkbox" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} />
              إظهار من لم يتوصل بعد فقط
            </label>
          </div>
          <div className="h-2 rounded-full bg-[#f2e6e4] overflow-hidden">
            <div className="h-full bg-[#25d366]" style={{ width: `${clients.length ? (sentCount / clients.length) * 100 : 0}%` }} />
          </div>

          {shown.length === 0 ? (
            <p className="text-xs text-[#7a5c58] py-4 text-center">
              {clients.length ? 'توصل جميع الزبناء بالفيلم 🎉' : 'لا يوجد زبناء بعد. أضفهم من «إضافة زبون جديد».'}
            </p>
          ) : (
            <ul className="divide-y divide-[#f2e6e4]">
              {shown.map((c) => (
                <li key={c.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold text-[#281715] truncate">{c.name}</div>
                    <div className="text-[11px] text-[#99807d] font-mono" dir="ltr">{c.phone}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {c.welcomeVideoSentAt && (
                      <span className="text-[11px] font-bold text-[#2f7a4c] flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" />
                        {new Date(c.welcomeVideoSentAt).toLocaleDateString('ar-MA')}
                      </span>
                    )}
                    <a
                      href={welcomeVideoWhatsappUrl(c.phone, c.name, lang)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => onMarkSent(c.id)}
                      className="px-3 py-2 rounded-xl bg-[#25d366] hover:bg-[#1fb757] text-white text-xs font-bold flex items-center gap-1.5"
                    >
                      <MessageCircle className="w-3.5 h-3.5" /> واتساب
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
