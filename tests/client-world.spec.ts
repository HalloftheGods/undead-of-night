import { describe, expect, it } from 'vitest';
import { CHEST_STATION, generateBunkerMap } from '../shared/bunker-map.ts';
import { CHARACTERS } from '../shared/characters.ts';
import { PLAYER_SPEED, TICK_DT } from '../shared/constants.ts';
import type { HomeView, OverrunPhase } from '../shared/home-protocol.ts';
import { playerSpeed } from '../shared/players.ts';
import { BUILDING_DEFS } from '../shared/protocol.ts';
import type { PlayerEntity, SnapshotPacket, WorldMap } from '../shared/protocol.ts';
import { generateWorldMap } from '../shared/world-map.ts';
import { ClientWorld } from '../src/game/client-world.ts';
import { buildHud } from '../src/game/hud-state.ts';

const TICK_MS = TICK_DT * 1000;

const openMap: WorldMap = {
  seed: 1,
  width: 2000,
  height: 2000,
  cols: 125,
  rows: 125,
  tiles: new Uint8Array(125 * 125),
  props: [],
  buildings: [],
  districts: [],
  lights: [],
  spawn: { x: 500, y: 500 },
};

function player(id: string, patch: Partial<PlayerEntity> = {}): PlayerEntity {
  return {
    id, name: id.toUpperCase(), skin: 0, x: 500, y: 500, angle: 0, moving: false, status: 'alive',
    health: 100, maxHealth: 100, weapon: 'pistol', ammo: 12, magSize: 12, reserve: 12, owned: ['pistol'],
    ammoBag: { pistol: 12, carbine: 0, shotgun: 0 }, mags: { pistol: 12, carbine: 0, shotgun: 0 }, medkits: 0, indoors: null,
    reload: 0, bleedout: 0, revive: 0, score: 0, kills: 0, lastInputSeq: 0, knife: false, search: 0, ...patch,
  };
}

function snapshot(tick: number, players: PlayerEntity[], phase: SnapshotPacket['phase'] = 'wave'): SnapshotPacket {
  return {
    type: 'snapshot', tick, phase, level: 1, mapSeed: 1, wave: 1, intermission: 0, hostiles: 0, players,
    zombies: [], bullets: [], pickups: [], exit: null, openedContainers: [], events: [], gameOver: null,
  };
}

describe('ClientWorld', () => {
  it('has nothing to show before the first snapshot', () => {
    expect(new ClientWorld(openMap, 'me').advance(0, 66, 0, 0, 0, 1 / 60)).toBeNull();
  });

  it('predicts at the speed of the local survivor', () => {
    const satori = CHARACTERS.findIndex(({ id }) => id === 'satori');
    const world = new ClientWorld(openMap, 'me');
    world.push(snapshot(1, [{ ...player('me'), skin: satori }]), 1000);
    const me = world.advance(1000, 66, 1, 0, 0, 1 / 60)!.players.find((p) => p.id === 'me')!;
    expect(me.x).toBeCloseTo(500 + playerSpeed(satori) / 60, 3);
  });

  it('moves the local player at once and points them at the live aim', () => {
    const world = new ClientWorld(openMap, 'me');
    world.push(snapshot(1, [player('me')]), 1000);
    const scene = world.advance(1000, 66, 1, 0, 2.5, 1 / 60)!;
    const me = scene.players.find((p) => p.id === 'me')!;
    expect(me.x).toBeCloseTo(500 + PLAYER_SPEED / 60, 3);
    expect(me.angle).toBe(2.5);
    expect(me.moving).toBe(true);
    expect(scene.focusX).toBe(me.x);
  });

  it('draws teammates in the past, between snapshots', () => {
    const world = new ClientWorld(openMap, 'me');
    world.push(snapshot(1, [player('me'), player('mate', { x: 100 })]), 1000);
    world.push(snapshot(2, [player('me'), player('mate', { x: 110 })]), 1000 + TICK_MS);
    const scene = world.advance(1000 + TICK_MS, TICK_MS / 2, 0, 0, 0, 1 / 60)!;
    expect(scene.players.find((p) => p.id === 'mate')!.x).toBeCloseTo(105);
  });

  it('holds the player still while downed', () => {
    const world = new ClientWorld(openMap, 'me');
    world.push(snapshot(1, [player('me', { status: 'downed' })]), 1000);
    const scene = world.advance(1000, 66, 1, 1, 1, 1 / 60)!;
    expect(scene.players[0].x).toBe(500);
    expect(scene.players[0].moving).toBe(false);
  });

  it('stops all movement once the run is over', () => {
    const world = new ClientWorld(openMap, 'me');
    world.push(snapshot(1, [player('me')], 'gameover'), 1000);
    expect(world.advance(1000, 66, 1, 0, 0, 1 / 60)!.players[0].x).toBe(500);
  });

  it('puts the camera on a living teammate after death', () => {
    const world = new ClientWorld(openMap, 'me');
    world.push(snapshot(1, [player('me', { status: 'dead' }), player('mate', { x: 900 })]), 1000);
    const scene = world.advance(1000, 66, 0, 0, 0, 1 / 60)!;
    expect(scene.viewerId).toBe('mate');
    expect(scene.focusX).toBe(900);
  });

  it('stays on the body when nobody is left', () => {
    const world = new ClientWorld(openMap, 'me');
    world.push(snapshot(1, [player('me', { status: 'dead' }), player('mate', { status: 'dead' })]), 1000);
    expect(world.advance(1000, 66, 0, 0, 0, 1 / 60)!.viewerId).toBe('me');
  });

  it('stops prediction when the run ends between ticks', () => {
    const world = new ClientWorld(openMap, 'me');
    world.push(snapshot(50, [player('me')], 'wave'), 1000);
    world.push(snapshot(50, [player('me')], 'gameover'), 1010);
    expect(world.latest?.phase).toBe('gameover');
    expect(world.advance(1010, 66, 1, 0, 0, 1 / 60)!.players[0].x).toBe(500);
  });

  describe('at a door', () => {
    const town = generateWorldMap(4242);
    const building = town.buildings[0];
    const { h, doorX } = BUILDING_DEFS[building.kind];
    const doorstep = { x: building.x + doorX, y: building.y + h + 4 };
    const footprintEnd = building.y + h;

    function walk(world: ClientWorld, dirY: number, until: (y: number) => boolean) {
      for (let frame = 0; frame < 120; frame += 1) {
        const scene = world.advance(1000 + frame, 66, 0, dirY, 0, 1 / 60)!;
        const me = scene.players.find((p) => p.id === 'me')!;
        const arrived = until(me.y);
        if (arrived) return me;
      }
      throw new Error('never reached the door');
    }

    it('opens the room for the shown player, ahead of the sim', () => {
      const world = new ClientWorld(town, 'me');
      world.push(snapshot(1, [player('me', { ...doorstep, indoors: null })]), 1000);
      expect(walk(world, -1, (y) => y < footprintEnd).indoors).toBe(building.id);
    });

    it('shuts it again on the way out, ahead of the sim', () => {
      const world = new ClientWorld(town, 'me');
      const inside = { x: doorstep.x, y: footprintEnd - 4, indoors: building.id };
      world.push(snapshot(1, [player('me', inside)]), 1000);
      expect(walk(world, 1, (y) => y >= footprintEnd).indoors).toBeNull();
    });

    it('still knows where a downed player lies', () => {
      const world = new ClientWorld(town, 'me');
      const inside = { x: doorstep.x, y: footprintEnd - 4, indoors: building.id, status: 'downed' as const };
      world.push(snapshot(1, [player('me', inside)]), 1000);
      expect(world.advance(1000, 66, 0, 0, 0, 1 / 60)!.players[0].indoors).toBe(building.id);
    });
  });

  it('accepts earlier ticks again after a restart', () => {
    const world = new ClientWorld(openMap, 'me');
    world.push(snapshot(50, [player('me')], 'gameover'), 1000);
    world.restart();
    world.push(snapshot(50, [player('me', { x: 42 })], 'intermission'), 1100);
    expect(world.localPlayer?.x).toBe(42);
  });
});

