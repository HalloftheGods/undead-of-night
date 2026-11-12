# Level 100 progression: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task by task. This repo keeps status in chemx's index.db, not in this file: each task below is a chemx task under #7517, so there are no checkboxes here.

**Goal:** Raise the character level cap to 100 on a new XP curve, make kill points scale with the town at a tenth of today's values while score stays the XP gained, pay the headshot bonus once on the killing shot, and replace the weekly decay with a one-level-a-week upkeep that never drops a level.

**Architecture:** Scoring changes live in the sim: a new pure module `shared/kill-points.ts` (`killPoints`, `townOf`) is called from `killZombie` and from a new `payHeadshot` that runs after damage lands. Progression stays a pure module (`shared/progression.ts`) with a versioned save, a pure `loadProgression` and an explicit `checkApUpkeep` that the title, setup and run-start paths call. Record books move to `.v2` storage keys.

**Tech stack:** TypeScript, Vue 3, vitest (node environment). Every command runs through `chemx` from `apps/zombie-survival`.

**Spec:** [2026-11-11-level-100-progression-design.md](2026-11-11-level-100-progression-design.md). Read it with this plan.

## Global constraints

- XP and score stay 1:1. No task adds a second number.
- `kill points = round(z.points × town × kill chain × night event / 10)`: multiply first, divide once. `ZOMBIES` and `BOSSES` point values do not change.
- Headshot bonus is `1 × town` for every type, paid once per zombie on the killing shot; the headshot chain does not multiply points; night events do not touch it.
- `MAX_CHARACTER_LEVEL = 100`; `xpRequiredForLevel(L) = round(40 × L^1.5)`; 1 AP per level.
- Upkeep: one pip lost per full 7 days since the last level-up; the level never drops; each lost pip is owed and a level-up repays 1 owed AP.
- Level 100: no decay, every survivor maxed, computed from the level at read time.
- No mock data, no git worktrees, branches or stash. Claim the chemx task and lock each file before editing; commit small and green; `chemx verify` is the gate.
- Slice order: A is independent. B1 to B9 run in order (they share `shared/progression.ts` and `src/game/snapshot-handler.ts`). C ships in the same release as A, and only after Xopher answers the question below.

## Waiting on Xopher (slice C only)

1. Section 6 of the spec: start the record books again with old entries hidden (planned here), or show old entries under a "Before level 100" heading.
2. A point the spec did not cover: the daily log's streak is derived from which days exist in the log. The draft of C4 and C5 keeps old days (so streaks and the streak kit survive) with their scores zeroed. If the plain "hidden" option is meant strictly, carried days print `{ stamp: 'counted', score: '-', detail: '' }` and still count toward the streak. Wiping the days would reset every streak.

## Review focus

Each line has its test in the Corrections section below, assigned to the task that owns the code.

1. A kill or headshot in the bunker (sim level 0) pays 0 if the code reads `sim.level` and not `townOf`. Expected: it pays by the furthest town reached.
2. A piercing round that kills with a head hit loses its bonus if the payout runs after the bullet's head target is cleared. Expected: the bonus is paid.
3. A shotgun blast to the head pays the bonus once, not once per pellet.
4. A level-up that repays owed AP into a nearly full stat: the AP that does not fit stays banked, and the on-screen text does not overstate it.
5. A week boundary that passes during a run: the kill hook must not remove pips.

## Corrections from review (these override the task text below)

Two reviewers checked the drafts against the spec and against the code at 5960b86. Every expected number in the drafted tests was recomputed and is correct except where noted. Apply these while doing the named task.

**Line numbers.** Commit bee518f shifted `src/game/snapshot-handler.ts` by +2 and `src/game/run-session.ts` by −1 from the numbers in the tasks. Anchor on text, not numbers: `isLocalScoreGain`, `gain.levelsGained`, `nextRequirement`, `markTestDrive`, `beginRun`. In `src/engine/fx-director.ts` the `onHeadshot` text runs 332-339.

**Slice A**

- **A2.** Add the bunker test to `tests/kill-points.spec.ts`:
  ```ts
  const { state } = quietSim(['a']);
  state.level = BUNKER_LEVEL;
  state.homeRun = { ...newHomeRun(1), roomHighest: 4 };
  const [a] = state.players;
  damageZombie(state, addZombie(state, 'walker', a.x + 200, a.y), 1e6, 0, 'a');
  expect(a.score).toBe(4);
  ```
  Retitle `tests/kill-chain.spec.ts:51` ("scores a second quick kill at a quarter more"): the second town-1 walker now pays the same 1.
- **A3.** quietSim's map seed is 4242, which draws a blood moon in towns 3 and 5. The "pays the town once" test must pick a seed with no event, as A2's town-5 test does (town 5: 1013904226), or keep asserting against `death.points`. Add to the brute test: `expect(eventsOf(snap, 'headshot').map((e) => e.chain)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);`. Add three tests to `tests/headshots.spec.ts`:
  ```ts
  // bunker: one-shot head kill as in 'pays the town once'
  state.level = BUNKER_LEVEL; state.homeRun = { ...newHomeRun(1), roomHighest: 4 };
  expect(hs.points).toBe(4);
  ```
  ```ts
  // a piercing round keeps the bonus
  const { sim, state } = quietSim(); state.level = 2;
  const p = state.players[0];
  const z = target(state, 'walker'); z.health = z.maxHealth = ZOMBIES.walker.health;
  sim.snapshot();
  state.bullets.push({ id: 'b', shooterId: 'a', x: p.x, y: p.y, vx: 520, vy: 0, damage: WEAPONS.pistol.damage, rangeLeft: 300, headTarget: z, effect: 'piercing' });
  steps(sim, 3);
  const snap = sim.snapshot();
  expect(eventsOf(snap, 'headshot').map((e) => e.points)).toEqual([2]);
  expect(p.score).toBe(2 + eventsOf(snap, 'zombie_die')[0].points);
  ```
  ```ts
  // a shotgun blast pays once
  const { sim, state } = quietSim(); state.level = 2;
  const p = state.players[0];
  p.guns.shotgun = { ammo: 6, fit: { ranks: {}, quirk: null } }; p.weapon = 'shotgun';
  const z = target(state, 'walker'); z.health = z.maxHealth = 1;
  const head = headSpot(z); shootAt(sim, p, head.x, head.y);
  const snap = sim.snapshot();
  expect(eventsOf(snap, 'zombie_die')).toHaveLength(1);
  expect(eventsOf(snap, 'headshot').reduce((s, e) => s + e.points, 0)).toBe(2);
  ```
- **A4.** The HEADSHOT text keeps its streak suffix; the spec says the callout stays. `headshotNote` returns `` `HEADSHOT${points > 0 ? ` +${points} XP` : ''}${(chain ?? 1) > 1 ? ` x${chain}` : ''}` ``. Tests: `expect(headshotNote(head(0, 4))).toBe('HEADSHOT x4'); expect(headshotNote(head(3, 1))).toBe('HEADSHOT +3 XP');`. This replaces the "drops its xN suffix" decision in slice A.
- **A5.** Also edit `docs/README.md` at the blood moon line (the headshot bonus is not doubled) and the screamer line ("worth 30" becomes worth 3 times the town), and check `docs/community.md:198,225`.

**Slice B**

- **B1 step 2.** `-t "round(40"` is an invalid regular expression. Use `-t "prices level L"`.
- **B3.** `isTestDrive(world.worldMap)` only holds in the first town: the client marks the map once in `onWelcome`, and `RunStage` builds a fresh unmarked map on every town change (`src/game/run-stage.ts:43`, `src/game/client-world.ts:117-121`). Keep a run-level flag set from `packet.testDrive` and have the XP hook read that. Add a test that a kill after a town change in a Test Drive still grants no XP.
- **B4.** Migrate only when `saved.version === undefined`. Any other value is parsed as a v2 save and written back as `version: 2`. `tests/progression.spec.ts` has no `describe('Saves')`; create it.
- **B5.** The stated failure for "three weeks idle" on today's code is `ap` 9 and `level` 9, not `ap` 5. `newlyRustySkins` lists each skin once, in first-loss order; add a test: 4 weeks idle, 0 banked, skin 0 holding the 4 highest pips gives `[0]`.
- **B6.** Use `gain.apEarned` in three places in `src/game/snapshot-handler.ts`: the `allocateEarnedAp` call, the `+N AP` text and the `LEVEL UP: +1 …` callout. Add to `tests/client-flow.spec.ts`:
  ```ts
  const store = memoryStorage();
  const start = createInitialProgression(Date.now());
  store.setItem(PROGRESSION_STORAGE_KEY, JSON.stringify({ ...start, owedAp: 1, allocations: { ...start.allocations, 0: { spentAp: { stealth: 0, reload: 4, speed: 5, strength: 5, search: 5 } } } }));
  vi.stubGlobal('localStorage', store);
  const socket = joinRoom();
  socket.receive(frame(50, { events: [kill(113)] }));
  expect(savedProgression(store)).toMatchObject({ level: 2, ap: 1, owedAp: 0 });
  expect(savedProgression(store)!.allocations[0].spentAp.reload).toBe(5);
  ```
- **B7.** `characterLevel` returns `1 + TOTAL_PIPS_TO_FILL` when `current.level >= MAX_CHARACTER_LEVEL`; add `expect(characterLevel(3, kept)).toBe(21);`. Otherwise the setup screen shows "OP" next to survivor level 1.
- **B8.** Also cover `src/components/DailyPage.vue:84`, which loads progression for the Daily Night survivor pick. Move the body of `PlaySetup.vue`'s `initialSetupProgression` into `src/game/setup-picks.ts` as `setupProgression(skin, store?, now?)`, which calls `checkApUpkeep(store, now).state` before spending banked AP; test that 2 idle weeks with 1 banked AP and 1 pip end with `owedAp: 2` and the pip gone. Add to `tests/client-flow.spec.ts`:
  ```ts
  const store = memoryStorage();
  store.setItem(PROGRESSION_STORAGE_KEY, JSON.stringify({ ...createInitialProgression(Date.now()), level: 3, ap: 1 }));
  vi.stubGlobal('localStorage', store);
  const socket = joinRoom();
  vi.setSystemTime(Date.now() + 8 * 24 * 60 * 60 * 1000);
  socket.receive(frame(50, { events: [kill(1)] }));
  expect(savedProgression(store)).toMatchObject({ level: 3, ap: 1, owedAp: 0, xp: 1 });
  ```
- **B9.** Run `chemx verify` as the last step; B9 changes three files after B8's verify.
- **B risks.** The "another session's uncommitted edits" risk is out of date: those hunks were committed in bd0a357, so whole-file staging of `snapshot-handler.ts` and `TitleScreen.vue` is safe. Still run `chemx status --as=@<you>` first.

**Slice C**

- C4 also edits `src/game/streak-reward.ts` and C5 edits `src/game/record-book.ts`; lock them with the files the spec lists.
- Leaving today out of the carry-over gives a player who already played the old-scale daily a second counted run on the day of the change. This is accepted unless Xopher says otherwise.
- `src/game/analytics/bands.ts` score bands stay as they are: full campaigns still land in the top bands, and town-1 runs fall to '1-999'.

**Docs commits.** A5, B3, B8, B9 and C6 all add to `docs/CHANGELOG.md`, and A5 and C6 both edit `docs/README.md`. Lock the file per commit, insert above the first `## [` line by text, and serialize.

---

## Slice A: points and headshots (spec sections 1, 2, 7)

### Decisions

