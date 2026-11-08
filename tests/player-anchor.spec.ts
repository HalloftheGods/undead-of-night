import { describe, expect, it } from 'vitest';
import { PlayerAnchor } from '../src/game/player-anchor.ts';

interface FakeRoot {
  readonly style: {
    readonly writes: [string, string][];
    readonly removals: string[];
    setProperty(name: string, value: string): void;
    removeProperty(name: string): void;
  };
}

function fakeRoot(): FakeRoot {
  const writes: [string, string][] = [];
  const removals: string[] = [];
  return {
    style: {
      writes,
      removals,
      setProperty(name: string, value: string): void {
        writes.push([name, value]);
      },
      removeProperty(name: string): void {
        removals.push(name);
      },
    },
  };
}

const root = (fake: FakeRoot): HTMLElement => fake as unknown as HTMLElement;

describe('PlayerAnchor', () => {
  it('writes the spot as css variables in pixels', () => {
    const fake = fakeRoot();
    new PlayerAnchor().write({ x: 120, y: 64 }, root(fake));
    expect(fake.style.writes).toEqual([['--player-x', '120px'], ['--player-y', '64px']]);
  });

  it('snaps to half pixels, as the rest of the overlay does', () => {
    const fake = fakeRoot();
    new PlayerAnchor().write({ x: 120.3, y: 63.9 }, root(fake));
    expect(fake.style.writes).toEqual([['--player-x', '120.5px'], ['--player-y', '64px']]);
  });

  it('writes nothing for a frame that did not move the survivor half a pixel', () => {
    const fake = fakeRoot();
    const anchor = new PlayerAnchor();
    anchor.write({ x: 120, y: 64 }, root(fake));
    anchor.write({ x: 120.1, y: 64.2 }, root(fake));
    expect(fake.style.writes).toHaveLength(2);
  });

  it('writes again once the survivor has moved', () => {
    const fake = fakeRoot();
    const anchor = new PlayerAnchor();
    anchor.write({ x: 120, y: 64 }, root(fake));
    anchor.write({ x: 121, y: 64 }, root(fake));
    expect(fake.style.writes).toHaveLength(4);
    expect(fake.style.writes[2]).toEqual(['--player-x', '121px']);
  });

  it('clears the variables off a run, so no stale spot outlives it', () => {
    const fake = fakeRoot();
    const anchor = new PlayerAnchor();
    anchor.write({ x: 120, y: 64 }, root(fake));
    anchor.write(null, root(fake));
    expect(fake.style.removals).toEqual(['--player-x', '--player-y']);
  });

  it('clears only once, and treats a spot that is not a number as no spot', () => {
    const fake = fakeRoot();
    const anchor = new PlayerAnchor();
    anchor.write({ x: 120, y: 64 }, root(fake));
    anchor.write(null, root(fake));
    anchor.write(null, root(fake));
    anchor.write({ x: Number.NaN, y: 10 }, root(fake));
    expect(fake.style.removals).toEqual(['--player-x', '--player-y']);
    expect(fake.style.writes).toHaveLength(2);
  });

  it('writes again after a clear, even at the same spot', () => {
    const fake = fakeRoot();
    const anchor = new PlayerAnchor();
    anchor.write({ x: 120, y: 64 }, root(fake));
    anchor.clear(root(fake));
    anchor.write({ x: 120, y: 64 }, root(fake));
    expect(fake.style.writes).toHaveLength(4);
  });
});
