// A short fingerprint of a town, so a guest can tell it built the same town the host is playing.
// Guests rebuild the town from its seed, so two builds of the game that lay towns out differently put
// walls and cars in different places, and the guest walks through what only its own copy has.

import type { WorldMap } from './protocol.ts';

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

const prints = new WeakMap<WorldMap, number>();

function mix(hash: number, value: number): number {
  return Math.imul(hash ^ (value | 0), FNV_PRIME) >>> 0;
}

function mixText(hash: number, text: string): number {
  let next = hash;
  for (let i = 0; i < text.length; i++) next = mix(next, text.charCodeAt(i));
  return next;
}

/** Everything solid or walked on: the ground, the buildings, the props and any loose walls. */
function measure(map: WorldMap): number {
  let hash = mix(mix(FNV_OFFSET, map.cols), map.rows);
  for (const tile of map.tiles) hash = mix(hash, tile);
  for (const building of map.buildings) {
    hash = mix(mix(mix(mixText(hash, building.kind), building.x), building.y), building.variant);
  }
  for (const prop of map.props) hash = mix(mix(mixText(hash, prop.kind), Math.round(prop.x)), Math.round(prop.y));
  for (const wall of map.walls ?? []) hash = mix(mix(mix(mix(hash, wall.x0), wall.y0), wall.x1), wall.y1);
  return hash;
}

/** The same number on every build that lays this town out the same way. */
export function townPrint(map: WorldMap): number {
  const known = prints.get(map);
  const isMeasured = known !== undefined;
  if (isMeasured) return known;
  const print = measure(map);
  prints.set(map, print);
  return print;
}
