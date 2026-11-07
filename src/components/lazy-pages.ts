/**
 * Screens most runs never open load on demand, so the first download is only what the title and a run need.
 * Each is fetched again on idle after the title is up, so opening one is instant.
 */
import { defineAsyncComponent, type Component } from 'vue';
import PageLoadFailed from './PageLoadFailed.vue';

type Loader = () => Promise<{ default: Component }>;

const LOAD_TRIES = 3;
const loaders: Loader[] = [];

function lazy(loader: Loader): Component {
  loaders.push(loader);
  return defineAsyncComponent({
    loader,
    errorComponent: PageLoadFailed,
    // A dropped fetch is tried again before the page gives up; a later open tries afresh.
    onError: (_error, retry, fail, attempts) => (attempts < LOAD_TRIES ? retry() : fail()),
  });
}

export const HowToPlay = lazy(() => import('./HowToPlay.vue'));
export const RecordsPage = lazy(() => import('./RecordsPage.vue'));
export const ChangelogPage = lazy(() => import('./ChangelogPage.vue'));
export const DailyPage = lazy(() => import('./DailyPage.vue'));
export const LevelsPage = lazy(() => import('./LevelsPage.vue'));
export const SoundTestPage = lazy(() => import('./SoundTestPage.vue'));
export const JukeboxScreen = lazy(() => import('./JukeboxScreen.vue'));
export const EndingFlow = lazy(() => import('./EndingFlow.vue'));

const IDLE_FALLBACK_MS = 2_000;
/** The fallback warm-up timer, so a second call replaces it instead of stacking another. */
let fallbackTimer: ReturnType<typeof setTimeout> | undefined;

/** Warms every lazy screen once the browser is idle. A failed warm-up is left for the real open to retry. */
export function prefetchLazyPages(): void {
  const warm = (): void => {
    for (const load of loaders) load().catch(() => undefined);
  };
  const idle = typeof window.requestIdleCallback === 'function';
  if (idle) window.requestIdleCallback(warm, { timeout: IDLE_FALLBACK_MS * 2 });
  else {
    clearTimeout(fallbackTimer);
    fallbackTimer = setTimeout(warm, IDLE_FALLBACK_MS);
  }
}