Choices the spec leaves open:
- **`town` in a town** is `sim.level`. `createSimState` sets it to the start level (shared/sim-factory.ts:52,65) and `emptyWorld` sets it on every town change (shared/level-change.ts:32). Daily runs reach it through `startLevel` (src/network/local-session.ts:71,118). So a daily town 2 to 8 is that number.
- **`town` in the bunker.** There `sim.level` is `BUNKER_LEVEL = 0` (shared/home-protocol.ts:15), so `town = sim.level` would make every overrun kill pay 0. Decision: `townOf(sim) = sim.level === BUNKER_LEVEL ? (sim.homeRun?.roomHighest ?? FIRST_LEVEL) : sim.level`. This follows what the overrun breach already does, sizing its horde by `roomHighest` (shared/overrun.ts:126). `roomHighest` is never below 1 (shared/trip.ts:27, shared/trip-roster.ts:17).
- **Kill with no killer** (combat.ts:94 emits raw `z.points` today, for example 10 or 1500): it now emits the unchained payout, `killPoints(z.points, town, 1, event)`.
- **How the client learns "the chain changed the points".** `zombie_die` gains an optional `chainPaid?: boolean`, set by the sim. `chain` itself must stay the raw count, because src/game/stamps.ts:107 needs it for the Massacre stamp.
- **The HEADSHOT floating text keeps its `xN` streak suffix** and shows `+N XP` only when the hit paid. A 0-point head hit in a streak of four shows `HEADSHOT x4`. See the A4 correction above.
- **`HeadRule.score` is removed.** The bonus is `HEADSHOT_BONUS (1) × townOf(sim)` for every type. The damage multipliers stay: 2.5, and 1.5 for brutes.
- **"Dev: Test Drive grants no XP" (section 3) is not a sim or score concern. It stays with slice B.** XP is credited on the client at src/game/snapshot-handler.ts:197-202, which is slice 2's file. The test-drive flag lives in the client session (src/game/run-session.ts:128, 415-420). Zeroing score in the sim would also blank the HUD points.
- **src/game/snapshot-handler.ts needs no change in this slice.** Line 194 still counts every headshot event toward stealth. The `points > 0` guards at lines 197-198 already skip a 0-point headshot for XP.

---

### Task A1: Pure payout functions `killPoints` and `townOf`

**Files:**
- Create: `shared/kill-points.ts`
- Test (create): `tests/kill-points.spec.ts`

**Interfaces:**
- Consumes: `ZOMBIES` (shared/constants.ts:89-95), `BOSSES` (shared/bosses.ts:40-53), `chainMultiplier` (shared/kill-chain.ts:28), `BUNKER_LEVEL` (shared/home-protocol.ts:15), `FIRST_LEVEL` (shared/levels.ts:53), `newHomeRun(seed: number): HomeRun` (shared/trip.ts:26).
- Produces:
  - `export function killPoints(points: number, town: number, chain: number, event: number): number`, which is `Math.round((points * town * chain * event) / 10)`. Multiply first, divide once, and keep the 10 as a module-private constant.
  - `export function townOf(sim: Pick<SimState, 'level' | 'homeRun'>): number`, with the expression given above.

1. Write the failing tests in `tests/kill-points.spec.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { BOSSES } from '../shared/bosses.ts';
import { ZOMBIES } from '../shared/constants.ts';
import { BUNKER_LEVEL } from '../shared/home-protocol.ts';
import { chainMultiplier } from '../shared/kill-chain.ts';
import { killPoints, townOf } from '../shared/kill-points.ts';
import type { ZombieType } from '../shared/protocol.ts';
import { newHomeRun } from '../shared/trip.ts';

const TOWNS = [1, 2, 5, 10];
describe('kill points', () => {
  it.each<[ZombieType, number[]]>([
    ['walker', [1, 2, 5, 10]], ['runner', [2, 3, 8, 15]], ['bloater', [3, 5, 13, 25]],
    ['screamer', [3, 6, 15, 30]], ['brute', [12, 24, 60, 120]],
  ])('pay a %s a tenth of its worth times the town', (type, row) => {
    expect(TOWNS.map((town) => killPoints(ZOMBIES[type].points, town, 1, 1))).toEqual(row);
  });
  it('pay bosses 150, 250 and 400 times the town', () => {
    expect([BOSSES.howler, BOSSES.mother, BOSSES.butcher].map((b) => killPoints(b.points, 2, 1, 1))).toEqual([300, 500, 800]);
  });
  it('still chain on a 1-point walker', () => {
    expect([1, 2, 3, 4, 5].map((n) => killPoints(ZOMBIES.walker.points, 1, chainMultiplier(n), 1))).toEqual([1, 1, 2, 2, 2]);
  });
  it('double under a blood moon', () => {
    expect(killPoints(ZOMBIES.walker.points, 3, 1, 2)).toBe(6);
  });
});
describe('townOf', () => {
  it('is the level in a town and the furthest town reached in the bunker', () => {
    expect(townOf({ level: 7, homeRun: null })).toBe(7);
    expect(townOf({ level: BUNKER_LEVEL, homeRun: { ...newHomeRun(1), roomHighest: 4 } })).toBe(4);
    expect(townOf({ level: BUNKER_LEVEL, homeRun: null })).toBe(1);
  });
});
```
2. Run `chemx test tests/kill-points.spec.ts`. It should fail because the module `../shared/kill-points.ts` cannot be resolved.
3. Implement the two exports in `shared/kill-points.ts`. Use `import type { SimState }` and import `BUNKER_LEVEL` and `FIRST_LEVEL`.
4. Run `chemx test tests/kill-points.spec.ts`. It should pass.
5. Existing assertions broken: none, since this task adds new code only.
6. Commit `shared/kill-points.ts` and `tests/kill-points.spec.ts` with the message `feat(points): killPoints and townOf pay a tenth times the town (#7517)`.

### Task A2: Kills pay by the town, and `zombie_die` says when the chain paid

**Files:**
- Modify: `shared/combat.ts:19-22` (imports) and `shared/combat.ts:75-96` (`killZombie` payout and emit)
- Modify: `shared/protocol.ts:270` (add `readonly chainPaid?: boolean` to the `zombie_die` member)
- Test: `tests/kill-chain.spec.ts:50-65`, `tests/night-events.spec.ts:47-60`, `tests/zombies.spec.ts:450-462`, `tests/zombie-status.spec.ts:104-116`, `tests/bosses.spec.ts:81-94`

**Interfaces:**
- Consumes: `killPoints` and `townOf` from A1, `chainKill` and `chainMultiplier` (shared/kill-chain.ts), `eventOf` (shared/night-events.ts:55).
- Produces: the `zombie_die` event `{ ..., points, chain, chainPaid?: boolean }`. `chainPaid` is true exactly when `points !== killPoints(z.points, town, 1, event)`, and false when there is no killer.

1. Write the failing test in `tests/kill-chain.spec.ts`, inside `describe('kill chains in the sim')`, using that file's existing dynamic-import style (`damageZombie`, `addZombie`, `quietSim`):
```ts
it('flags the chain on the event only when it changed the points', async () => {
  // quietSim(['a']), three walkers at a.x + 200/220/240, each damageZombie(state, z, 1e6, 0, 'a')
  const deaths = state.events.filter((e) => e.type === 'zombie_die');
  expect(deaths.map((e) => e.type === 'zombie_die' && e.points)).toEqual([1, 1, 2]);
  expect(deaths.map((e) => e.type === 'zombie_die' && e.chainPaid)).toEqual([false, false, true]);
});
```
   Then add to `tests/kill-points.spec.ts` a sim test, `it('pay a brute in town 5 sixty in the sim')`:
```ts
const { state } = quietSim(['a']);
const seed = Array.from({ length: 2000 }, (_, i) => Math.imul(i + 1, 0x9e3779b1) >>> 0).find((s) => nightEventFor(s, 5) === null)!;
state.level = 5;
state.map = { ...state.map, seed };
const [a] = state.players;
const z = addZombie(state, 'brute', a.x + 200, a.y);
damageZombie(state, z, 1e6, 0, 'a');
expect(a.score).toBe(60);
```
   Its imports are `quietSim` and `addZombie` from `./helpers/sim-harness.ts`, `damageZombie` from `../shared/combat.ts`, and `nightEventFor` from `../shared/night-events.ts`.
2. Run `chemx test tests/kill-chain.spec.ts -t "flags the chain"`. It should fail with points `[10, 12, 15]` against `[1, 1, 2]`. Then run `chemx test tests/kill-points.spec.ts -t "sixty"`. It should fail with 120 against 60.
3. Implement in `killZombie` (shared/combat.ts:75-96): `town = townOf(sim)` and `event = eventOf(sim)?.points ?? 1`. Then `points = killPoints(z.points, town, chainMultiplier(chain), event)` and `base = killPoints(z.points, town, 1, event)`. Emit `points: killer ? points : base` and `chainPaid: killer !== undefined && points !== base`. Replace the line-75 comment ("rounded down") with one about rounding to the nearest. Add `readonly chainPaid?: boolean` at shared/protocol.ts:270.
4. Run `chemx test tests/kill-chain.spec.ts tests/kill-points.spec.ts`. It should pass.
5. Existing assertions this breaks. Update them in this task:
   - tests/kill-chain.spec.ts:61: `first.points + Math.floor(second.points * 1.25)` (22) becomes `2`.
   - tests/night-events.spec.ts:59: `zombie.points * 2` (20) becomes `6` (walker, town 3, blood moon).
   - tests/zombies.spec.ts:457: `ZOMBIES.runner.points` (15) becomes `2`.
   - tests/zombies.spec.ts:461: `death.points` `ZOMBIES.runner.points` (15) becomes `2`.
   - tests/zombie-status.spec.ts:114: `ZOMBIES.walker.points` (10) becomes `1`.
   - tests/bosses.spec.ts:91: `toBeGreaterThanOrEqual(BOSSES.howler.points)` (1500) becomes `toBeGreaterThanOrEqual((BOSSES.howler.points * 3) / 10)` (450).
   - No other test asserts kill points. The `points:` literals in analytics-tracker, audio-engine, audio-sfx, kill-juice, quest-tally, stamps and home-link-tally specs are hand-built event fixtures and stay valid. The `.score =` lines in the server, reconnect, trip-loop, level-endings, level-run and lifecycle specs set score directly.
6. Run `chemx test`, then commit `shared/combat.ts`, `shared/protocol.ts` and the six spec files with the message `feat(points): a kill pays its worth over ten times the town, rounded (#7517)`.

### Task A3: The headshot bonus is +1 × town, paid once, on the killing shot

**Files:**
- Modify: `shared/headshots.ts:3` (drop the `headshotChainMultiplier` import), `shared/headshots.ts:8-30` (remove `score` from `HeadRule`, `FULL_BONUS` and the brute row), `shared/headshots.ts:99-111` (replace `headshotMultiplier`)
- Modify: `shared/combat.ts:22` (import) and `shared/combat.ts:212-223` (`strike`)
- Test: `tests/headshots.spec.ts:51-60` and `tests/headshots.spec.ts:79-86`, plus new tests in the same `describe('headshots')`

**Interfaces:**
- Consumes: `townOf` from A1, `chainHeadshot` (shared/kill-chain.ts:49), `emit`.
- Produces, replacing `headshotMultiplier`:
  - `export const HEADSHOT_BONUS = 1;`
  - `export function headshotDamage(b: BulletState, z: ZombieState): number` returns `HEADS[z.type].damage` when `b.headTarget === z`, and 1 otherwise. It is pure and has no side effects.
  - `export function payHeadshot(sim: SimState, b: BulletState, z: ZombieState, angle: number): void`. If `b.headTarget !== z` it returns. Otherwise it counts `chainHeadshot`. Points are `HEADSHOT_BONUS * townOf(sim)` when `z.health <= 0`, and 0 otherwise. It adds the points to the shooter's score and emits `headshot` with `points` and `chain` as before.
  - In `strike`, the order is: `damage = b.damage * headshotDamage(b, z)`, then `damageZombie(...)`, then `payHeadshot(sim, b, z, angle)` immediately after it. `payHeadshot` must come before `passThrough` (combat.ts:221), which nulls `b.headTarget` at combat.ts:206-207.

