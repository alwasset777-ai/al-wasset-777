// Film « مجموعة الوسيط 777 » envoyé à chaque abonné (généré par tools/film d'après le scénario PDF, voir docs/VIDEO-AR.md).
// Trois langues (arabe, français, anglais), chacune en film complet et en version courte.
// Envoi : lien WhatsApp pré-rempli par client, ou partage du fichier vidéo lui-même (liste de diffusion WhatsApp…).
import { agencyProfile } from '../data/agencyProfile';
import type { Language } from '../types';

export const WELCOME_VIDEO_PATH = '/videos/film-al-wasset-777.mp4'; // film complet (34 scènes, étapes et astuces)
export const WELCOME_VIDEO_SHORT_PATH = '/videos/film-al-wasset-777-court.mp4'; // version courte (ouverture + 7 scènes + fin)
export const WELCOME_VIDEO_POSTER = '/videos/film-al-wasset-777.jpg';
export const WELCOME_VIDEO_FILENAME = 'مجموعة-الوسيط-777.mp4';
export const WELCOME_VIDEO_MINUTES = { full: 36, short: 5 };
export const WELCOME_ANCHOR = 'bienvenue';

export type WelcomeVideo = { full: string; short: string; poster: string; filename: string; minutes: { full: number; short: number } };
export const WELCOME_VIDEOS: Record<Language, WelcomeVideo> = {
  ar: { full: WELCOME_VIDEO_PATH, short: WELCOME_VIDEO_SHORT_PATH, poster: WELCOME_VIDEO_POSTER, filename: WELCOME_VIDEO_FILENAME, minutes: WELCOME_VIDEO_MINUTES },
  fr: {
    full: '/videos/film-al-wasset-777-fr.mp4',
    short: '/videos/film-al-wasset-777-fr-court.mp4',
    poster: '/videos/film-al-wasset-777-fr.jpg',
    filename: 'Groupe-Al-Wassit-777.mp4',
    minutes: { full: 33, short: 4 },
  },
  en: {
    full: '/videos/film-al-wasset-777-en.mp4',
    short: '/videos/film-al-wasset-777-en-court.mp4',
    poster: '/videos/film-al-wasset-777-en.jpg',
    filename: 'Al-Wassit-777-Group.mp4',
    minutes: { full: 32, short: 4 },
  },
};
export const FILM_LANGUAGES: { code: Language; label: string }[] = [
  { code: 'ar', label: 'العربية' },
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
];

// Lien public (toujours le site en ligne, même si le gérant travaille en local).
// …/#bienvenue → film arabe ; …/#bienvenue-fr, …/#bienvenue-en → film français / anglais.
export const welcomeAnchor = (lang: Language = 'ar') => (lang === 'ar' ? WELCOME_ANCHOR : `${WELCOME_ANCHOR}-${lang}`);
export const welcomeVideoPageUrl = `${agencyProfile.siteUrl}/#${WELCOME_ANCHOR}`;
export const welcomeVideoFileUrl = `${agencyProfile.siteUrl}${WELCOME_VIDEO_PATH}`;
export const welcomePageUrl = (lang: Language = 'ar') => `${agencyProfile.siteUrl}/#${welcomeAnchor(lang)}`;

// 06…, +212 6…, 00212 6… → 2126… (format attendu par wa.me). Vide si le numéro est inutilisable.
export function toWhatsappNumber(phone: string): string {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0')) d = '212' + d.slice(1);
  if (d.length === 9 && /^[5-7]/.test(d)) d = '212' + d;
  return d.length >= 11 ? d : '';
}

export function welcomeVideoMessage(name?: string, lang: Language = 'ar'): string {
  const who = name?.trim() ? ` ${name.trim()}` : '';
  const v = WELCOME_VIDEOS[lang];
  const phones = `📞 ${agencyProfile.phonesLocal.join(' – ')}`;
  if (lang === 'fr') {
    return [
      `Bonjour${who},`,
      'Bienvenue dans le Groupe Al Wassit 777 🏠',
      `Regardez le film « Al Wassit 777… l'avenir de votre métier commence maintenant » (${v.minutes.full} min), avec l'application expliquée pas à pas :`,
      `▶️ ${welcomePageUrl(lang)}`,
      '🎁 Adhésion gratuite cette année — WhatsApp 0777 777 959',
      phones,
      `« ${agencyProfile.sloganFr} »`,
    ].join('\n');
  }
  if (lang === 'en') {
    return [
      `Hello${who},`,
      'Welcome to the Al Wassit 777 Group 🏠',
      `Watch the film "Al Wassit 777… the future of your profession starts now" (${v.minutes.full} min), with the app explained step by step:`,
      `▶️ ${welcomePageUrl(lang)}`,
      '🎁 Joining is free this year — WhatsApp 0777 777 959',
      phones,
    ].join('\n');
  }
  return [
    `السلام عليكم${who}،`,
    'مرحباً بك في مجموعة الوسيط 777 🏠',
    `شاهد فيلم «الوسيط 777… مستقبل مهنتك يبدأ الآن» (${WELCOME_VIDEO_MINUTES.full} دقيقة)، وفيه شرح التطبيق خطوة بخطوة:`,
    `▶️ ${welcomeVideoPageUrl}`,
    '🎁 الانضمام مجاني هذه السنة — واتساب 0777 777 959',
    phones,
    `« ${agencyProfile.sloganAr} »`,
  ].join('\n');
}

export function welcomeVideoWhatsappUrl(phone: string, name?: string, lang: Language = 'ar'): string {
  const num = toWhatsappNumber(phone);
  const text = encodeURIComponent(welcomeVideoMessage(name, lang));
  return num ? `https://wa.me/${num}?text=${text}` : `https://wa.me/?text=${text}`;
}

export type ShareOutcome = 'file' | 'link' | 'copied' | 'cancelled' | 'retry';

const videoFiles: Partial<Record<Language, File>> = {};

// Partage le fichier MP4 de la version courte (téléphone) avec le lien du film complet ; sinon le lien ; sinon copie le message.
// Le premier appel télécharge la vidéo : si le navigateur refuse alors le partage (délai trop long
// après le clic), on renvoie « retry » et un second clic partage immédiatement.
export async function shareWelcomeVideo(lang: Language = 'ar'): Promise<ShareOutcome> {
  const text = welcomeVideoMessage(undefined, lang);
  const v = WELCOME_VIDEOS[lang];
  let videoFile = videoFiles[lang] ?? null;
  if (!navigator.share) {
    await navigator.clipboard?.writeText(text).catch(() => undefined);
    return 'copied';
  }
  try {
    if (!videoFile) {
      const blob = await (await fetch(v.short)).blob();
      videoFile = videoFiles[lang] = new File([blob], v.filename, { type: 'video/mp4' });
    }
    if (navigator.canShare?.({ files: [videoFile] })) {
      await navigator.share({ files: [videoFile], text });
      return 'file';
    }
    await navigator.share({ text, url: welcomePageUrl(lang) });
    return 'link';
  } catch (e) {
    const name = (e as Error).name;
    if (name === 'AbortError') return 'cancelled';
    if (name === 'NotAllowedError' && videoFile) return 'retry';
    await navigator.clipboard?.writeText(text).catch(() => undefined);
    return 'copied';
  }
}
