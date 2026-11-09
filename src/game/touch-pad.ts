/** A one-colour pixel picture, `#` for ink, drawn in whatever colour the button's text is. */
export type PadGlyph = readonly string[];

/** A magnifying glass. */
export const SEARCH: PadGlyph = [
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

/** A burst of impact lines: the shove, or the stab with a knife. */
export const SHOVE: PadGlyph = [
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

/** Two chevrons at a run: the sprint. */
export const SPRINT: PadGlyph = [
  '...........',
  '...........',
  '.#....#....',
  '.##...##...',
  '.###..###..',
  '.####.####.',
  '.###..###..',
  '.##...##...',
  '.#....#....',
  '...........',
  '...........',
];

/** A backpack with straps. */
export const BACKPACK: PadGlyph = [
  '...........',
  '..##...##..',
  '..##...##..',
  '.#########.',
  '.#.......#.',
  '.#..###..#.',
  '.#..###..#.',
  '.#..###..#.',
  '.#.......#.',
  '.#########.',
  '...........',
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

/** Two bars: pause. */
export const PAUSE: PadGlyph = [
  '...........',
  '...........',
  '..###.###..',
  '..###.###..',
  '..###.###..',
  '..###.###..',
  '..###.###..',
  '..###.###..',
  '..###.###..',
  '...........',
  '...........',
];
