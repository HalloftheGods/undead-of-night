import { afterEach, describe, expect, it } from 'vitest';
import { startGameServer } from '../server/server.ts';
import type { RunningGameServer } from '../server/server.ts';
import { EXIT_HOLD_SEC, LEVEL_CLEAR_HEAL, VIEWER_RANGE } from '../shared/constants.ts';
import { FINAL_LEVEL, levelSeed } from '../shared/levels.ts';
import type { SnapshotPacket } from '../shared/protocol.ts';
import type { SimState } from '../shared/sim-state.ts';
import { alivePlayers } from '../shared/sim-state.ts';
import { GameSimulation } from '../shared/simulation.ts';
import { generateWorldMap } from '../shared/world-map.ts';
import { isSnapshotPacket } from '../src/network/packet-guards.ts';
import { openLevelExit, stateOf } from './helpers/sim-harness.ts';
import { TestClient } from './helpers/ws-client.ts';

const SEED = 21;
/** A few ticks of waiting left, so a test does not sit through the whole two seconds. */
const NEARLY_BOARDED = EXIT_HOLD_SEC - 0.15;

const quietTown = (state: SimState): void => {
  state.zombies = [];
  state.populationTarget = 0;
  state.intermissionLeft = 1e6;
};

/** Everyone on their feet is at the van, a moment from leaving. */
function nearlyAway(state: SimState): void {
  quietTown(state);
  const exit = openLevelExit(state);
  exit.hold = NEARLY_BOARDED;
  for (const p of alivePlayers(state)) {
    p.x = exit.x;
    p.y = exit.y;
  }
}

/** A town's exit shows the level debrief, and the room waits until a player reads on. */
async function readDebrief(client: TestClient): Promise<void> {
  await client.until(() => client.lastSnapshot?.debrief);
  client.send({ type: 'debrief_continue' });
}

const onLevel = (client: TestClient, level: number): SnapshotPacket | undefined => {
  const frame = client.lastSnapshot;
  return frame?.level === level ? frame : undefined;
};

