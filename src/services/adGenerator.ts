// Moteur de rédaction des publicités dans le style de M. Mounir Radoui.
// Fonctionne sans connexion (modèles) ; l'IA (Gemini via /api/ads/generate) l'enrichit quand elle est disponible.
import { AdDraft, AdLanguage, AdPlatform, Property } from '../types';
import { agencyProfile as A } from '../data/agencyProfile';

export interface PlatformSpec {
  id: AdPlatform;
  label: string;
  maxChars: number;
  maxHashtags: number;
  format: 'square' | 'vertical' | 'landscape';
  kind: 'social' | 'message' | 'portal';
  bestTimes: string[]; // HH:MM, heure du Maroc
  color: string;
}

export const PLATFORMS: PlatformSpec[] = [
  { id: 'facebook', label: 'Facebook', maxChars: 5000, maxHashtags: 8, format: 'square', kind: 'social', bestTimes: ['13:00', '20:30'], color: '#1877f2' },
  { id: 'instagram', label: 'Instagram', maxChars: 2200, maxHashtags: 15, format: 'square', kind: 'social', bestTimes: ['12:30', '21:00'], color: '#e1306c' },
  { id: 'tiktok', label: 'TikTok', maxChars: 2200, maxHashtags: 5, format: 'vertical', kind: 'social', bestTimes: ['19:00', '22:00'], color: '#111111' },
  { id: 'whatsapp', label: 'WhatsApp', maxChars: 4000, maxHashtags: 0, format: 'vertical', kind: 'message', bestTimes: ['10:00', '18:30'], color: '#25d366' },
  { id: 'snapchat', label: 'Snapchat', maxChars: 250, maxHashtags: 2, format: 'vertical', kind: 'social', bestTimes: ['21:30'], color: '#e6c200' },
  { id: 'x', label: 'X', maxChars: 280, maxHashtags: 2, format: 'landscape', kind: 'social', bestTimes: ['12:00'], color: '#000000' },
  { id: 'linkedin', label: 'LinkedIn', maxChars: 3000, maxHashtags: 4, format: 'landscape', kind: 'social', bestTimes: ['09:00'], color: '#0a66c2' },
  { id: 'threads', label: 'Threads', maxChars: 500, maxHashtags: 3, format: 'square', kind: 'social', bestTimes: ['20:00'], color: '#333333' },
  { id: 'upscrolled', label: 'UpScrolled', maxChars: 500, maxHashtags: 4, format: 'square', kind: 'social', bestTimes: ['19:30'], color: '#7c3aed' },
  { id: 'avito', label: 'Avito', maxChars: 4000, maxHashtags: 0, format: 'landscape', kind: 'portal', bestTimes: ['09:30'], color: '#0074d9' },
  { id: 'mubawab', label: 'Mubawab', maxChars: 4000, maxHashtags: 0, format: 'landscape', kind: 'portal', bestTimes: ['09:30'], color: '#e4002b' },
  { id: 'sarouty', label: 'Sarouty', maxChars: 4000, maxHashtags: 0, format: 'landscape', kind: 'portal', bestTimes: ['09:30'], color: '#00a19a' },
];

export const platformSpec = (id: AdPlatform) => PLATFORMS.find((p) => p.id === id)!;

export const AD_LANGUAGES: { id: AdLanguage; label: string }[] = [
  { id: 'ar', label: 'العربية' },
  { id: 'darija', label: 'الدارجة' },
  { id: 'fr', label: 'Français' },
];

const TYPE_AR: Record<string, string> = {
  Appartement: 'شقة', Villa: 'فيلا', Maison: 'منزل', Terrain: 'أرض', 'Local Commercial': 'محل تجاري',
  Bureau: 'مكتب', Immeuble: 'عمارة', Riad: 'رياض', Ferme: 'ضيعة',
};
const TYPE_DARIJA: Record<string, string> = {
  Appartement: 'شقة', Villa: 'فيلا', Maison: 'دار', Terrain: 'بقعة أرضية', 'Local Commercial': 'محل تجاري',
  Bureau: 'مكتب', Immeuble: 'عمارة', Riad: 'رياض', Ferme: 'فيرمة',
};

