// Collection « Signature » : 7 mises en page haut de gamme (verre dépoli, magazine, diagonale, arche marocaine,
// mosaïque, grand prix, minimal) × plusieurs couleurs. Chaque modèle se redessine proprement pour chaque format :
// portrait 4:5, carré 1:1, story 9:16 (zones sûres) et paysage (X, LinkedIn, Facebook lien, miniature YouTube).
// Les blocs vides (pas de prix, pas de logo, pas de numéro…) disparaissent sans laisser de trou.
import { MapPin, Phone } from 'lucide';
import { agency, agencyPhones } from './agencySettings';
import { Img, PosterData, coverInPath, drawIcon } from './posterMaker';
import {
  Spec,
  allSpecs,
  boxText,
  brandBlock,
  circlePhoto,
  archPhoto,
  dealOf,
  fillRect,
  framedPhoto,
  hasQr,
  headlineOf,
  logo,
  photo,
  pick,
  placeOf,
  priceOf,
  qrBox,
  rr,
  socialRow,
  socials,
  subOf,
  textW,
  vGrad,
} from './posterKit';
import { Frame, Item, Layout, ProDesign, Theme, alpha, extras, mix, stack } from './proTemplates';

const NASKH = 'Amiri, Tajawal, serif';
const LATF = 'Inter, Tajawal, sans-serif';

// ---------- Petits outils ----------
const scaleOf = (ctx: CanvasRenderingContext2D) => Math.abs(ctx.getTransform().a) || 1;
const hasContact = () => agencyPhones().length > 0 || hasQr();
const hasBrand = () => !!agency().name.trim() || !!agency().logo;
const isSquare = (f: Frame) => f.shape === 'portrait' && f.H / f.W < 1.12;

function shadowed(ctx: CanvasRenderingContext2D, blur: number, oy: number, color = 'rgba(0,0,0,0.3)') {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur * scaleOf(ctx);
  ctx.shadowOffsetY = oy * scaleOf(ctx);
}

// Panneau « verre dépoli » : la photo floutée derrière + voile coloré + liseré clair.
function glass(ctx: CanvasRenderingContext2D, img: Img | undefined, bg: [number, number, number, number], x: number, y: number, w: number, h: number, r: number, tint: string) {
  ctx.save();
  shadowed(ctx, 50, 18, 'rgba(0,0,0,0.35)');
  rr(ctx, x, y, w, h, r);
  ctx.fillStyle = tint;
  ctx.fill();
  ctx.restore();
  ctx.save();
  rr(ctx, x, y, w, h, r);
  ctx.clip();
  try {
    ctx.filter = `blur(${Math.max(2, 28 * scaleOf(ctx))}px)`;
    photo(ctx, img, ...bg);
  } catch {
    /* navigateur sans filtre : le voile suffit */
  }
  ctx.filter = 'none';
  ctx.fillStyle = tint;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
  ctx.save();
  rr(ctx, x + 1.5, y + 1.5, w - 3, h - 3, r);
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}

// Pastilles d'atouts (icône + texte), de droite à gauche ou centrées ; réduit puis retire si ça déborde.
function chips(
  ctx: CanvasRenderingContext2D,
  list: Spec[],
  x: number,
  y: number,
  w: number,
  h: number,
  o: { bg: string; fg: string; icon: string; line?: string; align?: 'right' | 'center' | 'left' }
) {
  if (!list.length) return;
  let n = list.length;
  let size = h * 0.42;
  const gap = h * 0.22;
  const cw = (s: Spec, sz: number) => textW(ctx, s.text, sz, 800) + h * 1.3;
  const total = (k: number, sz: number) => list.slice(0, k).reduce((a, s) => a + cw(s, sz), 0) + gap * (k - 1);
  while (total(n, size) > w) {
    if (size > h * 0.32) size *= 0.94;
    else if (n > 1) n--;
    else break;
  }
  const tw = Math.min(w, total(n, size));
  let right = o.align === 'center' ? x + (w + tw) / 2 : o.align === 'left' ? x + tw : x + w;
  for (const s of list.slice(0, n)) {
    const c = Math.min(cw(s, size), w);
    const bx = right - c;
    fillRect(ctx, bx, y, c, h, o.bg, h / 2);
    if (o.line) {
      ctx.save();
      rr(ctx, bx + 1, y + 1, c - 2, h - 2, h / 2);
      ctx.strokeStyle = o.line;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
    drawIcon(ctx, s.icon, right - h * 0.52, y + h / 2, h * 0.46, o.icon, 2.2);
    boxText(ctx, s.text, bx + h * 0.3, y, c - h * 1.08, h, { color: o.fg, weight: 800, maxSize: size, align: 'center' });
    right = bx - gap;
  }
}

// Prix (avec petite étiquette) ; false s'il n'y a pas de prix.
function price(
  ctx: CanvasRenderingContext2D,
  d: PosterData,
  x: number,
  y: number,
  w: number,
  h: number,
  o: { fill?: string | CanvasGradient; color: string; label?: string; labelColor?: string; align?: 'right' | 'center' | 'left'; radius?: number }
) {
  const t = priceOf(d);
  if (!t) return false;
  const align = o.align ?? 'right';
  let px = x;
  let pw = w;
  if (o.fill) {
    const need = Math.min(w, Math.max(textW(ctx, t, h * 0.5, 900) + h * 0.9, h * 2.6));
    px = align === 'right' ? x + w - need : align === 'center' ? x + (w - need) / 2 : x;
    pw = need;
    ctx.save();
    shadowed(ctx, 24, 8, 'rgba(0,0,0,0.22)');
    fillRect(ctx, px, y, pw, h, o.fill, o.radius ?? h * 0.22);
    ctx.restore();
  }
  const pad = o.fill ? h * 0.38 : 0;
  if (o.label) {
    boxText(ctx, o.label, px + pad, y + h * 0.06, pw - pad * 2, h * 0.28, { color: o.labelColor ?? o.color, weight: 700, align, maxSize: h * 0.24 });
    boxText(ctx, t, px + pad, y + h * 0.32, pw - pad * 2, h * 0.62, { color: o.color, weight: 900, align });
  } else boxText(ctx, t, px + pad, y + h * 0.14, pw - pad * 2, h * 0.72, { color: o.color, weight: 900, align });
  return true;
}

// Lieu avec repère (aligné à droite ou centré).
function place(ctx: CanvasRenderingContext2D, d: PosterData, x: number, y: number, w: number, h: number, color: string, pin: string, align: 'right' | 'center' = 'right') {
  const t = placeOf(d);
  if (!t) return;
  const size = h * 0.72;
  const tw = Math.min(textW(ctx, t, size, 700), w - h * 1.3);
  const total = tw + h * 1.05;
  const right = align === 'right' ? x + w : x + (w + total) / 2;
  drawIcon(ctx, MapPin, right - h * 0.42, y + h / 2, h * 0.78, pin, 2.3);
  boxText(ctx, t, right - total, y, tw, h, { color, weight: 700, align: 'right', maxSize: size });
}

// Petit filet décoratif (losange au milieu).
function ornament(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, color: string) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, cy);
  ctx.lineTo(cx - 16, cy);
  ctx.moveTo(cx + 16, cy);
  ctx.lineTo(cx + w / 2, cy);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy - 9);
  ctx.lineTo(cx + 9, cy);
  ctx.lineTo(cx, cy + 9);
  ctx.lineTo(cx - 9, cy);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// Étoiles à 8 branches (motif zellige discret).
