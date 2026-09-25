// Ritocco finale del file unico: sposta lo script in fondo al <body>, così
// parte dopo il contenuto anche nei visualizzatori che non rispettano il
// "defer" dei moduli, e rinomina il file in pizza-art.html.

import { readFile, writeFile, rm } from 'node:fs/promises';

const SRC = 'dist-file/index.html';
const OUT = 'dist-file/pizza-art.html';

let html = await readFile(SRC, 'utf8');
const start = html.indexOf('<script type="module"');
const end = html.indexOf('</script>', start) + '</script>'.length;
if (start < 0 || end < start || start > html.indexOf('<body')) {
  throw new Error('Script del modulo non trovato nella <head>: controlla la build.');
}
const script = html.slice(start, end);
html = html.slice(0, start) + html.slice(end);
const bodyEnd = html.lastIndexOf('</body>');
html = `${html.slice(0, bodyEnd)}${script}\n${html.slice(bodyEnd)}`;
await writeFile(OUT, html);
await rm(SRC);
console.log(`✓ ${OUT} (${Math.round(Buffer.byteLength(html) / 1024)} KB): aprilo con un doppio clic.`);
