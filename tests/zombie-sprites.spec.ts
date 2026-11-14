import { describe, expect, it } from 'vitest';
import { buildZombies } from '../src/art/zombies.ts';
import { ZOMBIE_ANIMATIONS, clipOf, frameAt } from '../src/game/dev/zombie-sprites.ts';

describe('the zombie sprites dev page', () => {
  const art = buildZombies();

  it('has a frame for every type, animation and facing', () => {
    for (const zombie of Object.values(art)) {
      for (const animation of ZOMBIE_ANIMATIONS) {
        for (let facing = 0; facing < 8; facing++) expect(frameAt(zombie, animation, facing, 0.3).w).toBeGreaterThan(0);
      }
    }
  });

  it('plays get up as the fall backwards', () => {
    const { walker } = art;
    const fall = clipOf(walker, 'death', 0).frames;
    const rise = clipOf(walker, 'get up', 0).frames;
    expect(rise[0]).toBe(fall[fall.length - 1]);
    expect(rise[rise.length - 1]).toBe(fall[0]);
  });

  it('never runs past the end of a one-shot clip', () => {
    const { walker } = art;
    expect(() => frameAt(walker, 'death', 0, 999)).not.toThrow();
  });
});
