// 25 modèles d'affiches immobilières professionnels. Chaque modèle se redessine à la taille de la plateforme :
// portrait 4:5 (Facebook, Instagram…), story 9:16 (TikTok, YouTube : zones sûres en haut et en bas) et paysage 16:9 (X).
// Les zones vides (pas de prix, pas de logo, un seul numéro…) disparaissent sans laisser de trou.
import { agency, agencyPhones } from './agencySettings';
import { Img, PosterData, coverInPath, headlineOf } from './posterMaker';
import {
  allSpecs, archPhoto, mainSpecs, boxText, brandBlock, circlePhoto, contactBlock, coverRect, dealOf, featureList, fillRect, framedPhoto, hGrad, line,
  logo, photo, pick, pill, placeLine, placeOf, poly, priceOf, priceTag, rr, socialRow, socials, specRow, subOf, textW, thumbRow, vGrad,
} from './posterKit';

export type Shape = 'portrait' | 'story' | 'wide';
interface Frame {
  W: number;
  H: number;
  shape: Shape;
  top: number; // zone sûre (story : sous la barre du haut, au-dessus des boutons du bas)
  bot: number;
}
type PriceStyle = 'pill' | 'brush' | 'block' | 'ribbon' | 'text';

export interface Theme {
  bg: string; // fond
  panel: string; // bandeaux et panneaux
  ink: string; // texte de la zone d'informations
  soft: string; // texte secondaire
  accent: string; // pastilles, prix, icônes
  onAccent: string; // texte sur l'accent
  onPanel?: string; // texte sur les bandeaux (blanc par défaut)
  price: PriceStyle;
  plate?: string; // fond du logo
}
type Layout = (ctx: CanvasRenderingContext2D, d: PosterData, p: Img[], t: Theme, f: Frame) => void;

export interface ProDesign {
  id: string;
  name: string;
  theme: Theme;
  layout: Layout;
}

