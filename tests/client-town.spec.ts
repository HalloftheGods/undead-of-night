import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MEDKIT_MAX, WEAPONS } from '../shared/constants.ts';
import { townContainers } from '../shared/containers.ts';
import { emptySupplies } from '../shared/supply-types.ts';
import { BUILDING_DEFS } from '../shared/protocol.ts';
import type { PickupEntity, PlayerEntity } from '../shared/protocol.ts';
import { generateWorldMap } from '../shared/world-map.ts';
import { containerLook } from '../src/art/containers.ts';
import { buildArtBook } from '../src/art/index.ts';
import type { PixelSprite } from '../src/art/types.ts';
import { BuildingLayer, roomRect } from '../src/engine/building-layer.ts';
import { EntityRenderer } from '../src/engine/entity-renderer.ts';
import { EMPTY_SCENE } from '../src/engine/scene.ts';
import { FADE_STEPS, fadedCanvas, spriteCanvas } from '../src/engine/sprite-cache.ts';
import { VisualStore } from '../src/engine/visuals.ts';
import { WorldRenderer } from '../src/engine/world-renderer.ts';
import { ClientWorld } from '../src/game/client-world.ts';
import { ammoState, gunRounds, hordeStatus, switchKey } from '../src/game/hud-state.ts';
import { deathFade, healthFraction } from '../src/game/run-hud.ts';
import { hordeBanner, isLandmark, pickupNote, refusalNote, RunNotices } from '../src/game/run-notices.ts';
import type { UiState } from '../src/game/hud-state.ts';
import { TownMapView } from '../src/game/town-map.ts';
import { fakeCanvas, installFakeBrowser } from './client-fake-dom.ts';

const SEED = 4242;

function player(patch: Partial<PlayerEntity> = {}): PlayerEntity {
  return {
    id: 'me', name: 'ANA', skin: 0, x: 500, y: 500, angle: 0, moving: false, status: 'alive',
    health: 100, maxHealth: 100, weapon: 'pistol', ammo: 12, magSize: 12, reserve: 12, owned: ['pistol'],
    ammoBag: { pistol: 12, carbine: 0, shotgun: 0 }, mags: { pistol: 12, carbine: 0, shotgun: 0 }, medkits: 0, indoors: null,
    reload: 0, bleedout: 0, revive: 0, score: 0, kills: 0, lastInputSeq: 0, knife: false, search: 0, ...patch,
  };
}

