// Compréhension simple par mots-clés : utilisée par le وكيل الوسيط 777 quand l'IA (Gemini) n'est pas disponible.
import { AdDraft, AdLanguage, AdPlatform, Property } from '../types';
import { PLATFORMS } from './adGenerator';

export type AgentAction =
  | { type: 'generate_ads'; propertyId: number; platforms?: AdPlatform[]; languages?: AdLanguage[] }
  | { type: 'open'; tab: 'ads' | 'crm' | 'home' };

export interface AgentReply {
  reply: string;
  action: AgentAction | null;
  source: 'ia' | 'local';
}

const ALL_PLATFORMS = PLATFORMS.map((p) => p.id);
const DEFAULT_LANGS: AdLanguage[] = ['ar', 'darija', 'fr'];

export function buildContext(properties: Property[], drafts: AdDraft[]) {
  const count = (s: AdDraft['status']) => drafts.filter((d) => d.status === s).length;
  const today = new Date().toDateString();
  return {
    today: new Date().toISOString(),
    properties: properties.map((p) => ({
      id: p.id, title: p.titleAr || p.titleFr, titleFr: p.titleFr, type: p.type, deal: p.listingType,
      city: p.city, district: p.district, surface: p.surface, price: p.priceFormattedFr,
    })),
    ads: {
      toReview: count('brouillon'), approved: count('approuvé'), scheduled: count('programmé'),
      published: count('publié'), rejected: count('rejeté'),
      scheduledToday: drafts.filter((d) => d.status === 'programmé' && d.scheduledAt && new Date(d.scheduledAt).toDateString() === today)
        .map((d) => ({ platform: d.platform, at: d.scheduledAt, property: d.propertyTitle })),
      leads: drafts.reduce((a, d) => a + (d.stats?.leads || 0), 0),
      messages: drafts.reduce((a, d) => a + (d.stats?.messages || 0), 0),
      views: drafts.reduce((a, d) => a + (d.stats?.views || 0), 0),
    },
  };
}

// ---------- Mode simple (sans IA) ----------
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه');
// Mots courts (« كم », « pub ») : mot entier seulement, pour éviter « عليكم » → « كم ».
const has = (text: string, words: string[]) => {
  const tokens = text.split(/[^\p{L}\p{N}]+/u);
  return words.some((w) => {
    const nw = norm(w);
    return nw.length <= 3 ? tokens.some((t) => t === nw || t === `ال${nw}`) : text.includes(nw);
  });
};

const isArabic = (s: string) => /[؀-ۿ]/.test(s);
const looksDarija = (s: string) => has(norm(s), ['بغيت', 'ديال', 'دير', 'شحال', 'واش', 'عافاك', 'دابا', 'كاين', 'فين', 'بزاف', 'ليا', 'ليك', 'حل', 'شنو', 'علاش', 'كيفاش']);