function zellige(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, step = 120) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  const r = step * 0.34;
  for (let yy = y - step; yy < y + h + step; yy += step)
    for (let xx = x - step + ((Math.round((yy - y) / step) % 2) * step) / 2; xx < x + w + step; xx += step) {
      for (const rot of [0, Math.PI / 4]) {
        ctx.save();
        ctx.translate(xx, yy);
        ctx.rotate(rot);
        ctx.strokeRect(-r, -r, r * 2, r * 2);
        ctx.restore();
      }
      ctx.beginPath();
      ctx.arc(xx, yy, r * 0.42, 0, Math.PI * 2);
      ctx.stroke();
    }
  ctx.restore();
}

// Ruban de contact (téléphones + QR WhatsApp) ; null s'il n'y a rien à montrer.
function contactItem(ctx: CanvasRenderingContext2D, x: number, w: number, h: number, o: { bg?: string | CanvasGradient; color: string; accent: string; onAccent: string; label?: string; radius?: number }): Item | null {
  if (!hasContact()) return null;
  return {
    h,
    draw: (y, hh) => {
      if (o.bg) fillRect(ctx, x, y, w, hh, o.bg, o.radius ?? hh * 0.22);
      contactRow(ctx, x, y, w, hh, !!o.bg, o);
    },
  };
}

// Contact : QR WhatsApp (gauche), rond téléphone (droite), numéros en grand au milieu.
function contactRow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, padded: boolean, o: { color: string; accent: string; onAccent: string; label?: string }) {
  const pad = padded ? h * 0.12 : 0;
  const ih = h - pad * 2;
  const phones = agencyPhones();
  let left = x + pad * 1.3;
  if (hasQr() && ih >= 70 && w > ih * 3.2) {
    qrBox(ctx, left, y + pad, ih);
    left += ih + h * 0.2;
  }
  let right = x + w - pad * 1.3;
  if (phones.length) {
    const r = Math.min(ih * 0.36, 52);
    ctx.save();
    ctx.beginPath();
    ctx.arc(right - r, y + h / 2, r, 0, Math.PI * 2);
    ctx.fillStyle = o.accent;
    ctx.fill();
    ctx.restore();
    drawIcon(ctx, Phone, right - r, y + h / 2, r * 1.05, o.onAccent, 2.4);
    right -= r * 2 + h * 0.16;
  }
  const tw = right - left;
  if (tw < 60) return;
  const label = phones.length ? o.label ?? 'للتواصل والزيارة' : 'امسح الرمز للتواصل عبر واتساب';
  const lines = phones.length > 1 && ih > 105 && tw < 520 ? phones.slice(0, 2) : phones.length ? [phones.slice(0, 3).join('  •  ')] : [];
  const lh = ih * 0.3;
  boxText(ctx, label, left, y + pad, tw, lines.length ? lh : ih, { color: o.accent, weight: 800, align: 'right', maxSize: lh * 0.8 });
  const rest = ih - lh;
  lines.forEach((l, i) =>
    boxText(ctx, l, left, y + pad + lh + (rest / lines.length) * i, tw, rest / lines.length, { color: o.color, weight: 900, align: 'right', font: 'lat', maxSize: (rest / lines.length) * 0.82 })
  );
}

// Réseaux sociaux de l'agence (si remplis).
function socialItem(ctx: CanvasRenderingContext2D, x: number, w: number, h: number, color: string, dot: string): Item | null {
  if (!socials().length) return null;
  return { h, draw: (y, hh) => socialRow(ctx, x, y, w, hh, color, dot) };
}

const specsOf = (d: PosterData, n: number) => allSpecs(d, n);
const extraLine = (d: PosterData) => d.extras.map((x) => x.trim()).filter(Boolean)[0] || '';

