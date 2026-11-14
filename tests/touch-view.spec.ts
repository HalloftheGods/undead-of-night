import { describe, expect, it, vi } from 'vitest';
import { parseClientPacket } from '../server/packets.ts';
import { VIEWER_RANGE } from '../shared/constants.ts';
import { headSpot, HEAD_MARGIN, headUnderAim, isOnHead, TOUCH_HEAD_MARGIN } from '../shared/headshots.ts';
import { COOP_VIEW_REACH } from '../shared/view-reach.ts';
import { LEAD_MAX } from '../src/engine/camera.ts';
import { onSeenHead } from '../src/engine/overlay-renderer.ts';
import { drawFingertipBox, drawStick } from '../src/engine/touch-overlay.ts';
import { RESOLUTION_FACTOR, computeViewport, viewReachCap } from '../src/engine/viewport.ts';
import { touchMarks } from '../src/game/touch-marks.ts';
import type { TouchInput } from '../src/game/touch-input.ts';
import { addRoamer, input, quietSim } from './helpers/sim-harness.ts';

const PHONE = { w: 375, h: 812, dpr: 3 };
const TABLET = { w: 768, h: 1024, dpr: 2 };

describe('a view held upright', () => {
  it('shows more height and less width', () => {
    const { bufferW, bufferH } = computeViewport(PHONE.w, PHONE.h, PHONE.dpr);
    expect(bufferH).toBeGreaterThan(bufferW);
    expect(bufferW).toBeLessThan(300);
  });

  it.each([[PHONE], [TABLET]])('sees the same town either way round', ({ w, h, dpr }) => {
    const upright = computeViewport(w, h, dpr);
    const onItsSide = computeViewport(h, w, dpr);
    expect(upright.scale).toBe(onItsSide.scale);
    expect(upright.bufferH).toBe(onItsSide.bufferW);
    expect(upright.bufferW).toBe(onItsSide.bufferH);
  });

  it('still covers the window', () => {
    const viewport = computeViewport(PHONE.w, PHONE.h, PHONE.dpr);
    expect(viewport.cssW).toBeGreaterThanOrEqual(PHONE.w);
    expect(viewport.cssH).toBeGreaterThanOrEqual(PHONE.h);
    expect([viewport.left, viewport.top]).toEqual([0, 0]);
  });

  it('leaves a wide desktop window exactly as it was', () => {
    expect(computeViewport(1920, 1080, 1)).toMatchObject({ scale: 4, bufferW: 480, bufferH: 270, left: 0, top: 0 });
  });
});

describe('the co-op reach', () => {
  it('holds only touch screens and tall windows, and only in co-op', () => {
    expect(viewReachCap(true, true, 812, 375)).toBe(COOP_VIEW_REACH);
    expect(viewReachCap(true, false, 600, 900)).toBe(COOP_VIEW_REACH);
    expect(viewReachCap(true, false, 3440, 1440)).toBeNull();
    expect(viewReachCap(false, true, 375, 812)).toBeNull();
  });

  it('leaves the corners of the widest allowed view inside what the server sends, lead included', () => {
    expect(Math.hypot(COOP_VIEW_REACH, COOP_VIEW_REACH) + LEAD_MAX).toBeLessThan(VIEWER_RANGE);
  });

  it('takes nothing from a real phone', () => {
    const { bufferW, bufferH } = computeViewport(PHONE.w, PHONE.h, PHONE.dpr, COOP_VIEW_REACH);
    expect(computeViewport(PHONE.w, PHONE.h, PHONE.dpr)).toMatchObject({ bufferW, bufferH });
  });

  it('crops a low-density tall window to the reach and centres what is left', () => {
    const viewport = computeViewport(375, 812, 1, COOP_VIEW_REACH);
    expect(viewport.bufferH).toBe(COOP_VIEW_REACH * 2);
    expect(viewport.top).toBe(Math.floor((812 - COOP_VIEW_REACH * 2) / 2));
    expect(viewport.left).toBe(0);
  });

  it('gives a held phone no reach the same phone on its side lacks', () => {
    const upright = computeViewport(360, 900, 1, COOP_VIEW_REACH);
    const onItsSide = computeViewport(900, 360, 1, COOP_VIEW_REACH);
    expect(Math.max(upright.bufferW, upright.bufferH)).toBe(Math.max(onItsSide.bufferW, onItsSide.bufferH));
  });
});