describe('co-op over a run of levels', () => {
  let server: RunningGameServer;
  const clients: TestClient[] = [];

  const connect = (): TestClient => {
    const client = new TestClient(server.port);
    clients.push(client);
    return client;
  };

  async function room(): Promise<{ sim: GameSimulation; state: SimState }> {
    const sim = new GameSimulation({ seed: SEED });
    server = await startGameServer({ port: 0, simulation: sim });
    return { sim, state: stateOf(sim) };
  }

  afterEach(async () => {
    for (const client of clients.splice(0)) client.socket.terminate();
    await server.close();
  });

  it('moves everyone together, and each client learns the new town from its snapshots', async () => {
    const { state } = await room();
    const first = connect();
    const second = connect();
    await first.join('Ann');
    await second.join('Bea');
    await first.until(() => first.lastSnapshot?.players.length === 2);
    nearlyAway(state);
    await readDebrief(first);

    const seen = await first.until(() => onLevel(first, 2));
    const alsoSeen = await second.until(() => onLevel(second, 2));
    expect(seen.mapSeed).toBe(levelSeed(SEED, 2));
    expect(alsoSeen.mapSeed).toBe(seen.mapSeed);
    expect(seen.exit).toBeNull();
    expect(isSnapshotPacket(seen)).toBe(true);
    const rebuilt = generateWorldMap(seen.mapSeed);
    expect(rebuilt.spawn).toEqual(state.map.spawn);
    for (const p of seen.players) {
      expect(Math.hypot(p.x - rebuilt.spawn.x, p.y - rebuilt.spawn.y)).toBeLessThan(40);
    }
  });

  it('sends the exit to a client wherever it stands, and the frame passes the client guards', async () => {
    const { state } = await room();
    const client = connect();
    await client.join('Ann');
    await client.until(() => client.lastSnapshot);
    quietTown(state);
    const exit = openLevelExit(state);
    const [p] = state.players;
    expect(Math.hypot(p.x - exit.x, p.y - exit.y)).toBeGreaterThan(VIEWER_RANGE);

    const frame = await client.until(() => {
      const latest = client.lastSnapshot;
      return latest?.exit ? latest : undefined;
    });
    expect(frame.exit).toMatchObject({ x: exit.x, y: exit.y });
    expect(isSnapshotPacket(frame)).toBe(true);
  });

  it('welcomes someone joining after the change into the town being played', async () => {
    const { state } = await room();
    const first = connect();
    await first.join('Ann');
    await first.until(() => first.lastSnapshot);
    nearlyAway(state);
    await readDebrief(first);
    await first.until(() => onLevel(first, 2));

    const late = connect();
    await late.join('Late');
    const welcome = late.received.find((packet) => packet.type === 'welcome');
    expect(welcome).toMatchObject({ mapSeed: levelSeed(SEED, 2) });
    const frame = await late.until(() => onLevel(late, 2));
    expect(frame.mapSeed).toBe(levelSeed(SEED, 2));
    expect(frame.players.find((p) => p.name === 'Late')).toMatchObject({ reserve: 0 });
  });

  it('gives a reconnecting player their kit and the new town, if they dropped before the change', async () => {
    const { state } = await room();
    const stayer = connect();
    const leaver = connect();
    await stayer.join('Ann', 'token-ann');
    await leaver.join('Bea', 'token-bea');
    await stayer.until(() => stayer.lastSnapshot?.players.length === 2);
    const bea = state.players[1];
    bea.medkits = 3;
    bea.kills = 12;
    bea.health = 50;

    leaver.socket.terminate();
    await stayer.until(() => stayer.lastSnapshot?.players.length === 1);
    nearlyAway(state);
    await readDebrief(stayer);
    await stayer.until(() => onLevel(stayer, 2));

    const back = connect();
    const id = await back.join('Bea', 'token-bea');
    const welcome = back.received.find((packet) => packet.type === 'welcome');
    expect(welcome).toMatchObject({ mapSeed: levelSeed(SEED, 2) });
    const frame = await back.until(() => onLevel(back, 2));
    const me = frame.players.find((p) => p.id === id);
    expect(me).toMatchObject({ medkits: 3, kills: 12, status: 'alive' });
    expect(me?.health).toBeGreaterThanOrEqual(50 + LEVEL_CLEAR_HEAL);
    expect(Math.hypot((me?.x ?? 0) - state.map.spawn.x, (me?.y ?? 0) - state.map.spawn.y)).toBeLessThan(40);
  });

  it('ends a won run like a lost one, and Play Again goes back to the first town', async () => {
    const { state } = await room();
    const client = connect();
    await client.join('Ann');
    await client.until(() => client.lastSnapshot);
    for (let level = 2; level <= FINAL_LEVEL; level++) {
      nearlyAway(state);
      await readDebrief(client);
      await client.until(() => onLevel(client, level));
    }
    nearlyAway(state);

    const won = await client.until(() => {
      const latest = client.lastSnapshot;
      return latest?.phase === 'gameover' ? latest : undefined;
    });
    expect(won.gameOver).toMatchObject({ outcome: 'victory', level: FINAL_LEVEL });
    expect(isSnapshotPacket(won)).toBe(true);

    client.send({ type: 'restart' });
    const fresh = await client.until(() => onLevel(client, 1));
    expect(fresh).toMatchObject({ mapSeed: SEED, phase: 'intermission', gameOver: null, exit: null });
  }, 20000);

  it('takes everyone back to the first town when the room empties mid-run', async () => {
    const { sim, state } = await room();
    const first = connect();
    await first.join('Ann');
    await first.until(() => first.lastSnapshot);
    nearlyAway(state);
    await readDebrief(first);
    await first.until(() => onLevel(first, 2));

    first.socket.terminate();
    await first.until(() => first.closeCode !== null);
    await first.until(() => sim.playerCount === 0 && sim.level === 1);

    const next = connect();
    await next.join('Bea');
    expect(next.received.find((packet) => packet.type === 'welcome')).toMatchObject({ mapSeed: SEED });
  });
});
