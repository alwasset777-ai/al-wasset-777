// 25 modèles d'affiches immobilières professionnels (styles « agence », « luxe » et « fiche », d'après les exemples
// du gérant). Chaque modèle se redessine à la taille de la plateforme :
// portrait 4:5 (Facebook, Instagram…), story 9:16 (TikTok, YouTube : zones sûres en haut et en bas) et paysage 16:9 (X).
// Les zones vides (pas de prix, pas de logo, un seul numéro…) disparaissent sans laisser de trou.
import { agency, agencyPhones, handle } from './agencySettings';
import type { IconNode } from 'lucide';
import { BadgeCheck, Bath, BedDouble, Coins, Globe, House, MapPin, Maximize, Phone, ShieldCheck } from 'lucide';
import { siWhatsapp } from 'simple-icons';
import { Img, PosterData, TYPE_LABELS, brandDot, coverInPath, drawIcon, featureInfo, headlineOf } from './posterMaker';
import {
  mainSpecs,
  boxText,
  brandBlock,
  brush,
  hasQr,
  qrBox,
  dealOf,
  fillRect,
  hGrad,
  line,
  logo,
  photo,
  pick,
  pill,
  placeOf,
  poly,
  priceOf,
  rr,
  socialRow,
  socials,
  textW,
  thumbRow,
  vGrad,
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

// ---------- Fiche « pro » : titre empilé (transaction en or), photo découpée en courbe, atouts en tuiles,
// cartes des caractéristiques, bandeau du prix, bandeau de contact et feuillage décoratif ----------
// Mélange d'une couleur #rrggbb avec une autre (k = part de la seconde).
function mix(a: string, b: string, k: number) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const c = (sh: number) => Math.round(((pa >> sh) & 255) * (1 - k) + ((pb >> sh) & 255) * k);
  return `rgb(${c(16)},${c(8)},${c(0)})`;
}
const goldOf = (ctx: CanvasRenderingContext2D, accent: string, y0: number, y1: number) =>
  vGrad(ctx, y0, y1, [
    [0, mix(accent, '#ffffff', 0.45)],
    [0.45, accent],
    [1, mix(accent, '#000000', 0.3)],
  ]);

function tile(ctx: CanvasRenderingContext2D, icon: IconNode, x: number, y: number, s: number, bg: string, fg: string) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.18)';
  ctx.shadowBlur = s * 0.12;
  ctx.shadowOffsetY = s * 0.05;
  rr(ctx, x, y, s, s, s * 0.24);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.restore();
  drawIcon(ctx, icon, x + s / 2, y + s / 2, s * 0.56, fg, 2);
}

