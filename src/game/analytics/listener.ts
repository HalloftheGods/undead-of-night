/**
 * The one listener. It watches the game's screen state and the events the game hands to the tap, and
 * turns them into summaries for the sender. Nothing here is awaited by the game and nothing here
 * writes to it.
 */
import { watch } from 'vue';
import { characterOf } from '../../../shared/characters.ts';
import { loadCharacter } from '../character-pref.ts';
import { loadDifficulty } from '../difficulty-pref.ts';
import { parseInvite } from '../invite-link.ts';
import { MAX_ERROR_EVENTS } from './analytics-config.ts';
import { ERROR_TYPES } from './catalog.ts';
import type { EventName } from './catalog.ts';
import { track } from './client.ts';
import { listenToGame } from './event-tap.ts';
import { closePrivacy } from './privacy-view.ts';
import { RunTracker } from './run-tracker.ts';
import type { Profile, TrackedUi } from './run-tracker.ts';

let tracker: RunTracker | null = null;

/** Read when this file loads, before the title strips the join parameter from the address. Only the fact is kept. */
const openedByInvite = parseInvite(globalThis.location?.search ?? '') !== null;

/** A title page opened. Unknown pages are ignored. */
export function trackTitlePage(page: string): void {
  tracker?.titlePage(page);
}

function currentProfile(): Profile {
  const touch = 'ontouchstart' in globalThis;
  const portrait = globalThis.innerHeight > globalThis.innerWidth;
  return {
    difficulty: loadDifficulty(),
    survivor: characterOf(loadCharacter()).id,
    input: touch ? 'touch' : 'mouse',
    orientation: portrait ? 'portrait' : 'landscape',
  };
}

/** The kind of failure and nothing else: a message or stack can carry a path, an address or a name. */
export function errorTypeOf(error: unknown): string {
  const name = error instanceof Error ? error.name : '';
  return ERROR_TYPES.includes(name as (typeof ERROR_TYPES)[number]) ? name : 'other';
}

/** Starts listening to the game's state. Returns the stop. */
export function startAnalytics(ui: () => TrackedUi): () => void {
  const emit = (name: EventName, params: Readonly<Record<string, unknown>>): void => track(name, params);
  const own = new RunTracker({ emit, now: () => performance.now(), profile: currentProfile });
  tracker = own;
  listenToGame({
    event: (event) => own.event(event),
    localPlayer: (id) => own.localPlayer(id),
    roomDifficulty: (difficulty) => own.roomDifficulty(difficulty),
    bench: (action) => own.bench(action),
  });

  let frameRequest = 0;
  function onFrame(now: number): void {
    frameRequest = 0;
    own.frame(now);
    if (own.inRun) frameRequest = requestAnimationFrame(onFrame);
  }

  const stopWatching = watch(
    ui,
    (state) => {
      const isInGame = state.screen === 'game';
      if (isInGame) closePrivacy();
      own.ui(state);
      const needsFrames = own.inRun && frameRequest === 0;
      if (needsFrames) frameRequest = requestAnimationFrame(onFrame);
    },
    { immediate: true }
  );

  let errors = 0;
  function onFailure(type: string): void {
    errors += 1;
    const withinLimit = errors <= MAX_ERROR_EVENTS;
    if (withinLimit) emit('game_error', { error_type: type });
  }
  const onError = (event: ErrorEvent): void => onFailure(errorTypeOf(event.error));
  const onRejection = (): void => onFailure('promise');
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);

  if (openedByInvite) emit('invite_opened', {});

  return () => {
    stopWatching();
    listenToGame(null);
    tracker = null;
    const hasFrameQueued = frameRequest !== 0;
    if (hasFrameQueued) cancelAnimationFrame(frameRequest);
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  };
}
