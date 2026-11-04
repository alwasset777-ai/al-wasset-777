// « منير » lit un document (CIN, شهادة الملكية, contrat…) et propose une fiche du registre à vérifier.
// Les photos sont réduites dans le navigateur (moins de 3 Mo) pour passer la limite d'envoi de Vercel.
import { managerHeaders } from './managerKey';
import type { RegistryFields } from './registryStore';

export interface ReadDocumentResult {
  docType: 'cin' | 'titre_foncier' | 'contrat' | 'autre' | string;
  owner: string;
  cinNumber: string;
  ownerPhone: string;
  titleNumber: string;
  propertyType: string;
  location: string;
  surface: string;
  price: string;
  notes: string;
  unreadable: string;
}

export const MAX_DOC_BYTES = 3 * 1024 * 1024;
export const DOC_TYPE_LABELS: Record<string, string> = { cin: 'البطاقة الوطنية', titre_foncier: 'شهادة الملكية', contrat: 'عقد', autre: 'وثيقة' };
const REGISTRY_TYPES = ['شقة', 'فيلا', 'منزل', 'أرض', 'محل تجاري', 'مكتب', 'عمارة', 'رياض', 'ضيعة'];

const toBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

// Réduit une photo (côté le plus long 2000 px, JPEG) ; garde le fichier tel quel s'il est déjà léger.
async function shrinkImage(file: File): Promise<Blob> {
  if (file.size <= 1.5 * 1024 * 1024 && file.type !== 'image/heic' && file.type !== 'image/heif') return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const out = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.85));
    return out || file;
  } catch {
    return file; // format non lisible par le navigateur : on l'envoie tel quel
  }
}

export async function readDocument(file: File): Promise<ReadDocumentResult> {
  const isPdf = file.type === 'application/pdf';
  if (!isPdf && !file.type.startsWith('image/')) throw new Error('صيفط تصويرة ولا ملف PDF');
  const blob = isPdf ? file : await shrinkImage(file);
  if (blob.size > MAX_DOC_BYTES) throw new Error('الملف كبير بزاف (الحد 3 ميغا). صوّر الوثيقة من جديد ولا قسم الـPDF.');
  const res = await fetch('/api/agent/read-document', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await managerHeaders()) },
    body: JSON.stringify({ mimeType: blob.type || file.type, data: await toBase64(blob) }),
  });
  if (res.status === 401) throw new Error('خاصك تدخل بكلمة السر ديال المدير (MANAGER_KEY) باش منير يقرا الوثائق.');
  if (res.status === 503) throw new Error('الذكاء الاصطناعي ما مفعّلش فالخادم (GEMINI_API_KEY).');
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'ما قدرتش نقرا الوثيقة');
  return json as ReadDocumentResult;
}

// Fiche du registre proposée à partir de la lecture (le gérant la corrige avant d'enregistrer).
export function toRegistryFields(r: ReadDocumentResult): RegistryFields {
  const extra = [
    r.titleNumber && `الرسم العقاري: \u2066${r.titleNumber}\u2069`,
    r.cinNumber && `ب.ت.و: \u2066${r.cinNumber}\u2069`,
    r.notes,
  ].filter(Boolean);
  return {
    propertyType: REGISTRY_TYPES.includes(r.propertyType) ? r.propertyType : 'شقة',
    owner: r.owner,
    ownerPhone: r.ownerPhone,
    surface: r.surface,
    location: r.location,
    price: r.price,
    notes: extra.join('\n'),
  };
}
