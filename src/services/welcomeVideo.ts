// Film « مجموعة الوسيط 777 » envoyé à chaque abonné (généré par tools/film d'après le scénario PDF, voir docs/VIDEO-AR.md).
// Envoi : lien WhatsApp pré-rempli par client, ou partage du fichier vidéo lui-même (liste de diffusion WhatsApp…).
import { agencyProfile } from '../data/agencyProfile';

export const WELCOME_VIDEO_PATH = '/videos/film-al-wasset-777.mp4'; // film complet (34 scènes, étapes et astuces)
export const WELCOME_VIDEO_SHORT_PATH = '/videos/film-al-wasset-777-court.mp4'; // version courte (ouverture + 7 scènes + fin)
export const WELCOME_VIDEO_POSTER = '/videos/film-al-wasset-777.jpg';
export const WELCOME_VIDEO_FILENAME = 'مجموعة-الوسيط-777.mp4';
export const WELCOME_VIDEO_MINUTES = { full: 25, short: 3 }; // mis à jour après le rendu
export const WELCOME_ANCHOR = 'bienvenue';

// Lien public (toujours le site en ligne, même si le gérant travaille en local).
export const welcomeVideoPageUrl = `${agencyProfile.siteUrl}/#${WELCOME_ANCHOR}`;
export const welcomeVideoFileUrl = `${agencyProfile.siteUrl}${WELCOME_VIDEO_PATH}`;

// 06…, +212 6…, 00212 6… → 2126… (format attendu par wa.me). Vide si le numéro est inutilisable.
export function toWhatsappNumber(phone: string): string {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0')) d = '212' + d.slice(1);
  if (d.length === 9 && /^[5-7]/.test(d)) d = '212' + d;
  return d.length >= 11 ? d : '';
}

export function welcomeVideoMessage(name?: string): string {
  const who = name?.trim() ? ` ${name.trim()}` : '';
  return [
    `السلام عليكم${who}،`,
    'مرحباً بك في مجموعة الوسيط 777 🏠',
    `شاهد فيلم «الوسيط 777… مستقبل مهنتك يبدأ الآن» (${WELCOME_VIDEO_MINUTES.full} دقيقة)، وفيه شرح التطبيق خطوة بخطوة:`,
    `▶️ ${welcomeVideoPageUrl}`,
    '🎁 الانضمام مجاني هذه السنة — واتساب 0777 777 959',
    `📞 ${agencyProfile.phonesLocal.join(' – ')}`,
    `« ${agencyProfile.sloganAr} »`,
  ].join('\n');
}

export function welcomeVideoWhatsappUrl(phone: string, name?: string): string {
  const num = toWhatsappNumber(phone);
  const text = encodeURIComponent(welcomeVideoMessage(name));
  return num ? `https://wa.me/${num}?text=${text}` : `https://wa.me/?text=${text}`;
}

export type ShareOutcome = 'file' | 'link' | 'copied' | 'cancelled' | 'retry';

let videoFile: File | null = null;

// Partage le fichier MP4 de la version courte (téléphone) avec le lien du film complet ; sinon le lien ; sinon copie le message.
// Le premier appel télécharge la vidéo : si le navigateur refuse alors le partage (délai trop long
// après le clic), on renvoie « retry » et un second clic partage immédiatement.
export async function shareWelcomeVideo(): Promise<ShareOutcome> {
  const text = welcomeVideoMessage();
  if (!navigator.share) {
    await navigator.clipboard?.writeText(text).catch(() => undefined);
    return 'copied';
  }
  try {
    if (!videoFile) {
      const blob = await (await fetch(WELCOME_VIDEO_SHORT_PATH)).blob();
      videoFile = new File([blob], WELCOME_VIDEO_FILENAME, { type: 'video/mp4' });
    }
    if (navigator.canShare?.({ files: [videoFile] })) {
      await navigator.share({ files: [videoFile], text });
      return 'file';
    }
    await navigator.share({ text, url: welcomeVideoPageUrl });
    return 'link';
  } catch (e) {
    const name = (e as Error).name;
    if (name === 'AbortError') return 'cancelled';
    if (name === 'NotAllowedError' && videoFile) return 'retry';
    await navigator.clipboard?.writeText(text).catch(() => undefined);
    return 'copied';
  }
}
