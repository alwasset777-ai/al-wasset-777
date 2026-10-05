// Préparation des fichiers envoyés à l'agent : photos réduites, PDF, enregistrements vocaux.
export interface Attachment {
  name: string;
  mimeType: string;
  data: string; // base64
  blob: Blob; // original (rangé dans le registre si besoin)
}

// Vercel refuse les requêtes de plus de 4,5 Mo (le base64 ajoute ~37 %) : 3 Mo par fichier au maximum.
export const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024;
export const MAX_TOTAL_BASE64 = 4_000_000;

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// Photo réduite en JPEG (plus rapide à envoyer, suffisante pour lire une carte ou un document).
export async function resizeImage(file: Blob, max = 1600, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b || file), 'image/jpeg', quality));
}

export async function prepareAttachment(file: File): Promise<Attachment> {
  const isImage = file.type.startsWith('image/');
  const blob = isImage ? await resizeImage(file) : file;
  if (blob.size > MAX_ATTACHMENT_BYTES) throw new Error('too_big');
  if (!isImage && file.type !== 'application/pdf' && !file.type.startsWith('text/')) throw new Error('unsupported');
  return { name: file.name, mimeType: isImage ? 'image/jpeg' : file.type, data: await blobToBase64(blob), blob: file };
}
