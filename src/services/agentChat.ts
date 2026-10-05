// Conversation avec l'agent : IA (server.ts → Gemini) si disponible, sinon compréhension simple par mots-clés.
import { AdDraft, AdLanguage, AdPlatform, Property } from '../types';
import { PLATFORMS } from './adGenerator';
import { getIdToken } from './firebase';
import { getDrafts } from './adsStore';
import { AgentMode } from '../agent/toolDefs';
import { AgentEffect, runTool } from '../agent/executor';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  at: string;
}

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

// ---------- Agent IA avec outils ----------
// Format de conversation Gemini, conservé tel quel pour les appels d'outils.
export interface GeminiPart {
  text?: string;
  functionCall?: { id?: string; name: string; args?: Record<string, unknown> };
  functionResponse?: { id?: string; name: string; response: Record<string, unknown> };
  thoughtSignature?: string;
}
export interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

export interface AgentTurn {
  reply: string;
  effects: AgentEffect[];
  contents: GeminiContent[]; // conversation complète mise à jour (à conserver pour la suite)
  source: 'ia' | 'local';
  toolsUsed: string[];
}

const MAX_STEPS = 6;

export async function runAgentTurn(
  mode: AgentMode,
  previous: GeminiContent[],
  userText: string,
  properties: Property[]
): Promise<AgentTurn> {
  const contents: GeminiContent[] = [...previous.slice(-40), { role: 'user', parts: [{ text: userText }] }];
  const effects: AgentEffect[] = [];
  const toolsUsed: string[] = [];
  const ctx = { mode, properties };
  try {
    const token = await getIdToken().catch(() => null);
    for (let step = 0; step < MAX_STEPS; step++) {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ mode, contents }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const modelContent: GeminiContent = data.content && Array.isArray(data.content.parts) ? { role: 'model', parts: data.content.parts } : { role: 'model', parts: [{ text: data.text || '' }] };
      contents.push(modelContent);
      const calls: { id?: string; name: string; args: Record<string, unknown> }[] = Array.isArray(data.functionCalls) ? data.functionCalls : [];
      if (calls.length === 0) {
        const reply = String(data.text || '').trim();
        return { reply: reply || '…', effects, contents, source: 'ia', toolsUsed };
      }
      const responses: GeminiPart[] = [];
      for (const call of calls) {
        toolsUsed.push(call.name);
        const outcome = await runTool(call.name, call.args || {}, ctx).catch((e) => ({ result: { error: String(e?.message || e) }, effects: [] as AgentEffect[] }));
        effects.push(...outcome.effects);
        responses.push({ functionResponse: { ...(call.id ? { id: call.id } : {}), name: call.name, response: { output: outcome.result } } });
      }
      contents.push({ role: 'user', parts: responses });
    }
    return { reply: 'تم.', effects, contents, source: 'ia', toolsUsed };
  } catch {
    // IA indisponible (pas de clé, hors ligne…) : mode simple par mots-clés.
    const local = mode === 'manager' ? localAgent(userText, properties, getDrafts()) : localCustomerAgent(userText, properties);
    if (local.action) {
      const tool = local.action.type === 'generate_ads' ? 'create_ads' : 'open_page';
      const args = local.action.type === 'generate_ads' ? { propertyId: local.action.propertyId } : { page: local.action.tab };
      const outcome = await runTool(tool, args, ctx).catch(() => null);
      if (outcome) effects.push(...outcome.effects);
      toolsUsed.push(tool);
    }
    const fallbackContents: GeminiContent[] = [...contents, { role: 'model', parts: [{ text: local.reply }] }];
    return { reply: local.reply, effects, contents: fallbackContents, source: 'local', toolsUsed };
  }
}

// Assistant clients en mode simple : recherche par mots-clés + contact WhatsApp du bureau.
export function localCustomerAgent(text: string, properties: Property[]): AgentReply {
  const n = norm(text);
  const lang: 'darija' | 'ar' | 'fr' = isArabic(text) ? (looksDarija(text) ? 'darija' : 'ar') : 'fr';
  const say = (fr: string, ar: string, darija: string) => (lang === 'fr' ? fr : lang === 'ar' ? ar : darija);
  const wantsRent = has(n, ['كراء', 'للكرا', 'louer', 'location', 'loyer']);
  const words = n.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2);
  const found = properties
    .filter((p) => (wantsRent ? p.listingType === 'location' : true))
    .map((p) => ({ p, score: words.filter((w) => norm(`${p.city} ${p.district} ${p.type} ${p.titleFr} ${p.titleAr}`).includes(w)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ p }) => `#${p.id} ${lang === 'fr' ? p.titleFr : p.titleAr || p.titleFr} – ${p.city} – ${p.surface} m² – ${lang === 'fr' ? p.priceFormattedFr : p.priceFormattedAr}`);
  if (found.length) {
    return {
      reply: say(
        `Voici des biens qui peuvent vous intéresser :\n${found.join('\n')}\nPour une visite, contactez-nous au 0777777848 / 0777777959.`,
        `هذه عقارات قد تهمك:\n${found.join('\n')}\nللزيارة تواصل معنا على 0777777848 / 0777777959.`,
        `هادو عقارات يقدرو يعجبوك:\n${found.join('\n')}\nباش تزور، تاصل بينا: 0777777848 / 0777777959.`
      ),
      action: null, source: 'local',
    };
  }
  return {
    reply: say(
      'Bienvenue chez Al Wassit 777 ! Dites-moi ce que vous cherchez (ville, quartier, achat ou location, budget) ou appelez-nous au 0777777848 / 0777777959.',
      'مرحباً بك في الوسيط 777! أخبرني ماذا تبحث عنه (المدينة، الحي، شراء أو كراء، الميزانية) أو اتصل بنا على 0777777848 / 0777777959.',
      'مرحبا بيك ف الوسيط 777! قول ليا شنو كتقلب عليه (المدينة، الحومة، شرا ولا كرا، الميزانية) ولا عيط لينا: 0777777848 / 0777777959.'
    ),
    action: null, source: 'local',
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
