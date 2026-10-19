// Création des visuels publicitaires dans le navigateur : affiche PNG et vidéo diaporama (WebM).
import { Property } from '../types';
import { agencyProfile as A } from '../data/agencyProfile';

export type VisualFormat = 'square' | 'vertical' | 'landscape';

export const FORMAT_SIZE: Record<VisualFormat, [number, number]> = {
  square: [1080, 1080],
  vertical: [1080, 1920],
  landscape: [1200, 675],
};

const CORAL = '#ff6f61';
const DARK = '#281715';

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Image introuvable : ${src}`));
    img.src = src;
  });
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number, zoom = 1) {
  const scale = Math.max(w / img.width, h / img.height) * zoom;
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const DEAL_AR: Record<string, string> = { vente: 'للبيع', location: 'للكراء', neuf: 'مشروع جديد' };

// Prix lisible en sens arabe : « 950 000 » deviendrait « 000 950 » à l'affichage RTL,
// donc milliers séparés par des points, et sens gauche→droite si le prix est écrit en lettres latines.
function drawPrice(ctx: CanvasRenderingContext2D, price: string, x: number, y: number) {
  const text = price.replace(/(\d)[\s\u00a0\u202f]+(?=\d{3}(?!\d))/g, '$1.');
  const prev = ctx.direction;
  if (!/[\u0600-\u06FF]/.test(text)) ctx.direction = 'ltr';
  ctx.fillText(text, x, y);
  ctx.direction = prev;
}

// Dessine une image de la vidéo / l'affiche : photo + bandeau marque + prix + contacts.
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  p: Property,
  img: HTMLImageElement | null,
  format: VisualFormat,
  zoom = 1
) {
  const [w, h] = FORMAT_SIZE[format];
  const u = Math.min(w, h) / 1080; // unité d'échelle
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = DARK;
  ctx.fillRect(0, 0, w, h);
  if (img) drawCover(ctx, img, w, h, zoom);

  // Dégradé pour lisibilité du texte
  const grad = ctx.createLinearGradient(0, h * 0.45, 0, h);
  grad.addColorStop(0, 'rgba(40,23,21,0)');
  grad.addColorStop(1, 'rgba(40,23,21,0.92)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Logo en haut
  ctx.direction = 'rtl';
  roundRect(ctx, 40 * u, 40 * u, 330 * u, 96 * u, 22 * u);
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fill();
  ctx.fillStyle = DARK;
  ctx.font = `800 ${40 * u}px Tajawal, sans-serif`;
  ctx.textAlign = 'right';
  ctx.fillText('الوسيط', 205 * u, 104 * u);
  roundRect(ctx, 220 * u, 62 * u, 130 * u, 54 * u, 12 * u);
  ctx.fillStyle = CORAL;
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.font = `900 ${38 * u}px Inter, sans-serif`;
  ctx.fillText('777', 285 * u, 103 * u);

  // Badge transaction
  const deal = DEAL_AR[p.listingType] || '';
  ctx.font = `800 ${38 * u}px Tajawal, sans-serif`;
  const dealW = ctx.measureText(deal).width + 60 * u;
  roundRect(ctx, w - 40 * u - dealW, 50 * u, dealW, 76 * u, 38 * u);
  ctx.fillStyle = CORAL;
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText(deal, w - 40 * u - dealW / 2, 102 * u);

  // Bloc infos bas
  ctx.textAlign = 'right';
  const right = w - 50 * u;
  let y = h - 330 * u;
  ctx.fillStyle = '#fff';
  ctx.font = `800 ${54 * u}px Tajawal, sans-serif`;
  wrapText(ctx, p.titleAr || p.titleFr, right, y, w - 100 * u, 62 * u, 2);
  y += 140 * u;
  ctx.font = `600 ${36 * u}px Tajawal, sans-serif`;
  ctx.fillStyle = '#ffd8d2';
  ctx.fillText(`📍 ${p.district}، ${p.city}   •   ${p.surface} م²`, right, y);
  y += 74 * u;
  ctx.font = `900 ${60 * u}px Inter, Tajawal, sans-serif`;
  ctx.fillStyle = '#fff';
  drawPrice(ctx, p.priceFormattedAr, right, y);

  // Bandeau contacts
  ctx.fillStyle = CORAL;
  ctx.fillRect(0, h - 96 * u, w, 96 * u);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.font = `800 ${34 * u}px Inter, Tajawal, sans-serif`;
  ctx.fillText(`☎ ${A.phonesLocal.join('  |  ')}   •   ${A.sloganAr}`, w / 2, h - 36 * u);
  ctx.direction = 'ltr';
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number, maxLines: number) {
  const words = text.split(' ');
  let line = '';
  let lines = 0;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y + lines * lineH);
      line = word;
      if (++lines >= maxLines) return;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, y + lines * lineH);
}

async function loadPhotos(p: Property): Promise<HTMLImageElement[]> {
  const results = await Promise.allSettled(p.images.slice(0, 6).map(loadImage));
  return results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
}

export async function renderPoster(p: Property, format: VisualFormat, type: 'image/png' | 'image/jpeg' = 'image/png'): Promise<Blob> {
  const [w, h] = FORMAT_SIZE[format];
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  await document.fonts?.ready;
  const [first] = await loadPhotos(p);
  drawFrame(ctx, p, first || null, format);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Export image impossible'))), type, 0.92)
  );
}

export const canRecordVideo = () =>
  typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function';

// Écran d'ouverture (« intro ») ou de fin (« outro ») de la vidéo publicitaire.
function drawCard(ctx: CanvasRenderingContext2D, p: Property, img: HTMLImageElement | null, format: VisualFormat, kind: 'intro' | 'outro', progress: number) {
  const [w, h] = FORMAT_SIZE[format];
  const u = Math.min(w, h) / 1080;
  ctx.fillStyle = DARK;
  ctx.fillRect(0, 0, w, h);
  if (img) drawCover(ctx, img, w, h, 1.15 - progress * 0.05);
  ctx.fillStyle = 'rgba(40,23,21,0.8)';
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = Math.min(1, progress * 3);
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  const cx = w / 2;
  let y = h / 2 - 220 * u;
  if (kind === 'intro') {
    const deal = DEAL_AR[p.listingType] || '';
    ctx.font = `800 ${46 * u}px Tajawal, sans-serif`;
    const dw = ctx.measureText(deal).width + 80 * u;
    roundRect(ctx, cx - dw / 2, y - 62 * u, dw, 90 * u, 45 * u);
    ctx.fillStyle = CORAL;
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(deal, cx, y);
    y += 140 * u;
    ctx.font = `900 ${76 * u}px Tajawal, sans-serif`;
    wrapText(ctx, p.titleAr || p.titleFr, cx, y, w - 140 * u, 90 * u, 2);
    y += 220 * u;
    ctx.font = `600 ${44 * u}px Tajawal, sans-serif`;
    ctx.fillStyle = '#ffd8d2';
    ctx.fillText(`📍 ${p.district}، ${p.city}${p.surface ? `  •  ${p.surface} م²` : ''}`, cx, y);
  } else {
    ctx.font = `900 ${84 * u}px Inter, Tajawal, sans-serif`;
    ctx.fillStyle = '#fff';
    drawPrice(ctx, p.priceFormattedAr, cx, y);
    y += 120 * u;
    ctx.font = `700 ${44 * u}px Tajawal, sans-serif`;
    ctx.fillStyle = '#ffd8d2';
    ctx.fillText('للتواصل والزيارة', cx, y);
    ctx.font = `900 ${64 * u}px Inter, sans-serif`;
    ctx.fillStyle = '#fff';
    A.phonesLocal.forEach((ph, i) => ctx.fillText(ph, cx, y + (100 + i * 84) * u));
    y += (120 + A.phonesLocal.length * 84) * u;
    ctx.font = `700 ${40 * u}px Tajawal, sans-serif`;
    ctx.fillText(A.nameAr, cx, y);
    ctx.fillStyle = CORAL;
    ctx.fillText(A.sloganAr, cx, y + 64 * u);
  }
  ctx.globalAlpha = 1;
  ctx.direction = 'ltr';
}

// Légende courte d'une photo (ex. « صالون واسع ومشمس »), sous le logo.
function drawCaption(ctx: CanvasRenderingContext2D, text: string, format: VisualFormat) {
  const [w] = FORMAT_SIZE[format];
  const u = Math.min(w, FORMAT_SIZE[format][1]) / 1080;
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.font = `800 ${46 * u}px Tajawal, sans-serif`;
  const tw = Math.min(w - 80 * u, ctx.measureText(text).width + 70 * u);
  roundRect(ctx, (w - tw) / 2, 170 * u, tw, 84 * u, 24 * u);
  ctx.fillStyle = 'rgba(255,255,255,0.94)';
  ctx.fill();
  ctx.fillStyle = DARK;
  ctx.fillText(text, w / 2, 228 * u, w - 120 * u);
  ctx.direction = 'ltr';
}

// Diaporama animé (effet zoom lent) des photos du bien, ~3 s par photo.
// Option « vidéo publicitaire » : écran d'ouverture, une légende par photo, écran de fin (prix + téléphones).
export async function recordSlideshow(
  p: Property,
  format: VisualFormat,
  secondsPerPhoto = 3,
  opts: { captions?: string[]; bookends?: boolean } = {}
): Promise<Blob> {
  if (!canRecordVideo()) throw new Error("Ce navigateur ne permet pas d'enregistrer une vidéo");
  const [w, h] = FORMAT_SIZE[format];
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  await document.fonts?.ready;
  const photos = await loadPhotos(p);
  const frames = photos.length ? photos : [null];
  type Scene = { img: HTMLImageElement | null; card?: 'intro' | 'outro'; caption?: string };
  const scenes: Scene[] = [
    ...(opts.bookends ? [{ img: frames[0], card: 'intro' as const }] : []),
    ...frames.map((img, i) => ({ img, caption: opts.captions?.[i] })),
    ...(opts.bookends ? [{ img: frames[frames.length - 1], card: 'outro' as const }] : []),
  ];
  // MP4 en priorité (exigé par Instagram / TikTok), WebM sinon.
  const mime =
    ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m)) ||
    'video/webm';
  const recorder = new MediaRecorder(canvas.captureStream(30), { mimeType: mime, videoBitsPerSecond: 5_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<Blob>((resolve) => (recorder.onstop = () => resolve(new Blob(chunks, { type: mime.split(';')[0] }))));
  recorder.start();
  const sceneMs = secondsPerPhoto * 1000;
  const total = scenes.length * sceneMs;
  const start = performance.now();
  await new Promise<void>((resolve) => {
    const tick = () => {
      const t = performance.now() - start;
      if (t >= total) return resolve();
      const scene = scenes[Math.min(scenes.length - 1, Math.floor(t / sceneMs))];
      const local = (t % sceneMs) / sceneMs;
      if (scene.card) drawCard(ctx, p, scene.img, format, scene.card, local);
      else {
        drawFrame(ctx, p, scene.img, format, 1 + local * 0.08);
        if (scene.caption) drawCaption(ctx, scene.caption, format);
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
  recorder.stop();
  return done;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
