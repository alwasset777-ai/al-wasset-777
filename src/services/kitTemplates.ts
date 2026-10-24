// Modèles « adaptables » : dessinés directement à la taille de chaque plateforme (4:5, story 9:16, carré,
// paysage 16:9…), sans bandes autour. Styles inspirés d'annonces immobilières marocaines envoyées par le
// gérant, redessinés ici avec uniquement ses informations, ses photos et son logo.
import { MapPin, Phone } from 'lucide';
import { agencyProfile as A } from '../data/agencyProfile';
import { Img, PosterData, brush, coverInPath, coverRect, drawIcon, headlineOf, rr } from './posterMaker';
import { PHONES_LINE, boxText, markBadge, pick, placeOf, priceOf, specList, subOf } from './posterTemplates';

export interface KitStyle {
  id: string;
  name: string;
  bg: string; // fond général
  primary: string; // bandeaux, cercles d'icônes
  accent: string; // 2e couleur (sous-titre, prix)
  onPrimary: string; // texte sur la couleur principale
  onAccent: string; // texte sur la 2e couleur
  ink: string; // texte sur le fond
  panel: string; // bande des atouts
  hero: 'full' | 'boxed'; // grande photo en plein fond ou encadrée
  heading: 'brush' | 'banner' | 'pill' | 'plain';
  layout?: 'stack' | 'diagonal' | 'curves' | 'hex' | 'wave' | 'panel' | 'grid' | 'tower' | 'mosaic' | 'ribbon'; // disposition (par défaut : stack)
  icons: 'circle' | 'card';
  frame: string; // cadre des petites photos
  veil: string; // voile sur le haut de la photo pleine (lisibilité du titre)
}

export const KIT_STYLES: KitStyle[] = [
  {
    id: 'kit-navy', name: 'كحلي وأصفر', bg: '#ffffff', primary: '#0f2a5c', accent: '#ffc928', onPrimary: '#ffffff', onAccent: '#0f2a5c',
    ink: '#0f2a5c', panel: '#ffffff', hero: 'full', heading: 'brush', icons: 'circle', frame: '#ffffff', veil: 'rgba(255,255,255,0.0)',
  },
  {
    id: 'kit-gold-blue', name: 'أزرق وذهبي', bg: '#0f2f73', primary: '#123a8c', accent: '#d9b44a', onPrimary: '#f3d77a', onAccent: '#0f2f73',
    ink: '#ffffff', panel: '#123a8c', hero: 'full', heading: 'banner', icons: 'card', frame: '#d9b44a', veil: 'rgba(15,47,115,0.0)',
  },
  {
    id: 'kit-black-gold', name: 'أسود وذهبي', bg: '#0b0b0b', primary: '#141414', accent: '#e2b33c', onPrimary: '#e2b33c', onAccent: '#0b0b0b',
    ink: '#ffffff', panel: '#141414', hero: 'full', heading: 'brush', icons: 'card', frame: '#e2b33c', veil: 'rgba(0,0,0,0.0)',
  },
  {
    id: 'kit-sky', name: 'سماوي', bg: '#eaf4ff', primary: '#16306b', accent: '#ffe14d', onPrimary: '#ffffff', onAccent: '#16306b',
    ink: '#16306b', panel: '#ffffff', hero: 'boxed', heading: 'brush', icons: 'circle', frame: '#ffffff', veil: 'rgba(0,0,0,0)',
  },
  {
    id: 'kit-cream', name: 'بيج وبني', bg: '#f8efe2', primary: '#5a3a22', accent: '#e9c89b', onPrimary: '#ffffff', onAccent: '#5a3a22',
    ink: '#5a3a22', panel: '#f1e2cc', hero: 'boxed', heading: 'pill', icons: 'circle', frame: '#ffffff', veil: 'rgba(0,0,0,0)',
  },
  {
    id: 'kit-black-orange', name: 'أسود وبرتقالي', bg: '#101317', primary: '#101317', accent: '#f39a1e', onPrimary: '#ffffff', onAccent: '#101317',
    ink: '#ffffff', panel: '#101317', hero: 'boxed', heading: 'plain', icons: 'card', frame: '#f39a1e', veil: 'rgba(0,0,0,0)',
  },
  // Collages de photos (2e série d'exemples)
  {
    id: 'kit-diagonal', name: 'قطع مائل ذهبي', bg: '#1d1d1d', primary: '#2a2a2a', accent: '#c8a24a', onPrimary: '#ffffff', onAccent: '#1d1d1d',
    ink: '#ffffff', panel: 'rgba(30,30,30,0.72)', hero: 'full', heading: 'plain', icons: 'card', frame: '#c8a24a', veil: 'rgba(0,0,0,0.45)', layout: 'diagonal',
  },
  {
    id: 'kit-curves', name: 'دوائر كحلية', bg: '#ffffff', primary: '#1f2f7a', accent: '#1f2f7a', onPrimary: '#ffffff', onAccent: '#ffffff',
    ink: '#ffffff', panel: 'rgba(31,47,122,0.78)', hero: 'full', heading: 'plain', icons: 'circle', frame: '#1f2f7a', veil: 'rgba(0,0,0,0.35)', layout: 'curves',
  },
  {
    id: 'kit-hex', name: 'سداسي برتقالي', bg: '#f6dcc8', primary: '#2b2b2b', accent: '#e8742a', onPrimary: '#ffffff', onAccent: '#ffffff',
    ink: '#2b2b2b', panel: 'rgba(40,40,40,0.82)', hero: 'boxed', heading: 'plain', icons: 'circle', frame: '#ffffff', veil: 'rgba(255,255,255,0.55)', layout: 'hex',
  },
  {
    id: 'kit-wave', name: 'موج أزرق', bg: '#ffffff', primary: '#2f7ad1', accent: '#e53935', onPrimary: '#ffffff', onAccent: '#ffffff',
    ink: '#2f7ad1', panel: '#ffffff', hero: 'boxed', heading: 'plain', icons: 'circle', frame: '#ffffff', veil: 'rgba(0,0,0,0)', layout: 'wave',
  },
  {
    id: 'kit-panel', name: 'أخضر بلوحة', bg: '#ffffff', primary: '#5f9b2c', accent: '#5f9b2c', onPrimary: '#ffffff', onAccent: '#ffffff',
    ink: '#1f1f1f', panel: 'rgba(255,255,255,0.93)', hero: 'full', heading: 'plain', icons: 'card', frame: '#ffffff', veil: 'rgba(0,0,0,0)', layout: 'panel',
  },
  {
    id: 'kit-grid', name: 'أخضر فاتح', bg: '#eef7e8', primary: '#2e8b4e', accent: '#bfe3a8', onPrimary: '#ffffff', onAccent: '#1f5c34',
    ink: '#1f5c34', panel: '#e1f1d6', hero: 'boxed', heading: 'brush', icons: 'circle', frame: '#ffffff', veil: 'rgba(0,0,0,0)', layout: 'grid',
  },
  // 3e série (TikTok)
  {
    id: 'kit-teal', name: 'أخضر زمردي وذهبي', bg: '#ffffff', primary: '#0f7a6c', accent: '#f2c94c', onPrimary: '#ffffff', onAccent: '#0f3b36',
    ink: '#0f3b36', panel: '#ffffff', hero: 'full', heading: 'pill', icons: 'circle', frame: '#ffffff', veil: 'rgba(0,0,0,0)',
  },
  {
    id: 'kit-tower', name: 'كحلي وأحمر', bg: '#eef4fb', primary: '#13285c', accent: '#d7262e', onPrimary: '#ffffff', onAccent: '#ffffff',
    ink: '#13285c', panel: '#ffffff', hero: 'boxed', heading: 'banner', icons: 'circle', frame: '#ffffff', veil: 'rgba(0,0,0,0)', layout: 'tower',
  },
  {
    id: 'kit-mosaic', name: 'كحلي وأصفر بالصور', bg: '#ffffff', primary: '#15295a', accent: '#f4c430', onPrimary: '#ffffff', onAccent: '#15295a',
    ink: '#15295a', panel: '#ffffff', hero: 'boxed', heading: 'banner', icons: 'circle', frame: '#ffffff', veil: 'rgba(0,0,0,0)', layout: 'mosaic',
  },
  {
    id: 'kit-ribbon', name: 'كحلي وذهبي راقي', bg: '#ffffff', primary: '#13213f', accent: '#c9a14a', onPrimary: '#ffffff', onAccent: '#ffffff',
    ink: '#13213f', panel: '#faf7f0', hero: 'full', heading: 'plain', icons: 'card', frame: '#ffffff', veil: 'rgba(0,0,0,0)', layout: 'ribbon',
  },
];

