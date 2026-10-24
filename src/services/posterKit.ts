// Outils communs aux modèles d'affiches : textes du bien, informations de l'agence (paramètres),
// blocs prêts à poser (logo, badge, titre, prix, atouts, contact, réseaux sociaux, photos).
import type { IconNode } from 'lucide';
import { Bath, BedDouble, CircleCheck, Globe, House, MapPin, Maximize, Phone } from 'lucide';
import { siFacebook, siInstagram, siTiktok, siYoutube } from 'simple-icons';
import { agency, agencyLogo, agencyPhones, handle, whatsappLink } from './agencySettings';
import {
  AR, DEAL_LABELS, Img, LAT, PosterData, TYPE_LABELS, brandDot, brush, coverInPath, coverRect, drawIcon, featureInfo, fitFont, formatPrice,
  hasArabic, headlineOf, qr, rr,
} from './posterMaker';

export const SERIF = '"Playfair Display", Georgia, serif';
export { headlineOf };

// ---------- Textes ----------
export const pick = (p: Img[], i: number): Img | undefined => p[i] ?? (p.length ? p[i % p.length] : undefined);
const typeOf = (d: PosterData) => d.type || 'Appartement';
export const subOf = (d: PosterData) => `${TYPE_LABELS[typeOf(d)].fr} · ${DEAL_LABELS[d.deal].fr}`;
export const dealOf = (d: PosterData) => DEAL_LABELS[d.deal].ar;
export const priceOf = (d: PosterData) => formatPrice(d.price);
export const placeOf = (d: PosterData) => [d.district, d.city].filter(Boolean).join('، ');
export const phonesLine = (sep = '  |  ') => agencyPhones().join(sep);

export type Spec = { icon: IconNode; text: string };
// Surface, chambres, salles de bain (seulement ce qui est rempli).
export function mainSpecs(d: PosterData): Spec[] {
  const out: Spec[] = [];
  if (d.surface) out.push({ icon: Maximize, text: d.surfaceMax > d.surface ? `${d.surface}-${d.surfaceMax} م²` : `${d.surface} م²` });
  if (d.bedrooms) out.push({ icon: BedDouble, text: `${d.bedrooms} ${d.bedrooms === 1 ? 'غرفة' : 'غرف'}` });
  if (d.bathrooms) out.push({ icon: Bath, text: `${d.bathrooms} ${d.bathrooms === 1 ? 'حمام' : 'حمامات'}` });
  return out;
}
// Atouts choisis (avec leur icône).
export const featureSpecs = (d: PosterData): Spec[] => d.features.map((f) => ({ icon: featureInfo(f).icon ?? CircleCheck, text: f }));
// Tout, dans l'ordre, pour les listes ; jamais vide (type du bien à défaut).
export function allSpecs(d: PosterData, n = 6): Spec[] {
  const list = [...mainSpecs(d), ...featureSpecs(d)];
  if (!list.length) list.push({ icon: House, text: TYPE_LABELS[typeOf(d)].ar });
  return list.slice(0, n);
}

// ---------- Texte dans une zone ----------
export interface TextOpts {
  color: string | CanvasGradient;
  align?: 'right' | 'center' | 'left';
  weight?: number;
  maxSize?: number;
  font?: 'ar' | 'serif' | 'lat';
  shadow?: boolean;
}
// Texte qui remplit une zone (plusieurs lignes si nécessaire), taille maximale possible.
export function boxText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, w: number, h: number, o: TextOpts) {
  if (!text.trim() || w <= 0 || h <= 0) return;
  const fam = o.font === 'serif' ? SERIF : o.font === 'lat' ? LAT : AR;
  const weight = o.weight ?? 800;
  const K = 1.22;
  const wrap = (p: string) => {
    const lines: string[] = [];
    let cur = '';
    for (const word of p.split(/\s+/).filter(Boolean)) {
      const test = cur ? `${cur} ${word}` : word;
      if (cur && ctx.measureText(test).width > w) {
        lines.push(cur);
        cur = word;
      } else cur = test;
    }
    if (cur) lines.push(cur);
    return lines;
  };
  ctx.save();
  let size = Math.min(o.maxSize ?? h, h);
  let lines: string[] = [];
  for (; size >= 6; size -= Math.max(0.5, size * 0.05)) {
    ctx.font = `${weight} ${size}px ${fam}`;
    lines = text.split('\n').flatMap(wrap);
    if (lines.length * size * K <= h && lines.every((l) => ctx.measureText(l).width <= w)) break;
  }
  ctx.fillStyle = o.color;
  ctx.textBaseline = 'middle';
  if (o.shadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = size * 0.25;
  }
  const align = o.align ?? 'center';
  const ax = align === 'right' ? x + w : align === 'left' ? x : x + w / 2;
  let ly = y + (h - lines.length * size * K) / 2 + (size * K) / 2;
  for (const l of lines) {
    ctx.direction = hasArabic(l) ? 'rtl' : 'ltr';
    ctx.textAlign = align;
    ctx.fillText(l, ax, ly);
    ly += size * K;
  }
  ctx.restore();
}

