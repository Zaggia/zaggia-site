import { defineConfig, mergeConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import base from './vite.config.js';

// Un solo file HTML con tutto dentro (JS, CSS, font, foto):
// si apre con un doppio clic, senza server. Uscita: dist-file/pizza-art.html
// Script classico (IIFE) invece di modulo: lo eseguono anche le anteprime
// e i visualizzatori HTML più limitati.
export default mergeConfig(base, defineConfig({
  plugins: [viteSingleFile({ removeViteModuleLoader: false })],
  build: {
    outDir: 'dist-file',
    emptyOutDir: true,
    modulePreload: false,
    rollupOptions: { output: { format: 'iife', inlineDynamicImports: true } },
  },
}));
