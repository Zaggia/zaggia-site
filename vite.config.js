import { defineConfig } from 'vite';

// base relativa: il sito funziona su qualsiasi hosting statico,
// anche in una sottocartella (GitHub Pages, Netlify, Aruba, ecc.).
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 900,
  },
});
