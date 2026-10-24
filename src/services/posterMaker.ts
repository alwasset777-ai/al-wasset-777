// Base des affiches publicitaires dessinées dans le navigateur (canvas) : données du bien, libellés,
// atouts, polices et outils de dessin communs aux modèles (posterTemplates.ts, proTemplates.ts).
import qrcode from 'qrcode-generator';
import type { IconNode } from 'lucide';
import {
  ArrowUpDown, Building2, Car, CircleCheck, CookingPot, FileCheck, Flame, Mountain, School, ShieldCheck, Sofa, SquareParking, Sun, Trees, Waves,
} from 'lucide';
import { siWhatsapp } from 'simple-icons';
import { PropertyType } from '../types';
import { loadAgency } from './agencySettings';

// Transaction affichée : vente, location ou location meublée (« مشروع جديد » n'est plus proposé).
export type PosterDeal = 'vente' | 'location' | 'meuble';

export interface PosterData {
  deal: PosterDeal;
  type: PropertyType | '';
  headline: string; // grand titre ; vide = « type + transaction »
  city: string;
  district: string;
  surface: number;
  surfaceMax: number; // > surface : « من 75 متر الى 90 متر »
  bedrooms: number;
  bathrooms: number;
  price: string;
  features: string[];
  extras: string[]; // jusqu'à 4 phrases libres (« معفي من رسوم التنازل »…), une par ligne
}

export const AR = 'Tajawal, sans-serif';
export const LAT = 'Inter, Tajawal, sans-serif';

export const TYPE_LABELS: Record<PropertyType, { ar: string; fr: string }> = {
  Appartement: { ar: 'شقة', fr: 'Appartement' },
  Villa: { ar: 'فيلا', fr: 'Villa' },
  Maison: { ar: 'منزل', fr: 'Maison' },
  Terrain: { ar: 'بقعة أرضية', fr: 'Terrain' },
  'Local Commercial': { ar: 'محل تجاري', fr: 'Local commercial' },
  Bureau: { ar: 'مكاتب', fr: 'Bureaux' },
  Immeuble: { ar: 'عمارة', fr: 'Immeuble' },
  Riad: { ar: 'رياض', fr: 'Riad' },
  Ferme: { ar: 'ضيعة فلاحية', fr: 'Ferme' },
};

// ar : dans le titre de l'affiche ; btn : sur le bouton du formulaire.
export const DEAL_LABELS: Record<PosterDeal, { ar: string; fr: string; btn: string }> = {
  vente: { ar: 'للبيع', fr: 'À VENDRE', btn: 'للبيع' },
  location: { ar: 'للكراء', fr: 'À LOUER', btn: 'للكراء' },
  meuble: { ar: 'مفروشة للكراء', fr: 'MEUBLÉ À LOUER', btn: 'كراء مفروش' },
};

// Accord de « مفروش » avec le type (منزل مفروش، شقة مفروشة).
const MASCULINE: PropertyType[] = ['Maison', 'Local Commercial', 'Riad', 'Terrain'];
const dealAr = (d: PosterData) =>
  d.deal === 'meuble' && MASCULINE.includes(d.type || 'Appartement') ? 'مفروش للكراء' : DEAL_LABELS[d.deal].ar;

// Atouts proposés : titre (sur l'affiche), sous-titre et icône.
export const FEATURES: { title: string; sub: string; icon: IconNode }[] = [
  { title: 'موقع مميز', sub: 'بمنطقة حيوية', icon: Building2 },
  { title: 'سهولة الولوج', sub: 'و قرب من جميع المرافق', icon: Car },
  { title: 'وثائق قانونية جاهزة', sub: 'تسهيل عملية البيع', icon: FileCheck },
  { title: 'مساحات متنوعة', sub: 'تناسب جميع الاحتياجات', icon: ShieldCheck },
  { title: 'مصعد', sub: 'في العمارة', icon: ArrowUpDown },
  { title: 'موقف سيارات', sub: 'مكان خاص للسيارة', icon: SquareParking },
  { title: 'شرفة', sub: 'إطلالة مفتوحة', icon: Sun },
  { title: 'مطبخ مجهز', sub: 'جاهز للاستعمال', icon: CookingPot },
  { title: 'مسبح', sub: 'للاستجمام', icon: Waves },
  { title: 'حديقة', sub: 'مساحة خضراء', icon: Trees },
  { title: 'مفروشة', sub: 'جاهزة للسكن', icon: Sofa },
  { title: 'تدفئة مركزية', sub: 'راحة في الشتاء', icon: Flame },
  { title: 'قريب من المدارس', sub: 'و المرافق العمومية', icon: School },
  { title: 'إطلالة رائعة', sub: 'منظر مفتوح', icon: Mountain },
];
export const featureInfo = (title: string) => FEATURES.find((f) => f.title === title) ?? { title, sub: '', icon: CircleCheck };