// ---------- Outils ----------
// Couleur #rrggbb avec transparence.
function alpha(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// Nombre de petites photos à montrer : les photos en plus de la principale (emplacements vides avant l'ajout des photos).
// Surface, chambres, salles de bain ou atouts remplis ?
const hasSpecs = (d: PosterData) => mainSpecs(d).length + d.features.length > 0;

const extras = (p: Img[], n: number) => (p.length ? Math.min(n, p.length - 1) : n);

type Item = { h: number; flex?: boolean; draw: (y: number, h: number) => void };
// Empile des éléments dans une hauteur : réduit tout si ça déborde, agrandit les éléments « flex » s'il reste de la place.
function stack(items: (Item | null)[], y: number, h: number, gap: number, valign: 'top' | 'center' | 'bottom' = 'center') {
  const list = items.filter((i): i is Item => !!i);
  if (!list.length) return;
  const fixed = list.reduce((s, i) => s + i.h, 0) + gap * (list.length - 1);
  const flex = list.filter((i) => i.flex).length;
  const k = fixed > h ? h / fixed : 1;
  const grow = fixed < h && flex ? (h - fixed) / flex : 0;
  const used = grow ? h : fixed * k;
  let cy = valign === 'top' ? y : valign === 'bottom' ? y + h - used : y + (h - used) / 2;
  for (const it of list) {
    const ih = it.h * k + (it.flex ? grow : 0);
    it.draw(cy, ih);
    cy += ih + gap * k;
  }
}

interface Ink {
  ink: string;
  soft: string;
  accent: string;
  onAccent: string;
  price: PriceStyle;
  priceFill?: string;
  priceInk?: string;
  iconBg?: string;
  iconColor?: string;
}

// Éléments d'information prêts à empiler dans une colonne (x, w), alignés à droite (arabe) ou centrés.
function kit(ctx: CanvasRenderingContext2D, d: PosterData, x: number, w: number, align: 'right' | 'center', c: Ink) {
  const ax = align === 'right' ? x + w : x + w / 2;
  const at = (bw: number) => (align === 'right' ? x + w - bw : x + (w - bw) / 2);
  return {
    deal: (h = 62): Item => ({ h, draw: (y, hh) => pill(ctx, dealOf(d), ax, y, hh, c.accent, c.onAccent, align) }),
    headline: (h = 150, max = 118): Item => ({
      h,
      draw: (y, hh) => boxText(ctx, headlineOf(d), x, y, w, hh, { color: c.ink, weight: 900, align, maxSize: Math.min(hh * 0.85, max) }),
    }),
    sub: (h = 40): Item => ({
      h,
      draw: (y, hh) => boxText(ctx, subOf(d).toUpperCase(), x, y, w, hh, { color: c.soft, weight: 700, align, font: 'serif', maxSize: hh * 0.8 }),
    }),
    place: (h = 46): Item | null => (placeOf(d) ? { h, draw: (y, hh) => placeLine(ctx, d, x, y, w, hh, c.ink, align, c.accent) } : null),
    price: (h = 96): Item | null => {
      if (!priceOf(d)) return null;
      return {
        h,
        draw: (y, hh) => {
          const text = c.price === 'text';
          const pw = text ? w : Math.min(w, textW(ctx, priceOf(d), hh * 0.62, 900) / 0.84 + hh * 0.6);
          priceTag(ctx, d, at(pw), y, pw, hh, c.price, c.priceFill ?? c.accent, c.priceInk ?? (text ? c.accent : c.onAccent));
        },
      };
    },
    specs: (h = 120, n = 4): Item | null =>
      hasSpecs(d) ? { h, draw: (y, hh) => specRow(ctx, allSpecs(d, n), x, y, w, hh, c.ink, c.iconBg, c.iconColor ?? c.ink) } : null,
    list: (h = 220, n = 5, cols = 1): Item | null =>
      hasSpecs(d) ? { h: Math.min(h, (h / n) * allSpecs(d, n).length * cols), draw: (y, hh) => featureList(ctx, allSpecs(d, n), x, y, w, hh, c.ink, c.accent, cols) } : null,
    contact: (h = 96): Item | null =>
      agencyPhones().length ? { h, draw: (y, hh) => contactBlock(ctx, x, y, w, hh, { color: c.ink, accent: c.accent, onAccent: c.onAccent }) } : null,
    socials: (h = 46): Item | null => (socials().length ? { h, draw: (y, hh) => socialRow(ctx, x, y, w, hh, c.ink, c.accent) } : null),
    brand: (h = 100, color = c.ink, plate?: string): Item | null =>
      agency().logo || agency().name.trim() ? { h, draw: (y, hh) => brandBlock(ctx, x, y, w, hh, color, plate, 'right') } : null,
    rule: (color = c.soft): Item => ({ h: 2, draw: (y) => line(ctx, at(w * 0.3), y, at(w * 0.3) + w * 0.3, y, color, 3) }),
    space: (h: number, flex = false): Item => ({ h, flex, draw: () => undefined }),
  };
}

// Logo centré + nom de l'agence en dessous. Renvoie la hauteur occupée.
function brandCenter(ctx: CanvasRenderingContext2D, cx: number, y: number, h: number, color: string, plate?: string): number {
  const a = agency();
  const lw = logo(ctx, cx, y, h, 'center', plate);
  const name = a.name.trim();
  if (!name) return lw ? h : 0;
  const ny = lw ? y + h + h * 0.08 : y;
  const nh = lw ? h * 0.34 : h * 0.6;
  boxText(ctx, name, cx - 400, ny, 800, nh, { color, weight: 900, maxSize: nh * 0.9 });
  return ny - y + nh;
}

// Bandeau de contact : numéros (droite) + réseaux sociaux (gauche).
function footer(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, accent: string, onAccent: string) {
  const hasPhones = agencyPhones().length > 0;
  const hasSocial = socials().length > 0;
  if (hasPhones && hasSocial) {
    contactBlock(ctx, x, y, w, h * 0.56, { color, accent, onAccent });
    socialRow(ctx, x, y + h * 0.6, w, h * 0.4, color, accent);
  } else if (hasPhones) contactBlock(ctx, x + w * 0.1, y, w * 0.9, h, { color, accent, onAccent });
  else if (hasSocial) socialRow(ctx, x, y + h * 0.2, w, h * 0.6, color, accent);
}

const topShade = (ctx: CanvasRenderingContext2D, f: Frame, h = 280) =>
  fillRect(ctx, 0, 0, f.W, f.top + h, vGrad(ctx, 0, f.top + h, [[0, 'rgba(0,0,0,0.6)'], [1, 'rgba(0,0,0,0)']]));

// ---------- 1. Plein cadre : grande photo, dégradé, informations en bas ----------
const hero = (o: { thumbs?: boolean } = {}): Layout => (ctx, d, p, t, f) => {
  const { W, H } = f;
  photo(ctx, pick(p, 0), 0, 0, W, H);
  topShade(ctx, f);
  brandBlock(ctx, 44, f.top + 36, W * 0.55, 100, '#ffffff', t.plate);
  const c: Ink = { ink: t.ink, soft: t.soft, accent: t.accent, onAccent: t.onAccent, price: t.price, iconBg: alpha('#ffffff', 0.16), iconColor: t.accent };
  if (f.shape === 'wide') {
    fillRect(ctx, 0, 0, W, H, hGrad(ctx, W * 0.28, W, [[0, alpha(t.panel, 0)], [0.45, alpha(t.panel, 0.85)], [1, alpha(t.panel, 0.96)]]));
    pill(ctx, dealOf(d), W - 48, 44, 66, t.accent, t.onAccent, 'right');
    const x = W * 0.53;
    const k = kit(ctx, d, x, W - 48 - x, 'right', c);
    stack([k.headline(150, 104), k.sub(38), k.place(46), k.price(92), k.specs(112), k.contact(90)], 136, H - 176, 14);
    if (o.thumbs) {
      const n = extras(p, 3);
      if (n) thumbRow(ctx, p, 1, n, 44, H - 44 - 130, n * 180 + (n - 1) * 14, 130, 14, 12, 6, '#ffffff');
    }
    return;
  }
  pill(ctx, dealOf(d), W - 44, f.top + 50, 74, t.accent, t.onAccent, 'right');
  const g0 = H * 0.36;
  fillRect(ctx, 0, g0, W, H - g0, vGrad(ctx, g0, H, [[0, alpha(t.panel, 0)], [0.4, alpha(t.panel, 0.8)], [1, alpha(t.panel, 0.97)]]));
  if (o.thumbs) {
    const n = extras(p, 3);
    for (let i = 0; i < n; i++) framedPhoto(ctx, pick(p, i + 1), W - 44 - 200, f.top + 170 + i * 168, 200, 150, 6, '#ffffff', 10);
  }
  const y0 = f.shape === 'story' ? f.bot - 900 : f.bot - 680;
  const k = kit(ctx, d, 44, W - 88, 'right', c);
  stack([k.headline(170), k.sub(44), k.place(50), k.price(108), k.specs(128), k.contact(120), f.shape === 'story' ? k.socials(50) : null], y0, f.bot - 30 - y0, 16, 'bottom');
};

// ---------- 2. Photo en haut, panneau en bas ; petites photos et prix à cheval ----------
const split = (o: { edge: 'straight' | 'curve' | 'slant' }): Layout => (ctx, d, p, t, f) => {
  const { W, H } = f;
  fillRect(ctx, 0, 0, W, H, t.panel);
  const c: Ink = { ink: t.ink, soft: t.soft, accent: t.accent, onAccent: t.onAccent, price: t.price, iconBg: alpha(t.accent, 0.18), iconColor: t.accent };
  if (f.shape === 'wide') {
    const pw = W * 0.56;
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      if (o.edge === 'curve') {
        ctx.lineTo(pw - 40, 0);
        ctx.quadraticCurveTo(pw + 90, H / 2, pw - 40, H);
      } else if (o.edge === 'slant') {
        ctx.lineTo(pw + 70, 0);
        ctx.lineTo(pw - 70, H);
      } else {
        ctx.lineTo(pw, 0);
        ctx.lineTo(pw, H);
      }
      ctx.lineTo(0, H);
      ctx.closePath();
    };
    coverInPath(ctx, pick(p, 0), path, 0, 0, pw + 90, H);
    if (o.edge === 'slant') poly(ctx, [[pw + 70, 0], [pw + 94, 0], [pw - 46, H], [pw - 70, H]], t.accent);
    topShade(ctx, f, 220);
    brandBlock(ctx, 40, 36, 560, 92, '#ffffff', t.plate);
    const n = extras(p, 3);
    if (n) thumbRow(ctx, p, 1, n, 40, H - 40 - 140, n * 196 + (n - 1) * 14, 140, 14, 12, 6, '#ffffff');
    const x = pw + 110;
    const k = kit(ctx, d, x, W - 48 - x, 'right', c);
    stack([k.deal(60), k.headline(150, 96), k.sub(36), k.place(44), k.price(88), k.specs(108), k.contact(86)], 40, H - 80, 14);
    return;
  }
  const ph = f.top + (f.bot - f.top) * 0.5;
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(W, 0);
    if (o.edge === 'curve') {
      ctx.lineTo(W, ph - 70);
      ctx.quadraticCurveTo(W / 2, ph + 80, 0, ph - 70);
    } else if (o.edge === 'slant') {
      ctx.lineTo(W, ph - 100);
      ctx.lineTo(0, ph + 40);
    } else {
      ctx.lineTo(W, ph);
      ctx.lineTo(0, ph);
    }
    ctx.closePath();
  };
  coverInPath(ctx, pick(p, 0), path, 0, 0, W, ph + 80);
  if (o.edge === 'slant') poly(ctx, [[0, ph + 40], [W, ph - 100], [W, ph - 74], [0, ph + 66]], t.accent);
  topShade(ctx, f, 240);
  brandBlock(ctx, 44, f.top + 36, W * 0.6, 96, '#ffffff', t.plate);
  pill(ctx, dealOf(d), W - 44, f.top + 48, 72, t.accent, t.onAccent, 'right');
  const by = ph - 30;
  const n = extras(p, 3);
  if (n) thumbRow(ctx, p, 1, n, 44, by - 95, n * 178 + (n - 1) * 14, 150, 14, 12, 7, '#ffffff');
  if (priceOf(d)) {
    const pw = Math.min(W - 88 - (n ? n * 192 : 0), textW(ctx, priceOf(d), 62, 900) / 0.84 + 70);
    priceTag(ctx, d, W - 44 - pw, by - 60, pw, 104, t.price, t.accent, t.onAccent);
  }
  const y0 = by + (n ? 80 : 70);
  const k = kit(ctx, d, 44, W - 88, 'right', c);
  stack([k.headline(150), k.sub(42), k.place(48), k.specs(122), k.contact(116), f.shape === 'story' ? k.socials(50) : null], y0, f.bot - 30 - y0, 14);
};

