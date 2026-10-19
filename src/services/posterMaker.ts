// Affiche publicitaire Al Wassit 777 dessinée dans le navigateur (canvas), sans service payant.
// Une seule maquette qui s'adapte à chaque format de plateforme : portrait (4:5), story (9:16),
// carré, paysage (16:9, 4:3). Chaque information a sa place : photos, type, quartier, surface,
// chambres, salles de bain, atouts, prix, téléphones.
import { ListingType, PropertyType } from '../types';
import { agencyProfile as A } from '../data/agencyProfile';

export interface PosterData {
  deal: ListingType;
  type: PropertyType | '';
  city: string;
  district: string;
  surface: number;
  bedrooms: number;
  bathrooms: number;
  price: string;
  features: string[];
}

const DARK = '#281715';
const DARK2 = '#4a2a26';
const CORAL = '#ff6f61';
const SOFT = '#ffd8d2';
const AR = 'Tajawal, sans-serif';
const LAT = 'Inter, Tajawal, sans-serif';

export const TYPE_LABELS: Record<PropertyType, { ar: string; fr: string }> = {
  Appartement: { ar: 'شقة', fr: 'Appartement' },
  Villa: { ar: 'فيلا', fr: 'Villa' },
  Maison: { ar: 'منزل', fr: 'Maison' },
  Terrain: { ar: 'بقعة أرضية', fr: 'Terrain' },
  'Local Commercial': { ar: 'محل تجاري', fr: 'Local commercial' },
  Bureau: { ar: 'مكتب', fr: 'Bureau' },
  Immeuble: { ar: 'عمارة', fr: 'Immeuble' },
  Riad: { ar: 'رياض', fr: 'Riad' },
  Ferme: { ar: 'ضيعة فلاحية', fr: 'Ferme' },
};

export const DEAL_LABELS: Record<ListingType, { ar: string; fr: string }> = {
  vente: { ar: 'للبيع', fr: 'À VENDRE' },
  location: { ar: 'للكراء', fr: 'À LOUER' },
  neuf: { ar: 'مشروع جديد', fr: 'PROJET NEUF' },
};

let fontsReady: Promise<unknown> | null = null;
export function ensureFonts(): Promise<unknown> {
  fontsReady ||= Promise.all(
    ['500 40px Tajawal', '800 40px Tajawal', '900 40px Tajawal', '700 40px Inter', '800 40px Inter'].map((f) =>
      document.fonts?.load(f).catch(() => null)
    )
  );
  return fontsReady;
}

// ---------- Outils de dessin ----------
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function cover(ctx: CanvasRenderingContext2D, img: CanvasImageSource & { width: number; height: number }, x: number, y: number, w: number, h: number, r: number) {
  ctx.save();
  rr(ctx, x, y, w, h, r);
  ctx.clip();
  const s = Math.max(w / img.width, h / img.height);
  ctx.drawImage(img, x + (w - img.width * s) / 2, y + (h - img.height * s) / 2, img.width * s, img.height * s);
  ctx.restore();
}

function placeholder(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, u: number) {
  ctx.save();
  rr(ctx, x, y, w, h, r);
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, DARK2);
  g.addColorStop(1, '#6b3a34');
  ctx.fillStyle = g;
  ctx.fill();
  // Maison stylisée
  const cx = x + w / 2;
  const cy = y + h / 2;
  const s = Math.min(w, h) * 0.18;
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 8 * u;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - s, cy);
  ctx.lineTo(cx, cy - s * 0.9);
  ctx.lineTo(cx + s, cy);
  ctx.moveTo(cx - s * 0.72, cy - s * 0.15);
  ctx.lineTo(cx - s * 0.72, cy + s * 0.85);
  ctx.lineTo(cx + s * 0.72, cy + s * 0.85);
  ctx.lineTo(cx + s * 0.72, cy - s * 0.15);
  ctx.stroke();
  ctx.restore();
}