1. Write the failing tests in tests/headshots.spec.ts. They reuse `quietSim`, `target`, `shootAt`, `headSpot`, `eventsOf` and `dealt`, and add `ZOMBIES` to the `../shared/constants.ts` import and `nightEventFor` from `../shared/night-events.ts`.
   - Rewrite lines 51-60 as `it('multiplies the damage of a shot at the head and pays nothing while it stands')`. Keep `expect(dealt(z)).toBeCloseTo(WEAPONS.pistol.damage * 2.5)`. Set `expect(state.players[0].score).toBe(0)` and `toMatchObject({ playerId: 'a', zombieId: z.id, zombieType: 'walker', points: 0 })`.
   - Rewrite lines 79-86 as `it('multiplies a brute head by 1.5 and pays nothing while it stands')`. Keep the `dealt` assertion of `WEAPONS.pistol.damage * 1.5` and set `expect(state.players[0].score).toBe(0)`.
   - Add `it('pays the town once for the head shot that kills')`:
```ts
const { sim, state } = quietSim();
state.level = 3;
const z = target(state, 'walker');
z.health = z.maxHealth = ZOMBIES.walker.health;
const head = headSpot(z);
shootAt(sim, state.players[0], head.x, head.y);
const snap = sim.snapshot();
const [hs] = eventsOf(snap, 'headshot');
const [death] = eventsOf(snap, 'zombie_die');
expect(hs.points).toBe(3);
expect(state.players[0].score).toBe(3 + death.points);
```
   - Add `it('leaves the headshot bonus out of a blood moon')`. It follows the previous test, but first sets `state.map = { ...state.map, seed }` with `seed = Array.from({ length: 2000 }, (_, i) => Math.imul(i + 1, 0x9e3779b1) >>> 0).find((s) => nightEventFor(s, 3)?.id === 'blood_moon')!`. It expects `hs.points` to be `3`, `death.points` to be `6` and the score to be `9`.
   - Add `it('pays a brute killed after ten head hits the bonus once')`:
```ts
const { sim, state } = quietSim();
const z = target(state, 'brute');
z.health = z.maxHealth = WEAPONS.pistol.damage * 1.5 * 9.5;
for (let i = 0; i < 10; i++) { const head = headSpot(z); shootAt(sim, state.players[0], head.x, head.y); }
const snap = sim.snapshot();
expect(z.health).toBe(0);
expect(eventsOf(snap, 'headshot').map((e) => e.points)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
expect(state.players[0].score).toBe(1 + 12);
```
   Ammo is enough: a new player's pistol holds 12 (shared/loadout.ts:114), and the fire interval of 270 ms is under `shootAt`'s 13 ticks.
2. Run `chemx test tests/headshots.spec.ts -t "head"`. It should fail: score 5 against 0, event points 5 against 0, `hs.points` 5 against 3, and the brute's points array is `[2, 3, 4, 5, 6, 6, ...]` instead of zeros.
3. Implement the three exports above in shared/headshots.ts and the new `strike` order in shared/combat.ts. `FULL_BONUS` becomes `{ damage: 2.5 }` and the brute row becomes `damage: 1.5` with no `score`.
4. Run `chemx test tests/headshots.spec.ts tests/zombie-status.spec.ts tests/kill-chain.spec.ts`. They should pass.
5. Existing assertions this breaks: tests/headshots.spec.ts:57 (5 becomes 0), :59 (`points: 5` becomes `points: 0`) and :85 (2 becomes 0), all rewritten in step 1. tests/zombie-status.spec.ts:331-341 still passes, because a 51-damage hit on a 520-health brute still emits one headshot event. Its title, "lets a headshot pay as ever", becomes inaccurate; rename it to "lets a headshot land as ever". tests/kill-chain.spec.ts:33 still needs the `headshotChainMultiplier` export, so keep it in shared/kill-chain.ts.
6. Commit `shared/headshots.ts`, `shared/combat.ts`, `tests/headshots.spec.ts` and `tests/zombie-status.spec.ts` with the message `feat(points): a headshot pays one times the town, once, on the killing shot (#7517)`.

### Task A4: The floating text shows the chain only when it paid

**Files:**
- Create: `src/engine/score-notes.ts`. fx-director.ts is already 508 lines, over the 500-line bound, so the text goes in its own module.
- Modify: `src/engine/fx-director.ts:3` (import), `src/engine/fx-director.ts:332-337` (`onHeadshot` text) and `src/engine/fx-director.ts:351-354` (`onZombieDie` text)
- Test (create): `tests/score-notes.spec.ts`

**Interfaces:**
- Consumes: `chainMultiplier` (shared/kill-chain.ts:28), `GameEvent` (shared/protocol.ts), and `chainPaid` from A2.
- Produces:
  - `export function killNote(event: Extract<GameEvent, { type: 'zombie_die' }>): string`: `+${points} XP`, followed by `` ` x${chainMultiplier(chain ?? 1)}` `` only when `event.chainPaid`.
  - `export function headshotNote(event: Extract<GameEvent, { type: 'headshot' }>): string`: `'HEADSHOT'` when `points === 0`, and `HEADSHOT +${points} XP` otherwise, with no chain suffix.

1. Write the failing tests in `tests/score-notes.spec.ts`:
```ts
const die = (points: number, chain: number, chainPaid?: boolean) => ({ type: 'zombie_die', zombieId: 'z', zombieType: 'walker', x: 0, y: 0, angle: 0, killerId: 'me', points, chain, ...(chainPaid === undefined ? {} : { chainPaid }) }) as const;
const head = (points: number, chain: number) => ({ type: 'headshot', playerId: 'me', zombieId: 'z', zombieType: 'walker', x: 0, y: 0, angle: 0, points, chain }) as const;
it('names the chain only when it changed the points', () => {
  expect(killNote(die(2, 3, true))).toBe('+2 XP x1.5');
  expect(killNote(die(1, 2, false))).toBe('+1 XP');
  expect(killNote(die(12, 1))).toBe('+12 XP');
});
it('calls a head hit that does not kill with no number, and a killing one with its bonus', () => {
  expect(headshotNote(head(0, 4))).toBe('HEADSHOT');
  expect(headshotNote(head(3, 4))).toBe('HEADSHOT +3 XP');
});
```
2. Run `chemx test tests/score-notes.spec.ts`. It should fail because `../src/engine/score-notes.ts` cannot be resolved.
3. Implement both functions. In fx-director.ts, `onHeadshot` calls `this.particles.addText(headshotNote(event), x, y - HEADSHOT_NOTE_GAP, hitPalette().strike)` and `onZombieDie` calls `this.particles.addText(killNote(event), x, y - 16, SCORE_COLOR)`. Drop the `chainMultiplier` and `headshotChainMultiplier` import at line 3. Keep the `isLocalScore` guard at line 349.
4. Run `chemx test tests/score-notes.spec.ts`, then `chemx typecheck`. Both should pass.
5. Existing assertions broken: none. No test drives the fx-director text (searched tests for " XP" and FxDirector).
6. Commit `src/engine/score-notes.ts`, `src/engine/fx-director.ts` and `tests/score-notes.spec.ts` with the message `feat(points): the XP floater names the chain only when it paid (#7517)`.

### Task A5: Living docs for scoring

**Files:**
- Modify: `docs/README.md:26`. The kill chains line says "rounded down". It becomes the round of points × town × chain × event / 10, with the bunker paying at `roomHighest`, and it gains `chainPaid` on `zombie_die`. Add a headshot sentence: +1 × town on the killing shot only, `points: 0` on other head hits, the chain no longer multiplying, and night events never touching the bonus.
- Modify: `docs/CHANGELOG.md:5`. Add a new top entry, `## [2026-11-11] - Town-scaled points and once-per-kill headshots`, with a Changed list matching sections 1, 2 and 7.

1. There is no test to write; this task is docs only.
2. Run `chemx verify`. It should be green, as after A1-A4.
3. Edit the two docs.
4. Run `chemx verify` again. It should pass.
5. Existing assertions broken: none.
6. Commit `docs/README.md` and `docs/CHANGELOG.md` with the message `docs(points): scoring by town and headshots on the kill (#7517)`.

---

### Risks seen in the code
- **The headshot event fires before the damage lands.** shared/combat.ts:213 calls `headshotMultiplier` before `damageZombie` at :215, so today's code cannot know whether the hit kills. `payHeadshot` has to run after `damageZombie` and before `passThrough` (:221), because `passThrough` clears `b.headTarget` at :206-207. If it runs after, every pierced kill loses its bonus. The headshot event now comes after `zombie_hit` and `zombie_die` in the event list. No consumer depends on that order: kill-juice takes the max freeze, and stamps, quest-tally and run-tracker count.
- **The bunker is level 0** (shared/home-protocol.ts:15). Using `sim.level` straight would make every overrun kill pay `round(0) = 0`, and with it 0 XP.
- **No-killer kills emit raw points.** shared/combat.ts:94 sends raw `z.points` when there is no killer (10 for a walker, 1500 for a boss). Left alone, those events would carry old-scale numbers.
- **The night event cache can surprise tests.** `eventOf` caches per `(map.seed, level)` (shared/night-events.ts:52-58). A test that only sets `state.level = 3` on quietSim's level-1 map can draw a fog or blood moon from that seed. The A3 town-3 test therefore asserts against `death.points`, and the A2 town-5 test picks a seed with no event.
- **`chain` cannot be repurposed.** It must stay the raw count, because the Massacre stamp reads `e.chain >= CHAIN_FOR_STAMP` (src/game/stamps.ts:107). That is why `chainPaid` is a separate field.
- **`headshotChainMultiplier` is left with no runtime caller** after A3 and A4, only tests/kill-chain.spec.ts:33. Keep the export. The package lint is plain `eslint .` with no unused-export checker, so nothing flags it.
- **fx-director.ts is already over the size bound** at 508 lines (500 is the outer limit). That is why A4 puts the note text in a new module instead of adding to it.

---

## Slice B: curve, cap, AP upkeep and saves (spec sections 3, 4, 5, 7)

### Decisions

- **State shape** (`shared/progression.ts:24-32`). Add `export const PROGRESSION_VERSION = 2;`.
  ```ts
  export interface ProgressionState {
    readonly version: typeof PROGRESSION_VERSION; // 2
    readonly level: number;
    readonly xp: number;
    readonly ap: number;
    readonly owedAp: number;
    readonly gp: number;
    readonly allocations: Record<number, CharacterAllocation>;
    readonly lastApEarnedAt: number;
    readonly rustySkins: readonly number[];
  }
  ```
- **Pip-removal helper:** `export function loseOnePip(current: ProgressionState): ProgressionState`.
  - It removes banked AP first. If none is banked, it takes the survivor with the highest `spentAp` sum (lowest skin on a tie), and on that survivor the stat with the highest `spentAp` (`STATS` order on a tie). It then marks that skin Rusty.
  - It adds 1 to `owedAp`.
  - It returns `current` itself (the same reference) when there is nothing to lose.
- **Load split into two names:**
  - `loadProgression(store = browserStorage(), now = Date.now()): ProgressionState` is a pure parse. It migrates old saves, clamps the clock, never decays and never writes.
  - `checkApUpkeep(store = browserStorage(), now = Date.now()): ApDecayResult` loads, runs `applyApDecay(state, now)`, and always saves `result.state`. Always saving is what writes a migrated save exactly once.
  - `applyApDecay(current, now)` stays pure. `ApDecayResult` keeps its shape `{ state, decayedAp, newlyRustySkins }`.
