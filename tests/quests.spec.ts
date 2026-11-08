import { describe, expect, it } from 'vitest';
import { MERCHANT_IDS } from '../shared/home-protocol.ts';
import type { MerchantId, TripReceipt } from '../shared/home-protocol.ts';
import { emptyLoadout } from '../shared/loadout.ts';
import { emptySave } from '../src/game/home/home-store.ts';
import type { HomeSave } from '../src/game/home/home-store.ts';
import { QUESTS, jobTimes, questOf, questsOf, targetOf } from '../src/game/home/quest-data.ts';
import { applyDeathToQuests, applyTripToQuests, noteSmelted, noteVisit } from '../src/game/home/quest-progress.ts';
import { reviveQuests } from '../src/game/home/quest-revive.ts';
import { blankQuests, rollJobs, starterQuests } from '../src/game/home/quest-state.ts';
import { emptyTally } from '../src/game/home/quest-tally.ts';
import type { TripTally } from '../src/game/home/quest-tally.ts';
import { abandon, accept, paidAsSilver, questRows, silverOf, turnIn } from '../src/game/home/quests.ts';
import type { QuestContext } from '../src/game/home/quests.ts';
import { receipt } from './helpers/home-sync-frames.ts';

const at = (merchant: MerchantId | null, patch: Partial<QuestContext> = {}): QuestContext => ({ station: merchant, highest: 10, difficulty: 'lights_out', now: 5, ...patch });
const tallied = (counts: Partial<TripTally['counts']> = {}, patch: Partial<TripTally> = {}): TripTally => {
  const base = emptyTally();
  return { ...base, counts: { ...base.counts, ...counts }, ...patch };
};
const bring = (patch: Partial<TripReceipt> = {}): TripReceipt => receipt({ gear: emptyLoadout(), ...patch });
const withActive = (save: HomeSave, merchant: MerchantId, id: string, progress = 0): HomeSave => ({
  ...save,
  quests: { ...save.quests, active: { ...save.quests.active, [merchant]: { id, progress, acceptedAt: 0 } } },
});
const idle = (merchant: MerchantId, id: string, progress = 0): HomeSave => {
  const save = emptySave(3);
  return withActive({ ...save, quests: { ...save.quests, active: {} } }, merchant, id, progress);
};

describe('the quest table', () => {
  it('has unique ids, each with a known giver and a reachable target', () => {
    expect(new Set(QUESTS.map((q) => q.id)).size).toBe(QUESTS.length);
    for (const quest of QUESTS) {
      expect(MERCHANT_IDS).toContain(quest.giver);
      expect(targetOf(quest.objective)).toBeGreaterThan(0);
    }
  });

  it('gives each merchant exactly one starter and one job', () => {
    for (const merchant of MERCHANT_IDS) {
      expect(questsOf(merchant).filter((q) => q.starter)).toHaveLength(1);
      expect(questsOf(merchant).filter((q) => q.repeat === 'job')).toHaveLength(1);
    }
  });

  it('only chains from quests that exist, and never from itself', () => {
    for (const quest of QUESTS) for (const id of quest.after ?? []) expect(id !== quest.id && questOf(id)).toBeTruthy();
  });

  it('pays job silver by the player highest level', () => {
    expect([jobTimes(1), jobTimes(3), jobTimes(4), jobTimes(6), jobTimes(7), jobTimes(10)]).toEqual([1, 1, 1.5, 1.5, 2, 2]);
    expect(silverOf(questOf('job_range_day')!, 7)).toBe(80);
  });
});

describe('a new save', () => {
  it('starts with one starter accepted at each stall and a job on offer', () => {
    const { quests } = emptySave(9);
    for (const merchant of MERCHANT_IDS) {
      expect(questOf(quests.active[merchant]!.id)?.starter).toBe(true);
      expect(questOf(quests.jobs[merchant]!)?.repeat).toBe('job');
    }
    expect(quests.done).toEqual([]);
  });

  it('rolls the same jobs for the same seed and keeps an accepted job out of the offer', () => {
    expect(starterQuests(4)).toEqual(starterQuests(4));
    const taken = { ...blankQuests(4), active: { medic: { id: 'job_field_dressing', progress: 0, acceptedAt: 0 } } };
    expect(rollJobs(taken, 1).jobs.medic).toBeNull();
    expect(rollJobs(taken, 1).jobs.gunsmith).toBe('job_range_day');
  });
});