// Bloc d'informations commun : étiquette, titre, lieu, atouts, phrase, prix, contact, réseaux.
interface InfoStyle {
  ink: string;
  soft: string;
  accent: string;
  onAccent: string;
  chipBg: string;
  chipFg: string;
  chipIcon: string;
  chipLine?: string;
  head?: 'ar' | 'naskh';
  align?: 'right' | 'center';
  priceFill?: string | CanvasGradient | null;
  contactBg?: string | CanvasGradient;
  contactInk?: string;
  kicker?: boolean;
  chipsN?: number;
}
function info(ctx: CanvasRenderingContext2D, d: PosterData, x: number, w: number, s: InfoStyle, k = 1): (Item | null)[] {
  const align = s.align ?? 'right';
  const ex = extraLine(d);
  const sp = specsOf(d, s.chipsN ?? 4);
  return [
    s.kicker !== false
      ? {
          h: 40 * k,
          draw: (y, h) => boxText(ctx, subOf(d).toUpperCase(), x, y, w, h, { color: s.accent, weight: 800, align, font: 'lat', maxSize: h * 0.72 }),
        }
      : null,
    {
      h: 150 * k,
      flex: true,
      draw: (y, h) =>
        boxText(ctx, headlineOf(d), x, y, w, Math.min(h, 190 * k), {
          color: s.ink,
          weight: s.head === 'naskh' ? 700 : 900,
          align,
          family: s.head === 'naskh' ? NASKH : undefined,
          maxSize: 104 * k,
        }),
    },
    placeOf(d) ? { h: 46 * k, draw: (y, h) => place(ctx, d, x, y, w, h, s.soft, s.accent, align) } : null,
    sp.length ? { h: 74 * k, draw: (y, h) => chips(ctx, sp, x, y, w, h, { bg: s.chipBg, fg: s.chipFg, icon: s.chipIcon, line: s.chipLine, align }) } : null,
    ex ? { h: 44 * k, draw: (y, h) => boxText(ctx, `✓ ${ex}`, x, y, w, h, { color: s.soft, weight: 700, align, maxSize: h * 0.78 }) } : null,
    priceOf(d)
      ? {
          h: 116 * k,
          draw: (y, h) => price(ctx, d, x, y, w, h, { fill: s.priceFill ?? undefined, color: s.priceFill ? s.onAccent : s.accent, label: 'الثمن', labelColor: s.priceFill ? alpha('#ffffff', 0.85) : s.soft, align }),
        }
      : null,
  ];
}

// ======================================================================
// 1. Verre dépoli : photo plein cadre + carte en verre
// ======================================================================
const glassLayout = (dark: boolean): Layout => (ctx, d, p, t, f) => {
  const { W, H } = f;
  const wide = f.shape === 'wide';
  const story = f.shape === 'story';
  const sq = isSquare(f);
  const m = wide ? 56 : 48;
  photo(ctx, pick(p, 0), 0, 0, W, H);
  // voiles pour la lisibilité
  fillRect(ctx, 0, 0, W, Math.max(260, f.top + 240), vGrad(ctx, 0, Math.max(260, f.top + 240), [[0, 'rgba(0,0,0,0.55)'], [1, 'rgba(0,0,0,0)']]));
  const ink = dark ? '#ffffff' : t.ink;
  const soft = dark ? 'rgba(255,255,255,0.78)' : t.soft;
  const tint = dark ? alpha(t.panel, 0.62) : 'rgba(255,255,255,0.80)';
  const st: InfoStyle = {
    ink,
    soft,
    accent: t.accent,
    onAccent: t.onAccent,
    chipBg: dark ? 'rgba(255,255,255,0.12)' : alpha(t.accent, 0.1),
    chipFg: ink,
    chipIcon: t.accent,
    chipLine: dark ? 'rgba(255,255,255,0.18)' : undefined,
    priceFill: t.accent,
  };
  // en-tête : logo + nom (droite), transaction (gauche)
  const hy = f.top + (story ? 30 : 36);
  if (hasBrand()) brandBlock(ctx, wide ? W - m - 600 : W / 2, hy, wide ? 600 : W / 2 - m, wide ? 96 : 92, '#ffffff', t.plate ?? '#ffffff', 'right');
  if (wide) {
    const cw = 640;
    const cx = W - m - cw;
    const cy = hy + 120;
    const ch = H - cy - m;
    glass(ctx, pick(p, 0), [0, 0, W, H], cx, cy, cw, ch, 34, tint);
    stack([...info(ctx, d, cx + 40, cw - 80, { ...st, chipsN: 3 }, 0.9), contactItem(ctx, cx + 30, cw - 60, 120, { color: ink, accent: t.accent, onAccent: t.onAccent })], cy + 30, ch - 60, 16);
    const k = extras(p, 3);
    for (let i = 0; i < k; i++) framedPhoto(ctx, pick(p, i + 1), m + i * 236, H - m - 160, 220, 160, 6, '#ffffff', 18);
    pillTop(ctx, d, m, hy + 16, 64, t);
    return;
  }
  pillTop(ctx, d, m, hy + 16, 62, t);
  const ch = story ? 820 : sq ? 560 : 640;
  const cy = f.bot - ch - (story ? 10 : m);
  const k = extras(p, sq ? 2 : 3);
  if (k) {
    const tw = sq ? 180 : 200;
    const th = sq ? 130 : 150;
    for (let i = 0; i < k; i++) framedPhoto(ctx, pick(p, i + 1), m + i * (tw + 16), cy - th - 26, tw, th, 6, '#ffffff', 18);
  }
  glass(ctx, pick(p, 0), [0, 0, W, H], m, cy, W - m * 2, ch, 40, tint);
  stack(
    [...info(ctx, d, m + 44, W - m * 2 - 88, st, sq ? 0.86 : story ? 1.15 : 1), contactItem(ctx, m + 30, W - m * 2 - 60, story ? 150 : 128, { color: ink, accent: t.accent, onAccent: t.onAccent })],
    cy + 34,
    ch - 68,
    story ? 22 : 14
  );
};

// Pastille transaction (« للبيع ») en haut à gauche.
function pillTop(ctx: CanvasRenderingContext2D, d: PosterData, x: number, y: number, h: number, t: Theme) {
  const txt = dealOf(d);
  const w = textW(ctx, txt, h * 0.5, 900) + h * 1.1;
  ctx.save();
  shadowed(ctx, 18, 6, 'rgba(0,0,0,0.3)');
  fillRect(ctx, x, y, w, h, t.accent, h / 2);
  ctx.restore();
  boxText(ctx, txt, x + h * 0.4, y + h * 0.16, w - h * 0.8, h * 0.68, { color: t.onAccent, weight: 900, maxSize: h * 0.52 });
}

