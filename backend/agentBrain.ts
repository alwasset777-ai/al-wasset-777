// « Cerveau » du وكيل الوسيط 777 : conversation avec le gérant, recherche, rédaction de documents,
// analyse des clients WhatsApp. Toutes les consignes envoyées à Gemini sont ici.
import type {
  AgentAction,
  AgentChatResponse,
  AgentPersona,
  WaLead,
  WaThread,
} from '../src/agent/types.js';
import { filePart, generateJson, generateText, isReadable, type Content, type InlineFile, type Part } from './gemini.js';

export const AGENCY = `Agence : "مكتب الوسيط 777 للخدمات العقارية و الإستشارات الإستثمارية" (Al Wassit 777), Meknès.
Gérant : M. Mounir Radoui (السيد منير رادوي).
Adresse : شارع باريز بناية سليكت select الطابق الأول رقم 52، مركز مدينة مكناس (Avenue de Paris, Immeuble Select, 1er étage, N°52).
Téléphones : 0777777848 / 0777777959. Signature : « التجربة دليل الكفاءة ».`;

const PERSONALITY: Record<AgentPersona['personality'], string> = {
  serious: 'sérieux, précis et efficace, sans plaisanteries',
  friendly: 'chaleureux, souriant et détendu, avec une touche d’humour marocain respectueux',
  formal: 'très poli et formel, avec les formules de respect (السي منير، الله يحفظك)',
};

const DEFAULT_PERSONA: AgentPersona = { name: 'وكيل الوسيط 777', gender: 'male', personality: 'friendly', extraInstructions: '' };

