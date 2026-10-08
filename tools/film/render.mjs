// Rend le film image par image (Chromium) et l'encode avec la bande son (ffmpeg).
// Les images identiques à la précédente ne sont pas recapturées (gain de temps énorme sur les plans fixes).
//
//   node render.mjs                         → build/film.mp4 (timeline.js + film-audio.m4a)
//   node render.mjs --tl timeline-court --audio build/court-audio.m4a --out build/court.mp4
//   node render.mjs --preview 5,40,120      → captures PNG dans build/preview/
//   options : --fps 30 --crf 26 --scale 720 (largeur de sortie) --abr 96k --from 0 --to 60 (extrait) --workers 2
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/node-tools/node_modules/playwright')); }

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const FPS = Number(opt('--fps', 30));
const TL = opt('--tl', 'timeline');
const out = path.resolve(here, opt('--out', 'build/film.mp4'));
const audio = path.resolve(here, opt('--audio', 'build/film-audio.m4a'));
const preview = opt('--preview', null);
const WORKERS = Number(opt('--workers', 2));

async function openPage() {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.goto('file://' + path.join(here, 'film.html') + '?tl=' + TL);
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((i) => i.decode().catch(() => {}))); });
  return { browser, page };
}

const { browser: b0, page: p0 } = await openPage();
const total = await p0.evaluate(() => window.TOTAL);

if (preview) {
  const dir = path.join(here, 'build', 'preview');
  mkdirSync(dir, { recursive: true });
  for (const t of preview.split(',').map(Number)) {
    await p0.evaluate((t) => window.renderAt(t), t);
    await p0.evaluate(() => Promise.all([...document.images].filter((i) => i.offsetParent).map((i) => i.decode().catch(() => {}))));
    await p0.screenshot({ path: path.join(dir, `t${String(Math.round(t * 10)).padStart(6, '0')}.png`) });
  }
  console.log('aperçus →', dir);
  await b0.close();
  process.exit(0);
}
await b0.close();

const from = Number(opt('--from', 0));
const to = Math.min(total, Number(opt('--to', total)));
const nFrames = Math.round((to - from) * FPS);
const tmp = path.join(here, 'build', 'parts');
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });

// Chaque worker rend une tranche en vidéo sans son ; on concatène ensuite.
async function worker(w, f0, f1) {
  const { browser, page } = await openPage();
  const file = path.join(tmp, `part-${w}.mp4`);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    ...(opt('--scale', null) ? ['-vf', `scale=${opt('--scale')}:-2:flags=lanczos`] : []),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', opt('--crf', '26'), '-pix_fmt', 'yuv420p', '-r', String(FPS), file], { stdio: ['pipe', 'inherit', 'inherit'] });
  let last = null, lastSig = null, shots = 0;
  for (let f = f0; f < f1; f++) {
    const t = from + f / FPS;
    const sig = await page.evaluate((t) => window.renderAt(t), t);
    if (sig !== lastSig || !last) {
      last = await page.screenshot({ type: 'jpeg', quality: 90 });
      lastSig = sig;
      shots++;
    }
    if (!ff.stdin.write(last)) await new Promise((r) => ff.stdin.once('drain', r));
    if ((f - f0) % (FPS * 30) === 0) console.log(`  [w${w}] ${Math.round(((f - f0) / (f1 - f0)) * 100)}% (captures ${shots})`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await browser.close();
  return file;
}

console.log(`${nFrames} images (${(to - from).toFixed(1)} s) en ${WORKERS} tranches`);
const per = Math.ceil(nFrames / WORKERS);
const files = await Promise.all(Array.from({ length: WORKERS }, (_, w) => worker(w, w * per, Math.min(nFrames, (w + 1) * per))));
const list = path.join(tmp, 'list.txt');
writeFileSync(list, files.map((f) => `file '${f}'`).join('\n'));
mkdirSync(path.dirname(out), { recursive: true });
await new Promise((res, rej) => {
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-ss', String(from), '-t', String(to - from), '-i', audio,
    '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', opt('--abr', '96k'), '-shortest', '-movflags', '+faststart', out], { stdio: 'inherit' });
  ff.on('close', (c) => (c ? rej(new Error('ffmpeg ' + c)) : res()));
});
console.log('terminé →', out);