// Largeur d'un texte sur une ligne à la taille donnée (pour dimensionner les pastilles).
export function textW(ctx: CanvasRenderingContext2D, t: string, size: number, weight = 800, font: 'ar' | 'serif' | 'lat' = 'ar') {
  ctx.save();
  ctx.font = `${weight} ${size}px ${font === 'serif' ? SERIF : font === 'lat' ? LAT : AR}`;
  const w = ctx.measureText(t).width;
  ctx.restore();
  return w;
}

// ---------- Formes ----------
export function fillRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string | CanvasGradient, r = 0) {
  ctx.save();
  rr(ctx, x, y, w, h, r);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

export function poly(ctx: CanvasRenderingContext2D, pts: [number, number][], color: string | CanvasGradient) {
  ctx.save();
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

export function vGrad(ctx: CanvasRenderingContext2D, y0: number, y1: number, stops: [number, string][]) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  return g;
}
export function hGrad(ctx: CanvasRenderingContext2D, x0: number, x1: number, stops: [number, string][]) {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  return g;
}

export function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, w: number) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

// ---------- Photos ----------
export function photo(ctx: CanvasRenderingContext2D, img: Img | undefined, x: number, y: number, w: number, h: number, r = 0) {
  coverRect(ctx, img, x, y, w, h, r);
}

export function polyPhoto(ctx: CanvasRenderingContext2D, img: Img | undefined, pts: [number, number][]) {
  const xs = pts.map((q) => q[0]);
  const ys = pts.map((q) => q[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  coverInPath(
    ctx,
    img,
    () => {
      ctx.beginPath();
      pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.closePath();
    },
    x,
    y,
    Math.max(...xs) - x,
    Math.max(...ys) - y
  );
}

export function circlePhoto(ctx: CanvasRenderingContext2D, img: Img | undefined, cx: number, cy: number, r: number, ring = 0, ringColor = '#fff') {
  coverInPath(ctx, img, () => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
  }, cx - r, cy - r, r * 2, r * 2);
  if (ring) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.lineWidth = ring;
    ctx.strokeStyle = ringColor;
    ctx.stroke();
    ctx.restore();
  }
}

// Photo dans une arche (fenêtre arrondie en haut).
export function archPhoto(ctx: CanvasRenderingContext2D, img: Img | undefined, x: number, y: number, w: number, h: number, ring = 0, ringColor = '#fff') {
  const path = () => {
    const r = w / 2;
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.arc(x + r, y + r, r, Math.PI, 0);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
  };
  coverInPath(ctx, img, path, x, y, w, h);
  if (ring) {
    ctx.save();
    path();
    ctx.lineWidth = ring;
    ctx.strokeStyle = ringColor;
    ctx.stroke();
    ctx.restore();
  }
}

// Photo encadrée (bord coloré + ombre), éventuellement tournée.
export function framedPhoto(ctx: CanvasRenderingContext2D, img: Img | undefined, x: number, y: number, w: number, h: number, border: number, color: string, r = 0, angle = 0) {
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(angle);
  ctx.shadowColor = 'rgba(0,0,0,0.28)';
  ctx.shadowBlur = border * 2 + 8;
  ctx.shadowOffsetY = border * 0.6;
  rr(ctx, -w / 2, -h / 2, w, h, r);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  coverRect(ctx, img, -w / 2 + border, -h / 2 + border, w - border * 2, h - border * 2, Math.max(0, r - border * 0.6));
  ctx.restore();
}

// Rangée de petites photos.
export function thumbRow(ctx: CanvasRenderingContext2D, p: Img[], from: number, n: number, x: number, y: number, w: number, h: number, gap: number, r: number, border = 0, borderColor = '#fff') {
  const tw = (w - gap * (n - 1)) / n;
  for (let i = 0; i < n; i++) {
    const tx = x + i * (tw + gap);
    if (border) framedPhoto(ctx, pick(p, from + i), tx, y, tw, h, border, borderColor, r);
    else photo(ctx, pick(p, from + i), tx, y, tw, h, r);
  }
}

