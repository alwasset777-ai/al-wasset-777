// API de l'agent publicitaire (/api/...), clés gardées côté serveur.
// Utilisée par server.ts (AI Studio / Cloud Run / local) et par api/index.ts (Vercel).
import 'dotenv/config';
import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { metaStatus, publishFacebook, publishInstagram } from './meta.js';
import { metricoolEnabled, schedulePost, type StudioPostInput } from './metricool.js';
import { STUDIO_LANGUAGES, STUDIO_NETWORK_IDS, studioSpec, type StudioNetwork } from './src/services/studioPlatforms.js';
import { toolsForMode, type AgentMode } from './src/agent/toolDefs.js';

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
const apiKey = process.env.GEMINI_API_KEY;
const ai =
  apiKey && apiKey !== 'MY_GEMINI_API_KEY'
    ? new GoogleGenAI({ apiKey, ...(process.env.GEMINI_BASE_URL ? { httpOptions: { baseUrl: process.env.GEMINI_BASE_URL } } : {}) })
    : null;

// Vérification de l'identité du gérant (jeton Firebase envoyé par l'application).
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
const adminAuth = FIREBASE_PROJECT_ID ? getAuth(initializeApp({ projectId: FIREBASE_PROJECT_ID })) : null;

async function isAdmin(req: express.Request): Promise<boolean> {
  if (!adminAuth) return false;
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  if (!token) return false;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const email = (decoded.email || '').toLowerCase();
    // Liste obligatoire : sans ADMIN_EMAILS, personne n'est autorisé (évite qu'un compte inconnu publie).
    return Boolean(email && ADMIN_EMAILS.includes(email));
  } catch {
    return false;
  }
}

// Exemple réel de la façon d'écrire de M. Mounir Radoui : l'IA s'en inspire pour le ton.
const STYLE_SAMPLE = `السلام عليكم ورحمة الله تعالى وبركاته
وبعد
أتشرف بالتعامل معكم بصفتي مدير مكتب الوسيط 777 للخدمات العقارية و الإستشارات الإستثمارية/ السيد منير رادوي
اليوم ان شاء الله العلي القدير أتقدم لعرض مشروع قرية سياحية بمدينة إفران الملقبة بسويسرا المغرب بمساحة 7 هكتارات لمنتجع صحي ، سياحي ، تجاري ، سكني و غيره حيث أن موقعه بمقربة الغابة ... ولا ننسى ما تصبو إليه المملكة المغربية لدعم المشاريع و مواكبة الإزدهار الاقتصادي بصدد رؤية 2030 و 2050
للمزيد من التفاصيل المرجو التواصل معنا على الأرقام التالية:
00212777777848
00212777777959
مقر مكتب الوسيط 777 للخدمات العقارية
مركز مدينة مكناس
شارع باريز بناية سليكت select الطابق الأول رقم 52
التجربة دليل الكفاءة`;

const SYSTEM = `Tu es l'agent publicitaire de l'agence immobilière "مكتب الوسيط 777 للخدمات العقارية" (Al Wassit 777) à Meknès, dirigée par M. Mounir Radoui.
Ta mission : écrire des publicités immobilières qui attirent les clients (acheteurs, locataires, MRE, investisseurs), dans le style personnel de M. Radoui.
Style de référence (respecte le ton : courtois, respectueux, formules religieuses de politesse, valorisation du lieu et des atouts, appel à l'action avec les numéros, signature "التجربة دليل الكفاءة") :
"""
${STYLE_SAMPLE}
"""
Règles :
- N'invente aucune information absente des données du bien (prix, surface, équipements).
- Langue "ar" = arabe classique dans le style ci-dessus ; "darija" = darija marocaine en lettres arabes, chaleureuse, avec quelques emojis ; "fr" = français professionnel et chaleureux.
- Adapte la longueur et le ton à la plateforme (X et Snapchat très courts, LinkedIn orienté investissement, WhatsApp comme un message direct sans hashtags, portails Avito/Mubawab/Sarouty en annonce structurée sans hashtags ni emojis).
- Termine toujours par les numéros 0777777848 / 0777777959.
- Réponds uniquement en JSON : {"text": string, "hashtags": string[]}. Les hashtags commencent par #.`;