// ---------- 3. Photo à gauche, colonne d'informations à droite ----------
const sidebar = (o: { bar?: boolean } = {}): Layout => (ctx, d, p, t, f) => {
  const { W, H } = f;
  fillRect(ctx, 0, 0, W, H, t.panel);
  const wide = f.shape === 'wide';
  const sw = wide ? W * 0.38 : W * 0.43;
  const px = W - sw;
  photo(ctx, pick(p, 0), 0, 0, px, H);
  if (o.bar) fillRect(ctx, px - 14, 0, 14, H, t.accent);
  topShade(ctx, f, 200);
  const n = extras(p, 2);
  if (n) {
    const tw = wide ? 210 : 230;
    const th = wide ? 150 : 170;
    for (let i = 0; i < n; i++) framedPhoto(ctx, pick(p, i + 1), 36 + i * (tw + 16), f.bot - 36 - th, tw, th, 7, '#ffffff', 10);
  }
  const x = px + 36;
  const w = W - 36 - x;
  const c: Ink = { ink: t.ink, soft: t.soft, accent: t.accent, onAccent: t.onAccent, price: t.price };
  const k = kit(ctx, d, x, w, 'right', c);
  const brand: Item | null =
    agency().logo || agency().name.trim()
      ? { h: wide ? 96 : 120, draw: (y, hh) => brandBlock(ctx, x, y, w, hh, t.ink, t.plate, 'right') }
      : null;
  if (wide) stack([brand, k.deal(54), k.headline(150, 84), k.sub(34), k.place(44), k.price(84), k.list(170, 4, 2), k.contact(84)], 36, H - 72, 12);
  else
    stack(
      [brand, k.deal(60), k.headline(230, 92), k.sub(38), k.rule(t.accent), k.place(56), k.price(92), k.list(f.shape === 'story' ? 420 : 300, f.shape === 'story' ? 7 : 5), k.contact(140)],
      f.top + 40,
      f.bot - f.top - 80,
      16
    );
};

