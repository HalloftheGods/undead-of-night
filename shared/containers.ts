import { PLAYER_RADIUS } from './constants.ts';
import type { BuildingKind, PickupType, PropKind, WorldMap } from './protocol.ts';
import { buildingAt, isSolidProp, propBox } from './world-query.ts';
import type { Box } from './world-query.ts';
import type { GridItem, GridPoint } from './grid-inventory.ts';
import { CONTAINER_LOOK_GRID_SIZE } from './container-look-grids.ts';
import { containerLookId, type LookedPiece } from './container-look.ts';

export type ContainerKind = 'drawer' | 'locker' | 'fridge' | 'cabinet' | 'shelf' | 'box' | 'car' | 'bowl' | 'booth' | 'dumpster' | 'desk';

/** Somewhere to search, fixed by the town itself, so a client works these out from the map alone. */
export interface Container {
  /** Its place in the town's list, which is all a snapshot needs to say. */
  readonly id: number;
  readonly kind: ContainerKind;
  /** The piece it is part of, which a client draws in its shut or searched look. */
  readonly prop: PropKind;
  /** That piece's place in the map's list of props. */
  readonly propIndex: number;
  readonly building?: string;
  readonly buildingKind: BuildingKind | 'outdoors';
  /** Whose loot it holds: its building's, or for a police car or ambulance, the station's or the clinic's. */
  readonly stock: BuildingKind | 'outdoors';
  /** On a floor above or below a house, whose stock comes off a generator of its own. */
  readonly upOrDown?: true;
  /** The bottom centre of the furniture it is part of. */
  readonly x: number;
  readonly y: number;
  readonly box: Box;
}

export interface ContainerLoot {
  readonly type: PickupType;
  readonly rounds: number;
}

/** One run's state of a container, at the same index as the town's list. */
export interface ContainerState {
  opened: boolean;
  /** Null when there is nothing in it, or nothing left. */
  loot: ContainerLoot | null;
  /** The fireworks bus alone: how many it has left to hand out. */
  fireworks?: number;
  /** Items remaining in the container grid. */
  items?: GridItem[];
}

/** Seconds of holding the key: a drawer is quick, a locker or car has more to go through. */
export const SEARCH_SEC: Record<ContainerKind, number> = {
  drawer: 1,
  cabinet: 1.25,
  shelf: 1.25,
  box: 1.25,
  fridge: 1.5,
  locker: 2,
  car: 2,
  // A handful out of a bowl: as quick as a search gets.
  bowl: 1,
  // Picking a couple off the counter of the fireworks bus.
  booth: 1.5,
  dumpster: 1.5,
  desk: 1,
};

export const CONTAINER_LABEL: Record<ContainerKind, string> = {
  drawer: 'DRAWER',
  locker: 'LOCKER',
  fridge: 'FRIDGE',
  cabinet: 'CABINET',
  shelf: 'SHELF',
  box: 'BOX',
  car: 'CAR',
  bowl: 'CANDY BOWL',
  booth: 'FIREWORKS BUS',
  dumpster: 'DUMPSTER',
  desk: 'DESK',
};

export interface ContainerGridDimensions {
  readonly cols: number;
  readonly rows: number;
  readonly blocked?: readonly GridPoint[];
}

