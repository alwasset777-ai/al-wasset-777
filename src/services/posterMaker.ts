// Affiche publicitaire Al Wasset 777 dessinée dans le navigateur (canvas), gratuite, sur le modèle de
// l'affiche officielle de l'agence : fond blanc, rouge et noir, coups de pinceau, logo rond, liste
// d'atouts avec icônes, encadré contact avec QR WhatsApp, barre des réseaux sociaux, slogan.
// Une maquette verticale (4:5, 9:16) qui s'étire, et une maquette horizontale (4:3, 16:9).
import qrcode from 'qrcode-generator';
import type { IconNode } from 'lucide';
import {
  ArrowUpDown, Building2, Car, CircleCheck, CookingPot, FileCheck, Flame, Mountain, School, ShieldCheck, Sofa, SquareParking, Sun, Trees, Waves,
} from 'lucide';
import { siFacebook, siInstagram, siWhatsapp, siYoutube } from 'simple-icons';
import { ListingType, PropertyType } from '../types';
import { agencyProfile as A } from '../data/agencyProfile';

export interface PosterData {
  deal: ListingType;
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
}

const RED = '#e3131b';
const BLACK = '#121212';
const GRAY = '#5f5f5f';
const AR = 'Tajawal, sans-serif';
const LAT = 'Inter, Tajawal, sans-serif';

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

export const DEAL_LABELS: Record<ListingType, { ar: string; fr: string }> = {
  vente: { ar: 'للبيع', fr: 'À VENDRE' },
  location: { ar: 'للكراء', fr: 'À LOUER' },
  neuf: { ar: 'مشروع جديد', fr: 'PROJET NEUF' },
};

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
const featureInfo = (title: string) => FEATURES.find((f) => f.title === title) ?? { title, sub: '', icon: CircleCheck };

export const headlineOf = (d: PosterData) => d.headline.trim() || `${TYPE_LABELS[d.type || 'Appartement'].ar} ${DEAL_LABELS[d.deal].ar}`;

// ---------- Ressources (polices + logo) ----------
let logoImg: HTMLImageElement | null = null;
let assetsReady: Promise<unknown> | null = null;
export function ensureFonts(): Promise<unknown> {
  assetsReady ||= Promise.all([
    ...['500 40px Tajawal', '700 40px Tajawal', '800 40px Tajawal', '900 40px Tajawal', '700 40px Inter', '800 40px Inter', '900 40px Inter'].map((f) =>
      document.fonts?.load(f).catch(() => null)
    ),
    new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        logoImg = img;
        resolve();
      };
      img.onerror = () => resolve();
      img.src = A.poster.logo;
    }),
  ]);
  return assetsReady;
}

// ---------- Outils de dessin ----------
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

type Img = CanvasImageSource & { width: number; height: number };

