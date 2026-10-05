// API de l'agent publicitaire et du وكيل الوسيط 777 (/api/...), clés gardées côté serveur.
// Utilisée par server.ts (AI Studio / Cloud Run / local) et par api/index.ts (Vercel).
import 'dotenv/config';
import express from 'express';
import { metaStatus, publishFacebook, publishInstagram } from './meta.js';
import { adminAuth, isAdmin } from './backend/firebaseAdmin.js';
import { MODEL, ai } from './backend/gemini.js';
import agentRoutes, { cronEnabled } from './backend/routes.js';
import { store } from './backend/store.js';
import { waStatus } from './backend/whatsapp.js';

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
// Le corps brut est gardé pour vérifier la signature des messages WhatsApp envoyés par Meta.
app.use(express.json({ limit: '20mb', verify: (req, _res, buf) => ((req as any).rawBody = buf) }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    ai: Boolean(ai),
    auth: Boolean(adminAuth),
    meta: metaStatus,
    whatsapp: waStatus,
    store: store.kind,
    cron: cronEnabled,
  });
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

// Assistant « وكيل الوسيط 777 » : conversation, recherche, documents, WhatsApp, rappels.
app.use('/api', agentRoutes);

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
