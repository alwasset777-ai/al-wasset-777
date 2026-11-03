// GET /api/search?q=…  → résultats de recherche web gratuits (DuckDuckGo HTML, sans clé).
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cors, decode } from './_lib/guard.js';

export function parseDuckDuckGo(html: string) {
  const results: { title: string; url: string; snippet: string }[] = [];
  const blocks = html.split(/class="result results_links/).slice(1);
  for (const b of blocks) {
    const a = b.match(/class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!a) continue;
    let url = decode(a[1]);
    const uddg = url.match(/[?&]uddg=([^&]+)/);
    if (uddg) url = decodeURIComponent(uddg[1]);
    if (url.startsWith('//')) url = 'https:' + url;
    if (/duckduckgo\.com\/y\.js/.test(url)) continue; // publicités
    const snip = b.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
    results.push({
      title: decode(a[2].replace(/<[^>]+>/g, '')).trim(),
      url,
      snippet: decode((snip?.[1] || '').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim(),
    });
    if (results.length >= 8) break;
  }
  return results;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  const q = String(req.query.q || '').trim().slice(0, 300);
  if (!q) return res.status(400).json({ error: 'Paramètre q manquant.' });
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    const r = await fetch('https://html.duckduckgo.com/html/', {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36', 'Accept-Language': 'fr-FR,fr;q=0.9' },
      body: new URLSearchParams({ q, kl: 'fr-fr' }).toString(),
    }).finally(() => clearTimeout(t));
    const html = await r.text();
    const results = parseDuckDuckGo(html);
    res.setHeader('Cache-Control', 'public, max-age=600');
    return res.status(200).json({ query: q, results });
  } catch (e) {
    return res.status(502).json({ error: `Recherche indisponible : ${(e as Error).message}`, results: [] });
  }
}
