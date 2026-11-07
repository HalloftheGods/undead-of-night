import { beforeEach, describe, expect, it } from 'vitest';
import { fakeCanvas, installFakeBrowser } from './client-fake-dom.ts';
import { generateBunkerMap } from '../shared/bunker-map.ts';
import { MERCHANT_IDS } from '../shared/home-protocol.ts';
import type { MerchantId } from '../shared/home-protocol.ts';
import { stationPrompt } from '../src/engine/station-labels.ts';
import { emptySave } from '../src/game/home/home-store.ts';
import type { HomeSave } from '../src/game/home/home-store.ts';
import { MERCHANTS } from '../src/game/home/merchant-data.ts';
import { questMarks } from '../src/game/home/quest-marks.ts';
import { targetOf, questOf } from '../src/game/home/quest-data.ts';
import { OverlayRenderer } from '../src/engine/overlay-renderer.ts';
import { EMPTY_SCENE } from '../src/engine/scene.ts';
import { buildArtBook } from '../src/art/index.ts';
import { VisualStore } from '../src/engine/visuals.ts';

const props = generateBunkerMap().props;
const fresh = (): HomeSave => emptySave(3);
const without = (save: HomeSave, merchant: MerchantId): HomeSave => {
  const { [merchant]: _gone, ...rest } = save.quests.active;
  return { ...save, quests: { ...save.quests, active: rest } };
};
const finished = (save: HomeSave, merchant: MerchantId): HomeSave => {
  const open = save.quests.active[merchant]!;
  const def = questOf(open.id)!;
  return { ...save, quests: { ...save.quests, active: { ...save.quests.active, [merchant]: { ...open, progress: targetOf(def.objective) } } } };
};

describe('quest marks', () => {
  it('shows nothing on a new save, where every merchant has a quest open and not yet done', () => {
    expect(questMarks(fresh(), 10, props)).toEqual([]);
    expect(questMarks(null, 10, props)).toEqual([]);
  });

  it('marks a stall with a quest on offer, and only that stall', () => {
    const marks = questMarks(without(fresh(), 'medic'), 10, props);
    expect(marks.map((mark) => mark.merchant)).toEqual(['medic']);
    expect(marks[0]).toMatchObject({ name: MERCHANTS.medic.name, ready: false });
  });

  it('marks a finished quest as ready, ahead of anything on offer', () => {
    const marks = questMarks(finished(fresh(), 'gunsmith'), 10, props);
    expect(marks).toHaveLength(1);
    expect(marks[0]).toMatchObject({ merchant: 'gunsmith', ready: true });
    const stall = props.find((prop) => prop.kind === 'gunsmith')!;
    expect([marks[0].x, marks[0].y]).toEqual([stall.x, stall.y]);
  });

  it('leaves a closed stall unmarked while its merchant is away', () => {
    const save = finished(fresh(), 'powder');
    const shut = { ...save, shop: { ...save.shop, merchants: { ...save.shop.merchants, powder: { ...save.shop.merchants.powder, closedTrips: 2 } } } };
    expect(questMarks(shut, 10, props)).toEqual([]);
  });

  it('has a stall for every merchant in the bunker', () => {
    for (const merchant of MERCHANT_IDS) expect(props.some((prop) => prop.kind === merchant)).toBe(true);
  });
});

describe('the stall prompt', () => {
  it('names who has your pay, and keeps the stall name otherwise', () => {
    expect(stationPrompt('quartermaster', false, 'Sarge')).toBe('HOLD E: SARGE HAS YOUR PAY');
    expect(stationPrompt('quartermaster', true, 'Sarge')).toBe('OPEN: SARGE HAS YOUR PAY');
    expect(stationPrompt('quartermaster', false)).toBe('HOLD E: QUARTERMASTER');
  });
});

describe('the overlay', () => {
  beforeEach(() => void installFakeBrowser());
  const drawn = (scene: Partial<typeof EMPTY_SCENE>): string[] => {
    const texts: string[] = [];
    const ctx = fakeCanvas().getContext() as unknown as CanvasRenderingContext2D;
    const overlay = new OverlayRenderer(buildArtBook(), new VisualStore());
    const spy = overlay as unknown as { payFrom(scene: unknown): string | undefined };
    texts.push(String(spy.payFrom({ ...EMPTY_SCENE, ...scene })));
    expect(() => overlay.draw(ctx, { ...EMPTY_SCENE, ...scene }, 0, 0, 640, 360, 0, () => 255, () => false)).not.toThrow();
    return texts;
  };
  const mark = (ready: boolean) => ({ merchant: 'quartermaster' as const, name: 'Sarge', x: 176, y: 40, ready });

  /** The text blits the overlay makes for a scene: where each landed, and the atlas it was cut from. */
  const blits = (scene: Partial<typeof EMPTY_SCENE>): { x: number; y: number; source: unknown }[] => {
    const calls: { x: number; y: number; source: unknown }[] = [];
    const real = fakeCanvas().getContext() as unknown as CanvasRenderingContext2D;
    const recording = new Proxy(real, {
      get: (target, key) => {
        const passesThrough = key !== 'drawImage';
        if (passesThrough) return Reflect.get(target, key);
        return (source: unknown, ...c: number[]) => {
          // A glyph cut from an atlas lands at c[4], c[5]; a whole baked label at c[0], c[1].
          const cut = c.length >= 8;
          calls.push({ x: cut ? c[4] : c[0], y: cut ? c[5] : c[1], source });
          (target.drawImage as (...a: unknown[]) => void)(source, ...c);
        };
      },
    });
    const overlay = new OverlayRenderer(buildArtBook(), new VisualStore());
    overlay.draw(recording, { ...EMPTY_SCENE, ...scene }, 0, 0, 640, 360, 0, () => 255, () => false);
    return calls;
  };

  it('draws the "!" over the stall, above it and centred on it, and draws nothing without a mark', () => {
    expect(blits({})).toEqual([]);
    const calls = blits({ questMarks: [mark(false)] });
    expect(calls.length).toBeGreaterThan(0);
    const centre = calls[calls.length - 1];
    expect(centre.y).toBeLessThan(40);
    expect(centre.y).toBeGreaterThan(40 - 100);
    expect(Math.abs(centre.x - 176)).toBeLessThanOrEqual(3);
  });

  it('draws a ready mark in a different colour from one on offer, and one "!" per mark', () => {
    const offered = blits({ questMarks: [mark(false)] });
    const ready = blits({ questMarks: [mark(true)] });
    expect(ready).toHaveLength(offered.length);
    expect(ready[ready.length - 1].source).not.toBe(offered[offered.length - 1].source);
    expect(blits({ questMarks: [mark(false), { ...mark(false), x: 300 }] })).toHaveLength(offered.length * 2);
  });

  it('uses the merchant name for pay only when the player stands at that stall and the quest is ready', () => {
    expect(drawn({ station: 'quartermaster', questMarks: [mark(true)] })).toEqual(['Sarge']);
    expect(drawn({ station: 'quartermaster', questMarks: [mark(false)] })).toEqual(['undefined']);
    expect(drawn({ station: 'medic', questMarks: [mark(true)] })).toEqual(['undefined']);
  });
});
