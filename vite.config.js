import vue from '@vitejs/plugin-vue';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { pwaShell } from './tools/vite-pwa.ts';
import { devInventorySync } from './tools/vite-dev-sync.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ports: ZOMBIE_CLIENT_PORT (default 8096) for this dev server, ZOMBIE_PORT (default 8097) for the co-op server.
const clientPort = Number(process.env.ZOMBIE_CLIENT_PORT) || 8096;
const serverPort = Number(process.env.ZOMBIE_PORT) || 8097;
// The play API (play-api/, a Cloudflare Worker) for online rooms. Unset, the build has no online play.
const playApi = process.env.ZOMBIE_PLAY_API ?? '';

const { version } = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf8'));

export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(version),
    // Stamped at build time, so the studio line shows the build year, not the visitor's clock.
    __BUILD_YEAR__: new Date().getFullYear(),
    __ZOMBIE_SERVER_PORT__: JSON.stringify(serverPort),
    __ZOMBIE_PLAY_API__: JSON.stringify(playApi),
  },
  plugins: [
    vue(),
    pwaShell(),
    devInventorySync(__dirname),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: clientPort,
    host: '0.0.0.0',
    strictPort: true,
    cors: true,
    allowedHosts: true,
    fs: {
      allow: ['../..'],
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