describe('the station prompt in the bunker', () => {
  const bunker = generateBunkerMap();
  const home = (patch: Partial<HomeView> = {}): HomeView => ({
    silver: 0, jewels: { small: 0, large: 0 }, station: null, stationHold: 0, ready: false, receipt: null, overrun: null, ...patch,
  });

  /** What the local player is offered standing at this point, with the room's overrun at this phase. */
  function offered(x: number, y: number, phase: OverrunPhase | undefined, view: HomeView = home()) {
    const world = new ClientWorld(bunker, 'me');
    const frame = { ...snapshot(1, [player('me', { x, y, home: view })]), mapSeed: bunker.seed };
    const overrun = phase ? { overrun: { phase, left: 0, slowed: false, hostiles: 0, total: 0 } } : {};
    world.push({ ...frame, home: { pickedLevel: null, roomHighest: 1, ...overrun } }, 1000);
    return world.advance(1000, 66, 0, 0, 0, 1 / 60)!.station;
  }

  const gunsmith = bunker.stations!.find((station) => station.id === 'gunsmith')!;

  it('offers the chest to a player whose view says theirs is waiting', () => {
    expect(offered(CHEST_STATION.x, CHEST_STATION.y, 'held', home({ chest: true }))).toBe('chest');
  });

  it('offers no chest to a player who has none', () => {
    expect(offered(CHEST_STATION.x, CHEST_STATION.y, 'held')).toBeUndefined();
  });

  it('offers no merchant while the horde is in, as the sim refuses to open one', () => {
    expect(offered(gunsmith.x, gunsmith.y, 'breached')).toBeUndefined();
    expect(offered(gunsmith.x, gunsmith.y, 'counting')).toBe('gunsmith');
    expect(offered(gunsmith.x, gunsmith.y, undefined)).toBe('gunsmith');
  });
});

describe('buildHud', () => {
  it('takes the local stats and lists only the others as teammates', () => {
    const me = player('me', { ammo: 3, score: 40 });
    const hud = buildHud(snapshot(1, [me, player('mate', { health: 10 })]), me, null);
    expect(hud.ammo).toBe(3);
    expect(hud.score).toBe(40);
    expect(hud.teammates).toEqual([{ id: 'mate', name: 'MATE', character: 'Night', color: '#b493ff', health: 10, maxHealth: 100, status: 'alive' }]);
  });

  it('carries what is loaded in each gun', () => {
    const mags = { pistol: 0, carbine: 18, shotgun: 0 };
    const me = player('me', { mags });
    expect(buildHud(snapshot(1, [me]), me, null).mags).toEqual(mags);
  });
});
