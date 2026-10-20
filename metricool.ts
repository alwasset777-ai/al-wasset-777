// Programmation des publications via Metricool (Facebook, Instagram, TikTok, YouTube, Threads,
// LinkedIn, X, Google Business, Bluesky). Metricool publie à l'heure prévue, même si l'application est fermée.
// Le jeton reste côté serveur (variables d'environnement), jamais dans le navigateur.
import type { StudioNetwork } from './src/services/studioPlatforms.js';

const API = process.env.METRICOOL_API_URL || 'https://app.metricool.com/api';
const TOKEN = process.env.METRICOOL_USER_TOKEN;
// Identifiants du compte « Agence al wasset 777 immobiliere » (non secrets), modifiables par variables.
const USER_ID = process.env.METRICOOL_USER_ID || '5289329';
const BLOG_ID = process.env.METRICOOL_BLOG_ID || '6869628';
const TIMEZONE = 'Africa/Casablanca';

export const metricoolEnabled = Boolean(TOKEN);

export interface StudioPostInput {
  network: StudioNetwork;
  text: string;
  title?: string; // YouTube / TikTok
  images: string[]; // liens publics (Firebase Storage)
  video?: string; // lien public
  vertical?: boolean; // vidéo verticale → Short / Reel
  dateTime?: string; // "YYYY-MM-DDTHH:mm" heure du Maroc ; absent = dans 5 minutes
}

const qs = () => new URLSearchParams({ blogId: BLOG_ID, userId: USER_ID });

// Heure du Maroc au format attendu par Metricool, décalée de `minutes`.
function casablancaNow(minutes: number): string {
  const d = new Date(Date.now() + minutes * 60_000);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(d).map((p) => [p.type, p.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}

// Metricool héberge lui-même le média (étape recommandée avant la programmation).
async function normalizeMedia(url: string): Promise<string> {
  try {
    const res = await fetch(`${API}/actions/normalize/image/url?${qs()}&url=${encodeURIComponent(url)}`, {
      headers: { 'X-Mc-Auth': TOKEN! },
    });
    if (!res.ok) return url;
    const raw = (await res.text()).trim();
    try {
      const data = JSON.parse(raw);
      const found = typeof data === 'string' ? data : data?.url || data?.data?.url || data?.data;
      return typeof found === 'string' && found.startsWith('http') ? found : url;
    } catch {
      return raw.startsWith('http') ? raw : url;
    }
  } catch {
    return url;
  }
}

function mediaFor(p: StudioPostInput): string[] {
  switch (p.network) {
    case 'youtube':
      return p.video ? [p.video] : [];
    case 'instagram':
    case 'facebook':
    case 'tiktok':
      return p.video ? [p.video] : p.images.slice(0, 10);
    case 'bluesky':
      return p.images.slice(0, 4);
    case 'threads':
    case 'linkedin':
      return p.images.slice(0, 10);
    case 'twitter':
      return p.images.slice(0, 4);
    case 'gmb':
      return p.images.slice(0, 1);
  }
}

function networkData(p: StudioPostInput): Record<string, unknown> {
  const reel = Boolean(p.video);
  switch (p.network) {
    case 'facebook':
      return { facebookData: { type: reel && p.vertical ? 'REEL' : 'POST' } };
    case 'instagram':
      return { instagramData: { type: reel ? 'REEL' : 'POST', showReelOnFeed: true, isAiGenerated: false } };
    case 'tiktok':
      return {
        tiktokData: {
          privacyOption: 'PUBLIC_TO_EVERYONE', title: (p.title || '').slice(0, 90), disableComment: false, disableDuet: false,
          disableStitch: false, autoAddMusic: false, commercialContentOwnBrand: true, commercialContentThirdParty: false, isAigc: false,
        },
      };
    case 'youtube':
      return {
        youtubeData: {
          title: (p.title || p.text.split('\n')[0]).slice(0, 100), type: p.vertical ? 'short' : 'video', privacy: 'public',
          madeForKids: false, isAiGeneratedContent: false, tags: ['immobilier', 'Meknès', 'عقارات', 'الوسيط 777'],
        },
      };
    case 'threads':
      return { threadsData: {} };
    case 'linkedin':
      return { linkedinData: { documentTitle: '', publishImagesAsPDF: false, previewIncluded: true, type: 'post' } };
    case 'twitter':
      return { twitterData: { tags: [] } };
    case 'gmb':
      return { gmbData: { type: 'publication' } };
    case 'bluesky':
      return { blueskyData: { postLanguages: ['ar', 'fr'] } };
  }
}

// Vérifie les médias obligatoires avant d'appeler Metricool (message clair pour le gérant).
export function missingMedia(p: StudioPostInput): string | null {
  if (p.network === 'youtube' && !p.video) return 'YouTube exige une vidéo';
  if ((p.network === 'instagram' || p.network === 'tiktok') && !p.video && !p.images.length) return `${p.network} exige une photo ou une vidéo`;
  return null;
}

export async function schedulePost(p: StudioPostInput): Promise<{ id: string; dateTime: string }> {
  if (!metricoolEnabled) throw new Error('Metricool non configuré (METRICOOL_USER_TOKEN)');
  const missing = missingMedia(p);
  if (missing) throw new Error(missing);
  // Metricool refuse une date passée : « maintenant » = dans 5 minutes.
  const dateTime = p.dateTime ? `${p.dateTime.slice(0, 16)}:00` : casablancaNow(5);
  const media = await Promise.all(mediaFor(p).map(normalizeMedia));
  const body = {
    publicationDate: { dateTime, timezone: TIMEZONE },
    text: p.text,
    providers: [{ network: p.network }],
    autoPublish: true,
    draft: false,
    media,
    mediaAltText: [],
    descendants: [],
    firstCommentText: '',
    hasNotReadNotes: false,
    shortener: false,
    smartLinkData: { ids: [] },
    ...networkData(p),
  };
  const res = await fetch(`${API}/v2/scheduler/posts?${qs()}`, {
    method: 'POST',
    headers: { 'X-Mc-Auth': TOKEN!, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || data?.error || `Erreur Metricool (${res.status})`);
  return { id: String(data?.data?.id ?? data?.id ?? ''), dateTime };
}
