import type { DifficultyId } from '../../shared/difficulty.ts';
import { FIRST_LEVEL } from '../../shared/levels.ts';
import type { JoinHome } from '../../shared/home-protocol.ts';
import type { PlayerEntity, SnapshotPacket, WelcomePacket } from '../../shared/protocol.ts';
import { createBrowserHomeStore } from '../../src/game/home/browser-home-store.ts';
import { emptySave } from '../../src/game/home/home-store.ts';
import type { HomeSave } from '../../src/game/home/home-store.ts';
import { HomeSync, joinHomeFor } from '../../src/game/home/home-sync.ts';
import { setTimeout as sleep } from 'node:timers/promises';
import { TestClient } from './ws-client.ts';

const HOME_KEY = 'outbreak.home';
const SHOP_SEED = 7;
/** A loaded machine can be slow to a socket, and a failure here should be a real one. */
const WAIT_MS = 10_000;

type Storage = ReturnType<typeof browserWith>;

/** One browser's storage, which outlives any tab open on it. */
export function browserWith(save: Partial<HomeSave> = {}) {
  const slots = new Map([[HOME_KEY, JSON.stringify({ ...emptySave(SHOP_SEED), ...save })]]);
  return {
    getItem: (key: string): string | null => slots.get(key) ?? null,
    setItem: (key: string, value: string): void => void slots.set(key, value),
  };
}

export async function waitFor<T>(find: () => T | undefined | null | false): Promise<T> {
  const deadline = Date.now() + WAIT_MS;
  for (;;) {
    const found = find();
    if (found) return found;
    const isTimedOut = Date.now() > deadline;
    if (isTimedOut) throw new Error('timed out waiting');
    await sleep(5);
  }
}

export interface JoinOptions {
  readonly token: string;
  readonly highest?: number;
  readonly finished?: boolean;
  readonly difficulty?: DifficultyId;
}

/** A browser tab as the game wires it: a real socket, the real save and HomeSync watching every frame. */
export class HomeTab {
  readonly client: TestClient;
  readonly sync: HomeSync;
  id = '';
  welcome: WelcomePacket | null = null;
  /** What this tab told the room it was bringing. */
  brought: JoinHome | null = null;

  constructor(port: number, storage: Storage) {
    this.client = new TestClient(port);
    this.sync = new HomeSync({
      store: createBrowserHomeStore(storage),
      mode: 'coop',
      sendHome: (action) => this.client.send({ type: 'home', action }),
    });
    this.client.socket.on('message', (data) => this.heard(JSON.parse(data.toString()) as WelcomePacket | SnapshotPacket));
  }

  private heard(packet: WelcomePacket | SnapshotPacket): void {
    const canWatch = packet.type === 'snapshot' && this.id !== '';
    if (canWatch) this.sync.observe(packet, this.id);
  }

  async join({ token, highest = FIRST_LEVEL, finished = false, difficulty }: JoinOptions): Promise<this> {
    const save = await this.sync.open();
    this.brought = joinHomeFor(save, { highest, finished });
    await this.client.opened();
    this.client.send({ type: 'join', name: 'Tester', token, style: 'campaign', home: this.brought, ...(difficulty ? { difficulty } : {}) });
    const welcome = await waitFor(() => this.client.received.find((packet) => packet.type === 'welcome'));
    this.welcome = welcome as WelcomePacket;
    this.id = this.welcome.yourId;
    this.sync.welcomed(this.welcome);
    return this;
  }

  get save(): HomeSave {
    return this.sync.save as HomeSave;
  }

  /** This player as the room last showed them. */
  get me(): PlayerEntity | undefined {
    return this.client.lastSnapshot?.players.find((player) => player.id === this.id);
  }

  /** The next frame to arrive, and anything HomeSync made of the one before. */
  async nextFrame(): Promise<SnapshotPacket> {
    const seen = this.client.received.length;
    await waitFor(() => this.client.received.slice(seen).some((packet) => packet.type === 'snapshot'));
    await this.sync.settled();
    return this.client.lastSnapshot as SnapshotPacket;
  }

  /** The tab is gone, with no goodbye. */
  crash(): void {
    this.sync.close();
    this.client.socket.terminate();
  }
}