describe('touch marks', () => {
  const view = { toBufferX: (x: number) => x / 2, toBufferY: (y: number) => y / 2 };
  const fingers = (extra: object) => ({ used: true, stick: null, aimSpot: () => null, ...extra }) as unknown as TouchInput;

  it('are nothing while a mouse is playing', () => {
    expect(touchMarks(fingers({ used: false }), view, 0)).toBeNull();
  });

  it('put the crosshair under the finger, in buffer pixels', () => {
    const marks = touchMarks(fingers({ aimSpot: () => ({ x: 100, y: 60 }) }), view, 0);
    expect(marks?.aim).toEqual({ x: 50, y: 30 });
    expect(marks?.stick).toBeNull();
  });

  it('put the stick where the thumb is', () => {
    const stick = { id: 1, baseX: 40, baseY: 80, x: 60, y: 80 };
    expect(touchMarks(fingers({ stick }), view, 0)?.stick).toMatchObject({ baseX: 20, baseY: 40, knobX: 30, knobY: 40 });
  });

  it('draw a box wider than the finger, in the head colour on a head', () => {
    const ctx = { fillStyle: '', fillRect: vi.fn(), globalAlpha: 1 };
    const painted: string[] = [];
    ctx.fillRect.mockImplementation(() => painted.push(ctx.fillStyle));
    drawFingertipBox(ctx as unknown as CanvasRenderingContext2D, 100, 100, 20, true);
    const xs = ctx.fillRect.mock.calls.map(([x]) => x as number);
    expect(Math.min(...xs)).toBeLessThanOrEqual(80);
    expect(Math.max(...xs)).toBeGreaterThanOrEqual(120);
    expect(painted).toContain('#c8332a');
  });

  it('draw the stick and leave the canvas as they found it', () => {
    const ctx = { fillStyle: '', fillRect: vi.fn(), globalAlpha: 1 };
    drawStick(ctx as unknown as CanvasRenderingContext2D, { baseX: 50, baseY: 50, knobX: 60, knobY: 50, reach: 20 });
    expect(ctx.fillRect).toHaveBeenCalled();
    expect(ctx.globalAlpha).toBe(1);
  });
});

describe('heads under a finger', () => {
  /** A spot just past a mouse's margin: a miss with a mouse, a head with a finger. */
  function justOffHead() {
    const { sim, state } = quietSim();
    const p = state.players[0];
    const z = addRoamer(state, 'walker', p.x + 60, p.y);
    z.speed = 0;
    z.angle = Math.PI;
    state.grid.insert(z);
    const spot = headSpot(z);
    const x = spot.x + 5 + HEAD_MARGIN + 1;
    return { sim, state, p, z, x, y: spot.y };
  }

  it('get a slightly larger margin than a mouse does', () => {
    expect(TOUCH_HEAD_MARGIN).toBeGreaterThan(HEAD_MARGIN);
    expect(TOUCH_HEAD_MARGIN).toBeLessThanOrEqual(HEAD_MARGIN + 3);
  });

  it('count a near miss for a finger and not for a mouse', () => {
    const { sim, state, p, z, x, y } = justOffHead();
    sim.setInput('a', input({ seq: 1, aimX: x, aimY: y }));
    expect(headUnderAim(state, p, 300)).toBeNull();
    sim.setInput('a', input({ seq: 2, aimX: x, aimY: y, touch: true }));
    expect(headUnderAim(state, p, 300)).toBe(z);
  });

  it('turn the crosshair red at the same margin', () => {
    const { z, x, y } = justOffHead();
    const lit = () => 255;
    const alive = () => false;
    expect(onSeenHead([z], x, y, 0, 0, lit, alive)).toBe(false);
    expect(onSeenHead([z], x, y, 0, 0, lit, alive, TOUCH_HEAD_MARGIN)).toBe(isOnHead(z, x, y, TOUCH_HEAD_MARGIN));
    expect(onSeenHead([z], x, y, 0, 0, lit, alive, TOUCH_HEAD_MARGIN)).toBe(true);
  });
});

describe('the touch flag on the wire', () => {
  const packet = (extra: object) => JSON.stringify({
    type: 'input',
    input: { seq: 1, up: false, down: false, left: false, right: false, angle: 0, shoot: false, reload: false, weapon: null, melee: false, heal: false, search: false, ...extra },
  });

  it('passes for a finger and stays off for a mouse', () => {
    expect(parseClientPacket(packet({ touch: true }))).toMatchObject({ input: { touch: true } });
    expect(parseClientPacket(packet({}))).not.toHaveProperty('input.touch');
    expect(parseClientPacket(packet({ touch: false }))).not.toHaveProperty('input.touch');
  });

  it('refuses anything but a boolean', () => {
    expect(parseClientPacket(packet({ touch: 'yes' }))).toBeNull();
  });

  describe('resolution', () => {
    it('auto is the same as no setting', () => {
      expect(computeViewport(1920, 1080, 1, null, RESOLUTION_FACTOR.auto)).toEqual(computeViewport(1920, 1080, 1));
    });

    it('finer resolutions draw smaller art pixels and show more world', () => {
      const auto = computeViewport(1920, 1080, 1);
      const ultra = computeViewport(1920, 1080, 1, null, RESOLUTION_FACTOR.ultra);
      expect(ultra.scale).toBeLessThan(auto.scale);
      expect(ultra.bufferW).toBeGreaterThan(auto.bufferW);
    });

    it('low draws chunkier pixels and shows less world', () => {
      const auto = computeViewport(1920, 1080, 1);
      const low = computeViewport(1920, 1080, 1, null, RESOLUTION_FACTOR.low);
      expect(low.scale).toBeGreaterThan(auto.scale);
      expect(low.bufferW).toBeLessThan(auto.bufferW);
    });

    it('co-op holds a finer-than-auto view to the shared reach, even on a wide desktop', () => {
      expect(viewReachCap(true, false, 3440, 1440, 'auto')).toBeNull();
      expect(viewReachCap(true, false, 3440, 1440, 'low')).toBeNull();
      expect(viewReachCap(true, false, 3440, 1440, 'high')).toBe(COOP_VIEW_REACH);
      expect(viewReachCap(false, false, 3440, 1440, 'ultra')).toBeNull();
    });
  });
});
