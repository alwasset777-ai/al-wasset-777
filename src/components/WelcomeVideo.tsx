import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Copy, Film, MessageCircle, Share2 } from 'lucide-react';
import { ClientLead, Language } from '../types';
import {
  WELCOME_ANCHOR,
  WELCOME_VIDEO_PATH,
  WELCOME_VIDEO_POSTER,
  shareWelcomeVideo,
  welcomeVideoMessage,
  welcomeVideoWhatsappUrl,
  type ShareOutcome,
} from '../services/welcomeVideo';

const Player: React.FC<{ className?: string }> = ({ className = '' }) => (
  <video
    src={WELCOME_VIDEO_PATH}
    poster={WELCOME_VIDEO_POSTER}
    controls
    playsInline
    preload="none"
    className={`w-full aspect-[9/16] rounded-3xl bg-[#241311] object-cover shadow-lg ${className}`}
  />
);

// Section publique (page d'accueil) : les abonnés regardent la vidéo dans l'application.
export const WelcomeVideoSection: React.FC<{ language: Language }> = ({ language }) => {
  const isAr = language === 'ar';
  const isEn = language === 'en';

  // Lien reçu par WhatsApp (…/#bienvenue) : on fait défiler jusqu'à la vidéo.
  useEffect(() => {
    if (window.location.hash === `#${WELCOME_ANCHOR}`) {
      setTimeout(() => document.getElementById(WELCOME_ANCHOR)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
    }
  }, []);

  return (
    <div id={WELCOME_ANCHOR} className="rounded-3xl bg-[#2a1613] text-white p-6 sm:p-10 flex flex-col md:flex-row items-center gap-8 scroll-mt-24">
      <div className="w-full max-w-[300px] shrink-0">
        <Player />
      </div>
      <div className="space-y-4 text-center md:text-start" dir={isAr ? 'rtl' : 'ltr'}>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ff6f61]/20 text-[#ff9a8b] text-xs font-bold">
          <Film className="w-3.5 h-3.5" />
          <span>{isAr ? 'فيديو الترحيب – 3 دقائق' : isEn ? 'Welcome video – 3 min' : 'Vidéo de bienvenue – 3 min'}</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
          {isAr ? 'مرحباً بك في عائلة الوسيط 777' : isEn ? 'Welcome to the Al Wassit 777 family' : 'Bienvenue dans la famille Al Wassit 777'}
        </h2>
        <p className="text-sm text-[#e8cfcb] leading-relaxed max-w-xl">
          {isAr
            ? 'تعرّف على مكتبنا بمكناس، خدماتنا، وكيف تستعمل التطبيق: البحث عن العقارات، حجز الزيارات، المساعد الذكي «وكيل الوسيط 777» وتثبيت التطبيق على هاتفك.'
            : isEn
            ? 'Discover our Meknès office, our services and how to use the app: property search, visit booking, the “Al Wassit 777” smart assistant and installing the app on your phone.'
            : 'Découvrez notre agence à Meknès, nos services et comment utiliser l’application : recherche de biens, réservation de visites, l’assistant intelligent « Al Wassit 777 » et l’installation sur votre téléphone.'}
        </p>
        <a
          href={welcomeVideoWhatsappUrl('')}
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
    retry: 'الفيديو جاهز ✅ اضغط مرة أخرى على «مشاركة ملف الفيديو».',
    cancelled: null,
  };

  const share = async () => {
    setBusy(true);
    setNotice('جاري تجهيز الفيديو…');
    const outcome = await shareWelcomeVideo();
    setBusy(false);
    setNotice(notices[outcome]);
  };

  const copy = async () => {
    await navigator.clipboard?.writeText(welcomeVideoMessage()).catch(() => undefined);
    setNotice(notices.copied);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6" dir="rtl">
      <div className="space-y-3">
        <Player />
        <a href={WELCOME_VIDEO_PATH} download className="block text-center text-xs font-bold text-[#7a5c58] hover:text-[#ff6f61]">
          تحميل ملف الفيديو (MP4)
        </a>
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-3xl p-5 border border-[#f0e4e2] shadow-sm space-y-3">
          <h2 className="text-base font-extrabold text-[#281715] flex items-center gap-2">
            <Film className="w-5 h-5 text-[#ff6f61]" /> فيديو الترحيب لكل مشترك
          </h2>
          <p className="text-xs text-[#7a5c58] leading-relaxed">
            فيديو تعريفي (3 دقائق و33 ثانية) بالمكتب، الخدمات ومزايا التطبيق. أرسله لكل زبون بضغطة على «واتساب» بجانب اسمه،
            أو شارك ملف الفيديو مباشرة في قائمة بث واتساب لإرساله للجميع دفعة واحدة.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={share}
              disabled={busy}
              className="px-4 py-2.5 rounded-xl bg-[#ff6f61] hover:bg-[#e8584a] text-white text-xs font-bold flex items-center gap-2 disabled:opacity-60 cursor-pointer"
            >
              <Share2 className="w-4 h-4" /> مشاركة ملف الفيديو
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
              {clients.length ? 'توصل جميع الزبناء بالفيديو 🎉' : 'لا يوجد زبناء بعد. أضفهم من «إضافة زبون جديد».'}
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
                      href={welcomeVideoWhatsappUrl(c.phone, c.name)}
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
