import vue from '@vitejs/plugin-vue';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { defineConfig } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { version } = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf8')) as { version: string };

export default defineConfig({
  base: './',
  // __BUILD_YEAR__ is stamped at build time, so the studio line shows the build year, not the visitor's clock.
  define: { __APP_VERSION__: JSON.stringify(version), __BUILD_YEAR__: new Date().getFullYear() },
  plugins: [
    vue(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
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