// ---------- Logo et nom de l'agence ----------
// Logo de l'agence (paramètres) dans une hauteur h ; renvoie la largeur occupée (0 si pas de logo).
export function logo(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, align: 'left' | 'center' | 'right' = 'left', plate?: string): number {
  const img = agencyLogo();
  if (!img) return 0;
  const pad = plate ? h * 0.12 : 0;
  const ih = h - pad * 2;
  const iw = Math.min((ih * img.width) / img.height, ih * 3.2);
  const ihh = (iw * img.height) / img.width;
  const bw = iw + pad * 2;
  const bx = align === 'left' ? x : align === 'center' ? x - bw / 2 : x - bw;
  if (plate) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.22)';
    ctx.shadowBlur = h * 0.18;
    rr(ctx, bx, y, bw, h, h * 0.22);
    ctx.fillStyle = plate;
    ctx.fill();
    ctx.restore();
  }
  ctx.drawImage(img, bx + pad, y + (h - ihh) / 2, iw, ihh);
  return bw;
}

// Logo + nom de l'agence côte à côte (nom à droite du logo en arabe, ou seul s'il n'y a pas de logo).
export function brandBlock(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, plate?: string, align: 'left' | 'right' = 'left') {
  const a = agency();
  const lw = logo(ctx, align === 'left' ? x : x + w, y, h, align, plate);
  const name = a.name.trim();
  if (!name) return;
  const gap = lw ? h * 0.25 : 0;
  const tx = align === 'left' ? x + lw + gap : x;
  const tw = w - lw - gap;
  if (tw < h) return;
  boxText(ctx, name, tx, y + h * 0.12, tw, a.slogan ? h * 0.48 : h * 0.76, { color, weight: 900, align: align === 'left' ? 'left' : 'right', maxSize: h * 0.42 });
  if (a.slogan) boxText(ctx, a.slogan, tx, y + h * 0.58, tw, h * 0.3, { color, weight: 600, align: align === 'left' ? 'left' : 'right', maxSize: h * 0.24 });
}

// ---------- Pastilles ----------
export function pill(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, h: number, fill: string, color: string, align: 'left' | 'right' | 'center' = 'right', maxW = Infinity, weight = 900): number {
  if (!text) return 0;
  const size = h * 0.5;
  const w = Math.min(maxW, textW(ctx, text, size, weight) + h * 0.9);
  const bx = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
  fillRect(ctx, bx, y, w, h, fill, h / 2);
  boxText(ctx, text, bx + h * 0.4, y + h * 0.18, w - h * 0.8, h * 0.64, { color, weight, maxSize: size });
  return w;
}

// Prix : en pastille, en coup de pinceau ou en bloc. Rien si le prix n'est pas rempli.
export function priceTag(ctx: CanvasRenderingContext2D, d: PosterData, x: number, y: number, w: number, h: number, style: 'pill' | 'brush' | 'block' | 'ribbon' | 'text', fill: string, color: string, label = '') {
  const t = priceOf(d);
  if (!t) return;
  if (style === 'brush') brush(ctx, x, y, w, h, fill, 31, -0.025);
  else if (style === 'pill') fillRect(ctx, x, y, w, h, fill, h / 2);
  else if (style === 'block') fillRect(ctx, x, y, w, h, fill, h * 0.14);
  else if (style === 'ribbon') poly(ctx, [[x + h * 0.35, y], [x + w, y], [x + w - h * 0.35, y + h], [x, y + h]], fill);
  if (label) {
    boxText(ctx, label, x + w * 0.08, y + h * 0.06, w * 0.84, h * 0.3, { color, weight: 700 });
    boxText(ctx, t, x + w * 0.08, y + h * 0.34, w * 0.84, h * 0.58, { color, weight: 900 });
  } else boxText(ctx, t, x + w * 0.08, y + h * 0.14, w * 0.84, h * 0.72, { color, weight: 900 });
}

// Lieu avec repère.
export function placeLine(ctx: CanvasRenderingContext2D, d: PosterData, x: number, y: number, w: number, h: number, color: string, align: 'right' | 'left' | 'center' = 'right', iconColor = color) {
  const t = placeOf(d);
  if (!t) return;
  const size = h * 0.7;
  const tw = Math.min(textW(ctx, t, size, 700), w - h * 1.2);
  const total = tw + h * 1.1;
  const right = align === 'right' ? x + w : align === 'left' ? x + total : x + (w + total) / 2;
  drawIcon(ctx, MapPin, right - h * 0.45, y + h / 2, h * 0.8, iconColor, 2.2);
  boxText(ctx, t, right - total, y, tw, h, { color, weight: 700, align: 'right', maxSize: size });
}

// Atouts principaux : icône (dans un rond ou nue) au-dessus du texte, répartis de droite à gauche.
export function specRow(ctx: CanvasRenderingContext2D, list: Spec[], x: number, y: number, w: number, h: number, color: string, iconBg?: string, iconColor = color) {
  if (!list.length) return;
  const n = list.length;
  const cw = w / n;
  list.forEach((s, i) => {
    const cx = x + w - cw * i - cw / 2;
    const r = Math.min(h * 0.26, cw * 0.22);
    const iy = y + h * 0.3;
    if (iconBg) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, iy, r, 0, Math.PI * 2);
      ctx.fillStyle = iconBg;
      ctx.fill();
      ctx.restore();
    }
    drawIcon(ctx, s.icon, cx, iy, r * (iconBg ? 1.05 : 1.6), iconColor, 2);
    boxText(ctx, s.text, cx - cw / 2 + 6, y + h * 0.62, cw - 12, h * 0.34, { color, weight: 800 });
  });
}