// ---------- 4. Magazine : fond clair, photo encadrée, typographie élégante ----------
const magazine = (): Layout => (ctx, d, p, t, f) => {
  const { W, H } = f;
  fillRect(ctx, 0, 0, W, H, t.bg);
  const c: Ink = { ink: t.ink, soft: t.soft, accent: t.accent, onAccent: t.onAccent, price: t.price };
  const framed = (x: number, y: number, w: number, h: number) => {
    ctx.save();
    ctx.strokeStyle = t.accent;
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 22, y + 22, w, h);
    ctx.restore();
    coverRect(ctx, pick(p, 0), x, y, w, h, 0);
  };
  if (f.shape === 'wide') {
    framed(48, 48, 820, H - 118);
    const n = extras(p, 2);
    for (let i = 0; i < n; i++) framedPhoto(ctx, pick(p, i + 1), 80 + i * 230, H - 70 - 150, 210, 150, 6, t.bg, 0);
    const x = 950;
    const k = kit(ctx, d, x, W - 50 - x, 'right', c);
    const brand: Item | null = agency().logo || agency().name.trim() ? { h: 90, draw: (y, hh) => brandBlock(ctx, x, y, W - 50 - x, hh, t.ink, undefined, 'right') } : null;
    stack([brand, k.rule(), k.sub(34), k.headline(140, 90), k.place(42), k.price(80), k.list(150, 4, 2), k.contact(84)], 48, H - 96, 14);
    return;
  }
  let y = f.top + 36;
  y += brandCenter(ctx, W / 2, y, f.shape === 'story' ? 130 : 104, t.ink) + 20;
  line(ctx, W * 0.3, y, W * 0.7, y, t.accent, 3);
  const k = kit(ctx, d, 60, W - 120, 'center', c);
  const story = f.shape === 'story';
  stack(
    [
      k.sub(38),
      k.headline(story ? 170 : 120, 96),
      {
        h: story ? 640 : 460,
        flex: true,
        draw: (yy, hh) => {
          framed(60, yy, W - 142, hh - 22);
          const n = extras(p, 2);
          for (let i = 0; i < n; i++) framedPhoto(ctx, pick(p, i + 1), 84 + i * 220, yy + hh - 22 - 150 - 20, 200, 150, 6, t.bg, 0);
          if (priceOf(d)) {
            const pw = Math.min(460, textW(ctx, priceOf(d), 50, 900) / 0.84 + 60);
            priceTag(ctx, d, W - 60 - pw - 30, yy + hh - 22 - 60, pw, 84, t.price === 'text' ? 'block' : t.price, t.accent, t.onAccent);
          }
        },
      },
      k.place(46),
      {
        h: story ? 240 : 180,
        draw: (yy, hh) => {
          const cw = hasSpecs(d) ? W / 2 - 90 : W - 120;
          if (hasSpecs(d)) {
            featureList(ctx, allSpecs(d, 4), W / 2 + 10, yy, W / 2 - 70, hh, t.ink, t.accent, 1);
            if (agencyPhones().length) line(ctx, W / 2, yy + 10, W / 2, yy + hh - 10, alpha(t.ink, 0.25), 2);
          }
          contactBlock(ctx, 60, yy + hh * 0.2, cw, hh * 0.6, { color: t.ink, accent: t.accent, onAccent: t.onAccent });
        },
      },
      k.socials(44),
    ],
    y + 24,
    f.bot - y - 60,
    16
  );
};

// ---------- 5. Mosaïque : bandeau, grande photo + petites photos, informations ----------
const collage = (): Layout => (ctx, d, p, t, f) => {
  const { W, H } = f;
  const onPanel = t.onPanel ?? '#ffffff';
  fillRect(ctx, 0, 0, W, H, t.bg);
  const c: Ink = { ink: t.ink, soft: t.soft, accent: t.accent, onAccent: t.onAccent, price: t.price, iconBg: t.accent, iconColor: t.onAccent };
  const grid = (x: number, y: number, w: number, h: number, vertical: boolean) => {
    const n = extras(p, 3);
    const g = 12;
    if (!n) return photo(ctx, pick(p, 0), x, y, w, h, 16);
    if (vertical) {
      const mw = w * 0.66;
      photo(ctx, pick(p, 0), x, y, mw, h, 16);
      const th = (h - g * (n - 1)) / n;
      for (let i = 0; i < n; i++) photo(ctx, pick(p, i + 1), x + mw + g, y + i * (th + g), w - mw - g, th, 16);
    } else {
      const mh = h * 0.64;
      photo(ctx, pick(p, 0), x, y, w, mh, 16);
      thumbRow(ctx, p, 1, n, x, y + mh + g, w, h - mh - g, g, 16);
    }
  };
  if (f.shape === 'wide') {
    fillRect(ctx, 0, 0, W, 104, t.panel);
    brandBlock(ctx, 40, 14, 700, 76, onPanel, t.plate);
    pill(ctx, dealOf(d), W - 40, 22, 60, onPanel, t.panel, 'right');
    grid(40, 128, 930, H - 168, true);
    const x = 1010;
    const k = kit(ctx, d, x, W - 40 - x, 'right', c);
    stack([k.headline(150, 90), k.sub(34), k.place(44), k.price(86), k.list(170, 4, 2), k.contact(86)], 128, H - 168, 14);
    return;
  }
  const hh = 128;
  fillRect(ctx, 0, 0, W, f.top + hh, t.panel);
  brandBlock(ctx, 40, f.top + 18, W * 0.6, hh - 36, onPanel, t.plate);
  pill(ctx, dealOf(d), W - 40, f.top + 30, hh - 60, onPanel, t.panel, 'right');
  const fh = f.shape === 'story' ? 150 : 128;
  const k = kit(ctx, d, 44, W - 88, 'right', c);
  stack(
    [
      { h: f.shape === 'story' ? 820 : 600, flex: true, draw: (y, h) => grid(40, y, W - 80, h, false) },
      {
        h: 130,
        draw: (y, h) => {
          const pw = priceOf(d) ? Math.min(420, textW(ctx, priceOf(d), h * 0.4, 900) / 0.84 + h * 0.5) : 0;
          boxText(ctx, headlineOf(d), 44 + pw + (pw ? 24 : 0), y, W - 88 - pw - (pw ? 24 : 0), h * 0.66, { color: t.ink, weight: 900, align: 'right', maxSize: 84 });
          if (placeOf(d)) placeLine(ctx, d, 44 + pw + 24, y + h * 0.68, W - 88 - pw - 24, h * 0.3, t.soft, 'right', t.accent);
          if (pw) priceTag(ctx, d, 44, y + h * 0.12, pw, h * 0.72, t.price, t.accent, t.onAccent);
        },
      },
      k.specs(118),
    ],
    f.top + hh + 22,
    f.bot - fh - (f.top + hh + 22) - 18,
    18
  );
  fillRect(ctx, 0, f.bot - fh, W, H - f.bot + fh, t.panel);
  footer(ctx, 44, f.bot - fh + 14, W - 88, fh - 28, onPanel, t.accent, t.onAccent);
};

