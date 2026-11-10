// A HudState to hand the backpack ring, so a spec says only what it cares about.

import type { HudState } from '../src/game/hud-state.ts';

export function aHud(patch: Partial<HudState> = {}): HudState {
  return {
    health: 60,
    maxHealth: 100,
    status: 'alive',
    weapon: 'pistol',
    owned: ['pistol'],
    ammo: 6,
    magSize: 12,
    reserve: 24,
    ammoBag: { pistol: 24, carbine: 0, shotgun: 0 },
    mags: { pistol: 6, carbine: 0, shotgun: 0 },
    medkits: 1,
    bottles: 0,
    fireworks: 0,
    fountains: 0,
    bag: [],
    candyCount: 0,
    sugar: [],
    keepsakes: [],
    keepsakeOffer: null,
    knife: false,
    reload: 0,
    score: 0,
    kills: 0,
    bleedout: 0,
    revive: 0,
    phase: 'wave',
    level: 1,
    exitOpen: false,
    wave: 1,
    intermission: 0,
    hostiles: 3,
    teammates: [],
    spectating: null,
    gear: null,
    bench: null,
    boss: null,
    street: null,
    ...patch,
  };
}

/** Hurt, carrying a second gun, one of every throw and a candy: every slot the ring has. */
export function fullBackpack(): HudState {
  return aHud({
    medkits: 2,
    bottles: 2,
    fireworks: 1,
    fountains: 3,
    candyCount: 1,
    owned: ['pistol', 'shotgun'],
  });
}
