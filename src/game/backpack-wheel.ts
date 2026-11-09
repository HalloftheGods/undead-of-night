// What is in the backpack, in the order it rings the survivor.
//
// Every slot is a thing the survivor is actually carrying, drawn with the picture the game draws
// it with everywhere else, and picked by the key the game already answers to. Nothing is invented
// here: a slot shows up because the HUD says it is carried, and it greys out when the pick would
// do nothing.

import { WEAPONS } from '../../shared/constants.ts';
import type { WeaponId } from '../../shared/protocol.ts';
import { cycleWeapon } from './input-manager.ts';
import { gunRounds } from './hud-state.ts';
import type { HudState } from './hud-state.ts';

/** Which of the game's pictures a slot wears. `gun` wears the icon of the gun it hands over. */
export type SlotArt = 'medkit' | 'gun' | 'bottle' | 'fireworks' | 'fountain' | 'candy' | 'map';

export interface WheelSlot {
  /** The key the game answers to, sent through the touch pad as a press and a release. */
  readonly code: string;
  /** The thing's own name, for the caption under the slot the finger is on. */
  readonly name: string;
  /** The whole phrase, for a screen reader: 'Throw a bottle'. */
  readonly label: string;
  readonly art: SlotArt;
  /** Set only for `gun`: which gun's icon to draw. */
  readonly weapon?: WeaponId;
  /** How many are carried, or null where the thing is not counted. */
  readonly count: number | null;
  /** False greys the slot out: it is carried, or always there, but picking it would do nothing. */
  readonly ready: boolean;
}

type WheelHud = Pick<
  HudState,
  'medkits' | 'health' | 'maxHealth' | 'bottles' | 'fireworks' | 'fountains' | 'candyCount' | 'weapon' | 'owned' | 'ammoBag' | 'mags'
>;

function medkitSlot(hud: WheelHud): WheelSlot {
  const hurt = hud.health < hud.maxHealth;
  return {
    code: 'KeyH',
    name: 'Medkit',
    label: 'Use a medkit',
    art: 'medkit',
    count: hud.medkits,
    ready: hud.medkits > 0 && hurt,
  };
}

function gunSlot(hud: WheelHud): WheelSlot | null {
  const next = cycleWeapon(hud, 1);
  const hasNoOtherGun = next === null;
  if (hasNoOtherGun) return null;
  return {
    code: 'KeyQ',
    name: WEAPONS[next].label,
    label: `Switch to the ${WEAPONS[next].label.toLowerCase()}`,
    art: 'gun',
    weapon: next,
    count: gunRounds(hud, next),
    ready: true,
  };
}

/** The candy opens the candy bag, where the survivor picks which one to eat. */
function candySlot(hud: WheelHud): WheelSlot | null {
  const nothingCarried = hud.candyCount === 0;
  if (nothingCarried) return null;
  return { code: 'KeyX', name: 'Candy bag', label: 'Open the candy bag', art: 'candy', count: hud.candyCount, ready: true };
}

/**
 * The ring, clockwise from the top: what heals, what shoots, what is thrown, what is eaten,
 * and the map last. Slots for things not carried are left out, so the ring is only ever as
 * big as the backpack is full.
 */
export function wheelSlots(hud: WheelHud): WheelSlot[] {
  const slots: (WheelSlot | null)[] = [
    medkitSlot(hud),
    gunSlot(hud),
    hud.bottles > 0 ? { code: 'KeyG', name: 'Bottle', label: 'Throw a bottle', art: 'bottle', count: hud.bottles, ready: true } : null,
    hud.fireworks > 0 ? { code: 'KeyT', name: 'Firework', label: 'Light a firework', art: 'fireworks', count: hud.fireworks, ready: true } : null,
    hud.fountains > 0 ? { code: 'KeyV', name: 'Fountain', label: 'Light a fountain', art: 'fountain', count: hud.fountains, ready: true } : null,
    candySlot(hud),
    { code: 'KeyN', name: 'Town map', label: 'Open the town map', art: 'map', count: null, ready: true },
  ];
  return slots.filter((slot): slot is WheelSlot => slot !== null);
}

/** Where a slot sits on the ring, in degrees, the first at the top and the rest clockwise. */
export function slotAngle(index: number, count: number): number {
  const step = 360 / Math.max(1, count);
  return index * step - 90;
}

/**
 * Steps the highlight round the ring, wrapping both ways: the scroll wheel, which cycles guns in
 * play, walks the open ring instead. `from` is the code lit now, or null for nothing lit, which
 * steps onto the first slot going one way and the last going the other.
 */
export function stepSlot(slots: readonly WheelSlot[], from: string | null, step: number): string | null {
  const nothingToStep = slots.length === 0 || step === 0;
  if (nothingToStep) return from;
  const at = slots.findIndex((slot) => slot.code === from);
  const nothingLit = at < 0;
  if (nothingLit) return (step < 0 ? slots[slots.length - 1] : slots[0]).code;
  return slots[(at + step + slots.length * 8) % slots.length].code;
}