// ======================================================================
// 2. Magazine : grande photo encadrée, titre élégant, filets fins
// ======================================================================
const editorial = (): Layout => (ctx, d, p, t, f) => {
  const { W, H } = f;
  const wide = f.shape === 'wide';
  const story = f.shape === 'story';
  const sq = isSquare(f);
  const m = wide ? 60 : 54;
  fillRect(ctx, 0, 0, W, H, t.bg);
  const st: InfoStyle = { ink: t.ink, soft: t.soft, accent: t.accent, onAccent: t.onAccent, chipBg: 'transparent', chipFg: t.ink, chipIcon: t.accent, chipLine: alpha(t.ink, 0.18), head: 'naskh', priceFill: null };
  const header = (x: number, y: number, w: number) => {
    if (hasBrand()) brandBlock(ctx, x + w * 0.4, y, w * 0.6, 84, t.ink, t.plate, 'right');
    boxText(ctx, subOf(d).toUpperCase(), x, y + 20, w * 0.38, 44, { color: t.soft, weight: 700, align: 'left', font: 'lat', maxSize: 26 });
    fillRect(ctx, x, y + 104, w, 3, t.ink);
  };
  if (wide) {
    const pw = 860;
    photo(ctx, pick(p, 0), m, m, pw, H - m * 2, 26);
    const k = extras(p, 3);
    for (let i = 0; i < k; i++) circlePhoto(ctx, pick(p, i + 1), m + pw - 80 - i * 150, H - m - 10, 66, 8, t.bg);
    const x = m + pw + 60;
    const w = W - x - m;
    header(x, m, w);
    stack([...info(ctx, d, x, w, { ...st, chipsN: 3 }, 0.88), contactItem(ctx, x, w, 120, { color: t.ink, accent: t.accent, onAccent: t.onAccent })], m + 130, H - m * 2 - 130, 14);
    return;
  }
  const top = f.top + (story ? 40 : m);
  header(m, top, W - m * 2);
  const py = top + 134;
  const ph = story ? 700 : sq ? 360 : 560;
  photo(ctx, pick(p, 0), m, py, W - m * 2, ph, 30);
  // vignettes rondes à cheval sur le bas de la photo
  const k = extras(p, 3);
  const r = sq ? 54 : 66;
  for (let i = 0; i < k; i++) circlePhoto(ctx, pick(p, i + 1), m + 30 + r + i * (r * 2 + 18), py + ph, r, 8, t.bg);
  // prix en étiquette sur la photo (en bas à droite)
  const y0 = py + ph + (k ? r + 14 : 30);
  stack(
    [...info(ctx, d, m, W - m * 2, { ...st, priceFill: t.accent }, sq ? 0.86 : story ? 1.25 : 1), contactItem(ctx, m, W - m * 2, story ? 150 : 126, { bg: alpha(t.ink, 0.05), color: t.ink, accent: t.accent, onAccent: t.onAccent })],
    y0,
    f.bot - y0 - (story ? 10 : m - 10),
    story ? 22 : 12
  );
};

// ======================================================================
// 3. Diagonale : photo coupée en biais, bande couleur, panneau sombre, prix en rond
// ======================================================================
const diagonal = (): Layout => (ctx, d, p, t, f) => {
  const { W, H } = f;
  const wide = f.shape === 'wide';
  const story = f.shape === 'story';
  const sq = isSquare(f);
  const m = 52;
  const onP = t.onPanel ?? '#ffffff';
  fillRect(ctx, 0, 0, W, H, t.panel);
  const st: InfoStyle = {
    ink: onP,
    soft: alpha('#ffffff', 0.72),
    accent: t.accent,
    onAccent: t.onAccent,
    chipBg: 'rgba(255,255,255,0.09)',
    chipFg: onP,
    chipIcon: t.accent,
    chipLine: 'rgba(255,255,255,0.14)',
    priceFill: null,
  };
  if (wide) {
    const x0 = W * 0.44;
    coverInPath(
      ctx,
      pick(p, 0),
      () => {
        ctx.beginPath();
        ctx.moveTo(x0 + 120, 0);
        ctx.lineTo(W, 0);
        ctx.lineTo(W, H);
        ctx.lineTo(x0 - 60, H);
        ctx.closePath();
      },
      x0 - 60,
      0,
      W - x0 + 60,
      H
    );
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x0 + 120, 0);
    ctx.lineTo(x0 + 150, 0);
    ctx.lineTo(x0 - 30, H);
    ctx.lineTo(x0 - 60, H);
    ctx.closePath();
    ctx.fillStyle = t.accent;
    ctx.fill();
    ctx.restore();
    const k = extras(p, 3);
    for (let i = 0; i < k; i++) framedPhoto(ctx, pick(p, i + 1), W - m - 200 - i * 216, H - m - 140, 200, 140, 5, '#ffffff', 14);
    if (hasBrand()) brandBlock(ctx, m, m, 560, 90, onP, t.plate ?? '#ffffff', 'left');
    const w = x0 - m - 90;
    stack(
      [...info(ctx, d, m, w, { ...st, priceFill: t.accent, chipsN: 3 }, 0.86), contactItem(ctx, m, w, 120, { bg: 'rgba(255,255,255,0.07)', color: onP, accent: t.accent, onAccent: t.onAccent })],
      m + 120,
      H - m * 2 - 120,
      14
    );
    return;
  }
  const cut = story ? H * 0.52 : sq ? H * 0.5 : H * 0.53;
  const drop = 110;
  coverInPath(
    ctx,
    pick(p, 0),
    () => {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(W, 0);
      ctx.lineTo(W, cut - drop);
      ctx.lineTo(0, cut + drop * 0.4);
      ctx.closePath();
    },
    0,
    0,
    W,
    cut + drop
  );
  fillRect(ctx, 0, 0, W, f.top + 220, vGrad(ctx, 0, f.top + 220, [[0, 'rgba(0,0,0,0.5)'], [1, 'rgba(0,0,0,0)']]));
  // bande d'accent parallèle
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, cut + drop * 0.4);
  ctx.lineTo(W, cut - drop);
  ctx.lineTo(W, cut - drop + 22);
  ctx.lineTo(0, cut + drop * 0.4 + 22);
  ctx.closePath();
  ctx.fillStyle = t.accent;
  ctx.fill();
  ctx.restore();
  if (hasBrand()) brandBlock(ctx, W / 2, f.top + 36, W / 2 - m, 92, '#ffffff', t.plate ?? '#ffffff', 'right');
  pillTop(ctx, d, m, f.top + 52, 60, t);
  // prix dans un grand rond, à cheval sur la coupe
  const pr = priceOf(d);
  const R = sq ? 112 : 132;
  const cxp = W - m - R;
  const cyp = cut - drop + 10;
  if (pr) {
    ctx.save();
    shadowed(ctx, 30, 10, 'rgba(0,0,0,0.4)');
    ctx.beginPath();
    ctx.arc(cxp, cyp, R, 0, Math.PI * 2);
    ctx.fillStyle = t.accent;
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.arc(cxp, cyp, R - 12, 0, Math.PI * 2);
    ctx.strokeStyle = alpha('#ffffff', 0.55);
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
    boxText(ctx, 'الثمن', cxp - R * 0.7, cyp - R * 0.62, R * 1.4, R * 0.36, { color: alpha('#ffffff', 0.85), weight: 700 });
    boxText(ctx, pr, cxp - R * 0.78, cyp - R * 0.24, R * 1.56, R * 0.8, { color: t.onAccent, weight: 900 });
  }
  // vignettes en bas de la photo, à gauche
  const k = extras(p, sq ? 2 : 3);
  for (let i = 0; i < k; i++) framedPhoto(ctx, pick(p, i + 1), m + i * 180, cut - drop * 0.1 - 120 + i * -34, 164, 118, 5, '#ffffff', 14);
  const y0 = cut + drop * 0.4 + 60;
  const items = info(ctx, d, m, W - m * 2, st, sq ? 0.86 : story ? 1.2 : 1);
  items[items.length - 1] = null; // prix déjà dans le rond
  if (!pr) items[items.length - 1] = null;
  stack([...items, contactItem(ctx, m, W - m * 2, story ? 150 : 124, { bg: 'rgba(255,255,255,0.07)', color: onP, accent: t.accent, onAccent: t.onAccent })], y0, f.bot - y0 - (story ? 10 : m - 6), story ? 22 : 12);
};