function amenities(p: Property, lang: AdLanguage): string[] {
  const list: [boolean | undefined, string, string, string][] = [
    [p.hasElevator, 'مصعد', 'سانسور', 'Ascenseur'],
    [p.hasParking, 'موقف سيارات', 'باركينغ', 'Parking'],
    [p.hasGarage, 'مرآب', 'كاراج', 'Garage'],
    [p.hasPool, 'مسبح', 'بيسين', 'Piscine'],
    [p.hasGarden, 'حديقة', 'جردة', 'Jardin'],
    [p.isFurnished, 'مفروشة', 'مفروشة', 'Meublé'],
  ];
  const idx = lang === 'ar' ? 1 : lang === 'darija' ? 2 : 3;
  return list.filter((a) => a[0]).map((a) => a[idx] as string);
}

function dealAr(p: Property, lang: AdLanguage): string {
  if (p.listingType === 'location') return lang === 'darija' ? 'للكرا' : 'للكراء';
  if (p.listingType === 'neuf') return lang === 'darija' ? 'مشروع جديد' : 'مشروع جديد للبيع';
  return lang === 'darija' ? 'للبيع' : 'للبيع';
}

function dealFr(p: Property): string {
  return p.listingType === 'location' ? 'à louer' : p.listingType === 'neuf' ? 'neuf à vendre' : 'à vendre';
}

const slug = (s: string) => s.replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_|_$/g, '');

export function buildHashtags(p: Property, platform: AdPlatform, lang: AdLanguage): string[] {
  const spec = platformSpec(platform);
  if (spec.maxHashtags === 0) return [];
  const typeAr = TYPE_AR[p.type] || p.type;
  const tags =
    lang === 'fr'
      ? [`#Immobilier${slug(p.city)}`, `#${slug(p.type)}${p.listingType === 'location' ? 'ALouer' : 'AVendre'}`, '#ImmobilierMaroc', `#${slug(p.district)}`, '#AlWassit777', '#Investissement', '#MRE']
      : [`#عقارات_${slug(p.city)}`, `#${slug(typeAr)}_${p.listingType === 'location' ? 'للكراء' : 'للبيع'}`, '#عقارات_المغرب', '#الوسيط_777', `#${slug(p.district)}`, '#استثمار_عقاري', '#مغاربة_العالم'];
  return Array.from(new Set([...tags, ...A.brandHashtags])).slice(0, spec.maxHashtags);
}

function contactBlockAr(): string {
  return `للمزيد من التفاصيل المرجو التواصل معنا على الأرقام التالية:\n${A.phonesIntl.join('\n')}\nمقر ${A.nameAr}\n${A.hqAr}\n${A.addressAr}\n${A.sloganAr}`;
}

function textAr(p: Property, platform: AdPlatform): string {
  const spec = platformSpec(platform);
  const type = TYPE_AR[p.type] || p.type;
  const am = amenities(p, 'ar');
  const where = `${p.district}، ${p.city}`;
  const price = p.priceFormattedAr;
  if (spec.maxChars <= 300) {
    return `${type} ${dealAr(p, 'ar')} بـ${where} • ${p.surface} م² • ${price}\nللتواصل: ${A.phonesLocal[0]} – ${A.nameAr}`;
  }
  if (spec.kind === 'portal') {
    return [
      `${type} ${dealAr(p, 'ar')} – ${where} – ${p.surface} م²`,
      '',
      p.descriptionAr,
      '',
      `• المساحة: ${p.surface} م²`,
      p.bedrooms ? `• غرف النوم: ${p.bedrooms}` : '',
      p.bathrooms ? `• الحمامات: ${p.bathrooms}` : '',
      am.length ? `• المرافق: ${am.join('، ')}` : '',
      `• الثمن: ${price}`,
      '',
      contactBlockAr(),
    ].filter((l) => l !== '').join('\n');
  }
  const intro = spec.maxChars <= 600
    ? `السلام عليكم ورحمة الله تعالى وبركاته\n${A.nameAr} يعرض عليكم ${type} ${dealAr(p, 'ar')} بـ${where}`
    : `السلام عليكم ورحمة الله تعالى وبركاته\nوبعد\nأتشرف بالتعامل معكم بصفتي ${A.roleAr} / ${A.managerAr}\nاليوم إن شاء الله العلي القدير أتقدم لعرض ${type} ${dealAr(p, 'ar')} بـ${where}`;
  const details = [
    `بمساحة ${p.surface} م²${p.bedrooms ? ` و${p.bedrooms} غرف نوم` : ''}${p.bathrooms ? ` و${p.bathrooms} حمامات` : ''}`,
    am.length ? `يتوفر على: ${am.join('، ')}` : '',
    `الثمن: ${price}`,
  ].filter(Boolean).join('\n');
  if (spec.maxChars <= 600) {
    return `${intro}\n${details}\nللتواصل: ${A.phonesLocal.join(' / ')}\n${A.sloganAr}`;
  }
  const body = platform === 'linkedin'
    ? `${p.descriptionAr}\nفرصة استثمارية مميزة تواكب ما تصبو إليه المملكة المغربية لدعم المشاريع ومواكبة الإزدهار الاقتصادي في أفق رؤية 2030.`
    : p.descriptionAr;
  return `${intro}\n${body}\n${details}\n${contactBlockAr()}`;
}