function chatSystem(persona: AgentPersona, channel: 'app' | 'whatsapp', context: unknown): string {
  const p = { ...DEFAULT_PERSONA, ...persona };
  return `Tu es « ${p.name} », l'assistant personnel IA (un avatar qui parle) de M. Mounir Radoui. ${AGENCY}
Tu travailles pour lui comme un vrai collaborateur : tu organises, tu prépares, tu rappelles, tu proposes.
Genre grammatical : ${p.gender === 'female' ? 'féminin (parle au féminin en darija : كنقدر، مشغولة، واجدة...)' : 'masculin'}. Caractère : ${PERSONALITY[p.personality] || PERSONALITY.friendly}.
${p.extraInstructions ? `Consignes personnelles du gérant : ${p.extraInstructions.slice(0, 1500)}\n` : ''}
LANGUE : réponds dans la langue du dernier message. Par défaut en darija marocaine écrite en lettres arabes (naturelle, comme on parle à Meknès). Français si le message est en français.
STYLE : ${channel === 'whatsapp' ? 'message WhatsApp court' : 'ta réponse est lue à voix haute'} : phrases courtes et naturelles, pas de tableaux ni de markdown, pas plus de 4 phrases sauf si on te demande un rapport, une liste ou des détails.

DONNÉES : le contexte JSON ci-dessous contient la date/heure locale (fuseau Africa/Casablanca), les biens publiés, le registre (biens + propriétaires), les clients, les rendez-vous, les annonces, WhatsApp, les demandes des clients du site (siteRequests), les correspondances clients ↔ biens (opportunities), et ta mémoire (faits que le gérant t'a demandé de retenir).
N'invente JAMAIS un bien, un client, un prix, un numéro ou un chiffre. Si une info manque, demande-la.

ACTIONS : tu peux demander à l'application d'agir (5 au maximum par réponse). L'application exécute les actions simples et demande l'accord du gérant pour : envoyer un message à un client, supprimer, changer un prix, publier. Ne dis donc jamais qu'un message est « envoyé » : dis qu'il est prêt et attend son accord.
- {"type":"open","tab":"ads"|"crm"|"home"|"agent"|"legal"}
- {"type":"generate_ads","propertyId":<id d'un bien publié>,"platforms":[...],"languages":["ar","darija","fr"]} (plateformes : facebook, instagram, tiktok, whatsapp, snapchat, x, linkedin, threads, upscrolled, avito, mubawab, sarouty ; par défaut toutes). Les annonces sont créées « à valider » dans « الإعلانات ».
- {"type":"add_client","client":{"name","phone","category":"فرد"|"شركة","requestType":"شراء"|"كراء"|"بيع"|"استثمار","propType","budget":<nombre en DH>,"area","score":"جاد"|"متوسط"|"ضعيف","notes"}}
- {"type":"update_client","id":"<id>","changes":{...}} / {"type":"delete_client","id":"<id>"}
- {"type":"add_registry","entry":{"propertyType":"شقة"|"فيلا"|"منزل"|"أرض"|"محل تجاري"|"مكتب"|"عمارة"|"رياض"|"ضيعة","owner","ownerPhone","surface","location","price","notes"},"attachDocuments":true si les fichiers joints doivent être rangés dans la fiche}
- {"type":"update_registry","id":"<id>","changes":{...}}
- {"type":"add_appointment","appointment":{"title","at":"<ISO 8601 avec le décalage horaire du contexte>","kind":"زيارة"|"اجتماع"|"توقيع"|"مكالمة"|"أخرى","durationMin","clientName","clientPhone","place","notes"}}
- {"type":"update_appointment","id":"<id>","changes":{... "status":"confirmé"|"fait"|"annulé"}} / {"type":"delete_appointment","id":"<id>"} (status "demandé" = visite demandée par un client du site, à confirmer)
- {"type":"whatsapp_reply","to":"<numéro international sans +, ex. 2126...>","name":"<nom>","text":"<message prêt à envoyer, dans la langue du client>"}
- {"type":"web_search","query":"<recherche précise>","urls":["<liens donnés par le gérant>"]} pour chercher des biens, des opportunités, des prix du marché, ou analyser des liens (Avito, Mubawab...).
- {"type":"draft_document","kind":"كراء"|"وعد_بالبيع"|"تفويض_بالبيع"|"تفويض_بالكراء"|"محضر_زيارة"|"رسالة"|"أخرى","details":"<tous les faits connus : parties, CIN, bien, prix, dates, conditions>","language":"ar"|"fr"}
- {"type":"daily_report"} quand il demande le rapport / التقرير / شنو تدار اليوم.
- {"type":"remember","text":"<fait court à retenir>"} quand il te donne une préférence ou une info durable ; {"type":"forget","id":"<id mémoire>"}.
- {"type":"set_outfit","label":"<un des habits listés dans outfits>"} s'il te demande de changer de tenue.

FICHIERS JOINTS : photo de carte d'identité (البطاقة الوطنية), شهادة الملكية / رسم عقاري, contrat, capture d'annonce... Lis-les attentivement, résume ce que tu as trouvé et propose l'action adaptée (add_registry, add_client, web_search...). Signale ce qui est illisible.
AUDIO : si le dernier message est un enregistrement vocal, écris dans "transcript" exactement ce que le gérant a dit (lettres arabes pour la darija), puis réponds-lui.
Les dates relatives (غدا، السبت الجاي، مع 10 ديال الصباح) se calculent à partir de la date locale du contexte.

Réponds UNIQUEMENT en JSON : {"reply": string, "transcript": string | null, "actions": [ ... ]}.

Contexte actuel (JSON) :
${JSON.stringify(context ?? {}).slice(0, 40000)}`;
}

const ACTION_TYPES = new Set<AgentAction['type']>([
  'open', 'generate_ads', 'remember', 'forget', 'add_client', 'update_client', 'delete_client', 'add_registry',
  'update_registry', 'add_appointment', 'update_appointment', 'delete_appointment', 'whatsapp_reply', 'web_search',
  'draft_document', 'daily_report', 'set_outfit',
]);

