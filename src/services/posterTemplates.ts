// Modèles d'affiches du « صانع الإعلانات » :
// - « الوسيط » : le modèle rouge et noir de l'agence (posterMaker.ts) ;
// - 4 modèles redessinés d'après les exemples du gérant, remplis uniquement avec ses informations ;
// - les modèles ajoutés par le gérant : une image de fond + des zones (photos, titre, prix…) placées à la main.
// Chaque modèle a sa taille d'origine ; pour une autre plateforme, l'affiche est centrée sur la couleur du modèle.
import type { IconNode } from 'lucide';
import { Bath, BedDouble, House, MapPin, Maximize, Phone } from 'lucide';
import { agencyProfile as A } from '../data/agencyProfile';
import {
  AR, DEAL_LABELS, Img, LAT, PosterData, TYPE_LABELS, coverInPath, coverRect, drawIcon, drawPoster, ensureFonts, featureInfo, fitFont,
  formatPrice, hasArabic, headlineOf, markLogo, markLogoAlpha, posterVideoFrom, qr, rr,
} from './posterMaker';
import { KIT_STYLES, KitStyle, drawKit } from './kitTemplates';

const SERIF = '"Playfair Display", Georgia, serif';
export const PHONES_LINE = A.poster.phones.join('  /  '); // les deux numéros de l'agence

// ---------- Modèles ajoutés par le gérant ----------
export type BlockKind = 'photo' | 'headline' | 'subtitle' | 'price' | 'address' | 'specs' | 'features' | 'phone' | 'logo' | 'qr' | 'icon' | 'label';

export interface TemplateBlock {
  id: string;
  kind: BlockKind;
  x: number; // position et taille en fraction de l'image (0 → 1)
  y: number;
  w: number;
  h: number;
  photo?: number; // 1 = photo principale (1 → 5)
  shape?: 'rect' | 'round' | 'circle';
  color?: string;
  fill?: string | null; // fond plein : cache le texte d'exemple de l'image
  align?: 'right' | 'center' | 'left';
  // Options des modèles intégrés (définis dans le code) :
  rotate?: number; // photo tournée (degrés, autour de son centre)
  poly?: [number, number][]; // photo découpée en polygone (fractions de l'image)
  border?: string; // cadre autour de la photo
  borderW?: number; // épaisseur du cadre (fraction de la largeur de l'image)
  item?: number; // « features » / « icon » : n-ième atout (surface, chambres, salles de bain puis atouts choisis)
  prefix?: string; // texte avant l'atout (ex. « ✓ »)
  text?: string; // « label » : texte fixe
  weight?: number;
  font?: 'ar' | 'serif';
  plain?: boolean; // « logo » sans fond (version transparente)
}

export interface CustomTemplate {
  id: string;
  name: string;
  bg: Blob;
  width: number; // taille de l'image de fond
  height: number;
  blocks: TemplateBlock[];
  created: number;
}

export const BLOCK_LABELS: Record<BlockKind, string> = {
  photo: 'صورة',
  headline: 'العنوان الكبير',
  subtitle: 'سطر بالفرنسية',
  price: 'الثمن',
  address: 'الحي والمدينة',
  specs: 'المساحة والغرف',
  features: 'المميزات',
  phone: 'الهاتف',
  logo: 'الشعار',
  qr: 'رمز QR',
  icon: 'أيقونة',
  label: 'نص',
};

// ---------- Registre ----------
export type BuiltinId = 'wasset' | 'ardoise' | 'marine' | 'taupe' | 'sauge';

export type PosterTemplate =
  | { kind: 'builtin'; id: BuiltinId; name: string }
  | { kind: 'custom'; id: string; name: string; tpl: CustomTemplate; bgImg: Img }
  | { kind: 'image'; id: string; name: string; size: [number, number]; blocks: TemplateBlock[]; bgImg: Img }
  | { kind: 'kit'; id: string; name: string; style: KitStyle }; // adaptable : dessiné à la taille de chaque plateforme

interface BuiltinSpec {
  id: BuiltinId;
  name: string;
  size: [number, number];
  frame: string; // couleur autour de l'affiche quand la plateforme a un autre format
  draw?: (ctx: CanvasRenderingContext2D, d: PosterData, p: Img[]) => void;
}

export const DEFAULT_TEMPLATE: PosterTemplate = { kind: 'builtin', id: 'wasset', name: 'الوسيط' };

