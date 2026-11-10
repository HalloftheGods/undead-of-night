import { describe, expect, it } from 'vitest';
import {
  BOOK_MOBILE_QUERY,
  firstShown,
  openLeavesOf,
  pagesLabel,
  planBookTurn,
  turnWithin,
} from '../src/game/book-turn.ts';

interface TestLeaf {
  readonly id: string;
}

const leaves: readonly TestLeaf[] = [
  { id: 'page-1' },
  { id: 'page-2' },
  { id: 'page-3' },
  { id: 'page-4' },
  { id: 'page-5' },
  { id: 'page-6' },
];

describe('book-turn logic', () => {
  it('opens pairs on spread mode and solo leaves on single mode', () => {
    const spread = openLeavesOf(leaves, 0, 'spread');
    expect(spread.left?.id).toBe('page-1');
    expect(spread.right?.id).toBe('page-2');
    expect(spread.solo).toBeNull();

    const secondSpread = openLeavesOf(leaves, 2, 'spread');
    expect(secondSpread.left?.id).toBe('page-3');
    expect(secondSpread.right?.id).toBe('page-4');

    const single = openLeavesOf(leaves, 3, 'single');
    expect(single.solo?.id).toBe('page-4');
    expect(single.left).toBeNull();
    expect(single.right).toBeNull();
  });

  it('calculates first shown index based on reading mode', () => {
    expect(firstShown(0, 'spread')).toBe(0);
    expect(firstShown(1, 'spread')).toBe(0);
    expect(firstShown(2, 'spread')).toBe(2);
    expect(firstShown(3, 'spread')).toBe(2);

    expect(firstShown(0, 'single')).toBe(0);
    expect(firstShown(1, 'single')).toBe(1);
    expect(firstShown(2, 'single')).toBe(2);
  });

  it('turns pages within book boundaries', () => {
    expect(turnWithin(leaves.length, 0, 1, 'spread')).toBe(2);
    expect(turnWithin(leaves.length, 2, 1, 'spread')).toBe(4);
    expect(turnWithin(leaves.length, 4, 1, 'spread')).toBe(4);
    expect(turnWithin(leaves.length, 0, -1, 'spread')).toBe(0);

    expect(turnWithin(leaves.length, 0, 1, 'single')).toBe(1);
    expect(turnWithin(leaves.length, 5, 1, 'single')).toBe(5);
    expect(turnWithin(leaves.length, 0, -1, 'single')).toBe(0);
  });

  it('formats page labels for spread and single modes', () => {
    expect(pagesLabel(leaves.length, 0, 'spread')).toBe('Pages 1-2 of 6');
    expect(pagesLabel(leaves.length, 2, 'spread')).toBe('Pages 3-4 of 6');
    expect(pagesLabel(leaves.length, 0, 'single')).toBe('Page 1 of 6');
    expect(pagesLabel(leaves.length, 3, 'single')).toBe('Page 4 of 6');
  });

  it('plans forward 3D turn across gutter in spread mode', () => {
    const from = openLeavesOf(leaves, 0, 'spread');
    const to = openLeavesOf(leaves, 2, 'spread');
    const turn = planBookTurn(from, to, true);

    expect(turn).not.toBeNull();
    expect(turn?.direction).toBe('forward');
    expect(turn?.leaf).toBe('right');
    expect(turn?.front.id).toBe('page-2');
    expect(turn?.back?.id).toBe('page-3');
    expect(turn?.under.left?.id).toBe('page-1');
    expect(turn?.under.right?.id).toBe('page-4');
  });

  it('plans backward 3D turn across gutter in spread mode', () => {
    const from = openLeavesOf(leaves, 2, 'spread');
    const to = openLeavesOf(leaves, 0, 'spread');
    const turn = planBookTurn(from, to, false);

    expect(turn).not.toBeNull();
    expect(turn?.direction).toBe('back');
    expect(turn?.leaf).toBe('left');
    expect(turn?.front.id).toBe('page-3');
    expect(turn?.back?.id).toBe('page-2');
    expect(turn?.under.left?.id).toBe('page-1');
    expect(turn?.under.right?.id).toBe('page-4');
  });

  it('plans whole-page turn in single reading mode', () => {
    const one = openLeavesOf(leaves, 0, 'single');
    const two = openLeavesOf(leaves, 1, 'single');

    const forwardTurn = planBookTurn(one, two, true);
    expect(forwardTurn?.leaf).toBe('whole');
    expect(forwardTurn?.direction).toBe('forward');
    expect(forwardTurn?.front.id).toBe('page-1');
    expect(forwardTurn?.under.solo?.id).toBe('page-2');

    const backTurn = planBookTurn(two, one, false);
    expect(backTurn?.leaf).toBe('whole');
    expect(backTurn?.direction).toBe('back');
    expect(backTurn?.front.id).toBe('page-1');
    expect(backTurn?.under.solo?.id).toBe('page-2');
  });

  it('defines the mobile media query covering tall aspect, narrow width, and touch landscape', () => {
    expect(BOOK_MOBILE_QUERY).toContain('max-aspect-ratio: 1/1');
    expect(BOOK_MOBILE_QUERY).toContain('max-width: 768px');
    expect(BOOK_MOBILE_QUERY).toContain('pointer: coarse');
  });
});
