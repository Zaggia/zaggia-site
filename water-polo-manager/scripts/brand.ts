// Rigenera i file del kit grafico (favicon e loghi SVG) a partire da src/ui/brand.ts.
// Uso: npm run brand

import { mkdirSync, writeFileSync } from 'node:fs';
import { appIconSvg, logoHorizontalSvg, logoMarkSvg } from '../src/ui/brand.ts';

mkdirSync('brand', { recursive: true });
mkdirSync('public', { recursive: true });
const files: Record<string, string> = {
  'public/favicon.svg': appIconSvg(),
  'brand/app-icon.svg': appIconSvg(),
  'brand/logo-mark.svg': logoMarkSvg('mark', { title: true }),
  'brand/logo-horizontal.svg': logoHorizontalSvg(),
};
for (const [path, svg] of Object.entries(files)) {
  writeFileSync(path, svg + '\n');
  console.log('scritto', path);
}
