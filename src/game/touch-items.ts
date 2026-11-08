import { CANDIES } from '../../shared/candy.ts';
import type { HudState } from './hud-state.ts';

/** Which of the HUD's pictures a button wears. Candy has no sprite: it is drawn in CSS boxes. */
export type ItemArt = 'bottle' | 'fuelCan' | 'flare' | 'candy';

/** A throw or a sweet with a key and no finger to press it: a button that comes and goes with what is carried. */
export interface TouchItem {
  readonly code: string;
  readonly label: string;
  readonly art: ItemArt;
  readonly count: number;
  /** Pressing it now would do something. A molotov with no bottle to pour into would not. */
  readonly ready: boolean;
}

type CarriedHud = Pick<HudState, 'bottles' | 'fuel' | 'flares' | 'candy' | 'sugar'>;

const FREE_FIRE = CANDIES.popping_eyeballs.name;

/** The item buttons for what this survivor carries now, bottle first, so the throw nearest the thumb is the common one. */
export function touchItems(hud: CarriedHud): TouchItem[] {
  const items: TouchItem[] = [];
  const freeFire = hud.sugar.some((sugar) => sugar.name === FREE_FIRE);
  const hasBottle = hud.bottles > 0;
  if (hasBottle) items.push({ code: 'KeyG', label: 'Throw a bottle', art: 'bottle', count: hud.bottles, ready: true });
  const canLight = hud.fuel > 0 || freeFire;
  if (canLight) items.push({ code: 'KeyT', label: 'Throw a molotov', art: 'fuelCan', count: hud.fuel, ready: hasBottle });
  const hasFlare = hud.flares > 0;
  if (hasFlare) items.push({ code: 'KeyV', label: 'Throw a flare', art: 'flare', count: hud.flares, ready: true });
  const hasCandy = hud.candy.length > 0;
  if (hasCandy) items.push({ code: 'KeyX', label: 'Eat a candy', art: 'candy', count: hud.candy.length, ready: true });
  return items;
}
