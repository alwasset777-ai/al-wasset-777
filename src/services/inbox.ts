// Demandes des clients du site (visite, rappel, recherche de bien) envoyées au bureau.
// Avec Firebase : enregistrées en ligne dans « inbox » (le gérant les voit partout).
// Sans Firebase : un lien WhatsApp pré-rempli vers le bureau, que le client envoie lui-même.
import { addDoc, collection, deleteDoc, doc, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { agencyProfile } from '../data/agencyProfile';
import { isFirebaseEnabled, requireDb } from './firebase';

export interface CustomerRequest {
  kind: 'visite' | 'rappel' | 'recherche';
  name: string;
  phone: string;
  message: string;
  propertyId?: number;
  propertyTitle?: string;
  preferredAt?: string; // ISO
}

export interface InboxItem extends CustomerRequest {
  id: string;
  createdAt: string;
}

export interface SendResult {
  sent: boolean; // true = reçu en ligne par le bureau
  whatsappUrl: string; // toujours fourni, utile en secours
}

const clean = (s: unknown, max: number) => String(s ?? '').trim().slice(0, max);

export function agencyWhatsappUrl(text: string): string {
  return `https://wa.me/${agencyProfile.whatsapp}?text=${encodeURIComponent(text)}`;
}

export function requestToText(r: CustomerRequest): string {
  const kind = r.kind === 'visite' ? 'طلب زيارة' : r.kind === 'rappel' ? 'طلب اتصال' : 'طلب بحث عن عقار';
  return [
    `السلام عليكم، ${kind} من موقع الوسيط 777`,
    `الاسم: ${r.name}`,
    `الهاتف: ${r.phone}`,
    r.propertyTitle ? `العقار: ${r.propertyTitle}${r.propertyId ? ` (#${r.propertyId})` : ''}` : '',
    r.preferredAt ? `الموعد المفضل: ${new Date(r.preferredAt).toLocaleString('ar-MA')}` : '',
    r.message ? `الرسالة: ${r.message}` : '',
  ].filter(Boolean).join('\n');
}

export async function sendToAgency(r: CustomerRequest): Promise<SendResult> {
  const payload: CustomerRequest = {
    kind: r.kind,
    name: clean(r.name, 80),
    phone: clean(r.phone, 30),
    message: clean(r.message, 1000),
    ...(r.propertyId ? { propertyId: Number(r.propertyId) } : {}),
    ...(r.propertyTitle ? { propertyTitle: clean(r.propertyTitle, 160) } : {}),
    ...(r.preferredAt ? { preferredAt: clean(r.preferredAt, 40) } : {}),
  };
  const whatsappUrl = agencyWhatsappUrl(requestToText(payload));
  if (!isFirebaseEnabled) return { sent: false, whatsappUrl };
  try {
    await addDoc(collection(requireDb(), 'inbox'), { ...payload, createdAt: new Date().toISOString() });
    return { sent: true, whatsappUrl };
  } catch {
    return { sent: false, whatsappUrl };
  }
}

// Lecture réservée au gérant connecté (règles Firestore).
export async function listInbox(max = 30): Promise<InboxItem[]> {
  if (!isFirebaseEnabled) return [];
  const snap = await getDocs(query(collection(requireDb(), 'inbox'), orderBy('createdAt', 'desc'), limit(max)));
  return snap.docs.map((d) => ({ ...(d.data() as CustomerRequest & { createdAt: string }), id: d.id }));
}

export async function removeInboxItem(id: string): Promise<void> {
  if (isFirebaseEnabled) await deleteDoc(doc(requireDb(), 'inbox', id));
}