- **Level 100 in `effectiveStatSlots`:** the new signature is `effectiveStatSlots(skin: number, allocation: CharacterAllocation | undefined, level: number): Record<StatKey, number>`. It returns 5 for every stat when `level >= MAX_CHARACTER_LEVEL`, and otherwise the stored pips.
  - The current body moves to a private `investedStatSlots(skin, allocation)`.
  - Call sites that must pass the level:
    - `shared/progression.ts:417` (`isCharacterMaxed` passes `current.level`)
    - `src/components/CharacterSheet.vue:170` (passes `props.progression.level`)
    - `src/game/character-select-view.ts:20` (passes `progression.level`)
    - `tests/progression.spec.ts:91` (passes `allocated.level`)
  - The internal callers at `shared/progression.ts:321` (`pickWinningStat`) and `:354` (`allocateEarnedAp`) switch to `investedStatSlots`, so the AP a level-up earns still lands in stored pips.
- **Choices the spec left open:**
  - XP at the cap is set to 0, not kept as leftover.
  - The decay timer moves forward by whole weeks (`lastApEarnedAt + weeks × 7d`) even when nothing is left to lose, so a second check at the same time does nothing.
  - At level 100, `isCharacterRusty` returns false.
  - Migration keeps `gp` and `rustySkins`.
  - `AP_DECAY_INACTIVITY_MS` is deleted, leaving `AP_DECAY_INTERVAL_MS` as the only week constant.
  - The XP hook finds a Test Drive from a run-level flag set from `WelcomePacket.testDrive` in `onWelcome` (`src/game/run-session.ts`, next to `markTestDrive`). The map mark alone is lost on every town change. See the B3 correction above.
  - The run-start check goes in `RunSession.beginRun` (`src/game/run-session.ts:364`). That method runs on every welcome and every restart.
  - The CharacterSheet shows `MAX LEVEL` in place of "x / y XP" at the cap.
- **Section 7, second bullet:** no "of 21" copy exists in `src/` (I searched `of 21`, `evel 21` and `\b21\b`). `LevelCard.vue` is the town card and shows no character level. The character level appears at `CharacterSheet.vue:14` and `overlay-renderer.ts:328`, both as a bare number. The CharacterSheet XP bar (`:142-148`) is the only one that ignores the cap. The overlay (`:214`) and the kill hook (`:205`) already read `MAX_CHARACTER_LEVEL`.

Every command runs from `/home/xopher/www/x/Xophz-COMPASS/apps/zombie-survival`.

---

### Task B1: Level cap 100 on the round(40 × L^1.5) curve
**Files:**
- Modify `shared/progression.ts:5` (`MAX_CHARACTER_LEVEL`).
- Modify `shared/progression.ts:203-207` (`xpRequiredForLevel`).
- Modify `shared/progression.ts:428-434` (`characterLevel` clamp).
- Test `tests/progression.spec.ts` (import list at :4-26; tests at :57-186 and :188-243).

**Interfaces:** Produces `MAX_CHARACTER_LEVEL = 100` and `xpRequiredForLevel(L) = L <= 1 ? 0 : Math.round(40 * L ** 1.5)`. `totalXpForLevel` keeps its signature. `characterLevel` clamps to `1 + TOTAL_PIPS_TO_FILL` (21).

1. Write the failing tests. Add `totalXpForLevel` to the import list, then add this inside `describe('Progression Core Logic')`:
   ```ts
   it('prices level L at round(40 × L^1.5) up to a cap of 100', () => {
     expect(MAX_CHARACTER_LEVEL).toBe(100);
     expect(xpRequiredForLevel(2)).toBe(113);
     expect(xpRequiredForLevel(100)).toBe(40_000);
     expect(totalXpForLevel(10)).toBe(5_667);
     expect(totalXpForLevel(21)).toBe(34_242);
     expect(totalXpForLevel(50)).toBe(289_910);
     expect(totalXpForLevel(100)).toBe(1_620_015);
   });
   it('caps a survivor level at 21 even when a save fills the specialty stat', () => {
     const start = createInitialProgression();
     const overfull = { ...start, allocations: { ...start.allocations, 0: { spentAp: { stealth: 5, reload: 5, speed: 5, strength: 5, search: 5 } } } };
     expect(characterLevel(0, overfull)).toBe(21);
   });
   ```
2. Run `chemx test tests/progression.spec.ts -t "prices level L"`. The first test should fail with 21 not equal to 100. The second passes for now and fails once the cap moves; it guards the clamp.
3. Implement. Set `MAX_CHARACTER_LEVEL = 100` and change the formula in `xpRequiredForLevel`. In `characterLevel` (`:433`), change the clamp to `Math.min(1 + TOTAL_PIPS_TO_FILL, 1 + invested)`. The load clamp at `:85` picks up 100 on its own.
4. Run `chemx test tests/progression.spec.ts`. Everything should pass.
5. Existing assertions this breaks, to fix in the same task. All are in `tests/progression.spec.ts`:
   - :57: test name "up to Level 21" becomes "up to Level 100".
   - :60: `toBe(100)` becomes `toBe(113)`.
   - :67: `toBe(50)` becomes `toBe(37)`.
   - :71: `addExperience(start, 999999)` becomes `addExperience(start, totalXpForLevel(MAX_CHARACTER_LEVEL))`.
   - :70: the comment becomes "caps at Level 100 with 99 AP".
   - :73: `toBe(21)` becomes `toBe(100)`.
   - :74: `toBe(20)` becomes `toBe(99)`.
   - :79: `addExperience(base, 100)` becomes `addExperience(base, 113)`.
   - :104: `addExperience(state, 999999)` becomes `addExperience(state, totalXpForLevel(21))`. This keeps :105 `ap 20`, :112 and :114 `21`.
   - :123: `addExperience(state, 300)` becomes `addExperience(state, 321)`, so :125 `>= 2` holds.
   - :169: `toBe(100)` becomes `toBe(113)`.
   - :171: `addExperience(start, 50)` becomes `addExperience(start, 56)`. That gives 56/113, which still passes `toBeCloseTo(0.5, 2)`.
   - :176: `addExperience(half.state, 50)` becomes `addExperience(half.state, 57)`.
   - :184: `toBe(115)` becomes `toBe(208)`.
   - :192 and :205: `700` becomes `1676`. That is `totalXpForLevel(6)`, so :193 and :198 keep `5` and :209 keeps `2`.
   - :233: `300` becomes `321`, so :234 keeps `2`.
6. Commit `shared/progression.ts` and `tests/progression.spec.ts` with the message `feat(progression): level cap 100 on a round(40 × L^1.5) XP curve (#7517)`.

### Task B2: XP stops at level 100
**Files:** Modify `shared/progression.ts:224-257` (`addExperience`). Test `tests/progression.spec.ts`.

**Interfaces:** Consumes B1. Produces: `addExperience` returns `state.xp === 0` whenever `state.level >= MAX_CHARACTER_LEVEL`.

1. Write the failing test:
   ```ts
   it('stops XP at level 100', () => {
     const capped = addExperience(createInitialProgression(), totalXpForLevel(MAX_CHARACTER_LEVEL) + 5_000);
     expect(capped.newLevel).toBe(100);
     expect(capped.state.xp).toBe(0);
     const after = addExperience(capped.state, 500);
     expect(after.didLevelUp).toBe(false);
     expect(after.state.level).toBe(100);
     expect(after.state.xp).toBe(0);
   });
   ```
2. Run `chemx test tests/progression.spec.ts -t "stops XP at level 100"`. It should fail with 5000 not equal to 0.
3. Implement. After the level loop in `addExperience`, set `xp = 0` when `level >= MAX_CHARACTER_LEVEL`.
4. Run `chemx test tests/progression.spec.ts`. It should pass.
5. No existing assertions break.
6. Commit `shared/progression.ts` and `tests/progression.spec.ts` with the message `feat(progression): XP stops accumulating at level 100 (#7517)`.

### Task B3: A Dev: Test Drive run grants no XP
**Files:**
- Modify `src/game/snapshot-handler.ts:197-200` (the `isLocalScoreGain` guard) and its imports at :1-31.
- Test `tests/client-flow.spec.ts`: imports :1-9, `joinRoom` :113-120, new tests after :420.
- Modify `docs/CHANGELOG.md` (add a new top entry).

**Interfaces:** Consumes `isTestDrive(map: WorldMap): boolean` from `shared/vehicle-choice.ts:50` and `ClientWorld.worldMap` (`src/game/client-world.ts:105`).

1. Write the failing test.
   - Change `joinRoom()` to `joinRoom(welcome: object = {})`. Its welcome becomes `{ type: 'welcome', yourId: 'me', tickRate: 30, mapSeed: 4242, ...welcome }`.
   - Import `GameEvent` from `../shared/protocol.ts`, and `PROGRESSION_STORAGE_KEY` and `type ProgressionState` from `../shared/progression.ts`.
   - Add these helpers at module level:
   ```ts
   const kill = (points: number): GameEvent => ({ type: 'zombie_die', zombieId: 'z1', zombieType: 'walker', x: 500, y: 500, angle: 0, killerId: 'me', points });
   function savedProgression(store: ReturnType<typeof memoryStorage>): ProgressionState | null {
     const raw = store.getItem(PROGRESSION_STORAGE_KEY);
     return raw ? (JSON.parse(raw) as ProgressionState) : null;
   }
   ```
   - Add the tests:
   ```ts
   it('banks XP for a local kill', () => {
     const store = memoryStorage();
     vi.stubGlobal('localStorage', store);
     const socket = joinRoom();
     socket.receive(frame(50, { events: [kill(50)] }));
     expect(savedProgression(store)?.xp).toBe(50);
   });
   it('banks no XP on a Dev: Test Drive run', () => {
     const store = memoryStorage();
     vi.stubGlobal('localStorage', store);
     const socket = joinRoom({ testDrive: true });
     socket.receive(frame(50, { events: [kill(50)] }));
     expect(savedProgression(store)?.xp ?? 0).toBe(0);
   });
   ```
2. Run `chemx test tests/client-flow.spec.ts -t "banks no XP on a Dev: Test Drive run"`. It should fail with 50 not equal to 0.
3. Implement. Add a run-level test-drive flag set from `packet.testDrive` in `onWelcome`, and add `&& !<that flag>` to `isLocalScoreGain` (see the B3 correction above; do not use `isTestDrive(world.worldMap)`).
4. Run `chemx test tests/client-flow.spec.ts`. It should pass.
5. No existing assertions break. The `joinRoom` default argument leaves its current callers unchanged.
6. Docs: add a `docs/CHANGELOG.md` entry `## [2026-11-11] - Level 100 curve` with `### Changed` bullets:
   - The character level cap is 100.
   - Level L costs round(40 × L^1.5) XP (113 for level 2, 40,000 for level 100).
   - XP stops at 100.
   - Dev: Test Drive runs grant no XP.

   Commit `src/game/snapshot-handler.ts`, `tests/client-flow.spec.ts` and `docs/CHANGELOG.md` with the message `feat(progression): Dev: Test Drive runs grant no XP (#7517)`.

### Task B4: Version 2 saves with owedAp, one-time migration and the clock clamp
**Files:**
- Modify `shared/progression.ts:24-32` (interface), `:46-62` (`createInitialProgression`) and `:76-125` (`loadProgression`).
- Test `tests/progression.spec.ts`.

**Interfaces:** Produces `PROGRESSION_VERSION`, `ProgressionState.version` and `ProgressionState.owedAp` (shapes in Decisions), and `loadProgression(store: ProgressStorage | null = browserStorage(), now = Date.now()): ProgressionState`. In this task, load still calls `applyApDecay(baseState, now)` and saves when something decayed; B8 removes that.

