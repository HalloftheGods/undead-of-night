import { describe, expect, it } from 'vitest';
import { MERCHANT_IDS } from '../shared/home-protocol.ts';
import { emptyLoadout } from '../shared/loadout.ts';
import { GameSimulation } from '../shared/simulation.ts';
import { bankTrip, driveToTown, quietTown } from './helpers/home-harness.ts';
import { openLevelExit, SEED, stateOf, steps } from './helpers/sim-harness.ts';

/** A solo home room whose player has rescued only `rescued`. */
function roomWith(rescued: typeof MERCHANT_IDS[number][]): { sim: GameSimulation; state: ReturnType<typeof stateOf> } {
  const sim = new GameSimulation({ seed: SEED, home: true });
  sim.addPlayer('a', 'a', null, undefined, { loadout: emptyLoadout(), highest: 1, rescued });
  sim.snapshot();
  return { sim, state: stateOf(sim) };
}

describe('the people to find', () => {
  it('starts a new campaign with an empty camp, and the first town holds Sarge', () => {
    const { sim, state } = roomWith([]);
    expect(state.merchants).toHaveLength(0);
    expect(state.homeRun?.campSize).toBe(1);
    driveToTown(sim, state, 1);
    expect(state.rescuees.map((r) => r.id)).toEqual(['quartermaster']);
    expect(state.rescuees[0].status).toBe('waiting');
  });

  it('puts no one in a town when the player has them all, as an older client does', () => {
    const sim = new GameSimulation({ seed: SEED, home: true });
    sim.addPlayer('a', 'a');
    sim.snapshot();
    const state = stateOf(sim);
    expect(state.merchants).toHaveLength(4);
    driveToTown(sim, state, 1);
    expect(state.rescuees).toHaveLength(0);
  });

  it('frees on a held key, follows, and comes home aboard the van, growing the camp', () => {
    const { sim, state } = roomWith([]);
    driveToTown(sim, state, 1);
    quietTown(state);
    const [person] = state.rescuees;
    const p = state.players[0];
    p.x = person.x + 10;
    p.y = person.y;
    p.searchHeld = true;
    for (let i = 0; i < 100 && person.status === 'waiting'; i++) {
      p.searchHeld = true;
      p.moving = false;
      steps(sim, 1);
    }
    expect(person.status).toBe('following');
    p.searchHeld = false;
    openLevelExit(state);
    const van = state.exit;
    expect(van).not.toBeNull();
    person.x = van!.x + 20;
    person.y = van!.y;
    bankTrip(sim, state);
    expect(p.home?.receipt?.rescued).toEqual(['quartermaster']);
    expect(p.home?.rescued).toContain('quartermaster');
    expect(state.homeRun?.campSize).toBe(2);
    expect(state.merchants.map((m) => m.id)).toEqual(['quartermaster']);
  });
});

describe('the stash', () => {
  it('Doc names a stash when freed, marked on the map, with its finds on the floor', () => {
    const { sim, state } = roomWith(['quartermaster', 'gunsmith', 'powder']);
    driveToTown(sim, state, 3);
    quietTown(state);
    const [person] = state.rescuees;
    expect(person.id).toBe('medic');
    expect(person.stash).not.toBeNull();
    expect(state.clues.size).toBe(0);
    const p = state.players[0];
    p.x = person.x + 10;
    p.y = person.y;
    for (let i = 0; i < 100 && person.status === 'waiting'; i++) {
      p.searchHeld = true;
      p.moving = false;
      steps(sim, 1);
    }
    expect(state.clues.get(person.stash!.building)).toBe(person.stash!.mark);
  });

  it('Sarge has none', () => {
    const { sim, state } = roomWith([]);
    driveToTown(sim, state, 1);
    expect(state.rescuees[0].stash).toBeNull();
  });
});

describe('the guaranteed radio', () => {
  const radioIn = (seed: number, radio: boolean): boolean => {
    const sim = new GameSimulation({ seed, home: true });
    sim.addPlayer('a', 'a', null, undefined, { loadout: emptyLoadout(), highest: 2, rescued: [], ...(radio ? { radio: true } : {}) });
    sim.snapshot();
    const state = stateOf(sim);
    driveToTown(sim, state, 2);
    return state.containers.some((c) => c.loot?.type === 'radio');
  };

  it('lies in town 2 for a player with none, in every town', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) expect(radioIn(seed, false)).toBe(true);
  });
});

describe('what bringing someone home does to the save and the breach', () => {
  it('scales the horde from half at no people to full at four', async () => {
    const { hordeShare } = await import('../shared/overrun.ts');
    expect([0, 2, 4].map(hordeShare)).toEqual([0.5, 0.75, 1]);
  });

  it('takes up the starter quest of whoever comes home, and no other', async () => {
    const { applyReceipt } = await import('../src/game/home/trip-ledger.ts');
    const { migrateCamp } = await import('../src/game/home/camp-migrate.ts');
    const { emptySave } = await import('../src/game/home/home-store.ts');
    const fresh = migrateCamp(emptySave(1), { radio: false, tracks: [] });
    expect(fresh.quests.active).toEqual({});
    const receipt = { simId: 's', serial: 1, outcome: 'banked', level: 1, difficulty: 'stay_close', silver: 0, jewels: { small: 0, large: 0 }, replay: false, score: 0, kills: 0, hordes: 0, seconds: 1, ending: false, gear: null, rescued: ['quartermaster'] } as const;
    const after = applyReceipt(fresh, { ...receipt, rescued: [...receipt.rescued] });
    expect(Object.keys(after.quests.active)).toEqual(['quartermaster']);
    expect(after.camp?.rescued).toEqual(['quartermaster']);
  });
});

describe('a lent gun', () => {
  function freed(): { sim: GameSimulation; state: ReturnType<typeof stateOf>; person: ReturnType<typeof stateOf>['rescuees'][number] } {
    const { sim, state } = roomWith([]);
    driveToTown(sim, state, 1);
    quietTown(state);
    const [person] = state.rescuees;
    const p = state.players[0];
    p.x = person.x + 10;
    p.y = person.y;
    for (let i = 0; i < 100 && person.status === 'waiting'; i++) {
      p.searchHeld = true;
      p.moving = false;
      steps(sim, 1);
    }
    return { sim, state, person };
  }

  it('is refused when it is the only gun, given when there is a spare, and comes back at the van', async () => {
    const { sim, state, person } = freed();
    const p = state.players[0];
    p.searchHeld = true;
    p.moving = false;
    steps(sim, 90);
    expect(person.lent).toBeNull();
    const { applyLoadout, loadoutOf } = await import('../shared/loadout.ts');
    applyLoadout(p, { ...loadoutOf(p), guns: { pistol: {}, shotgun: {} }, ammoBag: { ...loadoutOf(p).ammoBag, pistol: 24, shotgun: 12 } });
    p.weapon = 'shotgun';
    for (let i = 0; i < 100 && !person.lent; i++) {
      p.searchHeld = true;
      p.moving = false;
      p.x = person.x + 10;
      p.y = person.y;
      steps(sim, 1);
    }
    expect(person.lent?.weapon).toBe('shotgun');
    expect(p.guns.shotgun).toBeUndefined();
    p.searchHeld = false;
    openLevelExit(state);
    person.x = state.exit!.x + 20;
    person.y = state.exit!.y;
    bankTrip(sim, state);
    expect(p.home?.receipt?.gear?.guns.shotgun).toBeDefined();
  });
});