// Liste d'atouts (icône ou coche + texte), sur une ou deux colonnes, de droite à gauche.
export function featureList(ctx: CanvasRenderingContext2D, list: Spec[], x: number, y: number, w: number, h: number, color: string, mark: string, cols = 1, check = false) {
  if (!list.length) return;
  const rows = Math.ceil(list.length / cols);
  const cw = w / cols;
  const rh = Math.min(h / rows, h * 0.34);
  list.forEach((s, i) => {
    const c = Math.floor(i / rows);
    const r = i % rows;
    const right = x + w - c * cw;
    const cy = y + r * rh + rh / 2;
    const ic = rh * 0.62;
    drawIcon(ctx, check ? CircleCheck : s.icon, right - ic / 2, cy, ic, mark, 2);
    boxText(ctx, s.text, right - cw + 8, cy - rh * 0.36, cw - ic - 22, rh * 0.72, { color, weight: 700, align: 'right' });
  });
}

// ---------- Contact ----------
type Social = { path?: string; icon?: IconNode; text: string };
export function socials(): Social[] {
  const a = agency();
  const out: Social[] = [];
  if (a.facebook.trim()) out.push({ path: siFacebook.path, text: handle(a.facebook) });
  if (a.instagram.trim()) out.push({ path: siInstagram.path, text: handle(a.instagram) });
  if (a.tiktok.trim()) out.push({ path: siTiktok.path, text: handle(a.tiktok) });
  if (a.youtube.trim()) out.push({ path: siYoutube.path, text: handle(a.youtube) });
  if (a.website.trim()) out.push({ icon: Globe, text: handle(a.website) });
  return out;
}

// Réseaux sociaux de l'agence en ligne (icônes + identifiants). Rien si aucun n'est rempli.
export function socialRow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, dot: string) {
  const list = socials().slice(0, 4);
  if (!list.length) return;
  const cw = w / list.length;
  list.forEach((s, i) => {
    const cx = x + cw * i;
    const r = h * 0.32;
    if (s.path) brandDot(ctx, s.path, cx + r + 4, y + h / 2, r, dot);
    else {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx + r + 4, y + h / 2, r, 0, Math.PI * 2);
      ctx.fillStyle = dot;
      ctx.fill();
      ctx.restore();
      drawIcon(ctx, s.icon!, cx + r + 4, y + h / 2, r * 1.1, '#ffffff', 2);
    }
    boxText(ctx, s.text, cx + r * 2 + 12, y + h * 0.18, cw - r * 2 - 20, h * 0.64, { color, weight: 700, align: 'left', font: 'lat' });
  });
}

// Bloc contact : rond téléphone + numéros (+ adresse) ; QR WhatsApp si assez de place.
export function contactBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  o: { color: string; accent: string; onAccent: string; label?: string; qr?: boolean; address?: boolean }
) {
  const phones = agencyPhones();
  const a = agency();
  const wa = whatsappLink();
  const showQr = o.qr && wa && h > 120 && w > h * 3;
  const qs = showQr ? h * 0.86 : 0;
  if (showQr) qr(ctx, wa, x + (h - qs) / 2, y + (h - qs) / 2, qs);
  const left = x + (showQr ? h + 10 : 0);
  const r = Math.min(h * 0.3, 54);
  const cx = x + w - r - 6;
  const cy = y + h / 2;
  if (phones.length) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = o.accent;
    ctx.fill();
    ctx.restore();
    drawIcon(ctx, Phone, cx, cy, r * 1.05, o.onAccent, 2.4);
  }
  const tw = cx - r - 16 - left;
  const lines = [o.label, ...(phones.length > 2 || h < 90 ? [phones.join('  |  ')] : phones), o.address && a.address ? a.address : '']
    .filter((t): t is string => !!t);
  if (!lines.length) return;
  const lh = h / Math.max(lines.length, 1.6);
  lines.forEach((t, i) => {
    const isLabel = !!o.label && i === 0;
    boxText(ctx, t, left, y + (h - lh * lines.length) / 2 + lh * i + lh * 0.08, tw, lh * 0.84, {
      color: isLabel ? o.accent : o.color,
      weight: isLabel ? 700 : 900,
      align: 'right',
      maxSize: isLabel ? lh * 0.55 : lh * 0.72,
    });
  });
}

export { brush, coverRect, drawIcon, rr, fitFont };