function textDarija(p: Property, platform: AdPlatform): string {
  const spec = platformSpec(platform);
  const type = TYPE_DARIJA[p.type] || p.type;
  const am = amenities(p, 'darija');
  const where = `${p.district}، ${p.city}`;
  if (spec.maxChars <= 300) {
    return `🔥 ${type} ${dealAr(p, 'darija')} ف${where} • ${p.surface} م² • ${p.priceFormattedAr}\nتاصلو بينا: ${A.phonesLocal[0]}`;
  }
  const lines = [
    'السلام عليكم 👋',
    `عندنا ليكم ${type} ${dealAr(p, 'darija')} ف${where} 🏡`,
    `📐 ${p.surface} م²${p.bedrooms ? ` • ${p.bedrooms} بيوت ديال النعاس` : ''}${p.bathrooms ? ` • ${p.bathrooms} دوش` : ''}`,
    am.length ? `✅ فيها: ${am.join('، ')}` : '',
    `💰 الثمن: ${p.priceFormattedAr}`,
    spec.kind === 'message' ? 'إلا بغيتي تشوفها ولا عندك شي سؤال، صيفط لينا ميساج دابا 👇' : 'الفرصة ما كتعاودش، تاصل بينا دابا 👇',
    `📞 ${A.phonesLocal.join(' / ')}`,
    `📍 ${A.nameAr} – ${A.hqAr}`,
    A.sloganAr,
  ];
  return lines.filter(Boolean).join('\n');
}

function textFr(p: Property, platform: AdPlatform): string {
  const spec = platformSpec(platform);
  const am = amenities(p, 'fr');
  const where = `${p.district}, ${p.city}`;
  if (spec.maxChars <= 300) {
    return `${p.type} ${dealFr(p)} – ${where} • ${p.surface} m² • ${p.priceFormattedFr}\nContact : ${A.phonesLocal[0]} – Al Wassit 777`;
  }
  if (spec.kind === 'portal') {
    return [
      `${p.type} ${dealFr(p)} – ${where} – ${p.surface} m²`,
      '',
      p.descriptionFr,
      '',
      `• Surface : ${p.surface} m²`,
      p.bedrooms ? `• Chambres : ${p.bedrooms}` : '',
      p.bathrooms ? `• Salles de bain : ${p.bathrooms}` : '',
      am.length ? `• Équipements : ${am.join(', ')}` : '',
      p.features.length ? `• Atouts : ${p.features.join(', ')}` : '',
      `• Prix : ${p.priceFormattedFr}`,
      '',
      `${A.nameFr}\n${A.addressFr}\nTél : ${A.phonesLocal.join(' / ')}\n${A.sloganFr}`,
    ].filter((l) => l !== '').join('\n');
  }
  const lines = [
    'Bonjour à toutes et à tous,',
    `L'agence Al Wassit 777 vous présente : ${p.titleFr} (${p.type} ${dealFr(p)}) à ${where}.`,
    spec.maxChars > 600 ? p.descriptionFr : '',
    `📐 ${p.surface} m²${p.bedrooms ? ` • ${p.bedrooms} chambres` : ''}${p.bathrooms ? ` • ${p.bathrooms} SDB` : ''}`,
    am.length ? `✅ ${am.join(', ')}` : '',
    `💰 ${p.priceFormattedFr}`,
    platform === 'linkedin' ? "Une opportunité d'investissement solide, accompagnée par une agence de confiance à Meknès." : '',
    `📞 ${A.phonesLocal.join(' / ')} – ${A.addressFr}`,
    A.sloganFr,
  ];
  return lines.filter(Boolean).join('\n');
}