describe('ammo state', () => {
  const noRounds = { pistol: 0, carbine: 0, shotgun: 0 };
  const hud = {
    weapon: 'pistol' as const,
    ammoBag: { ...noRounds, pistol: 12 },
    mags: { ...noRounds, pistol: 12 },
    owned: ['pistol' as const],
  };
  const armed = { ...hud, owned: ['pistol' as const, 'carbine' as const] };

  it('is calm with rounds to spare', () => {
    expect(ammoState(hud)).toBe('ok');
  });

  it('warns once few rounds are left across every gun', () => {
    expect(ammoState({ ...hud, mags: { ...noRounds, pistol: 6 }, ammoBag: noRounds })).toBe('low');
  });

  it('counts the other guns before it warns', () => {
    expect(ammoState({ ...armed, mags: { ...noRounds, pistol: 3 }, ammoBag: { ...noRounds, carbine: 40 } })).toBe('ok');
  });

  it('ignores rounds for a gun nobody is carrying', () => {
    expect(ammoState({ ...hud, mags: { ...noRounds, pistol: 3 }, ammoBag: { ...noRounds, carbine: 90 } })).toBe('low');
  });

  it('calls an empty magazine with a reserve low or ok, not empty', () => {
    expect(ammoState({ ...hud, mags: noRounds })).not.toBe('empty');
  });

  it('calls a run with nothing left in any gun empty', () => {
    expect(ammoState({ ...hud, mags: noRounds, ammoBag: noRounds })).toBe('empty');
  });

  it('does not call a dry gun empty while a found gun is loaded', () => {
    const foundCarbine = { ...armed, mags: { ...noRounds, carbine: 18 }, ammoBag: noRounds };
    expect(ammoState(foundCarbine)).toBe('ok');
  });

  it('counts the rounds loaded in a gun that is not in hand', () => {
    const nearlyOut = { ...armed, mags: { ...noRounds, carbine: 4 }, ammoBag: { ...noRounds, carbine: 3 } };
    expect(ammoState(nearlyOut)).toBe('low');
  });

  it('shows a slot its magazine and its bag together', () => {
    expect(gunRounds({ mags: { ...noRounds, carbine: 18 }, ammoBag: { ...noRounds, carbine: 6 } }, 'carbine')).toBe(24);
  });

  it('points at a loaded gun when the one in hand is dry', () => {
    const foundCarbine = { ...armed, mags: { ...noRounds, carbine: 18 }, ammoBag: noRounds };
    expect(switchKey(foundCarbine)).toBe(2);
  });

  it('points at a gun with only spare rounds too', () => {
    const owned = ['pistol' as const, 'shotgun' as const];
    expect(switchKey({ ...hud, owned, mags: noRounds, ammoBag: { ...noRounds, shotgun: 6 } })).toBe(3);
  });

  it('asks for no switch while the gun in hand can still fire', () => {
    expect(switchKey({ ...armed, mags: noRounds, ammoBag: { ...noRounds, pistol: 6, carbine: 6 } })).toBeNull();
  });

  it('asks for no switch when every gun is dry, or for a gun nobody is carrying', () => {
    expect(switchKey({ ...armed, mags: noRounds, ammoBag: noRounds })).toBeNull();
    expect(switchKey({ ...hud, mags: { ...noRounds, carbine: 18 }, ammoBag: noRounds })).toBeNull();
  });
});

describe('horde status', () => {
  it('counts down quietly through the lull', () => {
    const status = hordeStatus({ phase: 'intermission', wave: 2, intermission: 91.4, hostiles: 0 });
    expect(status).toEqual({ title: 'Horde in 1:32', detail: '', loud: false });
  });

  it('never says wave 0 during the lead-in', () => {
    const { title } = hordeStatus({ phase: 'intermission', wave: 0, intermission: 140, hostiles: 0 });
    expect(title).toBe('Horde in 2:20');
  });

  it('names the horde and what is left of it', () => {
    expect(hordeStatus({ phase: 'wave', wave: 3, intermission: 0, hostiles: 14 })).toEqual({
      title: 'Horde 3',
      detail: '14 hostiles left',
      loud: true,
    });
  });

  it('does not count down to a horde once the run is over', () => {
    const status = hordeStatus({ phase: 'gameover', wave: 3, intermission: 0, hostiles: 5 });
    expect(status).toEqual({ title: 'Game over', detail: '', loud: true });
  });

  it('gets its grammar right for the last one', () => {
    expect(hordeStatus({ phase: 'wave', wave: 3, intermission: 0, hostiles: 1 }).detail).toBe('1 hostile left');
  });
});

