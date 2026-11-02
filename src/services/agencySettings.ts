// Informations de l'agence qui utilise le « صانع الإعلانات » (paramètres de l'application).
// Vides au départ : chaque agence remplit les siennes. Gardées dans le navigateur de l'appareil.
// Les modèles d'affiches lisent ces informations au moment du dessin (agency()).

export interface AgencySettings {
  name: string; // nom affiché sur les affiches
  slogan: string;
  logo: string; // image (data URL) ; vide = pas de logo
  qr: string; // QR de l'agence (image) ; vide = QR WhatsApp créé automatiquement
  address: string;
  city: string;
  phones: string[]; // 1 à 3 numéros
  whatsapp: string; // numéro WhatsApp (QR et bouton) ; vide = 1er numéro
  website: string;
  facebook: string;
  instagram: string;
  tiktok: string;
  youtube: string;
}

export const EMPTY_AGENCY: AgencySettings = {
  name: '',
  slogan: '',
  logo: '',
  qr: '',
  address: '',
  city: '',
  phones: [],
  whatsapp: '',
  website: '',
  facebook: '',
  instagram: '',
  tiktok: '',
  youtube: '',
};

const KEY = 'studio.agency';
const OLD_LOGO_KEY = 'studio.logo'; // ancienne case « الشعار » (avant les paramètres)

let current: AgencySettings = { ...EMPTY_AGENCY };
let logoImg: HTMLImageElement | null = null;
let qrImg: HTMLImageElement | null = null;
const listeners = new Set<() => void>();

export const agency = () => current;
export const agencyLogo = () => logoImg;
export const agencyQr = () => qrImg;
export const agencyPhones = () => current.phones.map((p) => p.trim()).filter(Boolean);
export const isAgencyEmpty = (a: AgencySettings = current) => !a.name.trim() && !agencyPhones().length && !a.logo;

// Lien WhatsApp à partir d'un numéro marocain (06…, 07…, +212…, 00212…).
export function whatsappLink(a: AgencySettings = current): string {
  const raw = (a.whatsapp || a.phones.find((p) => p.trim()) || '').replace(/[^\d+]/g, '');
  if (!raw) return '';
  let d = raw.replace(/^\+/, '').replace(/^00/, '');
  if (/^0\d{9}$/.test(d)) d = `212${d.slice(1)}`;
  return `https://wa.me/${d}`;
}

// Liens des réseaux : on garde ce que l'agence a tapé (identifiant ou lien), affiché tel quel sans « https:// ».
export const handle = (v: string) => v.trim().replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function read(): AgencySettings {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && typeof saved === 'object') return { ...EMPTY_AGENCY, ...saved, phones: Array.isArray(saved.phones) ? saved.phones : [] };
    // Reprise du logo choisi dans l'ancienne case « الشعار »
    const oldLogo = localStorage.getItem(OLD_LOGO_KEY);
    if (oldLogo) return { ...EMPTY_AGENCY, logo: oldLogo };
  } catch {
    // stockage indisponible
  }
  return { ...EMPTY_AGENCY };
}

let ready: Promise<void> | null = null;
export function loadAgency(): Promise<void> {
  ready ||= (async () => {
    current = read();
    logoImg = await loadImage(current.logo);
    qrImg = await loadImage(current.qr);
    listeners.forEach((l) => l());
  })();
  return ready;
}

// Ouvert dans l'application du bureau (iframe) : Safari et d'autres navigateurs effacent ou isolent le stockage
// des pages intégrées. Le bureau garde donc une copie (et la synchronise) : on la reçoit au démarrage
// (« w777-agency ») et on lui renvoie chaque enregistrement (« w777-agency-save »).
const PARENT = 'https://alwasset777-ai.github.io';
export const inBureau = () => {
  try {
    return window.parent !== window && new URLSearchParams(location.search).get('embed') === 'w777';
  } catch {
    return false;
  }
};

function clean(a: Partial<AgencySettings> | null | undefined): AgencySettings {
  const o = { ...EMPTY_AGENCY } as AgencySettings;
  if (!a || typeof a !== 'object') return o;
  (Object.keys(EMPTY_AGENCY) as (keyof AgencySettings)[]).forEach((k) => {
    if (k === 'phones') return;
    const v = (a as Record<string, unknown>)[k];
    if (typeof v !== 'string') return;
    if (k === 'logo' || k === 'qr') {
      if (/^data:image\/(png|jpeg|webp);base64,/.test(v)) o[k] = v;
    } else o[k] = v.slice(0, 300);
  });
  o.phones = Array.isArray(a.phones) ? a.phones.filter((x): x is string => typeof x === 'string').slice(0, 4) : [];
  return o;
}

async function apply(a: AgencySettings) {
  current = { ...a, phones: a.phones.map((p) => p.trim()).filter(Boolean) };
  logoImg = await loadImage(current.logo);
  qrImg = await loadImage(current.qr);
  listeners.forEach((l) => l());
}

function writeLocal(): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
    localStorage.removeItem(OLD_LOGO_KEY);
    return true;
  } catch {
    return false;
  }
}

// Copie reçue du bureau : elle prime (c'est la copie durable).
if (typeof window !== 'undefined' && inBureau()) {
  window.addEventListener('message', async (e: MessageEvent) => {
    if (e.origin !== PARENT || e.source !== window.parent || e.data?.type !== 'w777-agency') return;
    const a = clean(e.data.agency);
    if (isAgencyEmpty(a)) return;
    await (ready || loadAgency());
    await apply(a);
    writeLocal();
  });
}

// Enregistre (renvoie false si le stockage refuse, par ex. logo trop lourd).
export async function saveAgency(a: AgencySettings): Promise<boolean> {
  await apply(a);
  if (inBureau()) {
    try {
      window.parent.postMessage({ type: 'w777-agency-save', agency: current }, PARENT);
    } catch {
      /* ignore */
    }
    writeLocal();
    return true; // gardé par le bureau même si le stockage local est bloqué
  }
  return writeLocal();
}

export function onAgencyChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

// Logo réduit (600 px max, PNG pour garder la transparence) pour tenir dans le stockage du navigateur.
export function shrinkLogo(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, 600 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s);
      c.height = Math.round(img.height * s);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('صورة غير صالحة'));
    };
    img.src = url;
  });
}
