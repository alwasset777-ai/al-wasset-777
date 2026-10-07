// Génère le fichier MP4 du fichier welcome-video.html (image par image avec Chromium, puis ffmpeg).
// Usage :
//   node tools/video/render.mjs                       → public/videos/al-wasset-777-bienvenue.mp4
//   node tools/video/render.mjs --preview 5,30,80     → captures PNG à ces secondes (pour vérifier)
//   options : --fps 30  --crf 24  --out chemin.mp4  --music fichier.wav
// Prérequis : playwright (Chromium), ffmpeg et python3 + numpy (musique).
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/node-tools/node_modules/playwright')); }

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const FPS = Number(opt('--fps', 30));
const out = path.resolve(root, opt('--out', 'public/videos/al-wasset-777-bienvenue.mp4'));
const musicArg = opt('--music', null);
const preview = opt('--preview', null);

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.goto('file://' + path.join(here, 'welcome-video.html'));
await page.evaluate(() => document.fonts.ready);
const total = await page.evaluate(() => window.TOTAL);

if (preview) {
  const dir = path.join(here, 'preview');
  mkdirSync(dir, { recursive: true });
  for (const t of preview.split(',').map(Number)) {
    await page.evaluate((t) => window.renderAt(t), t);
    await page.screenshot({ path: path.join(dir, `t${String(t).padStart(5, '0')}.png`) });
  }
  console.log('preview →', dir);
  await browser.close();
  process.exit(0);
}

mkdirSync(path.dirname(out), { recursive: true });
// Musique : fichier fourni, sinon générée à la bonne durée par music.py.
let music = musicArg && path.resolve(musicArg);
if (!music) {
  execFileSync('python3', [path.join(here, 'music.py'), String(total)], { stdio: 'inherit' });
  music = path.join(here, 'music.wav');
}
const frames = Math.round(total * FPS);
const ff = spawn('ffmpeg', [
  '-y', '-loglevel', 'error',
  '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
  '-i', music,
  '-map', '0:v', '-map', '1:a', '-shortest',
  '-af', `afade=t=in:d=1.5,afade=t=out:st=${Math.max(0, total - 3)}:d=3`,
  '-c:v', 'libx264', '-preset', 'slow', '-crf', opt('--crf', '24'), '-pix_fmt', 'yuv420p', '-profile:v', 'high',
  '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart',
  out,
], { stdio: ['pipe', 'inherit', 'inherit'] });

console.log(`${frames} images (${total}s à ${FPS} i/s) →`, out);
for (let f = 0; f < frames; f++) {
  await page.evaluate((t) => window.renderAt(t), f / FPS);
  const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  if (f % (FPS * 10) === 0) console.log(`  ${Math.round((f / frames) * 100)}%`);
}
ff.stdin.end();
await new Promise((r) => ff.on('close', r));
await browser.close();
console.log('terminé');