// ---------- 6. Cercles : grande photo ronde et petites photos rondes sur fond coloré ----------
const circles = (): Layout => (ctx, d, p, t, f) => {
  const { W, H } = f;
  fillRect(ctx, 0, 0, W, H, t.bg);
  // Décor : grands cercles transparents
  ctx.save();
  ctx.fillStyle = alpha('#ffffff', 0.06);
  ctx.beginPath();
  ctx.arc(W * 0.95, H * 0.12, W * 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(W * 0.02, H * 0.9, W * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  const c: Ink = { ink: t.ink, soft: t.soft, accent: t.accent, onAccent: t.onAccent, price: t.price, iconBg: alpha('#ffffff', 0.15), iconColor: t.accent };
  const ring = (cx: number, cy: number, r: number, i: number, w: number) => circlePhoto(ctx, pick(p, i), cx, cy, r, w, '#ffffff');
  const card = (x: number, y: number, w: number, h: number) => {
    if (!agencyPhones().length && !socials().length) return;
    fillRect(ctx, x, y, w, h, t.panel, h * 0.24);
    footer(ctx, x + 24, y + 10, w - 48, h - 20, t.onPanel ?? '#1a1a1a', t.accent, t.onAccent);
  };
  if (f.shape === 'wide') {
    const r = 320;
    ring(420, H / 2, r, 0, 14);
    const n = extras(p, 2);
    if (n > 0) ring(800, 210, 112, 1, 9);
    if (n > 1) ring(800, H - 210, 112, 2, 9);
    brandBlock(ctx, 40, 30, 500, 80, t.ink, t.plate);
    const x = 930;
    const k = kit(ctx, d, x, W - 48 - x, 'right', c);
    stack([k.deal(58), k.headline(150, 92), k.sub(34), k.place(44), k.price(88), k.specs(108), { h: 96, draw: (y, h) => card(x, y, W - 48 - x, h) }], 40, H - 80, 14);
    return;
  }
  brandBlock(ctx, 44, f.top + 36, W * 0.6, 96, t.ink, t.plate);
  pill(ctx, dealOf(d), W - 44, f.top + 48, 72, t.accent, t.onAccent, 'right');
  const k = kit(ctx, d, 60, W - 120, 'center', c);
  stack(
    [
      k.headline(140, 100),
      k.sub(40),
      {
        h: f.shape === 'story' ? 700 : 520,
        flex: true,
        draw: (y, h) => {
          const n = extras(p, 2);
          const r = Math.min(h / 2 - 10, n ? W * 0.3 : W * 0.38);
          const cx = n ? W * 0.4 : W / 2;
          const cy = y + h / 2;
          ring(cx, cy, r, 0, 14);
          const sr = r * 0.42;
          if (n > 0) ring(W * 0.8, cy - r * 0.55, sr, 1, 9);
          if (n > 1) ring(W * 0.8, cy + r * 0.55, sr, 2, 9);
        },
      },
      k.place(46),
      k.price(96),
      k.specs(116),
      { h: 120, draw: (y, h) => card(44, y, W - 88, h) },
    ],
    f.top + 150,
    f.bot - f.top - 180,
    14
  );
};

// ---------- 7. Arche : photo dans une arche, fond clair, style épuré ----------
const arch = (): Layout => (ctx, d, p, t, f) => {
  const { W, H } = f;
  fillRect(ctx, 0, 0, W, H, t.bg);
  const c: Ink = { ink: t.ink, soft: t.soft, accent: t.accent, onAccent: t.onAccent, price: t.price, iconBg: t.panel, iconColor: t.ink };
  const drawArch = (x: number, y: number, w: number, h: number) => {
    // Arche décalée en couleur derrière la photo
    ctx.save();
    ctx.beginPath();
    const r = w / 2;
    ctx.moveTo(x + 26, y + h + 26);
    ctx.lineTo(x + 26, y + r + 26);
    ctx.arc(x + r + 26, y + r + 26, r, Math.PI, 0);
    ctx.lineTo(x + w + 26, y + h + 26);
    ctx.closePath();
    ctx.fillStyle = t.panel;
    ctx.fill();
    ctx.restore();
    archPhoto(ctx, pick(p, 0), x, y, w, h);
    const n = extras(p, 2);
    for (let i = 0; i < n; i++) circlePhoto(ctx, pick(p, i + 1), x + (i ? w + 6 : -6), y + h * (i ? 0.52 : 0.78), w * 0.17, 8, t.bg);
  };
  if (f.shape === 'wide') {
    drawArch(130, 50, 520, H - 120);
    const x = 800;
    const k = kit(ctx, d, x, W - 50 - x, 'right', c);
    const brand: Item | null = agency().logo || agency().name.trim() ? { h: 90, draw: (y, hh) => brandBlock(ctx, x, y, W - 50 - x, hh, t.ink, undefined, 'right') } : null;
    stack([brand, k.deal(54), k.headline(140, 92), k.sub(34), k.place(42), k.price(84), k.specs(104), k.contact(84)], 40, H - 80, 14);
    return;
  }
  let y = f.top + 32;
  y += brandCenter(ctx, W / 2, y, f.shape === 'story' ? 120 : 92, t.ink) + 20;
  const k = kit(ctx, d, 60, W - 120, 'center', c);
  stack(
    [
      { h: f.shape === 'story' ? 820 : 560, flex: true, draw: (yy, hh) => drawArch(W * 0.2, yy, W * 0.6, hh - 26) },
      k.deal(56),
      k.headline(130, 90),
      k.place(44),
      k.price(90),
      k.specs(112),
      k.contact(90),
    ],
    y,
    f.bot - y - 30,
    14
  );
};

// ---------- 8. Photos tirées : photos encadrées et inclinées sur fond sombre ----------
const polaroid = (): Layout => (ctx, d, p, t, f) => {
  const { W, H } = f;
  fillRect(ctx, 0, 0, W, H, vGrad(ctx, 0, H, [[0, t.bg], [1, t.panel]]));
  // Décor : fines diagonales
  ctx.save();
  ctx.strokeStyle = alpha('#ffffff', 0.04);
  ctx.lineWidth = 2;
  for (let i = -H; i < W; i += 46) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + H, H);
    ctx.stroke();
  }
  ctx.restore();
  const c: Ink = { ink: t.ink, soft: t.soft, accent: t.accent, onAccent: t.onAccent, price: t.price, iconBg: alpha('#ffffff', 0.12), iconColor: t.accent };
  const shots = (cx: number, cy: number, w: number) => {
    const n = extras(p, 2);
    const h = w * 0.72;
    if (n > 1) framedPhoto(ctx, pick(p, 2), cx - w * 0.62, cy + h * 0.18, w * 0.5, w * 0.38, 12, '#ffffff', 2, -0.12);
    if (n > 0) framedPhoto(ctx, pick(p, 1), cx + w * 0.12, cy + h * 0.2, w * 0.5, w * 0.38, 12, '#ffffff', 2, 0.1);
    framedPhoto(ctx, pick(p, 0), cx - w / 2, cy - h / 2 - (n ? h * 0.12 : 0), w, h, 18, '#ffffff', 2, -0.035);
  };
  if (f.shape === 'wide') {
    shots(470, H / 2, 640);
    brandBlock(ctx, 40, 30, 520, 80, t.ink, t.plate);
    const x = 960;
    const k = kit(ctx, d, x, W - 50 - x, 'right', c);
    stack([k.deal(56), k.headline(150, 92), k.sub(34), k.place(44), k.price(92), k.specs(108), k.contact(86)], 40, H - 80, 14);
    return;
  }
  brandBlock(ctx, 44, f.top + 36, W * 0.6, 96, t.ink, t.plate);
  pill(ctx, dealOf(d), W - 44, f.top + 48, 72, t.accent, t.onAccent, 'right');
  const k = kit(ctx, d, 60, W - 120, 'center', c);
  stack(
    [
      k.headline(140, 100),
      k.sub(40),
            {
        h: f.shape === 'story' ? 760 : 560,
        flex: true,
        draw: (y, h) => {
          const w = Math.min(W * 0.68, h / 1.02);
          shots(W / 2 + w * 0.04, y + (h - w * 0.98) / 2 + w * 0.46, w);
        },
      },
      k.place(46),
      k.price(104),
      k.specs(116),
      k.contact(96),
    ],
    f.top + 150,
    f.bot - f.top - 180,
    14
  );
};

