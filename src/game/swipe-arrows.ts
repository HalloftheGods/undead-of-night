import type { PadGlyph } from './touch-pad.ts';
import type { SwipeDirection } from './swipe-gesture.ts';

/**
 * An arrow drawn by hand, not ruled: the shaft wanders a pixel either way and the head's two
 * strokes are not the same length. The other three are this one turned, so all four are one hand.
 */
export const ARROW_UP: PadGlyph = [
  '.......#.......',
  '......###......',
  '.....#####.....',
  '....###.###....',
  '...###..#.###..',
  '..###...##.###.',
  '.##.....##..##.',
  '.#......##...#.',
  '........##.....',
  '........##.....',
  '.......##......',
  '.......##......',
  '.......##......',
  '.......##......',
  '.......##......',
  '........##.....',
  '........#......',
];

/** A quarter turn clockwise: the bottom-left cell becomes the top-left one. */
export function turnClockwise(glyph: PadGlyph): PadGlyph {
  const width = glyph[0].length;
  return Array.from({ length: width }, (_, x) => glyph.map((row) => row[x]).reverse().join(''));
}

function turned(glyph: PadGlyph, quarters: number): PadGlyph {
  let result = glyph;
  for (let turn = 0; turn < quarters; turn += 1) result = turnClockwise(result);
  return result;
}

const QUARTERS: Readonly<Record<SwipeDirection, number>> = { up: 0, right: 1, down: 2, left: 3 };

/** The hand-drawn arrow pointing the way the finger swipes. */
export function swipeArrow(direction: SwipeDirection): PadGlyph {
  return turned(ARROW_UP, QUARTERS[direction]);
}