// ---------- Morceaux communs ----------
function heading(ctx: CanvasRenderingContext2D, s: KitStyle, d: PosterData, x: number, y: number, w: number, h: number, u: number) {
  const titleH = h * 0.6;
  const subH = h * 0.36;
  const sub = placeOf(d) || subOf(d);
  const sy = y + titleH + h * 0.04;
  if (s.heading === 'brush') {
    brush(ctx, x, y, w, titleH, s.primary, 21, -0.012);
    boxText(ctx, headlineOf(d), x + w * 0.06, y + titleH * 0.08, w * 0.88, titleH * 0.84, { color: s.onPrimary, weight: 900 });
    brush(ctx, x + w * 0.1, sy, w * 0.86, subH, s.accent, 7, 0.01);
    boxText(ctx, sub, x + w * 0.16, sy + subH * 0.1, w * 0.74, subH * 0.8, { color: s.onAccent, weight: 800 });
    return;
  }
  if (s.heading === 'banner' || s.heading === 'pill') {
    const r = s.heading === 'pill' ? titleH / 2 : 6 * u;
    rr(ctx, x, y, w, titleH, r);
    ctx.fillStyle = s.primary;
    ctx.fill();
    if (s.heading === 'banner') {
      ctx.lineWidth = 5 * u;
      ctx.strokeStyle = s.accent;
      ctx.stroke();
    }
    boxText(ctx, headlineOf(d), x + w * 0.06, y + titleH * 0.1, w * 0.88, titleH * 0.8, { color: s.onPrimary, weight: 900 });
    rr(ctx, x + w * 0.12, sy, w * 0.76, subH, s.heading === 'pill' ? subH / 2 : 6 * u);
    ctx.fillStyle = s.accent;
    ctx.fill();
    boxText(ctx, sub, x + w * 0.16, sy + subH * 0.12, w * 0.68, subH * 0.76, { color: s.onAccent, weight: 800 });
    return;
  }
  // plain : titre en grand, sous-titre en couleur
  boxText(ctx, headlineOf(d), x, y, w, titleH, { color: s.ink, weight: 900 });
  rr(ctx, x + w * 0.12, sy, w * 0.76, subH, subH / 2);
  ctx.lineWidth = 3 * u;
  ctx.strokeStyle = s.accent;
  ctx.stroke();
  boxText(ctx, sub, x + w * 0.16, sy + subH * 0.12, w * 0.68, subH * 0.76, { color: s.accent, weight: 800 });
}

function priceTag(ctx: CanvasRenderingContext2D, s: KitStyle, d: PosterData, x: number, y: number, w: number, h: number, u: number) {
  if (s.heading === 'brush') brush(ctx, x, y, w, h, s.accent, 33, -0.03);
  else {
    rr(ctx, x, y, w, h, s.heading === 'pill' ? h / 2 : 10 * u);
    ctx.fillStyle = s.accent;
    ctx.fill();
  }
  boxText(ctx, priceOf(d), x + w * 0.08, y + h * 0.12, w * 0.84, h * 0.76, { color: s.onAccent, weight: 900 });
}

function thumbs(ctx: CanvasRenderingContext2D, s: KitStyle, p: Img[], x: number, y: number, w: number, h: number, u: number, n = 3) {
  const gap = 16 * u;
  const tw = (w - gap * (n - 1)) / n;
  const b = 7 * u;
  for (let i = 0; i < n; i++) {
    const tx = x + i * (tw + gap);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 14 * u;
    rr(ctx, tx, y, tw, h, 14 * u);
    ctx.fillStyle = s.frame;
    ctx.fill();
    ctx.restore();
    coverRect(ctx, pick(p, i + 1), tx + b, y + b, tw - b * 2, h - b * 2, 10 * u);
  }
}

// Atouts : icône dans un cercle (ou une carte) + libellé.
function features(ctx: CanvasRenderingContext2D, s: KitStyle, d: PosterData, x: number, y: number, w: number, h: number, u: number, cols?: number) {
  const list = specList(d, 4);
  const n = cols ?? list.length;
  const rows = Math.ceil(list.length / n);
  const cw = w / n;
  const ch = h / rows;
  list.forEach((it, i) => {
    const col = i % n;
    const row = Math.floor(i / n);
    const cx = x + w - cw * col - cw / 2; // de droite à gauche
    const cy = y + ch * row;
    if (s.icons === 'card') {
      rr(ctx, cx - cw / 2 + 8 * u, cy + 6 * u, cw - 16 * u, ch - 12 * u, 16 * u);
      ctx.lineWidth = 3 * u;
      ctx.strokeStyle = s.accent;
      ctx.stroke();
      drawIcon(ctx, it.icon, cx, cy + ch * 0.36, Math.min(ch * 0.34, cw * 0.4), s.accent, 1.8);
    } else {
      const r = Math.min(ch * 0.24, cw * 0.24);
      ctx.beginPath();
      ctx.arc(cx, cy + ch * 0.36, r, 0, Math.PI * 2);
      ctx.fillStyle = s.primary;
      ctx.fill();
      ctx.lineWidth = 3 * u;
      ctx.strokeStyle = s.accent;
      ctx.stroke();
      drawIcon(ctx, it.icon, cx, cy + ch * 0.36, r * 1.05, s.onPrimary === '#ffffff' ? '#ffffff' : s.accent, 1.8);
    }
    boxText(ctx, it.text, cx - cw / 2 + 12 * u, cy + ch * 0.62, cw - 24 * u, ch * 0.3, { color: s.icons === 'card' ? s.ink : s.ink, weight: 800 });
  });
}

