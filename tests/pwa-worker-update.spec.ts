import { describe, expect, it } from 'vitest';
import { RELEASE_MUSIC_MESSAGE, SKIP_WAITING_MESSAGE, createUpdateHost, createWorkerUpdates, shouldRegisterWorker } from '../src/game/pwa/worker-update.ts';
import type { ContainerLike, RegistrationLike, WorkerLike } from '../src/game/pwa/worker-update.ts';

class Emitter {
  private readonly handlers = new Map<string, Set<() => void>>();
  addEventListener(type: string, handler: () => void): void {
    const set = this.handlers.get(type) ?? new Set();
    set.add(handler);
    this.handlers.set(type, set);
  }
  removeEventListener(type: string, handler: () => void): void {
    this.handlers.get(type)?.delete(handler);
  }
  emit(type: string): void {
    for (const handler of [...(this.handlers.get(type) ?? [])]) handler();
  }
  count(type: string): number {
    return this.handlers.get(type)?.size ?? 0;
  }
}

class FakeWorker extends Emitter implements WorkerLike {
  state = 'installing';
  readonly sent: unknown[] = [];
  postMessage(message: unknown): void {
    this.sent.push(message);
  }
}

class FakeRegistration extends Emitter implements RegistrationLike {
  waiting: FakeWorker | null = null;
  installing: FakeWorker | null = null;
  async update(): Promise<void> {}
}

class FakeController {
  readonly sent: unknown[] = [];
  postMessage(message: unknown): void {
    this.sent.push(message);
  }
}

class FakeContainer extends Emitter implements ContainerLike {
  controller: FakeController | null = null;
  readonly registration = new FakeRegistration();
  registered: string[] = [];
  async register(url: string): Promise<RegistrationLike> {
    this.registered.push(url);
    return this.registration;
  }
}

function setup(controlled: boolean) {
  const container = new FakeContainer();
  container.controller = controlled ? new FakeController() : null;
  const reloads: number[] = [];
  const updates = createWorkerUpdates({ container, workerUrl: 'https://x.test/sw.js', reload: () => void reloads.push(1) });
  return { container, updates, reloads };
}

/** A new version found while an old one controls the page, and finished installing. */
function installNewVersion(container: FakeContainer): FakeWorker {
  const worker = new FakeWorker();
  container.registration.installing = worker;
  container.registration.emit('updatefound');
  worker.state = 'installed';
  worker.emit('statechange');
  return worker;
}

describe('shouldRegisterWorker', () => {
  it('registers only in a production build, on a secure page, where workers exist', () => {
    expect(shouldRegisterWorker({ production: true, secure: true, supported: true })).toBe(true);
    expect(shouldRegisterWorker({ production: false, secure: true, supported: true })).toBe(false);
    expect(shouldRegisterWorker({ production: true, secure: false, supported: true })).toBe(false);
    expect(shouldRegisterWorker({ production: true, secure: true, supported: false })).toBe(false);
  });
});

