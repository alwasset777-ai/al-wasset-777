// GET /api/search?q=…  → résultats de recherche web gratuits, sans clé.
// Plusieurs moteurs essayés à la suite (certains bloquent les serveurs) :
// DuckDuckGo HTML → DuckDuckGo Lite → Mojeek → Wikipédia (toujours disponible).
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cors, decode } from './_lib/guard.js';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';
const clean = (s: string) => decode(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();

function unwrapDdg(href: string): string {
  let url = decode(href);
  const uddg = url.match(/[?&]uddg=([^&]+)/);
  if (uddg) url = decodeURIComponent(uddg[1]);
  if (url.startsWith('//')) url = 'https:' + url;
  return url;
}

export function parseDuckDuckGo(html: string): SearchResult[] {
  const results: SearchResult[] = [];
  for (const b of html.split(/class="result results_links/).slice(1)) {
    const a = b.match(/class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!a) continue;
    const url = unwrapDdg(a[1]);
    if (/duckduckgo\.com\/y\.js/.test(url)) continue; // publicités
    const snip = b.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
    results.push({ title: clean(a[2]), url, snippet: clean(snip?.[1] || '') });
    if (results.length >= 8) break;
  }
  return results;
}

export function parseDuckDuckGoLite(html: string): SearchResult[] {
  const results: SearchResult[] = [];
  const links = [...html.matchAll(/<a[^>]*href="([^"]+)"[^>]*class=['"]result-link['"][^>]*>([\s\S]*?)<\/a>|<a[^>]*class=['"]result-link['"][^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];
  const snippets = [...html.matchAll(/class=['"]result-snippet['"][^>]*>([\s\S]*?)<\/td>/g)].map((m) => clean(m[1]));
  links.forEach((m, i) => {
    const url = unwrapDdg(m[1] || m[3]);
    if (!/^https?:/.test(url) || /duckduckgo\.com\/y\.js/.test(url)) return;
    if (results.length < 8) results.push({ title: clean(m[2] || m[4]), url, snippet: snippets[i] || '' });
  });
  return results;
}

export function parseMojeek(html: string): SearchResult[] {
  const results: SearchResult[] = [];
  for (const b of html.split(/<li[^>]*>/).slice(1)) {
    const a = b.match(/<a[^>]*class="title"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/) || b.match(/<h2>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!a || !/^https?:/.test(a[1])) continue;
    const s = b.match(/<p class="s"[^>]*>([\s\S]*?)<\/p>/);
    results.push({ title: clean(a[2]), url: decode(a[1]), snippet: clean(s?.[1] || '') });
    if (results.length >= 8) break;
  }
  return results;
}

async function get(url: string, init: RequestInit = {}): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 9000);
  try {
    const r = await fetch(url, { ...init, signal: ctrl.signal, headers: { 'User-Agent': UA, 'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.7', ...(init.headers || {}) } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  } finally {
    clearTimeout(t);
  }
}

async function wikipedia(q: string, lang: string): Promise<SearchResult[]> {
  const data = JSON.parse(await get(`https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json&srlimit=6`));
  return (data?.query?.search || []).map((r: { title: string; snippet: string }) => ({
    title: r.title,
    url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(r.title.replace(/ /g, '_'))}`,
    snippet: clean(r.snippet || ''),
  }));
}

const ENGINES: [string, (q: string) => Promise<SearchResult[]>][] = [
  ['duckduckgo', async (q) => parseDuckDuckGo(await get('https://html.duckduckgo.com/html/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ q, kl: 'fr-fr' }).toString() }))],
  ['duckduckgo-lite', async (q) => parseDuckDuckGoLite(await get(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(q)}&kl=fr-fr`))],
  ['mojeek', async (q) => parseMojeek(await get(`https://www.mojeek.com/search?q=${encodeURIComponent(q)}`))],
  ['wikipedia', async (q) => [...(await wikipedia(q, 'fr')), ...(await wikipedia(q, 'en').catch(() => []))].slice(0, 8)],
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  const q = String(req.query.q || '').trim().slice(0, 300);
  if (!q) return res.status(400).json({ error: 'Paramètre q manquant.' });
  const tried: { engine: string; count: number; error?: string }[] = [];
  for (const [name, run] of ENGINES) {
    try {
      const results = await run(q);
      tried.push({ engine: name, count: results.length });
      if (results.length) {
        res.setHeader('Cache-Control', 'public, max-age=600');
        return res.status(200).json({ query: q, engine: name, results, tried });
      }
    } catch (e) {
      tried.push({ engine: name, count: 0, error: (e as Error).message });
    }
  }
  return res.status(200).json({ query: q, engine: null, results: [], tried });
}