// ======================================================================
// 4. Arche marocaine : fond zellige discret, photo dans une arche dorée
// ======================================================================
const arch = (): Layout => (ctx, d, p, t, f) => {
  const { W, H } = f;
  const wide = f.shape === 'wide';
  const story = f.shape === 'story';
  const sq = isSquare(f);
  fillRect(ctx, 0, 0, W, H, t.bg);
  zellige(ctx, 0, 0, W, H, alpha(t.accent, 0.11), 130);
  const gold = vGrad(ctx, 0, H, [[0, mix(t.accent, '#ffffff', 0.35)], [0.5, t.accent], [1, mix(t.accent, '#000000', 0.25)]]);
  const st: InfoStyle = {
    ink: t.ink,
    soft: t.soft,
    accent: t.accent,
    onAccent: t.onAccent,
    chipBg: alpha(t.accent, 0.12),
    chipFg: t.ink,
    chipIcon: t.accent,
    chipLine: alpha(t.accent, 0.35),
    head: 'naskh',
    align: 'center',
    priceFill: t.panel,
  };
  const archAt = (x: number, y: number, w: number, h: number) => {
    // double cadre : or + liseré
    ctx.save();
    shadowed(ctx, 40, 16, 'rgba(0,0,0,0.3)');
    const r = (w + 36) / 2;
    ctx.beginPath();
    ctx.moveTo(x - 18, y + h + 18);
    ctx.lineTo(x - 18, y - 18 + r);
    ctx.arc(x + w / 2, y - 18 + r, r, Math.PI, 0);
    ctx.lineTo(x + w + 18, y + h + 18);
    ctx.closePath();
    ctx.fillStyle = gold;
    ctx.fill();
    ctx.restore();
    archPhoto(ctx, pick(p, 0), x, y, w, h, 6, t.bg);
  };
  if (wide || sq) {
    const aw = wide ? 520 : 430;
    const ah = H - (wide ? 150 : 170);
    const ax = wide ? W - 120 - aw : W - 70 - aw;
    const ay = wide ? 90 : 100;
    archAt(ax, ay, aw, ah);
    const k = extras(p, 2);
    for (let i = 0; i < k; i++) circlePhoto(ctx, pick(p, i + 1), ax + 70 + i * 130, ay + ah - 10, wide ? 62 : 56, 7, t.bg);
    const x = wide ? 90 : 60;
    const w = ax - x - (wide ? 90 : 70);
    stack(
      [
        hasBrand() ? { h: 96, draw: (y, h) => brandBlockCenter(ctx, x, y, w, h, t) } : null,
        { h: 30, draw: (y) => ornament(ctx, x + w / 2, y + 15, Math.min(w, 300), t.accent) },
        ...info(ctx, d, x, w, { ...st, chipsN: 2 }, wide ? 0.82 : 0.72),
        contactItem(ctx, x, w, 116, { bg: alpha(t.panel, 0.06), color: t.ink, accent: t.accent, onAccent: t.onAccent }),
      ],
      56,
      H - 112,
      12
    );
    return;
  }
  const top = f.top + (story ? 40 : 46);
  let y = top;
  if (hasBrand()) {
    brandBlockCenter(ctx, 60, y, W - 120, 96, t);
    y += 120;
  }
  const aw = story ? 660 : 540;
  const ah = story ? 780 : 560;
  archAt((W - aw) / 2, y + 22, aw, ah);
  const k = extras(p, 2);
  for (let i = 0; i < k; i++) circlePhoto(ctx, pick(p, i + 1), i ? (W + aw) / 2 + 10 : (W - aw) / 2 - 10, y + 22 + ah - 60, story ? 80 : 70, 8, t.bg);
  pillCenter(ctx, dealOf(d), W / 2, y + 22 + ah - 6, 66, t);
  const y0 = y + 22 + ah + 70;
  stack(
    [...info(ctx, d, 60, W - 120, { ...st, kicker: false }, story ? 1.2 : 0.95), contactItem(ctx, 60, W - 120, story ? 150 : 120, { bg: alpha(t.panel, 0.06), color: t.ink, accent: t.accent, onAccent: t.onAccent })],
    y0,
    f.bot - y0 - (story ? 10 : 36),
    story ? 20 : 10
  );
};