// Réduit la police jusqu'à ce que le texte tienne dans la largeur.
function fitFont(ctx: CanvasRenderingContext2D, text: string, weight: number, size: number, family: string, maxW: number, min = size * 0.6): number {
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

type Icon = 'pin' | 'area' | 'bed' | 'bath' | 'check' | 'phone';

function icon(ctx: CanvasRenderingContext2D, kind: Icon, cx: number, cy: number, s: number, color: string) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(2, s * 0.12);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const h = s / 2;
  ctx.beginPath();
  switch (kind) {
    case 'pin':
      ctx.arc(cx, cy - h * 0.25, h * 0.55, Math.PI * 0.85, Math.PI * 0.15);
      ctx.lineTo(cx, cy + h);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = DARK;
      ctx.arc(cx, cy - h * 0.25, h * 0.22, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'area':
      ctx.rect(cx - h * 0.8, cy - h * 0.8, h * 1.6, h * 1.6);
      ctx.moveTo(cx - h * 0.35, cy + h * 0.35);
      ctx.lineTo(cx + h * 0.35, cy - h * 0.35);
      ctx.moveTo(cx + h * 0.05, cy - h * 0.35);
      ctx.lineTo(cx + h * 0.35, cy - h * 0.35);
      ctx.lineTo(cx + h * 0.35, cy - h * 0.05);
      ctx.stroke();
      break;
    case 'bed':
      ctx.moveTo(cx - h * 0.9, cy - h * 0.6);
      ctx.lineTo(cx - h * 0.9, cy + h * 0.7);
      ctx.moveTo(cx - h * 0.9, cy + h * 0.3);
      ctx.lineTo(cx + h * 0.9, cy + h * 0.3);
      ctx.lineTo(cx + h * 0.9, cy + h * 0.7);
      ctx.moveTo(cx - h * 0.9, cy);
      ctx.lineTo(cx + h * 0.9, cy);
      ctx.lineTo(cx + h * 0.9, cy + h * 0.3);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx - h * 0.45, cy - h * 0.25, h * 0.2, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'bath':
      ctx.moveTo(cx - h * 0.9, cy);
      ctx.lineTo(cx + h * 0.9, cy);
      ctx.lineTo(cx + h * 0.7, cy + h * 0.6);
      ctx.lineTo(cx - h * 0.7, cy + h * 0.6);
      ctx.closePath();
      ctx.moveTo(cx - h * 0.6, cy);
      ctx.lineTo(cx - h * 0.6, cy - h * 0.75);
      ctx.lineTo(cx - h * 0.25, cy - h * 0.75);
      ctx.stroke();
      break;
    case 'check':
      ctx.moveTo(cx - h * 0.6, cy);
      ctx.lineTo(cx - h * 0.15, cy + h * 0.45);
      ctx.lineTo(cx + h * 0.65, cy - h * 0.45);
      ctx.stroke();
      break;
    case 'phone':
      ctx.font = `${s}px ${LAT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('☎', cx, cy);
      break;
  }
  ctx.restore();
}

// Logo : « الوسيط » + pastille corail « 777 », aligné à droite (sens arabe).
function logo(ctx: CanvasRenderingContext2D, right: number, top: number, hgt: number) {
  const u = hgt / 92;
  ctx.save();
  ctx.font = `800 ${44 * u}px ${AR}`;
  const tw = ctx.measureText('الوسيط').width;
  const badgeW = 120 * u;
  const w = tw + badgeW + 64 * u;
  rr(ctx, right - w, top, w, hgt, 24 * u);
  ctx.fillStyle = '#fff';
  ctx.fill();
  rr(ctx, right - w + 14 * u, top + 14 * u, badgeW, hgt - 28 * u, 14 * u);
  ctx.fillStyle = CORAL;
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${40 * u}px ${LAT}`;
  ctx.fillText('777', right - w + 14 * u + badgeW / 2, top + hgt / 2 + 2 * u);
  ctx.fillStyle = DARK;
  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.font = `800 ${44 * u}px ${AR}`;
  ctx.fillText('الوسيط', right - 24 * u, top + hgt / 2 + 4 * u);
  ctx.restore();
  return w;
}

function dealBadge(ctx: CanvasRenderingContext2D, d: PosterData, left: number, top: number, hgt: number) {
  const u = hgt / 92;
  const deal = DEAL_LABELS[d.deal];
  ctx.save();
  ctx.font = `900 ${42 * u}px ${AR}`;
  const arW = ctx.measureText(deal.ar).width;
  ctx.font = `800 ${24 * u}px ${LAT}`;
  const frW = ctx.measureText(deal.fr).width;
  const w = arW + frW + 90 * u;
  rr(ctx, left, top, w, hgt, hgt / 2);
  ctx.fillStyle = CORAL;
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(deal.fr, left + 32 * u, top + hgt / 2 + 2 * u);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillRect(left + 32 * u + frW + 14 * u, top + hgt * 0.28, 2 * u, hgt * 0.44);
  ctx.fillStyle = '#fff';
  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.font = `900 ${42 * u}px ${AR}`;
  ctx.fillText(deal.ar, left + w - 30 * u, top + hgt / 2 + 4 * u);
  ctx.restore();
}

function pricePill(ctx: CanvasRenderingContext2D, d: PosterData, right: number, bottom: number, u: number, maxW: number) {
  const text = formatPrice(d.price) || 'الثمن عند الطلب';
  ctx.save();
  const size = fitFont(ctx, text, 900, 58 * u, hasArabic(text) ? AR : LAT, maxW - 80 * u, 30 * u);
  const w = ctx.measureText(text).width + 80 * u;
  const h = size + 46 * u;
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 24 * u;
  rr(ctx, right - w, bottom - h, w, h, h / 2);
  ctx.fillStyle = CORAL;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.direction = hasArabic(text) ? 'rtl' : 'ltr';
  ctx.fillText(text, right - w / 2, bottom - h / 2 + 3 * u);
  ctx.restore();
  return h;
}

function thumbs(ctx: CanvasRenderingContext2D, photos: HTMLImageElement[], left: number, top: number, size: number, u: number) {
  photos.forEach((img, i) => {
    const x = left + i * (size + 14 * u);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 18 * u;
    rr(ctx, x - 6 * u, top - 6 * u, size + 12 * u, size + 12 * u, 26 * u);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.restore();
    cover(ctx, img, x, top, size, size, 20 * u);
  });
}

// Bloc d'informations (titre, quartier, caractéristiques, atouts), aligné à droite. Renvoie la hauteur utilisée.
function infoBlock(ctx: CanvasRenderingContext2D, d: PosterData, right: number, top: number, width: number, u: number, compact = false): number {
  const type = d.type ? TYPE_LABELS[d.type] : { ar: 'عقار', fr: 'Bien immobilier' };
  const deal = DEAL_LABELS[d.deal];
  let y = top;
  ctx.save();
  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  // Titre arabe
  const title = `${type.ar} ${deal.ar}${d.district ? ` في ${d.district}` : ''}`;
  const ts = fitFont(ctx, title, 900, (compact ? 58 : 66) * u, AR, width, 34 * u);
  y += ts;
  ctx.fillStyle = '#fff';
  ctx.fillText(title, right, y);
  // Sous-titre français
  y += 46 * u;
  const fr = `${type.fr} ${deal.fr.toLowerCase()}${d.city && !hasArabic(d.city) ? ` · ${d.city}` : ''}`;
  ctx.direction = 'ltr';
  fitFont(ctx, fr, 600, 30 * u, LAT, width, 20 * u);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText(fr, right, y);
  ctx.direction = 'rtl';
  // Localisation
  if (d.district || d.city) {
    y += 56 * u;
    const loc = [d.district, d.city].filter(Boolean).join('، ');
    icon(ctx, 'pin', right - 16 * u, y - 13 * u, 34 * u, CORAL);
    fitFont(ctx, loc, 700, 36 * u, AR, width - 50 * u, 22 * u);
    ctx.fillStyle = SOFT;
    ctx.fillText(loc, right - 46 * u, y);
  }
  // Puces : surface, chambres, salles de bain
  const chips: [Icon, string][] = [];
  if (d.surface) chips.push(['area', `${d.surface} م²`]);
  if (d.bedrooms) chips.push(['bed', `${d.bedrooms} غرف`]);
  if (d.bathrooms) chips.push(['bath', `${d.bathrooms} حمام`]);
  if (chips.length) {
    y += 34 * u;
    const ch = 68 * u;
    let x = right;
    ctx.font = `800 ${32 * u}px ${AR}`;
    for (const [ic, label] of chips) {
      const cw = ctx.measureText(label).width + 100 * u;
      if (x - cw < right - width) {
        // Pas assez de place : ligne suivante
        x = right;
        y += ch + 12 * u;
      }
      rr(ctx, x - cw, y, cw, ch, 20 * u);
      ctx.fillStyle = 'rgba(255,255,255,0.09)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.lineWidth = 2 * u;
      ctx.stroke();
      icon(ctx, ic, x - 36 * u, y + ch / 2, 34 * u, CORAL);
      ctx.fillStyle = '#fff';
      ctx.fillText(label, x - 66 * u, y + ch / 2 + 11 * u);
      x -= cw + 14 * u;
    }
    y += ch;
  }
  // Atouts
  if (d.features.length) {
    y += 52 * u;
    let x = right;
    ctx.font = `700 ${30 * u}px ${AR}`;
    let rows = 1;
    for (const f of d.features.slice(0, 6)) {
      const fw = ctx.measureText(f).width + 52 * u;
      if (x - fw < right - width) {
        if (++rows > 2) break;
        x = right;
        y += 46 * u;
      }
      icon(ctx, 'check', x - 14 * u, y - 10 * u, 28 * u, CORAL);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText(f, x - 38 * u, y);
      x -= fw + 18 * u;
    }
    y += 12 * u;
  }
  ctx.restore();
  return y - top;
}

// Bandeau de contact corail : téléphones + devise.
function contactBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, u: number) {
  ctx.save();
  ctx.fillStyle = CORAL;
  ctx.fillRect(x, y, w, h);
  ctx.textBaseline = 'middle';
  const phones = A.phonesLocal.join('  |  ');
  ctx.font = `800 ${38 * u}px ${LAT}`;
  const pw = ctx.measureText(phones).width;
  ctx.font = `700 ${30 * u}px ${AR}`;
  const sw = ctx.measureText(A.sloganAr).width;
  const twoLines = pw + sw + 140 * u > w;
  ctx.fillStyle = '#fff';
  if (twoLines) {
    fitFont(ctx, phones, 800, 38 * u, LAT, w - 110 * u, 20 * u);
    const fw = ctx.measureText(phones).width;
    icon(ctx, 'phone', x + w / 2 - fw / 2 - 12 * u, y + h * 0.36, 30 * u, '#fff');
    ctx.textAlign = 'center';
    ctx.fillText(phones, x + w / 2 + 18 * u, y + h * 0.36);
    ctx.direction = 'rtl';
    ctx.font = `700 ${28 * u}px ${AR}`;
    ctx.fillText(`${A.nameAr} · ${A.sloganAr}`, x + w / 2, y + h * 0.74, w - 40 * u);
  } else {
    ctx.textAlign = 'left';
    icon(ctx, 'phone', x + 52 * u, y + h / 2, 34 * u, '#fff');
    ctx.font = `800 ${38 * u}px ${LAT}`;
    ctx.fillText(phones, x + 84 * u, y + h / 2 + 2 * u);
    ctx.direction = 'rtl';
    ctx.textAlign = 'right';
    ctx.font = `700 ${30 * u}px ${AR}`;
    ctx.fillText(A.sloganAr, x + w - 40 * u, y + h / 2 + 4 * u);
  }
  ctx.restore();
}

function background(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, DARK);
  g.addColorStop(1, '#3a201d');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // Halo corail discret
  const r = ctx.createRadialGradient(w, 0, 0, w, 0, Math.max(w, h) * 0.7);
  r.addColorStop(0, 'rgba(255,111,97,0.22)');
  r.addColorStop(1, 'rgba(255,111,97,0)');
  ctx.fillStyle = r;
  ctx.fillRect(0, 0, w, h);
}

