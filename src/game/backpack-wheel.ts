// What is in the backpack, in the order it rings the survivor.
//
// Every slot is a thing the survivor is actually carrying, drawn with the picture the game draws
// it with everywhere else, and picked by the key the game already answers to. Nothing is invented
// here: a slot shows up because the HUD says it is carried, and it greys out when the pick would
// do nothing.

import { CANDIES } from '../../shared/candy.ts';
import { WEAPONS } from '../../shared/constants.ts';
import type { WeaponId } from '../../shared/protocol.ts';
import { cycleWeapon } from './input-manager.ts';
import { gunRounds } from './hud-state.ts';
import type { HudState } from './hud-state.ts';

/** Which of the game's pictures a slot wears. `gun` wears the icon of the gun it hands over. */
export type SlotArt = 'medkit' | 'gun' | 'bottle' | 'fireworks' | 'flare' | 'candy' | 'map';

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
  'medkits' | 'health' | 'maxHealth' | 'bottles' | 'fireworks' | 'flares' | 'candy' | 'sugar' | 'weapon' | 'owned' | 'ammoBag' | 'mags'
>;

/** The candy eaten next: the oldest one carried that is not already working (shared/candy.ts). */
export function nextCandy(hud: Pick<HudState, 'candy' | 'sugar'>): string | null {
  const working = new Set(hud.sugar.map((sugar) => sugar.name));
  return hud.candy.find((name) => !working.has(name)) ?? null;
}

/** The candy name every CANDIES entry carries, so a name off a snapshot is one the game knows. */
const CANDY_NAMES: ReadonlySet<string> = new Set(Object.values(CANDIES).map((candy) => candy.name));

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
  if (next === null) return null;
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

function candySlot(hud: WheelHud): WheelSlot | null {
  const nothingCarried = hud.candy.length === 0;
  if (nothingCarried) return null;
  const next = nextCandy(hud);
  // A name off a snapshot the client does not know is still carried; it just gets no name of its own.
  const named = next !== null && CANDY_NAMES.has(next);
  return {
    code: 'KeyX',
    name: named ? next : 'Candy',
    label: named ? `Eat ${next}` : 'Eat a candy',
    art: 'candy',
    count: hud.candy.length,
    ready: next !== null,
  };
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
    hud.flares > 0 ? { code: 'KeyV', name: 'Flare', label: 'Throw a flare', art: 'flare', count: hud.flares, ready: true } : null,
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