function brandBlockCenter(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: Theme) {
  const a = agency();
  const name = a.name.trim();
  if (!name) {
    logo(ctx, x + w / 2, y, h, 'center', t.plate);
    return;
  }
  // logo puis nom centrés ensemble
  const size = h * 0.4;
  const tw = Math.min(textW(ctx, name, size, 900), w * 0.66);
  const img = a.logo ? h : 0;
  const total = tw + (img ? h * 1.1 + 18 : 0);
  const left = x + (w - total) / 2;
  if (img) logo(ctx, left + total, y, h, 'right', t.plate);
  boxText(ctx, name, left, y + h * 0.1, tw, a.slogan ? h * 0.5 : h * 0.8, { color: t.ink, weight: 900, align: 'right', maxSize: size });
  if (a.slogan) boxText(ctx, a.slogan, left, y + h * 0.6, tw, h * 0.3, { color: t.soft, weight: 600, align: 'right', maxSize: h * 0.24 });
}

function pillCenter(ctx: CanvasRenderingContext2D, txt: string, cx: number, y: number, h: number, t: Theme) {
  const w = textW(ctx, txt, h * 0.5, 900) + h * 1.3;
  ctx.save();
  shadowed(ctx, 18, 6, 'rgba(0,0,0,0.3)');
  fillRect(ctx, cx - w / 2, y, w, h, t.panel, h / 2);
  ctx.restore();
  boxText(ctx, txt, cx - w / 2 + h * 0.4, y + h * 0.16, w - h * 0.8, h * 0.68, { color: t.onPanel ?? '#ffffff', weight: 900, maxSize: h * 0.52 });
}

// ======================================================================
// 5. Mosaïque : 1 grande + 2 petites photos, bandeau titre, informations
// ======================================================================
const mosaic = (): Layout => (ctx, d, p, t, f) => {
  const { W, H } = f;
  const wide = f.shape === 'wide';
  const story = f.shape === 'story';
  const sq = isSquare(f);
  const g = 12;
  fillRect(ctx, 0, 0, W, H, t.bg);
  const grid = (x: number, y: number, w: number, h: number) => {
    const n = p.length ? Math.min(p.length, 3) : 3;
    if (n === 1) return photo(ctx, pick(p, 0), x, y, w, h, 22);
    const bw = n === 2 ? (w - g) / 2 : w * 0.64;
    photo(ctx, pick(p, 0), x + w - bw, y, bw, h, 22);
    if (n === 2) return photo(ctx, pick(p, 1), x, y, w - bw - g, h, 22);
    const sw = w - bw - g;
    photo(ctx, pick(p, 1), x, y, sw, (h - g) / 2, 22);
    photo(ctx, pick(p, 2), x, y + (h - g) / 2 + g, sw, (h - g) / 2, 22);
  };
  const st: InfoStyle = { ink: t.ink, soft: t.soft, accent: t.accent, onAccent: t.onAccent, chipBg: alpha(t.accent, 0.09), chipFg: t.ink, chipIcon: t.accent, priceFill: t.accent, kicker: false };
  const band = (x: number, y: number, w: number, h: number) => {
    ctx.save();
    shadowed(ctx, 24, 8, 'rgba(0,0,0,0.28)');
    fillRect(ctx, x, y, w, h, t.panel, 18);
    ctx.restore();
    fillRect(ctx, x + w - 14, y, 14, h, t.accent, 0);
    boxText(ctx, dealOf(d), x + 24, y + h * 0.18, w * 0.26, h * 0.64, { color: t.accent, weight: 900, align: 'left', maxSize: h * 0.42 });
    boxText(ctx, headlineOf(d), x + w * 0.3, y + h * 0.12, w * 0.66, h * 0.76, { color: t.onPanel ?? '#ffffff', weight: 900, align: 'right', maxSize: h * 0.5 });
  };
  if (wide) {
    const m = 44;
    const gw = 920;
    grid(m, m, gw, H - m * 2);
    const x = m + gw + 50;
    const w = W - x - m;
    stack(
      [
        hasBrand() ? { h: 92, draw: (y, h) => brandBlock(ctx, x, y, w, h, t.ink, t.plate, 'right') } : null,
        { h: 120, draw: (y, h) => band(x, y, w, h) },
        ...info(ctx, d, x, w, { ...st, chipsN: 3 }, 0.82).slice(2),
        contactItem(ctx, x, w, 116, { bg: alpha(t.ink, 0.05), color: t.ink, accent: t.accent, onAccent: t.onAccent }),
      ],
      m,
      H - m * 2,
      14
    );
    return;
  }
  const m = 40;
  const top = f.top + (story ? 30 : 34);
  let y = top;
  if (hasBrand()) {
    brandBlock(ctx, m, y, W - m * 2, 88, t.ink, t.plate, 'right');
    y += 108;
  }
  const gh = story ? 900 : sq ? 420 : 600;
  grid(m, y, W - m * 2, gh);
  band(m + 30, y + gh - 60, W - m * 2 - 60, 120);
  const y0 = y + gh + 84;
  stack(
    [...info(ctx, d, m + 10, W - m * 2 - 20, st, sq ? 0.86 : story ? 1.2 : 1).slice(2), contactItem(ctx, m, W - m * 2, story ? 150 : 124, { bg: alpha(t.ink, 0.05), color: t.ink, accent: t.accent, onAccent: t.onAccent })],
    y0,
    f.bot - y0 - (story ? 10 : 30),
    story ? 22 : 12
  );
};