// ---------- Maquettes ----------
function drawVertical(ctx: CanvasRenderingContext2D, d: PosterData, photos: HTMLImageElement[], w: number, h: number) {
  const u = Math.min(w, h) / 1080;
  const story = h / w > 1.6;
  const P = 44 * u;
  const safeTop = story ? 150 * u : 0; // zones masquées par l'interface TikTok / Stories
  const safeBottom = story ? 230 * u : 0;
  background(ctx, w, h);
  const headH = 92 * u;
  let y = P + safeTop;
  logo(ctx, w - P, y, headH);
  dealBadge(ctx, d, P, y, headH);
  y += headH + 28 * u;

  const barH = 118 * u;
  const infoH = 290 * u + (d.features.length ? 64 * u : 0);
  const tSize = photos.length > 1 ? Math.min(170 * u, (w - 2 * P) * 0.19) : 0;
  const photoH = Math.max(200 * u, h - safeBottom - barH - infoH - y - tSize * 0.5 - 40 * u);
  const photoW = w - 2 * P;
  if (photos[0]) cover(ctx, photos[0], P, y, photoW, photoH, 36 * u);
  else placeholder(ctx, P, y, photoW, photoH, 36 * u, u);
  // Prix posé sur la photo, en bas à droite
  pricePill(ctx, d, w - P - 24 * u, y + photoH - 24 * u - (tSize ? tSize * 0.5 : 0), u, photoW * 0.6);
  if (tSize) thumbs(ctx, photos.slice(1, 4), P + 24 * u, y + photoH - tSize * 0.5, tSize, u);
  y += photoH + tSize * 0.5 + 34 * u;

  infoBlock(ctx, d, w - P, y, w - 2 * P, u);

  const barY = h - safeBottom - barH;
  contactBar(ctx, 0, barY, w, barH, u);
  if (story) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = `600 ${28 * u}px ${LAT}`;
    ctx.textAlign = 'center';
    ctx.fillText('al-wasset-777.vercel.app', w / 2, barY + barH + 60 * u);
    ctx.restore();
  }
}

