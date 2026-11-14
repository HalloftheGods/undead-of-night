// The overrun's tuning soak (#7223): a bot that shops at menu speed and then holds the quarters with a carbine.
// It prints a table of clear rate and minutes per bunker visit so OVERRUN_CLOCK_SEC, OVERRUN_MENU_RATE and the
// horde size can be tuned from numbers. The assertions only keep the report honest: a visit has a bounded length
// and the clock obeys the menu rate. Nothing here asserts a balance, because balance is the user's call.

import { describe, expect, it } from 'vitest';
import { TICK_RATE } from '../shared/constants.ts';
import type { DifficultyId } from '../shared/difficulty.ts';
import type { Loadout } from '../shared/home-protocol.ts';
import { emptyLoadout } from '../shared/loadout.ts';
import { OVERRUN_CLOCK_BY_DIFFICULTY, OVERRUN_FIRST_HIGHEST, OVERRUN_HORDE_MAX, OVERRUN_MENU_RATE, overrunClockSec } from '../shared/overrun.ts';
import type { PlayerState, SimState } from '../shared/sim-state.ts';
import { GameSimulation } from '../shared/simulation.ts';
import { playerNamed, standAtStation } from './helpers/home-harness.ts';
import { input, SEED, stateOf } from './helpers/sim-harness.ts';

const DIFFICULTIES: readonly DifficultyId[] = ['night_light', 'stay_close', 'lights_out', 'undead_tired'];
const HIGHEST: readonly number[] = [1, 5, 10];
/** Longest fight the bot is given before the report calls it stalled. */
const FIGHT_LIMIT_SEC = 240;

/** What a player buys by the time a bunker visit ends: a carbine and a few medkits. */
const KIT: Loadout = { ...emptyLoadout(), guns: { carbine: {} }, ammoBag: { pistol: 0, carbine: 90, shotgun: 0 }, medkits: 2 };

/** Spare carbine rounds for the fight: about what a bag holds after a good trip's shopping. */
const BOUGHT_ROUNDS = 240;

interface Visit {
  readonly fightSec: number;
  readonly outcome: string;
  readonly hostiles: number;
  readonly health: number;
}

function room(highest: number, difficulty: DifficultyId): { sim: GameSimulation; state: SimState; me: PlayerState } {
  const sim = new GameSimulation({ seed: SEED, overrun: true, difficulty, home: true });
  sim.addPlayer('a', 'a', null, undefined, { loadout: KIT, highest });
  sim.snapshot();
  const state = stateOf(sim);
  return { sim, state, me: playerNamed(state, 'a') };
}

const overrunOf = (state: SimState): NonNullable<SimState['overrun']> => state.overrun as NonNullable<SimState['overrun']>;

/** Seconds from arrival to the breach with the bot's station open (or shut) the whole time. */
function shopSeconds(highest: number, inMenu: boolean, difficulty: DifficultyId): number {
  const { sim, state, me } = room(highest, difficulty);
  let ticks = 0;
  while (overrunOf(state).phase !== 'breached' && ticks < TICK_RATE * overrunClockSec(difficulty) * 3) {
    if (inMenu) standAtStation(state, me, 'gunsmith');
    if (me.home) me.home.station = inMenu ? 'gunsmith' : null;
    sim.step();
    ticks++;
  }
  return ticks / TICK_RATE;
}

/** Below the first-visit level there is no clock, so no breach to fight. */
const hasClock = (highest: number): boolean => highest >= OVERRUN_FIRST_HIGHEST;

/** Breach, then hold the quarters: face the nearest horde zombie, fire, reload, and use a medkit when low. */
function fight(highest: number, difficulty: DifficultyId): Visit {
  const { sim, state, me } = room(highest, difficulty);
  me.ammoBag.carbine = BOUGHT_ROUNDS;
  me.reserve = BOUGHT_ROUNDS;
  overrunOf(state).left = 1e-6;
  sim.step();
  const hostiles = overrunOf(state).total;
  let seq = 1;
  let ticks = 0;
  while (overrunOf(state).phase === 'breached' && ticks < TICK_RATE * FIGHT_LIMIT_SEC) {
    const target = state.zombies
      .filter((z) => z.horde && z.health > 0)
      .sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y))[0];
    const angle = target ? Math.atan2(target.y - me.y, target.x - me.x) : 0;
    sim.setInput('a', input({ seq: seq++, angle, shoot: Boolean(target) && me.ammo > 0, reload: me.ammo === 0, heal: me.health < me.maxHealth * 0.35 }));
    sim.step();
    ticks++;
  }
  return {
    fightSec: ticks / TICK_RATE,
    outcome: overrunOf(state).phase === 'breached' ? 'stalled' : overrunOf(state).phase,
    hostiles,
    health: Math.round((me.status === 'alive' ? me.health / me.maxHealth : 0) * 100),
  };
}

describe('the overrun soak', () => {
  it('runs the clock at the menu rate while a station is open, and at full speed otherwise', () => {
    for (const difficulty of DIFFICULTIES) {
      const open = shopSeconds(5, true, difficulty);
      const shut = shopSeconds(5, false, difficulty);
      expect(shut, difficulty).toBeCloseTo(overrunClockSec(difficulty), 0);
      expect(open, difficulty).toBeCloseTo(overrunClockSec(difficulty) / OVERRUN_MENU_RATE, 0);
    }
  });

  it('reports the clear rate and minutes per visit at highest 1, 5 and 10 on every difficulty', () => {
    const rows: string[] = [];
    for (const difficulty of DIFFICULTIES) {
      const clockSec = overrunClockSec(difficulty);
      const shopOpen = shopSeconds(5, true, difficulty);
      for (const highest of HIGHEST) {
        if (!hasClock(highest)) {
          rows.push(`${difficulty.padEnd(13)} highest ${String(highest).padStart(2)}  no clock: a first visit is in peace`);
          continue;
        }
        const visit = fight(highest, difficulty);
        const minutes = (n: number): string => (n / 60).toFixed(1);
        rows.push(
          `${difficulty.padEnd(13)} highest ${String(highest).padStart(2)}  horde ${String(visit.hostiles).padStart(2)}/${OVERRUN_HORDE_MAX}  ` +
            `${visit.outcome.padEnd(7)}  fight ${minutes(visit.fightSec)} min  health left ${visit.health}%  ` +
            `clock ${clockSec} s  visit ${minutes(clockSec + visit.fightSec)}-${minutes(shopOpen + visit.fightSec)} min`,
        );
        expect(visit.hostiles).toBeLessThanOrEqual(OVERRUN_HORDE_MAX);
        expect(['held', 'lost', 'stalled']).toContain(visit.outcome);
      }
    }
    const clocks = Object.entries(OVERRUN_CLOCK_BY_DIFFICULTY).map(([id, sec]) => `${id} ${sec}`).join(', ');
    process.stdout.write(`overrun soak (clock by difficulty: ${clocks} s, menu rate ${OVERRUN_MENU_RATE})\n${rows.join('\n')}\n`);
  }, 240_000);
});
