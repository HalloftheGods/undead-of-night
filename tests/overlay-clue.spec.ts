import { beforeEach, describe, expect, it } from 'vitest';
import { buildArtBook } from '../src/art/index.ts';
import { OverlayRenderer } from '../src/engine/overlay-renderer.ts';
import type { SceneView } from '../src/engine/scene.ts';
import { VisualStore } from '../src/engine/visuals.ts';
import { CLUE_COLOR } from '../src/game/map-leftovers.ts';
import { fakeCanvas, installFakeBrowser } from './client-fake-dom.ts';

const EMPTY_SCENE: SceneView = {
  players: [],
  zombies: [],
  bullets: [],
  pickups: [],
  exit: null,
  drop: null,
  openedContainers: [],
  searchable: null,
  localId: null,
  viewerId: null,
  focusX: 0,
  focusY: 0,
  pointerX: null,
  pointerY: null,
  showCrosshair: false,
  phase: 'wave',
  hostiles: 0,
};

describe('overlay clue cache markers', () => {
  beforeEach(() => {
    installFakeBrowser();
  });

  const recordDraw = (scene: Partial<SceneView>, viewW = 200, viewH = 200, time = 0) => {
    const fills: { color: string; x: number; y: number; w: number; h: number }[] = [];
    const images: { x: number; y: number }[] = [];
    let currentFill = '';

    const ctx = fakeCanvas().getContext() as unknown as CanvasRenderingContext2D;
    const recording = new Proxy(ctx, {
      get: (target, key) => {
        if (key === 'fillStyle') return currentFill;
        if (key === 'fillRect') {
          return (x: number, y: number, w: number, h: number) => {
            fills.push({ color: currentFill, x, y, w, h });
          };
        }
        if (key === 'drawImage') {
          return (_source: unknown, ...c: number[]) => {
            const cut = c.length >= 8;
            images.push({ x: cut ? c[4] : c[0], y: cut ? c[5] : c[1] });
          };
        }
        return Reflect.get(target, key);
      },
      set: (_target, key, val) => {
        if (key === 'fillStyle') currentFill = String(val);
        return true;
      },
    });

    const overlay = new OverlayRenderer(buildArtBook(), new VisualStore());
    overlay.draw(recording, { ...EMPTY_SCENE, ...scene }, 0, 0, viewW, viewH, time, () => 255, () => false);
    return { fills, images };
  };

  it('draws an off-screen arrow and label pointing toward a clue outside the view', () => {
    const scene: Partial<SceneView> = {
      leftovers: [
        {
          building: 'house_1',
          supplies: { weapon: 1 },
          clue: true,
          clueItem: 'shotgun',
          clueAt: { x: 800, y: 100 },
        },
      ],
    };

    const { fills, images } = recordDraw(scene, 200, 200);
    const arrowPixels = fills.filter((f) => f.color === CLUE_COLOR);
    expect(arrowPixels.length).toBeGreaterThan(0);
    expect(images.length).toBeGreaterThan(0);
  });

  it('draws an on-screen ring and label over a clue in view', () => {
    const scene: Partial<SceneView> = {
      leftovers: [
        {
          building: 'house_1',
          supplies: { med: 1 },
          clue: true,
          clueItem: 'medkit',
          clueAt: { x: 100, y: 100 },
        },
      ],
    };

    const { fills, images } = recordDraw(scene, 200, 200, 0);
    const ringPixels = fills.filter((f) => f.color === CLUE_COLOR);
    expect(ringPixels.length).toBe(28);
    expect(images.length).toBeGreaterThan(0);
  });

  it('does not draw clue markers during gameover', () => {
    const scene: Partial<SceneView> = {
      phase: 'gameover',
      leftovers: [
        {
          building: 'house_1',
          supplies: { med: 1 },
          clue: true,
          clueItem: 'medkit',
          clueAt: { x: 100, y: 100 },
        },
      ],
    };

    const { fills, images } = recordDraw(scene, 200, 200);
    const cluePixels = fills.filter((f) => f.color === CLUE_COLOR);
    expect(cluePixels.length).toBe(0);
    expect(images.length).toBe(0);
  });
});