// ---------- Outils ----------
export const pick = (p: Img[], i: number): Img | undefined => p[i] ?? (p.length ? p[i % p.length] : undefined);

const typeOf = (d: PosterData) => d.type || 'Appartement';
export const subOf = (d: PosterData) => `${TYPE_LABELS[typeOf(d)].fr} · ${DEAL_LABELS[d.deal].fr}`;
export const priceOf = (d: PosterData) => formatPrice(d.price) || 'فرصة مميزة';
export const placeOf = (d: PosterData) => [d.district, d.city].filter(Boolean).join('، ');

export type Spec = { icon: IconNode; text: string };
export function specList(d: PosterData, n = 4): Spec[] {
  const out: Spec[] = [];
  if (d.surface) out.push({ icon: Maximize, text: d.surfaceMax > d.surface ? `${d.surface}-${d.surfaceMax} م²` : `${d.surface} م²` });
  if (d.bedrooms) out.push({ icon: BedDouble, text: `${d.bedrooms} ${d.bedrooms === 1 ? 'غرفة' : 'غرف'}` });
  if (d.bathrooms) out.push({ icon: Bath, text: `${d.bathrooms} حمام` });
  d.features.forEach((f) => out.push({ icon: featureInfo(f).icon, text: f }));
  if (!out.length) out.push({ icon: House, text: TYPE_LABELS[typeOf(d)].ar });
  return out.slice(0, n);
}

interface SayOpts {
  size: number;
  color: string;
  weight?: number;
  align?: CanvasTextAlign;
  font?: 'ar' | 'lat' | 'serif';
  maxW?: number;
}
export function say(ctx: CanvasRenderingContext2D, t: string, x: number, y: number, o: SayOpts): number {
  const fam = o.font === 'serif' ? SERIF : o.font === 'lat' ? LAT : hasArabic(t) ? AR : LAT;
  ctx.save();
  ctx.direction = hasArabic(t) ? 'rtl' : 'ltr';
  ctx.textAlign = o.align ?? 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = o.color;
  const s = o.maxW ? fitFont(ctx, t, o.weight ?? 800, o.size, fam, o.maxW, o.size * 0.4) : o.size;
  ctx.font = `${o.weight ?? 800} ${s}px ${fam}`;
  ctx.fillText(t, x, y);
  const w = ctx.measureText(t).width;
  ctx.restore();
  return w;
}

// Icône + texte centrés sur cx (l'icône à droite du texte, sens arabe).
export function iconText(ctx: CanvasRenderingContext2D, icon: IconNode, t: string, cx: number, y: number, size: number, color: string, maxW: number) {
  ctx.save();
  const fam = hasArabic(t) ? AR : LAT;
  const s = fitFont(ctx, t, 700, size, fam, maxW - size * 1.4, size * 0.5);
  const tw = ctx.measureText(t).width;
  const total = tw + s * 1.4;
  const right = cx + total / 2;
  drawIcon(ctx, icon, right - s * 0.55, y - s * 0.34, s * 1.05, color, 2.2);
  ctx.restore();
  say(ctx, t, right - s * 1.4, y, { size: s, color, weight: 700, align: 'right' });
}

// Texte qui remplit une zone (plusieurs lignes si nécessaire), taille maximale possible.
export function boxText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  o: { color: string; align?: 'right' | 'center' | 'left'; weight?: number; maxSize?: number; font?: 'ar' | 'serif' }
) {
  if (!text.trim()) return;
  const fam = o.font === 'serif' ? SERIF : AR;
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
  for (; size >= 8; size -= Math.max(1, size * 0.05)) {
    ctx.font = `${weight} ${size}px ${fam}`;
    lines = text.split('\n').flatMap(wrap);
    if (lines.length * size * K <= h && lines.every((l) => ctx.measureText(l).width <= w)) break;
  }
  ctx.fillStyle = o.color;
  ctx.textBaseline = 'middle';
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

// Marque « PUB الوسيط 777 » sur une pastille blanche. Renvoie la largeur occupée.
export function markBadge(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, align: 'left' | 'center' | 'right' = 'left', plain = false): number {
  const m = markLogo();
  if (!m) return 0;
  const round = Math.abs(m.width - m.height) < 4; // logo rond : il a déjà son propre fond blanc
  const pad = plain || round ? 0 : h * 0.1;
  const lw = ((h - pad * 2) * m.width) / m.height;
  const bw = lw + pad * 2;
  const bx = align === 'left' ? x : align === 'center' ? x - bw / 2 : x - bw;
  if (!plain && !round) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = h * 0.15;
    rr(ctx, bx, y, bw, h, h * 0.18);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.restore();
  }
  ctx.drawImage(m, bx + pad, y + pad, lw, h - pad * 2);
  return bw;
}