describe('notices', () => {
  it('names the rounds a box was worth', () => {
    const after = player({ ammoBag: { pistol: 24, carbine: 0, shotgun: 0 } });
    expect(pickupNote('pistol_ammo', player(), after)).toBe('+12 PISTOL AMMO');
  });

  it('names shells by their own word', () => {
    const after = player({ ammoBag: { pistol: 12, carbine: 0, shotgun: 6 } });
    expect(pickupNote('shells', player(), after)).toBe('+6 SHELLS');
  });

  it('says what a bandage added to supplies', () => {
    const after = player({ supplies: { ...emptySupplies(), bandage: 1 } });
    expect(pickupNote('bandage', player(), after)).toBe('+1 BANDAGE');
  });

  it('counts a medkit as carried, not healed', () => {
    expect(pickupNote('medkit', player(), player({ medkits: 1 }))).toBe('+1 MEDKIT');
  });

  it('names a found gun', () => {
    expect(pickupNote('shotgun', player(), player())).toBe('SHOTGUN');
  });

  it('still says something with no player to compare', () => {
    expect(pickupNote('carbine_ammo', null, null)).toBe('CARBINE AMMO');
  });

  it('explains a medkit that will not fit', () => {
    expect(refusalNote(player({ medkits: MEDKIT_MAX }), 'medkit')).toBe('MEDKITS FULL');
    expect(refusalNote(player({ medkits: MEDKIT_MAX - 1 }), 'medkit')).toBeNull();
  });

  it('explains ammo with no room left', () => {
    const full = player({ ammoBag: { pistol: WEAPONS.pistol.reserveCap, carbine: 0, shotgun: 0 } });
    expect(refusalNote(full, 'pistol_ammo')).toBe('AMMO FULL');
    expect(refusalNote(full, 'shells')).toBeNull();
  });

  it('shouts when a horde starts', () => {
    expect(hordeBanner({ type: 'wave_start', wave: 3, hostiles: 22 })).toEqual({ title: 'HORDE 3', subtitle: '22 HOSTILES', tone: 'danger' });
  });

  it('promises nothing when a horde ends', () => {
    const banner = hordeBanner({ type: 'wave_clear', wave: 3 });
    expect(banner?.title).toBe('THE HORDE MOVES ON');
    expect(banner?.tone).toBe('quiet');
  });

  it('says nothing for anything else', () => {
    expect(hordeBanner({ type: 'wave_intermission', wave: 1, seconds: 100 })).toBeNull();
  });

  it('names the landmarks, not every front door', () => {
    expect(isLandmark('pharmacy')).toBe(true);
    expect(isLandmark('warehouse')).toBe(true);
    expect(isLandmark('house')).toBe(false);
    expect(isLandmark('apartment')).toBe(false);
  });
});

describe('RunNotices', () => {
  const medkit: PickupEntity = { id: 'i1', type: 'medkit', x: 505, y: 500 };

  it('hands out a new key for each banner, so each replays', () => {
    const notices = new RunNotices();
    const first = notices.banner({ title: 'A', subtitle: '', tone: 'danger' }, 0);
    const second = notices.banner({ title: 'A', subtitle: '', tone: 'danger' }, 0);
    expect(second.key).not.toBe(first.key);
  });

  it('reports a building once, on the way in', () => {
    const notices = new RunNotices();
    expect(notices.entered(null)).toBeNull();
    expect(notices.entered('b1')).toBe('b1');
    expect(notices.entered('b1')).toBeNull();
    expect(notices.entered(null)).toBeNull();
    expect(notices.entered('b1')).toBe('b1');
  });

  it('forgets where it was for a new run', () => {
    const notices = new RunNotices();
    notices.entered('b1');
    notices.reset();
    expect(notices.entered('b1')).toBe('b1');
  });

  it('speaks up about a refused item, then waits', () => {
    const notices = new RunNotices();
    const full = player({ medkits: MEDKIT_MAX });
    expect(notices.refusal(full, [medkit], 0)).toBe('MEDKITS FULL');
    expect(notices.refusal(full, [medkit], 500)).toBeNull();
    expect(notices.refusal(full, [medkit], 3000)).toBe('MEDKITS FULL');
  });

  it('leaves alone an item out of reach', () => {
    const full = player({ medkits: MEDKIT_MAX });
    expect(new RunNotices().refusal(full, [{ ...medkit, x: 540 }], 0)).toBeNull();
  });

  it('has nothing to say to a downed player', () => {
    const downed = player({ status: 'downed', medkits: MEDKIT_MAX });
    expect(new RunNotices().refusal(downed, [medkit], 0)).toBeNull();
  });

  it('clears banners only when they have run their time', () => {
    const notices = new RunNotices();
    const banner = notices.banner({ title: 'A', subtitle: '', tone: 'danger' }, 0);
    const place = notices.place('Pharmacy', 0);
    const ui = { banner, place, levelCard: null } as UiState;
    expect(notices.expired(ui, 100)).toEqual({});
    expect(notices.expired(ui, 2400)).toEqual({ place: null });
    expect(notices.expired(ui, 2700)).toEqual({ banner: null, place: null });
  });
});

