// Point d'entrée Vercel : toutes les routes /api/* sont servies par l'application Express.
// Chargement protégé : si le serveur ne démarre pas, on renvoie la cause (sans détails sensibles)
// au lieu d'une page d'erreur muette.
import type { IncomingMessage, ServerResponse } from 'node:http';

let appPromise: Promise<(req: IncomingMessage, res: ServerResponse) => void> | null = null;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    appPromise ??= import('../app.js').then((m) => m.default as never);
    const app = await appPromise;
    return app(req, res);
  } catch (err) {
    appPromise = null;
    console.error('Démarrage du serveur impossible :', err);
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'Serveur indisponible', cause: String((err as Error)?.message || err).slice(0, 300) }));
  }
}
