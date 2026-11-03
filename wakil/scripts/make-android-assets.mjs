// Remplace les icônes et écrans de démarrage Android par ceux de Wakil.
import { createRequire } from 'node:module';
import { readdirSync, writeFileSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');

const RES = 'android/app/src/main/res';
const star = (scale) => `<g transform="translate(32 32) scale(${scale})"><rect x="-15" y="-15" width="30" height="30" rx="3" fill="#E8AE4A"/><rect x="-15" y="-15" width="30" height="30" rx="3" fill="#E8AE4A" transform="rotate(45)"/><circle r="7.5" fill="#0F1420"/><circle r="3.2" fill="#55C7B9"/></g>`;
const icon = (round) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="100%" height="100%">${round ? '<circle cx="32" cy="32" r="32" fill="#0F1420"/>' : '<rect width="64" height="64" rx="14" fill="#0F1420"/>'}${star(0.9)}</svg>`;
const foreground = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="100%" height="100%">${star(0.62)}</svg>`;
const splash = (w, h) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="#0d121c"/><g transform="translate(${w / 2 - Math.min(w, h) * 0.11} ${h / 2 - Math.min(w, h) * 0.11}) scale(${(Math.min(w, h) * 0.22) / 64})"><rect width="64" height="64" rx="16" fill="#0F1420"/>${star(1)}</g></svg>`;

const dims = (f) => {
  const d = readFileSync(f);
  return [d.readUInt32BE(16), d.readUInt32BE(20)];
};
const browser = await chromium.launch();
const page = await browser.newPage();
for (const dir of readdirSync(RES)) {
  const full = join(RES, dir);
  if (!statSync(full).isDirectory()) continue;
  for (const file of readdirSync(full).filter((f) => f.endsWith('.png'))) {
    const path = join(full, file);
    const [w, h] = dims(path);
    const svg = file.startsWith('splash') ? splash(w, h) : file.includes('foreground') ? foreground : icon(file.includes('round'));
    await page.setViewportSize({ width: w, height: h });
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
    writeFileSync(path, await page.screenshot({ omitBackground: true }));
  }
}
await browser.close();
writeFileSync(join(RES, 'values/ic_launcher_background.xml'), '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#0F1420</color>\n</resources>\n');
console.log('✓ icônes et splash Android générés');