export function circlePhoto(ctx: CanvasRenderingContext2D, img: Img | undefined, cx: number, cy: number, r: number, ring: number, ringColor: string) {
  coverInPath(
    ctx,
    img,
    () => {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
    },
    cx - r,
    cy - r,
    r * 2,
    r * 2
  );
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.lineWidth = ring;
  ctx.strokeStyle = ringColor;
  ctx.stroke();
  ctx.restore();
}

// Barre d'atouts : icône + texte, de droite à gauche.
function specBar(ctx: CanvasRenderingContext2D, list: Spec[], x: number, y: number, w: number, h: number, color: string) {
  const cw = w / list.length;
  list.forEach((sp, i) => {
    const cx = x + w - cw * i - cw / 2;
    iconText(ctx, sp.icon, sp.text, cx, y + h / 2 + h * 0.12, Math.min(h * 0.3, 34), color, cw - 16);
  });
}

// ---------- Modèle « Ardoise » (4:5) : grande photo, 3 photos rondes, cartes titre et prix ----------
function drawArdoise(ctx: CanvasRenderingContext2D, d: PosterData, p: Img[]) {
  const C = '#2e3a40';
  const C2 = '#8ea1ab';
  ctx.fillStyle = C;
  ctx.fillRect(0, 0, 1080, 1350);
  coverRect(ctx, pick(p, 0), 28, 28, 830, 1150, 30);
  [235, 575, 915].forEach((cy, i) => circlePhoto(ctx, pick(p, i + 1), 900, cy, 145, 10, '#fff'));
  markBadge(ctx, 56, 56, 92);
  // Carte titre
  rr(ctx, -40, 330, 530, 280, 36);
  ctx.fillStyle = C;
  ctx.fill();
  boxText(ctx, headlineOf(d), 30, 350, 430, 170, { color: '#fff', weight: 900, align: 'right', maxSize: 84 });
  say(ctx, subOf(d), 460, 572, { size: 32, color: '#c9d4da', font: 'serif', weight: 700, align: 'right', maxW: 430 });
  // Carte prix + contact
  rr(ctx, -40, 610, 530, 330, 36);
  ctx.fillStyle = C2;
  ctx.fill();
  say(ctx, priceOf(d), 460, 705, { size: 66, color: '#fff', weight: 900, align: 'right', maxW: 430 });
  if (placeOf(d)) {
    drawIcon(ctx, MapPin, 440, 764, 34, '#fff', 2.2);
    say(ctx, placeOf(d), 412, 776, { size: 32, color: '#fff', weight: 700, align: 'right', maxW: 380 });
  }
  say(ctx, 'للتواصل و الاستفسار', 460, 840, { size: 28, color: '#eef3f5', weight: 700, align: 'right', maxW: 430 });
  say(ctx, PHONES_LINE, 460, 892, { size: 38, color: '#fff', weight: 800, align: 'right', font: 'lat', maxW: 430 });
  specBar(ctx, specList(d), 40, 1190, 1000, 132, '#fff');
}

// ---------- Modèle « Taupe » (4:5) : bandeau titre, grande photo, 3 photos rondes, pastille prix ----------
function drawTaupe(ctx: CanvasRenderingContext2D, d: PosterData, p: Img[]) {
  const C = '#857669';
  const C2 = '#a59486';
  ctx.fillStyle = C;
  ctx.fillRect(0, 0, 1080, 1350);
  boxText(ctx, headlineOf(d), 60, 26, 960, 110, { color: '#fff', weight: 900, maxSize: 86 });
  if (placeOf(d)) iconText(ctx, MapPin, placeOf(d), 540, 182, 34, '#f3ede7', 900);
  else say(ctx, subOf(d), 540, 182, { size: 34, color: '#f3ede7', font: 'serif', weight: 700 });
  coverRect(ctx, pick(p, 0), 28, 212, 830, 960, 30);
  [362, 692, 1022].forEach((cy, i) => circlePhoto(ctx, pick(p, i + 1), 905, cy, 140, 10, '#efe9e3'));
  rr(ctx, -60, 300, 440, 270, 70);
  ctx.fillStyle = C2;
  ctx.fill();
  say(ctx, priceOf(d), 190, 392, { size: 62, color: '#fff', weight: 900, maxW: 340 });
  say(ctx, 'للتواصل و الاستفسار', 190, 442, { size: 26, color: '#f6f1ec', weight: 700, maxW: 340 });
  say(ctx, A.poster.phones[0], 190, 492, { size: 34, color: '#fff', weight: 800, font: 'lat', maxW: 340 });
  say(ctx, A.poster.phones[1] ?? '', 190, 534, { size: 34, color: '#fff', weight: 800, font: 'lat', maxW: 340 });
  markBadge(ctx, 52, 1066, 84);
  specBar(ctx, specList(d), 40, 1186, 1000, 136, '#fff');
}