export const CONTAINER_GRID_SIZE: Partial<Record<ContainerKind, ContainerGridDimensions>> = {
  booth: { cols: 12, rows: 7, blocked: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 }, { x: 6, y: 0 }, { x: 7, y: 0 }, { x: 8, y: 0 }, { x: 9, y: 0 }, { x: 10, y: 0 }, { x: 11, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 }, { x: 5, y: 1 }, { x: 6, y: 1 }, { x: 7, y: 1 }, { x: 8, y: 1 }, { x: 9, y: 1 }, { x: 10, y: 1 }, { x: 11, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 }, { x: 5, y: 2 }, { x: 6, y: 2 }, { x: 7, y: 2 }, { x: 8, y: 2 }, { x: 9, y: 2 }, { x: 10, y: 2 }, { x: 11, y: 2 }, { x: 0, y: 3 }, { x: 1, y: 3 }, { x: 2, y: 3 }, { x: 3, y: 3 }, { x: 8, y: 3 }, { x: 9, y: 3 }, { x: 10, y: 3 }, { x: 11, y: 3 }, { x: 0, y: 4 }, { x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 }, { x: 8, y: 4 }, { x: 9, y: 4 }, { x: 10, y: 4 }, { x: 11, y: 4 }, { x: 0, y: 5 }, { x: 1, y: 5 }, { x: 2, y: 5 }, { x: 3, y: 5 }, { x: 4, y: 5 }, { x: 5, y: 5 }, { x: 6, y: 5 }, { x: 7, y: 5 }, { x: 8, y: 5 }, { x: 9, y: 5 }, { x: 10, y: 5 }, { x: 11, y: 5 }, { x: 0, y: 6 }, { x: 1, y: 6 }, { x: 2, y: 6 }, { x: 3, y: 6 }, { x: 4, y: 6 }, { x: 5, y: 6 }, { x: 6, y: 6 }, { x: 7, y: 6 }, { x: 8, y: 6 }, { x: 9, y: 6 }, { x: 10, y: 6 }, { x: 11, y: 6 }] },
  bowl: { cols: 4, rows: 5, blocked: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 0, y: 2 }, { x: 3, y: 2 }, { x: 3, y: 3 }, { x: 0, y: 4 }, { x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 }] },
  box: { cols: 9, rows: 8, blocked: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 6, y: 0 }, { x: 7, y: 0 }, { x: 8, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 6, y: 1 }, { x: 7, y: 1 }, { x: 8, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 6, y: 2 }, { x: 7, y: 2 }, { x: 8, y: 2 }, { x: 0, y: 3 }, { x: 4, y: 3 }, { x: 8, y: 3 }, { x: 0, y: 4 }, { x: 4, y: 4 }, { x: 8, y: 4 }, { x: 0, y: 5 }, { x: 4, y: 5 }, { x: 8, y: 5 }, { x: 0, y: 6 }, { x: 1, y: 6 }, { x: 2, y: 6 }, { x: 3, y: 6 }, { x: 4, y: 6 }, { x: 5, y: 6 }, { x: 6, y: 6 }, { x: 7, y: 6 }, { x: 8, y: 6 }, { x: 0, y: 7 }, { x: 1, y: 7 }, { x: 2, y: 7 }, { x: 3, y: 7 }, { x: 4, y: 7 }, { x: 5, y: 7 }, { x: 6, y: 7 }, { x: 7, y: 7 }, { x: 8, y: 7 }] },
  cabinet: { cols: 12, rows: 7, blocked: [{ x: 0, y: 0 }, { x: 11, y: 0 }, { x: 0, y: 1 }, { x: 11, y: 1 }, { x: 0, y: 2 }, { x: 11, y: 2 }, { x: 0, y: 3 }, { x: 11, y: 3 }, { x: 0, y: 4 }, { x: 11, y: 4 }, { x: 0, y: 5 }, { x: 1, y: 5 }, { x: 2, y: 5 }, { x: 3, y: 5 }, { x: 4, y: 5 }, { x: 5, y: 5 }, { x: 6, y: 5 }, { x: 7, y: 5 }, { x: 8, y: 5 }, { x: 9, y: 5 }, { x: 10, y: 5 }, { x: 11, y: 5 }, { x: 0, y: 6 }, { x: 1, y: 6 }, { x: 2, y: 6 }, { x: 3, y: 6 }, { x: 4, y: 6 }, { x: 5, y: 6 }, { x: 6, y: 6 }, { x: 7, y: 6 }, { x: 8, y: 6 }, { x: 9, y: 6 }, { x: 10, y: 6 }, { x: 11, y: 6 }] },
  car: { cols: 12, rows: 9, blocked: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 }, { x: 6, y: 0 }, { x: 7, y: 0 }, { x: 8, y: 0 }, { x: 9, y: 0 }, { x: 10, y: 0 }, { x: 11, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 }, { x: 5, y: 1 }, { x: 6, y: 1 }, { x: 7, y: 1 }, { x: 8, y: 1 }, { x: 9, y: 1 }, { x: 10, y: 1 }, { x: 11, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 9, y: 2 }, { x: 11, y: 2 }, { x: 0, y: 3 }, { x: 11, y: 3 }, { x: 0, y: 4 }, { x: 11, y: 4 }, { x: 0, y: 5 }, { x: 2, y: 5 }, { x: 3, y: 5 }, { x: 8, y: 5 }, { x: 9, y: 5 }, { x: 11, y: 5 }, { x: 0, y: 6 }, { x: 1, y: 6 }, { x: 2, y: 6 }, { x: 3, y: 6 }, { x: 4, y: 6 }, { x: 5, y: 6 }, { x: 6, y: 6 }, { x: 7, y: 6 }, { x: 8, y: 6 }, { x: 9, y: 6 }, { x: 10, y: 6 }, { x: 11, y: 6 }, { x: 0, y: 7 }, { x: 1, y: 7 }, { x: 2, y: 7 }, { x: 3, y: 7 }, { x: 4, y: 7 }, { x: 5, y: 7 }, { x: 6, y: 7 }, { x: 7, y: 7 }, { x: 8, y: 7 }, { x: 9, y: 7 }, { x: 10, y: 7 }, { x: 11, y: 7 }, { x: 0, y: 8 }, { x: 1, y: 8 }, { x: 2, y: 8 }, { x: 3, y: 8 }, { x: 4, y: 8 }, { x: 5, y: 8 }, { x: 6, y: 8 }, { x: 7, y: 8 }, { x: 8, y: 8 }, { x: 9, y: 8 }, { x: 10, y: 8 }, { x: 11, y: 8 }] },
  desk: { cols: 6, rows: 6, blocked: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 0, y: 1 }, { x: 5, y: 1 }, { x: 0, y: 2 }, { x: 5, y: 2 }, { x: 0, y: 3 }, { x: 1, y: 3 }, { x: 4, y: 3 }, { x: 5, y: 3 }, { x: 0, y: 4 }, { x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 }, { x: 4, y: 4 }, { x: 5, y: 4 }, { x: 0, y: 5 }, { x: 1, y: 5 }, { x: 2, y: 5 }, { x: 3, y: 5 }, { x: 4, y: 5 }, { x: 5, y: 5 }] },
  drawer: { cols: 12, rows: 12, blocked: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 }, { x: 6, y: 0 }, { x: 7, y: 0 }, { x: 8, y: 0 }, { x: 9, y: 0 }, { x: 10, y: 0 }, { x: 11, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 9, y: 1 }, { x: 10, y: 1 }, { x: 11, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 9, y: 2 }, { x: 10, y: 2 }, { x: 0, y: 3 }, { x: 1, y: 3 }, { x: 9, y: 3 }, { x: 10, y: 3 }, { x: 11, y: 3 }, { x: 0, y: 4 }, { x: 1, y: 4 }, { x: 10, y: 4 }, { x: 11, y: 4 }, { x: 0, y: 5 }, { x: 1, y: 5 }, { x: 10, y: 5 }, { x: 11, y: 5 }, { x: 0, y: 6 }, { x: 1, y: 6 }, { x: 10, y: 6 }, { x: 11, y: 6 }, { x: 0, y: 7 }, { x: 2, y: 7 }, { x: 3, y: 7 }, { x: 4, y: 7 }, { x: 5, y: 7 }, { x: 6, y: 7 }, { x: 7, y: 7 }, { x: 8, y: 7 }, { x: 9, y: 7 }, { x: 10, y: 7 }, { x: 11, y: 7 }, { x: 0, y: 8 }, { x: 2, y: 8 }, { x: 6, y: 8 }, { x: 7, y: 8 }, { x: 8, y: 8 }, { x: 9, y: 8 }, { x: 10, y: 8 }, { x: 11, y: 8 }, { x: 0, y: 9 }, { x: 1, y: 9 }, { x: 2, y: 9 }, { x: 6, y: 9 }, { x: 7, y: 9 }, { x: 8, y: 9 }, { x: 9, y: 9 }, { x: 10, y: 9 }, { x: 11, y: 9 }, { x: 0, y: 10 }, { x: 1, y: 10 }, { x: 2, y: 10 }, { x: 3, y: 10 }, { x: 4, y: 10 }, { x: 5, y: 10 }, { x: 6, y: 10 }, { x: 7, y: 10 }, { x: 8, y: 10 }, { x: 9, y: 10 }, { x: 10, y: 10 }, { x: 11, y: 10 }, { x: 0, y: 11 }, { x: 1, y: 11 }, { x: 2, y: 11 }, { x: 3, y: 11 }, { x: 4, y: 11 }, { x: 5, y: 11 }, { x: 6, y: 11 }, { x: 7, y: 11 }, { x: 8, y: 11 }, { x: 9, y: 11 }, { x: 10, y: 11 }, { x: 11, y: 11 }] },
  dumpster: { cols: 8, rows: 8, blocked: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 }, { x: 6, y: 0 }, { x: 7, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 7, y: 1 }, { x: 0, y: 2 }, { x: 7, y: 2 }, { x: 0, y: 3 }, { x: 7, y: 3 }, { x: 0, y: 4 }, { x: 7, y: 4 }, { x: 0, y: 5 }, { x: 7, y: 5 }, { x: 0, y: 6 }, { x: 1, y: 6 }, { x: 2, y: 6 }, { x: 3, y: 6 }, { x: 4, y: 6 }, { x: 5, y: 6 }, { x: 6, y: 6 }, { x: 7, y: 6 }, { x: 0, y: 7 }, { x: 1, y: 7 }, { x: 2, y: 7 }, { x: 3, y: 7 }, { x: 4, y: 7 }, { x: 5, y: 7 }, { x: 6, y: 7 }, { x: 7, y: 7 }] },
  fridge: { cols: 8, rows: 10, blocked: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 6, y: 0 }, { x: 7, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 6, y: 1 }, { x: 7, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 5, y: 2 }, { x: 7, y: 2 }, { x: 0, y: 3 }, { x: 1, y: 3 }, { x: 5, y: 3 }, { x: 7, y: 3 }, { x: 0, y: 4 }, { x: 1, y: 4 }, { x: 5, y: 4 }, { x: 7, y: 4 }, { x: 0, y: 5 }, { x: 1, y: 5 }, { x: 5, y: 5 }, { x: 7, y: 5 }, { x: 0, y: 6 }, { x: 1, y: 6 }, { x: 5, y: 6 }, { x: 7, y: 6 }, { x: 0, y: 7 }, { x: 1, y: 7 }, { x: 2, y: 7 }, { x: 3, y: 7 }, { x: 4, y: 7 }, { x: 5, y: 7 }, { x: 7, y: 7 }, { x: 0, y: 8 }, { x: 1, y: 8 }, { x: 2, y: 8 }, { x: 3, y: 8 }, { x: 4, y: 8 }, { x: 5, y: 8 }, { x: 6, y: 8 }, { x: 7, y: 8 }, { x: 0, y: 9 }, { x: 1, y: 9 }, { x: 2, y: 9 }, { x: 3, y: 9 }, { x: 4, y: 9 }, { x: 5, y: 9 }, { x: 6, y: 9 }, { x: 7, y: 9 }] },
  locker: { cols: 8, rows: 10, blocked: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 6, y: 0 }, { x: 7, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 6, y: 1 }, { x: 7, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }, { x: 6, y: 2 }, { x: 7, y: 2 }, { x: 0, y: 3 }, { x: 1, y: 3 }, { x: 2, y: 3 }, { x: 3, y: 3 }, { x: 6, y: 3 }, { x: 7, y: 3 }, { x: 0, y: 4 }, { x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 }, { x: 6, y: 4 }, { x: 7, y: 4 }, { x: 0, y: 5 }, { x: 1, y: 5 }, { x: 2, y: 5 }, { x: 3, y: 5 }, { x: 6, y: 5 }, { x: 7, y: 5 }, { x: 0, y: 6 }, { x: 1, y: 6 }, { x: 2, y: 6 }, { x: 3, y: 6 }, { x: 6, y: 6 }, { x: 7, y: 6 }, { x: 0, y: 7 }, { x: 1, y: 7 }, { x: 2, y: 7 }, { x: 3, y: 7 }, { x: 6, y: 7 }, { x: 7, y: 7 }, { x: 0, y: 8 }, { x: 1, y: 8 }, { x: 2, y: 8 }, { x: 3, y: 8 }, { x: 4, y: 8 }, { x: 5, y: 8 }, { x: 6, y: 8 }, { x: 7, y: 8 }, { x: 0, y: 9 }, { x: 1, y: 9 }, { x: 2, y: 9 }, { x: 3, y: 9 }, { x: 4, y: 9 }, { x: 5, y: 9 }, { x: 6, y: 9 }, { x: 7, y: 9 }] },
  shelf: { cols: 12, rows: 12, blocked: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 7, y: 0 }, { x: 8, y: 0 }, { x: 10, y: 0 }, { x: 11, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 }, { x: 7, y: 1 }, { x: 8, y: 1 }, { x: 10, y: 1 }, { x: 11, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 10, y: 2 }, { x: 11, y: 2 }, { x: 0, y: 3 }, { x: 1, y: 3 }, { x: 2, y: 3 }, { x: 3, y: 3 }, { x: 4, y: 3 }, { x: 5, y: 3 }, { x: 6, y: 3 }, { x: 7, y: 3 }, { x: 8, y: 3 }, { x: 9, y: 3 }, { x: 10, y: 3 }, { x: 11, y: 3 }, { x: 0, y: 4 }, { x: 1, y: 4 }, { x: 8, y: 4 }, { x: 10, y: 4 }, { x: 11, y: 4 }, { x: 0, y: 5 }, { x: 1, y: 5 }, { x: 2, y: 5 }, { x: 3, y: 5 }, { x: 4, y: 5 }, { x: 5, y: 5 }, { x: 6, y: 5 }, { x: 7, y: 5 }, { x: 8, y: 5 }, { x: 9, y: 5 }, { x: 10, y: 5 }, { x: 11, y: 5 }, { x: 0, y: 6 }, { x: 1, y: 6 }, { x: 10, y: 6 }, { x: 11, y: 6 }, { x: 0, y: 7 }, { x: 1, y: 7 }, { x: 10, y: 7 }, { x: 11, y: 7 }, { x: 0, y: 8 }, { x: 1, y: 8 }, { x: 2, y: 8 }, { x: 3, y: 8 }, { x: 4, y: 8 }, { x: 5, y: 8 }, { x: 6, y: 8 }, { x: 7, y: 8 }, { x: 8, y: 8 }, { x: 9, y: 8 }, { x: 10, y: 8 }, { x: 11, y: 8 }, { x: 0, y: 9 }, { x: 1, y: 9 }, { x: 2, y: 9 }, { x: 3, y: 9 }, { x: 4, y: 9 }, { x: 5, y: 9 }, { x: 6, y: 9 }, { x: 7, y: 9 }, { x: 8, y: 9 }, { x: 9, y: 9 }, { x: 10, y: 9 }, { x: 11, y: 9 }, { x: 0, y: 10 }, { x: 1, y: 10 }, { x: 2, y: 10 }, { x: 3, y: 10 }, { x: 4, y: 10 }, { x: 5, y: 10 }, { x: 6, y: 10 }, { x: 7, y: 10 }, { x: 8, y: 10 }, { x: 9, y: 10 }, { x: 10, y: 10 }, { x: 11, y: 10 }, { x: 0, y: 11 }, { x: 1, y: 11 }, { x: 2, y: 11 }, { x: 3, y: 11 }, { x: 4, y: 11 }, { x: 5, y: 11 }, { x: 6, y: 11 }, { x: 7, y: 11 }, { x: 8, y: 11 }, { x: 9, y: 11 }, { x: 10, y: 11 }, { x: 11, y: 11 }] },
};