// ======================================================================
// 6. Grand prix : photo plein cadre assombrie, prix géant, barre de contact
// ======================================================================
const bigPrice = (): Layout => (ctx, d, p, t, f) => {
  const { W, H } = f;
  const wide = f.shape === 'wide';
  const story = f.shape === 'story';
  const sq = isSquare(f);
  const m = wide ? 64 : 52;
  photo(ctx, pick(p, 0), 0, 0, W, H);
  fillRect(ctx, 0, 0, W, H, vGrad(ctx, 0, H, [[0, 'rgba(0,0,0,0.55)'], [0.3, 'rgba(0,0,0,0.12)'], [0.55, 'rgba(0,0,0,0.45)'], [1, 'rgba(0,0,0,0.88)']]));
  if (hasBrand()) brandBlock(ctx, wide ? W - m - 600 : W / 2, f.top + 36, wide ? 600 : W / 2 - m, 92, '#ffffff', t.plate ?? '#ffffff', 'right');
  pillTop(ctx, d, m, f.top + 52, 60, t);
  const x = wide ? W * 0.42 : m;
  const w = W - x - m;
  const pr = priceOf(d);
  const sp = specsOf(d, wide ? 3 : 4);
  const k = sq ? 0.8 : 1;
  const items: (Item | null)[] = [
    { h: 130 * k, flex: !pr, draw: (y, h) => boxText(ctx, headlineOf(d), x, y, w, h, { color: '#ffffff', weight: 900, align: 'right', maxSize: (pr ? 84 : 120) * k, shadow: true }) },
    placeOf(d) ? { h: 46 * k, draw: (y, h) => place(ctx, d, x, y, w, h, 'rgba(255,255,255,0.88)', t.accent) } : null,
    pr
      ? {
          h: 190 * k,
          draw: (y, h) => {
            boxText(ctx, 'الثمن', x, y, w, h * 0.24, { color: t.accent, weight: 800, align: 'right', maxSize: h * 0.2 });
            boxText(ctx, pr, x, y + h * 0.22, w, h * 0.76, { color: '#ffffff', weight: 900, align: 'right', shadow: true });
          },
        }
      : null,
    sp.length ? { h: 66 * k, draw: (y, h) => chips(ctx, sp, x, y, w, h, { bg: 'rgba(255,255,255,0.14)', fg: '#ffffff', icon: t.accent, line: 'rgba(255,255,255,0.22)' }) } : null,
    contactItem(ctx, x, w, story ? 150 : 128, { bg: t.accent, color: t.onAccent, accent: t.onAccent, onAccent: t.accent, label: 'اتصلوا الآن' }),
  ];
  const k3 = extras(p, 3);
  const y0 = story ? H * 0.42 : sq ? H * 0.32 : H * 0.38;
  stack(items, y0, f.bot - y0 - (story ? 10 : m - 10), story ? 24 : 14, 'bottom');
  if (wide && k3) {
    for (let i = 0; i < k3; i++) framedPhoto(ctx, pick(p, i + 1), m, f.top + 150 + i * 190, 260, 170, 6, '#ffffff', 16);
  }
};

// ======================================================================
// 7. Minimal : beaucoup de blanc, photo avec bloc de couleur décalé
// ======================================================================
const minimal = (): Layout => (ctx, d, p, t, f) => {
  const { W, H } = f;
  const wide = f.shape === 'wide';
  const story = f.shape === 'story';
  const sq = isSquare(f);
  fillRect(ctx, 0, 0, W, H, t.bg);
  const st: InfoStyle = { ink: t.ink, soft: t.soft, accent: t.accent, onAccent: t.onAccent, chipBg: mix(t.bg, t.ink, 0.06), chipFg: t.ink, chipIcon: t.accent, priceFill: null };
  const offset = (x: number, y: number, w: number, h: number) => {
    fillRect(ctx, x + 34, y + 34, w, h, t.accent, 28);
    ctx.save();
    shadowed(ctx, 40, 14, 'rgba(0,0,0,0.25)');
    fillRect(ctx, x, y, w, h, '#ffffff', 28);
    ctx.restore();
    photo(ctx, pick(p, 0), x, y, w, h, 28);
  };
  if (wide) {
    const m = 64;
    offset(m, m, 820, H - m * 2 - 34);
    const k = extras(p, 2);
    for (let i = 0; i < k; i++) framedPhoto(ctx, pick(p, i + 1), m + 820 - 230 - i * 250, H - m - 34 - 120, 210, 150, 6, '#ffffff', 16);
    const x = m + 820 + 100;
    const w = W - x - m;
    stack(
      [
        hasBrand() ? { h: 88, draw: (y, h) => brandBlock(ctx, x, y, w, h, t.ink, t.plate, 'right') } : null,
        { h: 8, draw: (y) => fillRect(ctx, x + w - 90, y, 90, 6, t.accent, 3) },
        ...info(ctx, d, x, w, { ...st, chipsN: 3 }, 0.84),
        contactItem(ctx, x, w, 118, { color: t.ink, accent: t.accent, onAccent: t.onAccent }),
      ],
      m,
      H - m * 2,
      14
    );
    return;
  }
  const m = 60;
  const top = f.top + (story ? 40 : 44);
  if (hasBrand()) brandBlock(ctx, W / 2 - 40, top, W / 2 - m + 40, 84, t.ink, t.plate, 'right');
  boxText(ctx, subOf(d).toUpperCase(), m, top + 18, W / 2 - m - 50, 44, { color: t.accent, weight: 800, align: 'left', font: 'lat', maxSize: 26 });
  const py = top + 120;
  const ph = story ? 720 : sq ? 370 : 560;
  offset(m, py, W - m * 2 - 34, ph);
  const k = extras(p, sq ? 2 : 3);
  for (let i = 0; i < k; i++) framedPhoto(ctx, pick(p, i + 1), m + 28 + i * 186, py + ph - 128, 170, 118, 5, '#ffffff', 14);
  const y0 = py + ph + 64;
  stack(
    [
      ...info(ctx, d, m, W - m * 2, { ...st, kicker: false }, sq ? 0.86 : story ? 1.25 : 1),
      { h: 4, draw: (y) => fillRect(ctx, m, y, W - m * 2, 2, alpha(t.ink, 0.12)) },
      contactItem(ctx, m, W - m * 2, story ? 150 : 120, { color: t.ink, accent: t.accent, onAccent: t.onAccent }),
      socialItem(ctx, m, W - m * 2, 44, t.soft, t.accent),
    ],
    y0,
    f.bot - y0 - (story ? 10 : 34),
    story ? 22 : 12
  );
};

