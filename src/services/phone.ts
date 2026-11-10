// Numéros WhatsApp internationaux : pays par défaut du bureau (Maroc) et pays de chaque client
// (Marocains du monde : France, Espagne, Italie…). Réglages gardés sur l'appareil du gérant.
import { createStore } from './createStore';

export interface Country {
  code: string; // indicatif sans « + »
  flag: string;
  nameAr: string;
  nameFr: string;
}

// Pays les plus fréquents pour le bureau (Maroc + diaspora + Golfe).
export const COUNTRIES: Country[] = [
  { code: '212', flag: '🇲🇦', nameAr: 'المغرب', nameFr: 'Maroc' },
  { code: '33', flag: '🇫🇷', nameAr: 'فرنسا', nameFr: 'France' },
  { code: '34', flag: '🇪🇸', nameAr: 'إسبانيا', nameFr: 'Espagne' },
  { code: '39', flag: '🇮🇹', nameAr: 'إيطاليا', nameFr: 'Italie' },
  { code: '32', flag: '🇧🇪', nameAr: 'بلجيكا', nameFr: 'Belgique' },
  { code: '31', flag: '🇳🇱', nameAr: 'هولندا', nameFr: 'Pays-Bas' },
  { code: '49', flag: '🇩🇪', nameAr: 'ألمانيا', nameFr: 'Allemagne' },
  { code: '41', flag: '🇨🇭', nameAr: 'سويسرا', nameFr: 'Suisse' },
  { code: '44', flag: '🇬🇧', nameAr: 'بريطانيا', nameFr: 'Royaume-Uni' },
  { code: '1', flag: '🇨🇦', nameAr: 'كندا / أمريكا', nameFr: 'Canada / États-Unis' },
  { code: '971', flag: '🇦🇪', nameAr: 'الإمارات', nameFr: 'Émirats' },
  { code: '966', flag: '🇸🇦', nameAr: 'السعودية', nameFr: 'Arabie saoudite' },
  { code: '974', flag: '🇶🇦', nameAr: 'قطر', nameFr: 'Qatar' },
  { code: '213', flag: '🇩🇿', nameAr: 'الجزائر', nameFr: 'Algérie' },
  { code: '216', flag: '🇹🇳', nameAr: 'تونس', nameFr: 'Tunisie' },
];

export const countryByCode = (code: string) => COUNTRIES.find((c) => c.code === code);

export interface WhatsAppSettings {
  countryCode: string; // pays par défaut des numéros locaux (ex. 06…)
  ownerNumber: string; // numéro WhatsApp du gérant, au format international sans « + »
}

export const whatsappSettingsStore = createStore<WhatsAppSettings>('alwassit777.whatsapp.settings.v1', { countryCode: '212', ownerNumber: '' });

// Accepte un indicatif (« 33 », « +33 ») ou un nom de pays (« France », « فرنسا »).
export function resolveCountry(input: unknown): string | undefined {
  const s = String(input ?? '').trim();
  if (!s) return undefined;
  const digits = s.replace(/[^\d]/g, '');
  if (digits && countryByCode(digits)) return digits;
  const low = s.toLowerCase();
  return COUNTRIES.find((c) => c.nameFr.toLowerCase().includes(low) || low.includes(c.nameFr.toLowerCase()) || c.nameAr.includes(s) || s.includes(c.nameAr))?.code;
}

// Numéro au format WhatsApp (chiffres, avec indicatif, sans « + »).
// « +33 6… » / « 0033 6… » : déjà international. « 06… » ou « 6… » : numéro local du pays donné (sinon pays par défaut).
export function toWhatsAppNumber(raw: string, countryCode?: string): string {
  const s = String(raw || '').trim();
  const digits = s.replace(/[^\d]/g, '');
  if (!digits) return '';
  if (s.startsWith('+')) return digits;
  if (digits.startsWith('00')) return digits.slice(2);
  const cc = countryCode || whatsappSettingsStore.get().countryCode || '212';
  if (digits.startsWith('0')) return cc + digits.replace(/^0+/, '');
  // Déjà avec indicatif (ex. 212661000000) : on le garde tel quel.
  if (digits.length >= 11 || (digits.startsWith(cc) && digits.length > cc.length + 8)) return digits;
  return cc + digits;
}

export const isValidWhatsApp = (n: string) => /^\d{8,15}$/.test(n);

// Affichage lisible : « +33 6 12 34 56 78 ».
export function formatInternational(n: string): string {
  const c = COUNTRIES.slice().sort((a, b) => b.code.length - a.code.length).find((x) => n.startsWith(x.code));
  if (!c) return `+${n}`;
  const local = n.slice(c.code.length);
  const head = local.length % 2 ? local.slice(0, 1) : '';
  const rest = [head, ...(local.slice(head.length).match(/\d{2}/g) || [])].filter(Boolean).join(' ');
  return `+${c.code} ${rest}`;
}
