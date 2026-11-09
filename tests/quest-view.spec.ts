import { describe, expect, it } from 'vitest';
import { MEDKIT_MAX } from '../shared/constants.ts';
import type { MerchantId } from '../shared/home-protocol.ts';
import { emptySave } from '../src/game/home/home-store.ts';
import type { HomeSave } from '../src/game/home/home-store.ts';
import { itemOf } from '../src/game/home/merchant-data.ts';
import { emptyTally } from '../src/game/home/quest-tally.ts';
import type { TripTally } from '../src/game/home/quest-tally.ts';
import { barCells, questPanels, questTracker } from '../src/game/home/quest-view.ts';
import type { HomeUi } from '../src/game/home-hud.ts';

function homeOf(save: HomeSave | null, patch: Partial<HomeUi> = {}): HomeUi {
  return {
    inBunker: true, station: null, stationHold: 0, shop: null, ready: false,
    carried: { jewels: { small: 0, large: 0 }, worth: 0 }, pickedLevel: null, roomHighest: 1, overrun: null, highest: 10,
    difficulty: 'lights_out', receipt: null, save, forgeProgress: 0, saveError: null, death: null, chest: null,
    quests: { tally: emptyTally() }, ...patch,
  };
}

const idle = (merchant: MerchantId, id: string, progress = 0): HomeSave => {
  const save = emptySave(3);
  return { ...save, quests: { ...save.quests, active: { [merchant]: { id, progress, acceptedAt: 0 } } } };
};
const tallied = (counts: Partial<TripTally['counts']>, patch: Partial<TripTally> = {}): TripTally => {
  const base = emptyTally();
  return { ...base, counts: { ...base.counts, ...counts }, ...patch };
};

describe('objective bars', () => {
  it('lights one cell per unit up to five and scales above that', () => {
    expect(barCells(3, 3)).toBe(3);
    expect(barCells(5, 5)).toBe(5);
    expect(barCells(0, 25)).toBe(0);
    expect(barCells(1, 25)).toBe(1);
    expect(barCells(11, 25)).toBe(2);
    expect(barCells(24, 25)).toBe(4);
    expect(barCells(25, 25)).toBe(5);
  });

  it('shows the number beside the bar', () => {
    const panel = questPanels(homeOf(idle('gunsmith', 'headhunter', 11)), 'gunsmith')[0];
    expect(panel.bars[0]).toMatchObject({ filled: 4, slots: 5, value: '11 / 15', failed: false });
  });
});

describe('the work list', () => {
  it('puts the open quest first and greys what waits behind it', () => {
    const rows = questPanels(homeOf(idle('quartermaster', 'report_in')), 'quartermaster');
    expect(rows[0]).toMatchObject({ id: 'report_in', state: 'active', action: 'none', canAbandon: false });
    expect(rows.slice(1).every((row) => row.state === 'busy' && row.refusal === 'Finish my last job first')).toBe(true);
  });

  it('is empty before the save loads', () => {
    expect(questPanels(homeOf(null), 'medic')).toEqual([]);
    expect(questTracker(homeOf(null))).toEqual({ lines: [], warning: null, summary: 'No work' });
  });

  it('says why a step would be refused, in the shop\'s words', () => {
    const save = { ...emptySave(3), quests: { ...emptySave(3).quests, active: {} } };
    const offer = (home: HomeUi) => questPanels(home, 'medic')[0];
    expect(offer(homeOf(save, { station: 'medic' }))).toMatchObject({ action: 'accept', canAct: true, refusal: null });
    expect(offer(homeOf(save, { station: 'gunsmith' }))).toMatchObject({ canAct: false, refusal: 'Walk up to them first' });
    const away = { ...save, openTrip: { level: 1 } } as unknown as HomeSave;
    expect(offer(homeOf(away, { station: 'medic' }))).toMatchObject({ canAct: false, refusal: 'Not while out on a trip' });
  });

  it('offers a turn-in at the giver\'s counter once the quest is done', () => {
    const save = idle('powder', 'first_smelt', 1);
    const [panel] = questPanels(homeOf(save, { station: 'powder' }), 'powder');
    expect(panel).toMatchObject({ state: 'ready', action: 'turn_in', canAct: true, canAbandon: false });
    expect(questPanels(homeOf(save), 'powder')[0]).toMatchObject({ canAct: false, refusal: 'Walk up to them first' });
  });
});

describe('reward chips', () => {
  it('names each reward and the silver a job pays at the player\'s level', () => {
    const [panel] = questPanels(homeOf(idle('medic', 'pharmacy_run')), 'medic');
    expect(panel.rewards).toEqual([{ kind: 'silver', label: '60 silver', note: null }]);
    const job = questPanels(homeOf(idle('medic', 'pharmacy_run'), { highest: 10 }), 'medic').find((row) => row.id.startsWith('job_'));
    expect(job?.rewards).toEqual([{ kind: 'silver', label: '60 silver', note: null }]);
  });

  it('marks an item that would not fit as paid in silver before turn-in', () => {
    const base = idle('medic', 'patch_up', 2);
    const price = itemOf('medic', 'medkit')!.price;
    const roomy = questPanels(homeOf(base), 'medic')[0];
    expect(roomy.rewards.find((chip) => chip.kind === 'item')?.note).toBeNull();
    const full = { ...base, locker: { ...base.locker, medkits: MEDKIT_MAX } };
    const chips = questPanels(homeOf(full), 'medic')[0].rewards;
    expect(chips.find((chip) => chip.kind === 'item')?.note).toBe(`Paid as ${price} silver`);
  });
});