1. Write the failing tests. Add `PROGRESSION_STORAGE_KEY` and `type ProgressionState` to the imports, then add module-level helpers:
   ```ts
   const DAY_MS = 24 * 60 * 60 * 1000;
   const NOW = 1_700_000_000_000;
   function storeWith(saved?: unknown) {
     const memory = new Map<string, string>();
     if (saved !== undefined) memory.set(PROGRESSION_STORAGE_KEY, JSON.stringify(saved));
     let writes = 0;
     return {
       getItem: (key: string) => memory.get(key) ?? null,
       setItem: (key: string, val: string) => { writes += 1; memory.set(key, val); },
       writes: () => writes,
     };
   }
   ```
   Then add the tests in `describe('Saves')`:
   ```ts
   it('migrates a version-less level-21 save: keeps level, AP and pips, zeroes xp and owed AP, starts a fresh timer', () => {
     const pips = { stealth: 0, reload: 5, speed: 5, strength: 5, search: 3 };
     const store = storeWith({ level: 21, xp: 3000, ap: 2, gp: 40, allocations: { 0: { spentAp: pips } }, lastApEarnedAt: NOW - 30 * DAY_MS, rustySkins: [] });
     const loaded = loadProgression(store, NOW);
     expect(loaded).toMatchObject({ version: 2, level: 21, xp: 0, ap: 2, gp: 40, owedAp: 0, lastApEarnedAt: NOW });
     expect(loaded.allocations[0].spentAp).toEqual(pips);
   });
   it('clamps a lastApEarnedAt later than now to now', () => {
     const store = storeWith({ ...createInitialProgression(NOW), lastApEarnedAt: NOW + 5 * DAY_MS });
     expect(loadProgression(store, NOW).lastApEarnedAt).toBe(NOW);
   });
   it('round-trips owedAp and the version', () => {
     const store = storeWith({ ...createInitialProgression(NOW), owedAp: 3 });
     expect(loadProgression(store, NOW)).toMatchObject({ version: 2, owedAp: 3 });
   });
   it('starts version 2 with nothing owed', () => {
     expect(createInitialProgression(NOW)).toMatchObject({ version: 2, owedAp: 0 });
   });
   ```
2. Run `chemx test tests/progression.spec.ts -t "Saves"`. These fail on `version` and `owedAp` being undefined, and on xp being 3000.
3. Implement:
   - Add the two fields to the interface and to `createInitialProgression`.
   - In `loadProgression`, treat `saved.version === undefined` as the one-time migration (any other value is parsed as a v2 save and written back as `version: 2`): `xp: 0`, `owedAp: 0`, `lastApEarnedAt: now`, keeping level, ap, gp, allocations and rustySkins.
   - For a v2 save, parse `owedAp` as `Math.max(0, Math.floor(n))` and set `lastApEarnedAt = Math.min(now, saved)`, falling back to `now`.
   - Replace the bare `createInitialProgression()` calls at :81, :84 and :123 with `createInitialProgression(now)`.
   - Pass `now` to `applyApDecay` at :117.
4. Run `chemx test tests/progression.spec.ts`, then `chemx typecheck`. Both should pass.
5. No existing assertions break. The test at :140-164 saves a state built from `createInitialProgression`, which now carries version 2.
6. Commit `shared/progression.ts` and `tests/progression.spec.ts` with the message `feat(progression): version 2 saves with owedAp, a one-time migration and a clock clamp (#7517)`.

### Task B5: Weekly upkeep loses one pip in the stated order, never a level
**Files:**
- Modify `shared/progression.ts:9` (delete `AP_DECAY_INACTIVITY_MS`) and `:138-193` (`applyApDecay`). Add `loseOnePip` next to `applyApDecay`.
- Test `tests/progression.spec.ts:188-243`.

**Interfaces:** Consumes B4's `owedAp`. Produces `loseOnePip(current: ProgressionState): ProgressionState` and `applyApDecay(current: ProgressionState, now = Date.now()): ApDecayResult`.
- At level 100, or under one full week, `applyApDecay` returns `{ state: current, decayedAp: 0, newlyRustySkins: [] }` with `current` itself as the state.
- Otherwise it calls `loseOnePip` once per full week and sets `lastApEarnedAt += weeks × AP_DECAY_INTERVAL_MS`. `newlyRustySkins` lists skins in the order they lost a pip.

1. Write the failing tests. Import `loseOnePip`, then add a helper:
   ```ts
   function idleSave(): ProgressionState {
     const start = createInitialProgression(NOW);
     return { ...start, level: 12, ap: 1, allocations: { ...start.allocations,
       0: { spentAp: { stealth: 0, reload: 2, speed: 3, strength: 0, search: 0 } },
       1: { spentAp: { stealth: 3, reload: 0, speed: 0, strength: 0, search: 2 } },
       2: { spentAp: { stealth: 1, reload: 0, speed: 0, strength: 0, search: 0 } } } };
   }
   ```
   Then add the tests:
   ```ts
   it('six days idle loses nothing', () => {
     const save = idleSave();
     const result = applyApDecay(save, NOW + 6 * DAY_MS);
     expect(result.decayedAp).toBe(0);
     expect(result.state).toBe(save);
   });
   it('three weeks idle loses banked AP, then the fullest survivor\'s fullest stat, and no levels', () => {
     const result = applyApDecay(idleSave(), NOW + 21 * DAY_MS + 60_000);
     expect(result.decayedAp).toBe(3);
     expect(result.state).toMatchObject({ level: 12, ap: 0, owedAp: 3, lastApEarnedAt: NOW + 21 * DAY_MS });
     expect(result.state.allocations[0].spentAp).toEqual({ stealth: 0, reload: 2, speed: 2, strength: 0, search: 0 });
     expect(result.state.allocations[1].spentAp).toEqual({ stealth: 2, reload: 0, speed: 0, strength: 0, search: 2 });
     expect(result.state.allocations[2].spentAp).toEqual({ stealth: 1, reload: 0, speed: 0, strength: 0, search: 0 });
     expect(result.newlyRustySkins).toEqual([0, 1]);
     expect(result.state.rustySkins).toEqual([0, 1]);
   });
   it('a survivor who lost a pip is Rusty until they gain one', () => {
     const decayed = applyApDecay(idleSave(), NOW + 21 * DAY_MS).state;
     const regained = allocateStatPoint(0, 'speed', { ...decayed, ap: 1 });
     expect(isCharacterRusty(0, regained)).toBe(false);
     expect(isCharacterRusty(1, regained)).toBe(true);
   });
   it('takes the pip from the first stat in STATS order when two stats tie', () => {
     const start = createInitialProgression(NOW);
     const tied = { ...start, allocations: { ...start.allocations, 3: { spentAp: { stealth: 2, reload: 2, speed: 0, strength: 0, search: 2 } } } };
     const after = loseOnePip(tied);
     expect(after.allocations[3].spentAp).toEqual({ stealth: 1, reload: 2, speed: 0, strength: 0, search: 2 });
     expect(after.owedAp).toBe(1);
     expect(after.rustySkins).toEqual([3]);
   });
   it('loses nothing when there is nothing to lose, but still moves the timer a whole week', () => {
     const fresh = createInitialProgression(NOW);
     expect(loseOnePip(fresh)).toBe(fresh);
     const result = applyApDecay(fresh, NOW + 8 * DAY_MS);
     expect(result.decayedAp).toBe(0);
     expect(result.state).toMatchObject({ owedAp: 0, lastApEarnedAt: NOW + 7 * DAY_MS });
     expect(applyApDecay(result.state, NOW + 8 * DAY_MS).state).toBe(result.state);
   });
   it('a level-100 save idle for a year loses nothing', () => {
     const save100 = { ...createInitialProgression(NOW), level: MAX_CHARACTER_LEVEL, ap: 2 };
     const result = applyApDecay(save100, NOW + 365 * DAY_MS);
     expect(result.decayedAp).toBe(0);
     expect(result.state).toBe(save100);
   });
   ```
2. Run `chemx test tests/progression.spec.ts -t "three weeks idle"`. It fails because ap is 5 rather than 0 and the level drops (old reset-all behavior), and `loseOnePip` is not exported.
3. Implement `loseOnePip` and rewrite `applyApDecay` with the signatures above. Delete `AP_DECAY_INACTIVITY_MS`.
4. Run `chemx test tests/progression.spec.ts`. It should pass.
5. Existing assertions this breaks, all in `tests/progression.spec.ts`:
   - Delete the test at :202-228 ('decays 1 AP after 7 days ... rusty'). Its assertions at :217 (ap 4), :218-221 (rusty skin 0, speed 0) and :226-227 encode the old reset-all rule, and the new tests above replace it.
   - :10: drop the `AP_DECAY_INACTIVITY_MS` import.
   - :236: `AP_DECAY_INACTIVITY_MS` becomes `AP_DECAY_INTERVAL_MS`.

   The tests at :189-200 and :230-243 still pass unchanged.
6. Commit `shared/progression.ts` and `tests/progression.spec.ts` with the message `feat(progression): weekly upkeep takes one pip in a fixed order and never a level (#7517)`.

### Task B6: A level-up repays 1 owed AP
**Files:**
- Modify `shared/progression.ts:217-222` (`XpGainResult`) and `:224-257` (`addExperience`).
- Modify `src/game/snapshot-handler.ts:217` and `:231`.
- Test `tests/progression.spec.ts` and `tests/client-flow.spec.ts`.

**Interfaces:** Consumes B5's `applyApDecay` and `idleSave`. Produces `XpGainResult.apEarned: number`. Each level gained pays `AP_PER_LEVEL`, plus 1 more while `owedAp > 0`, which also takes 1 off `owedAp`.

1. Write the failing tests. In `tests/progression.spec.ts`:
   ```ts
   it('two level-ups after three idle weeks pay four AP', () => {
     const decayed = applyApDecay(idleSave(), NOW + 21 * DAY_MS).state;
     const gain = addExperience(decayed, xpRequiredForLevel(13) + xpRequiredForLevel(14), NOW + 22 * DAY_MS);
     expect(gain.levelsGained).toBe(2);
     expect(gain.apEarned).toBe(4);
     expect(gain.state).toMatchObject({ level: 14, ap: 4, owedAp: 1 });
   });
   ```
   Also add `expect(result.apEarned).toBe(1);` after :64. In `tests/client-flow.spec.ts` (import `createInitialProgression`):
   ```ts
   it('pays an owed AP with the level-up a kill brings', () => {
     const store = memoryStorage();
     store.setItem(PROGRESSION_STORAGE_KEY, JSON.stringify({ ...createInitialProgression(Date.now()), owedAp: 1 }));
     vi.stubGlobal('localStorage', store);
     const socket = joinRoom();
     socket.receive(frame(50, { events: [kill(113)] }));
     const saved = savedProgression(store)!;
     expect(saved).toMatchObject({ level: 2, owedAp: 0, ap: 0 });
     expect(Object.values(saved.allocations[0].spentAp).reduce((sum, n) => sum + n, 0)).toBe(2);
   });
   ```
2. Run `chemx test tests/progression.spec.ts -t "two level-ups"`. It should fail with `apEarned` undefined.
3. Implement the `addExperience` change. In `snapshot-handler.ts`, change `:217` `gain.levelsGained` to `gain.apEarned`, and `:231` `` `+${gain.levelsGained} AP: ...` `` to `` `+${gain.apEarned} AP: ...` ``.
4. Run `chemx test tests/progression.spec.ts` and then `chemx test tests/client-flow.spec.ts`. Both should pass.
5. No existing assertions break: every other state has `owedAp` 0.
6. Commit `shared/progression.ts`, `src/game/snapshot-handler.ts`, `tests/progression.spec.ts` and `tests/client-flow.spec.ts` with the message `feat(progression): a level-up repays one owed AP (#7517)`.

### Task B7: Level 100 makes every survivor maxed at read time
**Files:**
- Modify `shared/progression.ts`: `:133-136` (`isCharacterRusty`), `:265-276` (`effectiveStatSlots`, plus a new private `investedStatSlots`), `:321`, `:354` and `:415-419`.
- Modify `src/components/CharacterSheet.vue:170` and `src/game/character-select-view.ts:20`.
- Test `tests/progression.spec.ts`.