function contact(ctx: CanvasRenderingContext2D, s: KitStyle, x: number, y: number, w: number, h: number, u: number) {
  ctx.fillStyle = s.primary;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = s.accent;
  ctx.fillRect(x, y, w, 5 * u);
  const r = h * 0.3;
  const cx = x + w - h * 0.55;
  ctx.beginPath();
  ctx.arc(cx, y + h / 2, r, 0, Math.PI * 2);
  ctx.fillStyle = s.accent;
  ctx.fill();
  drawIcon(ctx, Phone, cx, y + h / 2, r * 1.05, s.onAccent, 2.2);
  const tx = x + h * 0.4;
  const tw = cx - r - 20 * u - tx;
  // Bande étroite (paysage) : un numéro par ligne
  const lines = w / h < 4.5;
  boxText(ctx, 'للتواصل و الاستفسار', tx, y + h * 0.08, tw, h * (lines ? 0.22 : 0.34), { color: s.accent, weight: 800, align: 'right' });
  boxText(ctx, lines ? A.poster.phones.join('\n') : PHONES_LINE, tx, y + h * (lines ? 0.34 : 0.44), tw, h * (lines ? 0.58 : 0.46), {
    color: s.onPrimary,
    weight: 900,
    align: 'right',
  });
}

// ---------- Mise en page verticale / carrée ----------
function portrait(ctx: CanvasRenderingContext2D, s: KitStyle, d: PosterData, p: Img[], W: number, H: number) {
  const u = W / 1080;
  const r = H / W;
  const story = r > 1.6; // TikTok / Reels : marges pour l'interface de l'application
  const top = story ? H * 0.05 : 0;
  const safe = story ? H * 0.1 : 0;
  const usable = H - top - safe;
  const square = r < 1.15;
  const pad = 40 * u;
  const headH = usable * (square ? 0.22 : 0.19);
  const thumbsH = usable * (square ? 0.15 : story ? 0.12 : 0.14);
  const featH = usable * (square ? 0.13 : story ? 0.1 : 0.12);
  const contactH = usable * (square ? 0.11 : story ? 0.075 : 0.095);
  const gap = 14 * u;
  const contactY = top + usable - contactH;
  const featY = contactY - featH - gap;
  const thumbsY = featY - thumbsH - gap;
  const heroBot = thumbsY + thumbsH * 0.45;

  ctx.fillStyle = s.bg;
  ctx.fillRect(0, 0, W, H);
  if (s.hero === 'full') {
    coverInPath(ctx, pick(p, 0), () => ctx.rect(0, 0, W, heroBot), 0, 0, W, heroBot);
    // Dégradé sous le titre et au-dessus des petites photos pour la lisibilité
    const g = ctx.createLinearGradient(0, 0, 0, top + headH * 1.4);
    g.addColorStop(0, s.bg === '#ffffff' ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.55)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, top + headH * 1.4);
  } else {
    coverRect(ctx, pick(p, 0), pad, top + headH + gap, W - pad * 2, heroBot - top - headH - gap, 24 * u);
  }
  const logo = Math.min(headH * 0.78, 200 * u);
  markBadge(ctx, pad, top + pad * 0.6, logo);
  heading(ctx, s, d, pad + logo + 24 * u, top + pad * 0.5, W - pad * 2 - logo - 24 * u, headH - pad * 0.6, u);

  priceTag(ctx, s, d, W - pad - W * 0.46, thumbsY - Math.min(140 * u, usable * 0.09) - 18 * u, W * 0.46, Math.min(140 * u, usable * 0.09), u);
  thumbs(ctx, s, p, pad, thumbsY, W - pad * 2, thumbsH, u);

  ctx.fillStyle = s.panel;
  rr(ctx, pad * 0.5, featY, W - pad, featH, 18 * u);
  ctx.fill();
  features(ctx, s, d, pad, featY, W - pad * 2, featH, u);
  contact(ctx, s, 0, contactY, W, contactH, u);
  if (story) {
    ctx.fillStyle = s.primary;
    ctx.fillRect(0, contactY + contactH, W, H - contactY - contactH);
    boxText(ctx, A.poster.sloganAr, W * 0.15, contactY + contactH + safe * 0.15, W * 0.7, safe * 0.4, { color: s.accent, weight: 900 });
  }
}

// ---------- Mise en page horizontale (16:9, Facebook paysage…) ----------
function landscape(ctx: CanvasRenderingContext2D, s: KitStyle, d: PosterData, p: Img[], W: number, H: number) {
  const u = H / 900;
  const pad = 34 * u;
  const leftW = W * 0.43;
  ctx.fillStyle = s.bg;
  ctx.fillRect(0, 0, W, H);
  // Grande photo à droite
  if (s.hero === 'full') coverInPath(ctx, pick(p, 0), () => ctx.rect(leftW, 0, W - leftW, H), leftW, 0, W - leftW, H);
  else coverRect(ctx, pick(p, 0), leftW + pad * 0.5, pad, W - leftW - pad * 1.5, H - pad * 2, 24 * u);
  // Colonne gauche : logo + titre, atouts, prix, contact
  const logo = 150 * u;
  markBadge(ctx, pad, pad, logo);
  heading(ctx, s, d, pad + logo + 20 * u, pad, leftW - pad * 2 - logo - 20 * u, H * 0.24, u);
  const fy = pad + Math.max(logo, H * 0.24) + 20 * u;
  const fh = H * 0.3;
  ctx.fillStyle = s.panel;
  rr(ctx, pad * 0.6, fy, leftW - pad * 1.2, fh, 18 * u);
  ctx.fill();
  features(ctx, s, d, pad, fy, leftW - pad * 2, fh, u, 2);
  const ph = H * 0.12;
  priceTag(ctx, s, d, pad, fy + fh + 18 * u, leftW - pad * 2, ph, u);
  const cy = fy + fh + ph + 36 * u;
  contact(ctx, s, 0, cy, leftW, H - cy, u);
  // Petites photos en bas de la grande
  const th = H * 0.26;
  thumbs(ctx, s, p, leftW + pad, H - th - pad, W - leftW - pad * 2, th, u);

}

export function drawKit(ctx: CanvasRenderingContext2D, s: KitStyle, d: PosterData, p: Img[], W: number, H: number) {
  const layout = s.layout ?? 'stack';
  if (layout !== 'stack') return COLLAGES[layout](ctx, s, d, p, W, H);
  if (W / H >= 1.15) landscape(ctx, s, d, p, W, H);
  else portrait(ctx, s, d, p, W, H);
}

// ======================================================================
// Collages de photos : diagonales, cercles, hexagones, vagues, panneau, grille.
// Chaque disposition s'adapte au format (vertical, carré, story, paysage).
// ======================================================================
type Collage = (ctx: CanvasRenderingContext2D, s: KitStyle, d: PosterData, p: Img[], W: number, H: number) => void;
type Pt = [number, number];

// Zone utile : marges de story (interface TikTok / Reels) et sens de l'affiche.
function frame(W: number, H: number) {
  const story = H / W > 1.6;
  const top = story ? H * 0.05 : 0;
  const bottom = story ? H * 0.1 : 0;
  return { story, top, h: H - top - bottom, wide: W / H >= 1.15, u: Math.min(W, H) / 1080 };
}

