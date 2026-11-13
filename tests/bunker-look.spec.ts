import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateBunkerMap } from '../shared/bunker-map.ts';
import { STATION_IDS } from '../shared/home-protocol.ts';
import { TREASURE_TYPES } from '../shared/events.ts';
import { TILE_SIZE } from '../shared/protocol.ts';
import { buildArtBook } from '../src/art/index.ts';
import type { PixelSprite } from '../src/art/types.ts';
import { PICKUP_SFX } from '../src/audio/audio-engine.ts';
import { allTracks, LULLS, playlistFor } from '../src/audio/playlists.ts';
import { SFX_NAMES } from '../src/audio/sfx-registry.ts';
import { Atmosphere } from '../src/engine/atmosphere.ts';
import { LEVEL_LOOKS, lampWorks } from '../src/engine/level-look.ts';
import { stationPrompt } from '../src/engine/station-labels.ts';
import { NO_PROGRESS } from '../src/game/level-progress.ts';
import { musicEntries } from '../src/game/sound-test.ts';
import { TownMapView } from '../src/game/town-map.ts';
import { fakeCanvas, installFakeBrowser } from './client-fake-dom.ts';

const BUNKER_TRACK = 'level-06-underground-bunker.mp3';
const art = buildArtBook();

const opaque = (sprite: PixelSprite): number => {
  let count = 0;
  for (let i = 3; i < sprite.rgba.length; i += 4) if (sprite.rgba[i] === 255) count += 1;
  return count;
};

const same = (a: PixelSprite, b: PixelSprite): boolean =>
  a.w === b.w && a.h === b.h && a.rgba.every((value, index) => value === b.rgba[index]);

