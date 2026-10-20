// Modèles Canva du gérant, intégrés à l'application : image de fond nettoyée (textes et photos d'exemple
// effacés, logo gardé) dans public/templates/, et zones en pixels de l'image d'origine.
import type { PosterTemplate, TemplateBlock } from './posterTemplates';

type Box = [number, number, number, number]; // x, y, largeur, hauteur (pixels)
type PxBlock = Omit<TemplateBlock, 'id' | 'x' | 'y' | 'w' | 'h' | 'poly'> & { r: Box; poly?: [number, number][] };

interface ImageTemplateDef {
  id: string;
  name: string;
  src: string;
  size: [number, number];
  blocks: PxBlock[];
}

// Ligne d'atout : icône + texte (n-ième atout du bien).
const row = (item: number, icon: Box, text: Box, color: string, align: TemplateBlock['align'] = 'left'): PxBlock[] => [
  { kind: 'icon', item, r: icon, color },
  { kind: 'features', item, r: text, color, align, weight: 700 },
];
const check = (item: number, r: Box, color: string): PxBlock => ({ kind: 'features', item, r, color, align: 'left', weight: 700, prefix: '✓ ' });
const LOGO: PxBlock = { kind: 'logo', plain: true, r: [1422, 45, 170, 90] }; // logo redessiné quand une photo passe dessous

