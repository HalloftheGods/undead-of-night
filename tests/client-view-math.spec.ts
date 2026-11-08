import { describe, expect, it } from 'vitest';
import { barrelOffset } from '../src/engine/barrel.ts';
import { aimAngle, Camera, clampCameraAxis } from '../src/engine/camera.ts';
import { glyphRows, textWidth } from '../src/engine/bitmap-font.ts';
import { edgePointer } from '../src/engine/overlay-renderer.ts';
import { tileVariant } from '../src/engine/tile-layer.ts';
import { clientFromBuffer, computeViewport, TARGET_VIEW_H, TARGET_VIEW_W } from '../src/engine/viewport.ts';

describe('viewport', () => {
  it('lands on 480x270 at 1080p', () => {
    expect(computeViewport(1920, 1080, 1)).toMatchObject({ scale: 4, bufferW: 480, bufferH: 270 });
  });

  it('keeps the same world size on a hi-dpi screen', () => {
    expect(computeViewport(1920, 1080, 2)).toMatchObject({ scale: 8, bufferW: 480, bufferH: 270 });
  });

  it('covers the whole window even when it does not divide evenly', () => {
    const viewport = computeViewport(1367, 769, 1);
    expect(Number.isInteger(viewport.scale)).toBe(true);
    expect(viewport.bufferW * viewport.scale).toBeGreaterThanOrEqual(1367);
    expect(viewport.bufferH * viewport.scale).toBeGreaterThanOrEqual(769);
  });

  it('never drops below a scale of one', () => {
    const viewport = computeViewport(200, 120, 1);
    expect(viewport.scale).toBe(1);
    expect(viewport.bufferW).toBe(200);
  });

  it('maps a buffer pixel back to the window pixel the pointer maths came from', () => {
    const { scale, dpr, left, top } = computeViewport(1367, 769, 2);
    const toBuffer = (client: number, edge: number) => ((client - edge) * dpr) / scale;
    for (const client of [0, 37.5, 480, 1366]) {
      expect(clientFromBuffer(toBuffer(client, left), left, scale, dpr)).toBeCloseTo(client);
      expect(clientFromBuffer(toBuffer(client, top), top, scale, dpr)).toBeCloseTo(client);
    }
  });

  it('counts a capped view bar in, so a spot is measured from the canvas and not the window', () => {
    expect(clientFromBuffer(0, 24, 4, 1)).toBe(24);
    expect(clientFromBuffer(10, 24, 4, 1)).toBe(64);
    expect(clientFromBuffer(10, 24, 8, 2)).toBe(64);
  });

  it('stays near the target view across common windows', () => {
    for (const [w, h, dpr] of [[1280, 720, 1], [2560, 1440, 1], [1440, 900, 2], [3840, 2160, 1]]) {
      const { bufferW, bufferH } = computeViewport(w, h, dpr);
      expect(bufferW / TARGET_VIEW_W).toBeGreaterThan(0.8);
      expect(bufferW / TARGET_VIEW_W).toBeLessThan(1.3);
      expect(bufferH / TARGET_VIEW_H).toBeGreaterThan(0.8);
      expect(bufferH / TARGET_VIEW_H).toBeLessThan(1.3);
    }
  });
});

describe('camera', () => {
  it('clamps to the world edges', () => {
    expect(clampCameraAxis(-40, 480, 2000)).toBe(0);
    expect(clampCameraAxis(1900, 480, 2000)).toBe(1520);
    expect(clampCameraAxis(300, 480, 2000)).toBe(300);
  });

  it('centres a world smaller than the view', () => {
    expect(clampCameraAxis(55, 480, 320)).toBe(-80);
  });

  it('snaps to whole pixels and centres the focus with no pointer', () => {
    const camera = new Camera();
    camera.setView(480, 270);
    camera.setWorld(2000, 2000);
    camera.follow(1000.4, 700.6, null, null, 1 / 60);
    expect(camera.left).toBe(760);
    expect(camera.top).toBe(566);
    expect(camera.screenX(1000.4)).toBe(240);
  });

  it('leads toward the pointer, within a limit', () => {
    const camera = new Camera();
    camera.setView(480, 270);
    camera.setWorld(2000, 2000);
    for (let i = 0; i < 300; i += 1) camera.follow(1000, 1000, 480, 135, 1 / 60);
    expect(camera.left).toBeGreaterThan(760);
    expect(camera.left).toBeLessThanOrEqual(760 + 40);
    expect(camera.top).toBe(865);
  });

  it('holds a walking player on one screen pixel', () => {
    const camera = new Camera();
    camera.setView(480, 270);
    camera.setWorld(4000, 4000);
    const seen = new Set<number>();
    for (let x = 1000; x < 1100; x += 1.37) {
      camera.follow(x, 1000, null, null, 1 / 60);
      seen.add(camera.screenX(x));
    }
    expect(seen.size).toBe(1);
  });
});

describe('aim', () => {
  it('measures from the player on screen, not the middle of the canvas', () => {
    expect(aimAngle(100, 50, 50, 50)).toBeCloseTo(0);
    expect(aimAngle(50, 100, 50, 50)).toBeCloseTo(Math.PI / 2);
    expect(aimAngle(0, 50, 50, 50)).toBeCloseTo(Math.PI);
  });
});

describe('barrel', () => {
  it('finds the gun tip out in front of the survivor', () => {
    const east = barrelOffset('carbine', 0);
    expect(east.x).toBeGreaterThan(8);
    expect(east.y).toBeLessThan(0);
  });

  it('mirrors the west half of the compass', () => {
    const east = barrelOffset('shotgun', 0);
    const west = barrelOffset('shotgun', 4);
    expect(west.x).toBe(-east.x);
    expect(west.y).toBe(east.y);
  });

  it('has an answer for every weapon and facing', () => {
    for (const weapon of ['pistol', 'carbine', 'shotgun'] as const) {
      for (let dir = 0; dir < 8; dir += 1) {
        const { x, y } = barrelOffset(weapon, dir);
        expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
      }
    }
  });
});

describe('edge pointers', () => {
  it('gives nothing for a target in view', () => {
    expect(edgePointer(100, 100, 480, 270)).toBeNull();
  });

  it('pins to the edge in the direction of the target', () => {
    expect(edgePointer(900, 135, 480, 270)).toEqual({ x: 472, y: 135, dir: 0 });
    expect(edgePointer(240, -300, 480, 270)).toEqual({ x: 240, y: 8, dir: 6 });
  });

  it('stays inside the view for a far diagonal', () => {
    const pointer = edgePointer(-5000, 4000, 480, 270)!;
    expect(pointer.x).toBeGreaterThanOrEqual(8);
    expect(pointer.y).toBeLessThanOrEqual(262);
  });
});

describe('tiles and glyphs', () => {
  it('picks the same variant for the same tile, inside the range', () => {
    expect(tileVariant(5, 9, 77, 4)).toBe(tileVariant(5, 9, 77, 4));
    for (let i = 0; i < 200; i += 1) {
      const variant = tileVariant(i, i * 3, 77, 3);
      expect(variant).toBeGreaterThanOrEqual(0);
      expect(variant).toBeLessThan(3);
    }
  });

  it('has five even rows in every glyph it can draw', () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+-.:!?\'/_ ';
    for (const char of characters) {
      const rows = glyphRows(char);
      expect(rows).toHaveLength(5);
      expect(new Set(rows.map((row) => row.length)).size).toBe(1);
    }
  });

  it('measures text with one pixel between letters', () => {
    expect(textWidth('AB')).toBe(7);
    expect(textWidth('')).toBe(0);
  });
});