function polyPhoto(ctx: CanvasRenderingContext2D, img: Img | undefined, pts: Pt[]) {
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

function line(ctx: CanvasRenderingContext2D, a: Pt, b: Pt, color: string, width: number) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(...a);
  ctx.lineTo(...b);
  ctx.stroke();
  ctx.restore();
}

// Pavé translucide avec texte (titres, prix, atouts posés sur les photos).
function chip(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, w: number, h: number, bg: string, color: string, r: number, weight = 800) {
  if (!text) return;
  rr(ctx, x, y, w, h, r);
  ctx.fillStyle = bg;
  ctx.fill();
  boxText(ctx, text, x + h * 0.25, y + h * 0.14, w - h * 0.5, h * 0.72, { color, weight });
}

function placeChip(ctx: CanvasRenderingContext2D, d: PosterData, x: number, y: number, w: number, h: number, bg: string, color: string) {
  const t = placeOf(d);
  if (!t) return;
  rr(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = bg;
  ctx.fill();
  drawIcon(ctx, MapPin, x + w - h * 0.55, y + h / 2, h * 0.55, color, 2.2);
  boxText(ctx, t, x + h * 0.4, y + h * 0.16, w - h * 1.4, h * 0.68, { color, weight: 800, align: 'right' });
}

function veilTop(ctx: CanvasRenderingContext2D, W: number, h: number, color: string) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, h);
}

const specsLine = (d: PosterData) => specList(d, 3).map((x) => x.text).join('  •  ');

// --- 1. Diagonales dorées : trois photos coupées en biais ---
const diagonal: Collage = (ctx, s, d, p, W, H) => {
  const { top, h, wide, u, story } = frame(W, H);
  const cH = h * (wide ? 0.13 : 0.085);
  const ph = top + h - cH; // bas des photos
  ctx.fillStyle = s.bg;
  ctx.fillRect(0, 0, W, H);
  const lw = 9 * u;
  if (!wide) {
    const midY = top + (ph - top) * 0.52;
    const A: Pt = [W * 0.36, top];
    const B: Pt = [W * 0.55, midY];
    const C: Pt = [0, top + (ph - top) * 0.8];
    polyPhoto(ctx, pick(p, 1), [[0, 0], A, B, C]);
    polyPhoto(ctx, pick(p, 0), [A, [W, 0], [W, midY], B]);
    polyPhoto(ctx, pick(p, 2), [C, B, [W, midY], [W, ph], [0, ph]]);
    line(ctx, [A[0], 0], B, s.accent, lw);
    line(ctx, C, [W, midY - (W - B[0]) * 0.0], s.accent, lw);
    veilTop(ctx, W * 0.5, (ph - top) * 0.5 + top, 'rgba(0,0,0,0.55)');
    markBadge(ctx, 36 * u, top + 30 * u, 150 * u);
    boxText(ctx, headlineOf(d), 30 * u, top + 200 * u, W * 0.4, (ph - top) * 0.2, { color: '#ffffff', weight: 900 });
    boxText(ctx, subOf(d), 30 * u, top + 200 * u + (ph - top) * 0.2, W * 0.4, (ph - top) * 0.07, { color: s.accent, weight: 700, font: 'serif' });
    chip(ctx, priceOf(d), 0, top + (ph - top) * 0.66, W * 0.5, (ph - top) * 0.1, s.panel, '#ffffff', 0, 900);
    chip(ctx, specsLine(d), W * 0.55, ph - (ph - top) * 0.11, W * 0.42, (ph - top) * 0.075, s.panel, s.accent, 12 * u);
  } else {
    const A: Pt = [W * 0.4, 0];
    const B: Pt = [W * 0.3, ph];
    const M: Pt = [W * 0.35, ph * 0.55];
    polyPhoto(ctx, pick(p, 1), [[0, 0], A, B, [0, ph]]);
    polyPhoto(ctx, pick(p, 0), [A, [W, 0], [W, ph * 0.55], M]);
    polyPhoto(ctx, pick(p, 2), [M, [W, ph * 0.55], [W, ph], B]);
    line(ctx, A, B, s.accent, lw);
    line(ctx, M, [W, ph * 0.55], s.accent, lw);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, W * 0.36, ph);
    markBadge(ctx, 30 * u, 30 * u, 140 * u);
    boxText(ctx, headlineOf(d), 30 * u, 190 * u, W * 0.3, ph * 0.28, { color: '#ffffff', weight: 900 });
    boxText(ctx, subOf(d), 30 * u, 190 * u + ph * 0.28, W * 0.3, ph * 0.08, { color: s.accent, weight: 700, font: 'serif' });
    chip(ctx, priceOf(d), 0, ph * 0.66, W * 0.32, ph * 0.13, s.panel, '#ffffff', 0, 900);
    chip(ctx, specsLine(d), W * 0.52, ph - ph * 0.14, W * 0.45, ph * 0.1, s.panel, s.accent, 12 * u);
  }
  contact(ctx, s, 0, ph, W, cH, u);
  if (story) {
    ctx.fillStyle = s.bg;
    ctx.fillRect(0, ph + cH, W, H - ph - cH);
    boxText(ctx, A.poster.sloganAr, W * 0.15, ph + cH + 20 * u, W * 0.7, H * 0.05, { color: s.accent, weight: 900 });
  }
};

// --- 2. Cercles : grandes photos rondes qui débordent ---
const curves: Collage = (ctx, s, d, p, W, H) => {
  const { top, h, wide, u, story } = frame(W, H);
  const cH = h * (wide ? 0.13 : 0.085);
  const ph = top + h - cH;
  coverInPath(ctx, pick(p, 1), () => ctx.rect(0, 0, W, ph), 0, 0, W, ph);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(0, 0, W, ph);
  const R = wide ? ph * 0.62 : W * 0.6;
  const c1: Pt = wide ? [W * 0.98, ph * 0.3] : [W * 1.02, top + (ph - top) * 0.3];
  const c2: Pt = wide ? [W * 0.62, ph * 1.05] : [-W * 0.02, top + (ph - top) * 0.9];
  for (const [c, img] of [
    [c1, pick(p, 0)],
    [c2, pick(p, 2)],
  ] as const) {
    coverInPath(ctx, img, () => {
      ctx.beginPath();
      ctx.arc(c[0], c[1], R, 0, Math.PI * 2);
    }, c[0] - R, c[1] - R, R * 2, R * 2);
    ctx.beginPath();
    ctx.arc(c[0], c[1], R, 0, Math.PI * 2);
    ctx.lineWidth = 10 * u;
    ctx.strokeStyle = s.primary;
    ctx.stroke();
  }
  const tx = 34 * u;
  const tw = wide ? W * 0.36 : W * 0.46;
  veilTop(ctx, tw + tx * 2, (wide ? ph : (ph - top) * 0.45) + top, 'rgba(0,0,0,0.55)');
  markBadge(ctx, tx, top + 28 * u, 140 * u);
  const ty = top + 190 * u;
  const th = (wide ? ph : ph - top) * 0.18;
  boxText(ctx, headlineOf(d), tx, ty, tw, th, { color: '#ffffff', weight: 900, align: 'left' });
  placeChip(ctx, d, tx, ty + th + 10 * u, tw, th * 0.42, s.panel, '#ffffff');
  chip(ctx, priceOf(d), 0, ty + th * 1.6 + 20 * u, tw + tx, th * 0.62, s.panel, '#ffffff', 0, 900);
  chip(ctx, specsLine(d), wide ? W * 0.62 : W * 0.4, ph - (wide ? ph : ph - top) * 0.1, wide ? W * 0.35 : W * 0.56, (wide ? ph : ph - top) * 0.07, s.panel, '#ffffff', 30 * u);
  contact(ctx, s, 0, ph, W, cH, u);
  if (story) {
    ctx.fillStyle = s.primary;
    ctx.fillRect(0, ph + cH, W, H - ph - cH);
  }
};