// ---------- Les modèles « Signature » (affichés en premier) ----------
const T = (t: Theme) => t;
export const SIGNATURE_DESIGNS: ProDesign[] = [
  { id: 'sig-glass-red', name: '✦ زجاجي أحمر', layout: glassLayout(true), theme: T({ bg: '#111111', panel: '#121212', ink: '#ffffff', soft: '#cccccc', accent: '#e3131b', onAccent: '#ffffff', price: 'block', plate: '#ffffff' }) },
  { id: 'sig-glass-gold', name: '✦ زجاجي كحلي وذهبي', layout: glassLayout(true), theme: T({ bg: '#0f1e3d', panel: '#0f1e3d', ink: '#ffffff', soft: '#d9c9a0', accent: '#d4af5a', onAccent: '#14213d', price: 'block', plate: '#ffffff' }) },
  { id: 'sig-glass-light', name: '✦ زجاجي أبيض', layout: glassLayout(false), theme: T({ bg: '#ffffff', panel: '#ffffff', ink: '#141414', soft: '#555555', accent: '#e3131b', onAccent: '#ffffff', price: 'block', plate: '#ffffff' }) },
  { id: 'sig-mag-red', name: '✦ مجلة أحمر', layout: editorial(), theme: T({ bg: '#ffffff', panel: '#141414', ink: '#141414', soft: '#666666', accent: '#e3131b', onAccent: '#ffffff', price: 'text' }) },
  { id: 'sig-mag-cream', name: '✦ مجلة كريمي وذهبي', layout: editorial(), theme: T({ bg: '#f7f1e6', panel: '#1d2a44', ink: '#1d2a44', soft: '#7a6d55', accent: '#b8913d', onAccent: '#ffffff', price: 'text' }) },
  { id: 'sig-diag-red', name: '✦ مائل أحمر وأسود', layout: diagonal(), theme: T({ bg: '#121212', panel: '#121212', ink: '#ffffff', soft: '#cccccc', accent: '#e3131b', onAccent: '#ffffff', price: 'block', plate: '#ffffff' }) },
  { id: 'sig-diag-emerald', name: '✦ مائل زمردي وذهبي', layout: diagonal(), theme: T({ bg: '#062a24', panel: '#08332b', ink: '#ffffff', soft: '#cfe3dc', accent: '#d4af5a', onAccent: '#08332b', price: 'block', plate: '#ffffff' }) },
  { id: 'sig-arch-cream', name: '✦ قوس مغربي', layout: arch(), theme: T({ bg: '#f6efe3', panel: '#5b1a1a', ink: '#3a1d14', soft: '#7d6650', accent: '#b8913d', onAccent: '#ffffff', onPanel: '#ffffff', price: 'block', plate: '#ffffff' }) },
  { id: 'sig-arch-night', name: '✦ قوس مغربي ليلي', layout: arch(), theme: T({ bg: '#0f1e3d', panel: '#d4af5a', ink: '#ffffff', soft: '#d9c9a0', accent: '#d4af5a', onAccent: '#0f1e3d', onPanel: '#0f1e3d', price: 'block', plate: '#ffffff' }) },
  { id: 'sig-mosaic-red', name: '✦ فسيفساء أحمر', layout: mosaic(), theme: T({ bg: '#ffffff', panel: '#141414', ink: '#141414', soft: '#666666', accent: '#e3131b', onAccent: '#ffffff', price: 'block' }) },
  { id: 'sig-mosaic-blue', name: '✦ فسيفساء أزرق', layout: mosaic(), theme: T({ bg: '#f4f7fb', panel: '#0d1b2a', ink: '#0d1b2a', soft: '#5d6b7d', accent: '#0b6bcb', onAccent: '#ffffff', price: 'block' }) },
  { id: 'sig-price-red', name: '✦ ثمن كبير أحمر', layout: bigPrice(), theme: T({ bg: '#000000', panel: '#000000', ink: '#ffffff', soft: '#dddddd', accent: '#e3131b', onAccent: '#ffffff', price: 'text', plate: '#ffffff' }) },
  { id: 'sig-price-gold', name: '✦ ثمن كبير ذهبي', layout: bigPrice(), theme: T({ bg: '#000000', panel: '#000000', ink: '#ffffff', soft: '#dddddd', accent: '#d4af5a', onAccent: '#111111', price: 'text', plate: '#ffffff' }) },
  { id: 'sig-min-red', name: '✦ بسيط أبيض وأحمر', layout: minimal(), theme: T({ bg: '#ffffff', panel: '#141414', ink: '#141414', soft: '#6b6b6b', accent: '#e3131b', onAccent: '#ffffff', price: 'text' }) },
  { id: 'sig-min-sand', name: '✦ بسيط رملي', layout: minimal(), theme: T({ bg: '#f3ece1', panel: '#2f3b2a', ink: '#2f2a24', soft: '#7d7259', accent: '#c0663b', onAccent: '#ffffff', price: 'text' }) },
];
