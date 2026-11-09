import { describe, expect, it } from 'vitest';
import { HORDE_WARNING_LEAD, HordeWarning } from '../src/audio/horde-warning.ts';

/** Reads a run of clock values and returns the ones the warning sounded on. */
function warnedAt(clocks: ReadonlyArray<number | null>, warning = new HordeWarning()): Array<number | null> {
  return clocks.filter((clock) => warning.read(clock));
}

describe('the horde warning', () => {
  it('sounds ten seconds out', () => {
    expect(HORDE_WARNING_LEAD).toBe(10);
  });

  it('sounds once, on the first reading inside the lead', () => {
    expect(warnedAt([30, 12, 10.4, 9.98, 9.9, 5, 0.1])).toEqual([9.98]);
  });

  it('sounds at once for a lull that starts inside the lead', () => {
    expect(warnedAt([null, 6, 5.9])).toEqual([6]);
  });

  it('sounds again for the next lull, and again if the clock is pushed back past the lead', () => {
    expect(warnedAt([20, 9, 0, null, null, 40, 8])).toEqual([9, 8]);
    expect(warnedAt([9, 25, 9.5])).toEqual([9, 9.5]);
  });

  it('stays quiet outside a lull and once the horde is due', () => {
    expect(warnedAt([null, 0, -1, null])).toEqual([]);
  });

  it('forgets the lull it warned on when reset', () => {
    const warning = new HordeWarning();
    expect(warning.read(5)).toBe(true);
    warning.reset();
    expect(warning.read(4)).toBe(true);
  });
});