describe('worker updates', () => {
  it('registers the worker it is given', async () => {
    const { container, updates } = setup(true);
    await updates.start();
    expect(container.registered).toEqual(['https://x.test/sw.js']);
  });

  it('survives a failed registration', async () => {
    const { container, updates } = setup(true);
    container.register = async () => {
      throw new Error('blocked');
    };
    await expect(updates.start()).resolves.toBeNull();
  });

  it('leaves a new version waiting while no title is showing', async () => {
    const { container, updates, reloads } = setup(true);
    await updates.start();
    const worker = installNewVersion(container);
    expect(worker.sent).toEqual([]);
    container.emit('controllerchange');
    expect(reloads).toEqual([]);
  });

  it('applies a waiting version at the title and reloads once it takes over', async () => {
    const { container, updates, reloads } = setup(true);
    await updates.start();
    const worker = installNewVersion(container);
    updates.setTitleShowing(true);
    expect(worker.sent).toEqual([SKIP_WAITING_MESSAGE]);
    container.emit('controllerchange');
    expect(reloads).toEqual([1]);
  });

  it('a version found by the boot check swaps and reloads, even after the check has closed', async () => {
    const { container, updates, reloads } = setup(true);
    await updates.start();
    const found: FakeWorker[] = [];
    container.registration.update = async () => {
      found.push(installNewVersion(container));
    };
    await updates.checkBeforeBoot(1000);
    expect(found[0].sent).toEqual([SKIP_WAITING_MESSAGE]);
    container.emit('controllerchange');
    expect(reloads).toEqual([1]);
  });

  it('the boot check gives up at its cap, and a version found later waits for the title', async () => {
    const { container, updates, reloads } = setup(true);
    await updates.start();
    container.registration.update = () => new Promise<void>(() => undefined);
    await updates.checkBeforeBoot(5);
    const worker = installNewVersion(container);
    expect(worker.sent).toEqual([]);
    container.emit('controllerchange');
    expect(reloads).toEqual([]);
  });

  it('applies at once when the title is already showing as the version lands', async () => {
    const { container, updates } = setup(true);
    await updates.start();
    updates.setTitleShowing(true);
    const worker = installNewVersion(container);
    expect(worker.sent).toEqual([SKIP_WAITING_MESSAGE]);
  });

  it('picks up a version that was already waiting at launch', async () => {
    const { container, updates } = setup(true);
    const waiting = new FakeWorker();
    container.registration.waiting = waiting;
    await updates.start();
    updates.setTitleShowing(true);
    expect(waiting.sent).toEqual([SKIP_WAITING_MESSAGE]);
  });

  it('never reloads if a run began before the swap landed', async () => {
    const { container, updates, reloads } = setup(true);
    await updates.start();
    installNewVersion(container);
    updates.setTitleShowing(true);
    updates.setTitleShowing(false);
    container.emit('controllerchange');
    expect(reloads).toEqual([]);
  });

  it('does not reload on the first install, which only claims the page', async () => {
    const { container, updates, reloads } = setup(false);
    await updates.start();
    updates.setTitleShowing(true);
    container.emit('controllerchange');
    expect(reloads).toEqual([]);
  });

  it('reloads after an update that lands on a first visit, once the first install has claimed the page', async () => {
    const { container, updates, reloads } = setup(false);
    await updates.start();
    updates.setTitleShowing(true);
    // The first install claims the page, and a second version then replaces it.
    container.controller = new FakeController();
    container.emit('controllerchange');
    expect(reloads).toEqual([]);
    const worker = installNewVersion(container);
    expect(worker.sent).toEqual([SKIP_WAITING_MESSAGE]);
    container.emit('controllerchange');
    expect(reloads).toEqual([1]);
  });

  it('tells the version in charge to let go of its music streams before the new one takes over', async () => {
    const { container, updates } = setup(true);
    await updates.start();
    installNewVersion(container);
    expect(container.controller?.sent).toEqual([]);
    updates.setTitleShowing(true);
    expect(container.controller?.sent).toEqual([RELEASE_MUSIC_MESSAGE]);
  });

  it('asks a waiting version to take over only once', async () => {
    const { container, updates } = setup(true);
    await updates.start();
    const worker = installNewVersion(container);
    updates.setTitleShowing(true);
    updates.setTitleShowing(false);
    updates.setTitleShowing(true);
    expect(worker.sent).toHaveLength(1);
  });

  describe('update host', () => {
    function hostEnv() {
      const container = new FakeContainer();
      container.controller = new FakeController();
      const waiting = new FakeWorker();
      container.registration.waiting = waiting;
      return { container, waiting, env: { container, workerUrl: 'https://x.test/sw.js', reload: () => undefined } };
    }

    it('applies a waiting version when the title mounted before the worker started', async () => {
      const { waiting, env } = hostEnv();
      const host = createUpdateHost();
      host.setTitleShowing(true);
      await host.begin(env);
      expect(waiting.sent).toEqual([SKIP_WAITING_MESSAGE]);
    });

    it('applies a waiting version when the worker started before the title mounted', async () => {
      const { waiting, env } = hostEnv();
      const host = createUpdateHost();
      await host.begin(env);
      expect(waiting.sent).toEqual([]);
      host.setTitleShowing(true);
      expect(waiting.sent).toEqual([SKIP_WAITING_MESSAGE]);
    });

    it('does not apply while the title was left before the worker started', async () => {
      const { waiting, env } = hostEnv();
      const host = createUpdateHost();
      host.setTitleShowing(true);
      host.setTitleShowing(false);
      await host.begin(env);
      expect(waiting.sent).toEqual([]);
    });
  });

  it('removes its listeners when disposed', async () => {
    const { container, updates } = setup(true);
    await updates.start();
    updates.dispose();
    expect(container.count('controllerchange')).toBe(0);
    expect(container.registration.count('updatefound')).toBe(0);
  });
});
