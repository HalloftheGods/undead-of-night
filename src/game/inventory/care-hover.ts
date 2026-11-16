import { careHelps } from '../../../shared/care.ts';
import { CARE_REACH } from '../../../shared/item-move.ts';
import type { MoveTo } from '../../../shared/item-move.ts';
import type { EntityId, PlayerEntity } from '../../../shared/protocol.ts';

/** What the hand-over to a teammate is called in the hint, by the item in hand. */
const VERB: Readonly<Record<string, string>> = { bandage: 'Bandage', canned_food: 'Feed', water_bottle: 'Water', medkit: 'Heal' };

/** A teammate the item in hand would help, and whether they are close enough to be handed it. */
export interface CareHint {
  readonly id: EntityId;
  readonly label: string;
  readonly inReach: boolean;
}

type Mate = Pick<PlayerEntity, 'id' | 'name' | 'x' | 'y' | 'health' | 'maxHealth' | 'needs' | 'status'>;
type Me = Pick<PlayerEntity, 'id' | 'x' | 'y'>;

/**
 * The teammate to offer the item in hand to: the nearest living one it would help. `inReach` says whether they are
 * within `CARE_REACH` of the local survivor. Null when the item is not care or no teammate would be helped.
 */
export function careHint(held: { readonly type: string }, teammates: readonly Mate[], me: Me): CareHint | null {
  const verb = VERB[held.type];
  if (verb === undefined) return null;
  const helped = teammates
    .filter((mate) => mate.id !== me.id && mate.status === 'alive' && careHelps(mate, held.type))
    .map((mate) => ({ mate, distance: Math.hypot(mate.x - me.x, mate.y - me.y) }))
    .sort((a, b) => a.distance - b.distance)[0];
  if (!helped) return null;
  return { id: helped.mate.id, label: `${verb} ${helped.mate.name}`, inReach: helped.distance <= CARE_REACH };
}

/** Where each teammate was drawn this frame, in client pixels, so a click can tell if it landed on one. */
export interface CareBox {
  readonly id: EntityId;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

let boxes: readonly CareBox[] = [];
let offered: CareHint | null = null;

/** The frame says which teammate is offered the item and where they stand. */
export function setCareOffer(hint: CareHint | null, drawn: readonly CareBox[]): void {
  offered = hint;
  boxes = drawn;
}

/** The move target for a click at a client point: the offered teammate, when they are in reach and the click is on them. */
export function careTargetAt(clientX: number, clientY: number): MoveTo | null {
  if (!offered?.inReach) return null;
  const box = boxes.find((each) => each.id === offered!.id);
  const on = box !== undefined && clientX >= box.x && clientX <= box.x + box.w && clientY >= box.y && clientY <= box.y + box.h;
  return on ? { kind: 'player', id: offered.id } : null;
}
