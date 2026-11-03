// Export / téléchargement de fichiers (web, Android, Mac).
import DOMPurify from 'dompurify';
import { strToU8, zipSync } from 'fflate';
import type { WorkspaceFile } from '../core/types';
import { desktop } from '../core/platform';
import { toast } from './primitives';

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.split(',')[1] || '';
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function fileBlob(f: WorkspaceFile): Blob {
  if (f.binary && f.content.startsWith('data:')) return new Blob([dataUrlToBytes(f.content) as BlobPart], { type: f.mime });
  return new Blob([f.content], { type: f.mime + ';charset=utf-8' });
}

export async function saveBlob(blob: Blob, name: string) {
  const d = desktop();
  if (d) {
    const isText = /^text\/|json|xml|javascript|svg/.test(blob.type);
    const content = isText
      ? await blob.text()
      : await new Promise<string>((res) => {
          const r = new FileReader();
          r.onload = () => res(String(r.result));
          r.readAsDataURL(blob);
        });
    const full = await d.writeFile(name, content, !isText);
    toast(`Enregistré dans ${full}`, 'ok');
    return;
  }
  // Partage natif (mobile) si disponible, sinon téléchargement classique.
  const file = new File([blob], name.split('/').pop() || name, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
  if (/Android|iPhone|iPad/i.test(navigator.userAgent) && nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name });
      return;
    } catch {
      /* annulé → téléchargement */
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export const downloadFile = (f: WorkspaceFile) => saveBlob(fileBlob(f), f.path.split('/').pop() || f.path);

export async function downloadZip(files: WorkspaceFile[], name = 'wakil-fichiers.zip') {
  const entries: Record<string, Uint8Array> = {};
  for (const f of files) entries[f.path] = f.binary && f.content.startsWith('data:') ? dataUrlToBytes(f.content) : strToU8(f.content);
  const zip = zipSync(entries, { level: 6 });
  await saveBlob(new Blob([zip as BlobPart], { type: 'application/zip' }), name);
}

/** Ouvre une version imprimable (→ « Enregistrer en PDF »). */
export function printAsPdf(title: string, rawHtml: string) {
  const html = DOMPurify.sanitize(rawHtml, { FORBID_TAGS: ['script', 'style', 'iframe', 'form'] });
  const w = window.open('', '_blank');
  if (!w) {
    toast('Autorisez les fenêtres pour exporter en PDF.', 'danger');
    return;
  }
  w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${title.replace(/</g, '&lt;')}</title>
<style>body{font:15px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;max-width:760px;margin:40px auto;padding:0 24px;color:#171a21}
h1,h2,h3{line-height:1.25}pre{background:#f3f1ec;padding:12px;border-radius:8px;overflow:auto}code{font-family:Menlo,monospace;font-size:.9em}
table{border-collapse:collapse}td,th{border:1px solid #ddd;padding:6px 10px}a{color:#23857a}@media print{body{margin:0}}</style></head>
<body>${html}<script>setTimeout(()=>print(),300)<\/script></body></html>`);
  w.document.close();
}
