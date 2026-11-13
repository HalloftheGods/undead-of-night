import { describe, expect, it } from 'vitest';
import { MERCHANT_IDS } from '../shared/home-protocol.ts';
import type { OverrunPhase, OverrunView } from '../shared/home-protocol.ts';
import { OVERRUN_CLOCK_SEC, OVERRUN_WARNINGS } from '../shared/overrun.ts';
import type { PlayerEntity } from '../shared/protocol.ts';
import { buildEnvironment } from '../src/art/environment.ts';
import { spriteToCanvas } from '../src/art/kit.ts';
import { generateBunkerMap } from '../shared/bunker-map.ts';
import { chestPending, doorState, hiddenProp } from '../src/engine/overrun-look.ts';
import { emptySave } from '../src/game/home/home-store.ts';
import { closedStalls } from '../src/game/home/shop.ts';
import type { PixelSprite } from '../src/art/types.ts';

const view = (phase: OverrunPhase, left: number): OverrunView => ({ phase, left, slowed: false, hostiles: 0, total: 0 });
const playerWith = (outcome: 'held' | 'fled' | 'died' | null, chest = false): PlayerEntity =>
  ({ home: { overrun: outcome ? { outcome } : null, ...(chest ? { chest: true } : {}) } }) as unknown as PlayerEntity;

const changed = (a: PixelSprite, b: PixelSprite): number => {
  const [x, y] = [spriteToCanvas(a), spriteToCanvas(b)];
  let count = 0;
  for (let row = 0; row < a.h; row += 1) for (let col = 0; col < a.w; col += 1) if (x.get(col, row) !== y.get(col, row)) count += 1;
  return count;
};

describe('the blast door by overrun phase', () => {
  const buckleAt = OVERRUN_CLOCK_SEC * OVERRUN_WARNINGS[1];

  it('is shut with no overrun and before the second warning', () => {
    expect(doorState(undefined)).toBe('shut');
    expect(doorState(view('counting', OVERRUN_CLOCK_SEC))).toBe('shut');
    expect(doorState(view('counting', buckleAt + 1))).toBe('shut');
  });

  it('buckles at a quarter of the view\'s own clock length, whatever the difficulty', () => {
    for (const spanSec of [120, 150, 180, 240]) {
      const at = spanSec * OVERRUN_WARNINGS[1];
      expect(doorState({ ...view('counting', at + 1), spanSec }), `${spanSec} s`).toBe('shut');
      expect(doorState({ ...view('counting', at), spanSec }), `${spanSec} s`).toBe('buckling');
    }
  });

  it('reads a view with no length as the default clock', () => {
    expect(doorState(view('counting', buckleAt + 1))).toBe('shut');
    expect(doorState(view('counting', buckleAt))).toBe('buckling');
  });

  it('buckles from the second warning to the breach', () => {
    expect(doorState(view('counting', buckleAt))).toBe('buckling');
    expect(doorState(view('armed', 10))).toBe('buckling');
  });

  it('is burst from the breach on, whether the room held or fell', () => {
    for (const phase of ['breached', 'held', 'lost'] as const) expect(doorState(view(phase, 0)), phase).toBe('burst');
  });
});

describe('the blast door with the switch off', () => {
  const kinds = generateBunkerMap().props.map((prop) => prop.kind);

  it('is not on the camp map, and would stay hidden with the switch off wherever it stood', () => {
    expect(kinds).not.toContain('blast_door');
    expect(hiddenProp('blast_door', false)).toBe(true);
  });

  it('is drawn with the switch on, and every other prop is drawn either way', () => {
    expect(kinds.filter((kind) => !hiddenProp(kind, true))).toEqual(kinds);
  });
});

describe('the reward chest', () => {
  it('stands once the room holds, until this player opens theirs', () => {
    expect(chestPending(view('held', 0), playerWith(null, true))).toBe(true);
    expect(chestPending(view('held', 0), playerWith('held'))).toBe(false);
  });

  it('stands for a body that fell in the horde and still has one waiting', () => {
    expect(chestPending(view('held', 0), playerWith('died', true))).toBe(true);
  });

  it('is not there for a player who has none, such as one who came in after the hold', () => {
    expect(chestPending(view('held', 0), playerWith(null))).toBe(false);
    expect(chestPending(view('held', 0), playerWith('died'))).toBe(false);
  });

  it('is not there before the hold, without an overrun, or with nobody to open it', () => {
    expect(chestPending(view('breached', 0), playerWith(null, true))).toBe(false);
    expect(chestPending(undefined, playerWith(null, true))).toBe(false);
    expect(chestPending(view('held', 0), null)).toBe(false);
  });
});

describe('empty stalls', () => {
  it('lists only the merchants a save has closed', () => {
    const save = emptySave(1);
    expect(closedStalls(save.shop)).toEqual([]);
    const merchants = { ...save.shop.merchants, medic: { items: {}, closedTrips: 2 }, powder: { items: {}, thinTrips: 1 } };
    expect(closedStalls({ ...save.shop, merchants })).toEqual(['medic']);
    expect(MERCHANT_IDS).toContain('medic');
  });
});

describe('overrun art', () => {
  const { props, overrun } = buildEnvironment();

  it('draws every door frame at one size, each unlike the last', () => {
    const frames = [props.blast_door, overrun.doorBuckling, overrun.doorBurst];
    for (const frame of frames) expect([frame.w, frame.h, frame.ax, frame.ay]).toEqual([props.blast_door.w, props.blast_door.h, props.blast_door.ax, props.blast_door.ay]);
    expect(changed(frames[0], frames[1])).toBeGreaterThan(40);
    expect(changed(frames[1], frames[2])).toBeGreaterThan(40);
  });

  it('draws the chest open as well as closed, anchored at the same footprint', () => {
    expect(changed(props.chest, overrun.chestOpen)).toBeGreaterThan(20);
    expect(overrun.chestOpen.ax).toBe(props.chest.ax);
  });
});