// ---------- Modèle « Marine » (9:16, story) : grand titre, contact, grande photo et 3 vignettes ----------
function drawMarine(ctx: CanvasRenderingContext2D, d: PosterData, p: Img[]) {
  const N = '#1b2a49';
  ctx.fillStyle = N;
  ctx.fillRect(0, 0, 1080, 1920);
  coverRect(ctx, pick(p, 1), 0, 0, 1080, 230, 0);
  ctx.fillStyle = 'rgba(27,42,73,0.35)';
  ctx.fillRect(0, 0, 1080, 230);
  ctx.fillStyle = N;
  ctx.fillRect(0, 170, 1080, 330);
  boxText(ctx, headlineOf(d), 60, 200, 960, 150, { color: '#fff', weight: 900, maxSize: 124 });
  say(ctx, subOf(d).toUpperCase(), 540, 410, { size: 40, color: '#c8d3ea', weight: 700, font: 'lat', maxW: 940 });
  // Pastille : logo + téléphone
  rr(ctx, 90, 450, 900, 124, 62);
  ctx.fillStyle = '#fff';
  ctx.fill();
  const lw = markBadge(ctx, 130, 468, 88, 'left', true);
  ctx.fillStyle = N;
  ctx.beginPath();
  ctx.arc(130 + lw + 70, 512, 44, 0, Math.PI * 2);
  ctx.fill();
  drawIcon(ctx, Phone, 130 + lw + 70, 512, 42, '#fff', 2.2);
  say(ctx, PHONES_LINE, 130 + lw + 130, 528, { size: 44, color: N, weight: 800, align: 'left', font: 'lat', maxW: 960 - (130 + lw + 130) });
  coverRect(ctx, pick(p, 0), 0, 610, 1080, 820, 0);
  [60, 390, 720].forEach((x, i) => {
    rr(ctx, x, 1330, 300, 300, 14);
    ctx.fillStyle = '#fff';
    ctx.fill();
    coverRect(ctx, pick(p, i + 1), x + 10, 1340, 280, 280, 8);
  });
  say(ctx, priceOf(d), 540, 1726, { size: 92, color: '#fff', weight: 900, maxW: 960 });
  if (placeOf(d)) iconText(ctx, MapPin, placeOf(d), 540, 1792, 38, '#c8d3ea', 960);
  specBar(ctx, specList(d), 40, 1810, 1000, 100, '#fff');
}