// ---------- 9. Bannière : grand coup de pinceau « للبيع / للكراء », photo, bandeau de contact ----------
const banner = (): Layout => (ctx, d, p, t, f) => {
  const { W, H } = f;
  const onPanel = t.onPanel ?? '#ffffff';
  fillRect(ctx, 0, 0, W, H, t.bg);
  const c: Ink = {
    ink: t.ink,
    soft: t.soft,
    accent: t.accent,
    onAccent: t.onAccent,
    price: t.price,
    priceFill: t.panel,
    priceInk: onPanel,
    iconBg: t.accent,
    iconColor: t.onAccent,
  };
  const deal = (x: number, y: number, w: number, h: number) => {
    poly(ctx, [[x, y + h * 0.1], [x + w, y], [x + w - 20, y + h], [x + 14, y + h * 0.94]], t.accent);
    boxText(ctx, headlineOf(d), x + w * 0.07, y + h * 0.12, w * 0.86, h * 0.76, { color: t.onAccent, weight: 900, maxSize: h * 0.62 });
  };
  if (f.shape === 'wide') {
    photo(ctx, pick(p, 0), 0, 0, 900, H);
    poly(ctx, [[860, 0], [940, 0], [900, H], [820, H]], t.bg);
    poly(ctx, [[900, 0], [916, 0], [876, H], [860, H]], t.accent);
    const n = extras(p, 3);
    if (n) thumbRow(ctx, p, 1, n, 40, H - 40 - 130, n * 180 + (n - 1) * 12, 130, 12, 12, 6, '#ffffff');
    brandBlock(ctx, 40, 30, 520, 84, '#ffffff', t.plate ?? '#ffffff');
    const x = 960;
    const k = kit(ctx, d, x, W - 48 - x, 'right', c);
    stack(
      [{ h: 150, draw: (y, h) => deal(x, y, W - 48 - x, h) }, k.sub(36), k.place(44), k.price(88), k.specs(108), k.contact(86)],
      40,
      H - 80,
      14
    );
    return;
  }
  brandBlock(ctx, 44, f.top + 30, W * 0.6, 92, t.ink, t.plate);
  const fh = f.shape === 'story' ? 150 : 126;
  const k = kit(ctx, d, 44, W - 88, 'right', c);
  stack(
    [
      { h: 190, draw: (y, h) => deal(W * 0.08, y, W * 0.84, h) },
      k.sub(40),
      {
        h: f.shape === 'story' ? 760 : 520,
        flex: true,
        draw: (y, h) => {
          photo(ctx, pick(p, 0), 40, y, W - 80, h, 26);
          const n = extras(p, 3);
          if (n) thumbRow(ctx, p, 1, n, 70, y + h - 150, n * 170 + (n - 1) * 12, 124, 12, 12, 6, '#ffffff');
          if (priceOf(d)) {
            const pw = Math.min(W - 160 - (n ? n * 182 : 0), textW(ctx, priceOf(d), 56, 900) / 0.84 + 60);
            priceTag(ctx, d, W - 70 - pw, y + h - 140, pw, 104, t.price, t.panel, onPanel);
          }
        },
      },
      k.place(46),
      k.specs(116),
    ],
    f.top + 140,
    f.bot - fh - f.top - 160,
    16
  );
  fillRect(ctx, 0, f.bot - fh, W, H - f.bot + fh, t.panel);
  footer(ctx, 44, f.bot - fh + 14, W - 88, fh - 28, onPanel, t.accent, t.onAccent);
};