**Interfaces:** Produces `effectiveStatSlots(skin: number, allocation: CharacterAllocation | undefined, level: number): Record<StatKey, number>`. `isCharacterMaxed(skin, current?)` reads `current.level`. `isCharacterRusty(skin, current?)` returns false when `current.level >= MAX_CHARACTER_LEVEL`.

1. Write the failing test. Extend the level-100 test from B5 (or add a new one):
   ```ts
   it('reports every survivor maxed and none Rusty at level 100, from the level alone', () => {
     const save100 = { ...createInitialProgression(NOW), level: MAX_CHARACTER_LEVEL, rustySkins: [0] };
     const kept = applyApDecay(save100, NOW + 365 * DAY_MS).state;
     for (const skin of [0, 1, 2, 3, 4]) {
       expect(isCharacterMaxed(skin, kept)).toBe(true);
       expect(Object.values(effectiveStatSlots(skin, kept.allocations[skin], kept.level))).toEqual([5, 5, 5, 5, 5]);
     }
     expect(isCharacterRusty(0, kept)).toBe(false);
     expect(characterBadgeName(0, 'Night', kept)).toBe('OP Night');
     expect(effectiveStatSlots(0, undefined, 99)).toEqual({ stealth: 5, reload: 0, speed: 0, strength: 0, search: 0 });
   });
   ```
2. Run `chemx test tests/progression.spec.ts -t "at level 100, from the level alone"`. It should fail because `isCharacterMaxed(0)` is false.
3. Implement the signatures above. Move today's body into `investedStatSlots`, which `pickWinningStat` (:321) and `allocateEarnedAp` (:354) now use. Pass the level at the four call sites listed in Decisions.
4. Run `chemx test tests/progression.spec.ts`, `chemx test tests/setup-picks.spec.ts` and `chemx typecheck`. All should pass.
5. Existing code this breaks: `tests/progression.spec.ts:91` `effectiveStatSlots(0, allocated.allocations[0])` becomes `effectiveStatSlots(0, allocated.allocations[0], allocated.level)`. That is a type error rather than an assertion failure. `tests/setup-picks.spec.ts:32-67` still passes, since its fixtures are at levels 21 and 20.
6. Commit `shared/progression.ts`, `src/components/CharacterSheet.vue`, `src/game/character-select-view.ts` and `tests/progression.spec.ts` with the message `feat(progression): level 100 shows every survivor maxed, computed from the level (#7517)`.

### Task B8: Split the pure load from an explicit upkeep check on title, setup and run start
**Files:**
- Modify `shared/progression.ts:116-121` (remove the decay and save from `loadProgression`) and add `checkApUpkeep`.
- Modify `src/components/TitleScreen.vue` (imports :44-65, then a call after :92 `const game = useGame();`).
- Modify `src/components/PlaySetup.vue:105-111` (imports) and `:143`.
- Modify `src/game/run-session.ts:364` (first line of `beginRun`) and its imports at :1-37.
- Test `tests/progression.spec.ts` and `tests/client-flow.spec.ts`.
- Modify `docs/CHANGELOG.md`.

**Interfaces:** Produces `checkApUpkeep(store: ProgressStorage | null = browserStorage(), now = Date.now()): ApDecayResult`, which returns `applyApDecay(loadProgression(store, now), now)` and always saves `result.state` to `store`. `loadProgression` no longer writes. The kill hook (`snapshot-handler.ts:201`) still calls `loadProgression()`, so with no change there it stops decaying.

1. Write the failing tests. In `tests/progression.spec.ts` (import `checkApUpkeep`):
   ```ts
   it('loads an idle save without decaying or writing it', () => {
     const store = storeWith({ ...createInitialProgression(NOW - 21 * DAY_MS), level: 5, ap: 1 });
     expect(loadProgression(store, NOW)).toMatchObject({ ap: 1, owedAp: 0 });
     expect(store.writes()).toBe(0);
   });
   it('checkApUpkeep decays the save and writes it back', () => {
     const store = storeWith({ ...createInitialProgression(NOW - 21 * DAY_MS), level: 5, ap: 1 });
     expect(checkApUpkeep(store, NOW).decayedAp).toBe(1);
     expect(loadProgression(store, NOW)).toMatchObject({ level: 5, ap: 0, owedAp: 1, lastApEarnedAt: NOW });
   });
   it('checkApUpkeep writes a migrated save once, so its grace week starts at the first check', () => {
     const store = storeWith({ level: 21, xp: 3000, ap: 2, gp: 0, allocations: {}, lastApEarnedAt: NOW - 30 * DAY_MS, rustySkins: [] });
     checkApUpkeep(store, NOW);
     expect(loadProgression(store, NOW + 3 * DAY_MS)).toMatchObject({ version: 2, level: 21, xp: 0, ap: 2, lastApEarnedAt: NOW });
   });
   ```
   In `tests/client-flow.spec.ts`:
   ```ts
   it('checks AP upkeep when a run starts', () => {
     const store = memoryStorage();
     store.setItem(PROGRESSION_STORAGE_KEY, JSON.stringify({ ...createInitialProgression(Date.now() - 8 * 24 * 60 * 60 * 1000), level: 3, ap: 1 }));
     vi.stubGlobal('localStorage', store);
     joinRoom();
     expect(savedProgression(store)).toMatchObject({ level: 3, ap: 0, owedAp: 1 });
   });
   ```
2. Run `chemx test tests/progression.spec.ts -t "checkApUpkeep"`. It should fail because `checkApUpkeep` is not exported. Then run `chemx test tests/progression.spec.ts -t "without decaying"`, which should fail with ap 0 rather than 1.
3. Implement:
   - `loadProgression` returns `baseState`.
   - Add `checkApUpkeep`.
   - `TitleScreen.vue`: call `checkApUpkeep();` in `<script setup>` after :92.
   - `PlaySetup.vue:143`: change `const loaded = loadProgression();` to `const loaded = checkApUpkeep().state;` and swap the import.
   - `run-session.ts`: make `checkApUpkeep();` the first statement of `beginRun`.
4. Run `chemx test tests/progression.spec.ts` and `chemx test tests/client-flow.spec.ts`, then `chemx verify`. All should pass.
5. No existing assertions break. Vitest runs in the node environment (`vitest.config.ts:8`), so in client specs that do not stub `localStorage`, `browserStorage()` is null and the `beginRun` call writes nothing.
6. Docs: add a `docs/CHANGELOG.md` entry `## [2026-11-11] - AP upkeep` with `### Changed` bullets:
   - Each full idle week past the last level-up removes one pip: banked AP first, then the fullest survivor's fullest stat.
   - The level never drops.
   - Lost pips become owed AP, which level-ups repay at 1 per level.
   - Level 100 never decays and shows every survivor OP.
   - Old saves keep level, AP and pips, restart XP at 0, and get a week's grace.
   - Upkeep is checked on the title and setup screens and at run start, never mid-run.

   Commit `shared/progression.ts`, `src/components/TitleScreen.vue`, `src/components/PlaySetup.vue`, `src/game/run-session.ts`, `tests/progression.spec.ts`, `tests/client-flow.spec.ts` and `docs/CHANGELOG.md` with the message `feat(progression): check AP upkeep on title, setup and run start, not on kills (#7517)`.

### Task B9: XP bars read the cap from MAX_CHARACTER_LEVEL
**Files:**
- Modify `shared/progression.ts` (add `xpBarFraction` after `totalXpForLevel`, :209-215).
- Modify `src/game/snapshot-handler.ts:204-211` and imports :22-31.
- Modify `src/engine/overlay-renderer.ts:24` and `:211-219`.
- Modify `src/components/CharacterSheet.vue:29`, `:105-116` and `:142-148`.
- Test `tests/progression.spec.ts`.
- Modify `docs/CHANGELOG.md`.

**Interfaces:** Produces `xpBarFraction(state: Pick<ProgressionState, 'level' | 'xp'>): number`. It returns 1 when `level >= MAX_CHARACTER_LEVEL`, and otherwise `xp / xpRequiredForLevel(level + 1)` clamped to [0, 1].

1. Write the failing test:
   ```ts
   it('fills the XP bar toward the next level and shows it full at the cap', () => {
     expect(xpBarFraction({ level: 1, xp: 0 })).toBe(0);
     expect(xpBarFraction({ level: 99, xp: 20_000 })).toBe(0.5);
     expect(xpBarFraction({ level: MAX_CHARACTER_LEVEL, xp: 0 })).toBe(1);
   });
   ```
2. Run `chemx test tests/progression.spec.ts -t "fills the XP bar"`. It should fail because `xpBarFraction` is not exported.
3. Implement:
   - `snapshot-handler.ts:204-211` becomes `const progressFraction = xpBarFraction(gain.state);`. Drop the now-unused `MAX_CHARACTER_LEVEL` and `xpRequiredForLevel` imports.
   - In the `overlay-renderer.ts` constructor, `:213-219` becomes `this.xpFraction = xpBarFraction(prog);`.
   - In `CharacterSheet.vue`, `xpRatio` becomes `computed(() => xpBarFraction(props.progression))`. Add `isMaxLevel = computed(() => props.progression.level >= MAX_CHARACTER_LEVEL)`. At :29, show `MAX LEVEL` when `isMaxLevel`, otherwise the current `{{ progression.xp }} / {{ nextLevelXp }} XP`.
4. Run `chemx test tests/progression.spec.ts`, `chemx test tests/client-render.spec.ts` and `chemx typecheck`. All should pass.
5. No existing assertions break: `tests/client-render.spec.ts:227` passes its fraction directly.
6. Docs: under the B8 entry in `docs/CHANGELOG.md`, add "The Character Sheet XP bar shows MAX LEVEL and fills at level 100." Commit `shared/progression.ts`, `src/game/snapshot-handler.ts`, `src/engine/overlay-renderer.ts`, `src/components/CharacterSheet.vue`, `tests/progression.spec.ts` and `docs/CHANGELOG.md` with the message `feat(progression): XP bars read the cap from MAX_CHARACTER_LEVEL (#7517)`.

---

### Risks seen in the code

- **Other sessions edit these files too.** The hunks another session had open in `src/game/snapshot-handler.ts` and `src/components/TitleScreen.vue` were committed in bd0a357. Run `chemx status --as=@<you>` before staging either file.
- **Banked AP is rarely there to lose first.** `src/components/PlaySetup.vue:142-159` spends all banked AP on the picked survivor every time setup opens. B8 must run upkeep before that loop, which it does by replacing `:143`.
- **Earned AP can end up banked.** All earned AP goes into one stat, capped by that stat's room (`snapshot-handler.ts:216-217` with `progression.ts:356-357`). With B6 a level-up can pay 2, and a stat with one slot left banks the other. When `pickWinningStat` returns null for a full survivor, the `'search'` fallback at `:216` makes `allocateEarnedAp` a no-op, so every AP is banked. Banked AP is the first thing upkeep takes.
- **Specialty pips from edited saves.** `progression.ts:94-102` accepts `spentAp` up to 5 on the specialty stat, so an edited save can hold "invested" specialty pips. `loseOnePip` would take one of those first if it has the most, and the bar would not change (`min(5, 5 + n)`).
- **Upgrade button on a full-looking bar.** `canAllocateStat` (`progression.ts:278-285`, used at `CharacterSheet.vue:177`) reads stored pips. At level 100 with banked AP, the upgrade button still shows on a bar that B7 draws full.
- **Survivor level clamp.** `characterLevel` (`progression.ts:433`) clamped with `MAX_CHARACTER_LEVEL`. Raising the cap would let an edited save show survivor level 26; B1 moves the clamp to `TOTAL_PIPS_TO_FILL`.
- **Fake timers fake `Date`.** `tests/client-flow.spec.ts:98` calls `vi.useFakeTimers()`, which also fakes `Date`. Build save timestamps from `Date.now()` inside each test, never at module scope.
- **The Test Drive test uses the co-op path.** The tests send `testDrive` through a co-op welcome. A real Test Drive is local only (`run-session.ts:128`), but both paths mark the map through `onWelcome` (`:352`), which is the flag the hook reads.
- **Loose test fixtures.** `tests/setup-picks.spec.ts:32-62` builds progression fixtures with `as any` and no `version`, `owedAp` or `lastApEarnedAt`. They keep passing, but they will not catch drift in the state shape.

