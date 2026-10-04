// API de l'agent publicitaire (/api/...), clés gardées côté serveur.
// Utilisée par server.ts (AI Studio / Cloud Run / local) et par api/index.ts (Vercel).
import 'dotenv/config';
import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { metaStatus, publishFacebook, publishInstagram } from './meta.js';

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey && apiKey !== 'MY_GEMINI_API_KEY' ? new GoogleGenAI({ apiKey }) : null;

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

// Assistant de discussion : le gérant parle à l'agent (darija, arabe, français).
// L'agent répond et peut proposer UNE action que l'application exécute (jamais de publication directe).
const CHAT_SYSTEM = `Tu es « وكيل الوسيط 777 », l'assistant IA de M. Mounir Radoui, gérant de l'agence immobilière "مكتب الوسيط 777 للخدمات العقارية" à Meknès (Avenue de Paris, Immeuble Select, 1er étage, N°52 ; tél. 0777777848 / 0777777959 ; signature « التجربة دليل الكفاءة »).
Tu l'aides à organiser ses publicités immobilières : rédiger des annonces, planifier, suivre les résultats, conseiller sur le marketing immobilier au Maroc.
Réponds TOUJOURS dans la langue du dernier message (darija marocaine en lettres arabes, arabe classique ou français), de façon courte, chaleureuse et respectueuse.
Tu reçois en contexte la liste des biens (id, titre, ville…) et l'état des annonces. N'invente jamais un bien ni un chiffre.
Actions possibles (au plus une par réponse) :
- {"type":"generate_ads","propertyId":<id>,"platforms":[...],"languages":[...]} pour préparer des annonces À VALIDER (plateformes : facebook, instagram, tiktok, whatsapp, snapchat, x, linkedin, threads, upscrolled, avito, mubawab, sarouty ; langues : ar, darija, fr). Si l'utilisateur ne précise pas, mets toutes les plateformes et les langues ar, darija, fr.
- {"type":"open","tab":"ads"|"crm"|"home"} pour ouvrir une page.
Si le bien demandé est ambigu, pose une question au lieu d'agir.
Réponds uniquement en JSON : {"reply": string, "action": objet ou null}.`;

app.post('/api/agent/chat', async (req, res) => {
  if (adminAuth && !(await isAdmin(req))) {
    res.status(401).json({ error: 'Connexion requise' });
    return;
  }
  if (!ai) {
    res.status(503).json({ error: 'GEMINI_API_KEY non configurée' });
    return;
  }
  const { messages, context } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'Messages manquants' });
    return;
  }
  const history = messages.slice(-20).map((m: { role?: string; text?: unknown }) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: String(m.text ?? '').slice(0, 4000) }],
  }));
  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: history,
      config: {
        systemInstruction: `${CHAT_SYSTEM}\n\nContexte actuel (JSON) :\n${JSON.stringify(context ?? {}).slice(0, 20000)}`,
        responseMimeType: 'application/json',
        temperature: 0.6,
      },
    });
    const parsed = JSON.parse(response.text || '{}');
    res.json({ reply: String(parsed.reply || ''), action: parsed.action && typeof parsed.action === 'object' ? parsed.action : null });
  } catch (err) {
    console.error('Erreur assistant :', err);
    res.status(502).json({ error: 'Assistant indisponible' });
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
