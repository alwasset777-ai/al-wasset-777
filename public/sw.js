// Service worker minimal : rend l'application installable et garde la page d'accueil hors ligne.
// Les appels /api et Firebase passent toujours par le réseau (données à jour).
const CACHE = 'alwassit777-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/manifest.webmanifest'])));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== 'wasset-share').map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  // i.wasset comme cible de partage : contact (.vcf), numéro ou texte reçus d'une autre application.
  // On les garde un instant dans le cache, puis la page /iwasset les lit une fois (rien ne part au serveur).
  if (req.method === 'POST' && url.pathname === '/iwasset/share-target') {
    event.respondWith(
      (async () => {
        try {
          const form = await req.formData();
          const text = ['title', 'text', 'url'].map((k) => form.get(k)).filter((v) => typeof v === 'string' && v).join('\n');
          let vcf = '';
          for (const f of form.getAll('contact')) if (f && typeof f !== 'string') vcf += (await f.text()) + '\n';
          const c = await caches.open('wasset-share');
          await c.put('/__shared__', new Response(JSON.stringify({ text, vcf: vcf.slice(0, 200000), at: Date.now() }), { headers: { 'Content-Type': 'application/json' } }));
        } catch (e) {
          /* partage illisible : on ouvre quand même l'application */
        }
        return Response.redirect('/iwasset?shared=1', 303);
      })()
    );
    return;
  }
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  // Réseau d'abord, cache en secours (hors connexion).
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match('/')))
  );
});