// ---------- X (1600×900) ----------
const X_TEMPLATES: ImageTemplateDef[] = [
  {
    id: 'x-1',
    name: 'X 1',
    src: '/templates/x-1.webp',
    size: [1600, 900],
    blocks: [
      { kind: 'photo', photo: 1, r: [485, 90, 542, 460], poly: [[485, 90], [1027, 90], [1027, 550], [485, 440]] },
      { kind: 'photo', photo: 2, r: [86, 90, 384, 325], poly: [[86, 90], [470, 90], [470, 415], [86, 338]] },
      { kind: 'subtitle', r: [90, 420, 420, 85], color: '#111111', align: 'left', weight: 700 },
      { kind: 'headline', r: [85, 520, 860, 210], color: '#111111', align: 'left' },
      ...row(0, [1140, 115, 90, 90], [1250, 120, 245, 80], '#111111'),
      ...row(1, [1140, 267, 90, 90], [1250, 272, 245, 80], '#111111'),
      ...row(2, [1140, 415, 90, 90], [1250, 420, 245, 80], '#111111'),
      ...row(3, [1140, 560, 90, 90], [1250, 565, 245, 80], '#111111'),
      { kind: 'price', r: [50, 790, 520, 100], color: '#ffffff', align: 'left' },
      { kind: 'address', r: [580, 790, 440, 100], color: '#ffffff', weight: 700 },
      { kind: 'phone', item: 0, r: [1040, 790, 520, 100], color: '#ffffff', align: 'right' },
    ],
  },
  {
    id: 'x-2',
    name: 'X 2',
    src: '/templates/x-2.webp',
    size: [1600, 900],
    blocks: [
      { kind: 'photo', photo: 1, r: [652, 0, 948, 497], poly: [[905, 0], [1600, 0], [1600, 497], [652, 497]] },
      LOGO,
      { kind: 'photo', photo: 2, r: [72, 90, 215, 218], rotate: -9.6, border: '#25a39a', borderW: 0.0065 },
      { kind: 'photo', photo: 3, r: [430, 73, 217, 217], rotate: 4, border: '#2f5089', borderW: 0.0065 },
      { kind: 'photo', photo: 4, r: [250, 171, 245, 244], rotate: 8, border: '#2f5089', borderW: 0.0065 },
      { kind: 'features', r: [60, 545, 400, 270], color: '#1f2d50', align: 'right', weight: 700 },
      { kind: 'headline', r: [680, 515, 890, 120], color: '#ffffff', align: 'right' },
      { kind: 'subtitle', r: [680, 640, 890, 60], color: '#dfe6f5', align: 'right', weight: 700 },
      { kind: 'price', r: [660, 748, 290, 60], color: '#ffffff' },
      { kind: 'address', r: [610, 846, 360, 48], color: '#1f2d50', align: 'left' },
      { kind: 'phone', item: 0, r: [1020, 846, 520, 48], color: '#1f2d50', align: 'left' },
    ],
  },
  {
    id: 'x-3',
    name: 'X 3',
    src: '/templates/x-3.webp',
    size: [1600, 900],
    blocks: [
      { kind: 'photo', photo: 1, r: [0, 0, 880, 604], poly: [[0, 0], [880, 0], [880, 604], [40, 532], [0, 534]] },
      { kind: 'price', r: [483, 212, 317, 128], fill: 'rgba(58,58,58,0.88)', color: '#ffffff', weight: 800 },
      { kind: 'photo', photo: 2, r: [805, 63, 177, 170], rotate: 8.5, border: '#ffffff', borderW: 0.0075 },
      { kind: 'photo', photo: 3, r: [803, 245, 177, 178], border: '#ffffff', borderW: 0.0075 },
      { kind: 'photo', photo: 4, r: [754, 402, 178, 178], rotate: 12, border: '#ffffff', borderW: 0.0075 },
      { kind: 'subtitle', r: [1100, 195, 400, 95], color: '#f0960f', align: 'right', weight: 700 },
      { kind: 'headline', r: [1040, 290, 460, 220], color: '#ffffff', align: 'right' },
      { kind: 'phone', item: 0, r: [1235, 575, 252, 52], color: '#111111' },
      { kind: 'label', text: 'المميزات', r: [88, 572, 300, 80], color: '#111111', align: 'left', weight: 900 },
      check(0, [90, 672, 300, 38], '#111111'),
      check(1, [90, 711, 300, 38], '#111111'),
      check(2, [90, 750, 300, 38], '#111111'),
      check(3, [405, 672, 300, 38], '#111111'),
      check(4, [405, 711, 300, 38], '#111111'),
      check(5, [405, 750, 300, 38], '#111111'),
      { kind: 'address', r: [90, 800, 600, 50], color: '#111111', align: 'left', weight: 700 },
    ],
  },
  {
    id: 'x-4',
    name: 'X 4',
    src: '/templates/x-4.webp',
    size: [1600, 900],
    blocks: [
      { kind: 'photo', photo: 1, r: [0, 345, 715, 555], shape: 'rect' },
      { kind: 'photo', photo: 5, r: [0, 0, 715, 345], shape: 'rect' },
      { kind: 'label', text: '', r: [0, 0, 715, 345], fill: 'rgba(255,255,255,0.72)', shape: 'rect' },
      { kind: 'headline', r: [40, 50, 640, 180], color: '#2b1a10', align: 'left' },
      { kind: 'subtitle', r: [40, 235, 640, 70], color: '#5a4638', align: 'left', weight: 700 },
      { kind: 'photo', photo: 2, r: [715, 0, 442, 450], shape: 'rect' },
      { kind: 'photo', photo: 3, r: [1157, 0, 443, 450], shape: 'rect' },
      { kind: 'photo', photo: 4, r: [1157, 450, 443, 450], shape: 'rect' },
      LOGO,
      ...row(0, [745, 490, 55, 55], [830, 490, 310, 55], '#ffffff'),
      ...row(1, [745, 560, 55, 55], [830, 560, 310, 55], '#ffffff'),
      ...row(2, [745, 630, 55, 55], [830, 630, 310, 55], '#ffffff'),
      { kind: 'price', r: [730, 728, 350, 100], color: '#ffffff', align: 'left' },
      { kind: 'phone', item: 0, r: [730, 848, 410, 46], color: '#f3e9df', align: 'left', weight: 700 },
    ],
  },
  {
    id: 'x-5',
    name: 'X 5',
    src: '/templates/x-5.webp',
    size: [1600, 900],
    blocks: [
      { kind: 'headline', r: [25, 25, 280, 100], color: '#111111', align: 'left' },
      { kind: 'photo', photo: 1, r: [314, 73, 557, 363], shape: 'rect' },
      { kind: 'photo', photo: 2, r: [885, 13, 655, 437], shape: 'rect' },
      { kind: 'photo', photo: 3, r: [66, 468, 556, 362], shape: 'rect' },
      LOGO,
      { kind: 'price', r: [660, 480, 505, 118], color: '#ffffff' },
      { kind: 'phone', r: [1215, 478, 315, 122], color: '#0b3a63' },
      { kind: 'address', r: [1250, 662, 243, 52], color: '#0b3a63' },
      { kind: 'subtitle', r: [1215, 722, 315, 100], color: '#ffffff', weight: 700 },
      { kind: 'label', text: 'المميزات :', r: [641, 628, 300, 46], color: '#111111', align: 'left', weight: 900 },
      check(0, [645, 680, 255, 38], '#0b3a63'),
      check(1, [645, 720, 255, 38], '#0b3a63'),
      check(2, [645, 760, 255, 38], '#0b3a63'),
      check(3, [645, 800, 255, 38], '#0b3a63'),
      check(4, [910, 680, 280, 38], '#0b3a63'),
      check(5, [910, 720, 280, 38], '#0b3a63'),
      check(6, [910, 760, 280, 38], '#0b3a63'),
      check(7, [910, 800, 280, 38], '#0b3a63'),
    ],
  },
];

export const IMAGE_TEMPLATES: ImageTemplateDef[] = [...X_TEMPLATES];

function toBlocks(def: ImageTemplateDef): TemplateBlock[] {
  const [W, H] = def.size;
  return def.blocks.map(({ r, poly, ...b }, i) => ({
    ...b,
    id: `${def.id}-${i}`,
    x: r[0] / W,
    y: r[1] / H,
    w: r[2] / W,
    h: r[3] / H,
    poly: poly?.map(([x, y]) => [x / W, y / H] as [number, number]),
  }));
}

let loaded: Promise<PosterTemplate[]> | null = null;

// Images de fond chargées une seule fois ; un modèle dont l'image manque est ignoré.
export function loadImageTemplates(): Promise<PosterTemplate[]> {
  loaded ||= Promise.all(
    IMAGE_TEMPLATES.map(
      (def) =>
        new Promise<PosterTemplate | null>((resolve) => {
          const img = new Image();
          img.onload = () => resolve({ kind: 'image', id: def.id, name: def.name, size: def.size, blocks: toBlocks(def), bgImg: img });
          img.onerror = () => resolve(null);
          img.src = def.src;
        })
    )
  ).then((list) => list.filter((t): t is PosterTemplate => !!t));
  return loaded;
}
