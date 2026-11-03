// Protection SSRF : n'autorise que des adresses publiques en http/https.
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export function isPrivateIp(ip: string): boolean {
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224
    );
  }
  const l = ip.toLowerCase();
  return l === '::' || l === '::1' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80') || l.startsWith('ff');
}

export async function assertPublicUrl(raw: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error('Adresse invalide.');
  }
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error('Seules les adresses http(s) sont autorisées.');
  if (u.username || u.password) throw new Error('Identifiants dans l’URL interdits.');
  if (u.port && !['80', '443', '8080', '8443'].includes(u.port)) throw new Error('Port non autorisé.');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (/^(localhost|.*\.local|.*\.internal|metadata\.google\.internal)$/i.test(host)) throw new Error('Adresse interne interdite.');
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new Error('Adresse interne interdite.');
  return u;
}

/** Télécharge une URL publique en suivant au plus 4 redirections (chacune vérifiée). */
export async function safeFetch(raw: string, maxBytes = 3_000_000): Promise<{ url: string; status: number; contentType: string; body: string }> {
  let current = raw;
  for (let i = 0; i < 5; i++) {
    const u = await assertPublicUrl(current);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(u, {
      redirect: 'manual',
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WakilBot/0.1; +https://wakil-ia.vercel.app)', Accept: 'text/html,application/json,text/plain;q=0.9,*/*;q=0.5', 'Accept-Language': 'fr,en;q=0.8,ar;q=0.6' },
    }).finally(() => clearTimeout(timer));
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      current = new URL(res.headers.get('location')!, u).toString();
      continue;
    }
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maxBytes) {
        await reader.cancel();
        break;
      }
      chunks.push(value);
    }
    const buf = Buffer.concat(chunks);
    return { url: u.toString(), status: res.status, contentType: res.headers.get('content-type') || '', body: buf.toString('utf8') };
  }
  throw new Error('Trop de redirections.');
}

export function cors(res: { setHeader: (k: string, v: string) => void }) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', laquo: '«', raquo: '»', eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç' };
export const decode = (s: string) =>
  s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e: string) =>
    e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENT[e.toLowerCase()] ?? m,
  );

/** Transforme du HTML en texte lisible (titres, paragraphes, listes, liens). */
export function htmlToText(html: string, baseUrl: string): { title: string; text: string } {
  const title = decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').trim()).replace(/\s+/g, ' ');
  let body = html.match(/<main[\s\S]*?<\/main>/i)?.[0] || html.match(/<article[\s\S]*?<\/article>/i)?.[0] || html.match(/<body[\s\S]*?<\/body>/i)?.[0] || html;
  body = body
    .replace(/<(script|style|noscript|svg|iframe|template|nav|footer|form)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<a\s[^>]*href="([^"#][^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, txt: string) => {
      const t = txt.replace(/<[^>]+>/g, '').trim();
      try {
        return t ? `${t} (${new URL(decode(href), baseUrl).toString()})` : '';
      } catch {
        return t;
      }
    })
    .replace(/<h([1-6])[^>]*>/gi, (_m, n) => '\n\n' + '#'.repeat(+n) + ' ')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<(br|\/p|\/div|\/tr|\/h[1-6]|\/li|\/section|\/table)[^>]*>/gi, '\n')
    .replace(/<t[dh][^>]*>/gi, ' | ')
    .replace(/<[^>]+>/g, ' ');
  const text = decode(body)
    .replace(/[ \t\f\v ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { title, text };
}
