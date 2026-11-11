import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { PlayerEntity, ZombieEntity } from '../shared/protocol.ts';
import { generateWorldMap } from '../shared/world-map.ts';
import { drawZombieBlips, isEntityBelow, isZombieInFov, MapFog } from '../src/game/map-fog.ts';
import { TownMapView } from '../src/game/town-map.ts';
import { fakeCanvas, installFakeBrowser } from './client-fake-dom.ts';

function makePlayer(overrides: Partial<PlayerEntity> = {}): PlayerEntity {
  return {
    id: 'player-1',
    name: 'Survivor',
    x: 200,
    y: 200,
    angle: 0, // facing right (+X)
    health: 100,
    maxHealth: 100,
    alive: true,
    status: 'normal',
    weapon: 'pistol',
    ammo: 12,
    score: 0,
    kills: 0,
    ...overrides,
  } as PlayerEntity;
}

function makeZombie(overrides: Partial<ZombieEntity> = {}): ZombieEntity {
  return {
    id: 'z-1',
    type: 'walker',
    x: 200,
    y: 200,
    angle: 0,
    health: 50,
    maxHealth: 50,
    attacking: false,
    ...overrides,
  };
}

describe('zombie radar in field of view (FOV)', () => {
  beforeAll(() => installFakeBrowser());

  it('detects a zombie directly in front within range', () => {
    const player = makePlayer({ x: 200, y: 200, angle: 0 });
    const inFrontZombie = makeZombie({ x: 300, y: 200 }); // 100px to the right
    expect(isZombieInFov(inFrontZombie, player)).toBe(true);
  });

  it('detects a zombie angled within the 60 degree half-cone', () => {
    const player = makePlayer({ x: 200, y: 200, angle: 0 });
    // 100px forward, 50px up => angle approx 0.46 rad (26 deg) <= PI/3 (~1.05 rad)
    const angledZombie = makeZombie({ x: 300, y: 150 });
    expect(isZombieInFov(angledZombie, player)).toBe(true);
  });

  it('ignores a zombie in front that is beyond max FOV range', () => {
    const player = makePlayer({ x: 200, y: 200, angle: 0 });
    const farZombie = makeZombie({ x: 650, y: 200 }); // 450px > 380px range
    expect(isZombieInFov(farZombie, player)).toBe(false);
  });

  it('ignores a zombie behind outside close awareness range', () => {
    const player = makePlayer({ x: 200, y: 200, angle: 0 });
    const behindZombie = makeZombie({ x: 100, y: 200 }); // 100px behind > 70px close range
    expect(isZombieInFov(behindZombie, player)).toBe(false);
  });

  it('detects a zombie behind if within close awareness range', () => {
    const player = makePlayer({ x: 200, y: 200, angle: 0 });
    const closeBehindZombie = makeZombie({ x: 150, y: 200 }); // 50px behind <= 70px close range
    expect(isZombieInFov(closeBehindZombie, player)).toBe(true);
  });

  it('ignores a dead zombie even if in front', () => {
    const player = makePlayer({ x: 200, y: 200, angle: 0 });
    const deadZombie = makeZombie({ x: 250, y: 200, health: 0 });
    expect(isZombieInFov(deadZombie, player)).toBe(false);
  });
});

describe('map fog of war', () => {
  beforeAll(() => installFakeBrowser());

  it('reveals fog and draws it to the destination canvas', () => {
    const fog = new MapFog(400, 400);
    expect(() => fog.reveal(100, 100, false)).not.toThrow();

    const ctx = fakeCanvas().getContext() as unknown as CanvasRenderingContext2D;
    const drawImageSpy = vi.spyOn(ctx, 'drawImage');
    fog.drawFog(ctx, false);
    expect(drawImageSpy).toHaveBeenCalledTimes(1);
  });

  it('supports separate sewer fog layer', () => {
    const fog = new MapFog(400, 400);
    expect(() => fog.reveal(100, 100, true)).not.toThrow();

    const ctx = fakeCanvas().getContext() as unknown as CanvasRenderingContext2D;
    const drawImageSpy = vi.spyOn(ctx, 'drawImage');
    fog.drawFog(ctx, true);
    expect(drawImageSpy).toHaveBeenCalledTimes(1);
  });

  it('resets fog on command', () => {
    const fog = new MapFog(400, 400);
    expect(() => fog.reset()).not.toThrow();
  });
});

describe('layer filtering and zombie blip rendering', () => {
  beforeAll(() => installFakeBrowser());

  it('distinguishes surface from sewers based on boundary tile', () => {
    expect(isEntityBelow(1000, 200)).toBe(false); // 1000 < 200 * 32 (6400)
    expect(isEntityBelow(7000, 200)).toBe(true); // 7000 >= 6400
    expect(isEntityBelow(7000, undefined)).toBe(false);
  });

  it('draws blips only for visible zombies on the viewed layer', () => {
    const ctx = fakeCanvas().getContext() as unknown as CanvasRenderingContext2D;
    const fills = vi.spyOn(ctx, 'fillRect');

    const player = makePlayer({ x: 200, y: 200, angle: 0 });
    const visibleZombie = makeZombie({ id: 'z-vis', x: 250, y: 200 });
    const hiddenZombie = makeZombie({ id: 'z-hid', x: 100, y: 200 });

    drawZombieBlips(ctx, [visibleZombie, hiddenZombie], [player], 16, undefined, false);
    expect(fills).toHaveBeenCalled();
  });

  it('integrates with TownMapView paint without error', () => {
    const map = generateWorldMap(4242);
    const view = new TownMapView(map);
    const ctx = fakeCanvas().getContext() as unknown as CanvasRenderingContext2D;
    const player = makePlayer({ x: 300, y: 300, angle: 0 });
    const zombie = makeZombie({ x: 350, y: 300 });

    expect(() => view.paint(ctx, [player], player.id, null, [], null, undefined, [], [zombie])).not.toThrow();
  });

  it('reveals fog as players walk without the map open', () => {
    const map = generateWorldMap(4242);
    const view = new TownMapView(map);
    const player = makePlayer({ x: 300, y: 300 });

    expect(() => view.revealPlayers([player])).not.toThrow();

    player.x = 450;
    player.y = 450;
    expect(() => view.revealPlayers([player])).not.toThrow();
  });
});
