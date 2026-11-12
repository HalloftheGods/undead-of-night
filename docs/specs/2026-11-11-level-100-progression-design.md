# Level 100: town-scaled XP and weekly AP upkeep

Epic: chemx task #7517. Checked against `main` at ad4b3b8.

## Why

Level 21 came too quickly and could be reached by farming the first town: about six clears of town 1, roughly half an hour. The climb should be a challenge, later towns should be worth more than the first, and an OP survivor should be something you keep up, not something you finish.

## What Xopher decided

- **XP and score stay 1:1.** The score of a run is the XP gained in that run. There is no second number.
- **Small numbers.** A basic zombie is worth 1 point. The headshot bonus drops to +1.
- **The cap moves to level 100,** still 1 AP per level.
- **AP follows the momentum rule:** gain one level a week or lose one pip. Upkeep gets dearer as levels get dearer.
- **Level 100 is permanent.** Every survivor is maxed and nothing decays.

## What the game does today

- **Points** are flat per type (`shared/constants.ts:90-94`): walker 10, runner 15, bloater 25, screamer 30, brute 120. Bosses pay 1500, 2500 and 4000 (`shared/bosses.ts:43-51`). The town number changes nothing.
- **A kill** pays `floor(points × kill chain × night event)` (`shared/combat.ts:77`).
- **A headshot** pays on every bullet that lands on the head, killing or not: 5 points (brute 2) times its own chain multiplier of up to 3 (`shared/headshots.ts:99-111`).
- **XP** is those same event points, fed to `addExperience` on the client (`src/game/snapshot-handler.ts:197-202`).
- **The curve** is `100 × 1.15^(level − 2)` per level, 10,245 XP to level 21 (`shared/progression.ts:203-215`).
- **Decay** (`applyApDecay`, `shared/progression.ts:138-193`): after seven days with no level-up, one AP is lost per idle week, the account level drops by the same amount, and every survivor's pips are reset and marked Rusty. A player at the cap can never level up, so the timer never resets and they decay every week.
- **Pips are display-only.** Nothing in `shared/` or `server/` reads progression, so OP and Rusty are badges.
- **Storage** is `localStorage` only (`outbreak.progression`), with no version field.

## Design

### 1. Points

The values in `ZOMBIES` and `BOSSES` stay as they are. The payout divides by ten and multiplies by the town:

```
kill points = round(z.points × town × kill chain × night event / 10)
```

`town` is the sim's 1-based town number. Multiply the integers first and divide once, so no 0.1 enters the arithmetic.

| Type | Town 1 | Town 2 | Town 5 | Town 10 |
| :--- | ---: | ---: | ---: | ---: |
| Walker | 1 | 2 | 5 | 10 |
| Runner | 2 | 3 | 8 | 15 |
| Bloater | 3 | 5 | 13 | 25 |
| Screamer | 3 | 6 | 15 | 30 |
| Brute | 12 | 24 | 60 | 120 |

Bosses pay 150, 250 and 400 times the town they appear in.

`round` replaces `floor` so the kill chain still pays on a 1-point walker: a town-1 walker chain pays 1, 1, 2, 2, 2.

This keeps score honest as XP: the factor is applied before the number reaches the score, and the same town pays every player the same.

### 2. Headshots

- The bonus is **+1 × town**, the same for every zombie type.
- It is paid **once per zombie, on the shot that kills it.** A head hit that does not kill pays nothing.
- The headshot chain **no longer multiplies points.** The chain counter, the callout and the damage multiplier stay.
- The `headshot` event is still emitted on every head hit, with `points: 0` when the hit did not kill, so sounds, callouts and the stealth action score keep working.
- Night events still do not touch the headshot bonus.

Reason: with small numbers, a bonus paid per hit and chained would make head-tapping one brute pay 41 points against 12 for killing it.

### 3. The curve and the cap

- `MAX_CHARACTER_LEVEL` becomes 100.
- `xpRequiredForLevel(L) = round(40 × L^1.5)`. Level 2 costs 113 XP; level 100 costs 40,000.

| Reach level | Total XP | Full campaigns |
| ---: | ---: | ---: |
| 10 | 5,667 | 0.16 |
| 21 | 34,242 | 0.94 |
| 50 | 289,910 | 8.0 |
| 100 | 1,620,015 | 44.5 |

A full campaign pays about 36,400 points under section 1. That figure is computed from the spawn formulas for solo play with every roaming zombie killed and 30% headshots; it was not measured from played runs. It was also computed with runner and bloater rounded up in every town (2 and 3 times the town), which overstates their share by a few percent against the exact rounding in section 1, so read the campaign counts as approximate. A campaign is about 1.6 hours of timers, so level 100 is about 73 hours. Farming town 1 to level 21 takes about 12 hours against one campaign played through.