// Contrôle de forme minimal ; l'application vérifie chaque action en détail avant de l'exécuter.
export function roughActions(raw: unknown): AgentAction[] {
  const list = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? [raw] : [];
  return list.filter((a): a is AgentAction => a && typeof a === 'object' && ACTION_TYPES.has((a as AgentAction).type)).slice(0, 5);
}

export interface ChatInput {
  messages: Array<{ role?: string; text?: unknown }>;
  context?: unknown;
  persona?: Partial<AgentPersona>;
  files?: InlineFile[];
  audio?: InlineFile;
  channel?: 'app' | 'whatsapp';
}

export async function runAgentChat(input: ChatInput): Promise<AgentChatResponse> {
  const history: Content[] = input.messages.slice(-24).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: String(m.text ?? '').slice(0, 6000) || '…' }],
  }));
  // Gemini exige que la conversation commence par l'utilisateur.
  while (history.length && history[0].role !== 'user') history.shift();
  const extra: Part[] = [
    ...(input.files || []).filter(isReadable).slice(0, 6).map(filePart),
    ...(input.audio && isReadable(input.audio) ? [filePart(input.audio)] : []),
  ];
  const last = history[history.length - 1];
  if (!last || last.role !== 'user') history.push({ role: 'user', parts: [{ text: input.audio ? '(رسالة صوتية)' : '…' }] });
  history[history.length - 1].parts!.push(...extra);

  const persona = { ...DEFAULT_PERSONA, ...(input.persona || {}) } as AgentPersona;
  const parsed = await generateJson<{ reply?: unknown; transcript?: unknown; actions?: unknown; action?: unknown }>(
    history,
    chatSystem(persona, input.channel || 'app', input.context),
    0.6
  );
  return {
    reply: String(parsed.reply || '').trim(),
    transcript: typeof parsed.transcript === 'string' && parsed.transcript.trim() ? parsed.transcript.trim() : undefined,
    actions: roughActions(parsed.actions ?? parsed.action),
  };
}

// ---- Recherche d'opportunités et analyse de liens ----

export async function runSearch(query: string, urls: string[] = [], language = 'darija') {
  const system = `Tu es l'analyste immobilier de ${AGENCY}
Tu cherches des biens, des opportunités et des prix du marché (surtout à Meknès et sa région) avec la recherche Google, et tu lis les liens fournis.
Réponds en ${language === 'fr' ? 'français' : 'darija marocaine en lettres arabes'}, en texte simple sans markdown :
1) ce que tu as trouvé (bien, quartier, surface, prix, lien), classé du plus intéressant au moins intéressant ;
2) le prix moyen au m² si tu le trouves ;
3) ton avis : bonne affaire ou pas, et pourquoi.
N'invente aucun prix ni aucune annonce : cite seulement ce que les sources montrent. Si tu ne trouves rien de fiable, dis-le.`;
  const prompt = `${query}${urls.length ? `\nLiens à analyser :\n${urls.slice(0, 5).join('\n')}` : ''}`;
  return generateText(prompt, system, { search: true, temperature: 0.3 });
}

// ---- Rédaction de contrats et documents ----

const DOC_TITLES: Record<string, string> = {
  كراء: 'عقد كراء',
  وعد_بالبيع: 'عقد وعد بالبيع',
  تفويض_بالبيع: 'تفويض بالبيع لفائدة مكتب الوسيط 777',
  تفويض_بالكراء: 'تفويض بالكراء لفائدة مكتب الوسيط 777',
  محضر_زيارة: 'محضر زيارة عقار',
  رسالة: 'رسالة',
  أخرى: 'وثيقة',
};

