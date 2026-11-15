import { beforeEach, describe, expect, it } from 'vitest';
import type { ContainerArt } from '../src/art/containers.ts';
import {
  backFlight,
  BACK_MS,
  beginContainerZoom,
  CATCH_MS,
  endContainerZoom,
  FADE_MS,
  heldSweep,
  lerpRect,
  noteContainerDrawn,
  noteStageRect,
  noteWorldFrame,
  REJOIN_MS,
  resetContainerZoom,
  searchedContainer,
  stageWorldRect,
  toSpace,
  WAIT_MS,
  ZOOM_MS,
  zoomFrame,
  zoomLandedAt,
} from '../src/game/inventory/container-zoom.ts';
import { easeOut } from '../src/game/inventory/pickup-arrivals.ts';

const ART = {} as ContainerArt;
const WORLD = { x: 100, y: 50, w: 20, h: 10 };

/** Opens container 7 at time 0, and has the world draw it in the first frame at 10 ms. */
function openDrawn(id = 7): void {
  beginContainerZoom(id, 0);
  noteContainerDrawn(id, WORLD, ART);
  noteWorldFrame(10, false);
}

describe('container zoom geometry', () => {
  it('lerps a rect corner and size together', () => {
    const a = { x: 0, y: 0, w: 10, h: 10 };
    const b = { x: 100, y: 50, w: 30, h: 20 };
    expect(lerpRect(a, b, 0)).toEqual(a);
    expect(lerpRect(a, b, 0.5)).toEqual({ x: 50, y: 25, w: 20, h: 15 });
    expect(lerpRect(a, b, 1)).toEqual(b);
  });

  it('places the stage box by the prop anchor in world pixels', () => {
    expect(stageWorldRect({ x: 40, y: 80 }, { minX: -8, minY: -12, width: 16, height: 14 })).toEqual({ x: 32, y: 68, w: 16, h: 14 });
  });

  it('maps both corners through the camera, so the rect scales', () => {
    const camera = {
      still: false,
      toBuffer: (p: { x: number; y: number }) => ({ x: p.x - 10, y: p.y - 5 }),
      toClient: (p: { x: number; y: number }) => ({ x: (p.x - 10) * 3, y: (p.y - 5) * 3 }),
    };
    expect(toSpace(WORLD, camera, 'buffer')).toEqual({ x: 90, y: 45, w: 20, h: 10 });
    expect(toSpace(WORLD, camera, 'client')).toEqual({ x: 270, y: 135, w: 60, h: 30 });
  });
});

describe('container zoom clock', () => {
  beforeEach(() => resetContainerZoom());

  it('zooms from the drawn prop with an ease-out and lands after ZOOM_MS', () => {
    openDrawn();
    const half = zoomFrame(10 + ZOOM_MS / 2);
    expect(half.kind).toBe('zoom');
    expect(half.from).toEqual(WORLD);
    expect(half.eased).toBeCloseTo(easeOut(0.5));
    expect(half.landed).toBe(false);
    expect(zoomFrame(10 + ZOOM_MS).landed).toBe(true);
  });

  it('fades when the prop was not drawn, and lands at once with reduced motion', () => {
    beginContainerZoom(3, 0);
    noteWorldFrame(10, false);
    expect(zoomFrame(20).kind).toBe('fade');
    expect(zoomFrame(10 + FADE_MS).landed).toBe(true);
    resetContainerZoom();
    beginContainerZoom(3, 0);
    noteContainerDrawn(3, WORLD, ART);
    noteWorldFrame(10, true);
    expect(zoomFrame(10)).toMatchObject({ kind: 'still', landed: true });
  });

  it('waits for a world frame, then fades without one', () => {
    beginContainerZoom(3, 0);
    expect(zoomFrame(WAIT_MS - 1)).toMatchObject({ kind: 'wait', landed: false });
    expect(zoomFrame(WAIT_MS + 1).kind).toBe('fade');
    expect(zoomFrame(WAIT_MS + FADE_MS).landed).toBe(true);
  });

  it('says when it landed: never with no zoom, not yet while flying', () => {
    expect(zoomLandedAt(0)).toBe(Number.NEGATIVE_INFINITY);
    openDrawn();
    expect(zoomLandedAt(100)).toBe(Number.POSITIVE_INFINITY);
    expect(zoomLandedAt(10 + ZOOM_MS + 5)).toBe(10 + ZOOM_MS);
  });

  it('holds the sweep until landing, then catches up at CATCH_MS pace, never past the sim', () => {
    expect(heldSweep(0.6, Number.POSITIVE_INFINITY, 1000)).toBe(0);
    expect(heldSweep(0.6, 1000, 1000 + CATCH_MS * 0.25)).toBeCloseTo(0.25);
    expect(heldSweep(0.6, 1000, 1000 + CATCH_MS)).toBe(0.6);
    expect(heldSweep(0.6, Number.NEGATIVE_INFINITY, 0)).toBe(0.6);
  });

  it('resumes a rebuild of the same container instead of replaying it', () => {
    openDrawn();
    endContainerZoom(500);
    expect(searchedContainer()).toBeNull();
    beginContainerZoom(7, 500 + REJOIN_MS - 1);
    expect(searchedContainer()).toBe(7);
    expect(zoomFrame(600).landed).toBe(true);
    expect(zoomLandedAt(600)).toBe(10 + ZOOM_MS);
  });

  it('starts fresh after REJOIN_MS, or for another container', () => {
    openDrawn();
    endContainerZoom(500);
    beginContainerZoom(7, 500 + REJOIN_MS);
    expect(zoomFrame(500 + REJOIN_MS).kind).toBe('wait');
    resetContainerZoom();
    openDrawn();
    endContainerZoom(500);
    beginContainerZoom(8, 510);
    expect(zoomFrame(510).kind).toBe('wait');
  });

  it('flies back only after a landed zoom with a noted stage, and not after a rejoin', () => {
    beginContainerZoom(7, 0);
    endContainerZoom(5);
    expect(backFlight(6)).toBeNull();
    resetContainerZoom();
    openDrawn();
    noteStageRect('client', { x: 0, y: 0, w: 200, h: 100 });
    endContainerZoom(1000);
    const back = backFlight(1000 + BACK_MS / 2);
    expect(back).toMatchObject({ from: WORLD, to: { x: 0, y: 0, w: 200, h: 100 }, space: 'client', searched: true });
    expect(backFlight(1000 + BACK_MS)).toBeNull();
    resetContainerZoom();
    openDrawn();
    noteStageRect('buffer', { x: 0, y: 0, w: 20, h: 10 });
    endContainerZoom(1000);
    beginContainerZoom(7, 1001);
    expect(backFlight(1002)).toBeNull();
  });
});