export const headlineOf = (d: PosterData) => d.headline.trim() || `${TYPE_LABELS[d.type || 'Appartement'].ar} ${dealAr(d)}`;

// ---------- Ressources (polices + informations de l'agence) ----------
let assetsReady: Promise<unknown> | null = null;
export function ensureFonts(): Promise<unknown> {
  assetsReady ||= Promise.all([
    ...['500 40px Tajawal', '700 40px Tajawal', '800 40px Tajawal', '900 40px Tajawal', '700 40px Inter', '800 40px Inter', '900 40px Inter', '700 40px "Playfair Display"'].map((f) =>
      document.fonts?.load(f).catch(() => null)
    ),
    loadAgency(),
  ]);
  return assetsReady;
}

// ---------- Outils de dessin ----------
export function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

export type Img = CanvasImageSource & { width: number; height: number };

export function coverInPath(ctx: CanvasRenderingContext2D, img: Img | undefined, path: () => void, x: number, y: number, w: number, h: number) {
  ctx.save();
  path();
  ctx.clip();
  if (img) {
    const s = Math.max(w / img.width, h / img.height);
    ctx.drawImage(img, x + (w - img.width * s) / 2, y + (h - img.height * s) / 2, img.width * s, img.height * s);
  } else {
    // Emplacement vide (aperçu avant d'ajouter les photos)
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, '#e9e9e9');
    g.addColorStop(1, '#cfcfcf');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    drawIcon(ctx, Building2, x + w / 2, y + h / 2, Math.min(w, h) * 0.3, '#ffffff', 1.5);
  }
  ctx.restore();
}

export function coverRect(ctx: CanvasRenderingContext2D, img: Img | undefined, x: number, y: number, w: number, h: number, r: number) {
  coverInPath(ctx, img, () => rr(ctx, x, y, w, h, r), x, y, w, h);
}

export function fitFont(ctx: CanvasRenderingContext2D, text: string, weight: number, size: number, family: string, maxW: number, min = size * 0.5): number {
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (s > min && ctx.measureText(text).width > maxW) {
    s -= 2;
    ctx.font = `${weight} ${s}px ${family}`;
  }
  return s;
}

export const hasArabic = (s: string) => /[؀-ۿ]/.test(s);

// Prix lisible : « 950 000 » s'afficherait « 000 950 » en sens arabe.
export function formatPrice(price: string): string {
  const p = price
    .trim()
    .replace(/(\d)[\s  ]+(?=\d{3}(?!\d))/g, '$1.')
    .replace(/\d{4,}/g, (n) => n.replace(/\B(?=(\d{3})+(?!\d))/g, '.')); // 950000 → 950.000
  return /^[\d.,]+$/.test(p) ? `${p} DH` : p; // chiffre seul : devise ajoutée
}

// Générateur pseudo-aléatoire déterministe : le même pinceau à chaque rendu.
function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Coup de pinceau : bande aux bords irréguliers, extrémités effilochées et quelques traînées.
export function brush(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, seed: number, tilt = 0) {
  const r = rng(seed);
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(tilt);
  ctx.fillStyle = color;
  const hw = w / 2;
  const hh = h / 2;
  const steps = 36;
  ctx.beginPath();
  ctx.moveTo(-hw, -hh + r() * h * 0.08);
  for (let i = 1; i <= steps; i++) ctx.lineTo(-hw + (w * i) / steps, -hh + (r() - 0.5) * h * 0.1);
  for (let i = 0; i <= 8; i++) ctx.lineTo(hw - r() * h * 0.28, -hh + (h * i) / 8);
  for (let i = steps; i >= 0; i--) ctx.lineTo(-hw + (w * i) / steps, hh + (r() - 0.5) * h * 0.1);
  for (let i = 8; i >= 0; i--) ctx.lineTo(-hw + r() * h * 0.28, -hh + (h * i) / 8);
  ctx.closePath();
  ctx.fill();
  // Traînées de peinture aux deux bouts
  ctx.globalAlpha = 0.85;
  for (let i = 0; i < 6; i++) {
    const ty = -hh + r() * h;
    const th = h * (0.03 + r() * 0.05);
    const len = w * (0.05 + r() * 0.1);
    ctx.fillRect(i % 2 ? hw - len * 0.5 : -hw - len * 0.5, ty, len, th);
  }
  ctx.restore();
}

