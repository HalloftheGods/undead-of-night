import { randomInt, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { WebSocket, WebSocketServer, type RawData } from 'ws';
import { DEFAULT_SERVER_PORT } from '../shared/constants.ts';
import { OVERRUN_LIVE } from '../shared/home-protocol.ts';
import { HEARTBEAT_MS, JOIN_DEADLINE_MS, MAX_BUFFERED_BYTES, MAX_PACKET_BYTES, RESTART_VOTE_MS } from '../shared/room/limits.ts';
import type { HostClock, PeerSocket } from '../shared/room/peer.ts';
import { createRoomHost } from '../shared/room/room-host.ts';
import { GameSimulation } from '../shared/simulation.ts';

// The Node adapter: ws sockets into the shared room host, for LAN play and dev.

export interface GameServerOptions {
  readonly port: number;
  readonly seed?: number;
  /** Lets a test keep a handle on the world it is serving. */
  readonly simulation?: GameSimulation;
  /** Lets a test reach the join deadline without the wait. */
  readonly joinDeadlineMs?: number;
  /** Lets a test reach the end of a restart vote without the wait. */
  readonly restartVoteMs?: number;
}

export interface RunningGameServer {
  readonly port: number;
  close(): Promise<void>;
}

const nodeClock: HostClock = {
  now: () => performance.now(),
  after: (ms, fn) => {
    return setTimeout(fn, ms);
  },
  cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

function wsPeer(socket: WebSocket): PeerSocket {
  return {
    get open() {
      return socket.readyState === WebSocket.OPEN;
    },
    send: (text) => socket.send(text),
    close: (code, reason) => socket.close(code, reason),
    drop: () => socket.terminate(),
    canTakeFrame: () => socket.bufferedAmount < MAX_BUFFERED_BYTES,
    probe: () => socket.ping(),
  };
}

const byteLength = (data: RawData): number => (Array.isArray(data) ? data.reduce((sum, part) => sum + part.byteLength, 0) : data.byteLength);

export function startGameServer(options: GameServerOptions): Promise<RunningGameServer> {
  // Arcade until the first player into the room says otherwise. A Campaign room runs the overrun once it is live.
  const sim = options.simulation ?? new GameSimulation({ seed: options.seed ?? randomInt(0x7fffffff), workbench: 'timed', overrun: OVERRUN_LIVE });
  const host = createRoomHost({
    sim,
    clock: nodeClock,
    newId: randomUUID,
    restartVoteMs: options.restartVoteMs ?? RESTART_VOTE_MS,
    joinDeadlineMs: options.joinDeadlineMs ?? JOIN_DEADLINE_MS,
    heartbeatMs: HEARTBEAT_MS,
    acceptUnversioned: true,
  });
  const wss = new WebSocketServer({ port: options.port, maxPayload: MAX_PACKET_BYTES });

  wss.on('connection', (socket, request) => {
    const peer = host.admit(wsPeer(socket), request.socket.remoteAddress ?? '');
    if (!peer) {
      socket.on('error', () => undefined);
      return;
    }
    socket.on('message', (data, isBinary) => peer.receive(isBinary ? null : data.toString(), byteLength(data)));
    socket.on('pong', () => peer.heard());
    socket.on('close', () => peer.closed());
    // Oversized frames and protocol errors land here; ws closes the socket for us.
    socket.on('error', (error) => process.stderr.write(`[zombie-server] client error: ${error.message}\n`));
  });

  function close(): Promise<void> {
    host.shutdown();
    return new Promise((resolve) => wss.close(() => resolve()));
  }

  return new Promise((resolve, reject) => {
    wss.once('error', reject);
    wss.once('listening', () => {
      wss.off('error', reject);
      wss.on('error', (error) => console.error(`[zombie-server] ${error.message}`));
      const address = wss.address();
      const port = typeof address === 'object' && address ? address.port : options.port;
      resolve({ port, close });
    });
  });
}

const launchedDirectly = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (launchedDirectly) {
  const port = Number(process.env.ZOMBIE_PORT) || DEFAULT_SERVER_PORT;
  const server = await startGameServer({ port });
  process.stdout.write(`[zombie-server] listening on ws://0.0.0.0:${server.port}\n`);
  const shutdown = () => void server.close().then(() => process.exit(0));
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
