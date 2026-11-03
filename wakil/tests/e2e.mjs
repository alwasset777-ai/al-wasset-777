// Test de bout en bout : vrai navigateur, IA simulée (aucune clé réelle nécessaire).
// Usage : npm run build && npm run e2e
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');

const PORT = 4173;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
await new Promise((r) => setTimeout(r, 2500));
mkdirSync('tests/screens', { recursive: true });

const SITE = '<!doctype html><html><head><title>Agence</title></head><body><h1>Agence Al Wasset 777</h1></body></html>';
function gemini(body) {
  const sys = body.systemInstruction?.parts?.[0]?.text || '';
  const contents = body.contents || [];
  const last = contents[contents.length - 1];
  const text = (p) => ({ candidates: [{ content: { role: 'model', parts: [{ text: p }] }, finishReason: 'STOP' }] });
  if (body.tools?.some((t) => t.google_search))
    return { candidates: [{ content: { parts: [{ text: 'Meknès compte environ 630 000 habitants (2024).' }] }, groundingMetadata: { groundingChunks: [{ web: { uri: 'https://fr.wikipedia.org/wiki/Mekn%C3%A8s', title: 'Meknès — Wikipédia' } }] } }] };
  if (sys.includes('Réponds uniquement « OK »')) return text('OK');
  if (sys.includes('planificateur')) return text('{"title":"Site vitrine de l’agence","steps":[{"title":"Rechercher des informations sur Meknès","detail":"web_search"},{"title":"Créer le site index.html","detail":"write_file"}]}');
  if (sys.includes('contrôleur qualité')) return text('{"ok":true,"notes":"Le site existe et répond à l’objectif.","fixes":[]}');
  const hasResponse = last?.parts?.some((p) => p.functionResponse);
  const prompt = JSON.stringify(last?.parts || []);
  if (body.tools && !hasResponse && prompt.includes('MAINTENANT : Rechercher')) return { candidates: [{ content: { role: 'model', parts: [{ functionCall: { name: 'web_search', args: { query: 'Meknès population' } } }] } }] };
  if (body.tools && !hasResponse && prompt.includes('MAINTENANT : Créer le site')) return { candidates: [{ content: { role: 'model', parts: [{ functionCall: { name: 'write_file', args: { path: 'site/index.html', content: SITE } } }] } }] };
  if (hasResponse) return text('Étape terminée (résultat obtenu).');
  if (prompt.includes('Rédige la réponse finale')) return text('## Votre site est prêt\nLe fichier **site/index.html** contient la page vitrine.\n\nSource : [Wikipédia](https://fr.wikipedia.org/wiki/Mekn%C3%A8s)');
  return text('Bonjour ! Je suis **Wakil**. Comment puis-je vous aider ?');
}

const errors = [];
const browser = await chromium.launch();
let failed = false;
const check = (cond, msg) => {
  console.log(cond ? '  ✓' : '  ✗', msg);
  if (!cond) failed = true;
};

for (const [name, viewport] of [
  ['desktop', { width: 1366, height: 860 }],
  ['mobile', { width: 390, height: 844 }],
]) {
  console.log(`\n▶ ${name}`);
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: name === 'mobile' ? 2 : 1, colorScheme: name === 'mobile' ? 'dark' : 'light' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(`${name}: ${m.text()}`));
  await page.route('https://generativelanguage.googleapis.com/**', async (route) => {
    const r = route.request();
    if (r.method() === 'GET') return route.fulfill({ json: { models: [{ name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] }, { name: 'models/gemini-2.5-pro', supportedGenerationMethods: ['generateContent'] }] } });
    return route.fulfill({ json: gemini(JSON.parse(r.postData() || '{}')) });
  });
  await page.goto(`http://localhost:${PORT}/`);

  // Onboarding
  await page.getByPlaceholder('Votre prénom').fill('Mounir');
  await page.screenshot({ path: `tests/screens/${name}-1-onboarding.png` });
  await page.getByRole('button', { name: /Commencer/ }).click();
  await page.getByLabel('Clé Google Gemini').fill('AIza-test-key');
  await page.getByRole('button', { name: 'Enregistrer et tester' }).first().click();
  await page.getByText(/fonctionne ✓/).waitFor({ timeout: 10000 });
  check(true, 'clé testée avec succès');
  await page.getByRole('button', { name: /Continuer/ }).click();
  await page.getByRole('button', { name: /Ouvrir Wakil/ }).click();
  await page.getByText(/Bonjour, Mounir|Bonsoir, Mounir|Bonne nuit, Mounir/).waitFor();
  check(true, 'accueil affiché avec le prénom');
  await page.screenshot({ path: `tests/screens/${name}-2-accueil.png` });

  // Tâche autonome
  await page.getByLabel('Message').fill('Crée un site vitrine pour mon agence à Meknès');
  await page.getByLabel('Envoyer').click();
  await page.getByTestId('task-card').waitFor();
  await page.getByText('Terminée').first().waitFor({ timeout: 20000 });
  check(true, 'tâche agent terminée');
  check(await page.getByText('Votre site est prêt').waitFor({ timeout: 8000 }).then(() => true, () => false), 'réponse finale affichée');
  check(await page.getByRole('button', { name: /site\/index.html/ }).waitFor({ timeout: 8000 }).then(() => true, () => false), 'fichier livré visible');
  check(await page.getByText(/Contrôle qualité/).isVisible(), 'contrôle qualité affiché');
  await page.screenshot({ path: `tests/screens/${name}-3-agent.png`, fullPage: false });

  // Fichier
  await page.getByRole('button', { name: /site\/index.html/ }).click();
  await page.locator('iframe').waitFor();
  check(await page.frameLocator('iframe').getByText('Agence Al Wasset 777').isVisible(), 'aperçu HTML du fichier');
  await page.screenshot({ path: `tests/screens/${name}-4-fichier.png` });

  // Mode chat
  await page.goto(`http://localhost:${PORT}/#/chat`);
  await page.getByRole('button', { name: /Nouvelle/ }).first().click();
  await page.getByLabel('Message').fill('Salut');
  await page.getByLabel('Envoyer').click();
  await page.getByText('Je suis').waitFor({ timeout: 10000 });
  check(true, 'réponse en mode chat');
  await page.screenshot({ path: `tests/screens/${name}-5-chat.png` });

  // Pages principales
  for (const [route, text] of [
    ['tasks', 'Tâches'],
    ['projects', 'Agence Al Wasset 777'],
    ['history', 'Historique'],
    ['tools', 'Outils intégrés'],
    ['memory', 'Mémoire'],
    ['settings/models', 'Modèle par défaut'],
    ['install', 'Installer Wakil'],
    ['guide', 'Guide Wakil'],
  ]) {
    await page.goto(`http://localhost:${PORT}/#/${route}`);
    const ok = await page.getByText(text).first().waitFor({ timeout: 5000 }).then(() => true, () => false);
    check(ok, `page ${route}`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    check(!overflow, `pas de défilement horizontal (${route})`);
    if (['tasks', 'projects', 'settings/models', 'install', 'guide'].includes(route)) await page.screenshot({ path: `tests/screens/${name}-page-${route.replace('/', '-')}.png` });
  }
  await ctx.close();
}
await browser.close();
server.kill();
if (errors.length) {
  console.log('\nErreurs console :\n' + errors.join('\n'));
  failed = true;
}
console.log(failed ? '\n✗ ÉCHEC' : '\n✓ Tous les tests E2E passent');
process.exit(failed ? 1 : 0);