const app = express();
app.use(express.json({ limit: '12mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, ai: Boolean(ai), auth: Boolean(adminAuth), meta: metaStatus, metricool: metricoolEnabled });
});

app.post('/api/ads/generate', async (req, res) => {
  // Quand Firebase est configuré, seule l'équipe connectée peut consommer le quota IA.
  if (adminAuth && !(await isAdmin(req))) {
    res.status(401).json({ error: 'Connexion requise' });
    return;
  }
  if (!ai) {
    res.status(503).json({ error: 'GEMINI_API_KEY non configurée' });
    return;
  }
  const { platform, platformLabel, maxChars, maxHashtags, kind, language, property } = req.body || {};
  if (!platform || !language || !property) {
    res.status(400).json({ error: 'Paramètres manquants' });
    return;
  }
  const prompt = `Plateforme : ${platformLabel} (${kind}). Limite : ${maxChars} caractères au total, ${maxHashtags} hashtags maximum.
Langue : ${language}.
Données du bien (JSON) :
${JSON.stringify(property)}`;
  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: { systemInstruction: SYSTEM, responseMimeType: 'application/json', temperature: 0.8 },
    });
    const parsed = JSON.parse(response.text || '{}');
    res.json({
      text: String(parsed.text || '').slice(0, Number(maxChars) || 5000),
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags.slice(0, Number(maxHashtags) || 0) : [],
    });
  } catch (err) {
    console.error('Erreur Gemini :', err);
    res.status(502).json({ error: 'Génération IA impossible' });
  }
});

// ---------- Agent IA « وكيل الوسيط 777 » ----------
// Deux personnalités : « manager » (le gérant, toutes les actions du bureau) et « customer »
// (visiteurs du site : chercher un bien, demander une visite). Le modèle choisit des outils ;
// l'application les exécute dans le navigateur et renvoie les résultats (boucle côté client).
const AGENCY_FACTS = `Agence : "مكتب الوسيط 777 للخدمات العقارية و الإستشارات الإستثمارية", Meknès. Gérant : M. Mounir Radoui (السيد منير رادوي).
Adresse : شارع باريز بناية سليكت select الطابق الأول رقم 52، مركز مدينة مكناس. Tél : 0777777848 / 0777777959. Signature : « التجربة دليل الكفاءة ».`;

const LANGUAGE_RULE = `Réponds TOUJOURS dans la langue du dernier message de l'utilisateur : darija marocaine (lettres arabes), arabe classique ou français. Phrases courtes, claires, chaleureuses et respectueuses. Pas de jargon technique.`;

const MANAGER_SYSTEM = `Tu es « وكيل الوسيط 777 », l'assistant IA personnel de M. Mounir Radoui, comme un collaborateur expérimenté du bureau.
${AGENCY_FACTS}
${LANGUAGE_RULE}
Tu l'aides à : répondre aux clients (préparer des messages WhatsApp dans son style poli : « السلام عليكم ورحمة الله... »), gérer le bureau (clients, rendez-vous, rappels), organiser les publicités, et repérer les opportunités.
Règles :
- Utilise les outils pour lire et modifier les données ; n'invente jamais un bien, un client, un chiffre ou un rendez-vous.
- Pour toute action qui modifie quelque chose (ajout de client, rendez-vous, annonces), fais-la si la demande est claire, puis confirme ce qui a été fait. Si une information indispensable manque (date, téléphone…), demande-la d'abord.
- Rien n'est publié sur les réseaux sans validation du gérant : create_ads prépare seulement des brouillons.
- Tu ne peux pas envoyer de WhatsApp toi-même : prepare_whatsapp prépare le message, le gérant l'envoie d'un clic.
- Tu n'as pas accès à Internet ni aux sites d'annonces externes ; pour les « opportunités », utilise find_opportunities (données du bureau) et dis-le honnêtement.
- Dates : fuseau Africa/Casablanca ; « demain », « samedi »… se calculent à partir de la date fournie dans le contexte.`;

const CUSTOMER_SYSTEM = `Tu es l'assistant en ligne du bureau immobilier Al Wassit 777 sur son site internet. Tu parles à des clients (acheteurs, locataires, MRE, investisseurs).
${AGENCY_FACTS}
${LANGUAGE_RULE}
Ton rôle : comprendre le besoin (achat/location, ville, quartier, type, budget, chambres), proposer les biens correspondants avec search_properties (2 à 4 max, avec prix et surface), répondre aux questions sur un bien (get_property), puis proposer une visite ou un rappel.
Pour transmettre une demande au bureau (send_request_to_agency), demande poliment le nom et le numéro de téléphone. Ne promets jamais un prix, une disponibilité ou un rendez-vous confirmé : c'est le bureau qui confirme.
Ne donne jamais d'informations internes (autres clients, chiffres du bureau). Si on te demande autre chose que l'immobilier, ramène poliment la conversation au sujet.`;

