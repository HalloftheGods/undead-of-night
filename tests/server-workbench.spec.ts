import { afterEach, describe, expect, it } from 'vitest';
import { startGameServer } from '../server/server.ts';
import type { RunningGameServer } from '../server/server.ts';
import { EXIT_HOLD_SEC } from '../shared/constants.ts';
import { effectOf } from '../shared/gun-upgrades.ts';
import type { SnapshotPacket, WeaponId } from '../shared/protocol.ts';
import type { GunEffect } from '../shared/round-effect-data.ts';
import type { SimState } from '../shared/sim-state.ts';
import { alivePlayers } from '../shared/sim-state.ts';
import { GameSimulation } from '../shared/simulation.ts';
import { isSnapshotPacket } from '../src/network/packet-guards.ts';
import { openLevelExit, stateOf } from './helpers/sim-harness.ts';
import { TestClient } from './helpers/ws-client.ts';

const SEED = 21;

/** Everyone on their feet is at the van, a moment from leaving. */
/** The van's exit shows the level debrief first; the room waits until a player reads on. */
async function readDebrief(client: TestClient): Promise<void> {
  await client.until(() => client.lastSnapshot?.debrief);
  client.send({ type: 'debrief_continue' });
}

function nearlyAway(state: SimState): void {
  state.zombies = [];
  state.populationTarget = 0;
  state.intermissionLeft = 1e6;
  const exit = openLevelExit(state);
  exit.hold = EXIT_HOLD_SEC - 0.15;
  for (const p of alivePlayers(state)) {
    p.x = exit.x;
    p.y = exit.y;
  }
}

function effectIn(frame: SnapshotPacket | null | undefined, weapon: WeaponId): GunEffect | null {
  const gear = frame?.players[0].gear;
  return effectOf(gear?.fits[weapon]);
}

describe('the workbench over a socket', () => {
  let server: RunningGameServer;
  const clients: TestClient[] = [];

  async function room(): Promise<{ state: SimState; ann: TestClient; id: string }> {
    const sim = new GameSimulation({ seed: SEED, workbench: 'timed' });
    server = await startGameServer({ port: 0, simulation: sim });
    const ann = new TestClient(server.port);
    clients.push(ann);
    const id = await ann.join('Ann');
    await ann.until(() => ann.lastSnapshot);
    return { state: stateOf(sim), ann, id };
  }

  afterEach(async () => {
    for (const client of clients.splice(0)) client.socket.terminate();
    await server.close();
  });

  it('fits what a client asks for, and a ready client moves the run on', async () => {
    const { state, ann, id } = await room();
    state.players[0].parts.barrel = 1;
    nearlyAway(state);
    await readDebrief(ann);
    const held = await ann.until(() => ann.lastSnapshot?.bench && ann.lastSnapshot);
    expect(held.bench?.secondsLeft).toBeGreaterThan(0);
    expect(isSnapshotPacket(held)).toBe(true);

    ann.send({ type: 'bench', action: { kind: 'fit', weapon: 'pistol', upgrade: 'damage' } });
    const fitted = await ann.until(() => {
      const frame = ann.lastSnapshot;
      return frame?.players[0].gear?.fits.pistol ? frame : undefined;
    });
    expect(isSnapshotPacket(fitted)).toBe(true);
    expect(fitted.players.find((p) => p.id === id)?.gear?.parts.barrel).toBe(0);

    ann.send({ type: 'bench', action: { kind: 'ready', ready: true } });
    const moved = await ann.until(() => ann.lastSnapshot?.level === 2 && ann.lastSnapshot);
    expect(moved.bench).toBeUndefined();
  });

  it('fits and moves a round kit\'s effect for a client, and the frames stay well formed', async () => {
    const { state, ann } = await room();
    const [p] = state.players;
    p.kits.incendiary = 1;
    p.parts.toolkit = 1;
    p.guns.carbine = { ammo: 30 };
    p.owned = ['pistol', 'carbine'];
    nearlyAway(state);
    await readDebrief(ann);
    await ann.until(() => ann.lastSnapshot?.bench);

    ann.send({ type: 'bench', action: { kind: 'fit_effect', weapon: 'pistol', effect: 'incendiary' } });
    const fitted = await ann.until(() => effectIn(ann.lastSnapshot, 'pistol') === 'incendiary' && ann.lastSnapshot);
    expect(isSnapshotPacket(fitted)).toBe(true);
    expect(fitted.players[0].gear?.kits).toBeUndefined();

    ann.send({ type: 'bench', action: { kind: 'move_effect', from: 'pistol', to: 'carbine' } });
    const moved = await ann.until(() => effectIn(ann.lastSnapshot, 'carbine') === 'incendiary' && ann.lastSnapshot);
    expect(effectIn(moved, 'pistol')).toBeNull();
    expect(moved.players[0].gear?.parts.toolkit).toBe(0);

    ann.send({ type: 'bench', action: { kind: 'ready', ready: true } });
    const nextTown = await ann.until(() => ann.lastSnapshot?.level === 2 && ann.lastSnapshot);
    expect(effectIn(nextTown, 'carbine')).toBe('incendiary');
  });

  it('ignores a bench packet that makes no sense', async () => {
    const { state, ann } = await room();
    nearlyAway(state);
    await readDebrief(ann);
    await ann.until(() => ann.lastSnapshot?.bench);
    ann.send({ type: 'bench', action: { kind: 'ready', ready: 'soon' } });
    ann.send({ type: 'bench', action: 'ready' });
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(state.level).toBe(1);
  });

  it('accepts a part lying in view of a client', async () => {
    const { state, ann } = await room();
    const [p] = state.players;
    state.pickups.push({ id: 'part', type: 'toolkit', x: p.x + 60, y: p.y, ttl: null, rounds: 0 });
    const frame = await ann.until(() => {
      const latest = ann.lastSnapshot;
      return latest?.pickups.some((item) => item.id === 'part') ? latest : undefined;
    });
    expect(isSnapshotPacket(frame)).toBe(true);
  });
});
