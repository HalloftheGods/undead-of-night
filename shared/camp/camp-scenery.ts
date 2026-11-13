// What stands in and around the camp besides the fence and the stations: the market awning, tents, the fire, and the trees outside.
// Each larger size adds a little to the ground it opens. The wilderness is the same at every size, rolled from its own seed.

import { TILE_SIZE } from '../map-protocol.ts';
import type { PropInstance, PropKind } from '../map-protocol.ts';
import { createRng } from '../rng.ts';
import type { CampSize } from './camp-ring.ts';
import { CAMP_COLS, CAMP_EAST_COL, CAMP_ROWS, CAMP_SIZES, GATE_ROWS, ringRect } from './camp-ring.ts';
import { CAMPFIRE_PLACE } from './camp-layout.ts';

/** What the smallest camp has: the fire, a lantern hung in each tent and two outside, and bedrolls in the quarters. */
const FIRST_CAMP: readonly PropInstance[] = [
  { kind: 'campfire', ...CAMPFIRE_PLACE },
  { kind: 'lantern', x: 676, y: 356 },
  { kind: 'lantern', x: 644, y: 470 },
  { kind: 'lantern', x: 788, y: 470 },
  { kind: 'lantern', x: 700, y: 296 },
  { kind: 'lantern', x: 820, y: 456 },
  { kind: 'bedroll', x: 704, y: 468 },
  { kind: 'bedroll', x: 744, y: 468 },
];

/** What a size adds, on the ground that size opens: a tent in its new north-west corner, crates in the south-west, a fire barrel on the west side. */
function addedAt(size: CampSize): PropInstance[] {
  const rect = ringRect(size);
  const west = rect.col0 * TILE_SIZE;
  return [
    { kind: 'camp_tent', x: west + 28, y: rect.row0 * TILE_SIZE + 26 },
    { kind: 'bedroll', x: west + 60, y: rect.row0 * TILE_SIZE + 22 },
    { kind: 'crate_stack', x: west + 24, y: (rect.row1 + 1) * TILE_SIZE - 24 },
    { kind: 'fire_barrel', x: west + 14, y: 392 },
  ];
}

/** Everything inside the fence that is not a station, for a camp of this size. */
export function campScenery(size: CampSize): PropInstance[] {
  return [...FIRST_CAMP, ...CAMP_SIZES.filter((s) => s > 1 && s <= size).flatMap(addedAt)];
}

const WILD_SEED = 0x51c0ffee;
const WILD_TRIES = 520;
/** Tiles kept bare outside the largest ring, so the horde has open ground to cross and a place to appear. */
export const WILD_CLEAR_TILES = 8;
const WILD_KINDS: readonly PropKind[] = ['tree', 'tree', 'pine', 'pine', 'dead_tree', 'bush', 'bush'];

function rollWilderness(): PropInstance[] {
  const rng = createRng(WILD_SEED);
  const big = ringRect(5);
  const taken = new Set<number>();
  const props: PropInstance[] = [];
  for (let i = 0; i < WILD_TRIES; i++) {
    const col = 1 + Math.floor(rng() * (CAMP_COLS - 2));
    const row = 1 + Math.floor(rng() * (CAMP_ROWS - 2));
    const kind = WILD_KINDS[Math.floor(rng() * WILD_KINDS.length)];
    const nearCamp = col >= big.col0 - WILD_CLEAR_TILES && col <= big.col1 + WILD_CLEAR_TILES && row >= big.row0 - WILD_CLEAR_TILES && row <= big.row1 + WILD_CLEAR_TILES;
    const onTrack = col >= CAMP_EAST_COL && row >= GATE_ROWS.top - 1 && row <= GATE_ROWS.bottom + 1;
    const tile = row * CAMP_COLS + col;
    if (nearCamp || onTrack || taken.has(tile)) continue;
    taken.add(tile);
    props.push({ kind, x: col * TILE_SIZE + TILE_SIZE / 2, y: (row + 1) * TILE_SIZE - 2 });
  }
  return props;
}

let wild: readonly PropInstance[] | null = null;

/** The trees and brush outside the fence. Shared, do not write to it. */
export function wilderness(): readonly PropInstance[] {
  wild ??= rollWilderness();
  return wild;
}