const DEFAULT_CONTAINER_GRID: ContainerGridDimensions = { cols: 5, rows: 4 };

/** A look's own grid when it has one, else its kind's grid, else the default. */
export function containerGridDimensions(kind?: ContainerKind, look?: string | null): ContainerGridDimensions {
  const ownDimensions = look ? CONTAINER_LOOK_GRID_SIZE[look] : undefined;
  const customDimensions = kind ? CONTAINER_GRID_SIZE[kind] : undefined;
  return ownDimensions ?? customDimensions ?? DEFAULT_CONTAINER_GRID;
}

/** The grid of a piece in the town, by the look it is drawn with. */
export function containerGridFor(piece?: LookedPiece | null): ContainerGridDimensions {
  return piece ? containerGridDimensions(piece.kind, containerLookId(piece)) : containerGridDimensions();
}

/** Gap from the player's edge to the furniture that still counts as within reach. */
const SEARCH_GAP = 10;
const SEARCH_REACH = PLAYER_RADIUS + SEARCH_GAP;

/** What each piece of furniture opens up as, room by room. Anything left out is not searched. */
export const ROOM_CONTAINERS: Record<BuildingKind, Partial<Record<PropKind, ContainerKind>>> = {
  house: { bed: 'drawer', fridge: 'fridge', locker: 'locker' },
  apartment: { bed: 'drawer', fridge: 'fridge', locker: 'locker', shelf: 'shelf' },
  upstairs: { bed: 'drawer', locker: 'locker', shelf: 'shelf' },
  apartment_upstairs: { bed: 'drawer', fridge: 'fridge', locker: 'locker', shelf: 'shelf' },
  cellar: { shelf: 'shelf', crate_stack: 'box', workbench: 'cabinet' },
  diner: { fridge: 'fridge' },
  garage: { locker: 'locker', workbench: 'cabinet', shelf: 'shelf', car_sedan_h: 'car', car_sedan_v: 'car', crate_stack: 'box', dumpster: 'dumpster' },
  warehouse: { workbench: 'cabinet', shelf: 'shelf', crate_stack: 'box', dumpster: 'dumpster' },
  grocery: { counter: 'cabinet', shelf: 'shelf' },
  discount: { counter: 'cabinet', shelf: 'shelf', crate_stack: 'box', locker: 'locker' },
  pharmacy: { counter: 'cabinet' },
  clinic: { locker: 'locker', counter: 'cabinet', shelf: 'shelf' },
  hospital: { bed: 'drawer', locker: 'locker', counter: 'cabinet', shelf: 'shelf', workbench: 'cabinet' },
  hospital_upstairs: { bed: 'drawer', locker: 'locker', counter: 'cabinet', shelf: 'shelf' },
  school: { table: 'desk', locker: 'locker', shelf: 'shelf', fridge: 'fridge', counter: 'cabinet' },
  school_upstairs: { table: 'desk', locker: 'locker', shelf: 'shelf', workbench: 'cabinet' },
  police: { locker: 'locker', counter: 'cabinet', shelf: 'shelf' },
  gun_shop: { locker: 'locker', counter: 'cabinet', shelf: 'shelf' },
  radio_station: { locker: 'locker', counter: 'cabinet', shelf: 'shelf', fridge: 'fridge' },
  // Nothing down there is furniture.
  sewer_maze: {},
  camp_market: {},
  camp_workshop: {},
  camp_quarters: {},
};

