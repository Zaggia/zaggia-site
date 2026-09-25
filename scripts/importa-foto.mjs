// Ottimizza le foto scaricate da Canva e le mette dove il sito le cerca.
//
//   1. Salva le foto in  foto-originali/  con i nomi della tabella nel README
//      (es. "supli.png", "hero-teglia.jpg").
//   2. Esegui:  npm run foto
//
// Ogni foto viene ridimensionata (max 1800 px) e convertita in WebP dentro
// src/assets/foto/. Al prossimo "npm run build" il sito usa le foto vere al
// posto delle illustrazioni generate.

import { readdir, mkdir } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';
import sharp from 'sharp';

const SRC = 'foto-originali';
const OUT = 'src/assets/foto';
const EXPECTED = [
  'hero-teglia', 'pizza-bianca', 'patate-rosmarino', 'diavola', 'fiori-alici', 'mortadella-pistacchio',
  'supli', 'fritti', 'impasto', 'consegna', 'feste', 'forno',
];

await mkdir(OUT, { recursive: true });
const files = (await readdir(SRC)).filter((f) => /\.(jpe?g|png|webp|avif|heic)$/i.test(f));
if (!files.length) {
  console.log(`Nessuna foto in ${SRC}/. Salvale lì con i nomi indicati nel README.`);
  process.exit(0);
}

const found = new Set();
for (const f of files) {
  const name = basename(f, extname(f)).toLowerCase().trim().replace(/\s+/g, '-');
  if (!EXPECTED.includes(name)) {
    console.warn(`⚠︎  "${f}" ignorata: il nome deve essere uno di questi → ${EXPECTED.join(', ')}`);
    continue;
  }
  const out = join(OUT, `${name}.webp`);
  const info = await sharp(join(SRC, f))
    .rotate()
    .resize({ width: 1800, height: 1800, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80, effort: 5 })
    .toFile(out);
  found.add(name);
  console.log(`✓ ${f} → ${out} (${info.width}×${info.height}, ${Math.round(info.size / 1024)} KB)`);
}

const missing = EXPECTED.filter((n) => !found.has(n));
if (missing.length) console.log(`\nAncora da aggiungere (il sito usa le illustrazioni): ${missing.join(', ')}`);
else console.log('\nTutte le foto sono a posto. Ora: npm run build');