// --- 3. Hexagones orange ---
function hexPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    const x = cx + R * Math.cos(a);
    const y = cy + R * 0.88 * Math.sin(a);
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.closePath();
}

const hex: Collage = (ctx, s, d, p, W, H) => {
  const { top, h, wide, u } = frame(W, H);
  ctx.fillStyle = s.bg;
  ctx.fillRect(0, 0, W, H);
  coverInPath(ctx, pick(p, 3), () => ctx.rect(0, 0, W, H), 0, 0, W, H);
  ctx.fillStyle = 'rgba(246,220,200,0.82)';
  ctx.fillRect(0, 0, W, H);
  const cells: [number, number, number][] = wide
    ? [
        [W * 0.2, top + h * 0.58, H * 0.28],
        [W * 0.48, top + h * 0.66, H * 0.26],
        [W * 0.76, top + h * 0.58, H * 0.26],
      ]
    : [
        [W * 0.32, top + h * 0.3, W * 0.3],
        [W * 0.7, top + h * 0.5, W * 0.27],
        [W * 0.3, top + h * 0.68, W * 0.25],
      ];
  // Hexagones décoratifs
  ctx.fillStyle = s.accent;
  hexPath(ctx, wide ? W * 0.9 : W * 0.62, top + h * 0.06, wide ? H * 0.09 : W * 0.09);
  ctx.fill();
  cells.forEach(([cx, cy, R], i) => {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 20 * u;
    hexPath(ctx, cx, cy, R + 8 * u);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();
    coverInPath(ctx, pick(p, i), () => hexPath(ctx, cx, cy, R), cx - R, cy - R, R * 2, R * 2);
    line(ctx, [cx + R * 0.9, cy + R * 0.95], [cx + R * 1.25, cy + R * 0.55], s.accent, 12 * u);
  });
  markBadge(ctx, W - 36 * u - 150 * u, top + 30 * u, 150 * u);
  const list = specList(d, 3);
  list.forEach((it, i) => {
    const [cx, cy, R] = cells[i];
    chip(ctx, it.text, cx - R * 0.8, cy - R * 0.62, R * 1.6, R * 0.24, s.panel, '#ffffff', 10 * u);
  });
  // Titre et prix : en haut à gauche (paysage) ou en bas à droite (vertical), à l'écart des photos
  const by = wide ? top + h * 0.04 : top + h * 0.74;
  const bx = wide ? 36 * u : W * 0.58;
  const bw = wide ? W * 0.5 : W * 0.39;
  boxText(ctx, headlineOf(d), bx, by, bw, h * (wide ? 0.13 : 0.07), { color: s.accent, weight: 900, align: wide ? 'left' : 'right' });
  boxText(ctx, priceOf(d), bx, by + h * (wide ? 0.13 : 0.075), bw, h * (wide ? 0.1 : 0.05), { color: s.primary, weight: 900, align: wide ? 'left' : 'right' });
  if (!wide) placeChip(ctx, d, 36 * u, top + h * 0.06, W * 0.44, h * 0.045, s.panel, '#ffffff');
  boxText(ctx, PHONES_LINE, 36 * u, top + h - h * 0.06, W - 72 * u, h * 0.05, { color: s.primary, weight: 900 });
};

// --- 4. Vagues bleues : collage + encadré blanc + pastille rouge ---
const wave: Collage = (ctx, s, d, p, W, H) => {
  const { top, h, wide, u, story } = frame(W, H);
  ctx.fillStyle = s.bg;
  ctx.fillRect(0, 0, W, H);
  const split = W * (wide ? 0.5 : 0.52);
  const midY = top + h * (wide ? 0.5 : 0.48);
  polyPhoto(ctx, pick(p, 0), [[0, 0], [split, 0], [split - W * 0.08, midY], [0, midY]]);
  polyPhoto(ctx, pick(p, 1), [[0, midY], [split - W * 0.08, midY], [split - W * 0.02, top + h], [0, top + h]]);
  polyPhoto(ctx, pick(p, 2), [[split, 0], [W, 0], [W, top + h * 0.8], [split + W * 0.02, top + h * 0.8]]);
  // Vague bleue qui sépare
  ctx.save();
  ctx.strokeStyle = s.primary;
  ctx.lineWidth = 26 * u;
  ctx.beginPath();
  ctx.moveTo(split + 10 * u, 0);
  ctx.bezierCurveTo(split - W * 0.12, midY * 0.6, split + W * 0.08, midY * 1.2, split - W * 0.04, top + h);
  ctx.stroke();
  ctx.restore();
  // Bas bleu en vague
  ctx.fillStyle = s.primary;
  ctx.beginPath();
  ctx.moveTo(W * 0.35, top + h);
  ctx.bezierCurveTo(W * 0.5, top + h * 0.8, W * 0.75, top + h * 0.92, W, top + h * 0.74);
  ctx.lineTo(W, H);
  ctx.lineTo(W * 0.35, H);
  ctx.closePath();
  ctx.fill();
  markBadge(ctx, 30 * u, top + 30 * u, 150 * u);
  // Encadré blanc du titre
  const bw = W * (wide ? 0.42 : 0.62);
  const bh = h * (wide ? 0.22 : 0.14);
  const bx = (W - bw) / 2;
  const byy = midY - bh / 2;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = 20 * u;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(bx, byy, bw, bh);
  ctx.restore();
  boxText(ctx, headlineOf(d), bx + 20 * u, byy + bh * 0.06, bw - 40 * u, bh * 0.62, { color: s.primary, weight: 900 });
  boxText(ctx, placeOf(d) || subOf(d), bx + 20 * u, byy + bh * 0.66, bw - 40 * u, bh * 0.28, { color: '#555555', weight: 700 });
  // Pastille rouge
  const sr = (wide ? H : W) * 0.12;
  const sx = W * 0.84;
  const sy = top + h * (wide ? 0.58 : 0.7);
  ctx.beginPath();
  ctx.arc(sx, sy, sr, 0, Math.PI * 2);
  ctx.fillStyle = s.accent;
  ctx.fill();
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(-0.25);
  boxText(ctx, specList(d, 1)[0]?.text ?? 'فرصة مميزة', -sr * 0.75, -sr * 0.4, sr * 1.5, sr * 0.8, { color: '#ffffff', weight: 900 });
  ctx.restore();
  boxText(ctx, priceOf(d), W * 0.56, top + h * (wide ? 0.86 : 0.885), W * 0.41, h * (wide ? 0.08 : 0.055), { color: '#ffffff', weight: 900 });
  chip(ctx, PHONES_LINE, 20 * u, top + h * 0.94, W * 0.62, h * 0.05, '#ffffff', s.primary, 12 * u, 800);
  if (story) {
    ctx.fillStyle = s.primary;
    ctx.fillRect(0, top + h, W, H - top - h);
  }
};