// ---------- Modèle « Sauge » (4:5) : en-tête logo, titre, prix, photos, atouts, détails ----------
function drawSauge(ctx: CanvasRenderingContext2D, d: PosterData, p: Img[]) {
  const S = '#6e8d82';
  const TXT = '#55756a';
  const BEIGE = '#e2cfae';
  ctx.fillStyle = '#f4f0e8';
  ctx.fillRect(0, 0, 1080, 1350);
  ctx.fillStyle = S;
  ctx.fillRect(0, 0, 1080, 140);
  if (!markBadge(ctx, 540, 22, 96, 'center')) say(ctx, A.nameFr, 540, 90, { size: 44, color: '#fff', weight: 800 });
  boxText(ctx, headlineOf(d), 60, 160, 960, 112, { color: TXT, weight: 900, maxSize: 94 });
  say(ctx, subOf(d), 540, 308, { size: 32, color: '#8a9a93', font: 'serif', weight: 700, maxW: 940 });
  rr(ctx, 60, 334, 620, 64, 10);
  ctx.fillStyle = BEIGE;
  ctx.fill();
  iconText(ctx, MapPin, placeOf(d) || A.poster.addressAr, 370, 376, 30, '#fff', 590);
  rr(ctx, 700, 334, 320, 64, 10);
  ctx.fillStyle = BEIGE;
  ctx.fill();
  say(ctx, priceOf(d), 860, 378, { size: 36, color: '#fff', weight: 900, maxW: 290 });
  coverRect(ctx, pick(p, 0), 60, 424, 640, 470, 14);
  coverRect(ctx, pick(p, 1), 716, 424, 304, 227, 14);
  coverRect(ctx, pick(p, 2), 716, 667, 304, 227, 14);
  // Atouts : « titre : détail »
  const feats = d.features.length ? d.features.slice(0, 4).map((f) => [f, featureInfo(f).sub] as const) : specList(d).map((s) => [s.text, ''] as const);
  feats.forEach(([t, sub], i) => {
    const y = 948 + i * 42;
    const tw = say(ctx, `${t}${sub ? ' :' : ''}`, 1020, y, { size: 30, color: '#2d3a35', weight: 800, align: 'right', maxW: 600 });
    if (sub) say(ctx, sub, 1020 - tw - 12, y, { size: 28, color: '#4a5752', weight: 500, align: 'right', maxW: 940 - tw });
  });
  // Détails
  say(ctx, 'تفاصيل العقار', 1020, 1128, { size: 32, color: TXT, weight: 900, align: 'right' });
  rr(ctx, 60, 1144, 960, 96, 12);
  ctx.fillStyle = '#e8e2d5';
  ctx.fill();
  const details = [
    `النوع : ${TYPE_LABELS[typeOf(d)].ar}`,
    d.surface ? `المساحة : ${d.surface} م²` : '',
    d.bedrooms ? `الغرف : ${d.bedrooms}` : '',
    d.bathrooms ? `الحمامات : ${d.bathrooms}` : '',
    d.city ? `المدينة : ${d.city}` : '',
  ].filter(Boolean).slice(0, 3);
  details.forEach((t, i) => say(ctx, `• ${t}`, 1000 - i * 320, 1203, { size: 28, color: '#2d3a35', weight: 700, align: 'right', maxW: 300 }));
  ctx.fillStyle = S;
  ctx.fillRect(0, 1262, 1080, 88);
  // « للتواصل : » en arabe, numéros de gauche à droite (sinon l'ordre s'inverse)
  const nums = A.poster.phones.join('  /  ');
  ctx.font = `800 34px ${AR}`;
  const lw = ctx.measureText('للتواصل :').width;
  ctx.font = `800 34px ${LAT}`;
  const nw = Math.min(ctx.measureText(nums).width, 1000 - lw - 16);
  const left = 540 - (lw + 16 + nw) / 2;
  say(ctx, nums, left, 1318, { size: 34, color: '#fff', weight: 800, align: 'left', font: 'lat', maxW: nw });
  say(ctx, 'للتواصل :', left + nw + 16 + lw, 1318, { size: 34, color: '#fff', weight: 800, align: 'right' });
}

const BUILTINS: BuiltinSpec[] = [
  { id: 'wasset', name: 'الوسيط', size: [1080, 1350], frame: '#ffffff' },
  { id: 'ardoise', name: 'رمادي', size: [1080, 1350], frame: '#2e3a40', draw: drawArdoise },
  { id: 'marine', name: 'أزرق (ستوري)', size: [1080, 1920], frame: '#1b2a49', draw: drawMarine },
  { id: 'taupe', name: 'بني', size: [1080, 1350], frame: '#857669', draw: drawTaupe },
  { id: 'sauge', name: 'أخضر', size: [1080, 1350], frame: '#6e8d82', draw: drawSauge },
];

export const BUILTIN_TEMPLATES: PosterTemplate[] = [
  { kind: 'builtin', id: 'wasset', name: 'الوسيط' },
  ...KIT_STYLES.map((style): PosterTemplate => ({ kind: 'kit', id: style.id, name: style.name, style })),
  ...BUILTINS.filter((b) => b.id !== 'wasset').map((b): PosterTemplate => ({ kind: 'builtin', id: b.id, name: b.name })),
];