// Limite simple par adresse IP pour l'assistant public (évite les abus du quota IA).
const hits = new Map<string, { count: number; reset: number }>();
function rateLimited(ip: string, max = 40, windowMs = 10 * 60_000): boolean {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || h.reset < now) {
    hits.set(ip, { count: 1, reset: now + windowMs });
    return false;
  }
  h.count += 1;
  return h.count > max;
}

type Part = { text?: string; functionCall?: unknown; functionResponse?: unknown; thoughtSignature?: string };
function sanitizeContents(raw: unknown): { role: 'user' | 'model'; parts: Part[] }[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 60) return null;
  const out = [];
  for (const c of raw) {
    if (!c || (c.role !== 'user' && c.role !== 'model') || !Array.isArray(c.parts)) return null;
    const parts: Part[] = [];
    for (const p of c.parts.slice(0, 20)) {
      if (typeof p?.text === 'string') parts.push({ text: p.text.slice(0, 8000) });
      else if (p?.functionCall && typeof p.functionCall === 'object') parts.push({ functionCall: p.functionCall, ...(typeof p.thoughtSignature === 'string' ? { thoughtSignature: p.thoughtSignature } : {}) });
      else if (p?.functionResponse && typeof p.functionResponse === 'object') parts.push({ functionResponse: p.functionResponse });
    }
    if (parts.length) out.push({ role: c.role, parts });
  }
  return out.length ? out : null;
}

app.post('/api/agent/chat', async (req, res) => {
  const mode: AgentMode = req.body?.mode === 'manager' ? 'manager' : 'customer';
  if (mode === 'manager' && adminAuth && !(await isAdmin(req))) {
    res.status(401).json({ error: 'Connexion requise' });
    return;
  }
  if (mode === 'customer' && rateLimited(String(req.headers['x-forwarded-for'] || req.ip || 'local').split(',')[0].trim())) {
    res.status(429).json({ error: 'Trop de messages, réessayez dans quelques minutes' });
    return;
  }
  if (!ai) {
    res.status(503).json({ error: 'GEMINI_API_KEY non configurée' });
    return;
  }
  const contents = sanitizeContents(req.body?.contents);
  if (!contents) {
    res.status(400).json({ error: 'Conversation invalide' });
    return;
  }
  const today = new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Casablanca', dateStyle: 'full', timeStyle: 'short' });
  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: contents as never,
      config: {
        systemInstruction: `${mode === 'manager' ? MANAGER_SYSTEM : CUSTOMER_SYSTEM}\n\nDate et heure actuelles (Maroc) : ${today}.`,
        tools: [{ functionDeclarations: toolsForMode(mode).map((t) => ({ name: t.name, description: t.description, parametersJsonSchema: t.parameters })) }],
        temperature: 0.5,
      },
    });
    const content = response.candidates?.[0]?.content;
    const text = (content?.parts ?? []).filter((p) => typeof p.text === 'string' && !p.thought).map((p) => p.text).join('').trim();
    res.json({
      content: content ?? { role: 'model', parts: [{ text }] },
      text,
      functionCalls: (response.functionCalls ?? []).map((f) => ({ id: f.id, name: f.name, args: f.args ?? {} })),
    });
  } catch (err) {
    console.error('Erreur agent :', err);
    res.status(502).json({ error: 'Agent indisponible' });
  }
});

// Publication automatique sur Facebook / Instagram (annonce déjà validée par le gérant).
app.post('/api/meta/publish', async (req, res) => {
  if (!(await isAdmin(req))) {
    res.status(401).json({ error: 'Connexion du gérant requise' });
    return;
  }
  const { platform, caption, imageUrl, jpegBase64 } = req.body || {};
  if (typeof caption !== 'string' || !caption.trim() || (platform !== 'facebook' && platform !== 'instagram')) {
    res.status(400).json({ error: 'Paramètres invalides' });
    return;
  }
  try {
    const id =
      platform === 'facebook'
        ? await publishFacebook(caption, { url: imageUrl, jpegBase64 })
        : imageUrl
        ? await publishInstagram(caption, imageUrl)
        : (() => { throw new Error("Instagram exige une image en ligne (Firebase Storage)"); })();
    res.json({ id });
  } catch (err) {
    console.error('Erreur publication Meta :', err);
    res.status(502).json({ error: (err as Error).message });
  }
});

// ---------- « استوديو النشر » : du fichier (photo, vidéo, PDF) aux publications sur toutes les plateformes ----------
// Le navigateur envoie des images réduites, quelques images extraites des vidéos et le PDF (moins de 4 Mo au total,
// limite de Vercel) ; les fichiers originaux sont hébergés sur Firebase Storage pour la publication.
type InlineFile = { inlineData: { mimeType: string; data: string } };
const STUDIO_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