function coverInPath(ctx: CanvasRenderingContext2D, img: Img | undefined, path: () => void, x: number, y: number, w: number, h: number) {
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

function coverRect(ctx: CanvasRenderingContext2D, img: Img | undefined, x: number, y: number, w: number, h: number, r: number) {
  coverInPath(ctx, img, () => rr(ctx, x, y, w, h, r), x, y, w, h);
}

function fitFont(ctx: CanvasRenderingContext2D, text: string, weight: number, size: number, family: string, maxW: number, min = size * 0.5): number {
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (s > min && ctx.measureText(text).width > maxW) {
    s -= 2;
    ctx.font = `${weight} ${s}px ${family}`;
  }
  return s;
}

const hasArabic = (s: string) => /[؀-ۿ]/.test(s);

// Prix lisible : « 950 000 » s'afficherait « 000 950 » en sens arabe.
export function formatPrice(price: string): string {
  return price.trim().replace(/(\d)[\s  ]+(?=\d{3}(?!\d))/g, '$1.');
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
function brush(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, seed: number, tilt = 0) {
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
function drawIcon(ctx: CanvasRenderingContext2D, node: IconNode, cx: number, cy: number, size: number, color: string, width = 2) {
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
function brandDot(ctx: CanvasRenderingContext2D, path: string, cx: number, cy: number, r: number, bg: string | CanvasGradient) {
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

function pin(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  ctx.save();
  ctx.fillStyle = RED;
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.18, s * 0.36, Math.PI * 0.8, Math.PI * 0.2);
  ctx.lineTo(cx, cy + s * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.18, s * 0.14, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

let qrCache: { text: string; cells: boolean[][] } | null = null;
function qr(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number) {
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

// Texte arabe avec morceaux de couleurs/tailles différentes, posé de droite à gauche et centré sur cx.
type Token = { t: string; color: string; size: number; weight?: number };
function tokens(ctx: CanvasRenderingContext2D, list: Token[], cx: number, baseline: number, maxW: number) {
  const gap = (s: number) => s * 0.28;
  const measure = (k: number) =>
    list.reduce((sum, tk, i) => {
      ctx.font = `${tk.weight ?? 900} ${tk.size * k}px ${hasArabic(tk.t) ? AR : LAT}`;
      return sum + ctx.measureText(tk.t).width + (i ? gap(tk.size * k) : 0);
    }, 0);
  let k = 1;
  while (k > 0.45 && measure(k) > maxW) k -= 0.04;
  let x = cx + measure(k) / 2;
  ctx.save();
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  for (const tk of list) {
    ctx.font = `${tk.weight ?? 900} ${tk.size * k}px ${hasArabic(tk.t) ? AR : LAT}`;
    ctx.direction = hasArabic(tk.t) ? 'rtl' : 'ltr';
    ctx.fillStyle = tk.color;
    ctx.fillText(tk.t, x, baseline);
    x -= ctx.measureText(tk.t).width + gap(tk.size * k);
  }
  ctx.restore();
}

// Ligne « surface / pièces » du bandeau noir.
function specTokens(d: PosterData, word: number, num: number): Token[] {
  const W = (t: string): Token => ({ t, color: '#fff', size: word });
  const N = (t: string | number): Token => ({ t: String(t), color: RED, size: num });
  if (d.surfaceMax > d.surface && d.surface) return [W('من'), N(d.surface), W('متر الى'), N(d.surfaceMax), W('متر')];
  const out: Token[] = [];
  if (d.surface) out.push(W('المساحة'), N(d.surface), W('م²'));
  if (d.bedrooms) out.push(...(out.length ? [W('•')] : []), N(d.bedrooms), W('غرف'));
  if (d.bathrooms) out.push(...(out.length ? [W('•')] : []), N(d.bathrooms), W('حمام'));
  return out.length ? out : [W('للتواصل و الاستفسار')];
}

function header(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, textMaxW: number, u: number) {
  // Logo rond
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + r, y + r, r, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
  if (logoImg) {
    ctx.drawImage(logoImg, x, y, r * 2, r * 2);
    // Cerclage blanc et rouge, comme sur l'affiche officielle
    ctx.beginPath();
    ctx.arc(x + r, y + r, r - r * 0.025, 0, Math.PI * 2);
    ctx.lineWidth = r * 0.05;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + r, y + r, r + r * 0.03, 0, Math.PI * 2);
    ctx.lineWidth = r * 0.06;
    ctx.strokeStyle = RED;
    ctx.stroke();
  } else {
    ctx.lineWidth = r * 0.08;
    ctx.strokeStyle = RED;
    ctx.stroke();
    ctx.fillStyle = BLACK;
    ctx.font = `900 ${r * 0.5}px ${AR}`;
    ctx.textAlign = 'center';
    ctx.fillText('الوسيط', x + r, y + r * 1.15);
  }
  ctx.restore();
  // Nom de l'agence
  const tx = x + r * 2 + 26 * u;
  const cx = tx + textMaxW / 2;
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const big = fitFont(ctx, 'alwasset777', 900, 62 * u, LAT, textMaxW);
  const w1 = ctx.measureText('alwasset').width;
  const w2 = ctx.measureText('777').width;
  const sx = cx - (w1 + w2) / 2;
  const by = y + r * 0.78;
  ctx.fillStyle = '#fff';
  ctx.fillText('alwasset', sx, by);
  ctx.fillStyle = RED;
  ctx.fillText('777', sx + w1, by);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = `800 ${big * 0.74}px ${LAT}`;
  ctx.fillText('Immobilier', cx, by + big * 0.82);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(cx - textMaxW * 0.42, by + big * 1.05, textMaxW * 0.84, 2 * u);
  fitFont(ctx, 'Agence immobilière · Meknès', 600, 24 * u, LAT, textMaxW * 0.9);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText('Agence immobilière · Meknès', cx, by + big * 1.5);
  ctx.restore();
}

// Bande diagonale rouge + noire le long d'un bord de photo.
function stripes(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, u: number) {
  ctx.save();
  ctx.lineCap = 'butt';
  ctx.strokeStyle = RED;
  ctx.lineWidth = 16 * u;
  ctx.beginPath();
  ctx.moveTo(x1 - 6 * u, y1);
  ctx.lineTo(x2 - 6 * u, y2);
  ctx.stroke();
  ctx.strokeStyle = BLACK;
  ctx.lineWidth = 10 * u;
  ctx.beginPath();
  ctx.moveTo(x1 - 26 * u, y1);
  ctx.lineTo(x2 - 26 * u, y2);
  ctx.stroke();
  ctx.restore();
}

function features(ctx: CanvasRenderingContext2D, list: string[], x: number, y: number, w: number, h: number, u: number, cols = 1) {
  const items = list.slice(0, 4).map(featureInfo);
  if (!items.length) return;
  const cw = w / cols;
  const ch = h / (cols === 1 ? Math.max(items.length, 3) : 2);
  items.forEach((f, i) => {
    const cx0 = x + (i % cols) * cw;
    const cy = y + Math.floor(i / cols) * ch + ch / 2;
    const r = Math.min(44 * u, ch * 0.42);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx0 + r, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = RED;
    ctx.fill();
    ctx.strokeStyle = '#ffd6d8';
    ctx.lineWidth = 4 * u;
    ctx.stroke();
    drawIcon(ctx, f.icon, cx0 + r, cy, r * 1.05, '#fff', 2);
    const tx = cx0 + r * 2 + 14 * u;
    const tw = cw - r * 2 - 22 * u;
    ctx.direction = 'rtl';
    ctx.textAlign = 'left';
    const ts = fitFont(ctx, f.title, 900, Math.min(40 * u, ch * 0.36), AR, tw);
    ctx.fillStyle = BLACK;
    ctx.fillText(f.title, tx, f.sub ? cy - 2 * u : cy + ts * 0.35);
    if (f.sub) {
      fitFont(ctx, f.sub, 600, ts * 0.72, AR, tw);
      ctx.fillStyle = GRAY;
      ctx.fillText(f.sub, tx, cy + ts * 0.82);
    }
    ctx.restore();
  });
}

function priceBrush(ctx: CanvasRenderingContext2D, d: PosterData, right: number, bottom: number, w: number, h: number) {
  const price = formatPrice(d.price);
  const big = price || 'فرصة مميزة';
  const sub = price ? 'فرصة مميزة' : d.type === 'Bureau' || d.type === 'Local Commercial' ? 'للاستثمار أو لممارسة نشاطك المهني' : 'للاستثمار أو للسكن';
  brush(ctx, right - w, bottom - h, w, h, RED, 7, -0.07);
  ctx.save();
  ctx.translate(right - w / 2, bottom - h / 2);
  ctx.rotate(-0.07);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.direction = hasArabic(big) ? 'rtl' : 'ltr';
  const bs = fitFont(ctx, big, 900, h * 0.42, hasArabic(big) ? AR : LAT, w * 0.82);
  ctx.fillText(big, 0, -h * 0.02);
  ctx.direction = 'rtl';
  fitFont(ctx, sub, 700, Math.min(bs * 0.5, h * 0.22), AR, w * 0.82);
  ctx.fillText(sub, 0, h * 0.3);
  ctx.restore();
}

function contactBox(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, u: number) {
  ctx.save();
  rr(ctx, x, y, w, h, 18 * u);
  ctx.fillStyle = BLACK;
  ctx.fill();
  const pad = 16 * u;
  const headH = Math.min(58 * u, h * 0.28);
  // En-tête : WhatsApp + « للتواصل و الاستفسار »
  const hr = headH * 0.42;
  brandDot(ctx, siWhatsapp.path, x + w - pad - hr, y + pad + hr, hr, '#25d366');
  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#fff';
  fitFont(ctx, 'للتواصل و الاستفسار', 800, headH * 0.6, AR, w - hr * 2 - pad * 3);
  ctx.fillText('للتواصل و الاستفسار', x + w - pad * 2 - hr * 2, y + pad + hr * 1.35);
  // QR + numéros
  const q = Math.min(h - headH - pad * 2.4, w * 0.36);
  const qy = y + headH + pad;
  qr(ctx, A.poster.whatsappUrl, x + pad, qy, q);
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  fitFont(ctx, 'امسح الرمز للتواصل مباشرة', 600, 16 * u, AR, q + 20 * u);
  ctx.fillText('امسح الرمز للتواصل مباشرة', x + pad + q / 2, Math.min(y + h - 6 * u, qy + q + 18 * u));
  const px = x + pad * 2 + q;
  const pw = x + w - pad - px;
  const lineH = (h - headH - pad) / A.poster.phones.length;
  A.poster.phones.forEach((ph, i) => {
    const cy = qy + lineH * i + lineH / 2 - pad / 2;
    const ir = Math.min(16 * u, lineH * 0.3);
    brandDot(ctx, siWhatsapp.path, px + ir, cy, ir, '#25d366');
    ctx.direction = 'ltr';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fff';
    const s = fitFont(ctx, ph, 800, Math.min(36 * u, lineH * 0.5), LAT, pw - ir * 2 - 10 * u);
    ctx.fillText(ph, px + ir * 2 + 10 * u, cy + s * 0.36);
  });
  ctx.restore();
}

function socialBar(ctx: CanvasRenderingContext2D, y: number, w: number, h: number, u: number) {
  ctx.save();
  ctx.fillStyle = BLACK;
  ctx.fillRect(0, y, w, h);
  const ig = ctx.createLinearGradient(0, 0, h, h);
  ig.addColorStop(0, '#feda75');
  ig.addColorStop(0.5, '#d62976');
  ig.addColorStop(1, '#4f5bd5');
  const items: [string, string | CanvasGradient, string][] = [
    [siInstagram.path, ig, A.poster.social.instagram],
    [siFacebook.path, '#0866ff', A.poster.social.facebook],
    [siYoutube.path, '#ff0000', A.poster.social.youtube],
  ];
  const cw = w / items.length;
  items.forEach(([path, bg, handle], i) => {
    const r = h * 0.32;
    ctx.font = `700 ${Math.min(26 * u, h * 0.42)}px ${LAT}`;
    const tw = Math.min(ctx.measureText(handle).width, cw - r * 2 - 30 * u);
    const sx = cw * i + (cw - (r * 2 + 10 * u + tw)) / 2;
    brandDot(ctx, path, sx + r, y + h / 2, r, bg);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(handle, sx + r * 2 + 10 * u, y + h / 2 + 1 * u, cw - r * 2 - 30 * u);
  });
  ctx.restore();
}

function footer(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, u: number) {
  // Adresse
  ctx.save();
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.fillStyle = BLACK;
  const as = fitFont(ctx, A.poster.addressAr, 700, Math.min(26 * u, h * 0.2), AR, w - 120 * u);
  const aw = ctx.measureText(A.poster.addressAr).width;
  const ay = y + as * 1.25;
  ctx.fillText(A.poster.addressAr, x + w / 2, ay);
  pin(ctx, x + w / 2 + aw / 2 + 22 * u, ay - as * 0.35, as * 1.3);
  // Slogan sur coup de pinceau
  const bh = Math.min(92 * u, h - as * 1.9);
  const bw = Math.min(w * 0.66, 700 * u);
  const by = ay + as * 0.55;
  brush(ctx, x + (w - bw) / 2, by, bw, bh, RED, 11, -0.02);
  ctx.fillStyle = '#fff';
  fitFont(ctx, A.poster.sloganAr, 900, bh * 0.55, AR, bw * 0.8);
  ctx.textBaseline = 'middle';
  ctx.fillText(A.poster.sloganAr, x + w / 2, by + bh / 2 + 2 * u);
  ctx.restore();
}

// Décor : silhouette d'immeubles (bas gauche) et bandes rouge/noire (coin bas droit).
function decor(ctx: CanvasRenderingContext2D, bottom: number, w: number, h: number, u: number) {
  ctx.save();
  ctx.strokeStyle = '#d9d9d9';
  ctx.lineWidth = 2 * u;
  const bw = Math.min(w * 0.2, 200 * u);
  const blocks = [0.5, 0.85, 0.6, 1, 0.45];
  blocks.forEach((k, i) => {
    const bx = 10 * u + (bw / blocks.length) * i;
    const bh = h * k;
    ctx.strokeRect(bx, bottom - bh, bw / blocks.length - 6 * u, bh);
    for (let fy = bottom - bh + 12 * u; fy < bottom - 10 * u; fy += 18 * u) {
      ctx.beginPath();
      ctx.moveTo(bx + 6 * u, fy);
      ctx.lineTo(bx + bw / blocks.length - 12 * u, fy);
      ctx.stroke();
    }
  });
  const s = Math.min(160 * u, h * 1.2);
  ctx.lineWidth = 16 * u;
  ctx.strokeStyle = RED;
  ctx.beginPath();
  ctx.moveTo(w - s, bottom);
  ctx.lineTo(w, bottom - s);
  ctx.stroke();
  ctx.strokeStyle = BLACK;
  ctx.lineWidth = 10 * u;
  ctx.beginPath();
  ctx.moveTo(w - s * 0.62, bottom);
  ctx.lineTo(w, bottom - s * 0.62);
  ctx.stroke();
  ctx.restore();
}

function mainPhoto(ctx: CanvasRenderingContext2D, img: Img | undefined, top: number, bottom: number, xTop: number, xBot: number, right: number) {
  coverInPath(
    ctx,
    img,
    () => {
      ctx.beginPath();
      ctx.moveTo(xTop, top);
      ctx.lineTo(right, top);
      ctx.lineTo(right, bottom);
      ctx.lineTo(xBot, bottom);
      ctx.closePath();
    },
    xBot,
    top,
    right - xBot,
    bottom - top
  );
}

function headerBand(ctx: CanvasRenderingContext2D, top: number, height: number, xTop: number, slope: number) {
  ctx.fillStyle = BLACK;
  ctx.beginPath();
  ctx.moveTo(0, top);
  ctx.lineTo(xTop, top);
  ctx.lineTo(xTop - slope * height, top + height);
  ctx.lineTo(0, top + height);
  ctx.closePath();
  ctx.fill();
}

function headline(ctx: CanvasRenderingContext2D, d: PosterData, x: number, y: number, w: number, h: number) {
  brush(ctx, x, y, w, h, RED, 3, -0.015);
  ctx.save();
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  fitFont(ctx, headlineOf(d), 900, h * 0.78, AR, w - h * 0.5);
  ctx.fillText(headlineOf(d), x + w / 2, y + h * 0.53);
  ctx.restore();
}

function address(ctx: CanvasRenderingContext2D, d: PosterData, cx: number, base: number, size: number, maxW: number, u: number) {
  const place = d.district || d.city;
  if (!place) return;
  ctx.save();
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  const addr = `العنوان : ${place}`;
  const s = fitFont(ctx, addr, 900, size, AR, maxW);
  const tw = ctx.measureText(addr).width;
  brush(ctx, cx - tw / 2, base + 8 * u, tw, 9 * u, RED, 9, 0);
  ctx.fillStyle = BLACK;
  ctx.fillText(addr, cx, base);
  pin(ctx, cx + tw / 2 + 36 * u, base - s * 0.38, s * 1.25);
  ctx.restore();
}

// ---------- Maquette verticale (4:5, 9:16) ----------
function drawVertical(ctx: CanvasRenderingContext2D, d: PosterData, photos: Img[], w: number, h: number) {
  const u = w / 1080;
  const story = h / w > 1.6;
  const T = story ? 150 * u : 0; // zones masquées par l'interface TikTok / Stories
  const S = story ? 190 * u : 0;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  if (T) {
    ctx.fillStyle = BLACK;
    ctx.fillRect(0, 0, w, T);
  }

  // Photo principale en haut à droite (bord gauche en diagonale) + bandeau noir de l'en-tête
  const pBot = T + 590 * u;
  const xTop = 0.63 * w;
  const xBot = 0.5 * w;
  const slope = (xTop - xBot) / (pBot - T);
  const headH = 215 * u;
  mainPhoto(ctx, photos[0], T, pBot, xTop, xBot, w);
  headerBand(ctx, T, headH, xTop - 26 * u, slope);
  stripes(ctx, xTop, T, xBot, pBot, u);
  header(ctx, 22 * u, T + 18 * u, 90 * u, xTop - 26 * u - slope * headH - 252 * u, u);

  const colW = 0.6 * w;
  headline(ctx, d, 10 * u, T + 236 * u, colW, 150 * u);
  brush(ctx, 4 * u, T + 394 * u, colW - 30 * u, 100 * u, BLACK, 5, 0.012);
  tokens(ctx, specTokens(d, 58 * u, 80 * u), 4 * u + (colW - 30 * u) / 2, T + 470 * u, colW - 110 * u);
  address(ctx, d, colW / 2, T + 570 * u, 56 * u, colW - 150 * u, u);

  // Milieu : atouts + 2e photo avec prix ; bas : petites photos + contact
  const y0 = T + 612 * u;
  const socialH = 64 * u;
  const footH = 156 * u;
  const room = h - S - y0 - socialH - footH - 36 * u;
  const M = Math.max(230 * u, room * 0.56);
  const B = Math.max(180 * u, room - M);
  features(ctx, d.features, 18 * u, y0, 0.4 * w - 18 * u, M, u);
  const p2x = 0.42 * w;
  const p2w = w - p2x - 16 * u;
  coverRect(ctx, photos[1] ?? photos[0], p2x, y0, p2w, M, 6 * u);
  priceBrush(ctx, d, w - 6 * u, y0 + M - 12 * u, Math.min(p2w * 0.72, 520 * u), Math.min(M * 0.34, 140 * u));

  const y1 = y0 + M + 14 * u;
  const extra = photos.slice(2, 4);
  const contactW = extra.length === 2 ? 0.4 * w : extra.length === 1 ? 0.6 * w : w - 32 * u;
  const boxX = w - 16 * u - contactW;
  const pw = extra.length ? (boxX - 16 * u - 12 * u * extra.length) / extra.length : 0;
  extra.forEach((img, i) => coverRect(ctx, img, 16 * u + i * (pw + 12 * u), y1, pw, B, 8 * u));
  contactBox(ctx, boxX, y1, contactW, B, u);

  const y2 = y1 + B + 14 * u;
  socialBar(ctx, y2, w, socialH, u);
  decor(ctx, h - S, w, footH * 0.7, u);
  footer(ctx, 0, y2 + socialH, w, footH, u);
  if (story) {
    ctx.save();
    ctx.fillStyle = '#9a9a9a';
    ctx.font = `600 ${26 * u}px ${LAT}`;
    ctx.textAlign = 'center';
    ctx.fillText('al-wasset-777.vercel.app', w / 2, h - S + 70 * u);
    ctx.restore();
  }
}

// ---------- Maquette horizontale (base 1200×900, mise à l'échelle) ----------
function drawHorizontalBase(ctx: CanvasRenderingContext2D, d: PosterData, photos: Img[]) {
  const W = 1200;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, 900);
  const pBot = 480;
  const xTop = 660;
  const xBot = 585;
  const slope = (xTop - xBot) / pBot;
  const headH = 160;
  mainPhoto(ctx, photos[0], 0, pBot, xTop, xBot, W);
  headerBand(ctx, 0, headH, xTop - 26, slope);
  stripes(ctx, xTop, 0, xBot, pBot, 1);
  header(ctx, 18, 14, 66, xTop - 26 - slope * headH - 194, 0.8);

  const colW = 600;
  headline(ctx, d, 8, 174, colW, 118);
  brush(ctx, 4, 300, colW - 30, 80, BLACK, 5, 0.012);
  tokens(ctx, specTokens(d, 46, 62), 4 + (colW - 30) / 2, 360, colW - 100);
  address(ctx, d, colW / 2, 428, 44, colW - 140, 1);
  features(ctx, d.features, 14, 452, 590, 196, 0.8, 2);
  contactBox(ctx, 14, 660, 586, 140, 0.9);

  // Colonne droite : 2e et 3e photos, prix, adresse et slogan
  const extra = [photos[1] ?? photos[0], photos[2]].filter(Boolean) as Img[];
  const count = Math.max(1, extra.length);
  const gw = (W - 612 - 14 - 12 * (count - 1)) / count;
  if (extra.length) extra.forEach((img, i) => coverRect(ctx, img, 612 + i * (gw + 12), 494, gw, 206, 6));
  else coverRect(ctx, undefined, 612, 494, gw, 206, 6);
  priceBrush(ctx, d, W - 4, pBot - 8, 420, 120);
  socialBar(ctx, 812, W, 48, 0.9);
  footer(ctx, 612, 704, W - 612, 104, 0.85);
}

function drawHorizontal(ctx: CanvasRenderingContext2D, d: PosterData, photos: Img[], w: number, h: number) {
  const s = Math.min(w / 1200, h / 900);
  const ox = (w - 1200 * s) / 2;
  const oy = (h - 900 * s) / 2;
  if (ox > 1 || oy > 1) {
    // Bandes latérales (16:9) : noir avec diagonales rouges
    ctx.fillStyle = BLACK;
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.strokeStyle = RED;
    ctx.lineWidth = 14 * s;
    for (let i = -h; i < ox; i += 60 * s) {
      ctx.beginPath();
      ctx.moveTo(i, h);
      ctx.lineTo(i + h * 0.5, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(w - i, h);
      ctx.lineTo(w - i - h * 0.5, 0);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.rect(0, 0, 1200, 900);
  ctx.clip();
  drawHorizontalBase(ctx, d, photos);
  ctx.restore();
}

export function drawPoster(canvas: HTMLCanvasElement, d: PosterData, photos: Img[], w: number, h: number) {
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);
  if (w / h > 1.15) drawHorizontal(ctx, d, photos, w, h);
  else drawVertical(ctx, d, photos, w, h);
}

export async function posterBlob(d: PosterData, photos: Img[], w: number, h: number): Promise<Blob> {
  await ensureFonts();
  const canvas = document.createElement('canvas');
  drawPoster(canvas, d, photos, w, h);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Export image impossible'))), 'image/jpeg', 0.92)
  );
}

// YouTube n'accepte que la vidéo : l'affiche devient un court Short de quelques secondes (zoom lent).
export async function posterVideo(d: PosterData, photos: Img[], w: number, h: number, seconds = 8): Promise<Blob> {
  if (typeof MediaRecorder === 'undefined') throw new Error("Ce navigateur ne permet pas d'enregistrer une vidéo");
  await ensureFonts();
  const still = document.createElement('canvas');
  drawPoster(still, d, photos, w, h);
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