export function generateTemplateText(p: Property, platform: AdPlatform, lang: AdLanguage): string {
  const raw = lang === 'ar' ? textAr(p, platform) : lang === 'darija' ? textDarija(p, platform) : textFr(p, platform);
  return fitToPlatform(raw, platform, []);
}

// Coupe proprement le texte pour respecter la limite de caractères (hashtags compris).
export function fitToPlatform(text: string, platform: AdPlatform, hashtags: string[]): string {
  const max = platformSpec(platform).maxChars;
  const tagLen = hashtags.length ? hashtags.join(' ').length + 2 : 0;
  const budget = max - tagLen;
  if (text.length <= budget) return text;
  return text.slice(0, Math.max(0, budget - 1)).trimEnd() + '…';
}

export function fullPostText(d: Pick<AdDraft, 'text' | 'hashtags'>): string {
  return d.hashtags.length ? `${d.text}\n\n${d.hashtags.join(' ')}` : d.text;
}

export function propertyTitle(p: Property): string {
  return p.titleAr || p.titleFr;
}

// Lien de partage officiel quand la plateforme en propose un (sinon : copier + ouvrir l'app).
export function shareUrl(platform: AdPlatform, text: string): string | null {
  const t = encodeURIComponent(text);
  switch (platform) {
    case 'whatsapp': return `https://wa.me/?text=${t}`;
    case 'x': return `https://x.com/intent/post?text=${t}`;
    case 'threads': return `https://www.threads.net/intent/post?text=${t}`;
    case 'linkedin': return `https://www.linkedin.com/feed/?shareActive=true&text=${t}`;
    case 'facebook': return 'https://www.facebook.com/';
    case 'instagram': return 'https://www.instagram.com/';
    case 'tiktok': return 'https://www.tiktok.com/upload';
    case 'snapchat': return 'https://www.snapchat.com/';
    case 'upscrolled': return 'https://upscrolled.com/';
    case 'avito': return 'https://www.avito.ma/fr/deposer-une-annonce';
    case 'mubawab': return 'https://www.mubawab.ma/';
    case 'sarouty': return 'https://www.sarouty.ma/';
  }
}

// Répartit les annonces approuvées sur les prochains jours aux meilleures heures,
// sans dépasser `perDay` publications par jour ni deux posts sur le même créneau.
export function planSchedule(drafts: AdDraft[], perDay: number, from: Date = new Date()): Record<string, string> {
  const scheduled = drafts.filter((d) => d.scheduledAt && d.status === 'programmé').map((d) => d.scheduledAt!);
  const taken = new Set(scheduled.map((iso) => iso.slice(0, 16)));
  const dayCount: Record<string, number> = {};
  scheduled.forEach((iso) => { const day = localDayKey(new Date(iso)); dayCount[day] = (dayCount[day] || 0) + 1; });
  const result: Record<string, string> = {};
  for (const d of drafts.filter((x) => x.status === 'approuvé')) {
    const spec = platformSpec(d.platform);
    let placed = false;
    for (let offset = 0; offset < 60 && !placed; offset++) {
      const day = new Date(from);
      day.setDate(day.getDate() + offset);
      const dayKey = localDayKey(day);
      if ((dayCount[dayKey] || 0) >= perDay) continue;
      for (const time of spec.bestTimes) {
        const [h, m] = time.split(':').map(Number);
        const slot = new Date(day);
        slot.setHours(h, m, 0, 0);
        if (slot <= from) continue;
        const key = slot.toISOString().slice(0, 16);
        if (taken.has(key)) continue;
        taken.add(key);
        dayCount[dayKey] = (dayCount[dayKey] || 0) + 1;
        result[d.id] = slot.toISOString();
        placed = true;
        break;
      }
    }
  }
  return result;
}

export function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