describe('progress', () => {
  it('counts a visit at the right station only', () => {
    const quests = emptySave(1).quests;
    expect(noteVisit(quests, 'quartermaster').active.quartermaster?.progress).toBe(1);
    expect(noteVisit(quests, 'forge')).toBe(quests);
  });

  it('counts jewels smelted, and clamps at the target', () => {
    const quests = emptySave(1).quests;
    expect(noteSmelted(quests, 5).active.powder?.progress).toBe(1);
    expect(noteSmelted(quests, 0)).toBe(quests);
  });

  it('counts bring-home from the gear that came back', () => {
    const save = idle('medic', 'pharmacy_run');
    const home = bring({ gear: { ...emptyLoadout(), medkits: 2 } });
    expect(applyTripToQuests(save.quests, home, emptyTally()).active.medic?.progress).toBe(1);
    expect(applyTripToQuests(save.quests, bring(), emptyTally())).toBe(save.quests);
  });

  it('counts guns, a named gun, and jewels', () => {
    const gun = bring({ gear: { ...emptyLoadout(), guns: { pistol: {} } } });
    expect(applyTripToQuests(idle('gunsmith', 'bring_iron').quests, gun, emptyTally()).active.gunsmith?.progress).toBe(1);
    expect(applyTripToQuests(idle('gunsmith', 'evidence_locker').quests, gun, emptyTally())).toEqual(idle('gunsmith', 'evidence_locker').quests);
    const carbine = bring({ gear: { ...emptyLoadout(), guns: { carbine: {} } } });
    expect(applyTripToQuests(idle('gunsmith', 'evidence_locker').quests, carbine, emptyTally()).active.gunsmith?.progress).toBe(1);
    const jewels = bring({ jewels: { small: 2, large: 1 } });
    expect(applyTripToQuests(idle('powder', 'job_shiny_things').quests, jewels, emptyTally()).active.powder?.progress).toBe(3);
  });

  it('counts a trip-scoped tally inside one trip and keeps the best', () => {
    const save = idle('gunsmith', 'headhunter');
    const first = applyTripToQuests(save.quests, bring(), tallied({ headshots: 9 }));
    expect(first.active.gunsmith?.progress).toBe(9);
    const worse = applyTripToQuests(first, bring(), tallied({ headshots: 4 }));
    expect(worse.active.gunsmith?.progress).toBe(9);
    expect(applyTripToQuests(first, bring(), tallied({ headshots: 40 })).active.gunsmith?.progress).toBe(15);
  });

  it('adds a total-scoped tally across trips', () => {
    const save = idle('medic', 'patch_up');
    const once = applyTripToQuests(save.quests, bring(), tallied({ medkits: 1 }));
    expect(applyTripToQuests(once, bring(), tallied({ medkits: 1 })).active.medic?.progress).toBe(2);
  });

  it('fails a trip, not the quest, when the at-most counter is broken', () => {
    const save = idle('gunsmith', 'ghost_walk');
    const night = { survivor: 'night' };
    const noisy = applyTripToQuests(save.quests, bring({ level: 3 }), tallied({ finds: 8, noisy: 1 }, night));
    expect(noisy.active.gunsmith?.progress).toBe(0);
    const quiet = applyTripToQuests(noisy, bring({ level: 3 }), tallied({ finds: 8 }, night));
    expect(quiet.active.gunsmith?.progress).toBe(8);
  });

  it('honours the survivor and level filters', () => {
    const save = idle('quartermaster', 'shove_and_stab');
    expect(applyTripToQuests(save.quests, bring(), tallied({ shoves: 30 }, { survivor: 'night' }))).toBe(save.quests);
    expect(applyTripToQuests(save.quests, bring(), tallied({ shoves: 30 }, { survivor: 'rex' })).active.quartermaster?.progress).toBe(30);
    const fast = idle('quartermaster', 'fast_hands');
    expect(applyTripToQuests(fast.quests, bring({ level: 3 }), tallied({ kills: 60 }, { survivor: 'bandus' }))).toBe(fast.quests);
  });

  it('reads kills of one kind from the zombie filter', () => {
    const save = idle('powder', 'big_game');
    const killsBy = { ...emptyTally().killsBy, brute: 1 };
    expect(applyTripToQuests(save.quests, bring({ level: 5 }), tallied({ kills: 40 }, { killsBy })).active.powder?.progress).toBe(1);
    expect(applyTripToQuests(save.quests, bring({ level: 5 }), tallied({ kills: 40 }))).toBe(save.quests);
  });

  it('counts a fast trip only at or under the limit', () => {
    const save = idle('medic', 'run_for_it');
    const kat = { survivor: 'satori' };
    expect(applyTripToQuests(save.quests, bring({ level: 3, seconds: 481 }), tallied({}, kat))).toBe(save.quests);
    expect(applyTripToQuests(save.quests, bring({ level: 3, seconds: 480 }), tallied({}, kat)).active.medic?.progress).toBe(1);
  });

  it('counts hordes across banked trips', () => {
    const save = idle('quartermaster', 'hold_the_line');
    const once = applyTripToQuests(save.quests, bring({ hordes: 4 }), emptyTally());
    expect(applyTripToQuests(once, bring({ hordes: 9 }), emptyTally()).active.quartermaster?.progress).toBe(10);
  });

  it('resets a streak on a death and moves nothing else', () => {
    const streak = idle('medic', 'steady_hands', 2);
    const died = applyTripToQuests(streak.quests, bring({ outcome: 'died', level: 3 }), tallied({ medkits: 5 }));
    expect(died.active.medic?.progress).toBe(0);
    const other = idle('gunsmith', 'headhunter', 6);
    expect(applyTripToQuests(other.quests, bring({ outcome: 'died' }), tallied({ headshots: 30 }))).toBe(other.quests);
  });

  it('keeps a finished streak through a death: quests never fail', () => {
    const done = idle('medic', 'steady_hands', 3);
    expect(applyTripToQuests(done.quests, bring({ outcome: 'died', level: 3 }), tallied())).toBe(done.quests);
    expect(applyDeathToQuests(done.quests, { level: 3 })).toBe(done.quests);
  });

  it('breaks a streak only on a death the quest\'s filter would have counted', () => {
    const streak = idle('medic', 'steady_hands', 2);
    expect(applyTripToQuests(streak.quests, bring({ outcome: 'died', level: 1 }), tallied())).toBe(streak.quests);
    expect(applyTripToQuests(streak.quests, bring({ outcome: 'died', level: 2 }), tallied()).active.medic?.progress).toBe(0);
  });

  it('breaks a running streak when a trip never came home, judged by its level alone', () => {
    const streak = idle('medic', 'steady_hands', 2);
    expect(applyDeathToQuests(streak.quests, { level: 2 }).active.medic?.progress).toBe(0);
    expect(applyDeathToQuests(streak.quests, { level: 1 })).toBe(streak.quests);
  });
});

