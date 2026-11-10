// How each candy's name is lettered on its card, like the logo on its wrapper: its own colours, its own edge
// and drop shadow, and a lean or a spread of its own. Drawn by CandyBag.vue as CSS custom properties.

import type { CandyId } from '../../shared/protocol.ts';

export interface CandyBrand {
  /** The letters. */
  readonly fill: string;
  /** A one-pixel edge all round the letters. */
  readonly edge: string;
  /** The drop under them. */
  readonly drop: string;
  /** Degrees the name leans, by skew: a candy in a hurry leans forward. */
  readonly lean: number;
  /** Degrees the name is turned. */
  readonly turn: number;
  /** Extra space between letters, in em. */
  readonly spread: number;
}

const brand = (fill: string, edge: string, drop: string, lean = 0, turn = 0, spread = 0.1): CandyBrand => ({ fill, edge, drop, lean, turn, spread });

export const CANDY_BRANDS: Readonly<Record<CandyId, CandyBrand>> = {
  sour_skulls: brand('#c4f048', '#246030', '#0d0b16', 0, -4),
  fang_taffy: brand('#faf2d4', '#b82a30', '#3a0f2a', 0, 0, 0.14),
  ghost_gum: brand('#faf2d4', '#6c3c9c', '#b070d0', 0, 0, 0.2),
  pumpkin_fizz: brand('#ffc03c', '#a03018', '#2c1c28', 0, 3),
  witchs_brittle: brand('#ffc03c', '#34205c', '#6c3c9c', -10),
  bat_bites: brand('#b070d0', '#0d0b16', '#b82a30', 0, -3),
  corn_rush: brand('#fff0b4', '#e8701c', '#a03018', -14),
  jawbreaker: brand('#faf2d4', '#3a5288', '#222c52', 0, 0, 0.16),
  licorice_lash: brand('#c0c6c8', '#0d0b16', '#484e68', -12),
  caramel_apple: brand('#e85c40', '#2c1c28', '#ac8458', 0, 2),
  popping_eyeballs: brand('#faf2d4', '#5ca82c', '#b82a30', 0, -2),
  fireballs: brand('#fff0b4', '#a03018', '#e8701c', -8, -3),
  full_size_bar: brand('#ffc03c', '#b82a30', '#4e3432', 0, 0, 0.18),
  skull_pops: brand('#faf2d4', '#484e68', '#0d0b16', 0, 0, 0.15),
  frost_bites: brand('#68c4d8', '#222c52', '#0d0b16', 0, -2, 0.12),
  cherry_bombs: brand('#e85c40', '#0d0b16', '#246030', -6, 2, 0.1),
  shock_tarts: brand('#fff0b4', '#34205c', '#c4f048', -12, 0, 0.18),
  glow_worms: brand('#c4f048', '#0d0b16', '#5ca82c', 0, 3, 0.14),
  sticky_fingers: brand('#e89440', '#4e3432', '#2c1c28', -4, -2, 0.1),
  deadeye_drops: brand('#c0c6c8', '#0d0b16', '#b82a30', 0, 0, 0.2),
  monster_mash: brand('#5ca82c', '#0d0b16', '#34205c', -8, -3, 0.12),
  everlasting_chews: brand('#fff0b4', '#b82a30', '#3a5288', 0, 0, 0.16),
  spiky_suckers: brand('#b070d0', '#0d0b16', '#6c3c9c', 0, 2, 0.14),
  boom_drops: brand('#ffc03c', '#0d0b16', '#b82a30', -10, 0, 0.15),
  grave_gels: brand('#8894a0', '#0d0b16', '#222c52', 0, 0, 0.18),
  scatter_skittles: brand('#faf2d4', '#e85c40', '#5ca82c', 0, -3, 0.12),
  cadaver_chews: brand('#6c8438', '#0d0b16', '#2c1c28', -6, 2, 0.1),
  reaper_ribbons: brand('#faf2d4', '#0d0b16', '#b82a30', -12, -2, 0.16),
  toffee_timber: brand('#ac8458', '#4e3432', '#0d0b16', 0, 0, 0.12),
};

/** The custom properties CandyBag.vue letters a name with. */
export function brandStyle(id: CandyId): Record<string, string> {
  const { fill, edge, drop, lean, turn, spread } = CANDY_BRANDS[id];
  return {
    '--brand-fill': fill,
    '--brand-edge': edge,
    '--brand-drop': drop,
    '--brand-lean': `${lean}deg`,
    '--brand-turn': `${turn}deg`,
    '--brand-spread': `${spread}em`,
  };
}