describe('run hud helpers', () => {
  it('only reports health for someone on their feet', () => {
    expect(healthFraction(player({ health: 25 }))).toBe(0.25);
    expect(healthFraction(player({ status: 'downed', health: 25 }))).toBe(1);
    expect(healthFraction(null)).toBe(1);
  });

  it('drains colour by how far gone the player is', () => {
    expect(deathFade('alive', false)).toBe(0);
    expect(deathFade('downed', false)).toBeGreaterThan(0);
    expect(deathFade('dead', false)).toBeGreaterThan(deathFade('downed', false));
    expect(deathFade('alive', true)).toBeGreaterThan(deathFade('dead', false));
  });
});

describe('the town on screen', () => {
  const map = generateWorldMap(SEED);
  const art = buildArtBook();

  beforeEach(() => {
    installFakeBrowser();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function layer(): BuildingLayer {
    const buildings = new BuildingLayer(art.environment);
    buildings.setMap(map);
    return buildings;
  }

  const building = map.buildings[0];
  const def = BUILDING_DEFS[building.kind];
  const insideX = building.x + def.w / 2;
  const insideY = building.y + def.h / 2;

  it('hides what is in a closed building and nothing outdoors', () => {
    const buildings = layer();
    expect(buildings.isHidden(insideX, insideY)).toBe(true);
    expect(buildings.isHidden(building.x - 20, insideY)).toBe(false);
  });

  it('opens the shell of the building the viewer is in, and only that one', () => {
    const buildings = layer();
    buildings.update(building.id, 0.1);
    expect(buildings.openRoom()?.building.id).toBe(building.id);
    expect(buildings.isHidden(insideX, insideY)).toBe(false);
    const other = map.buildings[1];
    expect(buildings.isHidden(other.x + 20, other.y + 20)).toBe(true);
  });

  it('opens quickly and closes again on the way out', () => {
    const buildings = layer();
    buildings.update(building.id, 0.3);
    expect(buildings.openRoom()?.reveal).toBe(1);
    buildings.update(null, 0.3);
    expect(buildings.openRoom()).toBeNull();
  });

  it('stays put while the game is frozen', () => {
    const buildings = layer();
    buildings.update(building.id, 0.1);
    const reveal = buildings.openRoom()?.reveal;
    buildings.update(null, 0);
    expect(buildings.openRoom()?.reveal).toBe(reveal);
  });

  it('closes everything for a new run', () => {
    const buildings = layer();
    buildings.update(building.id, 1);
    buildings.reset();
    expect(buildings.openRoom()).toBeNull();
  });

  it('sorts a shell at the south edge of its footprint, over all that is inside', () => {
    const placed = layer().placedAt(insideX, insideY);
    expect(placed?.depthY).toBe(building.y + def.h);
  });

  it('gives each building a shell that covers its footprint', () => {
    for (const placed of layer().placed) {
      const { x, y } = placed.building;
      expect(placed.x0).toBeLessThanOrEqual(x);
      expect(placed.y0).toBeLessThanOrEqual(y);
      expect(placed.x1).toBeGreaterThanOrEqual(x + placed.width);
      expect(placed.y1).toBeGreaterThanOrEqual(y + placed.height);
    }
  });

  it('measures a room in screen pixels', () => {
    const placed = layer().placedAt(insideX, insideY)!;
    expect(roomRect(placed, 100, 50)).toEqual({
      x0: building.x - 100,
      y0: building.y - 50,
      x1: building.x - 100 + def.w,
      y1: building.y - 50 + def.h,
    });
  });

  it('knocks more pixels out of a shell at each step of the fade', () => {
    const size = 8;
    const sprite: PixelSprite = { w: size, h: size, ax: 0, ay: 0, rgba: new Uint8ClampedArray(size * size * 4).fill(255) };
    const uploads: Uint8ClampedArray[] = [];
    vi.stubGlobal('ImageData', class {
      constructor(data: Uint8ClampedArray) {
        uploads.push(data);
      }
    });
    fadedCanvas(sprite, 2);
    fadedCanvas(sprite, FADE_STEPS - 1);
    const holes = uploads.map((pixels) => pixels.filter((_, i) => i % 4 === 3 && pixels[i] === 0).length);
    expect(holes[0]).toBeGreaterThan(0);
    expect(holes[1]).toBeGreaterThan(holes[0]);
    expect(holes[1]).toBeLessThan(size * size);
  });

  it('draws a viewer walking in, and back out, on whole pixels', () => {
    const renderer = new WorldRenderer(fakeCanvas() as unknown as HTMLCanvasElement, art, false);
    renderer.setMap(map);
    const zombies = [{ id: 'z', type: 'walker' as const, x: insideX + 10, y: insideY, angle: 0, health: 10, maxHealth: 60, attacking: false }];
    const pickups = [{ id: 'k', type: 'medkit' as const, x: insideX - 10, y: insideY }];
    const scene = (indoors: string | null) => ({
      ...EMPTY_SCENE,
      players: [player({ x: insideX, y: insideY, indoors })],
      zombies,
      pickups,
      localId: 'me',
      viewerId: 'me',
      focusX: insideX,
      focusY: insideY,
    });
    for (let frame = 0; frame < 30; frame += 1) renderer.render(scene(building.id), 1 / 30);
    for (let frame = 0; frame < 30; frame += 1) renderer.render(scene(null), 1 / 30);
    expect(renderer.frameMs).toBeGreaterThan(0);
  });

  it('predicts the local player stopping at a wall, as the sim does', () => {
    const world = new ClientWorld(map, 'me');
    const { predictor } = world;
    predictor.reset(building.x + 40, building.y - 20);
    for (let frame = 0; frame < 120; frame += 1) predictor.advance(0, 1, 1 / 60);
    expect(predictor.y).toBeLessThan(building.y);
    expect(predictor.y).toBeGreaterThan(building.y - 10);
  });

  it('leaves a closed room out of the frame, furniture and all', () => {
    const furnished = map.buildings.find((candidate) => {
      const { w, h } = BUILDING_DEFS[candidate.kind];
      return map.props.some((prop) => prop.x > candidate.x && prop.x < candidate.x + w && prop.y > candidate.y && prop.y < candidate.y + h);
    })!;
    const buildings = layer();
    const entities = new EntityRenderer(art, new VisualStore(), buildings);
    entities.setMap(map, () => {});
    const draws = () => {
      const ctx = fakeCanvas().getContext();
      entities.drawWorld(ctx as unknown as CanvasRenderingContext2D, EMPTY_SCENE, furnished.x - 40, furnished.y - 40, 320, 240, 0, 1 / 60);
      return ctx.drawImageCalls;
    };
    const closed = draws();
    buildings.update(furnished.id, 1);
    expect(draws()).toBeGreaterThan(closed);
  });

  it('swaps a prop for its searched sprite once it has been searched', () => {
    const container = townContainers(map).find(({ buildingKind }) => buildingKind === 'outdoors')!;
    const entities = new EntityRenderer(art, new VisualStore(), layer());
    entities.setMap(map, () => {});
    const images = (openedContainers: readonly number[]) => {
      const ctx = fakeCanvas().getContext();
      const drawImage = vi.fn();
      ctx.drawImage = drawImage;
      const scene = { ...EMPTY_SCENE, openedContainers };
      entities.drawWorld(ctx as unknown as CanvasRenderingContext2D, scene, container.x - 160, container.y - 120, 320, 240, 0, 1 / 60);
      return drawImage.mock.calls.map(([image]) => image);
    };
    const searched = spriteCanvas(art.containers[containerLook(container)].opened);
    expect(images([])).not.toContain(searched);
    expect(images([container.id])).toContain(searched);
  });

  it('glints a pickup where the light finds it, and stays dark where it does not', () => {
    const buildings = layer();
    const entities = new EntityRenderer(art, new VisualStore(), buildings);
    const canvas = fakeCanvas();
    const ctx = canvas.getContext();
    const fills = vi.fn();
    ctx.fillRect = fills;
    const pickups = [{ id: 'k', type: 'medkit' as const, x: 100, y: 100 }];
    const scene = { ...EMPTY_SCENE, pickups };
    const draw = (light: number, time: number) => entities.drawGlints(
      ctx as unknown as CanvasRenderingContext2D, scene, 0, 0, 300, 200, time, () => light,
    );
    for (let time = 0; time < 2; time += 0.05) draw(20, time);
    expect(fills).not.toHaveBeenCalled();
    for (let time = 0; time < 2; time += 0.05) draw(200, time);
    expect(fills).toHaveBeenCalled();
  });

  it('shows the town map at two pixels a tile', () => {
    const view = new TownMapView(map);
    expect(view.width).toBe(map.cols * 2);
    // The floors above and below lie off the bottom of the town, so the map ends at the town's edge.
    expect(view.height).toBe((map.townRows ?? map.rows) * 2);
  });

  it('paints players and ticks without leaving whole pixels', () => {
    const view = new TownMapView(map);
    view.markVisited(building.id);
    view.markVisited('no-such-building');
    const ctx = fakeCanvas().getContext() as unknown as CanvasRenderingContext2D;
    const players = [player({ x: 800, y: 900 }), player({ id: 'mate', x: 900, y: 900 }), player({ id: 'gone', status: 'dead' })];
    expect(() => view.paint(ctx, players, 'me')).not.toThrow();
  });

  it('remembers where the player has been until the run ends', () => {
    const view = new TownMapView(map);
    view.markVisited(building.id);
    expect(view.hasVisited(building.id)).toBe(true);
    view.clearVisited();
    expect(view.hasVisited(building.id)).toBe(false);
  });

  it('finds a building by id, and shrugs at one it does not know', () => {
    const view = new TownMapView(map);
    expect(view.building(building.id)).toBe(building);
    expect(view.building('nope')).toBeNull();
  });

  it('marks a building as cleared with an X when visited and all containers are checked', () => {
    const view = new TownMapView(map);
    const containers = townContainers(map).filter((c) => c.building === building.id);
    expect(containers.length).toBeGreaterThan(0);

    for (const c of containers) view.markOpened(c.id);
    expect(view.isCleared(building.id)).toBe(false);

    view.clearOpened();
    view.markVisited(building.id);
    expect(view.isCleared(building.id)).toBe(false);
    view.markOpened(containers[0].id);
    if (containers.length > 1) {
      expect(view.isCleared(building.id)).toBe(false);
    }

    for (const c of containers) view.markOpened(c.id);
    expect(view.isCleared(building.id)).toBe(true);
  });

  it('paints hand-drawn cross for cleared buildings without throwing', () => {
    const view = new TownMapView(map);
    view.markVisited(building.id);
    const containers = townContainers(map).filter((c) => c.building === building.id);
    const ctx = fakeCanvas().getContext() as unknown as CanvasRenderingContext2D;
    expect(() => view.paint(ctx, [], 'me', null, containers.map((c) => c.id))).not.toThrow();
    expect(view.isCleared(building.id)).toBe(true);
  });
});