// Le modèle convient-il au format de la plateforme ? (« الوسيط » et les modèles adaptables : toujours)
export function fitsAspect(t: PosterTemplate, aspect: number): boolean {
  if (t.kind === 'kit' || (t.kind === 'builtin' && t.id === 'wasset')) return true;
  const [w, h] = nativeSize(t);
  return Math.abs(w / h - aspect) / aspect < 0.04;
}

// ---------- Rendu d'un modèle du gérant ----------
function blockText(b: TemplateBlock, d: PosterData): string {
  switch (b.kind) {
    case 'headline':
      return headlineOf(d);
    case 'subtitle':
      return subOf(d);
    case 'price':
      return priceOf(d);
    case 'address':
      return placeOf(d);
    case 'specs':
      return specList(d, 3).map((s) => s.text).join(' • ');
    case 'features': {
      if (b.item === undefined) return (d.features.length ? d.features : specList(d).map((s) => s.text)).slice(0, 4).join('\n');
      const it = specList(d, 12)[b.item];
      return it ? `${b.prefix ?? ''}${it.text}` : '';
    }
    case 'label':
      return b.text ?? '';
    case 'phone':
      // item -1 : les deux numéros sur une ligne ; item n : un seul numéro ; sinon un numéro par ligne
      return b.item === -1 ? PHONES_LINE : b.item !== undefined ? A.poster.phones[b.item] ?? '' : A.poster.phones.join('\n');
    default:
      return '';
  }
}

export function drawCustomBlocks(ctx: CanvasRenderingContext2D, blocks: TemplateBlock[], d: PosterData, p: Img[], W: number, H: number) {
  for (const b of blocks) {
    const x = b.x * W;
    const y = b.y * H;
    const w = b.w * W;
    const h = b.h * H;
    if (b.kind === 'photo') {
      const img = pick(p, (b.photo ?? 1) - 1);
      const shape = b.shape ?? 'round';
      if (b.poly) {
        // Photo découpée en polygone (bords en biais des modèles Canva)
        const pts = b.poly.map(([px, py]) => [px * W, py * H] as const);
        const xs = pts.map((q) => q[0]);
        const ys = pts.map((q) => q[1]);
        const bx = Math.min(...xs);
        const by = Math.min(...ys);
        coverInPath(
          ctx,
          img,
          () => {
            ctx.beginPath();
            pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
            ctx.closePath();
          },
          bx,
          by,
          Math.max(...xs) - bx,
          Math.max(...ys) - by
        );
        continue;
      }
      if (b.rotate || b.border) {
        // Photo tournée et/ou encadrée
        const bw = (b.borderW ?? 0) * W;
        ctx.save();
        ctx.translate(x + w / 2, y + h / 2);
        ctx.rotate(((b.rotate ?? 0) * Math.PI) / 180);
        if (b.border) {
          ctx.shadowColor = 'rgba(0,0,0,0.25)';
          ctx.shadowBlur = bw * 1.5;
          ctx.fillStyle = b.border;
          ctx.fillRect(-w / 2, -h / 2, w, h);
          ctx.shadowColor = 'transparent';
        }
        coverRect(ctx, img, -w / 2 + bw, -h / 2 + bw, w - bw * 2, h - bw * 2, 0);
        ctx.restore();
        continue;
      }
      coverInPath(
        ctx,
        img,
        () => {
          if (shape === 'circle') {
            ctx.beginPath();
            ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
          } else rr(ctx, x, y, w, h, shape === 'round' ? Math.min(w, h) * 0.06 : 0);
        },
        x,
        y,
        w,
        h
      );
      continue;
    }
    if (b.fill) {
      rr(ctx, x, y, w, h, b.shape === 'rect' ? 0 : Math.min(w, h) * 0.12);
      ctx.fillStyle = b.fill;
      ctx.fill();
    }
    if (b.kind === 'icon') {
      const it = specList(d, 12)[b.item ?? 0];
      if (it) drawIcon(ctx, it.icon, x + w / 2, y + h / 2, Math.min(w, h) * 0.8, b.color || '#ffffff', 1.8);
      continue;
    }
    if (b.kind === 'logo') {
      const m = b.plain ? markLogoAlpha() : markLogo();
      if (m) {
        const s = Math.min(w / m.width, h / m.height);
        ctx.drawImage(m, x + (w - m.width * s) / 2, y + (h - m.height * s) / 2, m.width * s, m.height * s);
      }
      continue;
    }
    if (b.kind === 'qr') {
      const s = Math.min(w, h);
      qr(ctx, A.poster.whatsappUrl, x + (w - s) / 2, y + (h - s) / 2, s);
      continue;
    }
    const pad = Math.min(w, h) * 0.08;
    boxText(ctx, blockText(b, d), x + pad, y + pad, w - pad * 2, h - pad * 2, {
      color: b.color || '#ffffff',
      align: b.align ?? 'center',
      weight: b.weight ?? (b.kind === 'headline' || b.kind === 'price' ? 900 : 800),
      font: b.font,
    });
  }
}

