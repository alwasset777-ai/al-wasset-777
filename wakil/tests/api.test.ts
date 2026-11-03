import { describe, expect, it } from 'vitest';
import { assertPublicUrl, htmlToText, isPrivateIp } from '../api/_lib/guard';
import { parseDuckDuckGo, parseDuckDuckGoLite, parseMojeek } from '../api/search';

describe('sécurité du proxy web (SSRF)', () => {
  it('reconnaît les adresses privées', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.1.1', '172.20.0.1', '169.254.169.254', '::1', 'fd00::1', '::ffff:127.0.0.1', '100.64.0.1'])
      expect(isPrivateIp(ip), ip).toBe(true);
    for (const ip of ['8.8.8.8', '142.250.1.1', '2a00:1450::1']) expect(isPrivateIp(ip), ip).toBe(false);
  });
  it('refuse les URL internes ou exotiques', async () => {
    await expect(assertPublicUrl('http://localhost/x')).rejects.toThrow();
    await expect(assertPublicUrl('http://169.254.169.254/latest')).rejects.toThrow();
    await expect(assertPublicUrl('file:///etc/passwd')).rejects.toThrow();
    await expect(assertPublicUrl('http://user:pw@example.com')).rejects.toThrow();
    await expect(assertPublicUrl('http://8.8.8.8:22/')).rejects.toThrow();
    await expect(assertPublicUrl('http://[::1]/')).rejects.toThrow();
  });
});

describe('extraction de texte', () => {
  it('garde titres, listes et liens, retire scripts', () => {
    const r = htmlToText('<html><head><title>T &amp; co</title><script>evil()</script></head><body><h1>Titre</h1><p>Para <a href="/x">lien</a></p><ul><li>un</li></ul></body></html>', 'https://ex.com/a');
    expect(r.title).toBe('T & co');
    expect(r.text).toContain('# Titre');
    expect(r.text).toContain('lien (https://ex.com/x)');
    expect(r.text).toContain('- un');
    expect(r.text).not.toContain('evil');
  });
  it('lit les résultats DuckDuckGo', () => {
    const html = `<div class="result results_links results_links_deep web-result"><a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fpage&amp;rut=1">Exemple <b>page</b></a><a class="result__snippet" href="#">Un extrait &amp; plus</a></div>`;
    expect(parseDuckDuckGo(html)).toEqual([{ title: 'Exemple page', url: 'https://example.com/page', snippet: 'Un extrait & plus' }]);
  });
  it('lit DuckDuckGo Lite et Mojeek', () => {
    const lite = `<tr><td><a rel="nofollow" href="https://ex.com/a" class='result-link'>Titre A</a></td></tr><tr><td class='result-snippet'>Extrait <b>A</b></td></tr>`;
    expect(parseDuckDuckGoLite(lite)).toEqual([{ title: 'Titre A', url: 'https://ex.com/a', snippet: 'Extrait A' }]);
    const moj = `<ul class="results-standard"><li class="r1"><a class="ob" href="https://ex.com/b">x</a><h2><a class="title" href="https://ex.com/b">Titre B</a></h2><p class="s">Extrait B</p></li></ul>`;
    expect(parseMojeek(moj)).toEqual([{ title: 'Titre B', url: 'https://ex.com/b', snippet: 'Extrait B' }]);
  });
});
