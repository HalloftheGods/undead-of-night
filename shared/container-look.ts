import type { ContainerKind } from './containers.ts';
import type { PropKind } from './protocol.ts';

/**
 * Which look (sprite style) a searchable piece is drawn with. Fixed by the piece's place in the map, so the server,
 * every client and the art all agree on it. The art book names its sprites with these ids (src/art/containers.ts),
 * and a look may carry its own loot grid (container-look-grids.ts).
 */

export const SHELF_LOOK_IDS = ['shelf', 'shelf_wood', 'shelf_wire', 'shelf_rack'] as const;

/** The pieces that come in five looks: the original and four more, picked per piece by its place in the map. */
export const VARIED_PROP_LOOKS: Partial<Record<PropKind, string>> = {
  bed: 'drawer', locker: 'locker', fridge: 'fridge', counter: 'cabinet', crate_stack: 'box', table: 'desk', dumpster: 'dumpster',
};

export const LOOK_VARIANT_COUNT = 4;

/** The props that look different from the rest of their kind. */
export const PROP_LOOK_IDS: Partial<Record<PropKind, string>> = {
  workbench: 'bench',
  table: 'desk',
  car_sedan_v: 'car_v',
  car_wreck_h: 'wreck',
  van_h: 'van',
  car_hatch_h: 'hatch',
  car_hatch_v: 'hatch_v',
  pickup_h: 'pickup',
  police_h: 'police',
  police_v: 'police_v',
  ambulance_h: 'ambulance',
};

const placeHash = (propIndex: number, span: number): number => (Math.imul(propIndex + 1, 2654435761) >>> 16) % span;

export function shelfLookId(propIndex: number): string {
  return SHELF_LOOK_IDS[placeHash(propIndex, SHELF_LOOK_IDS.length)];
}

/** Look 0 is the original; 1 to 4 are its variants. The same piece always gets the same one. */
export function variedLookId(look: string, propIndex: number): string {
  const n = placeHash(propIndex, LOOK_VARIANT_COUNT + 1);
  return n === 0 ? look : `${look}_v${n}`;
}

export interface LookedPiece {
  readonly kind: ContainerKind;
  readonly prop: PropKind;
  readonly propIndex?: number;
}

export function containerLookId({ kind, prop, propIndex }: LookedPiece): string {
  if (propIndex === undefined) return PROP_LOOK_IDS[prop] ?? kind;
  if (kind === 'shelf') return shelfLookId(propIndex);
  const varied = VARIED_PROP_LOOKS[prop];
  return varied ? variedLookId(varied, propIndex) : (PROP_LOOK_IDS[prop] ?? kind);
}