// --- 5. Panneau vert : grande photo, panneau blanc d'atouts, carte prix ---
const panel: Collage = (ctx, s, d, p, W, H) => {
  const { top, h, wide, u, story } = frame(W, H);
  coverInPath(ctx, pick(p, 0), () => ctx.rect(0, 0, W, H), 0, 0, W, H);
  // Coin titre blanc en biais
  const tw = W * (wide ? 0.42 : 0.62);
  const th = h * (wide ? 0.28 : 0.19);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(tw + th * 0.4, 0);
  ctx.lineTo(tw, top + th);
  ctx.lineTo(0, top + th);
  ctx.closePath();
  ctx.fill();
  boxText(ctx, headlineOf(d), 30 * u, top + 16 * u, tw - 60 * u, th * 0.56, { color: s.ink, weight: 900, align: 'left' });
  placeChip(ctx, d, 30 * u, top + th * 0.64, tw * 0.8, th * 0.28, s.primary, '#ffffff');
  markBadge(ctx, W - 36 * u - 160 * u, top + 30 * u, 160 * u);
  // Panneau d'atouts
  const list = specList(d, 5);
  const px = 24 * u;
  const py = top + th + 30 * u;
  const pw = W * (wide ? 0.28 : 0.4);
  const rowH = Math.min(h * 0.09, (h * (wide ? 0.55 : 0.5)) / Math.max(list.length, 1));
  ctx.fillStyle = s.panel;
  ctx.fillRect(px, py, pw, rowH * list.length + 20 * u);
  list.forEach((it, i) => {
    const y = py + 10 * u + rowH * i;
    drawIcon(ctx, it.icon, px + rowH * 0.55, y + rowH / 2, rowH * 0.55, s.primary, 2);
    boxText(ctx, it.text, px + rowH * 1.1, y + rowH * 0.18, pw - rowH * 1.3, rowH * 0.64, { color: s.ink, weight: 800, align: 'left' });
    if (i < list.length - 1) line(ctx, [px + 14 * u, y + rowH], [px + pw - 14 * u, y + rowH], '#dddddd', 2 * u);
  });
  // Bas : carte prix verte + contact blanc
  const bh = h * (wide ? 0.2 : 0.13);
  const by = top + h - bh - 20 * u;
  ctx.fillStyle = s.primary;
  ctx.fillRect(px, by, W * 0.4, bh);
  boxText(ctx, priceOf(d), px + 20 * u, by + bh * 0.12, W * 0.4 - 40 * u, bh * 0.76, { color: '#ffffff', weight: 900 });
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fillRect(px + W * 0.42, by, W - px * 2 - W * 0.42, bh);
  drawIcon(ctx, Phone, px + W * 0.42 + bh * 0.4, by + bh / 2, bh * 0.4, s.primary, 2.2);
  boxText(ctx, A.poster.phones.join('\n'), px + W * 0.42 + bh * 0.75, by + bh * 0.1, W - px * 2 - W * 0.42 - bh * 0.9, bh * 0.8, { color: s.ink, weight: 900 });
  if (story) {
    ctx.fillStyle = s.primary;
    ctx.fillRect(0, top + h, W, H - top - h);
  }
};

// --- 6. Grille verte : 4 photos + liste d'atouts à droite ---
const grid: Collage = (ctx, s, d, p, W, H) => {
  const { top, h, wide, u, story } = frame(W, H);
  ctx.fillStyle = s.bg;
  ctx.fillRect(0, 0, W, H);
  const pad = 30 * u;
  const headH = h * (wide ? 0.2 : 0.14);
  const footH = h * (wide ? 0.13 : 0.09);
  markBadge(ctx, pad, top + pad * 0.6, Math.min(headH * 0.85, 150 * u));
  const hx = pad + Math.min(headH * 0.85, 150 * u) + 20 * u;
  brush(ctx, hx, top + pad * 0.6, W - hx - pad, headH * 0.6, s.accent, 5, -0.01);
  boxText(ctx, headlineOf(d), hx + 30 * u, top + pad * 0.6 + headH * 0.06, W - hx - pad - 60 * u, headH * 0.48, { color: s.onAccent, weight: 900 });
  placeChip(ctx, d, hx + (W - hx - pad) * 0.15, top + pad * 0.6 + headH * 0.64, (W - hx - pad) * 0.7, headH * 0.3, s.primary, '#ffffff');
  // Grille 2×2
  const gy = top + headH + 10 * u;
  const gh = h - headH - footH - 30 * u;
  const listW = W * (wide ? 0.3 : 0.34);
  const gw = W - pad * 2 - listW - 16 * u;
  const cw = (gw - 12 * u) / 2;
  const ch = (gh - 12 * u) / 2;
  for (let i = 0; i < 4; i++) {
    const x = pad + (i % 2) * (cw + 12 * u);
    const y = gy + Math.floor(i / 2) * (ch + 12 * u);
    coverRect(ctx, pick(p, i), x, y, cw, ch, 14 * u);
  }
  chip(ctx, priceOf(d), pad + 14 * u, gy + gh - ch * 0.26 - 14 * u, cw * 1.2, ch * 0.24, s.primary, '#ffffff', ch * 0.12, 900);
  // Liste d'atouts
  const lx = W - pad - listW;
  rr(ctx, lx, gy, listW, gh, 22 * u);
  ctx.fillStyle = s.panel;
  ctx.fill();
  const list = specList(d, 6);
  const rowH = gh / Math.max(list.length, 4);
  list.forEach((it, i) => {
    const y = gy + rowH * i;
    const r = Math.min(rowH * 0.32, listW * 0.14);
    ctx.beginPath();
    ctx.arc(lx + listW - r - 16 * u, y + rowH / 2, r, 0, Math.PI * 2);
    ctx.fillStyle = s.primary;
    ctx.fill();
    drawIcon(ctx, it.icon, lx + listW - r - 16 * u, y + rowH / 2, r * 1.05, '#ffffff', 2);
    boxText(ctx, it.text, lx + 14 * u, y + rowH * 0.2, listW - r * 2 - 44 * u, rowH * 0.6, { color: s.ink, weight: 800, align: 'right' });
  });
  // Pied : contact
  const fy = top + h - footH;
  rr(ctx, pad, fy, W - pad * 2, footH - 10 * u, footH / 2);
  ctx.fillStyle = s.panel;
  ctx.fill();
  const r = footH * 0.32;
  ctx.beginPath();
  ctx.arc(pad + footH * 0.5, fy + (footH - 10 * u) / 2, r, 0, Math.PI * 2);
  ctx.fillStyle = s.primary;
  ctx.fill();
  drawIcon(ctx, Phone, pad + footH * 0.5, fy + (footH - 10 * u) / 2, r * 1.05, '#ffffff', 2.2);
  boxText(ctx, PHONES_LINE, pad + footH, fy + footH * 0.16, W - pad * 2 - footH * 1.4, footH * 0.56, { color: s.ink, weight: 900 });
  if (story) boxText(ctx, A.poster.sloganAr, W * 0.15, top + h + 20 * u, W * 0.7, H * 0.05, { color: s.primary, weight: 900 });
};

