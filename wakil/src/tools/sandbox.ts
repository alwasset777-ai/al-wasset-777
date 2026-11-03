// Exécution de JavaScript dans un « bac à sable » (Web Worker isolé, sans réseau,
// arrêté automatiquement après un délai). Sert aux calculs, à l'analyse de
// données (CSV/JSON) et à la génération de fichiers.

export interface SandboxResult {
  ok: boolean;
  logs: string[];
  result?: string;
  error?: string;
  files: { path: string; content: string }[];
  ms: number;
}

const WORKER_SRC = `
const send = (m) => postMessage(m);
// Pas de réseau dans le bac à sable.
for (const k of ['fetch','XMLHttpRequest','WebSocket','EventSource','importScripts','indexedDB','caches','BroadcastChannel']) {
  try { Object.defineProperty(self, k, { value: undefined, configurable: false, writable: false }); } catch (e) {}
}
onmessage = async (ev) => {
  const { code, files } = ev.data;
  const logs = [];
  const out = [];
  const fmt = (v) => { try { return typeof v === 'string' ? v : JSON.stringify(v, null, 2); } catch (e) { return String(v); } };
  const cons = { log: (...a) => logs.push(a.map(fmt).join(' ')), error: (...a) => logs.push('[erreur] ' + a.map(fmt).join(' ')), warn: (...a) => logs.push('[attention] ' + a.map(fmt).join(' ')), table: (d) => logs.push(fmt(d)) };
  const api = {
    readFile: (p) => { if (!(p in files)) throw new Error('Fichier introuvable : ' + p); return files[p]; },
    listFiles: () => Object.keys(files),
    writeFile: (p, c) => { out.push({ path: String(p), content: typeof c === 'string' ? c : fmt(c) }); },
    parseCSV: (text, sep) => {
      const s = sep || (text.split('\\n')[0].includes(';') ? ';' : ',');
      const rows = []; let row = [], cur = '', q = false;
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (q) { if (ch === '"' && text[i+1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
        else if (ch === '"') q = true; else if (ch === s) { row.push(cur); cur = ''; }
        else if (ch === '\\n' || ch === '\\r') { if (ch === '\\r' && text[i+1] === '\\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
        else cur += ch;
      }
      if (cur || row.length) { row.push(cur); rows.push(row); }
      const [head, ...rest] = rows.filter(r => r.length > 1 || r[0] !== '');
      return rest.map(r => Object.fromEntries(head.map((h, i) => [h.trim(), isNaN(+r[i]) || r[i] === '' ? r[i] : +r[i]])));
    },
  };
  try {
    const fn = new Function('console', 'wakil', '"use strict"; return (async () => {\\n' + code + '\\n})();');
    const r = await fn(cons, api);
    send({ ok: true, logs, result: r === undefined ? undefined : fmt(r), files: out });
  } catch (e) {
    send({ ok: false, logs, error: String(e && e.stack || e), files: out });
  }
};`;

export function runInSandbox(code: string, files: Record<string, string> = {}, timeoutMs = 15000): Promise<SandboxResult> {
  const t0 = Date.now();
  return new Promise((resolve) => {
    if (typeof Worker === 'undefined') {
      resolve({ ok: false, logs: [], error: 'Exécution indisponible sur cet appareil.', files: [], ms: 0 });
      return;
    }
    const url = URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' }));
    const w = new Worker(url);
    const done = (r: Omit<SandboxResult, 'ms'>) => {
      clearTimeout(timer);
      w.terminate();
      URL.revokeObjectURL(url);
      resolve({ ...r, logs: r.logs.slice(0, 200), ms: Date.now() - t0 });
    };
    const timer = setTimeout(() => done({ ok: false, logs: [], error: `Temps dépassé (${timeoutMs / 1000} s) : le code a été arrêté.`, files: [] }), timeoutMs);
    w.onmessage = (e) => done(e.data);
    w.onerror = (e) => done({ ok: false, logs: [], error: e.message || 'Erreur du bac à sable', files: [] });
    w.postMessage({ code, files });
  });
}