---

## Slice C: old records (spec section 6, 7)

### Decisions

**Status: blocked on Xopher's answer.** Section 6 is not approved. The tasks below plan the proposed option: the record books start again under new keys, and the old keys stay in storage untouched and are never read for display. Do not start C1 until Xopher says yes.

**Ordering:** ship C1 to C5 in the same release as slice A (points), not before it. If C lands first, the new books would fill with old-scale scores, and slice A would then mix the scales again.

**Choices made where the spec leaves it open:**
- **Key names.** Every renamed key gets a `.v2` suffix: `outbreak.best.v2`, `outbreak.leaderboard.v2`, `outbreak.best-trip.v2`, `outbreak.daily.v2`, `outbreak.daily-ghost.v2`, `outbreak.daily-ghost-best.v2`. This matches `ProgressionState.version: 2`. The constants stay unexported. Tests use the string values, as the existing specs already do with `'outbreak.best'`.
- **The daily log holds non-score state that must survive.** It has no stored streak or played-today flag. Both are worked out from which day keys exist in the log:
  - `streakOf` (`src/game/daily-night.ts:301-309`)
  - `streakNightOf` and `streakReward.todayOpen` (`src/game/streak-reward.ts:15-18`, `:58`), which drive the streak kit given out in play
  - `withRun`'s first-run-counts rule (`daily-night.ts:177`, `:223-225`)
  - `weekLines`' Counted/Missed stamps (`src/game/record-book.ts:106-109`)
  - Starting the log over would wipe streaks and the streak kit.

  So `outbreak.daily.v2`, while it does not exist yet, is built when read from `outbreak.daily`:
  - **Kept:** the day key, `kills`, `level`, `attempts`.
  - **Reset to 0:** `score`, `practiceBest`.
  - **Dropped:** `solo` (its `score` and `practiceBest`) and `mp` (`teamScore`, `playerScore`, `practiceBestTeamScore`, `roster[].score`). They are only read for tonight's lines and the best MP night.
  - **Added:** `carried: true`.
- **Today is left out of the carry-over.** The day being read or recorded is not copied. Carried days are therefore always in the past, so the today-only displays never show a zeroed score: `RecordLeaf.vue:70-77`, `DailyPage.vue:70-71` and `dailyShare`. The cost: a player who already played today's old-scale daily gets one more counted run that day, and it counts as tonight's streak night again.
- **The carry-over writes nothing when it reads.** It runs each time `outbreak.daily.v2` is absent (`readJson` returns null), and the first `recordDaily` writes the result.
- **Home and bunker saves need nothing.** The saved `TripRecord` has no score field (`src/game/home/home-store.ts:51-60`), and `recordOf` drops the receipt's score (`src/game/home/trip-ledger.ts:13-15`). `TripReceipt.score` (`shared/home-protocol.ts:108`) only exists in transit. Nothing in `server/` stores scores.

---

### Task C1: Best run and ledger start again under v2 keys
**Files:**
- Modify: `src/game/storage.ts:1` (`BEST_KEY`) and `:3` (`LEADERBOARD_KEY`)
- Test: `tests/client-storage.spec.ts`
- Modify: `tests/level-progress.spec.ts:19`, `tests/trip-record.spec.ts:23`

**Interfaces:**
- Consumes: none.
- Produces: no new names. `loadBest`, `loadLeaderboard`, `recordLeaderboardEntry` and `recordRun` keep their signatures and read and write `'outbreak.best.v2'` and `'outbreak.leaderboard.v2'`.

1. Write the failing test in `tests/client-storage.spec.ts`, inside `describe('best run')`, using its `memoryStore` and `run`:
```ts
it('does not show records from before level 100, and leaves them in storage', () => {
  const oldBest = JSON.stringify({ score: 9000, wave: 9, kills: 400, durationSec: 1800 });
  const oldBoard = JSON.stringify([{ callsign: 'ANA', score: 9000, wave: 9, kills: 400, durationSec: 1800, timestamp: 1 }]);
  const store = memoryStore({ 'outbreak.best': oldBest, 'outbreak.leaderboard': oldBoard });
  expect(loadBest(store)).toBeNull();
  expect(loadLeaderboard(store)).toEqual([]);
  expect(recordRun(run, store)).toBe(true);
  expect(loadBest(store)).toEqual(run);
  expect(loadLeaderboard(store)).toHaveLength(1);
  expect(store.getItem('outbreak.best')).toBe(oldBest);
  expect(store.getItem('outbreak.leaderboard')).toBe(oldBoard);
  expect(JSON.parse(store.getItem('outbreak.best.v2')!)).toEqual(run);
});
```
   Add `loadLeaderboard` to the import on line 3.
2. Run `chemx test tests/client-storage.spec.ts -t "before level 100"`. It fails: `loadBest(store)` returns the old run instead of null.
3. Implement: `BEST_KEY = 'outbreak.best.v2'` and `LEADERBOARD_KEY = 'outbreak.leaderboard.v2'`. Rename both in this one commit (see Risks).
4. Run `chemx test tests/client-storage.spec.ts`, `chemx test tests/level-progress.spec.ts` and `chemx test tests/trip-record.spec.ts`. All pass.
5. Existing assertions to update in this task:
   - `tests/level-progress.spec.ts:19`: change the seed key `'outbreak.best'` to `'outbreak.best.v2'`. Otherwise `:21` `expect(loadBest(store)).toEqual(best)` fails with null.
   - `tests/trip-record.spec.ts:23`: change the seed key `'outbreak.best'` to `'outbreak.best.v2'`. Otherwise `:38` `expect(loadBest()).toEqual(classic)` fails.
   - `tests/client-storage.spec.ts:55-56`: change the key `'outbreak.best'` to `'outbreak.best.v2'`. These still pass without the change, but would no longer test corrupt data.
6. Commit `src/game/storage.ts`, `tests/client-storage.spec.ts`, `tests/level-progress.spec.ts` and `tests/trip-record.spec.ts`. Message: `feat(records): best run and ledger start again under v2 keys at level 100 (#7517)`

### Task C2: Best trip starts again under a v2 key
**Files:**
- Modify: `src/game/trip-record.ts:10-11` (the comment naming `outbreak.best` becomes `outbreak.best.v2`; `BEST_TRIP_KEY`)
- Test: `tests/trip-record.spec.ts`

**Interfaces:**
- Consumes: C1's `'outbreak.best.v2'`, through `loadBest` and `recordLeaderboardEntry`.
- Produces: `loadBestTrip`, `loadBests` and `recordTrip` keep their signatures and use `'outbreak.best-trip.v2'`.

1. Write the failing test as a new `describe` in `tests/trip-record.spec.ts`, using its `memoryStorage` and `receipt`:
```ts
describe('a best trip from before level 100', () => {
  const old = JSON.stringify({ score: 9000, wave: 3, kills: 50, durationSec: 600, trip: true });
  beforeEach(() => vi.stubGlobal('localStorage', memoryStorage({ 'outbreak.best-trip': old })));
  afterEach(() => vi.unstubAllGlobals());

  it('is not shown, never stands in the way, and is left in storage', () => {
    expect(loadBestTrip()).toBeNull();
    expect(recordTrip(receipt({ score: 30, kills: 4, hordes: 1 }), 'A')).toBe(true);
    expect(loadBestTrip()).toMatchObject({ score: 30, trip: true });
    expect(localStorage.getItem('outbreak.best-trip')).toBe(old);
  });
});
```
2. Run `chemx test tests/trip-record.spec.ts -t "before level 100"`. It fails: `loadBestTrip()` returns the 9000 trip.
3. Implement: `BEST_TRIP_KEY = 'outbreak.best-trip.v2'`.
4. Run `chemx test tests/trip-record.spec.ts` and `chemx test tests/client-home.spec.ts`. Both pass.
5. Existing assertions broken: none. `client-home.spec.ts:326-335` starts from empty stubbed storage and does not depend on the key.
6. Commit `src/game/trip-record.ts` and `tests/trip-record.spec.ts`. Message: `feat(records): best trip starts again under a v2 key at level 100 (#7517)`

### Task C3: Daily ghosts move to v2 keys
**Files:**
- Modify: `src/game/daily-ghost.ts:9` (`GHOST_KEY`) and `:50` (`GHOST_BEST_KEY`)
- Test: `tests/daily-ghost.spec.ts`

**Interfaces:**
- Consumes: none.
- Produces: `loadGhost`, `saveGhost` and `DailyGhost` keep their signatures and use `'outbreak.daily-ghost.v2'` and `'outbreak.daily-ghost-best.v2'`.

1. Write the failing test in `tests/daily-ghost.spec.ts` inside `describe('Daily Night ghost')`, using its `memoryStore` and `DAY`:
```ts
it('neither plays nor keeps a ghost saved before level 100', () => {
  const store = memoryStore();
  const old = JSON.stringify({ day: DAY, skin: 1, score: 5000, towns: { '3': [1, 1, 0] } });
  store.setItem('outbreak.daily-ghost', old);
  store.setItem('outbreak.daily-ghost-best', old);
  expect(loadGhost(DAY, store)).toBeNull();
  expect(loadGhost(DAY, store, 'best')).toBeNull();
  expect(new DailyGhost(DAY, store).showing).toBeNull();
  expect(saveGhost({ day: DAY, skin: 2, score: 40, towns: { '3': [0, 0, 0] } }, store)).toBe(true);
  expect(loadGhost(DAY, store, 'best')?.score).toBe(40);
  expect(store.getItem('outbreak.daily-ghost')).toBe(old);
  expect(store.getItem('outbreak.daily-ghost-best')).toBe(old);
});
```
2. Run `chemx test tests/daily-ghost.spec.ts -t "before level 100"`. It fails: `loadGhost` returns the score-5000 track.
3. Implement: `GHOST_KEY = 'outbreak.daily-ghost.v2'` and `GHOST_BEST_KEY = 'outbreak.daily-ghost-best.v2'`. Rename both together (see Risks).
4. Run `chemx test tests/daily-ghost.spec.ts` and `chemx test tests/client-daily-ghost.spec.ts`. Both pass.
5. Existing assertions broken: none. Both specs start from empty storage.
6. Commit `src/game/daily-ghost.ts` and `tests/daily-ghost.spec.ts`. Message: `feat(daily): daily ghosts move to v2 keys at level 100 (#7517)`

### Task C4: The daily log moves to a v2 key and keeps the streak, not the points
**Files:**
- Modify: `src/game/daily-night.ts:12` (`DAILY_KEY`, plus a new `OLD_DAILY_KEY = 'outbreak.daily'`)
- Modify: `src/game/daily-night.ts:61-72` (`DailyResult`), `:163-173` (`loadDailyLog`), `:262-266` (`recordDaily`)
- Modify: `src/game/streak-reward.ts:22`
- Test: `tests/daily-night.spec.ts`