// Petite branche de feuilles (décor des coins).
function branch(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, angle: number, color: string, flip = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = len * 0.018;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.5, -len * 0.12 * flip, len, 0);
  ctx.stroke();
  for (let i = 1; i <= 6; i++) {
    const t = i / 7;
    const lx = len * t;
    const ly = -len * 0.12 * flip * 4 * t * (1 - t) * 0.5;
    const side = i % 2 ? 1 : -1;
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(side * 0.75 - 0.2);
    ctx.beginPath();
    ctx.ellipse(len * 0.07, 0, len * 0.075 * (1 - t * 0.35), len * 0.028, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

interface Card {
  icon: IconNode;
  label: string;
  value: string;
}
function cardsOf(d: PosterData, skip: number): Card[] {
  const out: Card[] = [];
  if (d.surface)
    out.push({
      icon: Maximize,
      label: 'المساحة',
      value: d.surfaceMax > d.surface ? `${d.surface}-${d.surfaceMax} م²` : `${d.surface} م²`,
    });
  if (d.bedrooms) out.push({ icon: BedDouble, label: 'الغرف', value: String(d.bedrooms) });
  if (d.bathrooms) out.push({ icon: Bath, label: 'الحمامات', value: String(d.bathrooms) });
  out.push({
    icon: House,
    label: 'النوع',
    value: TYPE_LABELS[d.type || 'Appartement'].ar,
  });
  d.features.slice(skip).forEach((f) => out.push({ icon: featureInfo(f).icon, label: 'متوفر', value: f }));
  return out.slice(0, 5);
}

const fiche = (): Layout => (ctx, d, p, t, f) => {
  const { W, H } = f;
  const wide = f.shape === 'wide';
  const navy = t.panel;
  const cream = mix(t.accent, '#ffffff', 0.86);
  fillRect(ctx, 0, 0, W, H, t.bg);

  // Photo à droite, bord gauche en courbe, double filet (couleur + or)
  const x0 = wide ? 900 : W * 0.44;
  // Hauteur de la photo : agrandie quand il y a peu d'informations dessous (pas de vide)
  const fh = wide ? 112 : f.shape === 'story' ? 140 : 116;
  const fy = f.bot - fh;
  // Tuiles : jusqu'à 2 ou 3 lignes (phrases libres d'abord, puis atouts) ; une phrase de plus va dans la pastille.
  const slots = wide ? 2 : f.shape === 'story' ? 3 : 2;
  const extra = d.extras.map((x) => x.trim()).filter(Boolean);
  const rows = [
    ...extra.map((x) => ({ text: x, icon: BadgeCheck, sub: '' })),
    ...d.features.map((x) => ({ text: x, icon: featureInfo(x).icon, sub: featureInfo(x).sub })),
  ].slice(0, slots);
  const shownFeatures = Math.max(0, rows.length - extra.length);
  const overflow = extra[slots];
  const note = overflow || agency().address.trim() || agency().slogan.trim();
  const list = cardsOf(d, shownFeatures);
  const below = (list.length >= 2 ? 228 : 0) + (priceOf(d) ? 146 : 0) + (note ? 94 : 0) + 40;
  const T = wide ? H : Math.max(f.shape === 'story' ? f.top + 960 : 740, fy - below);
  const edge = (dx: number) => {
    ctx.beginPath();
    ctx.moveTo(x0 + 70 + dx, 0);
    ctx.bezierCurveTo(x0 - 40 + dx, T * 0.3, x0 - 10 + dx, T * 0.75, x0 + 120 + dx, T);
    if (!wide) ctx.quadraticCurveTo(x0 + 420, T + 30, W, T - 60);
    else ctx.lineTo(W, T);
    ctx.lineTo(W, 0);
    ctx.closePath();
  };
  ctx.save();
  edge(-26);
  ctx.fillStyle = goldOf(ctx, t.accent, 0, T);
  ctx.fill();
  edge(-12);
  ctx.fillStyle = navy;
  ctx.fill();
  ctx.restore();
  coverInPath(ctx, pick(p, 0), () => edge(0), x0, 0, W - x0, T);

  // Onglet du logo en haut à gauche
  const a = agency();
  const tabH = f.top + (wide ? 96 : 112);
  if (a.logo || a.name.trim()) {
    const tw = wide ? 420 : 400;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(40, 0);
    ctx.lineTo(40 + tw, 0);
    ctx.lineTo(40 + tw, tabH - 26);
    ctx.quadraticCurveTo(40 + tw, tabH, 40 + tw - 26, tabH);
    ctx.lineTo(66, tabH);
    ctx.quadraticCurveTo(40, tabH, 40, tabH - 26);
    ctx.closePath();
    ctx.fillStyle = navy;
    ctx.fill();
    ctx.restore();
    fillRect(ctx, 40, tabH - 8, tw, 8, goldOf(ctx, t.accent, tabH - 8, tabH));
    brandBlock(ctx, 62, f.top + 14, tw - 44, tabH - f.top - 30, '#ffffff', t.plate ?? '#ffffff');
  }

  // Titre empilé : type (couleur), transaction (or, très grand), lieu (pastille)
  const custom = d.headline.trim();
  const words = custom ? custom.split(/\s+/) : [];
  const line1 = custom ? words.slice(0, Math.ceil(words.length / 2)).join(' ') : TYPE_LABELS[d.type || 'Appartement'].ar;
  const line2 = custom ? words.slice(Math.ceil(words.length / 2)).join(' ') : dealOf(d).replace('مفروشة ', '').replace('مفروش ', '');
  const furnished = !custom && d.deal === 'meuble';
  const place = d.district || d.city;
  const titleItems = (x: number, w: number, big: number): (Item | null)[] => [
    {
      h: big * 0.78,
      draw: (y, h) =>
        boxText(ctx, furnished ? `${line1} مفروشة` : line1, x, y, w, h, {
          color: navy,
          weight: 900,
          maxSize: h * 0.95,
        }),
    },
    line2
      ? {
          h: big,
          draw: (y, h) =>
            boxText(ctx, line2, x, y, w, h, {
              color: goldOf(ctx, t.accent, y, y + h),
              weight: 900,
              maxSize: h * 1.05,
            }),
        }
      : null,
    place
      ? {
          h: big * 0.5,
          draw: (y, h) => {
            const txt = `في ${place}`;
            const pw = Math.min(w, textW(ctx, txt, h * 0.6, 900) + h * 1.1);
            fillRect(ctx, x + (w - pw) / 2, y, pw, h, navy, h / 2);
            boxText(ctx, txt, x + (w - pw) / 2 + h * 0.4, y + h * 0.14, pw - h * 0.8, h * 0.72, { color: '#ffffff', weight: 900, maxSize: h * 0.6 });
          },
        }
      : null,
  ];
  const feats: Item[] = rows.map((row) => ({
    h: wide ? 104 : 92,
    draw: (y: number, h: number) => {
      const fx = wide ? 470 : 40;
      const fw = wide ? 400 : x0 - 80;
      tile(ctx, row.icon, fx, y + h * 0.06, h * 0.88, navy, '#ffffff');
      const sub = row.sub;
      boxText(ctx, row.text, fx + h + 12, y + (sub ? h * 0.04 : h * 0.06), fw - h - 12, sub ? h * 0.5 : h * 0.88, {
        color: navy,
        weight: 900,
        align: 'right',
        maxSize: h * 0.42,
      });
      if (sub)
        boxText(ctx, sub, fx + h + 12, y + h * 0.56, fw - h - 12, h * 0.38, {
          color: t.soft,
          weight: 700,
          align: 'right',
          maxSize: h * 0.3,
        });
    },
  }));

  // Cartes des caractéristiques
  const cards = (x: number, w: number): Item | null =>
    list.length < 2
      ? null // seulement le type : déjà dans le titre
      : {
          h: wide ? 176 : 214,
          draw: (y, h) => {
            const g = 14;
            const cw = Math.min(260, (w - g * (list.length - 1)) / list.length);
            const right = x + (w + list.length * cw + (list.length - 1) * g) / 2;
            list.forEach((c, i) => {
              const cx = right - (i + 1) * cw - i * g; // de droite à gauche
              ctx.save();
              rr(ctx, cx, y, cw, h, 22);
              ctx.fillStyle = cream;
              ctx.fill();
              ctx.lineWidth = 2;
              ctx.strokeStyle = alpha(t.accent.length === 7 ? t.accent : '#c8a24a', 0.55);
              ctx.stroke();
              ctx.restore();
              const ts = Math.min(h * 0.38, cw * 0.42);
              tile(ctx, c.icon, cx + (cw - ts) / 2, y + h * 0.08, ts, navy, '#ffffff');
              boxText(ctx, c.label, cx + 8, y + h * 0.5, cw - 16, h * 0.18, {
                color: navy,
                weight: 800,
                maxSize: h * 0.15,
              });
              boxText(ctx, c.value, cx + 8, y + h * 0.68, cw - 16, h * 0.27, {
                color: goldOf(ctx, t.accent, y + h * 0.68, y + h * 0.95),
                weight: 900,
                maxSize: h * 0.24,
              });
            });
          },
        };

  // Bandeau du prix
  const priceBar = (x: number, w: number): Item | null =>
    priceOf(d)
      ? {
          h: wide ? 104 : 132,
          draw: (y, h) => {
            fillRect(ctx, x + w * 0.06, y, w * 0.88, h, navy, h * 0.3);
            fillRect(ctx, x + w * 0.06, y + h - 7, w * 0.88, 7, goldOf(ctx, t.accent, y + h - 7, y + h), 3);
            drawIcon(ctx, Coins, x + w * 0.06 + h * 0.62, y + h / 2, h * 0.62, t.accent, 2.2);
            const tx = x + w * 0.06 + h * 1.2;
            const tw = w * 0.88 - h * 1.2 - h * 0.3;
            boxText(ctx, d.deal === 'vente' ? 'الثمن' : 'ثمن الكراء', tx, y + h * 0.1, tw, h * 0.3, { color: '#ffffff', weight: 700, maxSize: h * 0.24 });
            boxText(ctx, priceOf(d), tx, y + h * 0.36, tw, h * 0.54, {
              color: goldOf(ctx, t.accent, y + h * 0.36, y + h * 0.9),
              weight: 900,
              maxSize: h * 0.48,
            });
          },
        }
      : null;

  // Pastille secondaire : adresse de l'agence (ou slogan)
  const notePill = (x: number, w: number): Item | null =>
    note
      ? {
          h: wide ? 64 : 80,
          draw: (y, h) => {
            const pw = Math.min(w * 0.88, textW(ctx, note, h * 0.42, 800) + h * 1.6);
            const px = x + (w - pw) / 2;
            ctx.save();
            rr(ctx, px, y, pw, h, h / 2);
            ctx.fillStyle = cream;
            ctx.fill();
            ctx.lineWidth = 2.5;
            ctx.strokeStyle = t.accent;
            ctx.stroke();
            ctx.restore();
            drawIcon(ctx, !overflow && a.address.trim() ? MapPin : ShieldCheck, px + pw - h * 0.6, y + h / 2, h * 0.55, t.accent, 2.2);
            boxText(ctx, note, px + h * 0.4, y + h * 0.16, pw - h * 1.5, h * 0.68, { color: navy, weight: 800, maxSize: h * 0.42 });
          },
        }
      : null;

  // Bandeau de contact (jusqu'en bas de l'image ; contenu dans la zone sûre)
  const footerBar = () => {
    fillRect(ctx, 0, fy, W, H - fy, navy);
    fillRect(ctx, 0, fy, W, 7, goldOf(ctx, t.accent, fy, fy + 7));
    const phones = agencyPhones();
    if (phones.length) {
      const r = fh * 0.3;
      const block = Math.min(W * 0.8, textW(ctx, phones.join('  |  '), fh * 0.36, 900, 'lat') + r * 2 + 30);
      const bx = W / 2 - block / 2;
      ctx.save();
      ctx.beginPath();
      ctx.arc(bx + r, fy + fh / 2 + 3, r, 0, Math.PI * 2);
      ctx.fillStyle = goldOf(ctx, t.accent, fy, fy + fh);
      ctx.fill();
      ctx.restore();
      drawIcon(ctx, Phone, bx + r, fy + fh / 2 + 3, r * 1.05, navy, 2.4);
      boxText(ctx, 'للتواصل والاستفسار', bx + r * 2 + 20, fy + fh * 0.1, block - r * 2 - 20, fh * 0.3, { color: '#ffffff', weight: 700, maxSize: fh * 0.22 });
      boxText(ctx, phones.join('  |  '), bx + r * 2 + 20, fy + fh * 0.4, block - r * 2 - 20, fh * 0.5, {
        color: goldOf(ctx, t.accent, fy + fh * 0.4, fy + fh * 0.9),
        weight: 900,
        font: 'lat',
        maxSize: fh * 0.4,
      });
    } else if (socials().length) socialRow(ctx, 40, fy + fh * 0.25, W - 80, fh * 0.5, '#ffffff', t.accent);
    const leaf = alpha('#5b7a52', 0.8);
    branch(ctx, 6, fy + 20, wide ? 150 : 180, -1.05, leaf, 1);
    branch(ctx, W - 6, fy + 20, wide ? 150 : 180, Math.PI + 1.05, leaf, -1);
  };

  if (wide) {
    stack(titleItems(40, 400, 150), 112, 300, 10);
    stack(feats, 120, 300, 12);
    stack([cards(40, 820), priceBar(40, 820), notePill(40, 820)], 430, fy - 444, 14);
    footerBar();
    return;
  }
  stack([...titleItems(40, x0 - 80, f.shape === 'story' ? 230 : 205), ...(feats.length ? [k0(16)] : []), ...feats], tabH + 20, T - tabH - 30, 12, 'top');
  const midTop = T + (f.shape === 'story' ? 24 : 10);
  stack(
    [
      cards(36, W - 72),
      priceBar(36, W - 72),
      notePill(36, W - 72),
      f.shape === 'story' && agencyPhones().length && socials().length
        ? {
            h: 52,
            draw: (y, h) => socialRow(ctx, 60, y, W - 120, h, navy, t.accent),
          }
        : null,
    ],
    midTop,
    fy - midTop - 14,
    14
  );
  footerBar();
};
const k0 = (h: number): Item => ({ h, draw: () => undefined });

// ---------- Polices des modèles « agence » et « luxe » ----------
const CONDENSED = 'Anton, Impact, "Arial Narrow", sans-serif';
const MARKER = '"Permanent Marker", Anton, sans-serif';
const NASKH = 'Amiri, Tajawal, serif';

// Générateur pseudo-aléatoire déterministe (bords déchirés identiques à chaque rendu).
function prng(seed: number) {
  let a = seed;
  return () => {
    a = (a * 16807) % 2147483647;
    return a / 2147483647;
  };
}

// Bande « papier déchiré » : bords haut et bas irréguliers.
function tornBand(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, seed = 7) {
  const r = prng(seed);
  const n = 46;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y + r() * h * 0.08);
  for (let i = 1; i <= n; i++) ctx.lineTo(x + (w * i) / n, y + (r() - 0.3) * h * 0.1);
  for (let i = n; i >= 0; i--) ctx.lineTo(x + (w * i) / n, y + h + (r() - 0.7) * h * 0.1);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;
  ctx.fill();
  ctx.restore();
}

type Part = { t: string; c?: string };
// Ligne arabe en plusieurs couleurs (chiffres en rouge…), posée de droite à gauche depuis « right ».
function richLine(ctx: CanvasRenderingContext2D, parts: Part[], right: number, cy: number, size: number, color: string, maxW: number, weight = 800) {
  const list = parts.filter((p) => p.t);
  if (!list.length) return;
  let s = size;
  const width = () => {
    ctx.font = `${weight} ${s}px ${AR_FONT}`;
    return list.reduce((sum, p) => sum + ctx.measureText(p.t).width, 0);
  };
  while (width() > maxW && s > 10) s -= 1;
  ctx.save();
  ctx.font = `${weight} ${s}px ${AR_FONT}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  let x = right;
  for (const p of list) {
    const w = ctx.measureText(p.t).width;
    x -= w;
    ctx.direction = /[؀-ۿ]/.test(p.t) ? 'rtl' : 'ltr';
    ctx.fillStyle = p.c ?? color;
    ctx.fillText(p.t, x, cy);
  }
  ctx.restore();
}
const AR_FONT = 'Tajawal, sans-serif';

// Étiquette de prix suspendue (trou + ficelle), légèrement tournée.
function hangTag(ctx: CanvasRenderingContext2D, d: PosterData, cx: number, cy: number, w: number, h: number, color: string, angle: number) {
  if (!priceOf(d)) return;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 8;
  ctx.beginPath();
  ctx.moveTo(-w / 2, 0);
  ctx.lineTo(-w / 2 + h * 0.4, -h / 2);
  ctx.lineTo(w / 2, -h / 2);
  ctx.lineTo(w / 2, h / 2);
  ctx.lineTo(-w / 2 + h * 0.4, h / 2);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.beginPath();
  ctx.arc(-w / 2 + h * 0.32, 0, h * 0.07, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-w / 2 + h * 0.32, 0);
  ctx.bezierCurveTo(-w / 2 - h * 0.2, -h * 0.1, -w / 2 - h * 0.3, h * 0.5, -w / 2 - h * 0.1, h * 0.6);
  ctx.stroke();
  boxText(ctx, priceOf(d), -w / 2 + h * 0.5, -h * 0.42, w - h * 0.65, h * 0.5, { color: '#ffffff', weight: 900, font: 'lat', maxSize: h * 0.42 });
  boxText(ctx, 'فرصة مميزة', -w / 2 + h * 0.5, h * 0.08, w - h * 0.65, h * 0.32, { color: '#ffffff', weight: 800, maxSize: h * 0.26 });
  ctx.restore();
}

// Liste « atouts » : atouts choisis (avec détail) puis phrases libres.
function rowsOf(d: PosterData, n: number) {
  return [
    ...d.features.map((x) => ({ text: x, sub: featureInfo(x).sub, icon: featureInfo(x).icon })),
    ...d.extras.map((x) => x.trim()).filter(Boolean).map((x) => ({ text: x, sub: '', icon: BadgeCheck as IconNode })),
  ].slice(0, n);
}

// Réseaux sociaux en pastilles + identifiant (premier réseau rempli).
function socialDots(ctx: CanvasRenderingContext2D, x: number, cy: number, r: number, color: string, ink: string, maxW: number) {
  const list = socials().filter((s) => s.path).slice(0, 3);
  if (!list.length) return 0;
  list.forEach((s, i) => brandDot(ctx, s.path!, x + r + i * (r * 2 + 10), cy, r, color));
  const tx = x + list.length * (r * 2 + 10) + 8;
  const handleText = list[0].text.replace(/^.*\//, '').replace(/^@/, '');
  boxText(ctx, handleText, tx, cy - r, Math.max(0, maxW - (tx - x)), r * 2, { color: ink, weight: 800, font: 'lat', align: 'left', maxSize: r * 1.2 });
  return maxW;
}

// ---------- « Agence » : bandeau noir du logo, grand titre français sur pinceau rouge, bande d'infos,
// atouts en ronds rouges, mosaïque de photos, étiquette de prix, cadre contact (WhatsApp + QR), slogan ----------
interface AgencyStyle {
  header: 'center' | 'cut';
  title: 'anton' | 'marker' | 'serif';
  band: 'brush' | 'torn';
  tilt: number;
  radius: number;
  border?: string; // cadre du bloc contact
  dark?: boolean; // fond noir, textes blancs
  hero?: boolean; // grande photo sur toute la largeur sous l'en-tête, titre posé dessus
  hi?: string; // couleur des chiffres et du repère dans la bande d'infos (par défaut : l'accent)
}
const agencyLayout = (o: AgencyStyle): Layout => (ctx, d, p, t, f) => {
  const { W, H } = f;
  const red = t.accent;
  const hi = o.hi ?? red;
  const black = t.panel;
  const wide = f.shape === 'wide';
  const story = f.shape === 'story';
  const a = agency();
  const paper = o.dark ? black : '#ffffff';
  const ink = o.dark ? '#ffffff' : '#141414';
  fillRect(ctx, 0, 0, W, H, paper);

  // --- tailles
  const colW = wide ? 860 : W; // colonne principale (paysage : à gauche, photos à droite)
  const hdrH = f.top + (wide ? 100 : story ? 150 : 124);
  const titleH = wide ? 160 : story ? 260 : 206;
  const stripH = wide ? 92 : story ? 130 : 108;
  const hero = !!o.hero && !wide;
  const rows = rowsOf(d, 4);
  const noRows = !rows.length; // sans atouts : la photo prend la place
  const heroH = (story ? 420 : 300) + (noRows ? (story ? 300 : 230) : 0);
  const titleY = hero ? hdrH + heroH - titleH * 0.42 : hdrH - (o.header === 'cut' ? 14 : 0);
  const stripY = titleY + titleH;
  const bodyY = stripY + stripH + (wide ? 12 : 18);
  const footH = wide ? 64 : story ? 104 : 84;
  const footY = f.bot - footH;
  const featH = noRows ? 0 : story ? 300 : 230; // atouts sur deux colonnes (variante « hero »)

  // --- grande photo (variante « cut » : en haut à droite, sous le titre)
  const mainX = wide ? 880 : hero ? 0 : noRows ? (o.header === 'cut' ? 0 : 36) : o.header === 'cut' ? W * 0.44 : W * 0.48;
  const mainY = wide ? 0 : hero ? hdrH : o.header === 'cut' ? 0 : bodyY;
  const bottomH = wide ? 0 : hero ? footY - 14 - (bodyY + featH + 14) : story ? 360 : 286;
  const bottomY = wide ? 0 : footY - 14 - bottomH;
  const mainH = wide ? (extras(p, 1) ? 560 : H) : hero ? heroH : (bottomY - 14 - mainY) * (o.header === 'cut' || !extras(p, 1) ? 1 : 0.58);
  photo(ctx, pick(p, 0), mainX, mainY, (wide || hero ? W : W - 36) - mainX, mainH, (o.header === 'cut' && !wide) || hero ? 0 : o.radius);

  // --- en-tête noir + logo + nom
  ctx.save();
  ctx.beginPath();
  if (o.header === 'cut' || wide) {
    const hw = wide ? colW : W * 0.62;
    ctx.moveTo(0, 0);
    ctx.lineTo(hw, 0);
    ctx.lineTo(hw - 60, hdrH);
    ctx.lineTo(0, hdrH);
  } else ctx.rect(0, 0, W, hdrH);
  ctx.closePath();
  ctx.fillStyle = black;
  ctx.fill();
  ctx.restore();
  const lh = hdrH - f.top - 26;
  const name = a.name.trim();
  const sub = a.slogan.trim() || a.city.trim();
  const textBlock = (tx: number, tw: number) => {
    if (!name) return;
    boxText(ctx, name, tx, f.top + 14, tw, sub ? lh * 0.56 : lh, { color: '#ffffff', weight: 900, align: 'left', maxSize: lh * 0.46 });
    if (sub) boxText(ctx, sub, tx, f.top + 14 + lh * 0.58, tw, lh * 0.4, { color: alpha('#ffffff', 0.85), weight: 700, align: 'left', maxSize: lh * 0.3 });
  };
  const circleLogo = (cx: number) => {
    if (!a.logo) return 0;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, f.top + 13 + lh / 2, lh / 2 + 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();
    logo(ctx, cx, f.top + 13 + lh * 0.1, lh * 0.8, 'center');
    return lh + 8;
  };
  if (o.header === 'center' && !wide) {
    const tw = Math.min(W * 0.62, name ? textW(ctx, name, lh * 0.46, 900) + 20 : 0);
    const total = (a.logo ? lh + 30 : 0) + tw;
    const x0 = (W - total) / 2;
    const lw = circleLogo(x0 + lh / 2);
    textBlock(x0 + (lw ? lw + 22 : 0), tw);
  } else {
    const lw = circleLogo(36 + lh / 2);
    textBlock(36 + (lw ? lw + 22 : 0), (wide ? colW : W * 0.62) - 120 - lw);
  }

  // --- titre français (ou titre arabe libre) sur pinceau / papier déchiré
  const custom = d.headline.trim();
  const typeFr = TYPE_LABELS[d.type || 'Appartement'].fr.toUpperCase();
  const dealFr = DEAL_FR[d.deal];
  const tW = o.header === 'cut' || wide ? (wide ? colW : W * 0.72) : W;
  ctx.save();
  ctx.translate(tW / 2, titleY + titleH / 2);
  ctx.rotate(o.tilt);
  const bx = -tW / 2 - 20;
  const by = -titleH / 2;
  if (o.band === 'torn') tornBand(ctx, bx + 30, by, tW - 20, titleH, red, 11);
  else brush(ctx, bx, by, tW + 40, titleH, red, 23, 0);
  const tx = bx + 50;
  const tw = tW - 60;
  if (custom) boxText(ctx, custom, tx, by + titleH * 0.1, tw, titleH * 0.8, { color: '#ffffff', weight: 900, maxSize: titleH * 0.5 });
  else {
    const family = o.title === 'marker' ? MARKER : o.title === 'serif' ? '"Playfair Display", Georgia, serif' : CONDENSED;
    const weight = o.title === 'serif' ? 800 : 400;
    const color = o.title === 'serif' ? goldOf(ctx, '#e9cf8f', by, by + titleH) : '#ffffff';
    const oneLine = `${typeFr} ${dealFr}`;
    ctx.font = `${weight} ${titleH * 0.62}px ${family}`;
    if (ctx.measureText(oneLine).width < tw && !story) boxText(ctx, oneLine, tx, by + titleH * 0.1, tw, titleH * 0.8, { color, weight, family, maxSize: titleH * 0.66 });
    else {
      boxText(ctx, typeFr, tx, by + titleH * 0.04, tw, titleH * 0.48, { color, weight, family, maxSize: titleH * 0.5 });
      boxText(ctx, dealFr, tx, by + titleH * 0.5, tw, titleH * 0.46, { color, weight, family, maxSize: titleH * 0.48 });
    }
  }
  ctx.restore();

  // --- bande d'infos : adresse (repère rouge) | surface, chambres, salles de bain
  const sW = o.header === 'cut' || wide ? (wide ? colW : W * 0.62) : W;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, stripY);
  ctx.lineTo(sW, stripY);
  ctx.lineTo(sW - (sW < W ? 40 : 0), stripY + stripH);
  ctx.lineTo(0, stripY + stripH);
  ctx.closePath();
  ctx.fillStyle = black;
  ctx.fill();
  ctx.restore();
  const place = placeOf(d);
  const l1: Part[] = d.surface ? [{ t: 'المساحة ' }, { t: d.surfaceMax > d.surface ? `${d.surface}-${d.surfaceMax}` : String(d.surface), c: hi }, { t: ' م²' }] : [];
  const l2: Part[] = [];
  if (d.bedrooms) l2.push({ t: String(d.bedrooms), c: hi }, { t: ' غرف' });
  if (d.bathrooms) l2.push({ t: l2.length ? ' • ' : '' }, { t: String(d.bathrooms), c: hi }, { t: ' حمام' });
  const narrow = sW < W * 0.8 && !wide;
  if (!place && !l1.length && !l2.length) {
    // Rien à afficher dans la bande : le titre en arabe
    boxText(ctx, headlineOf(d), 40, stripY + stripH * 0.14, sW - 100, stripH * 0.72, { color: '#ffffff', weight: 900, maxSize: stripH * 0.5 });
  } else if (narrow) {
    // Bande étroite : adresse puis caractéristiques, l'une sous l'autre
    const specs = [...l1, ...(l1.length && l2.length ? [{ t: ' • ' }] : []), ...l2];
    const rowsS = [place ? 1 : 0, specs.length ? 1 : 0].filter(Boolean).length || 1;
    let i = 0;
    if (place) {
      const cy = stripY + (stripH * (i + 1)) / (rowsS + 1);
      drawIcon(ctx, MapPin, sW - 70 - stripH * 0.16, cy, stripH * 0.32, hi, 2.6);
      richLine(ctx, [{ t: 'العنوان : ' }, { t: place }], sW - 70 - stripH * 0.38, cy, stripH * 0.3, '#ffffff', sW - 120);
      i++;
    }
    if (specs.length) richLine(ctx, specs, sW - 70, stripY + (stripH * (i + 1)) / (rowsS + 1), stripH * 0.3, '#ffffff', sW - 110);
  } else {
    const half = (sW - 60) / 2;
    if (place) {
      const ar = sW - 40 - stripH * 0.55;
      drawIcon(ctx, MapPin, sW - 40 - stripH * 0.25, stripY + stripH / 2, stripH * 0.5, hi, 2.6);
      richLine(ctx, [{ t: 'العنوان : ' }, { t: place }], ar, stripY + stripH / 2, stripH * 0.4, '#ffffff', ar - (30 + half) - 24);
    }
    const sx = place ? 30 + half : sW - 40;
    const lines = [l1, l2].filter((l) => l.length);
    lines.forEach((l, i) =>
      richLine(ctx, l, sx, stripY + (stripH * (i + 1)) / (lines.length + 1), stripH * (lines.length > 1 ? 0.34 : 0.42), '#ffffff', half)
    );
  }

  // --- atouts : ronds rouges + titre + détail
  const featX = 36;
  const featW = (wide ? colW : hero ? W - 12 : mainX) - featX - 24;
  const featBottom = wide ? bodyY + 250 : hero ? bodyY + featH : bottomY - 14;
  if (rows.length) {
    const cols = wide || hero ? 2 : 1;
    const perCol = Math.ceil(rows.length / cols);
    const rh = Math.min(story ? 150 : 132, (featBottom - bodyY) / perCol);
    const cw = featW / cols;
    rows.forEach((r, i) => {
      const c = Math.floor(i / perCol);
      const y = bodyY + (i % perCol) * rh;
      const x = featX + c * cw;
      const cr = rh * 0.38;
      ctx.save();
      ctx.beginPath();
      ctx.arc(x + cr, y + rh / 2, cr, 0, Math.PI * 2);
      ctx.fillStyle = red;
      ctx.shadowColor = 'rgba(0,0,0,0.2)';
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.restore();
      drawIcon(ctx, r.icon, x + cr, y + rh / 2, cr * 1.05, '#ffffff', 2.4);
      const tx2 = x + cr * 2 + 16;
      const tw2 = cw - cr * 2 - 24;
      boxText(ctx, r.text, tx2, y + rh * (r.sub ? 0.12 : 0.18), tw2, rh * (r.sub ? 0.42 : 0.64), { color: ink, weight: 900, align: 'right', maxSize: rh * 0.3 });
      if (r.sub) boxText(ctx, `- ${r.sub}`, tx2, y + rh * 0.54, tw2, rh * 0.32, { color: o.dark ? '#d6d6d6' : '#333333', weight: 700, align: 'right', maxSize: rh * 0.22 });
    });
  }

  // --- photos secondaires + étiquette de prix
  const pRad = o.radius;
  const n = extras(p, 3);
  if (wide) {
    if (n) thumbRow(ctx, p, 1, Math.min(n, 2), 880, 572, W - 880 - 36, H - 572 - 36, 14, pRad);
    hangTag(ctx, d, W - 200, 500, 300, 110, red, -0.08);
  } else if (hero) {
    hangTag(ctx, d, W - 210, hdrH + 110, 330, 124, red, -0.08);
  } else if (o.header === 'cut') {
    hangTag(ctx, d, W - 210, mainY + mainH - 70, 330, 124, red, -0.09);
  } else {
    const y2 = mainY + mainH + 14;
    const h2 = bottomY - 14 - y2;
    if (h2 > 60 && extras(p, 1)) photo(ctx, pick(p, 1), mainX, y2, W - 36 - mainX, h2, pRad);
    hangTag(ctx, d, W - 36 - 165, y2 + h2 - 70, 330, 120, red, 0);
  }

  // --- bas : photos + cadre contact
  const contact = (x: number, y: number, w: number, h: number) => {
    const phones = agencyPhones();
    if (!phones.length && !hasQr()) return;
    fillRect(ctx, x, y, w, h, black, 6);
    if (o.border) {
      ctx.save();
      ctx.strokeStyle = o.border;
      ctx.lineWidth = 4;
      ctx.strokeRect(x + 10, y + 10, w - 20, h - 20);
      ctx.restore();
    }
    boxText(ctx, 'للتواصل و الاستفسار', x + 20, y + h * 0.04, w - 40, h * 0.18, { color: '#ffffff', weight: 900, maxSize: h * 0.13 });
    const qs = Math.min(h * 0.42, w * 0.32);
    const midY = y + h * 0.24;
    const showQr = qrBox(ctx, x + w / 2 + 10, midY, qs);
    brandDot(ctx, siWhatsapp.path, showQr ? x + w / 2 - 10 - qs * 0.45 : x + w / 2, midY + qs / 2, qs * 0.42, '#25d366');
    const py = midY + qs + h * 0.04;
    const ph = y + h - 12 - py;
    phones.slice(0, 2).forEach((num, i, arr) =>
      boxText(ctx, num, x + 20, py + (ph / arr.length) * i, w - 40, ph / arr.length, { color: '#ffffff', weight: 900, font: 'lat', maxSize: ph * 0.42 })
    );
  };
  if (wide) contact(36, noRows ? bodyY : bodyY + 262, colW - 72, footY - 12 - (noRows ? bodyY : bodyY + 262));
  else {
    const cw2 = W * 0.44;
    const tw3 = W - 36 - cw2 - 14 - 36;
    const k = Math.max(0, Math.min(2, n - (o.header === 'cut' || hero ? 0 : 1)));
    const from = o.header === 'cut' || hero ? 1 : 2;
    if (k === 2) {
      photo(ctx, pick(p, from), 36, bottomY, tw3, (bottomH - 10) / 2, pRad);
      photo(ctx, pick(p, from + 1), 36, bottomY + (bottomH + 10) / 2, tw3, (bottomH - 10) / 2, pRad);
    } else if (k === 1) photo(ctx, pick(p, from), 36, bottomY, tw3, bottomH, pRad);
    if (k) contact(W - 36 - cw2, bottomY, cw2, bottomH);
    else contact(36, bottomY, W - 72, bottomH); // pas d'autres photos : contact sur toute la largeur
  }

  // --- pied : réseaux sociaux + identifiant, slogan sur bande rouge
  const slogan = a.slogan.trim() || a.name.trim();
  const fy = footY;
  const sr = footH * 0.26;
  socialDots(ctx, 36, fy + footH / 2, sr, o.dark ? red : black, ink, (wide ? colW : W) * 0.42);
  if (slogan) {
    const bw = (wide ? colW : W) * 0.5;
    const bx2 = (wide ? colW : W) - bw;
    poly(ctx, [[bx2 + 40, fy + 6], [(wide ? colW : W), fy + 6], [(wide ? colW : W), H], [bx2, H]], red);
    boxText(ctx, slogan, bx2 + 50, fy + 12, bw - 80, Math.min(footH - 16, f.bot - fy - 12), { color: '#ffffff', weight: 900, maxSize: footH * 0.5 });
  }
};
const DEAL_FR: Record<PosterData['deal'], string> = { vente: 'A VENDRE', location: 'A LOUER', meuble: 'MEUBLÉ A LOUER' };

// ---------- « Luxe » : fond bleu nuit, rosaces dorées, titre calligraphié or, photo fondue,
// cadre prix doré, atouts à puces, ronds des caractéristiques, contact ----------
function rosette(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, color: string) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  for (let k = 0; k < 4; k++) {
    const r = R * (1 - k * 0.22);
    for (let s = 0; s < 2; s++) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((Math.PI / 4) * s + k * 0.2);
      ctx.strokeRect(-r / Math.SQRT2, -r / Math.SQRT2, r * Math.SQRT2, r * Math.SQRT2);
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function hexLogo(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, gold: string | CanvasGradient) {
  const a = agency();
  if (!a.logo && !a.name.trim()) return;
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const ang = Math.PI / 6 + (i * Math.PI) / 3;
    ctx[i ? 'lineTo' : 'moveTo'](cx + r * Math.cos(ang), cy + r * Math.sin(ang));
  }
  ctx.closePath();
  ctx.strokeStyle = gold;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
  if (a.logo) logo(ctx, cx, cy - r * 0.55, r * 1.1, 'center', '#ffffff');
  else boxText(ctx, a.name, cx - r * 0.7, cy - r * 0.4, r * 1.4, r * 0.8, { color: gold, weight: 800 });
}

const luxe = (o: { light?: boolean } = {}): Layout => (ctx, d, p, t, f) => {
  const { W, H } = f;
  const wide = f.shape === 'wide';
  const story = f.shape === 'story';
  const navy = t.panel;
  const gold = t.accent;
  const textC = o.light ? navy : '#ffffff';
  const G = (y0: number, y1: number) => (o.light ? goldOf(ctx, mix(gold, '#000000', 0.15).replace(/rgb\((\d+),(\d+),(\d+)\)/, (_, r, g, b) => '#' + [r, g, b].map((v: string) => (+v).toString(16).padStart(2, '0')).join('')), y0, y1) : goldOf(ctx, gold, y0, y1));
  // Fond : bleu nuit (ou crème pour la version claire), plus foncé en haut et en bas
  const bgTop = o.light ? t.bg : t.bg;
  const bgBot = o.light ? t.bg : t.bg;
  fillRect(ctx, 0, 0, W, H, o.light ? vGrad(ctx, 0, H, [[0, t.bg], [1, mix(t.bg, gold, 0.12)]]) : vGrad(ctx, 0, H, [[0, mix(navy, '#000000', 0.35)], [0.5, navy], [1, mix(navy, '#000000', 0.25)]]));
  rosette(ctx, wide ? 0 : -30, wide ? 90 : 170, wide ? 220 : 260, alpha(gold, 0.16));
  rosette(ctx, W + 40, wide ? H - 120 : 520, 220, alpha(gold, 0.12));

  const custom = d.headline.trim();
  const words = custom ? custom.split(/\s+/) : [];
  const line1 = custom ? words.slice(0, Math.ceil(words.length / 2)).join(' ') : TYPE_LABELS[d.type || 'Appartement'].ar;
  const line2 = custom ? words.slice(Math.ceil(words.length / 2)).join(' ') : dealOf(d);
  const subtitle = d.extras.map((x) => x.trim()).find(Boolean) || (placeOf(d) ? `في ${placeOf(d)}` : '');

  // Titre calligraphié + filet + sous-titre
  const titleBlock = (x: number, w: number, y: number, h: number) => {
    boxText(ctx, line1, x, y, w, h * 0.42, { color: G(y, y + h * 0.42), weight: 700, family: NASKH, maxSize: h * 0.4 });
    if (line2) boxText(ctx, line2, x, y + h * 0.4, w, h * 0.44, { color: G(y + h * 0.4, y + h * 0.84), weight: 700, family: NASKH, maxSize: h * 0.42 });
    line(ctx, x + w / 2 - w * 0.2, y + h * 0.9, x + w / 2 + w * 0.2, y + h * 0.9, alpha(gold, 0.8), 2);
  };
  const subBlock = (x: number, w: number, y: number, h: number) => {
    if (subtitle) boxText(ctx, subtitle, x, y, w, h, { color: o.light ? navy : mix(gold, '#ffffff', 0.35), weight: 700, maxSize: h * 0.42 });
  };

  // Cadre du prix
  const priceBox = (x: number, y: number, w: number, h: number) => {
    if (!priceOf(d)) return;
    fillRect(ctx, x, y, w, h, navy);
    ctx.save();
    ctx.strokeStyle = G(y, y + h);
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
    ctx.restore();
    boxText(ctx, priceOf(d), x + 20, y + h * 0.08, w - 40, h * 0.56, { color: G(y, y + h * 0.64), weight: 900, font: 'lat', maxSize: h * 0.46 });
    boxText(ctx, d.deal === 'vente' ? 'الثمن' : 'ثمن الكراء', x + 20, y + h * 0.64, w - 40, h * 0.28, { color: '#ffffff', weight: 700, maxSize: h * 0.22 });
  };

  // Ronds des caractéristiques (contour doré)
  const specCircles = (x: number, w: number, y: number, h: number) => {
    const list = mainSpecs(d).concat(d.features.slice(0, 1).map((ft) => ({ icon: featureInfo(ft).icon, text: ft }))).slice(0, 4);
    if (!list.length) return;
    const g = 16;
    const cw = Math.min(h, (w - g * (list.length - 1)) / list.length);
    const total = list.length * cw + (list.length - 1) * g;
    list.forEach((s, i) => {
      const cx = x + w - (w - total) / 2 - cw / 2 - i * (cw + g);
      const cy = y + h / 2;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, Math.min(cw, h) / 2, 0, Math.PI * 2);
      ctx.strokeStyle = alpha(gold, 0.85);
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
      const r = Math.min(cw, h) / 2;
      drawIcon(ctx, s.icon, cx, cy - r * 0.32, r * 0.62, gold, 1.8);
      boxText(ctx, s.text, cx - r * 0.78, cy + r * 0.12, r * 1.56, r * 0.6, { color: textC, weight: 800, maxSize: r * 0.3 });
    });
  };

  // Atouts à puces dorées + lieu
  const featList = (x: number, w: number, y: number, h: number) => {
    const rows = rowsOf(d, 5);
    if (!rows.length) return;
    boxText(ctx, 'المميزات', x, y, w, h * 0.16, { color: G(y, y + h * 0.16), weight: 800, align: 'right', maxSize: h * 0.13 });
    line(ctx, x + w * 0.55, y + h * 0.19, x + w, y + h * 0.19, alpha(gold, 0.6), 2);
    const rh = Math.min(h * 0.16, (h * 0.78) / rows.length);
    rows.forEach((r, i) => {
      const ry = y + h * 0.22 + i * rh;
      ctx.save();
      ctx.translate(x + w - rh * 0.25, ry + rh / 2);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = gold;
      ctx.fillRect(-rh * 0.1, -rh * 0.1, rh * 0.2, rh * 0.2);
      ctx.restore();
      boxText(ctx, r.text, x, ry + rh * 0.1, w - rh * 0.6, rh * 0.8, { color: textC, weight: 700, align: 'right', maxSize: rh * 0.58 });
    });
  };

  // Atouts sur deux colonnes (formats verticaux)
  const featGrid = (x: number, w: number, y: number, h: number) => {
    const rows = rowsOf(d, 6);
    if (!rows.length) return;
    const cols = rows.length > 3 ? 2 : 1;
    const per = Math.ceil(rows.length / cols);
    const rh = Math.min(64, h / per);
    const cw = w / cols;
    rows.forEach((r, i) => {
      const c = Math.floor(i / per);
      const right = x + w - c * cw;
      const ry = y + (i % per) * rh;
      ctx.save();
      ctx.translate(right - rh * 0.25, ry + rh / 2);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = gold;
      ctx.fillRect(-rh * 0.09, -rh * 0.09, rh * 0.18, rh * 0.18);
      ctx.restore();
      boxText(ctx, r.text, right - cw + 16, ry + rh * 0.12, cw - rh * 0.6 - 16, rh * 0.76, { color: textC, weight: 700, align: 'right', maxSize: rh * 0.56 });
    });
  };

  // Contact : téléphones, site, réseaux
  const contactRow = (x: number, w: number, y: number, h: number) => {
    line(ctx, x, y, x + w, y, alpha(gold, 0.7), 2);
    boxText(ctx, 'تواصل معنا', x, y + h * 0.06, w, h * 0.36, { color: G(y, y + h * 0.42), weight: 700, family: NASKH, maxSize: h * 0.3 });
    const a = agency();
    const items: { icon: IconNode; text: string }[] = [];
    const phones = agencyPhones();
    if (phones.length) items.push({ icon: Phone, text: phones.slice(0, 2).join('  |  ') });
    if (a.website.trim()) items.push({ icon: Globe, text: handle(a.website) });
    else if (socials()[0]) items.push({ icon: Globe, text: socials()[0].text });
    const iw = w / Math.max(1, items.length);
    items.forEach((it, i) => {
      const ix = x + w - (i + 1) * iw;
      const cy = y + h * 0.7;
      drawIcon(ctx, it.icon, ix + iw - h * 0.2, cy, h * 0.26, gold, 1.8);
      boxText(ctx, it.text, ix + 10, cy - h * 0.16, iw - h * 0.42 - 10, h * 0.32, { color: textC, weight: 700, font: 'lat', align: 'right', maxSize: h * 0.2 });
    });
  };

  // Photo fondue dans le fond
  const fadedPhoto = (x: number, y: number, w: number, h: number, side: 'v' | 'h') => {
    photo(ctx, pick(p, 0), x, y, w, h);
    if (side === 'v') {
      fillRect(ctx, x, y - 1, w, h * 0.24, vGrad(ctx, y, y + h * 0.24, [[0, alpha(bgTop, 1)], [1, alpha(bgTop, 0)]]));
      fillRect(ctx, x, y + h * 0.78, w, h * 0.22 + 1, vGrad(ctx, y + h * 0.78, y + h, [[0, alpha(bgBot, 0)], [1, alpha(bgBot, 1)]]));
    } else fillRect(ctx, x - 1, y, w * 0.32, h, hGrad(ctx, x, x + w * 0.32, [[0, alpha(bgTop, 1)], [1, alpha(bgTop, 0)]]));
  };

  if (wide) {
    fadedPhoto(760, 0, W - 760, H, 'h');
    hexLogo(ctx, W - 110, 100, 64, G(36, 164));
    titleBlock(40, 700, 30, 300);
    subBlock(40, 700, 330, 80);
    featList(40, 330, 430, 300);
    specCircles(390, 360, 470, 150);
    priceBox(860, 640, 420, 130);
    contactRow(40, 700, 770, 110);
    return;
  }
  hexLogo(ctx, W - 130, f.top + 110, 76, G(f.top + 34, f.top + 186));
  const k = story ? 1.18 : 1;
  stack(
    [
      { h: 250 * k, draw: (y, h) => titleBlock(150, W - 300, y, h) },
      subtitle ? { h: 70, draw: (y, h) => subBlock(160, W - 320, y, h) } : null,
      {
        h: story ? 640 : 400,
        flex: true,
        draw: (y, h) => {
          fadedPhoto(0, y, W, h, 'v');
          priceBox(W * 0.4, y + h - 80, W * 0.56, 130);
        },
      },
      { h: 50, draw: () => undefined },
      mainSpecs(d).length || d.features.length ? { h: story ? 190 : 160, draw: (y, h) => specCircles(60, W - 120, y, h) } : null,
      rowsOf(d, 6).length ? { h: story ? 220 : 170, draw: (y, h) => featGrid(60, W - 120, y, h) } : null,
      { h: story ? 160 : 130, draw: (y, h) => contactRow(60, W - 120, y, h) },
    ],
    f.top + 40,
    f.bot - f.top - 50,
    12
  );
};

// ---------- Les 25 modèles (3 styles, plusieurs mises en page et couleurs) ----------
const T = (t: Theme) => t;
export const PRO_DESIGNS: ProDesign[] = [
  // Style « agence » (bandeau noir, titre français sur pinceau, atouts en ronds, contact WhatsApp + QR)
  { id: 'agence-1', name: 'أحمر وأسود', layout: agencyLayout({ header: 'center', title: 'anton', band: 'brush', tilt: 0, radius: 0 }), theme: T({ bg: '#ffffff', panel: '#111111', ink: '#141414', soft: '#555555', accent: '#e3131b', onAccent: '#ffffff', price: 'block' }) },
  { id: 'agence-2', name: 'أحمر مائل', layout: agencyLayout({ header: 'cut', title: 'marker', band: 'brush', tilt: -0.06, radius: 0 }), theme: T({ bg: '#ffffff', panel: '#111111', ink: '#141414', soft: '#555555', accent: '#e3131b', onAccent: '#ffffff', price: 'block' }) },
  { id: 'agence-3', name: 'أحمر فاخر', layout: agencyLayout({ header: 'center', title: 'serif', band: 'brush', tilt: 0, radius: 6, border: '#c9a046' }), theme: T({ bg: '#ffffff', panel: '#0d0d0d', ink: '#141414', soft: '#555555', accent: '#a50e14', onAccent: '#ffffff', price: 'block' }) },
  { id: 'agence-4', name: 'أحمر ممزق', layout: agencyLayout({ header: 'cut', title: 'anton', band: 'torn', tilt: 0, radius: 22 }), theme: T({ bg: '#ffffff', panel: '#111111', ink: '#141414', soft: '#555555', accent: '#e3131b', onAccent: '#ffffff', price: 'block' }) },
  { id: 'agence-7', name: 'أسود وأحمر', layout: agencyLayout({ header: 'center', title: 'anton', band: 'torn', tilt: 0, radius: 0, dark: true }), theme: T({ bg: '#111111', panel: '#111111', ink: '#ffffff', soft: '#cccccc', accent: '#e3131b', onAccent: '#ffffff', price: 'block' }) },
  { id: 'agence-h1', name: 'أحمر بصورة كبيرة', layout: agencyLayout({ header: 'center', title: 'anton', band: 'brush', tilt: -0.02, radius: 0, hero: true }), theme: T({ bg: '#ffffff', panel: '#111111', ink: '#141414', soft: '#555555', accent: '#e3131b', onAccent: '#ffffff', price: 'block' }) },
  { id: 'agence-h2', name: 'أزرق بصورة كبيرة', layout: agencyLayout({ header: 'center', title: 'anton', band: 'torn', tilt: 0, radius: 12, hero: true }), theme: T({ bg: '#ffffff', panel: '#0d1b2a', ink: '#141414', soft: '#555555', accent: '#0b5ed7', onAccent: '#ffffff', price: 'block' }) },
  { id: 'agence-h3', name: 'أخضر بصورة كبيرة', layout: agencyLayout({ header: 'center', title: 'marker', band: 'brush', tilt: -0.04, radius: 0, hero: true }), theme: T({ bg: '#ffffff', panel: '#111111', ink: '#141414', soft: '#555555', accent: '#0f8a4b', onAccent: '#ffffff', price: 'block' }) },
  { id: 'agence-h4', name: 'أسود وذهبي بصورة كبيرة', layout: agencyLayout({ header: 'center', title: 'serif', band: 'torn', tilt: 0, radius: 6, hero: true, border: '#c9a046', hi: '#d4af5a' }), theme: T({ bg: '#ffffff', panel: '#0b0b0b', ink: '#141414', soft: '#555555', accent: '#1c1c1c', onAccent: '#ffffff', price: 'block' }) },
  { id: 'agence-5', name: 'أزرق وأسود', layout: agencyLayout({ header: 'center', title: 'anton', band: 'torn', tilt: -0.02, radius: 10 }), theme: T({ bg: '#ffffff', panel: '#0d1b2a', ink: '#141414', soft: '#555555', accent: '#0b5ed7', onAccent: '#ffffff', price: 'block' }) },
  { id: 'agence-6', name: 'أخضر وأسود', layout: agencyLayout({ header: 'cut', title: 'anton', band: 'brush', tilt: -0.03, radius: 0 }), theme: T({ bg: '#ffffff', panel: '#111111', ink: '#141414', soft: '#555555', accent: '#0f8a4b', onAccent: '#ffffff', price: 'block' }) },
  { id: 'agence-8', name: 'برتقالي وأسود', layout: agencyLayout({ header: 'center', title: 'marker', band: 'torn', tilt: -0.03, radius: 14 }), theme: T({ bg: '#ffffff', panel: '#111111', ink: '#141414', soft: '#555555', accent: '#f26b1d', onAccent: '#ffffff', price: 'block' }) },
  { id: 'agence-9', name: 'عنابي وذهبي', layout: agencyLayout({ header: 'cut', title: 'serif', band: 'brush', tilt: 0, radius: 0, border: '#c9a046', hi: '#d4af5a' }), theme: T({ bg: '#ffffff', panel: '#140a0c', ink: '#141414', soft: '#555555', accent: '#7a1022', onAccent: '#ffffff', price: 'block' }) },
  // Style « luxe » (titre calligraphié or, photo fondue, cadre prix doré)
  { id: 'luxe-1', name: 'فخامة ليلية', layout: luxe(), theme: T({ bg: '#0f1e3d', panel: '#12234a', ink: '#ffffff', soft: '#c9b27a', accent: '#d4af5a', onAccent: '#12234a', price: 'block' }) },
  { id: 'luxe-2', name: 'فخامة سوداء', layout: luxe(), theme: T({ bg: '#0b0b0b', panel: '#17171a', ink: '#ffffff', soft: '#c9b27a', accent: '#d4af5a', onAccent: '#111111', price: 'block' }) },
  { id: 'luxe-3', name: 'فخامة زمردية', layout: luxe(), theme: T({ bg: '#062a24', panel: '#0b3a31', ink: '#ffffff', soft: '#c9b27a', accent: '#d4af5a', onAccent: '#0b3a31', price: 'block' }) },
  { id: 'luxe-4', name: 'فخامة عنابية', layout: luxe(), theme: T({ bg: '#2e0a12', panel: '#45101c', ink: '#ffffff', soft: '#c9b27a', accent: '#d4af5a', onAccent: '#45101c', price: 'block' }) },
  { id: 'luxe-5', name: 'فخامة كريمية', layout: luxe({ light: true }), theme: T({ bg: '#f6efe3', panel: '#14244a', ink: '#14244a', soft: '#8a7650', accent: '#c19a45', onAccent: '#ffffff', price: 'block' }) },
  { id: 'luxe-6', name: 'فخامة بيضاء', layout: luxe({ light: true }), theme: T({ bg: '#ffffff', panel: '#121212', ink: '#121212', soft: '#8a7650', accent: '#c19a45', onAccent: '#ffffff', price: 'block' }) },
  { id: 'luxe-7', name: 'فخامة رملية', layout: luxe({ light: true }), theme: T({ bg: '#efe6d6', panel: '#2f3b2a', ink: '#2f3b2a', soft: '#7d7259', accent: '#b8913d', onAccent: '#ffffff', price: 'block' }) },
  // Style « fiche » (titre empilé or, photo en courbe, tuiles, cartes, bandeaux prix et contact)
  { id: 'fiche-1', name: 'كحلي وذهبي', layout: fiche(), theme: T({ bg: '#ffffff', panel: '#16264a', ink: '#16264a', soft: '#5d6b85', accent: '#c9a046', onAccent: '#16264a', price: 'block', plate: '#ffffff' }) },
  { id: 'fiche-2', name: 'أخضر ملكي وذهبي', layout: fiche(), theme: T({ bg: '#ffffff', panel: '#0f3d33', ink: '#0f3d33', soft: '#5a7068', accent: '#c9a046', onAccent: '#0f3d33', price: 'block', plate: '#ffffff' }) },
  { id: 'fiche-3', name: 'عنابي وذهبي فاتح', layout: fiche(), theme: T({ bg: '#ffffff', panel: '#5a1428', ink: '#5a1428', soft: '#7d5a63', accent: '#c9a046', onAccent: '#5a1428', price: 'block', plate: '#ffffff' }) },
  { id: 'fiche-4', name: 'أسود وذهبي', layout: fiche(), theme: T({ bg: '#ffffff', panel: '#141414', ink: '#141414', soft: '#5c5c5c', accent: '#c9a046', onAccent: '#141414', price: 'block', plate: '#ffffff' }) },
  { id: 'fiche-5', name: 'تركوازي وذهبي', layout: fiche(), theme: T({ bg: '#ffffff', panel: '#0d4d57', ink: '#0d4d57', soft: '#557276', accent: '#c9a046', onAccent: '#0d4d57', price: 'block', plate: '#ffffff' }) },
];

// Dessine un modèle à la taille demandée : format choisi d'après les proportions, dessin à une taille de référence.
export function drawPro(ctx: CanvasRenderingContext2D, design: ProDesign, d: PosterData, p: Img[], w: number, h: number) {
  const a = w / h;
  const shape: Shape = a > 1.2 ? 'wide' : a < 0.7 ? 'story' : 'portrait';
  const W = shape === 'wide' ? 1600 : 1080;
  const H = W / a;
  const f: Frame = {
    W,
    H,
    shape,
    top: shape === 'story' ? H * 0.05 : 0,
    bot: shape === 'story' ? H * 0.9 : H,
  };
  ctx.save();
  ctx.scale(w / W, h / H);
  ctx.fillStyle = design.theme.bg;
  ctx.fillRect(0, 0, W, H);
  design.layout(ctx, d, p, design.theme, f);
  ctx.restore();
}