// --- 7. Tour : bandeaux inclinés, grande photo, colonne de petites photos, bandeau prix rouge ---
function slant(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, k = 0.18) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + h * k, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w - h * k, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fill();
}

const tower: Collage = (ctx, s, d, p, W, H) => {
  const { top, h, wide, u, story } = frame(W, H);
  if (wide) return landscape(ctx, s, d, p, W, H); // trop serré en paysage : disposition classique aux mêmes couleurs
  ctx.fillStyle = s.bg;
  ctx.fillRect(0, 0, W, H);
  coverInPath(ctx, pick(p, 4), () => ctx.rect(0, 0, W, H), 0, 0, W, H);
  ctx.fillStyle = 'rgba(238,244,251,0.86)';
  ctx.fillRect(0, 0, W, H);
  const pad = 30 * u;
  const logo = (wide ? h * 0.24 : W * 0.26);
  markBadge(ctx, pad, top + pad, logo);
  // Titre : deux bandeaux inclinés
  const tx = pad + logo + 24 * u;
  const tw = W - tx - pad;
  const th = h * (wide ? 0.15 : 0.08);
  slant(ctx, tx, top + pad, tw, th, s.primary);
  boxText(ctx, headlineOf(d), tx + th * 0.3, top + pad + th * 0.1, tw - th * 0.6, th * 0.8, { color: '#ffffff', weight: 900 });
  slant(ctx, tx + tw * 0.12, top + pad + th + 8 * u, tw * 0.76, th * 0.62, s.accent);
  boxText(ctx, placeOf(d) || subOf(d), tx + tw * 0.18, top + pad + th + 8 * u + th * 0.08, tw * 0.64, th * 0.46, { color: '#ffffff', weight: 900 });
  // Photos : colonne gauche + grande photo
  const py = top + Math.max(logo, th * 1.7) + pad * 1.6;
  const priceH = h * (wide ? 0.14 : 0.075);
  const featH = h * (wide ? 0.16 : 0.085);
  const placeH = h * (wide ? 0 : 0.05);
  const footH = h * (wide ? 0.12 : 0.075);
  const pBottom = top + h - footH - placeH - priceH - featH - pad * 2.2;
  const colW = (W - pad * 2) * (wide ? 0.24 : 0.36);
  const n = 3;
  const cg = 12 * u;
  const chh = (pBottom - py - cg * (n - 1)) / n;
  for (let i = 0; i < n; i++) {
    const y = py + i * (chh + cg);
    rr(ctx, pad, y, colW, chh, 14 * u);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    coverRect(ctx, pick(p, i + 1), pad + 6 * u, y + 6 * u, colW - 12 * u, chh - 12 * u, 10 * u);
  }
  coverRect(ctx, pick(p, 0), pad + colW + 16 * u, py, W - pad * 2 - colW - 16 * u, pBottom - py, 14 * u);
  // Atouts (icônes en cercle)
  const fy = pBottom + pad * 0.5;
  features(ctx, s, d, pad, fy, W - pad * 2, featH, u);
  // Prix : bandeau rouge incliné
  const prY = fy + featH + pad * 0.4;
  slant(ctx, pad, prY, W - pad * 2, priceH, s.accent, 0.3);
  boxText(ctx, priceOf(d), pad + priceH * 0.4, prY + priceH * 0.12, W - pad * 2 - priceH * 0.8, priceH * 0.76, { color: '#ffffff', weight: 900 });
  if (!wide) placeChip(ctx, d, pad + W * 0.1, prY + priceH + 12 * u, W - pad * 2 - W * 0.2, placeH * 0.9, '#ffffff', s.primary);
  // Pied : téléphones
  const fyy = top + h - footH;
  ctx.fillStyle = s.primary;
  ctx.fillRect(0, fyy, W, footH);
  slant(ctx, -footH * 0.3, fyy, W * 0.08, footH, s.accent, 0.4);
  slant(ctx, W * 0.94, fyy, W * 0.1, footH, s.accent, 0.4);
  drawIcon(ctx, Phone, W * 0.14, fyy + footH / 2, footH * 0.5, '#ffffff', 2.4);
  boxText(ctx, PHONES_LINE, W * 0.2, fyy + footH * 0.18, W * 0.72, footH * 0.64, { color: '#ffffff', weight: 900 });
  if (story) {
    ctx.fillStyle = s.primary;
    ctx.fillRect(0, fyy + footH, W, H - fyy - footH);
  }
};

// --- 8. Mosaïque : photo + titre en angle, liste d'atouts, pinceau prix, 6 photos étiquetées ---
const mosaic: Collage = (ctx, s, d, p, W, H) => {
  const { top, h, wide, u, story } = frame(W, H);
  ctx.fillStyle = s.bg;
  ctx.fillRect(0, 0, W, H);
  const pad = 26 * u;
  const footH = h * (wide ? 0.12 : 0.075);
  const gridH = h * (wide ? 0 : 0.3);
  const upH = h - footH - gridH - (wide ? 0 : pad);
  const photoW = wide ? W * 0.45 : W * 0.6;
  // Grande photo (gauche) + logo
  coverRect(ctx, pick(p, 0), 0, top + h * 0.09, photoW, upH - h * 0.09, 0);
  markBadge(ctx, pad, top + pad * 0.5, h * (wide ? 0.13 : 0.075));
  // Titre en angle (haut droite)
  const tx = photoW - W * 0.06;
  const tw = W - tx;
  const th = upH * 0.2;
  ctx.fillStyle = s.primary;
  ctx.beginPath();
  ctx.moveTo(tx + th * 0.5, top);
  ctx.lineTo(W, top);
  ctx.lineTo(W, top + th);
  ctx.lineTo(tx, top + th);
  ctx.closePath();
  ctx.fill();
  boxText(ctx, headlineOf(d), tx + th * 0.4, top + th * 0.08, tw - th * 0.5, th * 0.84, { color: '#ffffff', weight: 900 });
  ctx.fillStyle = s.accent;
  ctx.fillRect(tx + 14 * u, top + th, tw, th * 0.48);
  boxText(ctx, placeOf(d) || subOf(d), tx + 30 * u, top + th + th * 0.06, tw - 50 * u, th * 0.36, { color: s.primary, weight: 900 });
  // Liste d'atouts (carrés bleus)
  const list = specList(d, 3);
  const ly = top + th * 1.6;
  const lh = upH * 0.5;
  const rowH = lh / 3;
  const lx = photoW + 14 * u;
  const lw = W - lx - pad;
  list.forEach((it, i) => {
    const y = ly + rowH * i;
    const b = rowH * 0.7;
    rr(ctx, lx + lw - b, y + (rowH - b) / 2, b, b, 12 * u);
    ctx.fillStyle = s.primary;
    ctx.fill();
    drawIcon(ctx, it.icon, lx + lw - b / 2, y + rowH / 2, b * 0.55, '#ffffff', 2);
    boxText(ctx, it.text, lx, y + rowH * 0.18, lw - b - 14 * u, rowH * 0.64, { color: s.ink, weight: 900, align: 'right' });
    if (i < 2) line(ctx, [lx, y + rowH], [lx + lw - b - 10 * u, y + rowH], s.accent, 2 * u);
  });
  // Prix au pinceau jaune
  const py = ly + lh + 10 * u;
  const ph = Math.min(upH - (py - top) - 20 * u, upH * 0.2);
  brush(ctx, lx - 20 * u, py, W - lx + 10 * u, ph, s.accent, 9, -0.03);
  boxText(ctx, priceOf(d), lx + 10 * u, py + ph * 0.12, W - lx - 40 * u, ph * 0.76, { color: s.primary, weight: 900 });
  // 6 photos étiquetées (vertical) ou bandeau de 3 (paysage)
  const labels = specList(d, 12).slice(3).map((x) => x.text);
  if (!wide) {
    const gy = top + upH + pad * 0.6;
    const cw = (W - pad * 2 - 24 * u) / 3;
    const ch = (gridH - 12 * u) / 2;
    for (let i = 0; i < 6; i++) {
      const x = pad + (i % 3) * (cw + 12 * u);
      const y = gy + Math.floor(i / 3) * (ch + 12 * u);
      coverRect(ctx, pick(p, i + 1), x, y, cw, ch, 12 * u);
      const lab = labels[i];
      if (lab) chip(ctx, lab, x + 8 * u, y + ch - ch * 0.22 - 8 * u, cw * 0.7, ch * 0.22, s.primary, '#ffffff', 8 * u, 800);
    }
  }
  // Pied
  const fy = top + h - footH;
  ctx.fillStyle = s.primary;
  ctx.fillRect(0, fy, W, H - fy);
  const r = footH * 0.36;
  ctx.beginPath();
  ctx.arc(W - pad - r, fy + footH / 2, r, 0, Math.PI * 2);
  ctx.lineWidth = 5 * u;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  drawIcon(ctx, Phone, W - pad - r, fy + footH / 2, r * 1.05, '#ffffff', 2.4);
  boxText(ctx, PHONES_LINE, pad, fy + footH * 0.2, W - pad * 3 - r * 2, footH * 0.6, { color: '#ffffff', weight: 900, align: 'right' });
  if (story) boxText(ctx, A.poster.sloganAr, W * 0.15, fy + footH + 20 * u, W * 0.7, H * 0.045, { color: s.accent, weight: 900 });
};

