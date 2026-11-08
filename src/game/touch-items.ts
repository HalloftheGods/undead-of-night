import type { HudState } from './hud-state.ts';

/** Which of the HUD's pictures a button wears. Candy has no sprite: it is drawn in CSS boxes. */
export type ItemArt = 'bottle' | 'fireworks' | 'flare' | 'candy';

/** A throw or a sweet with a key and no finger to press it: a button that comes and goes with what is carried. */
export interface TouchItem {
  readonly code: string;
  readonly label: string;
  readonly art: ItemArt;
  readonly count: number;
}

type CarriedHud = Pick<HudState, 'bottles' | 'fireworks' | 'flares' | 'candy'>;

/** The item buttons for what this survivor carries now, bottle first, so the throw nearest the thumb is the common one. */
export function touchItems(hud: CarriedHud): TouchItem[] {
  const items: TouchItem[] = [];
  const hasBottle = hud.bottles > 0;
  if (hasBottle) items.push({ code: 'KeyG', label: 'Throw a bottle', art: 'bottle', count: hud.bottles });
  const hasFirework = hud.fireworks > 0;
  if (hasFirework) items.push({ code: 'KeyT', label: 'Light a firework', art: 'fireworks', count: hud.fireworks });
  const hasFlare = hud.flares > 0;
  if (hasFlare) items.push({ code: 'KeyV', label: 'Throw a flare', art: 'flare', count: hud.flares });
  const hasCandy = hud.candy.length > 0;
  if (hasCandy) items.push({ code: 'KeyX', label: 'Eat a candy', art: 'candy', count: hud.candy.length });
  return items;
}
