import { describe, expect, it } from "vitest";
import {
  bestDay,
  countdownText,
  dailyFor,
  dateKeyOf,
  dayLabel,
  loadDailyLog,
  msUntilTomorrow,
  recentDays,
  recordDaily,
  streakOf,
  withRun
} from "../src/game/daily-night.ts";
import type { DailyLog } from "../src/game/daily-night.ts";

function memoryStore(): Pick<Storage, "getItem" | "setItem"> {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value)
  };
}

const run = (score: number) => ({ score, kills: score / 10, level: 4 });

describe("Nightly Run", () => {
  it("turns a date into the same night every time, within the daily levels", () => {
    expect(dailyFor("2026-11-07")).toEqual(dailyFor("2026-11-07"));
    const nights = Array.from({ length: 60 }, (_, i) =>
      dailyFor(dateKeyOf(new Date(2026, 0, 1 + i)))
    );
    for (const night of nights) {
      expect(night.level).toBeGreaterThanOrEqual(2);
      expect(night.level).toBeLessThanOrEqual(8);
    }
    expect(new Set(nights.map((night) => night.seed)).size).toBe(60);
    expect(new Set(nights.map((night) => night.level)).size).toBeGreaterThan(3);
  });

  it("names days the way a player reads them", () => {
    expect(dateKeyOf(new Date(2026, 10, 7, 23, 59))).toBe("2026-11-07");
    expect(dayLabel("2026-11-07")).toBe("7 Nov");
    expect(countdownText(5 * 3600_000 + 12 * 60_000)).toBe("5h 12m");
    expect(countdownText(12 * 60_000 + 5000)).toBe("12m");
    expect(msUntilTomorrow(new Date(2026, 10, 7, 23, 0))).toBe(3600_000);
  });

  it("counts the first run of a day and keeps later ones as practice", () => {
    const store = memoryStore();
    expect(recordDaily("2026-11-07", run(300), store)).toBe(true);
    expect(recordDaily("2026-11-07", run(900), store)).toBe(false);
    const day = loadDailyLog(store)["2026-11-07"];
    expect(day).toMatchObject({ score: 300, attempts: 2, practiceBest: 900 });
  });

  it("counts a streak up to today, or yesterday while today is open", () => {
    let log: DailyLog = {};
    for (const key of ["2026-11-04", "2026-11-05", "2026-11-06"])
      log = withRun(log, key, run(100)).log;
    expect(streakOf(log, "2026-11-07")).toBe(3);
    log = withRun(log, "2026-11-07", run(100)).log;
    expect(streakOf(log, "2026-11-07")).toBe(4);
    expect(streakOf(log, "2026-11-09")).toBe(0);
  });

  it("finds the best day and lists the last week, gaps included", () => {
    let log: DailyLog = {};
    log = withRun(log, "2026-11-01", run(500)).log;
    log = withRun(log, "2026-11-06", run(200)).log;
    expect(bestDay(log)?.key).toBe("2026-11-01");
    const week = recentDays(log, "2026-11-07");
    expect(week.map((day) => day.key)).toEqual([
      "2026-11-07",
      "2026-11-06",
      "2026-11-05",
      "2026-11-04",
      "2026-11-03",
      "2026-11-02",
      "2026-11-01"
    ]);
    expect(week[1].result?.score).toBe(200);
    expect(week[0].result).toBeNull();
  });

  it("records both Solo and MP runs for the same day with cumulative team scores", () => {
    const store = memoryStore();
    // Counted solo run
    expect(recordDaily("2026-11-07", { score: 400, kills: 20, level: 3 }, store)).toBe(true);
    // Practice solo run
    expect(recordDaily("2026-11-07", { score: 600, kills: 30, level: 4 }, store)).toBe(false);

    // Counted 3-player MP run
    const mpTrio = {
      score: 500,
      kills: 25,
      level: 5,
      partySize: 3,
      teamScore: 1450,
      teamKills: 70,
      roster: [
        { name: "Night", character: 0, score: 500, kills: 25 },
        { name: "Bear", character: 1, score: 450, kills: 20 },
        { name: "Kat", character: 2, score: 500, kills: 25 }
      ]
    };
    expect(recordDaily("2026-11-07", mpTrio, store)).toBe(true);

    // Practice 3-player MP run
    const mpTrioPractice = { ...mpTrio, score: 700, teamScore: 1900 };
    expect(recordDaily("2026-11-07", mpTrioPractice, store)).toBe(false);

    // Counted 5-player MP run
    const mpFull = {
      score: 300,
      kills: 15,
      level: 6,
      partySize: 5,
      teamScore: 2400,
      teamKills: 110
    };
    expect(recordDaily("2026-11-07", mpFull, store)).toBe(true);

    const day = loadDailyLog(store)["2026-11-07"];
    expect(day.solo).toMatchObject({ score: 400, attempts: 2, practiceBest: 600 });
    expect(day.mp?.[3]).toMatchObject({
      partySize: 3,
      teamScore: 1450,
      playerScore: 500,
      attempts: 2,
      practiceBestTeamScore: 1900
    });
    expect(day.mp?.[5]).toMatchObject({
      partySize: 5,
      teamScore: 2400,
      playerScore: 300,
      attempts: 1
    });
  });

  it("maintains a unified streak across solo and MP runs", () => {
    let log: DailyLog = {};
    log = withRun(log, "2026-11-04", { score: 100, kills: 10, level: 3 }).log; // solo
    log = withRun(log, "2026-11-05", {
      score: 200,
      kills: 15,
      level: 4,
      partySize: 2,
      teamScore: 500
    }).log; // MP duo
    log = withRun(log, "2026-11-06", {
      score: 300,
      kills: 20,
      level: 5,
      partySize: 5,
      teamScore: 1800
    }).log; // MP squad
    expect(streakOf(log, "2026-11-07")).toBe(3);
    log = withRun(log, "2026-11-07", { score: 150, kills: 12, level: 4 }).log; // solo
    expect(streakOf(log, "2026-11-07")).toBe(4);
  });

  it("ignores a damaged save", () => {
    const store = memoryStore();
    store.setItem("outbreak.daily.v2", '{"2026-11-07":{"score":"lots"},"nonsense":{}}');
    expect(loadDailyLog(store)).toEqual({});
  });

  const NOW = new Date(2026, 10, 7, 20, 0);
  const oldLog = JSON.stringify({
    "2026-11-04": { score: 300, kills: 12, level: 3, attempts: 1, practiceBest: 0 },
    "2026-11-05": {
      score: 500,
      kills: 25,
      level: 5,
      attempts: 1,
      practiceBest: 0,
      mp: {
        3: {
          partySize: 3,
          teamScore: 1450,
          teamKills: 70,
          playerScore: 500,
          playerKills: 25,
          level: 5,
          attempts: 1,
          practiceBestTeamScore: 0
        }
      }
    },
    "2026-11-06": {
      score: 900,
      kills: 40,
      level: 4,
      attempts: 2,
      practiceBest: 1200,
      solo: { score: 900, kills: 40, level: 4, attempts: 2, practiceBest: 1200 }
    },
    "2026-11-07": { score: 700, kills: 30, level: 4, attempts: 1, practiceBest: 0 }
  });

  it("keeps the streak from before level 100 but none of its points", () => {
    const store = memoryStore();
    store.setItem("outbreak.daily", oldLog);
    const log = loadDailyLog(store, NOW);
    expect(log["2026-11-06"]).toEqual({
      score: 0,
      kills: 40,
      level: 4,
      attempts: 2,
      practiceBest: 0,
      carried: true
    });
    expect(log["2026-11-05"]).toEqual({
      score: 0,
      kills: 25,
      level: 5,
      attempts: 1,
      practiceBest: 0,
      carried: true
    });
    expect(log["2026-11-07"]).toBeUndefined();
    expect(streakOf(log, "2026-11-07")).toBe(3);
  });

  it("counts the first new run on the day of the change and leaves the old log in storage", () => {
    const store = memoryStore();
    store.setItem("outbreak.daily", oldLog);
    expect(recordDaily("2026-11-07", run(30), store)).toBe(true);
    expect(store.getItem("outbreak.daily")).toBe(oldLog);
    const log = loadDailyLog(store, NOW);
    expect(log["2026-11-07"]).toMatchObject({ score: 30, attempts: 1 });
    expect(log["2026-11-07"].carried).toBeUndefined();
    expect(log["2026-11-06"]).toMatchObject({ score: 0, carried: true });
    expect(streakOf(log, "2026-11-07")).toBe(4);
    expect(JSON.parse(store.getItem("outbreak.daily.v2")!)["2026-11-04"].carried).toBe(true);
  });

  it("counts a run on a day carried from before level 100 as that day's first", () => {
    const carried = {
      score: 0,
      kills: 40,
      level: 4,
      attempts: 2,
      practiceBest: 0,
      carried: true as const
    };
    const { log, counted } = withRun({ "2026-11-06": carried }, "2026-11-06", run(30));
    expect(counted).toBe(true);
    expect(log["2026-11-06"]).toMatchObject({ score: 30, kills: 3, attempts: 1 });
    expect(log["2026-11-06"].carried).toBeUndefined();
  });

  it("never takes a day from before level 100 for the best day", () => {
    const carried = {
      score: 0,
      kills: 40,
      level: 4,
      attempts: 2,
      practiceBest: 0,
      carried: true as const
    };
    expect(bestDay({ "2026-11-05": carried })).toBeNull();
    expect(
      bestDay({ "2026-11-05": carried, "2026-11-06": { ...run(20), attempts: 1, practiceBest: 0 } })
        ?.key
    ).toBe("2026-11-06");
  });
});

describe("the shared Daily result", () => {
  it("names the day, the level, the points and kills, and a streak past one night", async () => {
    const { shareText } = await import("../src/game/daily-night.ts");
    const run = { score: 1310, kills: 61, level: 6 };
    expect(shareText("2026-11-07", run, 3, "https://x/")).toBe(
      "Undead of Night - Nightly Run, 7 Nov\nReached Sixburg: 1310 points, 61 kills\nStreak: 3 nights in a row\nhttps://x/"
    );
    expect(shareText("2026-11-07", run, 1, "https://x/")).not.toContain("Streak");
  });
});
