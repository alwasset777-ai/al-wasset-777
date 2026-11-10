// Réseaux sociaux du bureau : comptes (liens/identifiants) + partage d'un texte vers chaque application.
// Facebook, Instagram, TikTok, YouTube, WhatsApp et le site viennent des « إعدادات الوكالة » (mêmes
// informations que sur les affiches) ; les autres réseaux sont gardés ici, dans le navigateur.
import { agency, handle, loadAgency, saveAgency, type AgencySettings } from './agencySettings';
import { createStore } from './createStore';

export type SocialId =
  | 'whatsapp' | 'facebook' | 'instagram' | 'tiktok' | 'youtube' | 'website'
  | 'linkedin' | 'x' | 'telegram' | 'threads' | 'snapchat' | 'pinterest' | 'google';

type AgencyField = 'whatsapp' | 'facebook' | 'instagram' | 'tiktok' | 'youtube' | 'website';
type ExtraField = Exclude<SocialId, AgencyField>;

export interface SocialPlatform {
  id: SocialId;
  name: string;
  color: string;
  letter: string; // pastille (pas de logos de marques dans l'application)
  placeholder: string;
  base: string; // préfixe d'un profil à partir d'un identifiant
  // Lien de partage direct (texte + lien) ; absent = copier le texte puis ouvrir l'application.
  share?: (text: string, url: string) => string | null;
}

const e = encodeURIComponent;

export const SOCIALS: SocialPlatform[] = [
  { id: 'whatsapp', name: 'WhatsApp', color: '#25D366', letter: 'W', placeholder: '0777777848', base: 'https://wa.me/', share: (t, u) => `https://wa.me/?text=${e([t, u].filter(Boolean).join('\n'))}` },
  { id: 'facebook', name: 'Facebook', color: '#1877F2', letter: 'f', placeholder: 'facebook.com/alwasset777', base: 'https://facebook.com/', share: (_t, u) => (u ? `https://www.facebook.com/sharer/sharer.php?u=${e(u)}` : null) },
  { id: 'instagram', name: 'Instagram', color: '#E4405F', letter: 'I', placeholder: '@alwasset777', base: 'https://instagram.com/' },
  { id: 'tiktok', name: 'TikTok', color: '#111111', letter: 'T', placeholder: '@alwasset777', base: 'https://tiktok.com/@' },
  { id: 'youtube', name: 'YouTube', color: '#FF0000', letter: '▶', placeholder: '@alwasset777', base: 'https://youtube.com/@' },
  { id: 'linkedin', name: 'LinkedIn', color: '#0A66C2', letter: 'in', placeholder: 'linkedin.com/company/…', base: 'https://linkedin.com/in/', share: (_t, u) => (u ? `https://www.linkedin.com/sharing/share-offsite/?url=${e(u)}` : null) },
  { id: 'x', name: 'X (Twitter)', color: '#000000', letter: 'X', placeholder: '@alwasset777', base: 'https://x.com/', share: (t, u) => `https://x.com/intent/post?text=${e(t)}${u ? `&url=${e(u)}` : ''}` },
  { id: 'telegram', name: 'Telegram', color: '#26A5E4', letter: 'T', placeholder: '@alwasset777', base: 'https://t.me/', share: (t, u) => `https://t.me/share/url?url=${e(u || t)}${u ? `&text=${e(t)}` : ''}` },
  { id: 'threads', name: 'Threads', color: '#000000', letter: '@', placeholder: '@alwasset777', base: 'https://www.threads.net/@', share: (t, u) => `https://www.threads.net/intent/post?text=${e([t, u].filter(Boolean).join('\n'))}` },
  { id: 'snapchat', name: 'Snapchat', color: '#FFFC00', letter: 'S', placeholder: 'alwasset777', base: 'https://snapchat.com/add/' },
  { id: 'pinterest', name: 'Pinterest', color: '#E60023', letter: 'P', placeholder: 'alwasset777', base: 'https://pinterest.com/' },
  { id: 'google', name: 'Google (fiche du bureau)', color: '#4285F4', letter: 'G', placeholder: 'lien g.page / maps', base: 'https://' },
  { id: 'website', name: 'الموقع', color: '#d71920', letter: 'www', placeholder: 'al-wasset-777.vercel.app', base: 'https://' },
];

const AGENCY_FIELDS: AgencyField[] = ['whatsapp', 'facebook', 'instagram', 'tiktok', 'youtube', 'website'];
const isAgencyField = (id: SocialId): id is AgencyField => (AGENCY_FIELDS as string[]).includes(id);

export const socialExtraStore = createStore<Record<ExtraField, string>>('alwassit777.social.v1', {
  linkedin: '', x: '', telegram: '', threads: '', snapchat: '', pinterest: '', google: '',
});

export function getAccount(id: SocialId): string {
  return isAgencyField(id) ? String(agency()[id] || '') : socialExtraStore.get()[id] || '';
}

export async function saveAccounts(values: Partial<Record<SocialId, string>>): Promise<void> {
  await loadAgency();
  const a: AgencySettings = { ...agency() };
  const extra = { ...socialExtraStore.get() };
  let agencyChanged = false;
  for (const [k, v] of Object.entries(values) as [SocialId, string][]) {
    const val = String(v ?? '').trim().slice(0, 300);
    if (isAgencyField(k)) {
      if (a[k] !== val) { a[k] = val; agencyChanged = true; }
    } else extra[k] = val;
  }
  socialExtraStore.set(extra);
  if (agencyChanged) await saveAgency(a);
}

// Lien de profil à partir de ce que le gérant a tapé (lien complet, domaine ou identifiant).
export function profileUrl(id: SocialId, value: string): string {
  const v = String(value || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  if (id === 'whatsapp') {
    let d = v.replace(/[^\d+]/g, '').replace(/^\+/, '').replace(/^00/, '');
    if (/^0\d{9}$/.test(d)) d = `212${d.slice(1)}`;
    return d ? `https://wa.me/${d}` : '';
  }
  if (/^[\w-]+(\.[\w-]+)+(\/|$)/.test(v)) return `https://${v}`;
  const p = SOCIALS.find((s) => s.id === id)!;
  return p.base + v.replace(/^@/, '');
}

export const connectedAccounts = () =>
  SOCIALS.map((s) => ({ id: s.id, name: s.name, value: getAccount(s.id) }))
    .filter((a) => a.value)
    .map((a) => ({ ...a, url: profileUrl(a.id, a.value), shown: a.id === 'whatsapp' ? a.value : handle(a.value) }));

// Texte « tous nos réseaux » (bio, statut WhatsApp, signature).
export function allLinksText(): string {
  const list = connectedAccounts();
  if (!list.length) return '';
  const name = agency().name || 'الوسيط 777';
  return [`📍 ${name}`, ...list.map((a) => `${a.name}: ${a.url}`)].join('\n');
}

export const defaultShareUrl = () => profileUrl('website', getAccount('website')) || (typeof location !== 'undefined' ? location.origin : '');

// Partage système (toutes les applications installées : Instagram, TikTok, Snapchat, Messenger…), sinon copie.
export async function shareEverywhere(text: string, url = ''): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  const nav = navigator as any;
  try {
    if (nav.share) {
      await nav.share(url ? { text, url } : { text });
      return 'shared';
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') return 'cancelled';
  }
  try {
    await navigator.clipboard.writeText([text, url].filter(Boolean).join('\n'));
    return 'copied';
  } catch {
    return 'failed';
  }
}

export const canSystemShare = () => typeof navigator !== 'undefined' && typeof (navigator as any).share === 'function';
