import '@fontsource/silkscreen/400.css';
import '@fontsource/silkscreen/700.css';
import { createApp } from 'vue';
import App from './App.vue';
import './components/pixel-ui.css';
import './components/touch-ui.css';
import { mirrorMotionToRoot } from './game/motion.ts';
import { startServiceWorker } from './game/pwa/index.ts';

// Before the first paint, so no stylesheet animates for a frame against the player's Motion setting.
mirrorMotionToRoot();
createApp(App).mount('#app');
startServiceWorker();
