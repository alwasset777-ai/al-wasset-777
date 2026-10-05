// API de l'agent publicitaire (/api/...), clés gardées côté serveur.
// Utilisée par server.ts (AI Studio / Cloud Run / local) et par api/index.ts (Vercel).
import 'dotenv/config';
import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { metaStatus, publishFacebook, publishInstagram } from './meta.js';
import { toolsForMode, type AgentMode } from './src/agent/toolDefs.js';

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
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
  res.json({ ok: true, ai: Boolean(ai), auth: Boolean(adminAuth), meta: metaStatus });
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

app.use('/api', (_req, res) => res.status(404).json({ error: 'Route inconnue' }));

export const aiEnabled = Boolean(ai);
export default app;