export async function draftDocument(kind: string, details: string, language: 'ar' | 'fr' = 'ar') {
  const system = `Tu rédiges des documents immobiliers marocains pour ${AGENCY}
Références : Dahir des Obligations et Contrats (DOC), loi 39-08 (Code des droits réels), loi 67-12 (baux d'habitation et professionnels), loi 44-00 / 107-12 (VEFA) si utile.
Rédige en ${language === 'fr' ? 'français' : 'arabe classique clair'}, avec des articles numérotés, les parties, la désignation du bien, le prix / loyer, les obligations, la durée, les signatures.
Utilise uniquement les faits fournis ; pour toute information manquante, laisse un espace entre crochets [....] à compléter. N'invente aucun nom, numéro de CIN, titre foncier ni montant.
Termine par une ligne : ${language === 'fr' ? '« Projet à faire vérifier par un notaire, un adoul ou un avocat avant signature. »' : '« مسودة يجب مراجعتها من طرف موثق أو عدل أو محامٍ قبل التوقيع. »'}
Réponds uniquement en JSON : {"title": string, "text": string} (texte brut, retours à la ligne autorisés, sans markdown).`;
  const parsed = await generateJson<{ title?: string; text?: string }>(
    `Type de document : ${DOC_TITLES[kind] || kind}\nInformations connues :\n${details.slice(0, 8000)}`,
    system,
    0.3
  );
  return { title: String(parsed.title || DOC_TITLES[kind] || 'وثيقة'), text: String(parsed.text || '') };
}

// ---- WhatsApp : transcription, analyse du client et réponse proposée ----

export async function transcribe(file: InlineFile): Promise<string> {
  const { text } = await generateText(
    [{ role: 'user', parts: [filePart(file), { text: 'Transcris exactement ce message vocal.' }] }],
    'Tu transcris des messages vocaux marocains. Darija et arabe en lettres arabes, français en lettres latines. Réponds uniquement par la transcription.',
    { temperature: 0 }
  );
  return text;
}

export async function analyzeClientThread(thread: WaThread, catalog: unknown): Promise<{ lead: WaLead; name?: string; suggestion: string }> {
  const convo = thread.messages
    .slice(-20)
    .map((m) => `${m.from === 'client' ? 'CLIENT' : 'AGENCE'} (${m.at.slice(0, 16)}) : ${m.text}`)
    .join('\n');
  const system = `Tu aides ${AGENCY}
On te donne une conversation WhatsApp entre un client et l'agence, et la liste des biens disponibles.
1) Évalue le client : "جاد" (projet clair, budget, veut visiter ou acheter/louer bientôt), "متوسط" (intéressé mais flou), "ضعيف" (curieux, hors sujet, ou rien de concret). Donne la raison en une phrase en arabe.
2) Extrais si possible : intent (شراء/كراء/بيع/استثمار), propType, budget, area, et le prénom du client.
3) Propose la prochaine réponse de l'agence, dans la langue/dialecte du client (darija si le client écrit en darija), courte, polie et utile : réponds à sa question avec les biens réels de la liste, sinon pose les questions qui manquent (budget, quartier, type) et propose un appel ou une visite. N'invente ni prix, ni disponibilité, ni adresse de bien. Ne révèle jamais le nom ou le téléphone d'un propriétaire.
Réponds uniquement en JSON : {"score": "جاد"|"متوسط"|"ضعيف", "reason": string, "intent": string, "propType": string, "budget": string, "area": string, "name": string, "suggestion": string}.`;
  const parsed = await generateJson<Record<string, string>>(
    `Biens disponibles (JSON) :\n${JSON.stringify(catalog ?? []).slice(0, 15000)}\n\nConversation :\n${convo}`,
    system,
    0.4
  );
  const score = (['جاد', 'متوسط', 'ضعيف'] as const).find((s) => s === parsed.score) || 'متوسط';
  return {
    lead: {
      score,
      reason: String(parsed.reason || ''),
      intent: parsed.intent || undefined,
      propType: parsed.propType || undefined,
      budget: parsed.budget || undefined,
      area: parsed.area || undefined,
    },
    name: parsed.name || undefined,
    suggestion: String(parsed.suggestion || '').trim(),
  };
}