// ---------- Rendu ----------
const CUSTOM_W = 1080;

export function nativeSize(t: PosterTemplate): [number, number] {
  if (t.kind === 'custom') return [CUSTOM_W, Math.round((CUSTOM_W * t.tpl.height) / t.tpl.width)];
  if (t.kind === 'image') return t.size;
  if (t.kind === 'kit') return [1080, 1350];
  return BUILTINS.find((b) => b.id === t.id)!.size;
}

function frameOf(t: PosterTemplate): string {
  if (t.kind === 'kit') return t.style.bg;
  return t.kind !== 'builtin' ? '#ffffff' : BUILTINS.find((b) => b.id === t.id)!.frame;
}

function drawNative(ctx: CanvasRenderingContext2D, d: PosterData, p: Img[], t: PosterTemplate) {
  const [W, H] = nativeSize(t);
  if (t.kind === 'custom') {
    ctx.drawImage(t.bgImg, 0, 0, W, H);
    drawCustomBlocks(ctx, t.tpl.blocks, d, p, W, H);
    return;
  }
  if (t.kind === 'image') {
    ctx.drawImage(t.bgImg, 0, 0, W, H);
    drawCustomBlocks(ctx, t.blocks, d, p, W, H);
    return;
  }
  BUILTINS.find((b) => b.id === t.id)!.draw!(ctx, d, p);
}

// Affiche à la taille demandée (taille d'une plateforme). Le modèle « الوسيط » s'adapte à chaque format ;
// les autres sont centrés sur leur couleur de fond.
export function renderPoster(canvas: HTMLCanvasElement, d: PosterData, p: Img[], w: number, h: number, t: PosterTemplate) {
  if (t.kind === 'builtin' && t.id === 'wasset') return drawPoster(canvas, d, p, w, h);
  if (t.kind === 'kit') {
    canvas.width = w;
    canvas.height = h;
    drawKit(canvas.getContext('2d')!, t.style, d, p, w, h);
    return;
  }
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const [W, H] = nativeSize(t);
  const s = Math.min(w / W, h / H);
  ctx.fillStyle = frameOf(t);
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.translate((w - W * s) / 2, (h - H * s) / 2);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.clip();
  drawNative(ctx, d, p, t);
  ctx.restore();
}

// Aperçu au format d'origine du modèle (vignettes, éditeur).
export function renderPreview(canvas: HTMLCanvasElement, d: PosterData, p: Img[], t: PosterTemplate, width: number, aspect?: number) {
  const [W, H] = nativeSize(t);
  if (t.kind === 'builtin' && t.id === 'wasset') {
    if (aspect) drawPoster(canvas, d, p, 1080, Math.round(1080 / aspect));
    else drawPoster(canvas, d, p, W, H);
    return;
  }
  if (t.kind === 'kit') {
    // Aperçu au format de la plateforme (aspect = largeur / hauteur)
    const h = Math.round(width / (aspect ?? W / H));
    renderPoster(canvas, d, p, width, h, t);
    return;
  }
  canvas.width = width;
  canvas.height = Math.round((width * H) / W);
  const ctx = canvas.getContext('2d')!;
  ctx.save();
  ctx.scale(width / W, width / W);
  drawNative(ctx, d, p, t);
  ctx.restore();
}

export async function templateBlob(d: PosterData, p: Img[], w: number, h: number, t: PosterTemplate): Promise<Blob> {
  await ensureFonts();
  const canvas = document.createElement('canvas');
  renderPoster(canvas, d, p, w, h, t);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Export image impossible'))), 'image/jpeg', 0.92)
  );
}

export async function templateVideo(d: PosterData, p: Img[], w: number, h: number, t: PosterTemplate): Promise<Blob> {
  await ensureFonts();
  const still = document.createElement('canvas');
  renderPoster(still, d, p, w, h, t);
  return posterVideoFrom(still);
}