function sanitizeFiles(raw: unknown, max = 12): InlineFile[] {
  if (!Array.isArray(raw)) return [];
  let total = 0;
  const out: InlineFile[] = [];
  for (const f of raw.slice(0, max)) {
    if (!f || typeof f.data !== 'string' || !STUDIO_MIME.includes(f.mimeType)) continue;
    total += f.data.length;
    if (total > 4_500_000) break;
    out.push({ inlineData: { mimeType: f.mimeType, data: f.data } });
  }
  return out;
}

async function requireStudio(req: express.Request, res: express.Response): Promise<boolean> {
  if (adminAuth && !(await isAdmin(req))) {
    res.status(401).json({ error: 'Connexion requise' });
    return false;
  }
  if (!ai) {
    res.status(503).json({ error: 'GEMINI_API_KEY non configurée' });
    return false;
  }
  return true;
}

const EXTRACT_PROMPT = `Voici les photos, images de vidéo et/ou documents (PDF) d'un bien immobilier confié à l'agence Al Wassit 777 (Meknès).
Extrais uniquement ce qui est visible ou écrit ; laisse vide ("" ou 0) ce qui n'apparaît pas. N'invente rien (surtout pas le prix ni la surface).
Réponds en JSON : {"type": "Appartement"|"Villa"|"Maison"|"Terrain"|"Local Commercial"|"Bureau"|"Immeuble"|"Riad"|"Ferme"|"", "listingType": "vente"|"location"|"neuf"|"", "city": string, "district": string, "surface": number, "bedrooms": number, "bathrooms": number, "price": string, "features": string[], "description": string}
"features" et "description" en arabe (description : 2 à 4 phrases factuelles décrivant ce qu'on voit : pièces, état, vue, finitions).`;

app.post('/api/studio/extract', async (req, res) => {
  if (!(await requireStudio(req, res))) return;
  const files = sanitizeFiles(req.body?.files);
  if (!files.length) {
    res.status(400).json({ error: 'Aucun fichier lisible' });
    return;
  }
  try {
    const response = await ai!.models.generateContent({
      model: MODEL,
      contents: [{ role: 'user', parts: [...files, { text: EXTRACT_PROMPT }] }],
      config: { responseMimeType: 'application/json', temperature: 0.2 },
    });
    res.json({ info: JSON.parse(response.text || '{}') });
  } catch (err) {
    console.error('Erreur extraction studio :', err);
    res.status(502).json({ error: 'Analyse IA impossible' });
  }
});

app.post('/api/studio/posts', async (req, res) => {
  if (!(await requireStudio(req, res))) return;
  const { info, language } = req.body || {};
  const platforms: StudioNetwork[] = Array.isArray(req.body?.platforms)
    ? req.body.platforms.filter((p: unknown): p is StudioNetwork => STUDIO_NETWORK_IDS.includes(p as StudioNetwork))
    : [];
  if (!info || typeof info !== 'object' || !platforms.length) {
    res.status(400).json({ error: 'Paramètres manquants' });
    return;
  }
  const lang = STUDIO_LANGUAGES.some((l) => l.id === language) ? language : 'ar+fr';
  const langRule =
    lang === 'ar+fr'
      ? `Texte bilingue : d'abord la version arabe (style ci-dessus), une ligne vide, puis la version française. La limite de caractères s'applique au total ; hashtags en arabe et en français.`
      : `Langue : "${lang}".`;
  const photoCount = Math.max(0, Math.min(8, Number(req.body?.photoCount) || 0));
  const captionRule = photoCount
    ? `\nLes ${photoCount} premières images jointes sont les photos du bien, dans l'ordre : donne aussi "captions", une légende très courte en arabe (2 à 5 mots, ce qu'on voit réellement, ex. « صالون واسع ومشمس ») pour chacune, dans le même ordre.`
    : '';
  const specs = platforms.map((id) => {
    const s = studioSpec(id);
    return `- ${id} (${s.label}) : ${s.maxChars} caractères max, ${s.maxHashtags} hashtags max${s.title ? ', + un "title" court et accrocheur (moins de 90 caractères)' : ''}`;
  });
  const prompt = `Rédige une publication par plateforme pour ce bien. ${langRule}
Regarde les fichiers joints (photos, images de la vidéo, PDF) pour décrire les vrais atouts visibles, sans rien inventer.
Plateformes :
${specs.join('\n')}
Adapte le ton : YouTube et TikTok = titre accrocheur + description qui donne envie de visiter ; Google Business = annonce sobre sans hashtags ; Bluesky et Threads = très court.
Données du bien (JSON, saisies par le gérant — elles priment sur les fichiers) :
${JSON.stringify(info).slice(0, 4000)}${captionRule}
Réponds en JSON : {"posts": [{"platform": string, "text": string, "hashtags": string[], "title": string}], "captions": string[]}`;
  try {
    const response = await ai!.models.generateContent({
      model: MODEL,
      contents: [{ role: 'user', parts: [...sanitizeFiles(req.body?.files), { text: prompt }] }],
      config: { systemInstruction: SYSTEM, responseMimeType: 'application/json', temperature: 0.8 },
    });
    const parsed = JSON.parse(response.text || '{}');
    const posts = (Array.isArray(parsed.posts) ? parsed.posts : [])
      .filter((p: any) => platforms.includes(p?.platform) && typeof p.text === 'string')
      .map((p: any) => {
        const s = studioSpec(p.platform);
        return {
          platform: p.platform,
          text: p.text.slice(0, s.maxChars),
          hashtags: Array.isArray(p.hashtags) ? p.hashtags.filter((h: unknown) => typeof h === 'string').slice(0, s.maxHashtags) : [],
          title: typeof p.title === 'string' ? p.title.slice(0, 100) : '',
        };
      });
    const captions = Array.isArray(parsed.captions)
      ? parsed.captions.slice(0, photoCount).map((c: unknown) => (typeof c === 'string' ? c.slice(0, 40) : ''))
      : [];
    res.json({ posts, captions });
  } catch (err) {
    console.error('Erreur publications studio :', err);
    res.status(502).json({ error: 'Génération IA impossible' });
  }
});