- XP stops accumulating at level 100. Today it piles up without limit at the cap.
- The Dev: Test Drive run grants no XP.

### 4. AP upkeep: one level a week

- **Timer.** `lastApEarnedAt` is the time of the last level-up. While it is less than seven days old, nothing is lost.
- **Loss.** For each full seven days past it, one pip is lost. The level never drops.
- **Which pip.** Banked, unspent AP goes first. After that: the survivor with the most invested pips, and on that survivor the stat with the most invested pips. Ties go to the lowest skin number, then the order of `STATS`. Only that pip is removed; other survivors keep theirs.
- **Rusty.** A survivor who lost a pip is Rusty until they gain one again.
- **Owed AP.** Each lost pip adds one to a new `owedAp` field. A level-up pays its 1 AP plus 1 owed AP while any is owed. A missed week is therefore earned back, never gone.
- **Level 100.** No decay runs. `effectiveStatSlots` returns full bars for every survivor and `isCharacterMaxed` is true for all five, computed at read time from the level, not from stored pips. Levels 2 to 100 pay 99 AP against 100 pips in total, so this also covers the last pip.
- **When decay is checked.** On the title and setup screens and at run start. The kill hook no longer applies it, so pips never vanish mid-run.
- **Clock.** A `lastApEarnedAt` later than now is clamped to now on load.

What holding everything costs each week under section 3: about 10 minutes at level 20, 40 minutes at level 50, 1.8 hours at level 99.

### 5. Saves

- `ProgressionState` gains `version: 2` and `owedAp`.
- A save without a version is migrated once: level, banked AP and pips are kept, `xp` becomes 0, `owedAp` becomes 0 and `lastApEarnedAt` becomes the migration time, which gives a week's grace.
- Level 21 players keep a level that now costs about three times more to earn. This is accepted.

### 6. Old records

Best run, the top-five leaderboard, best trip, the daily log and the daily ghosts were written at the old point scale. A town-1 run now scores about an eighth of what it did; a full campaign about 0.84 times.

Proposed: the record books start again under new storage keys, and the old entries are left in storage untouched and not shown. **This needs Xopher's yes before it is built**, because players lose sight of their old bests. The alternative is to show the old entries under a "Before level 100" heading.

### 7. Small things that follow

- The floating "+N XP ×1.25" text shows the chain only when it changed the points.
- The level card, XP bar and any "of 21" copy read the cap from `MAX_CHARACTER_LEVEL`.
- `docs/` pages that describe scoring and progression, and `docs/CHANGELOG.md`, are updated in the slice that changes the behavior.

## Not in this spec

- Pips changing gameplay. They stay display-only.
- GP income or cost scaling, and any calendar-based AP.
- Server-side progression. The save stays in the browser, so it can be edited; with display-only pips that is accepted.
- Per-town daily records. Daily towns run from 2 to 8, so a late-town day now scores more than an early one; same-day comparisons stay fair.
- XP from daily practice reruns. They keep paying.

## Slices

Each is one task under #7517 and locks its own files.

1. **Points and headshots** (sections 1, 2): `shared/combat.ts`, `shared/headshots.ts`, the floating text in `src/engine/fx-director.ts`, and the tests that assert point values.
2. **Curve and cap** (section 3): `shared/progression.ts`, `src/game/snapshot-handler.ts`, `tests/progression.spec.ts`.
3. **AP upkeep and save migration** (sections 4, 5): `shared/progression.ts` after slice 2, the screens that load progression, `tests/progression.spec.ts`.
4. **Old records** (section 6), after Xopher's answer: `src/game/storage.ts`, `src/game/trip-record.ts`, `src/game/daily-night.ts`, `src/game/daily-ghost.ts`.

Slices 2 and 3 share `shared/progression.ts` and run one after the other. Slice 1 is independent of both.

## Testing

- **Points:** the town table above, row by row; a town-1 walker chain pays 1, 1, 2, 2, 2; a blood moon doubles a kill and not the headshot bonus.
- **Headshots:** a non-killing head hit adds no score and emits `points: 0`; a killing head hit in town 3 adds 3; a brute killed after ten head hits pays the bonus once.
- **Curve:** the four totals in section 3; XP does not grow at level 100.
- **Upkeep:** six days idle loses nothing; three weeks idle loses three pips in the stated order and no levels; two level-ups after that pay four AP; a level-100 save idle for a year loses nothing and reports every survivor maxed; a future timestamp is clamped.
- **Migration:** a version-less level-21 save with banked XP loads at level 21 with its pips, `xp` 0 and a fresh timer.
- The gate is `chemx verify` in this package.