describe('the bunker look', () => {
  beforeEach(() => void installFakeBrowser());
  afterEach(() => void vi.unstubAllGlobals());

  it('has no weather and its own light', () => {
    const look = LEVEL_LOOKS.bunker;
    expect(look.weather).toBeNull();
    expect(look.wash).toBeNull();
    expect(look.lampColor).toMatch(/^#/);
    expect(look.lampEvery).toBe(1);
    expect(lampWorks(look, 3)).toBe(true);
    const [red, , blue] = look.ambient;
    expect(red).toBeGreaterThan(blue);
    expect(look.ambient).not.toEqual(LEVEL_LOOKS.night.ambient);
  });

  it('draws nothing falling in front of the bunker', () => {
    const atmosphere = new Atmosphere(false);
    atmosphere.setTheme('bunker');
    const ctx = fakeCanvas().getContext();
    const fills = vi.fn();
    ctx.fillRect = fills;
    atmosphere.drawWeather(ctx as unknown as CanvasRenderingContext2D, 0, 0, 320, 180, 12, 1);
    expect(fills).not.toHaveBeenCalled();
  });
});

describe('the station prompt', () => {
  it('names every station and the key to hold', () => {
    for (const id of STATION_IDS) expect(stationPrompt(id, false)).toMatch(/^HOLD E: [A-Z ]+$/);
    expect(stationPrompt('locker', false)).toBe('HOLD E: LOCKER');
    expect(stationPrompt('candy_shop', true)).toBe('OPEN: CANDY SHOP');
  });
});

describe('the town map in the bunker', () => {
  beforeEach(() => void installFakeBrowser());
  afterEach(() => void vi.unstubAllGlobals());

  it('draws the camp small enough for the screen, with area labels', () => {
    const base = generateBunkerMap();
    const rooms = [
      { name: 'Workshop', x: 160, y: 120 },
      { name: 'Storeroom', x: 480, y: 120 },
      { name: 'Garage', x: 480, y: 300 },
    ];
    const map = { ...base, districts: rooms };
    const view = new TownMapView(map);
    expect(view.width).toBeLessThan(300);
    expect(view.width).toBeGreaterThan(view.height);
    expect(view.width).toBe(map.cols * view.pixelsPerTile);
    expect(view.roomLabels).toEqual(['Workshop', 'Storeroom', 'Garage']);
    const ctx = fakeCanvas().getContext() as unknown as CanvasRenderingContext2D;
    expect(() => view.paint(ctx, [], 'me')).not.toThrow();
  });
});

describe('the bunker art', () => {
  it('has a sprite for the jukebox, drawn for it', () => {
    const { props } = art.environment;
    expect(opaque(props.jukebox)).toBeGreaterThan(150);
    expect(same(props.jukebox, props.locker)).toBe(false);
  });

  it('has a sprite for the forge and the level map, drawn for them', () => {
    const { props } = art.environment;
    for (const kind of ['forge', 'level_map'] as const) expect(opaque(props[kind]), kind).toBeGreaterThan(200);
    expect(same(props.forge, props.workbench)).toBe(false);
    expect(same(props.level_map, props.table)).toBe(false);
    expect(props.forge.h).toBeGreaterThan(props.workbench.h);
  });

  it('has two bunker wall tiles that tile and differ', () => {
    const walls = art.environment.tiles.bunker_wall;
    expect(walls).toHaveLength(2);
    for (const wall of walls) {
      expect([wall.w, wall.h]).toEqual([TILE_SIZE, TILE_SIZE]);
      expect(opaque(wall)).toBe(TILE_SIZE * TILE_SIZE);
    }
    expect(same(walls[0], walls[1])).toBe(false);
  });

  it('has a sprite and an icon for every treasure, each its own', () => {
    for (const type of TREASURE_TYPES) {
      const clip = art.pickups[type];
      expect(clip.frames.length, type).toBeGreaterThan(1);
      for (const frame of clip.frames) expect(opaque(frame), type).toBeGreaterThan(20);
      expect(opaque(art.ui.pickupIcons[type]), type).toBeGreaterThan(20);
    }
    const icons = [...TREASURE_TYPES.map((type) => art.ui.pickupIcons[type]), art.ui.silverIcon];
    expect(opaque(art.ui.silverIcon)).toBeGreaterThan(20);
    for (const [index, icon] of icons.entries()) {
      for (const other of icons.slice(index + 1)) expect(same(icon, other)).toBe(false);
    }
  });
});

describe('the bunker music', () => {
  it('gives the bunker track to the bunker in Campaign, and leaves it on level 6 in Arcade', () => {
    expect(playlistFor('bunker', 0).files).toEqual(playlistFor('bunker', 0, 'arcade').files);
    const off = playlistFor('bunker', 0, 'arcade');
    expect(off.files).not.toContain(BUNKER_TRACK);
    expect(off).toBe(playlistFor('intermission', 1, 'arcade'));
    expect(playlistFor('intermission', 6, 'arcade').files).toContain(BUNKER_TRACK);

    const on = playlistFor('bunker', 0, 'campaign');
    expect(on.files).toEqual([BUNKER_TRACK]);
    expect(playlistFor('intermission', 6, 'campaign').files).not.toContain(BUNKER_TRACK);
    expect(playlistFor('wave', 6, 'campaign').files).not.toContain(BUNKER_TRACK);
    expect(LULLS.flatMap((playlist) => playlist.files)).toContain(BUNKER_TRACK);
  });

  it('lists the bunker track from the start in Campaign', () => {
    const home = musicEntries(NO_PROGRESS, 'campaign');
    const entry = home.find((each) => each.file === BUNKER_TRACK);
    expect(entry).toMatchObject({ unlocked: true, where: 'BUNKER', label: 'Underground Bunker' });
    expect(home.filter((each) => each.file === BUNKER_TRACK)).toHaveLength(1);
    expect(home.map((each) => each.file)).toEqual(allTracks('campaign').map((track) => track.file));

    const arcade = musicEntries(NO_PROGRESS, 'arcade').find((each) => each.file === BUNKER_TRACK);
    expect(arcade).toMatchObject({ unlocked: false, where: 'SIXINNATI' });
  });
});

describe('treasure sounds', () => {
  it('gives each jewel a sound of its own', () => {
    const names = TREASURE_TYPES.map((type) => PICKUP_SFX[type]);
    expect(new Set(names).size).toBe(TREASURE_TYPES.length);
    for (const name of names) expect(SFX_NAMES).toContain(name);
    expect(names).not.toContain('pickup_ammo');
    expect(names).not.toContain('pickup_bandage');
  });
});
