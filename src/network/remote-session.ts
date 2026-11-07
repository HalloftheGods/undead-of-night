import type { EmoteId } from '../../shared/emotes.ts';
import { closeText } from '../../shared/close-codes.ts';
import type { GameStyle } from '../../shared/game-style.ts';
import type { HomeAction, JoinHome } from '../../shared/home-protocol.ts';
import { PROTOCOL_VERSION } from '../../shared/protocol.ts';
import type { ClientInputPacket, ClientPacket, SnapshotPacket, WelcomePacket } from '../../shared/protocol.ts';
import type { BenchAction } from '../../shared/workbench.ts';
import { tapRoomDifficulty } from '../game/analytics/event-tap.ts';
import type { PacketPipe, PipeWords } from './packet-pipe.ts';
import { parseServerPacket } from './packet-guards.ts';
import { tabToken } from './tab-token.ts';
import type { ConnectOptions, GameTransport } from './transport.ts';

/** A co-op transport whose room speaks first: `onRoom`, then `join`. The run answers through these two. */
export interface RoomSession extends GameTransport {
  onRoom: (style: GameStyle | null) => void;
  join(style: GameStyle, home?: JoinHome): void;
}

const DEFAULT_TIMEOUT_MS = 6000;

/** Co-op play against a room host at the far end of a pipe: the ws server, a host tab over WebRTC, or this tab's own room. */
export class RemoteSession implements RoomSession {
  readonly kind = 'coop';
  readonly interpolationDelayMs = 100;

  onWelcome: (packet: WelcomePacket) => void = () => {};
  onSnapshot: (packet: SnapshotPacket) => void = () => {};
  onClosed: (reason: string) => void = () => {};
  /** What the room plays, or null for an empty one. Heard before joining, and answered with `join`; heard again if the room moved on first. */
  onRoom: (style: GameStyle | null) => void = () => {};

  private joiner: ConnectOptions = { name: '' };
  private timeout: ReturnType<typeof setTimeout> | null = null;
  private welcomed = false;
  private finished = false;
  private opened = false;

  constructor(
    private readonly pipe: PacketPipe,
    private readonly words: PipeWords,
    private readonly timeoutMs = DEFAULT_TIMEOUT_MS,
  ) {}

  /** Opens the pipe. The room speaks first, so nothing is sent until `onRoom` has been answered. */
  connect(options: ConnectOptions): void {
    this.joiner = options;
    try {
      this.pipe.open({ message: (text) => this.receive(text), closed: (code, reason) => this.finish(this.closeReason(code, reason)) });
      this.opened = true;
    } catch {
      this.finish(this.words.badAddress);
      return;
    }
    this.timeout = setTimeout(() => this.finish(this.words.noAnswer), this.timeoutMs);
  }

  /** Asks in, as the style the room said it plays. Campaign brings its gear; Arcade has none to bring. */
  join(style: GameStyle, home?: JoinHome): void {
    const { name, difficulty, character } = this.joiner;
    this.send({ type: 'join', name, token: tabToken(), difficulty, character, style, home, protocol: PROTOCOL_VERSION });
  }

  sendInput(input: ClientInputPacket): void {
    if (this.welcomed) this.send({ type: 'input', input });
  }

  sendBench(action: BenchAction): void {
    if (this.welcomed) this.send({ type: 'bench', action });
  }

  sendHome(action: HomeAction): void {
    if (this.welcomed) this.send({ type: 'home', action });
  }

  sendEmote(emote: EmoteId): void {
    if (this.welcomed) this.send({ type: 'emote', emote });
  }

  requestRestart(): void {
    this.send({ type: 'restart' });
  }

  /** Other survivors keep playing, so nothing here can stop the clock. */
  setPaused(): void {}

  disconnect(): void {
    this.finished = true;
    this.teardown();
  }

  private send(packet: ClientPacket): void {
    if (!this.finished) this.pipe.send(JSON.stringify(packet));
  }

  private receive(raw: unknown): void {
    const packet = parseServerPacket(raw);
    const isIgnored = !packet || this.finished;
    if (isIgnored) return;
    if (packet.type === 'bye') {
      this.finish(this.closeReason(packet.code, packet.reason));
    } else if (packet.type === 'room') {
      if (!this.welcomed) this.onRoom(packet.style);
    } else if (packet.type === 'welcome') {
      this.welcomed = true;
      this.clearTimeout();
      if (packet.difficulty) tapRoomDifficulty(packet.difficulty);
      this.onWelcome(packet);
    } else if (packet.type === 'snapshot' && this.welcomed) {
      this.onSnapshot(packet);
    }
  }

  private closeReason(code: number, reason = ''): string {
    const told = closeText(code, reason);
    if (told) return told;
    if (this.welcomed) return 'The connection to the server dropped.';
    return this.words.unreachable;
  }

  private finish(reason: string): void {
    if (this.finished) return;
    this.finished = true;
    this.teardown();
    this.onClosed(reason);
  }

  private clearTimeout(): void {
    const timeout = this.timeout;
    const hasTimeout = timeout !== null;
    if (hasTimeout) clearTimeout(timeout);
    this.timeout = null;
  }

  private teardown(): void {
    this.clearTimeout();
    if (!this.opened) return;
    this.opened = false;
    this.pipe.close();
  }
}
