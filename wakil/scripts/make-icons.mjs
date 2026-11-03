// Génère les icônes PNG (PWA, iPhone, Android, Mac) à partir du logo SVG.
// Usage : node scripts/make-icons.mjs   (utilise le Chromium de Playwright)
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { mkdirSync, writeFileSync } from 'node:fs';

const logo = (pad = 0, rounded = true) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="100%" height="100%">
<rect width="64" height="64" rx="${rounded ? 16 : 0}" fill="#0F1420"/>
<g transform="translate(32 32) scale(${1 - pad})"><rect x="-15" y="-15" width="30" height="30" rx="3" fill="#E8AE4A"/>
<rect x="-15" y="-15" width="30" height="30" rx="3" fill="#E8AE4A" transform="rotate(45)"/><circle r="7.5" fill="#0F1420"/><circle r="3.2" fill="#55C7B9"/></g></svg>`;

const out = [
  ['public/icons/icon-192.png', 192, logo(0, true)],
  ['public/icons/icon-512.png', 512, logo(0, true)],
  ['public/icons/icon-maskable-512.png', 512, logo(0.25, false)],
  ['public/icons/apple-touch-icon.png', 180, logo(0.1, false)],
  ['desktop/build/icon.png', 1024, logo(0.08, true)],
  ['android-res/icon-1024.png', 1024, logo(0.25, false)],
];
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [file, size, svg] of out) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  mkdirSync(file.split('/').slice(0, -1).join('/'), { recursive: true });
  writeFileSync(file, await page.screenshot({ omitBackground: true }));
  console.log('✓', file);
}
await browser.close();