// ---------- 10. Carte : photo floutée en fond, carte blanche avec photo et informations ----------
const card = (): Layout => (ctx, d, p, t, f) => {
  const { W, H } = f;
  ctx.save();
  ctx.filter = 'blur(26px)';
  photo(ctx, pick(p, 0), -60, -60, W + 120, H + 120);
  ctx.restore();
  fillRect(ctx, 0, 0, W, H, alpha(t.bg, 0.55));
  const c: Ink = { ink: t.ink, soft: t.soft, accent: t.accent, onAccent: t.onAccent, price: t.price, iconBg: alpha(t.accent, 0.15), iconColor: t.accent };
  const shadowCard = (x: number, y: number, w: number, h: number) => {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 14;
    rr(ctx, x, y, w, h, 34);
    ctx.fillStyle = t.panel;
    ctx.fill();
    ctx.restore();
  };
  const photoBox = (x: number, y: number, w: number, h: number) => {
    photo(ctx, pick(p, 0), x, y, w, h, 24);
    pill(ctx, dealOf(d), x + w - 20, y + 20, 64, t.accent, t.onAccent, 'right');
    const n = extras(p, 3);
    if (n) thumbRow(ctx, p, 1, n, x + 20, y + h - 20 - 110, n * 150 + (n - 1) * 10, 110, 10, 12, 5, '#ffffff');
  };
  if (f.shape === 'wide') {
    brandBlock(ctx, 60, 24, 600, 76, '#ffffff', t.plate);
    shadowCard(60, 116, W - 120, H - 156);
    photoBox(84, 140, 760, H - 204);
    const x = 880;
    const k = kit(ctx, d, x, W - 90 - x, 'right', c);
    stack([k.headline(150, 92), k.sub(34), k.place(44), k.price(88), k.specs(108), k.contact(86)], 140, H - 204, 14);
    return;
  }
  brandBlock(ctx, 56, f.top + 30, W * 0.62, 96, '#ffffff', t.plate);
  const cy = f.top + 150;
  const ch = f.bot - 30 - cy;
  shadowCard(48, cy, W - 96, ch);
  const k = kit(ctx, d, 84, W - 168, 'right', c);
  stack(
    [
      { h: f.shape === 'story' ? 820 : 560, flex: true, draw: (y, h) => photoBox(72, y, W - 144, h) },
      k.headline(120, 84),
      {
        h: 86,
        draw: (y, h) => {
          const pw = priceOf(d) ? Math.min(460, textW(ctx, priceOf(d), h * 0.62, 900) / 0.84 + h * 0.6) : 0;
          if (placeOf(d)) placeLine(ctx, d, 84 + pw + 20, y + h * 0.22, W - 168 - pw - 20, h * 0.56, t.soft, 'right', t.accent);
          if (pw) priceTag(ctx, d, 84, y, pw, h, t.price, t.accent, t.onAccent);
        },
      },
      k.specs(112),
      { h: 2, draw: (y) => line(ctx, 84, y, W - 84, y, alpha(t.ink, 0.12), 2) },
      k.contact(90),
    ],
    cy + 24,
    ch - 48,
    16
  );
};

