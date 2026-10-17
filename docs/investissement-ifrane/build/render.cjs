// Impression des HTML en PDF (Chromium via Playwright). Usage : node render.cjs '<json jobs>'
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }

(async () => {
  const jobs = JSON.parse(process.argv[2]);
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const j of jobs) {
    await page.goto('file://' + j.html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const rtl = j.lang === 'ar';
    const font = rtl ? "'Cairo', sans-serif" : "'Inter', sans-serif";
    await page.pdf({
      path: j.pdf, format: 'A4', printBackground: true, preferCSSPageSize: true,
      displayHeaderFooter: true, headerTemplate: '<div></div>',
      footerTemplate: `<div style="width:100%;font-family:${font};font-size:7px;color:#8a8f92;padding:0 15mm;display:flex;justify-content:space-between;direction:${rtl ? 'rtl' : 'ltr'}"><span>${j.footer}</span><span style="direction:ltr"><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
    });
    console.log('PDF', j.pdf);
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