// Retouche d'une photo (lumière, couleurs, netteté) sans modifier le bien : la publicité doit rester honnête.
app.post('/api/studio/image', async (req, res) => {
  if (!(await requireStudio(req, res))) return;
  const [image] = sanitizeFiles([req.body?.image], 1);
  if (!image || image.inlineData.mimeType === 'application/pdf') {
    res.status(400).json({ error: 'Image manquante' });
    return;
  }
  const prompt = `Retouche professionnelle de cette photo immobilière pour une publicité : meilleure lumière, couleurs naturelles et chaleureuses, ciel dégagé si visible, image nette et redressée.
Ne modifie PAS le bien : garde exactement les murs, pièces, meubles, fenêtres, la vue et les dimensions. N'ajoute ni texte, ni logo, ni objet.`;
  try {
    const response = await ai!.models.generateContent({
      model: IMAGE_MODEL,
      contents: [{ role: 'user', parts: [image, { text: prompt }] }],
      config: { responseModalities: ['TEXT', 'IMAGE'] },
    });
    const part = (response.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData?.data);
    if (!part?.inlineData?.data) throw new Error('Aucune image renvoyée');
    res.json({ mimeType: part.inlineData.mimeType || 'image/png', data: part.inlineData.data });
  } catch (err) {
    console.error('Erreur image studio :', err);
    res.status(502).json({ error: 'Retouche IA impossible' });
  }
});

// Programmation sur la plateforme via Metricool (publication validée par le gérant).
app.post('/api/studio/schedule', async (req, res) => {
  if (!(await isAdmin(req))) {
    res.status(401).json({ error: 'Connexion du gérant requise' });
    return;
  }
  const b = req.body || {};
  const isUrl = (u: unknown): u is string => typeof u === 'string' && /^https:\/\//.test(u);
  if (!STUDIO_NETWORK_IDS.includes(b.network) || typeof b.text !== 'string' || !b.text.trim()) {
    res.status(400).json({ error: 'Paramètres invalides' });
    return;
  }
  if (b.dateTime !== undefined && !(typeof b.dateTime === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(b.dateTime))) {
    res.status(400).json({ error: 'Date invalide' });
    return;
  }
  const input: StudioPostInput = {
    network: b.network,
    text: b.text.slice(0, studioSpec(b.network).maxChars),
    title: typeof b.title === 'string' ? b.title : undefined,
    images: Array.isArray(b.images) ? b.images.filter(isUrl).slice(0, 10) : [],
    video: isUrl(b.video) ? b.video : undefined,
    vertical: Boolean(b.vertical),
    aiImages: Boolean(b.aiImages),
    dateTime: b.dateTime,
  };
  try {
    res.json(await schedulePost(input));
  } catch (err) {
    console.error('Erreur Metricool :', err);
    res.status(502).json({ error: (err as Error).message });
  }
});

app.use('/api', (_req, res) => res.status(404).json({ error: 'Route inconnue' }));

export const aiEnabled = Boolean(ai);
export default app;
