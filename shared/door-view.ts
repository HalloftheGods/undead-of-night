// What a client makes of the snapshot's door list: which doors to draw shut or broken in, and what
// the search key would do at the one the player stands at. The sim's own rules live in doors.ts.

import { findNearbyOpening } from './building-openings.ts';
import { mapDoors } from './doors.ts';
import { calculateDoorMaxHealth, canAddPlank, canDismantlePlank, DOOR_MAX_PLANKS } from './fortifications.ts';
import type { FortificationInventory, OpeningFacing } from './fortifications.ts';
import type { DoorView, WorldMap } from './protocol.ts';

/** Below this share of what it could take, a shut door shows the beating. */
const WORN_SHARE = 0.5;

/** A door that is not standing open and whole, where it stands. An open, unbroken door needs no drawing. */
export interface PlacedDoor {
  readonly buildingId: string;
  /** Middle of the opening, on the wall line. */
  readonly x: number;
  readonly y: number;
  readonly facing: OpeningFacing;
  /** Broken in: it stands open for good, in pieces. */
  readonly broken: boolean;
  readonly planks: number;
  readonly worn: boolean;
}

/** The doors in the snapshot's list that are shut or broken, placed on the map. */
export function placedDoors(map: WorldMap, views: readonly DoorView[]): PlacedDoor[] {
  const doors = mapDoors(map);
  const placed: PlacedDoor[] = [];
  for (const view of views) {
    const door = doors[view.i];
    const broken = view.open && view.health <= 0;
    const drawn = door !== undefined && (broken || !view.open);
    if (!drawn) continue;
    const worn = !broken && view.health < calculateDoorMaxHealth(view.planks) * WORN_SHARE;
    placed.push({ buildingId: door.buildingId, x: door.x, y: door.y, facing: door.facing, broken, planks: view.planks, worn });
  }
  return placed;
}

/** What the search key does at a door, by the sim's rules in doors.ts. */
export type DoorAction = 'close' | 'open' | 'open_or_board' | 'board' | 'pry' | 'sneak_to_pry' | 'boarded';

export interface DoorChoice {
  readonly action: DoorAction;
  readonly planks: number;
}

function shutChoice(planks: number, sneaking: boolean, canBoard: boolean, canPry: boolean): DoorAction {
  if (planks === 0) return canBoard ? 'open_or_board' : 'open';
  if (sneaking) return canPry ? 'pry' : 'boarded';
  if (canBoard) return 'board';
  return canPry ? 'sneak_to_pry' : 'boarded';
}

/** The door within reach of (x, y) and what the key would do to it, or null: no door there, or one broken in. */
export function doorChoiceAt(
  map: WorldMap,
  views: readonly DoorView[],
  x: number,
  y: number,
  sneaking: boolean,
  materials: FortificationInventory | undefined,
): DoorChoice | null {
  const doors = mapDoors(map);
  const door = findNearbyOpening(doors, x, y);
  if (!door) return null;
  const view = views.find((each) => each.i === doors.indexOf(door));
  const open = view?.open ?? true;
  const planks = view?.planks ?? 0;
  const broken = view !== undefined && view.open && view.health <= 0;
  if (broken) return null;
  if (open) return { action: 'close', planks };
  const state = { ...door, planks };
  const canBoard = materials !== undefined && canAddPlank(materials, state);
  const canPry = materials !== undefined && canDismantlePlank(materials, state);
  return { action: shutChoice(planks, sneaking, canBoard, canPry), planks };
}

const count = (planks: number): string => `${planks}/${DOOR_MAX_PLANKS}`;

const KEYED: Record<DoorAction, (planks: number) => string> = {
  close: () => 'E: CLOSE DOOR',
  open: () => 'E: OPEN DOOR',
  open_or_board: () => 'E: OPEN  HOLD E: BOARD UP',
  board: (planks) => `HOLD E: BOARD UP ${count(planks)}`,
  pry: (planks) => `HOLD E: PRY PLANK ${count(planks)}`,
  sneak_to_pry: (planks) => `BOARDED ${count(planks)}  SNEAK + HOLD E: PRY`,
  boarded: (planks) => `BOARDED UP ${count(planks)}`,
};

const TOUCHED: Record<DoorAction, (planks: number) => string> = {
  close: () => 'CLOSE DOOR',
  open: () => 'OPEN DOOR',
  open_or_board: () => 'TAP: OPEN  HOLD: BOARD UP',
  board: (planks) => `HOLD: BOARD UP ${count(planks)}`,
  pry: (planks) => `HOLD: PRY PLANK ${count(planks)}`,
  sneak_to_pry: (planks) => `BOARDED ${count(planks)}  SNEAK + HOLD: PRY`,
  boarded: (planks) => `BOARDED UP ${count(planks)}`,
};

/** The line over the player's head at a door. */
export function doorPrompt(choice: DoorChoice, touch: boolean): string {
  return (touch ? TOUCHED : KEYED)[choice.action](choice.planks);
}
