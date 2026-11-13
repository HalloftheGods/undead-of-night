import { describe, expect, it } from "vitest";
import { MEDKIT_MAX, START_SPARE_ROUNDS, WEAPONS } from "../shared/constants.ts";
import { GameSimulation } from "../shared/simulation.ts";
import { nextTier, STREAK_TIERS, tiersFor, TOP_STREAK_NIGHT } from "../shared/streak-kit.ts";
import type { DailyLog, DailyResult } from "../src/game/daily-night.ts";
import {
  kitWords,
  streakCardLine,
  streakNightOf,
  streakReward
} from "../src/game/streak-reward.ts";
import { SEED } from "./helpers/sim-harness.ts";

const played: DailyResult = { score: 100, kills: 10, level: 3, attempts: 1, practiceBest: 0 };
const logOf = (...days: string[]): DailyLog => Object.fromEntries(days.map((day) => [day, played]));

function startedOn(night: number, startLevel?: number) {
  const sim = new GameSimulation({ seed: SEED, startLevel });
  sim.addPlayer("p", "P");
  sim.giveStreakKit("p", night);
  return sim.snapshot().players[0];
}

describe("the streak kit", () => {
  it("adds nothing on night 1", () => {
    const p = startedOn(1);
    expect(p).toMatchObject({
      weapon: "pistol",
      owned: ["pistol"],
      medkits: 0,
      knife: false,
      reserve: START_SPARE_ROUNDS
    });
    expect(tiersFor(1)).toEqual([]);
  });

  it("gives a medkit and spare pistol rounds on night 2", () => {
    const p = startedOn(2);
    expect(p.medkits).toBe(1);
    expect(p.reserve).toBe(START_SPARE_ROUNDS + 12);
    expect(p.knife).toBe(false);
  });

  it("stacks the tiers, putting the best gun in hand loaded", () => {
    const p = startedOn(4);
    expect(p.knife).toBe(true);
    expect(p.owned).toEqual(["pistol", "shotgun"]);
    expect(p.weapon).toBe("shotgun");
    expect(p.ammo).toBe(WEAPONS.shotgun.magSize);
    expect(p.ammoBag.shotgun).toBe(6);
  });

  it("stops growing at the top night", () => {
    const top = startedOn(TOP_STREAK_NIGHT);
    const later = startedOn(TOP_STREAK_NIGHT + 20);
    expect(later).toMatchObject({
      weapon: "carbine",
      medkits: top.medkits,
      owned: top.owned,
      ammoBag: top.ammoBag
    });
    expect(later.medkits).toBeLessThanOrEqual(MEDKIT_MAX);
    expect(nextTier(TOP_STREAK_NIGHT)).toBeNull();
  });

  it("adds to the return kit when a Nightly Run starts past level 1", () => {
    const p = startedOn(2, 5);
    expect(p.reserve).toBe(12);
    expect(p.medkits).toBe(1);
  });

  it("lists tiers in night order", () => {
    const nights = STREAK_TIERS.map((tier) => tier.night);
    expect(nights).toEqual([...nights].sort((a, b) => a - b));
  });
});

describe("which night of the streak a run is", () => {
  it("is night 1 with nothing played, or after a missed day", () => {
    expect(streakNightOf({}, "2026-11-08")).toBe(1);
    expect(streakNightOf(logOf("2026-11-06"), "2026-11-08")).toBe(1);
  });

  it("is the night after the streak while today is open, and the streak once today counts", () => {
    expect(streakNightOf(logOf("2026-11-07"), "2026-11-08")).toBe(2);
    expect(streakNightOf(logOf("2026-11-06", "2026-11-07"), "2026-11-08")).toBe(3);
    expect(streakNightOf(logOf("2026-11-07", "2026-11-08"), "2026-11-08")).toBe(2);
  });

  it("crosses a month end on the player's calendar", () => {
    expect(streakNightOf(logOf("2026-10-31"), "2026-11-01")).toBe(2);
  });
});

describe("the streak kit in words", () => {
  it("says nothing on night 1 and joins the tiers after", () => {
    expect(kitWords(1)).toBeNull();
    expect(streakCardLine(1)).toBeNull();
    expect(kitWords(3)).toBe("A medkit and 12 pistol rounds, a knife");
    expect(streakCardLine(2)).toBe("Night 2 streak kit: A medkit and 12 pistol rounds");
  });

  it("tells the Nightly Run page tonight's kit and the next one", () => {
    const view = streakReward(logOf("2026-11-07"), "2026-11-08");
    expect(view).toMatchObject({
      night: 2,
      todayOpen: true,
      top: false,
      next: { night: 3, words: "A knife" }
    });
    expect(view.tonight).toBe("A medkit and 12 pistol rounds");
    const done = streakReward(logOf("2026-11-07", "2026-11-08"), "2026-11-08");
    expect(done.todayOpen).toBe(false);
  });
});
