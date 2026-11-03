// GET /api/fetch?url=…  → texte lisible d'une page web publique (outil « Lire une page web »).
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cors, htmlToText, safeFetch } from './_lib/guard.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Méthode non autorisée' });
  const url = String(req.query.url || '');
  const raw = req.query.raw === '1';
  if (!url || url.length > 2000) return res.status(400).json({ error: 'Paramètre url manquant ou trop long.' });
  try {
    const r = await safeFetch(url);
    if (r.status >= 400) return res.status(502).json({ error: `La page a répondu ${r.status}.`, url: r.url });
    const isHtml = /html/.test(r.contentType) || /^\s*</.test(r.body);
    const out = isHtml && !raw ? htmlToText(r.body, r.url) : { title: '', text: r.body };
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).json({ url: r.url, title: out.title, contentType: r.contentType, text: out.text.slice(0, 60000) });
  } catch (e) {
    return res.status(400).json({ error: (e as Error).message });
  }
}
