// Genera le illustrazioni di riserva (usate finché non ci sono le foto vere)
// come file WebP in src/assets/art/. Così le immagini sono nell'HTML e si
// vedono anche nei visualizzatori che bloccano JavaScript.
// Serve Playwright (npx playwright) e il server di sviluppo avviato: npm run dev
//
//   node scripts/genera-illustrazioni.mjs [http://localhost:5173]

import { writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright'));
}

const BASE = process.argv[2] || 'http://localhost:5173';
const JOBS = [
  ['margherita', 'slice:margherita', 720, 900],
  ['bianca', 'slice:bianca', 720, 900],
  ['patate', 'slice:patate', 720, 900],
  ['diavola', 'slice:diavola', 720, 900],
  ['fiori', 'slice:fiori', 720, 900],
  ['mortadella', 'slice:mortadella', 720, 900],
  ['impasto', 'art:impasto', 720, 900],
  ['supli', 'art:supli', 1200, 820],
  ['fritti', 'art:fritti', 1200, 820],
  ['feste', 'art:feste', 1200, 820],
  ['forno', 'art:forno', 1200, 820],
  ['consegna', 'art:consegna', 1200, 820],
  ['teglia', 'teglia:margherita', 1400, 960],
];

mkdirSync('src/assets/art', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${BASE}/scripts/vuota.html`).catch(() => page.goto(BASE));
for (const [name, key, w, h] of JOBS) {
  const data = await page.evaluate(async ([key, w, h]) => {
    const art = await import('/src/lib/pizza-art.js');
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const [kind, k] = key.split(':');
    if (kind === 'slice') art.renderSliceArt(c, k);
    else if (kind === 'teglia') art.renderTegliaArt(c);
    else art.renderPlaceholderArt(c, k);
    return c.toDataURL('image/webp', 0.8);
  }, [key, w, h]);
  const buf = Buffer.from(data.split(',')[1], 'base64');
  writeFileSync(`src/assets/art/${name}.webp`, buf);
  console.log(`✓ src/assets/art/${name}.webp (${Math.round(buf.length / 1024)} KB)`);
}
await browser.close();
