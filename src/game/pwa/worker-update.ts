/**
 * Registers the service worker in production and applies a new version only at the title screen.
 * A run is never reloaded: a waiting worker sits until the title shows, or until the next launch.
 */

export const WORKER_URL = 'sw.js';
export const SKIP_WAITING_MESSAGE = { type: 'SKIP_WAITING' } as const;
/** Told to the worker in charge now, so a music stream it still holds open cannot make the new one wait. */
export const RELEASE_MUSIC_MESSAGE = { type: 'RELEASE_MUSIC' } as const;

export interface RegisterFacts {
  readonly production: boolean;
  readonly secure: boolean;
  readonly supported: boolean;
}

/** Never on a dev server, where a cached shell would fight hot reload. */
export function shouldRegisterWorker(facts: RegisterFacts): boolean {
  return facts.production && facts.secure && facts.supported;
}

interface Listenable<Type extends string> {
  addEventListener(type: Type, handler: () => void): void;
  removeEventListener(type: Type, handler: () => void): void;
}

export interface WorkerLike extends Listenable<'statechange'> {
  readonly state: string;
  postMessage(message: unknown): void;
}

export interface RegistrationLike extends Listenable<'updatefound'> {
  readonly waiting: WorkerLike | null;
  readonly installing: WorkerLike | null;
  update(): Promise<unknown>;
}

export interface ControllerLike {
  postMessage(message: unknown): void;
}

export interface ContainerLike extends Listenable<'controllerchange'> {
  readonly controller: ControllerLike | null;
  register(url: string): Promise<RegistrationLike>;
}

export interface UpdateEnv {
  container: ContainerLike;
  workerUrl: string;
  reload(): void;
}

export function createWorkerUpdates(env: UpdateEnv) {
  let titleShowing = false;
  let waiting: WorkerLike | null = null;
  let applying = false;
  const undo: Array<() => void> = [];
  function applyIfReady(): void {
    const worker = waiting;
    const canApply = titleShowing && !applying;
    const cannotUpdate = worker === null || !canApply;
    if (cannotUpdate) return;
    applying = true;
    env.container.controller?.postMessage(RELEASE_MUSIC_MESSAGE);
    worker.postMessage(SKIP_WAITING_MESSAGE);
  }

  function onStateChange(installing: WorkerLike): void {
    const installed = installing.state === 'installed';
    const replacing = env.container.controller !== null;
    const update = installed && replacing;
    if (!update) return;
    waiting = installing;
    applyIfReady();
  }

  function watch(registration: RegistrationLike): void {
    waiting = registration.waiting;
    const onUpdateFound = (): void => {
      const installing = registration.installing;
      const isNotInstalling = installing === null;
      if (isNotInstalling) return;
      const listener = (): void => onStateChange(installing);
      installing.addEventListener('statechange', listener);
      undo.push(() => installing.removeEventListener('statechange', listener));
    };
    registration.addEventListener('updatefound', onUpdateFound);
    undo.push(() => registration.removeEventListener('updatefound', onUpdateFound));
    applyIfReady();
  }

  const onControllerChange = (): void => {
    // A first install claims the page too, but that is not ours to act on: only a swap we asked for reloads.
    // Asking is what counts, not whether a worker controlled the page at launch, so an update on a first visit still lands.
    const swapped = applying;
    // The player may have started a run in the instant between asking and swapping.
    const safeToReload = swapped && titleShowing;
    if (safeToReload) env.reload();
  };
  env.container.addEventListener('controllerchange', onControllerChange);
  undo.push(() => env.container.removeEventListener('controllerchange', onControllerChange));

  async function start(): Promise<RegistrationLike | null> {
    try {
      const registration = await env.container.register(env.workerUrl);
      watch(registration);
      return registration;
    } catch {
      return null;
    }
  }

  /** Called as the title screen shows and hides. Showing it is the moment a waiting version may take over. */
  function setTitleShowing(showing: boolean): void {
    titleShowing = showing;
    applyIfReady();
  }

  function dispose(): void {
    for (const stop of undo) stop();
  }

  return { start, setTitleShowing, dispose };
}

export type WorkerUpdates = ReturnType<typeof createWorkerUpdates>;

/** Remembers whether the title is up, so it counts whichever comes first: the title mounting or the worker starting. */
export function createUpdateHost() {
  let titleShowing = false;
  let updates: WorkerUpdates | null = null;

  function begin(env: UpdateEnv): Promise<RegistrationLike | null> {
    updates = createWorkerUpdates(env);
    updates.setTitleShowing(titleShowing);
    return updates.start();
  }

  function setTitleShowing(showing: boolean): void {
    titleShowing = showing;
    updates?.setTitleShowing(showing);
  }

  return { begin, setTitleShowing };
}
