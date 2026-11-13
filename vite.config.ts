import vue from '@vitejs/plugin-vue';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { defineConfig } from 'vite';
import { devInventorySync } from './tools/vite-dev-sync.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { version } = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf8')) as { version: string };

export default defineConfig({
  base: './',
  // __BUILD_YEAR__ is stamped at build time, so the studio line shows the build year, not the visitor's clock.
  define: { __APP_VERSION__: JSON.stringify(version), __BUILD_YEAR__: new Date().getFullYear() },
  plugins: [
    vue(),
    devInventorySync(__dirname),
  ],
  resolve: {
    alias: [
      { find: '@shared', replacement: path.resolve(__dirname, './shared') },
      { find: '@game', replacement: path.resolve(__dirname, './src/game') },
      { find: '@components', replacement: path.resolve(__dirname, './src/components') },
      { find: '@engine', replacement: path.resolve(__dirname, './src/engine') },
      { find: '@art', replacement: path.resolve(__dirname, './src/art') },
      { find: '@audio', replacement: path.resolve(__dirname, './src/audio') },
      { find: '@', replacement: path.resolve(__dirname, './src') },
    ],
  },
  server: {
    port: 8094,
    host: '0.0.0.0',
    strictPort: true,
    cors: true,
    fs: {
      allow: ['../..'],
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