// Icône lucide (traits) dessinée sur le canvas.
export function drawIcon(ctx: CanvasRenderingContext2D, node: IconNode, cx: number, cy: number, size: number, color: string, width = 2) {
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [tag, attrs] of node) {
    const a = attrs as Record<string, string | number>;
    const n = (k: string) => Number(a[k] ?? 0);
    ctx.beginPath();
    if (tag === 'path') ctx.stroke(new Path2D(String(a.d)));
    else if (tag === 'circle') {
      ctx.arc(n('cx'), n('cy'), n('r'), 0, Math.PI * 2);
      ctx.stroke();
    } else if (tag === 'rect') {
      rr(ctx, n('x'), n('y'), n('width'), n('height'), n('rx'));
      ctx.stroke();
    } else if (tag === 'line') {
      ctx.moveTo(n('x1'), n('y1'));
      ctx.lineTo(n('x2'), n('y2'));
      ctx.stroke();
    } else if (tag === 'polyline' || tag === 'polygon') {
      const pts = String(a.points).trim().split(/[\s,]+/).map(Number);
      for (let i = 0; i < pts.length; i += 2) (i ? ctx.lineTo : ctx.moveTo).call(ctx, pts[i], pts[i + 1]);
      if (tag === 'polygon') ctx.closePath();
      ctx.stroke();
    } else if (tag === 'ellipse') {
      ctx.ellipse(n('cx'), n('cy'), n('rx'), n('ry'), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// Logo de marque (simple-icons) blanc dans une pastille de couleur.
export function brandDot(ctx: CanvasRenderingContext2D, path: string, cx: number, cy: number, r: number, bg: string | CanvasGradient) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = bg;
  ctx.fill();
  const s = r * 1.15;
  ctx.translate(cx - s / 2, cy - s / 2);
  ctx.scale(s / 24, s / 24);
  ctx.fillStyle = '#fff';
  ctx.fill(new Path2D(path));
  ctx.restore();
}

let qrCache: { text: string; cells: boolean[][] } | null = null;
export function qr(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number) {
  if (qrCache?.text !== text) {
    const q = qrcode(0, 'M');
    q.addData(text);
    q.make();
    const n = q.getModuleCount();
    qrCache = { text, cells: Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => q.isDark(r, c))) };
  }
  const n = qrCache.cells.length;
  const cell = size / (n + 2);
  ctx.save();
  ctx.fillStyle = '#fff';
  rr(ctx, x, y, size, size, cell);
  ctx.fill();
  ctx.fillStyle = '#000';
  qrCache.cells.forEach((row, r) => row.forEach((dark, c) => dark && ctx.fillRect(x + cell * (c + 1), y + cell * (r + 1), cell + 0.5, cell + 0.5)));
  // Pastille WhatsApp au centre (le niveau de correction M laisse la place)
  brandDot(ctx, siWhatsapp.path, x + size / 2, y + size / 2, size * 0.1, '#25d366');
  ctx.restore();
}

// Vidéo à partir d'une affiche déjà dessinée (tous les modèles).
export async function posterVideoFrom(still: HTMLCanvasElement, seconds = 8): Promise<Blob> {
  if (typeof MediaRecorder === 'undefined') throw new Error("Ce navigateur ne permet pas d'enregistrer une vidéo");
  const { width: w, height: h } = still;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const mime =
    ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m)) || 'video/webm';
  const recorder = new MediaRecorder(canvas.captureStream(30), { mimeType: mime, videoBitsPerSecond: 5_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<Blob>((resolve) => (recorder.onstop = () => resolve(new Blob(chunks, { type: mime.split(';')[0] }))));
  recorder.start();
  const start = performance.now();
  await new Promise<void>((resolve) => {
    const tick = () => {
      const t = (performance.now() - start) / 1000;
      if (t >= seconds) return resolve();
      const z = 1 + (t / seconds) * 0.06;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = Math.min(1, t / 0.6);
      ctx.drawImage(still, (w - w * z) / 2, (h - h * z) / 2, w * z, h * z);
      ctx.globalAlpha = 1;
      requestAnimationFrame(tick);
    };
    tick();
  });
  recorder.stop();
  return done;
}