// ---------- Les 25 modèles ----------
const T = (t: Theme) => t;
export const PRO_DESIGNS: ProDesign[] = [
  { id: 'pro-01', name: 'ليلي ذهبي', layout: hero({ thumbs: true }), theme: T({ bg: '#0d1b2a', panel: '#0d1b2a', ink: '#ffffff', soft: '#d9c08a', accent: '#d4a64a', onAccent: '#0d1b2a', price: 'pill' }) },
  { id: 'pro-02', name: 'أحمر جريء', layout: hero(), theme: T({ bg: '#111111', panel: '#111111', ink: '#ffffff', soft: '#f2b8ba', accent: '#e3131b', onAccent: '#ffffff', price: 'brush' }) },
  { id: 'pro-03', name: 'زمردي', layout: hero({ thumbs: true }), theme: T({ bg: '#06372e', panel: '#06372e', ink: '#ffffff', soft: '#bfe3d6', accent: '#f2c14e', onAccent: '#06372e', price: 'ribbon' }) },
  { id: 'pro-04', name: 'أزرق وبرتقالي', layout: split({ edge: 'straight' }), theme: T({ bg: '#0f2c59', panel: '#0f2c59', ink: '#ffffff', soft: '#b9c7e0', accent: '#f58220', onAccent: '#ffffff', price: 'block' }) },
  { id: 'pro-05', name: 'عنابي', layout: split({ edge: 'curve' }), theme: T({ bg: '#5b1a2b', panel: '#5b1a2b', ink: '#ffffff', soft: '#e8c9cf', accent: '#e9c46a', onAccent: '#3d0f1c', price: 'pill' }) },
  { id: 'pro-06', name: 'فحمي وأصفر', layout: split({ edge: 'slant' }), theme: T({ bg: '#1f2326', panel: '#1f2326', ink: '#ffffff', soft: '#c7c9cb', accent: '#ffc400', onAccent: '#1f2326', price: 'ribbon' }) },
  { id: 'pro-07', name: 'كحلي', layout: sidebar({ bar: true }), theme: T({ bg: '#14213d', panel: '#14213d', ink: '#ffffff', soft: '#aab4c8', accent: '#fca311', onAccent: '#14213d', price: 'block' }) },
  { id: 'pro-08', name: 'طيني', layout: sidebar(), theme: T({ bg: '#b5562f', panel: '#b5562f', ink: '#ffffff', soft: '#ffe3d1', accent: '#fff3e0', onAccent: '#9a4524', price: 'pill' }) },
  { id: 'pro-09', name: 'غابة', layout: sidebar({ bar: true }), theme: T({ bg: '#1e3d2f', panel: '#1e3d2f', ink: '#ffffff', soft: '#c3d6c9', accent: '#c9a227', onAccent: '#1e3d2f', price: 'brush' }) },
  { id: 'pro-10', name: 'كريمي أنيق', layout: magazine(), theme: T({ bg: '#f5efe6', panel: '#e8dccb', ink: '#3b2f2f', soft: '#8a7563', accent: '#a47148', onAccent: '#ffffff', price: 'text' }) },
  { id: 'pro-11', name: 'أبيض وأسود', layout: magazine(), theme: T({ bg: '#ffffff', panel: '#eeeeee', ink: '#111111', soft: '#777777', accent: '#111111', onAccent: '#ffffff', price: 'block' }) },
  { id: 'pro-12', name: 'أزرق سماوي', layout: collage(), theme: T({ bg: '#ffffff', panel: '#0b5ed7', ink: '#0f172a', soft: '#64748b', accent: '#0b5ed7', onAccent: '#ffffff', price: 'pill', plate: '#ffffff' }) },
  { id: 'pro-13', name: 'فيروزي داكن', layout: collage(), theme: T({ bg: '#101820', panel: '#0b2a33', ink: '#ffffff', soft: '#9fb3c8', accent: '#14b8a6', onAccent: '#ffffff', price: 'block', plate: '#ffffff' }) },
  { id: 'pro-14', name: 'رملي وأحمر', layout: collage(), theme: T({ bg: '#f4ede1', panel: '#c1272d', ink: '#2b2118', soft: '#7d6b57', accent: '#c1272d', onAccent: '#ffffff', price: 'brush', plate: '#ffffff' }) },
  { id: 'pro-15', name: 'دوائر فيروزية', layout: circles(), theme: T({ bg: '#0f766e', panel: '#ffffff', ink: '#ffffff', soft: '#ccfbf1', accent: '#fbbf24', onAccent: '#134e4a', onPanel: '#134e4a', price: 'pill', plate: '#ffffff' }) },
  { id: 'pro-16', name: 'دوائر بنفسجية', layout: circles(), theme: T({ bg: '#4c1d95', panel: '#ffffff', ink: '#ffffff', soft: '#ddd6fe', accent: '#f472b6', onAccent: '#ffffff', onPanel: '#3b0764', price: 'block', plate: '#ffffff' }) },
  { id: 'pro-17', name: 'قوس زيتوني', layout: arch(), theme: T({ bg: '#efe8dc', panel: '#d9cbb3', ink: '#3d3a2a', soft: '#857f69', accent: '#6b705c', onAccent: '#ffffff', price: 'pill' }) },
  { id: 'pro-18', name: 'قوس وردي', layout: arch(), theme: T({ bg: '#f7ede8', panel: '#e8d3cc', ink: '#4a3b3b', soft: '#9b8585', accent: '#c08497', onAccent: '#ffffff', price: 'block' }) },
  { id: 'pro-19', name: 'صور خشبية', layout: polaroid(), theme: T({ bg: '#4e342e', panel: '#1b0f0c', ink: '#ffffff', soft: '#d7ccc8', accent: '#ffb300', onAccent: '#3e2723', price: 'brush', plate: '#ffffff' }) },
  { id: 'pro-20', name: 'صور زرقاء', layout: polaroid(), theme: T({ bg: '#334e68', panel: '#102a43', ink: '#ffffff', soft: '#bcccdc', accent: '#f0b429', onAccent: '#102a43', price: 'ribbon', plate: '#ffffff' }) },
  { id: 'pro-21', name: 'أصفر وأسود', layout: banner(), theme: T({ bg: '#ffffff', panel: '#111111', ink: '#111111', soft: '#555555', accent: '#ffd400', onAccent: '#111111', price: 'brush' }) },
  { id: 'pro-22', name: 'أحمر وأبيض', layout: banner(), theme: T({ bg: '#ffffff', panel: '#b71c1c', ink: '#1a1a1a', soft: '#666666', accent: '#e53935', onAccent: '#ffffff', price: 'block' }) },
  { id: 'pro-23', name: 'برتقالي وكحلي', layout: banner(), theme: T({ bg: '#fdf6ec', panel: '#1d3557', ink: '#1d3557', soft: '#5c6b80', accent: '#f77f00', onAccent: '#ffffff', price: 'pill' }) },
  { id: 'pro-24', name: 'بطاقة ذهبية', layout: card(), theme: T({ bg: '#000000', panel: '#ffffff', ink: '#1a1a1a', soft: '#6b6b6b', accent: '#c8a24a', onAccent: '#ffffff', price: 'pill', plate: '#ffffff' }) },
  { id: 'pro-25', name: 'بطاقة داكنة', layout: card(), theme: T({ bg: '#0b0d12', panel: '#15171c', ink: '#ffffff', soft: '#a0a4ad', accent: '#3b82f6', onAccent: '#ffffff', price: 'block', plate: '#ffffff' }) },
];

// Dessine un modèle à la taille demandée : format choisi d'après les proportions, dessin à une taille de référence.
export function drawPro(ctx: CanvasRenderingContext2D, design: ProDesign, d: PosterData, p: Img[], w: number, h: number) {
  const a = w / h;
  const shape: Shape = a > 1.2 ? 'wide' : a < 0.7 ? 'story' : 'portrait';
  const W = shape === 'wide' ? 1600 : 1080;
  const H = W / a;
  const f: Frame = { W, H, shape, top: shape === 'story' ? H * 0.05 : 0, bot: shape === 'story' ? H * 0.9 : H };
  ctx.save();
  ctx.scale(w / W, h / H);
  ctx.fillStyle = design.theme.bg;
  ctx.fillRect(0, 0, W, H);
  design.layout(ctx, d, p, design.theme, f);
  ctx.restore();
}