describe('live tallies in town', () => {
  const trip = (tally: TripTally, save: HomeSave) => homeOf(save, { inBunker: false, quests: { tally } });

  it('merges the running count into the bar and warns that it is lost on a death', () => {
    const save = idle('gunsmith', 'headhunter');
    const live = questPanels(trip(tallied({ headshots: 7 }), save), 'gunsmith')[0];
    expect(live.bars[0].value).toBe('7 / 15');
    expect(live.lostIfDie).toBe(true);
    expect(questTracker(trip(tallied({ headshots: 7 }), save))).toMatchObject({ warning: 'Lost if you die', lines: [{ atRisk: true, ready: false }] });
    expect(questPanels(homeOf(save, { quests: { tally: tallied({ headshots: 7 }) } }), 'gunsmith')[0].bars[0].value).toBe('0 / 15');
  });

  it('adds a total-scope count on top of what is banked, and never goes below it', () => {
    const save = idle('medic', 'patch_up', 1);
    expect(questTracker(trip(tallied({ medkits: 1 }), save)).lines[0].bar.value).toBe('2 / 2');
    expect(questTracker(trip(tallied({}), save))).toMatchObject({ warning: null, lines: [{ atRisk: false }] });
  });

  it('counts only a trip that passes the quest\'s filter', () => {
    const save = idle('gunsmith', 'ghost_walk');
    const night = tallied({ finds: 5 }, { survivor: 'night' });
    const rex = tallied({ finds: 5 }, { survivor: 'rex' });
    expect(questTracker({ ...trip(night, save), pickedLevel: 4 }).lines[0].bar.value).toBe('5 / 8');
    expect(questTracker({ ...trip(night, save), pickedLevel: 2 }).lines[0].bar.value).toBe('0 / 8');
    expect(questTracker({ ...trip(rex, save), pickedLevel: 4 }).lines[0].bar.value).toBe('0 / 8');
  });

  it('shows the limit as a second bar and fails it once passed', () => {
    const save = idle('gunsmith', 'ghost_walk');
    const calm = { ...trip(tallied({ finds: 2 }, { survivor: 'night' }), save), pickedLevel: 4 };
    expect(questPanels(calm, 'gunsmith')[0].bars[1]).toMatchObject({ label: 'Noisy searches', value: '0 of 0 allowed', failed: false });
    const loud = { ...trip(tallied({ finds: 2, noisy: 1 }, { survivor: 'night' }), save), pickedLevel: 4 };
    expect(questPanels(loud, 'gunsmith')[0].bars[1]).toMatchObject({ value: '1 of 0 allowed', failed: true });
    expect(questPanels(loud, 'gunsmith')[0].bars[0].value).toBe('0 / 8');
  });
});

describe('the HUD tracker', () => {
  it('lists one line per open quest and counts the ones ready to turn in', () => {
    expect(questTracker(homeOf(emptySave(3)))).toMatchObject({ summary: 'Work: 0 of 4 ready' });
    expect(questTracker(homeOf(emptySave(3))).lines).toHaveLength(4);
    const ready = idle('powder', 'first_smelt', 1);
    expect(questTracker(homeOf(ready))).toMatchObject({ summary: 'Work: 1 of 1 ready', lines: [{ merchant: 'powder', ready: true }] });
  });

  it('counts the open quests, not the merchants, and says so plainly when there are none', () => {
    const two = idle('powder', 'first_smelt', 1);
    const open = { ...two, quests: { ...two.quests, active: { ...two.quests.active, medic: { id: 'pharmacy_run', progress: 0, acceptedAt: 0 } } } };
    expect(questTracker(homeOf(open)).summary).toBe('Work: 1 of 2 ready');
    expect(questTracker(homeOf({ ...open, quests: { ...open.quests, active: {} } })).summary).toBe('No work');
  });

  it('puts one shared warning under the lines however many are at risk', () => {
    const base = idle('gunsmith', 'headhunter');
    const both = { ...base, quests: { ...base.quests, active: { ...base.quests.active, quartermaster: { id: 'shove_and_stab', progress: 0, acceptedAt: 0 } } } };
    const tracker = questTracker(homeOf(both, { inBunker: false, quests: { tally: tallied({ headshots: 3, shoves: 4 }, { survivor: 'rex' }) } }));
    expect(tracker.lines.filter((line) => line.atRisk)).toHaveLength(2);
    expect(tracker.warning).toBe('Lost if you die');
  });
});
