import vue from '@vitejs/plugin-vue';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [vue()],
  define: { __APP_VERSION__: JSON.stringify('test'), __BUILD_YEAR__: 2026 },
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
  test: {
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
    // The flow specs pump seconds of real sim and render, which runs slowly on a busy machine.
    testTimeout: 20000,
  },
});
