import { TICK_DT, TICK_RATE } from '../../shared/constants.ts';
import type { EmoteId } from '../../shared/emotes.ts';
import { playsFromHome } from '../../shared/game-style.ts';
import type { GameStyle } from '../../shared/game-style.ts';
import type { HomeAction } from '../../shared/home-protocol.ts';
import type { ClientInputPacket, SnapshotPacket, WelcomePacket } from '../../shared/protocol.ts';
import { GameSimulation } from '../../shared/simulation.ts';
import { overrunOn } from '../game/home-mode.ts';
import type { BenchAction } from '../../shared/workbench.ts';
import { TickClock } from './tick-clock.ts';
import type { ConnectOptions, GameTransport } from './transport.ts';

const LOCAL_PLAYER_ID = 'local';

/** Solo play: the same simulation the server runs, stepped in the browser. */
export class LocalSession implements GameTransport {
  readonly kind = 'solo';
  /** Snapshots here arrive without jitter, so two ticks of buffer is enough. */
  readonly interpolationDelayMs = 2 * TICK_DT * 1000;

  onWelcome: (packet: WelcomePacket) => void = () => {};
  onSnapshot: (packet: SnapshotPacket) => void = () => {};
  onClosed: (reason: string) => void = () => {};

  /** Exposed for the dev handle. */
  sim: GameSimulation | null = null;

  private options: ConnectOptions = { name: '' };
  private paused = false;
  private holdTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly clock = new TickClock(1000 / TICK_RATE, () => this.tick());

  connect(options: ConnectOptions): void {
    this.options = options;
    this.beginRun();
  }

  sendInput(input: ClientInputPacket): void {
    this.sim?.setInput(LOCAL_PLAYER_ID, input);
  }

  sendBench(action: BenchAction): void {
    this.sim?.benchCommand(LOCAL_PLAYER_ID, action);
  }

  sendHome(action: HomeAction): void {
    this.sim?.homeCommand(LOCAL_PLAYER_ID, action);
  }

  sendEmote(emote: EmoteId): void {
    this.sim?.emote(LOCAL_PLAYER_ID, emote);
  }

  /**
   * Every run in solo gets a fresh city. Plain Play again goes back to level 1; Continue passes its level.
   * Campaign has no runs to restart: one sim stays up across trips, so its receipts keep their serials.
   */
  requestRestart(fromLevel?: number): void {
    if (this.playsHome) return;
    // A Daily Night plays again from its own level; anything else from where it is told, or level 1.
    const daily = this.options.seed !== undefined;
    this.options = { ...this.options, startLevel: fromLevel ?? (daily ? this.options.startLevel : undefined) };
    this.clock.stop();
    this.beginRun();
  }

  setPaused(paused: boolean): void {
    const isUnchanged = paused === this.paused;
    if (isUnchanged) return;
    this.paused = paused;
    if (paused) this.clock.stop();
    else this.clock.start();
  }

  hold(ms: number): void {
    const cannotHold = this.paused || ms <= 0;
    if (cannotHold) return;
    this.clock.stop();
    if (this.holdTimer) clearTimeout(this.holdTimer);
    this.holdTimer = setTimeout(() => {
      this.holdTimer = null;
      const shouldResume = !this.paused && this.sim;
      if (shouldResume) this.clock.start();
    }, ms);
  }

  disconnect(): void {
    if (this.holdTimer) clearTimeout(this.holdTimer);
    this.holdTimer = null;
    this.clock.stop();
    this.sim = null;
  }

  private get playsHome(): boolean {
    const style: GameStyle = this.options.style ?? 'arcade';
    return playsFromHome(style);
  }

  private beginRun(): void {
    const { name, difficulty, character, startLevel, home } = this.options;
    const seed = this.options.seed ?? Math.floor(Math.random() * 0x7fffffff);
    const overrun = overrunOn(globalThis.location?.search ?? '', import.meta.env.DEV);
    const sim = new GameSimulation({ seed, difficulty, workbench: 'hold', startLevel, home: this.playsHome, overrun });
    sim.addPlayer(LOCAL_PLAYER_ID, name, null, character, home);
    this.sim = sim;
    this.paused = false;
    this.onWelcome({ type: 'welcome', yourId: LOCAL_PLAYER_ID, tickRate: TICK_RATE, mapSeed: sim.map.seed, level: sim.level, difficulty: sim.difficulty });
    this.onSnapshot(sim.snapshot());
    this.clock.start();
  }

  private tick(): void {
    const sim = this.sim;
    if (!sim) return;
    sim.step();
    this.onSnapshot(sim.snapshot());
  }
}
