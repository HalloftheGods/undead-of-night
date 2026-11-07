// What a remote session sends packets over: a WebSocket, a WebRTC data channel, or an in-tab loopback to the
// host's own room. Every pipe carries the same JSON text in order, so the packet protocol never changes with it.
import type { PeerSocket } from '../../shared/room/peer.ts';

export interface PipeHandlers {
  message(text: string): void;
  /** Fires at most once. A data channel has no close code, so its pipe passes 1006 unless it knows better. */
  closed(code: number, reason: string): void;
}

export interface PacketPipe {
  /** Starts connecting. Throws only for an address that can never work. */
  open(handlers: PipeHandlers): void;
  /** Dropped while the pipe is not open yet. */
  send(text: string): void;
  /** Closes without calling `closed`: the caller is the one leaving. */
  close(): void;
}

/** What a session says about a pipe that failed, in the player's words. */
export interface PipeWords {
  readonly badAddress: string;
  readonly noAnswer: string;
  readonly unreachable: string;
}

/** Reported when the far end vanished without a reason. */
export const DROPPED = 1006;

/**
 * Two ends in one tab: the host's own player talks to its room with no network between. Delivery waits
 * a microtask, as a socket would, so neither side ever runs inside the other's send.
 */
export function loopbackPair(): {
  pipe: PacketPipe;
  peer: PeerSocket & { onFrame: (text: string) => void; onClosed: () => void; onProbe: () => void };
} {
  let handlers: PipeHandlers | null = null;
  let isOpen = true;
  const later = (fn: () => void): void => queueMicrotask(fn);
  const shut = (code: number, reason: string, tellClient: boolean): void => {
    if (!isOpen) return;
    isOpen = false;
    const told = handlers;
    handlers = null;
    later(() => {
      if (tellClient) told?.closed(code, reason);
      peer.onClosed();
    });
  };
  const peer = {
    onFrame: (_text: string): void => {},
    onClosed: (): void => {},
    /** Nothing can drop between two ends in one tab, so a probe is answered at once. */
    onProbe: (): void => {},
    get open() {
      return isOpen;
    },
    send: (text: string) => {
      if (isOpen) later(() => handlers?.message(text));
    },
    close: (code: number, reason: string) => shut(code, reason, true),
    drop: () => shut(DROPPED, '', true),
    canTakeFrame: () => true,
    probe: () => {
      if (isOpen) peer.onProbe();
    },
  };
  const pipe: PacketPipe = {
    open: (next) => {
      handlers = next;
    },
    send: (text) => {
      if (isOpen) later(() => peer.onFrame(text));
    },
    close: () => shut(1000, 'left', false),
  };
  return { pipe, peer };
}