**Interfaces:**
- Consumes: `readJson` and `writeJson` from `src/game/storage.ts:42-57`.
- Produces:
  - `DailyResult` gains `readonly carried?: true`, documented as: a counted day from before level 100, kept for the streak; its points are not kept.
  - `export function loadDailyLog(store: Store | null = browserStore(), now: Date = new Date()): DailyLog`
  - `recordDaily(key, run, store)` keeps its signature. It treats `key` as today for the carry-over.
  - The helper `function readLog(store: Store | null, todayKey: string): DailyLog` is not exported. When the v2 value is not null, it parses as `loadDailyLog` does today. When it is null, it parses `OLD_DAILY_KEY` with the same day-key regex and `isResult` filter, skips `todayKey`, and maps each other day to `{ score: 0, kills, level, attempts, practiceBest: 0, carried: true }`.
  - `loadDailyLog` returns `readLog(store, dateKeyOf(now))`. `recordDaily` uses `readLog(store, key)`.

1. Write the failing tests in `tests/daily-night.spec.ts` inside `describe('Daily Night')`, using its `memoryStore` and `run`:
```ts
const NOW = new Date(2026, 10, 7, 20, 0);
const oldLog = JSON.stringify({
  '2026-11-04': { score: 300, kills: 12, level: 3, attempts: 1, practiceBest: 0 },
  '2026-11-05': { score: 500, kills: 25, level: 5, attempts: 1, practiceBest: 0, mp: { 3: { partySize: 3, teamScore: 1450, teamKills: 70, playerScore: 500, playerKills: 25, level: 5, attempts: 1, practiceBestTeamScore: 0 } } },
  '2026-11-06': { score: 900, kills: 40, level: 4, attempts: 2, practiceBest: 1200, solo: { score: 900, kills: 40, level: 4, attempts: 2, practiceBest: 1200 } },
  '2026-11-07': { score: 700, kills: 30, level: 4, attempts: 1, practiceBest: 0 },
});

it('keeps the streak from before level 100 but none of its points', () => {
  const store = memoryStore();
  store.setItem('outbreak.daily', oldLog);
  const log = loadDailyLog(store, NOW);
  expect(log['2026-11-06']).toEqual({ score: 0, kills: 40, level: 4, attempts: 2, practiceBest: 0, carried: true });
  expect(log['2026-11-05']).toEqual({ score: 0, kills: 25, level: 5, attempts: 1, practiceBest: 0, carried: true });
  expect(log['2026-11-07']).toBeUndefined();
  expect(streakOf(log, '2026-11-07')).toBe(3);
});

it('counts the first new run on the day of the change and leaves the old log in storage', () => {
  const store = memoryStore();
  store.setItem('outbreak.daily', oldLog);
  expect(recordDaily('2026-11-07', run(30), store)).toBe(true);
  expect(store.getItem('outbreak.daily')).toBe(oldLog);
  const log = loadDailyLog(store, NOW);
  expect(log['2026-11-07']).toMatchObject({ score: 30, attempts: 1 });
  expect(log['2026-11-07'].carried).toBeUndefined();
  expect(log['2026-11-06']).toMatchObject({ score: 0, carried: true });
  expect(streakOf(log, '2026-11-07')).toBe(4);
  expect(JSON.parse(store.getItem('outbreak.daily.v2')!)['2026-11-04'].carried).toBe(true);
});
```
2. Run `chemx test tests/daily-night.spec.ts -t "before level 100"` and `chemx test tests/daily-night.spec.ts -t "day of the change"`. Both fail: the first sees `score: 900` with no `carried`; the second finds no `'outbreak.daily.v2'` written.
3. Implement as given under Interfaces. `DAILY_KEY = 'outbreak.daily.v2'`. Change `src/game/streak-reward.ts:22` to `streakNightOf(loadDailyLog(store, now), dateKeyOf(now))`. Leave the other callers on the default `now`: `DailyPage.vue:64`, `RecordsPage.vue:41`, `snapshot-handler.ts:301`, `daily-night.ts:366`.
4. Run `chemx test tests/daily-night.spec.ts`, `chemx test tests/streak-kit.spec.ts`, `chemx test tests/record-book.spec.ts` and `chemx test tests/daily-mp-lobby.spec.ts`. All pass.
5. Existing assertions to update: `tests/daily-night.spec.ts:139` changes its seed key `'outbreak.daily'` to `'outbreak.daily.v2'`. With the old key it still passes, because the carry-over drops damaged entries, but it would no longer test v2 parsing. Searches of `tests/` for `outbreak.daily`, `loadDailyLog` and `recordDaily` find nothing else that breaks: the other specs start from an empty `memoryStore()` or build logs directly.
6. Commit `src/game/daily-night.ts`, `src/game/streak-reward.ts` and `tests/daily-night.spec.ts`. Message: `feat(daily): daily log moves to a v2 key, keeping old days for the streak without their points (#7517)`

### Task C5: Carried days show no points and are never the best night
**Files:**
- Modify: `src/game/daily-night.ts:312-319` (`bestDay`)
- Modify: `src/game/record-book.ts:125` (`weekLines` score cell)
- Test: `tests/daily-night.spec.ts`, `tests/record-book.spec.ts`

**Interfaces:**
- Consumes: C4's `DailyResult.carried?: true`.
- Produces: `bestDay` skips entries with `carried`. `weekLines` prints `'-'` as the score of a carried day and keeps its `detail` and `stamp: 'counted'`.
- `bestMpDay` needs no change, because carried entries have no `mp`. `dailySummary.nights` keeps counting carried days, which were counted days.

1. Write the failing tests.
   In `tests/daily-night.spec.ts`:
```ts
it('never takes a day from before level 100 for the best day', () => {
  const carried = { score: 0, kills: 40, level: 4, attempts: 2, practiceBest: 0, carried: true as const };
  expect(bestDay({ '2026-11-05': carried })).toBeNull();
  expect(bestDay({ '2026-11-05': carried, '2026-11-06': { ...run(20), attempts: 1, practiceBest: 0 } })?.key).toBe('2026-11-06');
});
```
   In `tests/record-book.spec.ts`, using its `NOW`:
```ts
it('stamps a night from before level 100 as counted, without its points', () => {
  const lines = weekLines({ '2026-11-06': { score: 0, kills: 40, level: 4, attempts: 2, practiceBest: 0, carried: true } }, NOW);
  expect(lines[1]).toMatchObject({ stamp: 'counted', score: '-', detail: 'Four Corners, 40 kills, 1 practice' });
  expect(dailySummary({ '2026-11-06': { score: 0, kills: 40, level: 4, attempts: 1, practiceBest: 0, carried: true } }, NOW).best).toBeNull();
});
```
2. Run `chemx test tests/daily-night.spec.ts -t "best day"` and `chemx test tests/record-book.spec.ts -t "before level 100"`. They fail: `bestDay` returns the carried day, and the score cell is `'0'`.
3. Implement: in `bestDay`, `if (result.carried) continue;`. In `weekLines`, `score: result && !result.carried ? String(result.score) : '-'`.
4. Run `chemx test tests/daily-night.spec.ts` and `chemx test tests/record-book.spec.ts`. Both pass.
5. Existing assertions broken: none. `record-book.spec.ts:30` and `:40` and `daily-night.spec.ts:65` use logs without `carried`.
6. Commit `src/game/daily-night.ts`, `src/game/record-book.ts`, `tests/daily-night.spec.ts` and `tests/record-book.spec.ts`. Message: `feat(records): nights from before level 100 keep their stamp but show no points (#7517)`

### Task C6: Docs for the new record books
**Files:**
- Modify: `docs/README.md:27` (Daily Night bullet), `docs/README.md:77` (Records bullet)
- Modify: `docs/CHANGELOG.md` (a new entry above `:5`)

**Interfaces:** Consumes: the key names from C1 to C4. Produces: none.

1. `docs/README.md:27`: after "is kept on the device for the streak and the Records", add that the log lives under `outbreak.daily.v2`. Say that days played before level 100 are carried over for the streak, with kills, town and attempts but no points (`carried`), and that the day of the change is not carried.
2. `docs/README.md:77`: add that personal bests, the ledger and the best trip started again at level 100 under `.v2` keys. The old entries stay in storage and are not shown.
3. `docs/CHANGELOG.md`: add a Changed entry covering the record books starting again, the streak kept, and the old entries left in storage unread. Leave the historical lines as they are (`:285` names `outbreak.daily`).
4. Run `chemx verify`. It passes.
5. Existing assertions broken: none.
6. Commit `docs/README.md` and `docs/CHANGELOG.md`. Message: `docs(records): record books start again at level 100, streak kept (#7517)`

### If Xopher picks the alternative ("Before level 100" heading)
C1 to C3 still move to the `.v2` keys, and C4 still carries old days. The difference: a new `loadLegacyRecords()` reads `outbreak.best`, `outbreak.leaderboard` and `outbreak.best-trip` and returns them unchanged. C4 keeps the carried days' scores instead of zeroing them, and C5 prints them under a "Before level 100" heading on the bests, ledger and daily leaves of `src/components/records/RecordLeaf.vue` instead of `'-'`. Ghosts are unchanged either way, because they only last one day.

---

### Docs that state point values, the 21 cap, the XP curve or the decay rule

| Where | What it says | Task |
| :--- | :--- | :--- |
| `docs/README.md:26` | Kill chain: points times the multiplier, "rounded down" | Slice A: becomes "rounded", with the `round(points × town × chain × event / 10)` rule |
| `docs/README.md:30` | Screamers are "worth 30" | Slice A: worth 3 × the town |
| `docs/README.md:25` | Blood moon: "kill points x2" | Slice A: still true; add that the headshot bonus is not doubled |
| `docs/README.md:24` | Bosses have "their own points" (no number given) | Slice A: no change needed |
| `docs/community.md:198` | "every kill is worth double" | Slice A: check it; still true |
| `docs/community.md:225` | Chain "worth a quarter more, up to double" | Slice A: check it; still true |
| `docs/CHANGELOG.md:269`, `:472` | Old chain "+18 x1.5" text and headshot "bonus score" | History, leave as is. Slice A adds a new entry |
| 21 cap, XP curve, decay | No docs page states them | Slice B and slice 3 each add a CHANGELOG entry. No README bullet covers `shared/progression.ts`, so B decides whether to add one |
| `docs/README.md:27`, `:77` | Daily log and Records | C6 |

Searched for: "21", "XP", " AP", "decay", "Rusty", "pip", "MAX_CHARACTER_LEVEL", "1.15", "points", "worth", "headshot", "score". The 21 cap, XP curve and decay rule only appear in the new spec itself.

### Risks seen in the code
1. `src/game/storage.ts:86-100`: when the leaderboard key is missing, `loadLeaderboard` builds a ledger row from `loadBest`. If only one of `BEST_KEY` and `LEADERBOARD_KEY` is renamed, an old best leaks into the new ledger, or the reverse. Rename both in one commit.
2. `src/game/daily-ghost.ts:60-63`: the 'best' ghost falls back to the official key. If only one constant moves, the old official ghost plays as tonight's best on the day of the change.
3. `src/game/trip-record.ts:22-28`, `:66-67`: the file has its own `browserStore` and `recordTrip` takes no store, so its tests must stub `localStorage` with `vi.stubGlobal`, as `tests/trip-record.spec.ts:23` does.
4. `src/game/streak-reward.ts:17`: with today left out of the carry-over, a player who played the old-scale daily on the day of the change gets a second counted run that day, and the streak kit for that night is handed out again.
5. `src/game/analytics/bands.ts:3-7`: `SCORE_BANDS` (used in `run-tracker.ts:288` and `:311`) are on the old scale. After slice A almost every town-1 run falls in '1-999'. The spec does not mention this.
6. `tests/level-progress.spec.ts:15-22` asserts that an old `outbreak.best` loads unchanged, so it breaks in C1 (handled in C1 step 5).
7. `src/game/daily-night.ts:223`: old flat entries without `solo` still have the top-level numbers `isResult` needs, so the carry-over handles them. Keep `isResult` as the filter for the old key.
