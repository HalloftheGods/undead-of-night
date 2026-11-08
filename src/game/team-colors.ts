// Each survivor's team colour: how a teammate is told apart on the map and in the HUD's team chips.
// No two players in a room share a survivor, so no two share a colour either.

import { CHARACTERS } from '../../shared/characters.ts';

/**
 * One per survivor, in the order of CHARACTERS. Kept clear of the map's own marks: the cursor's
 * blue, the van's yellow, the drop's red and the tick's green.
 */
export const TEAM_COLORS: readonly string[] = [
  '#b493ff', // Night: violet
  '#ff8a3d', // Bandus: orange
  '#ff6fc8', // Kat: pink
  '#4fe08a', // Rex: dino green
  '#4fe6e0', // Sol: teal
];

/** A teammate's colour, with the light turned down for the off beat of the blink. */
export const TEAM_DIM_COLORS: readonly string[] = TEAM_COLORS.map((color) => dimmed(color));

function dimmed(hex: string): string {
  const channels = [1, 3, 5].map((at) => Math.round(Number.parseInt(hex.slice(at, at + 2), 16) * 0.6));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

function slotOf(skin: number): number {
  const isKnownSkin = Number.isInteger(skin) && skin >= 0 && skin < CHARACTERS.length;
  return isKnownSkin ? skin : 0;
}

/** The colour of whoever plays this survivor. */
export function teamColor(skin: number): string {
  return TEAM_COLORS[slotOf(skin)];
}

export function teamDimColor(skin: number): string {
  return TEAM_DIM_COLORS[slotOf(skin)];
}
