// Numéros de contact « en liberté » : choisir dans les contacts du téléphone (Android/Chrome),
// lire une fiche vCard (.vcf, iPhone et Android), coller un texte, ou recevoir un partage depuis
// une autre application (share target de i.wasset). Rien n'est envoyé au serveur.
import { formatInternational, isValidWhatsApp, toWhatsAppNumber } from './phone';

export interface PickedContact {
  name: string;
  phones: string[]; // tels que saisis
}

// --- Contacts du téléphone (Contact Picker API : Chrome Android uniquement) ---
export const contactPickerSupported = () =>
  typeof navigator !== 'undefined' && 'contacts' in navigator && typeof (navigator as any).contacts?.select === 'function';

export async function pickFromPhone(): Promise<PickedContact[]> {
  const list = await (navigator as any).contacts.select(['name', 'tel'], { multiple: true });
  return (list || [])
    .map((c: any) => ({ name: String(c.name?.[0] || '').trim(), phones: (c.tel || []).map((t: string) => String(t).trim()).filter(Boolean) }))
    .filter((c: PickedContact) => c.phones.length);
}

// --- vCard (.vcf) ---
const unescapeV = (s: string) => s.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim();

export function parseVCard(text: string): PickedContact[] {
  // Lignes repliées (RFC 6350) : une ligne qui commence par un espace continue la précédente.
  const lines = String(text || '').replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
  const out: PickedContact[] = [];
  let cur: PickedContact | null = null;
  let nField = '';
  for (const raw of lines) {
    const line = raw.trim();
    const up = line.toUpperCase();
    if (up === 'BEGIN:VCARD') { cur = { name: '', phones: [] }; nField = ''; continue; }
    if (up === 'END:VCARD') {
      if (cur) {
        if (!cur.name && nField) cur.name = nField;
        if (cur.phones.length) out.push(cur);
      }
      cur = null;
      continue;
    }
    if (!cur) continue;
    const i = line.indexOf(':');
    if (i < 0) continue;
    const key = line.slice(0, i).split(';')[0].split('.').pop()!.toUpperCase();
    const val = line.slice(i + 1);
    if (key === 'FN') cur.name = unescapeV(val);
    else if (key === 'N') nField = val.split(';').slice(0, 2).reverse().map(unescapeV).filter(Boolean).join(' ');
    else if (key === 'TEL') {
      const t = val.replace(/^tel:/i, '').trim();
      if (t && !cur.phones.includes(t)) cur.phones.push(t);
    }
  }
  return out;
}

// --- Texte libre (copier-coller, partage depuis WhatsApp/SMS…) ---
export function extractPhones(text: string): string[] {
  const found = String(text || '').match(/(?:\+|00)?\d[\d .\-()]{6,}\d/g) || [];
  const seen = new Set<string>();
  const res: string[] = [];
  for (const f of found) {
    const digits = f.replace(/[^\d]/g, '');
    if (digits.length < 8 || digits.length > 15 || seen.has(digits)) continue;
    seen.add(digits);
    res.push(f.trim());
  }
  return res;
}

export function contactsFromText(text: string): PickedContact[] {
  if (/BEGIN:VCARD/i.test(text)) return parseVCard(text);
  const phones = extractPhones(text);
  if (!phones.length) return [];
  // Nom : la première ligne sans chiffres, s'il y en a une.
  const lines = String(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const fewDigits = (l: string) => l.replace(/\D/g, '').length < 6;
  let name = lines.find((l) => fewDigits(l) && l.length <= 60) || '';
  if (!name && lines[0]) {
    // « Karim 0612345678 » : le nom est ce qui reste de la ligne sans le numéro.
    let rest = lines[0];
    for (const p of phones) rest = rest.replace(p, ' ');
    rest = rest.replace(/[\s:،,;\-–—|/]+/g, ' ').trim();
    if (rest && rest.length <= 60 && fewDigits(rest)) name = rest;
  }
  return [{ name, phones }];
}

// --- Utiliser / partager ---
export const waNumber = (phone: string) => {
  const n = toWhatsAppNumber(phone);
  return isValidWhatsApp(n) ? n : '';
};
export const prettyPhone = (phone: string) => {
  const n = waNumber(phone);
  return n ? formatInternational(n) : phone;
};

export function toVCard(c: PickedContact): string {
  const esc = (s: string) => s.replace(/([,;\\])/g, '\\$1');
  return ['BEGIN:VCARD', 'VERSION:3.0', `FN:${esc(c.name || c.phones[0] || 'Contact')}`, ...c.phones.map((p) => `TEL;TYPE=CELL:${prettyPhone(p)}`), 'END:VCARD'].join('\r\n');
}

export const contactText = (c: PickedContact) => [c.name, ...c.phones.map(prettyPhone)].filter(Boolean).join(' — ');

// Partage vers n'importe quelle application (WhatsApp, Messenger, SMS, e-mail…) ; sinon copie.
export async function shareContact(c: PickedContact): Promise<'shared' | 'copied' | 'cancelled'> {
  const text = contactText(c);
  try {
    const file = new File([toVCard(c)], `${(c.name || 'contact').replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'contact'}.vcf`, { type: 'text/vcard' });
    const nav = navigator as any;
    if (nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], title: c.name || 'Contact', text });
      return 'shared';
    }
    if (nav.share) {
      await nav.share({ title: c.name || 'Contact', text });
      return 'shared';
    }
  } catch (e: any) {
    if (e?.name === 'AbortError') return 'cancelled';
  }
  await copyText(text);
  return 'copied';
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// --- Partage reçu par i.wasset (le service worker le garde, la page le lit une fois) ---
export async function takeSharedPayload(): Promise<{ text: string; vcf: string } | null> {
  try {
    if (!('caches' in window)) return null;
    const c = await caches.open('wasset-share');
    const res = await c.match('/__shared__');
    if (!res) return null;
    await c.delete('/__shared__');
    const data = await res.json();
    return { text: String(data.text || ''), vcf: String(data.vcf || '') };
  } catch {
    return null;
  }
}