/** Vehicles that carry what their service keeps indoors. */
const SERVICE_STOCK: Partial<Record<PropKind, BuildingKind>> = { police_h: 'police', police_v: 'police', ambulance_h: 'clinic' };

/** What vehicles and clutter open up as outdoors. */
export const OUTDOOR_CONTAINERS: Partial<Record<PropKind, ContainerKind>> = {
  car_sedan_h: 'car',
  car_sedan_v: 'car',
  car_wreck_h: 'car',
  van_h: 'car',
  car_hatch_h: 'car',
  car_hatch_v: 'car',
  pickup_h: 'car',
  police_h: 'car',
  police_v: 'car',
  ambulance_h: 'car',
  crate_stack: 'box',
  candy_bowl: 'bowl',
  fireworks_bus: 'booth',
  dumpster: 'dumpster',
};

interface TownContainers {
  readonly all: readonly Container[];
  readonly byBuilding: ReadonlyMap<string, readonly Container[]>;
  readonly outdoors: readonly Container[];
}

const towns = new WeakMap<WorldMap, TownContainers>();

function survey(map: WorldMap): TownContainers {
  const all: Container[] = [];
  const byBuilding = new Map<string, Container[]>();
  const outdoors: Container[] = [];
  for (const [propIndex, prop] of map.props.entries()) {
    if (!isSolidProp(prop)) continue;
    const room = buildingAt(map, prop.x, prop.y - 1);
    const kind = room ? ROOM_CONTAINERS[room.kind][prop.kind] : OUTDOOR_CONTAINERS[prop.kind];
    if (!kind) continue;
    const container: Container = {
      id: all.length,
      kind,
      prop: prop.kind,
      propIndex,
      building: room ? room.id : undefined,
      buildingKind: room ? room.kind : 'outdoors',
      stock: room ? room.kind : SERVICE_STOCK[prop.kind] ?? 'outdoors',
      ...(room?.of === undefined ? {} : { upOrDown: true as const }),
      x: prop.x,
      y: prop.y,
      box: propBox(prop),
    };
    all.push(container);
    if (room) {
      byBuilding.set(room.id, [...(byBuilding.get(room.id) ?? []), container]);
    } else {
      outdoors.push(container);
    }
  }
  return { all, byBuilding, outdoors };
}

