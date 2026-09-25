import { defineConfig, mergeConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import base from './vite.config.js';

// Un solo file HTML con tutto dentro (JS, CSS, font, foto):
// si apre con un doppio clic, senza server. Uscita: dist-file/pizza-art.html
export default mergeConfig(base, defineConfig({
  plugins: [viteSingleFile({ removeViteModuleLoader: true })],
  build: { outDir: 'dist-file', emptyOutDir: true },
}));
