/** A one-colour pixel picture, `#` for ink, drawn in whatever colour the button's text is. */
export type PadGlyph = readonly string[];

export interface TouchButton {
  /** What the button does, read out by screen readers in place of the picture. */
  readonly label: string;
  /** The key this button stands in for. */
  readonly code: string;
  readonly glyph: PadGlyph;
}

const PAUSE: PadGlyph = [
  '...........',
  '..##...##..',
  '..##...##..',
  '..##...##..',
  '..##...##..',
  '..##...##..',
  '..##...##..',
  '..##...##..',
  '..##...##..',
  '..##...##..',
  '...........',
];

/** A folded street map with a cross on it. */
const MAP: PadGlyph = [
  '...........',
  '###########',
  '#..#...#..#',
  '#..##.##..#',
  '#..#.#.#..#',
  '#..##.##..#',
  '#..#...#..#',
  '#..#...#..#',
  '#..#...#..#',
  '###########',
  '...........',
];

/** Two arrows passing: the next gun. */
const WEAPON: PadGlyph = [
  '.......#...',
  '.......##..',
  '..########.',
  '.......##..',
  '.......#...',
  '...........',
  '...#.......',
  '..##.......',
  '.########..',
  '..##.......',
  '...#.......',
];

const HEAL: PadGlyph = [
  '...........',
  '....###....',
  '....###....',
  '....###....',
  '.#########.',
  '.#########.',
  '.#########.',
  '....###....',
  '....###....',
  '....###....',
  '...........',
];

/** A magnifying glass. */
const SEARCH: PadGlyph = [
  '..####.....',
  '.#....#....',
  '#......#...',
  '#......#...',
  '#......#...',
  '#......#...',
  '.#....#....',
  '..#####....',
  '......###..',
  '.......###.',
  '........##.',
];

/** A round arrow, as on every reload since there were reloads. */
const RELOAD: PadGlyph = [
  '...........',
  '...####..#.',
  '..#....#.#.',
  '.#......##.',
  '.#....####.',
  '.#.........',
  '.#.......#.',
  '.#.......#.',
  '..#.....#..',
  '...#####...',
  '...........',
];

/** A burst of impact lines: the shove, or the stab with a knife. */
const SHOVE: PadGlyph = [
  '.....#.....',
  '.#...#...#.',
  '..#..#..#..',
  '...#...#...',
  '...........',
  '###.....###',
  '...........',
  '...#...#...',
  '..#..#..#..',
  '.#...#...#.',
  '.....#.....',
];

/** Top to bottom on a wide screen and left to right on a tall one, so the busiest sit under the right thumb. */
export const TOUCH_BUTTONS: readonly TouchButton[] = [
  { label: 'Pause', code: 'Escape', glyph: PAUSE },
  { label: 'Map', code: 'KeyN', glyph: MAP },
  { label: 'Next weapon', code: 'KeyQ', glyph: WEAPON },
  { label: 'Heal', code: 'KeyH', glyph: HEAL },
  { label: 'Search', code: 'KeyE', glyph: SEARCH },
  { label: 'Reload', code: 'KeyR', glyph: RELOAD },
  { label: 'Shove', code: 'KeyF', glyph: SHOVE },
];

/** One SVG path of unit squares, one per `#`, for a glyph drawn with crisp edges at any size. */
export function glyphPath(glyph: PadGlyph): string {
  const squares: string[] = [];
  glyph.forEach((row, y) => {
    [...row].forEach((cell, x) => {
      const isInk = cell === '#';
      if (isInk) squares.push(`M${x} ${y}h1v1h-1z`);
    });
  });
  return squares.join('');
}
