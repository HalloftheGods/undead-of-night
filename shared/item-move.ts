import type { EntityId } from './protocol.ts';

/** How far an aimed drop may land from the survivor, in world pixels: two-thirds of a fountain's throw. */
export const TOSS_RANGE = 130;
/** How close a teammate must stand to be handed an item, in world pixels. */
export const CARE_REACH = 40;

/** The worn slots. Guns are worn, never packed. */
export const GEAR_SLOT_IDS = ['primary', 'secondary', 'sidearm', 'armor'] as const;
export type GearSlotId = (typeof GEAR_SLOT_IDS)[number];

/** The grids an item can sit in: the survivor's pack, pockets and candy bag, and the container they have open. */
export const MOVE_GRIDS = ['pack', 'pockets', 'candy', 'container'] as const;
export type MoveGridId = (typeof MOVE_GRIDS)[number];

export type MoveFrom =
  | { readonly kind: 'cell'; readonly grid: MoveGridId; readonly x: number; readonly y: number }
  | { readonly kind: 'gear'; readonly slot: GearSlotId };

export type MoveTo =
  | { readonly kind: 'cell'; readonly grid: MoveGridId; readonly x: number; readonly y: number; readonly rotated: boolean }
  | { readonly kind: 'gear'; readonly slot: GearSlotId }
  /** An aimed drop at a world point, in pixels. */
  | { readonly kind: 'ground'; readonly x: number; readonly y: number }
  /** Used on the survivor themselves. */
  | { readonly kind: 'use' }
  /** Used on a teammate: starts the hands-on care action. */
  | { readonly kind: 'player'; readonly id: EntityId };

/**
 * One item moved by one survivor. Ids are a per-client counter, so the host applies them in order and answers each
 * by id. `container` names the container when either end is the container grid.
 */
export interface ItemMove {
  readonly id: number;
  readonly item: string;
  readonly type: string;
  readonly from: MoveFrom;
  readonly to: MoveTo;
  readonly container?: number;
}

/** Why the host refused a move. */
export type MoveReason = 'no_room' | 'gone' | 'too_far' | 'not_needed' | 'bad';

/** Longest item id or type a move may name. A longer one is not from this game. */
const MAX_NAME = 64;
/** Grid coordinates past this are not on any grid in the game. */
const MAX_CELL = 64;

type Fields = Record<string, unknown>;

const isFields = (value: unknown): value is Fields => typeof value === 'object' && value !== null && !Array.isArray(value);
const isName = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= MAX_NAME;
const isCell = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0 && (value as number) < MAX_CELL;
const isGrid = (value: unknown): value is MoveGridId => (MOVE_GRIDS as readonly unknown[]).includes(value);
const isSlot = (value: unknown): value is GearSlotId => (GEAR_SLOT_IDS as readonly unknown[]).includes(value);
const isPoint = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

function parseFrom(value: unknown): MoveFrom | null {
  if (!isFields(value)) return null;
  const isCellFrom = value.kind === 'cell' && isGrid(value.grid) && isCell(value.x) && isCell(value.y);
  if (isCellFrom) return { kind: 'cell', grid: value.grid as MoveGridId, x: value.x as number, y: value.y as number };
  const isGearFrom = value.kind === 'gear' && isSlot(value.slot);
  if (isGearFrom) return { kind: 'gear', slot: value.slot as GearSlotId };
  return null;
}

function parseTo(value: unknown): MoveTo | null {
  if (!isFields(value)) return null;
  const { kind } = value;
  const isCellTo = kind === 'cell' && isGrid(value.grid) && isCell(value.x) && isCell(value.y) && typeof value.rotated === 'boolean';
  if (isCellTo) return { kind, grid: value.grid as MoveGridId, x: value.x as number, y: value.y as number, rotated: value.rotated as boolean };
  if (kind === 'gear' && isSlot(value.slot)) return { kind, slot: value.slot };
  if (kind === 'ground' && isPoint(value.x) && isPoint(value.y)) return { kind, x: value.x, y: value.y };
  if (kind === 'use') return { kind };
  if (kind === 'player' && isName(value.id)) return { kind, id: value.id };
  return null;
}

/** A move off the wire, or null if it is not one: ids are whole and above zero, grids and slots are ones the game has. */
export function parseItemMove(value: unknown): ItemMove | null {
  if (!isFields(value)) return null;
  const { id, item, type, container } = value;
  const isId = Number.isSafeInteger(id) && (id as number) > 0;
  if (!isId || !isName(item) || !isName(type)) return null;
  const from = parseFrom(value.from);
  const to = parseTo(value.to);
  if (!from || !to) return null;
  const hasContainer = container !== undefined;
  const isContainerId = Number.isInteger(container) && (container as number) >= 0;
  if (hasContainer && !isContainerId) return null;
  return { id: id as number, item, type, from, to, ...(hasContainer ? { container: container as number } : {}) };
}

/** True when either end of the move is the container grid. */
export function touchesContainer(move: ItemMove): boolean {
  const fromContainer = move.from.kind === 'cell' && move.from.grid === 'container';
  const toContainer = move.to.kind === 'cell' && move.to.grid === 'container';
  return fromContainer || toContainer;
}
