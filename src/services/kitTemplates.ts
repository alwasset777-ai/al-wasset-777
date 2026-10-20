// Modèles « adaptables » : dessinés directement à la taille de chaque plateforme (4:5, story 9:16, carré,
// paysage 16:9…), sans bandes autour. Styles inspirés d'annonces immobilières marocaines envoyées par le
// gérant, redessinés ici avec uniquement ses informations, ses photos et son logo.
import { Phone } from 'lucide';
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
  if (W / H >= 1.15) landscape(ctx, s, d, p, W, H);
  else portrait(ctx, s, d, p, W, H);
}
