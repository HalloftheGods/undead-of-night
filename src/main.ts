import './game/settings-reset.ts';
import '@fontsource/silkscreen/400.css';
import '@fontsource/silkscreen/700.css';
import { createApp } from 'vue';
import App from './App.vue';
import './components/pixel-ui.css';
import './components/touch-ui.css';
import { mirrorMotionToRoot } from './game/motion.ts';
import { startServiceWorker } from './game/pwa/index.ts';

interface BootHook {
  step: (fraction: number, label: string) => void;
}

declare global {
  interface Window {
    __boot?: BootHook;
  }
}

// Before the first paint, so no stylesheet animates for a frame against the player's Motion setting.
mirrorMotionToRoot();
window.__boot?.step(0.75, 'Mounting interface...');
createApp(App).mount('#app');
window.__boot?.step(1.0, 'Entering town...');
startServiceWorker();

function liftBootScreen(): void {
  const boot = document.getElementById('boot');
  if (!boot) return;
  document.body.classList.remove('booting');
  boot.classList.add('out');
  setTimeout(() => boot.remove(), 450);
}

liftBootScreen();
