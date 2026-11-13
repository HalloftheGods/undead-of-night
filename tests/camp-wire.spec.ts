import { describe, expect, it } from 'vitest';
import { readCampSize } from '../shared/camp/camp-ring.ts';
import { BUNKER_SEED } from '../shared/home-protocol.ts';
import { emptyLoadout } from '../shared/loadout.ts';
import { PROTOCOL_VERSION } from '../shared/protocol.ts';
import type { SnapshotPacket, WelcomePacket } from '../shared/protocol.ts';
import { createGameRoom } from '../shared/room/game-room.ts';
import type { RoomClient } from '../shared/room/game-room.ts';
import type { PeerSocket } from '../shared/room/peer.ts';
import { GameSimulation } from '../shared/simulation.ts';
import { townPrint } from '../shared/town-print.ts';
import { generateWorldMap } from '../shared/world-map.ts';
import { isSnapshotPacket, isWelcomePacket } from '../src/network/packet-guards.ts';
import { RunStage } from '../src/game/run-stage.ts';
import type { ClientWorld } from '../src/game/client-world.ts';
import type { RunHud } from '../src/game/run-hud.ts';
import { driveToTown, homeSim } from './helpers/home-harness.ts';
import { SEED } from './helpers/sim-harness.ts';

/** A room with one seat taken by a player who has reached `highest`, and the packets that player was sent. */
function joinedRoom(highest: number): { sim: GameSimulation; sent: unknown[] } {
  const sim = new GameSimulation({ seed: SEED, home: true });
  const room = createGameRoom({ sim, clock: { now: () => 0, after: () => null, cancel: () => undefined }, newId: () => 'p1', restartVoteMs: 1000, style: 'campaign' });
  const sent: unknown[] = [];
  const peer: PeerSocket = { open: true, send: (text: string) => void sent.push(JSON.parse(text)), close: () => undefined, drop: () => undefined, canTakeFrame: () => true, probe: () => undefined };
  const client: RoomClient = { peer, address: 'test', playerId: null, alive: true, wantsRestart: false, packetAllowance: 1e9, allowanceAt: 0, joinDeadline: null };
  room.receive(client, { type: 'join', name: 'A', token: 'tok-a', style: 'campaign', protocol: PROTOCOL_VERSION, home: { loadout: emptyLoadout(), highest, finished: false } });
  room.shutdown();
  return { sim, sent };
}

const welcomeOf = (sent: unknown[]): WelcomePacket => sent.find((p) => (p as { type?: string }).type === 'welcome') as WelcomePacket;

describe('the camp on the wire', () => {
  it('reads a camp size from anything a packet may carry', () => {
    expect([undefined, null, 'x', {}, Number.NaN, 0, 1, 3, 3.7, 9].map(readCampSize)).toEqual([1, 1, 1, 1, 1, 1, 1, 3, 3, 5]);
  });

  it('says nothing about the camp in a town or in the smallest camp, so those snapshots are as they were', () => {
    const { sim, state } = homeSim();
    expect('campSize' in sim.snapshot()).toBe(false);
    driveToTown(sim, state);
    expect('campSize' in sim.snapshot()).toBe(false);
  });

  it('welcomes a guest into a grown camp with its size, and the guest builds the very camp the room plays', () => {
    const { sim, sent } = joinedRoom(4);
    const welcome = welcomeOf(sent);
    expect(isWelcomePacket(welcome)).toBe(true);
    expect(welcome.campSize).toBe(4);
    const built = generateWorldMap(welcome.mapSeed, welcome.level, readCampSize(welcome.campSize));
    expect(townPrint(built)).toBe(welcome.town);
    const snapshot = sim.snapshot();
    expect(snapshot.campSize).toBe(4);
    expect(isSnapshotPacket(snapshot)).toBe(true);
  });

  it('turns away a guest on the build before the camp', () => {
    expect(PROTOCOL_VERSION).toBe(6);
  });

  it('rebuilds the camp when its size changes, as it would for a new town', () => {
    const maps: number[] = [];
    const hud = { setMap: () => undefined, clearNotices: () => undefined, showLevel: () => undefined } as unknown as RunHud;
    const stage = new RunStage(hud, () => null);
    let entered = 0;
    const world = { enterTown: () => void (entered += 1) } as unknown as ClientWorld;
    const camp = (campSize?: number): SnapshotPacket => ({ mapSeed: BUNKER_SEED, level: 0, ...(campSize ? { campSize } : {}) }) as unknown as SnapshotPacket;
    maps.push(stage.open(BUNKER_SEED, 0, 2).camp?.size ?? 0);
    stage.follow(world, camp(2), 0);
    expect(entered).toBe(0);
    stage.follow(world, camp(3), 0);
    expect(entered).toBe(1);
    stage.follow(world, camp(), 0);
    expect(entered).toBe(2);
    expect(maps).toEqual([2]);
  });
});
