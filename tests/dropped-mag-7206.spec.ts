// #7206: a reload's dropped magazine lands as a ground decal, not a pose field, so it no
// longer pops out when the next pose has none and is never dragged along by a walking figure.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlayerEntity } from '../shared/protocol.ts';
import { buildArtBook } from '../src/art/index.ts';
import { magLanding } from '../src/art/survivors/clips.ts';
import type { PixelSprite } from '../src/art/types.ts';
import { BuildingLayer } from '../src/engine/building-layer.ts';
import { EntityRenderer } from '../src/engine/entity-renderer.ts';
import { EMPTY_SCENE } from '../src/engine/scene.ts';
import { VisualStore } from '../src/engine/visuals.ts';
import { installFakeBrowser } from './client-fake-dom.ts';

const art = buildArtBook();

function player(patch: Partial<PlayerEntity> = {}): PlayerEntity {
  return {
    id: 'me', name: 'ANA', skin: 0, x: 200, y: 200, angle: 0, moving: false, status: 'alive',
    health: 100, maxHealth: 100, weapon: 'carbine', ammo: 0, magSize: 30, reserve: 30, owned: ['pistol', 'carbine'],
    ammoBag: { pistol: 12, carbine: 30, shotgun: 0 }, mags: { pistol: 12, carbine: 30, shotgun: 0 }, medkits: 0, indoors: null,
    reload: 0, bleedout: 0, revive: 0, score: 0, kills: 0, lastInputSeq: 0, knife: false, search: 0, ...patch,
  } as PlayerEntity;
}

describe('the dropped magazine landing', () => {
  it('lands partway through every magazine reload, and the shotgun drops none', () => {
    for (let dir = 0; dir < 8; dir += 1) {
      for (const weapon of ['pistol', 'carbine'] as const) {
        const landing = magLanding(weapon, dir);
        expect(landing, `${weapon}/${dir}`).not.toBeNull();
        expect(landing!.at).toBeGreaterThan(0);
        expect(landing!.at).toBeLessThan(1);
      }
      expect(magLanding('shotgun', dir)).toBeNull();
    }
  });

  it('lands on the mirrored side for a mirrored facing', () => {
    const east = magLanding('carbine', 0)!;
    const west = magLanding('carbine', 4)!;
    expect(west.at).toBe(east.at);
    expect(west.dy).toBe(east.dy);
    expect(west.dx).toBe(-east.dx - art.fx.droppedMag.w);
  });
});

describe('stamping the magazine into the ground', () => {
  beforeEach(() => {
    installFakeBrowser();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function drawAt(reloads: readonly number[], patch: Partial<PlayerEntity> = {}): [PixelSprite, number, number][] {
    const stamped: [PixelSprite, number, number][] = [];
    const entities = new EntityRenderer(art, new VisualStore(), new BuildingLayer(art.environment));
    Object.assign(entities, { stamp: (sprite: PixelSprite, x: number, y: number) => stamped.push([sprite, x, y]) });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    for (const reload of reloads) {
      const scene = { ...EMPTY_SCENE, players: [player({ reload, ...patch })] };
      entities.drawWorld(ctx, scene, 0, 0, 400, 400, 0, 1 / 60);
    }
    return stamped;
  }

  it('stamps one magazine where it fell when the reload passes the landing frame', () => {
    const landing = magLanding('carbine', 0)!;
    const stamped = drawAt([0.05, landing.at - 0.01, landing.at + 0.01, 0.95, 0]);
    expect(stamped).toEqual([[art.fx.droppedMag, 200 + landing.dx, 200 + landing.dy]]);
  });

  it('stamps nothing for a shotgun reload', () => {
    expect(drawAt([0.1, 0.5, 0.9], { weapon: 'shotgun' })).toEqual([]);
  });
});
