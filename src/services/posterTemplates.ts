// Modèles d'affiches du « صانع الإعلانات » :
// - 25 modèles professionnels (proTemplates.ts), dessinés à la taille de chaque plateforme ;
// - les modèles ajoutés par l'utilisateur : une image de fond + des zones (photos, titre, prix…) placées à la main.
// Toutes les informations de l'agence (logo, nom, téléphones, QR WhatsApp) viennent des paramètres (agencySettings.ts).
import { agencyLogo, agencyPhones } from './agencySettings';
import { Img, PosterData, coverInPath, coverRect, drawIcon, ensureFonts, headlineOf, posterVideoFrom, rr } from './posterMaker';
import { allSpecs, boxText, phonesLine, pick, placeOf, priceOf, qrBox, subOf } from './posterKit';
import { PRO_DESIGNS, ProDesign, drawPro } from './proTemplates';

// ---------- Modèles ajoutés par l'utilisateur ----------
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
  rotate?: number; // photo tournée (degrés, autour de son centre)
  poly?: [number, number][]; // photo découpée en polygone (fractions de l'image)
  border?: string; // cadre autour de la photo
  borderW?: number; // épaisseur du cadre (fraction de la largeur de l'image)
  item?: number; // « features » / « icon » : n-ième atout ; « phone » : n-ième numéro (-1 = tous sur une ligne)
  prefix?: string; // texte avant l'atout (ex. « ✓ »)
  text?: string; // « label » : texte fixe
  weight?: number;
  font?: 'ar' | 'serif';
  plain?: boolean; // ancien réglage du logo (sans effet)
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
export type PosterTemplate =
  | { kind: 'pro'; id: string; name: string; design: ProDesign } // adaptable : dessiné à la taille de chaque plateforme
  | { kind: 'custom'; id: string; name: string; tpl: CustomTemplate; bgImg: Img };

export const BUILTIN_TEMPLATES: PosterTemplate[] = PRO_DESIGNS.map((design) => ({ kind: 'pro', id: design.id, name: design.name, design }));
export const DEFAULT_TEMPLATE: PosterTemplate = BUILTIN_TEMPLATES[0];

// Le modèle convient-il au format de la plateforme ? (modèles pro : toujours)
export function fitsAspect(t: PosterTemplate, aspect: number): boolean {
  if (t.kind === 'pro') return true;
  const [w, h] = nativeSize(t);
  return Math.abs(w / h - aspect) / aspect < 0.04;
}

// ---------- Rendu d'un modèle de l'utilisateur ----------
function blockText(b: TemplateBlock, d: PosterData): string {
  switch (b.kind) {
    case 'headline':
      return headlineOf(d);
    case 'subtitle':
      return subOf(d);
    case 'price':
      return priceOf(d) || 'فرصة مميزة';
    case 'address':
      return placeOf(d);
    case 'specs':
      return allSpecs(d, 3).map((s) => s.text).join(' • ');
    case 'features': {
      if (b.item === undefined) return (d.features.length ? d.features : allSpecs(d).map((s) => s.text)).slice(0, 4).join('\n');
      const it = allSpecs(d, 12)[b.item];
      return it ? `${b.prefix ?? ''}${it.text}` : '';
    }
    case 'label':
      return b.text ?? '';
    case 'phone':
      return b.item === -1 ? phonesLine() : b.item !== undefined ? agencyPhones()[b.item] ?? '' : agencyPhones().join('\n');
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
      const it = allSpecs(d, 12)[b.item ?? 0];
      if (it) drawIcon(ctx, it.icon, x + w / 2, y + h / 2, Math.min(w, h) * 0.8, b.color || '#ffffff', 1.8);
      continue;
    }
    if (b.kind === 'logo') {
      const m = agencyLogo();
      if (m) {
        const s = Math.min(w / m.width, h / m.height);
        ctx.drawImage(m, x + (w - m.width * s) / 2, y + (h - m.height * s) / 2, m.width * s, m.height * s);
      }
      continue;
    }
    if (b.kind === 'qr') {
      const s = Math.min(w, h);
      qrBox(ctx, x + (w - s) / 2, y + (h - s) / 2, s);
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
  return [1080, 1350];
}

// Affiche à la taille demandée (taille d'une plateforme). Les modèles pro s'adaptent à chaque format ;
// ceux de l'utilisateur sont centrés sur un fond blanc.
export function renderPoster(canvas: HTMLCanvasElement, d: PosterData, p: Img[], w: number, h: number, t: PosterTemplate) {
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  if (t.kind === 'pro') {
    drawPro(ctx, t.design, d, p, w, h);
    return;
  }
  const [W, H] = nativeSize(t);
  const s = Math.min(w / W, h / H);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.translate((w - W * s) / 2, (h - H * s) / 2);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.clip();
  ctx.drawImage(t.bgImg, 0, 0, W, H);
  drawCustomBlocks(ctx, t.tpl.blocks, d, p, W, H);
  ctx.restore();
}

// Aperçu (vignettes) : modèles pro au format de la plateforme, modèles de l'utilisateur à leur format d'origine.
export function renderPreview(canvas: HTMLCanvasElement, d: PosterData, p: Img[], t: PosterTemplate, width: number, aspect?: number) {
  const [W, H] = nativeSize(t);
  const a = t.kind === 'pro' ? aspect ?? W / H : W / H;
  renderPoster(canvas, d, p, width, Math.round(width / a), t);
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