describe('the work list', () => {
  it('shows the open quest, the next one-time quest and the job', () => {
    const save = emptySave(2);
    const rows = questRows(save, 'medic', 1);
    expect(rows.map((row) => row.id)).toEqual(['pharmacy_run', 'job_field_dressing']);
    expect(rows[0]).toMatchObject({ state: 'active', progress: 0, target: 1 });
    expect(rows[1].state).toBe('busy');
  });

  it('hides quests behind their gates and chains', () => {
    const rows = questRows(idle('gunsmith', 'bring_iron'), 'gunsmith', 1);
    expect(rows.map((row) => row.id)).not.toContain('evidence_locker');
    expect(rows.map((row) => row.id)).not.toContain('headhunter');
  });
});

describe('accept, abandon and turn in', () => {
  it('refuses unless at the giver counter with no trip open', () => {
    const save = idle('medic', 'pharmacy_run', 1);
    expect(turnIn(save, 'medic', at(null))).toBeNull();
    expect(turnIn(save, 'medic', at('gunsmith'))).toBeNull();
    expect(turnIn({ ...save, openTrip: { level: 1, mode: 'solo', difficulty: 'lights_out', startedAt: 1 } }, 'medic', at('medic'))).toBeNull();
    expect(abandon(save, 'medic', at(null))).toBeNull();
  });

  it('refuses to turn in a quest that is not ready', () => {
    expect(turnIn(idle('medic', 'pharmacy_run', 0), 'medic', at('medic'))).toBeNull();
  });

  it('pays silver, marks a one-time quest done and clears the slot', () => {
    const save = idle('medic', 'pharmacy_run', 1);
    const paid = turnIn(save, 'medic', at('medic'))!;
    expect(paid.silver).toBe(60);
    expect(paid.quests.done).toEqual(['pharmacy_run']);
    expect(paid.quests.active.medic).toBeUndefined();
    expect(save.silver).toBe(0);
  });

  it('puts an item reward in the locker', () => {
    const paid = turnIn(idle('gunsmith', 'bring_iron', 1), 'gunsmith', at('gunsmith'))!;
    expect(paid.locker.parts.barrel).toBe(1);
  });

  it('pays an item that does not fit as silver at its shop price', () => {
    const save = idle('quartermaster', 'hold_the_line', 10);
    const knifeFull = { ...save, locker: { ...save.locker, knife: true } };
    expect(paidAsSilver(knifeFull, questOf('hold_the_line')!, 'lights_out')).toBe(100);
    expect(turnIn(knifeFull, 'quartermaster', at('quartermaster'))!.silver).toBe(100);
    expect(paidAsSilver(save, questOf('hold_the_line')!, 'lights_out')).toBe(0);
  });

  it('pays a job in silver by level, and does not mark it done', () => {
    const save = idle('gunsmith', 'job_range_day', 25);
    const paid = turnIn(save, 'gunsmith', at('gunsmith', { highest: 5 }))!;
    expect(paid.silver).toBe(60);
    expect(paid.quests.done).toEqual([]);
  });

  it('accepts one quest per merchant, only what is on offer', () => {
    const save = idle('medic', 'pharmacy_run', 1);
    const cleared = turnIn(save, 'medic', at('medic'))!;
    expect(accept(cleared, 'medic', 'patch_up', at('medic'))?.quests.active.medic?.id).toBe('patch_up');
    expect(accept(save, 'medic', 'patch_up', at('medic'))).toBeNull();
    expect(accept(cleared, 'medic', 'run_for_it', at('medic', { highest: 1 }))).toBeNull();
    expect(accept(cleared, 'medic', 'job_shiny_things', at('medic'))).toBeNull();
  });

  it('takes a job off the offer when accepted', () => {
    const save = emptySave(8);
    const empty = { ...save, quests: { ...save.quests, active: {} } };
    const taken = accept(empty, 'medic', empty.quests.jobs.medic!, at('medic'))!;
    expect(taken.quests.jobs.medic).toBeNull();
    expect(taken.quests.active.medic?.id).toBe('job_field_dressing');
  });

  it('puts an abandoned one-time quest back on offer and loses its progress', () => {
    const save = idle('medic', 'pharmacy_run', 0);
    const dropped = abandon(save, 'medic', at('medic'))!;
    expect(dropped.quests.active.medic).toBeUndefined();
    expect(questRows(dropped, 'medic', 1)[0]).toMatchObject({ id: 'pharmacy_run', state: 'offered', progress: 0 });
  });

  it('will not abandon a finished quest: it waits to be turned in', () => {
    const ready = idle('medic', 'pharmacy_run', 1);
    expect(abandon(ready, 'medic', at('medic'))).toBeNull();
    expect(abandon(idle('medic', 'pharmacy_run', 0), 'medic', at('medic'))).not.toBeNull();
  });

  it('puts an abandoned job back on the counter as the same job', () => {
    const save = emptySave(8);
    const empty = { ...save, quests: { ...save.quests, active: {} } };
    const job = empty.quests.jobs.medic!;
    const taken = accept(empty, 'medic', job, at('medic'))!;
    expect(taken.quests.jobs.medic).toBeNull();
    const dropped = abandon(taken, 'medic', at('medic'))!;
    expect(dropped.quests.jobs.medic).toBe(job);
    expect(dropped.quests.active.medic).toBeUndefined();
    expect(accept(dropped, 'medic', job, at('medic'))?.quests.active.medic?.id).toBe(job);
  });
});