function drawHorizontal(ctx: CanvasRenderingContext2D, d: PosterData, photos: HTMLImageElement[], w: number, h: number) {
  const u = Math.min((h / 1080) * 1.55, w / 1200); // formats paysage plus bas : textes un peu plus grands
  background(ctx, w, h);
  const photoW = Math.round(w * 0.56);
  if (photos[0]) cover(ctx, photos[0], 0, 0, photoW, h, 0);
  else placeholder(ctx, 0, 0, photoW, h, 0, u);
  // Fondu entre la photo et le panneau
  const fade = ctx.createLinearGradient(photoW - 120 * u, 0, photoW, 0);
  fade.addColorStop(0, 'rgba(40,23,21,0)');
  fade.addColorStop(1, 'rgba(40,23,21,1)');
  ctx.fillStyle = fade;
  ctx.fillRect(photoW - 120 * u, 0, 120 * u, h);
  const P = 30 * u;
  dealBadge(ctx, d, P, P, 70 * u);
  const tSize = photos.length > 1 ? Math.min(130 * u, h * 0.22) : 0;
  if (tSize) thumbs(ctx, photos.slice(1, 4), P, h - P - tSize, tSize, u);

  const right = w - P;
  const panelW = w - photoW - P;
  logo(ctx, right, P, 70 * u);
  const barH = 92 * u;
  const infoTop = P + 70 * u + 30 * u;
  const priceTop = h - barH - 26 * u - (58 * 0.95 + 46) * u;
  // Le bloc d'informations rétrécit jusqu'à laisser la place au prix (mesure sur un canvas de brouillon).
  const scratch = document.createElement('canvas').getContext('2d')!;
  let k = 0.9;
  while (k > 0.55 && infoTop + infoBlock(scratch, d, right, infoTop, panelW - 10 * u, u * k, true) > priceTop - 20 * u) k -= 0.05;
  infoBlock(ctx, d, right, infoTop, panelW - 10 * u, u * k, true);
  pricePill(ctx, d, right, h - barH - 26 * u, u * 0.95, panelW);
  contactBar(ctx, photoW, h - barH, w - photoW, barH, u * 0.8);
}

export function drawPoster(canvas: HTMLCanvasElement, d: PosterData, photos: HTMLImageElement[], w: number, h: number) {
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);
  if (w / h > 1.15) drawHorizontal(ctx, d, photos, w, h);
  else drawVertical(ctx, d, photos, w, h);
}

export async function posterBlob(d: PosterData, photos: HTMLImageElement[], w: number, h: number): Promise<Blob> {
  await ensureFonts();
  const canvas = document.createElement('canvas');
  drawPoster(canvas, d, photos, w, h);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Export image impossible'))), 'image/jpeg', 0.92)
  );
}

// YouTube n'accepte que la vidéo : l'affiche devient un court Short de quelques secondes (zoom lent).
export async function posterVideo(d: PosterData, photos: HTMLImageElement[], w: number, h: number, seconds = 8): Promise<Blob> {
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
      ctx.fillStyle = DARK;
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