function findProperty(text: string, properties: Property[]): Property | undefined {
  const n = norm(text);
  const num = n.match(/(?:#|رقم|n°|numero|num|bien)\s*(\d+)/)?.[1] ?? n.match(/\b(\d{1,3})\b/)?.[1];
  if (num) {
    const byId = properties.find((p) => p.id === Number(num));
    if (byId) return byId;
  }
  return (
    properties.find((p) => n.includes(norm(p.district))) ||
    properties.find((p) => n.includes(norm(p.city))) ||
    properties.find((p) => norm(p.titleFr).split(/\s+/).filter((w) => w.length > 4).some((w) => n.includes(w)))
  );
}

export function localAgent(text: string, properties: Property[], drafts: AdDraft[]): AgentReply {
  const n = norm(text);
  const lang: 'darija' | 'ar' | 'fr' = isArabic(text) ? (looksDarija(text) ? 'darija' : 'ar') : 'fr';
  const say = (fr: string, ar: string, darija: string) => (lang === 'fr' ? fr : lang === 'ar' ? ar : darija);
  const ctx = buildContext(properties, drafts).ads;

  if (has(n, ['شحال', 'كم', 'combien', 'stat', 'resultat', 'نتائج', 'نتيجه', 'زبائن', 'clients', 'اليوم', "aujourd"])) {
    const today = ctx.scheduledToday.length;
    return {
      reply: say(
        `📊 À valider : ${ctx.toReview} • Programmées : ${ctx.scheduled} (dont ${today} aujourd'hui) • Publiées : ${ctx.published}\nVues : ${ctx.views} • Messages : ${ctx.messages} • Clients sérieux : ${ctx.leads}`,
        `📊 للمراجعة: ${ctx.toReview} • مبرمجة: ${ctx.scheduled} (منها ${today} اليوم) • منشورة: ${ctx.published}\nمشاهدات: ${ctx.views} • رسائل: ${ctx.messages} • زبائن جديون: ${ctx.leads}`,
        `📊 باقي ما راجعتيهمش: ${ctx.toReview} • مبرمجين: ${ctx.scheduled} (${today} اليوم) • تنشرو: ${ctx.published}\nمشاهدات: ${ctx.views} • ميساجات: ${ctx.messages} • كليان سيريو: ${ctx.leads}`
      ),
      action: null, source: 'local',
    };
  }

  if (has(n, ['اعلان', 'إعلان', 'بوست', 'منشور', 'pub', 'annonce', 'post', 'publicite', 'ecris', 'ekteb', 'كتب', 'اكتب', 'حضر'])) {
    const p = findProperty(text, properties);
    if (!p) {
      const list = properties.slice(0, 8).map((x) => `#${x.id} ${x.titleAr || x.titleFr} (${x.city})`).join('\n');
      return {
        reply: say(`Pour quel bien ? Donnez-moi le numéro :\n${list}`, `لأي عقار؟ أعطني الرقم:\n${list}`, `على أنهي عقار؟ عطيني الرقم:\n${list}`),
        action: null, source: 'local',
      };
    }
    return {
      reply: say(
        `Je prépare les annonces pour « ${p.titleFr} » sur toutes les plateformes (arabe, darija, français). Vous les validerez dans « Publicités ».`,
        `أحضّر الإعلانات لـ«${p.titleAr || p.titleFr}» على جميع المنصات (العربية، الدارجة، الفرنسية). راجعها ووافق عليها في قسم «الإعلانات».`,
        `غادي نوجد ليك الإعلانات ديال «${p.titleAr || p.titleFr}» فجميع المنصات (العربية، الدارجة، الفرنسية). شوفهم ووافق عليهم ف«الإعلانات».`
      ),
      action: { type: 'generate_ads', propertyId: p.id, platforms: ALL_PLATFORMS, languages: DEFAULT_LANGS },
      source: 'local',
    };
  }

  if (has(n, ['سجل', 'مالك', 'registre', 'proprietaire', 'crm', 'زبون', 'كليان'])) {
    return { reply: say('J’ouvre le registre des biens et clients.', 'أفتح لك سجل العقارات والزبائن.', 'غادي نحل ليك السجل ديال العقارات والكليان.'), action: { type: 'open', tab: 'crm' }, source: 'local' };
  }

  return {
    reply: say(
      'Je peux : ✍️ préparer des annonces (ex. « annonce pour le bien 3 »), 📊 donner les résultats (« combien de clients ? »), 🗂️ ouvrir le registre. Pour une vraie conversation libre, il faut activer l’IA (clé Gemini).',
      'أستطيع: ✍️ تحضير الإعلانات (مثال: «إعلان للعقار رقم 3»)، 📊 إعطاء النتائج («كم عدد الزبائن؟»)، 🗂️ فتح سجل العقارات. للمحادثة الحرة الكاملة يجب تفعيل الذكاء الاصطناعي (مفتاح Gemini).',
      'نقدر: ✍️ نوجد ليك الإعلانات (مثلا: «دير إعلان للعقار رقم 3»)، 📊 نعطيك النتائج («شحال من كليان؟»)، 🗂️ نحل ليك السجل. باش نهضرو بحرية خاص تفعّل الذكاء الاصطناعي (مفتاح Gemini).'
    ),
    action: null, source: 'local',
  };
}