function surveyed(map: WorldMap): TownContainers {
  let town = towns.get(map);
  if (!town) {
    town = survey(map);
    towns.set(map, town);
  }
  return town;
}

/** Every container in a town, in id order. */
export const townContainers = (map: WorldMap): readonly Container[] => surveyed(map).all;

function gapTo({ x0, y0, x1, y1 }: Box, x: number, y: number): number {
  return Math.hypot(x - Math.max(x0, Math.min(x, x1)), y - Math.max(y0, Math.min(y, y1)));
}

/** How far a survivor may stray from a container they are searching before its grid closes on its own. */
export const SEARCH_WALK_AWAY = SEARCH_REACH * 2;

/** The gap from a spot to a container's box, or null for an id the town does not have. */
export function containerGap(map: WorldMap, id: number, x: number, y: number): number | null {
  const container = surveyed(map).all[id];
  return container ? gapTo(container.box, x, y) : null;
}

/**
 * The nearest container still shut within reach of a spot, or null. Only the room the spot is in
 * counts, so nobody searches through a wall. When outdoors, only outdoor containers count.
 * `moved` gives a container's current box by its prop index, for a car driven off its map spot, or null while it rolls.
 */
export function containerInReach(
  map: WorldMap,
  x: number,
  y: number,
  isOpen?: (id: number) => boolean,
  moved?: ReadonlyMap<number, Box | null>,
): Container | null {
  const room = buildingAt(map, x, y);
  const candidates = room ? surveyed(map).byBuilding.get(room.id) ?? [] : surveyed(map).outdoors;
  let nearest: Container | null = null;
  let nearestGap = SEARCH_REACH;
  for (const container of candidates) {
    const box = moved?.has(container.propIndex) ? moved.get(container.propIndex) : container.box;
    if (!box) continue;
    const gap = gapTo(box, x, y);
    const nearer = gap <= nearestGap && (!isOpen || !isOpen(container.id));
    if (nearer) {
      nearest = container;
      nearestGap = gap;
    }
  }
  return nearest;
}
