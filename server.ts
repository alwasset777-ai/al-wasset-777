// Serveur unique de l'application (compatible Google AI Studio / Cloud Run) :
// - API de l'agent publicitaire (app.ts) ;
// - le site lui-même : Vite en développement, fichiers construits (dist/) en production.
// Lancement : `npm run dev` (développement) ou `npm run build && npm start` (production).
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import app, { aiEnabled } from './app.js';

const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';

// Configuration publique (non secrète) injectée dans la page au moment de l'exécution,
// pour que les valeurs Firebase définies dans les secrets fonctionnent sans reconstruire le site.
function publicConfigScript(): string {
  const cfg = {
    VITE_FIREBASE_API_KEY: process.env.VITE_FIREBASE_API_KEY,
    VITE_FIREBASE_AUTH_DOMAIN: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    VITE_FIREBASE_PROJECT_ID: process.env.VITE_FIREBASE_PROJECT_ID,
    VITE_FIREBASE_STORAGE_BUCKET: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    VITE_FIREBASE_APP_ID: process.env.VITE_FIREBASE_APP_ID,
  };
  return `<script>window.__APP_CONFIG__=${JSON.stringify(cfg).replace(/</g, '\\u003c')}</script>`;
}

async function start() {
  if (IS_PROD) {
    const dist = path.resolve(process.cwd(), 'dist');
    const indexHtml = fs.readFileSync(path.join(dist, 'index.html'), 'utf8').replace('<head>', `<head>${publicConfigScript()}`);
    app.use(express.static(dist, { index: false, maxAge: '1h' }));
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.type('html').send(indexHtml);
    });
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Al Wassit 777 sur http://localhost:${PORT} (${IS_PROD ? 'production' : 'développement'}, IA ${aiEnabled ? 'activée' : 'désactivée : modèles locaux'})`);
  });
}

start();