// --- 9. Ruban : coin bleu nuit avec logo, grand titre, photos, rubans dorés et liste cochée ---
const ribbon: Collage = (ctx, s, d, p, W, H) => {
  const { top, h, wide, u, story } = frame(W, H);
  ctx.fillStyle = s.bg;
  ctx.fillRect(0, 0, W, H);
  const pad = 30 * u;
  const heroH = h * (wide ? 0.62 : 0.42);
  const heroW = wide ? W * 0.55 : W;
  coverInPath(ctx, pick(p, 0), () => ctx.rect(0, 0, heroW, top + heroH), 0, 0, heroW, top + heroH);
  // Coin bleu nuit
  ctx.fillStyle = s.primary;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(W * (wide ? 0.3 : 0.48), 0);
  ctx.lineTo(0, top + heroH * (wide ? 0.6 : 0.5));
  ctx.closePath();
  ctx.fill();
  markBadge(ctx, pad, top + pad, (wide ? h * 0.2 : W * 0.24));
  // Titre (droite en paysage / bandeau blanc sous la photo en vertical)
  const tX = wide ? heroW + pad : pad;
  const tW = wide ? W - heroW - pad * 2 : W - pad * 2;
  const tY = wide ? top + pad : top + heroH + pad * 0.6;
  const tH = h * (wide ? 0.3 : 0.11);
  boxText(ctx, headlineOf(d), tX, tY, tW, tH, { color: s.primary, weight: 900 });
  line(ctx, [tX + tW * 0.1, tY + tH + 12 * u], [tX + tW * 0.3, tY + tH + 12 * u], s.accent, 3 * u);
  line(ctx, [tX + tW * 0.7, tY + tH + 12 * u], [tX + tW * 0.9, tY + tH + 12 * u], s.accent, 3 * u);
  boxText(ctx, placeOf(d) || subOf(d), tX + tW * 0.3, tY + tH - 4 * u, tW * 0.4, h * 0.035, { color: s.ink, weight: 700 });
  // Ruban doré + liste cochée
  const rY = tY + tH + h * 0.05;
  const rW = wide ? tW : W * 0.62;
  const rX = wide ? tX : W - pad - rW;
  const rH = h * (wide ? 0.08 : 0.05);
  const cX = rX + rW - rH * 0.75; // pastille entièrement dans l'affiche
  slant(ctx, rX + rH * 0.6, rY, rW - rH * 1.2, rH, s.accent, 0.4);
  ctx.beginPath();
  ctx.arc(cX, rY + rH / 2, rH * 0.75, 0, Math.PI * 2);
  ctx.fillStyle = s.primary;
  ctx.fill();
  drawIcon(ctx, specList(d, 1)[0]?.icon ?? Phone, cX, rY + rH / 2, rH * 0.75, '#ffffff', 2);
  boxText(ctx, priceOf(d), rX + rH, rY + rH * 0.12, rW - rH * 2.4, rH * 0.76, { color: '#ffffff', weight: 900 });
  const list = specList(d, 5);
  const lY = rY + rH + 16 * u;
  const lH = h * (wide ? 0.05 : 0.034);
  list.forEach((it, i) => {
    const y = lY + i * lH;
    boxText(ctx, `${it.text}  ✓`, rX, y, rW, lH * 0.9, { color: s.ink, weight: 700, align: 'right' });
  });
  // Petites photos
  const fH = h * (wide ? 0.12 : 0.08);
  const fy = top + h - fH;
  const thY = wide ? top + heroH + pad : lY + list.length * lH + 16 * u;
  const thW = wide ? heroW - pad * 2 : W - pad * 2;
  const thH = wide ? h - heroH - h * 0.12 - pad * 2 : Math.min(h * 0.13, fy - thY - 16 * u); // jamais sur le pied
  if (thH > 40 * u) thumbs(ctx, s, p, pad, thY, thW, thH, u);
  // Pied bleu nuit : téléphones + slogan
  ctx.fillStyle = s.primary;
  ctx.fillRect(0, fy, W, H - fy);
  drawIcon(ctx, Phone, W - pad - fH * 0.35, fy + fH / 2, fH * 0.45, s.accent, 2.2);
  boxText(ctx, PHONES_LINE, W * 0.42, fy + fH * 0.2, W * 0.5 - fH * 0.4, fH * 0.6, { color: '#ffffff', weight: 900, align: 'right' });
  boxText(ctx, A.poster.sloganAr, pad, fy + fH * 0.22, W * 0.36, fH * 0.56, { color: s.accent, weight: 900, align: 'left' });
  if (story) {
    ctx.fillStyle = s.primary;
    ctx.fillRect(0, fy + fH, W, H - fy - fH);
  }
};

const COLLAGES: Record<Exclude<KitStyle['layout'], 'stack' | undefined>, Collage> = { diagonal, curves, hex, wave, panel, grid, tower, mosaic, ribbon };