describe('reading a saved quest block back', () => {
  const blank = emptySave(11).quests;

  it('falls back to the blank when nothing readable is there', () => {
    expect(reviveQuests(undefined, blank)).toBe(blank);
    expect(reviveQuests({ seed: 'x' }, blank)).toBe(blank);
  });

  it('drops an unknown quest alone and clamps progress', () => {
    const revived = reviveQuests({
      seed: 3,
      rolls: 2,
      active: { medic: { id: 'pharmacy_run', progress: 99, acceptedAt: 7 }, gunsmith: { id: 'nope', progress: 1, acceptedAt: 1 }, powder: { id: 'pharmacy_run', progress: 1, acceptedAt: 1 } },
      done: ['report_in', 'report_in', 'job_range_day', 4],
      jobs: { medic: 'job_field_dressing', gunsmith: 'job_shiny_things' },
    }, blank);
    expect(revived.active.medic).toEqual({ id: 'pharmacy_run', progress: 1, acceptedAt: 7 });
    expect(revived.active.gunsmith).toBeUndefined();
    expect(revived.active.powder).toBeUndefined();
    expect(revived.done).toEqual(['report_in']);
    expect(revived.jobs.medic).toBe('job_field_dressing');
    expect(revived.jobs.gunsmith).toBeNull();
  });

  it('round-trips a live save', () => {
    const quests = rollJobs(emptySave(5).quests, 7);
    expect(reviveQuests(JSON.parse(JSON.stringify(quests)), blank)).toEqual(quests);
  });
});
