# Bunker features: quests, workshop and reloading press, perks, extras

> **Superseded in part (2026-11-13):** home is now an outdoor camp, not an indoor bunker, and the overrun breaks fence sections instead of a blast door. For the map, the stations' places and the breach, read [Outdoor camp (design)](../superpowers/specs/2026-11-13-outdoor-camp-design.md); the rest of this document stands.

Epic: chemx task #7226, under the Home Loop epic #7115. This follows [Home Loop (design)](2026-11-05-home-loop-design.md), whose "Later specs" section names the workshop scene, quests and perks. The Overrun is specified in that file (epic #7212) and is not repeated here. Everything below stays behind `HOME_LOOP_LIVE`, which is still `false`.

## What the bunker has today

Playable with `?home`, checked against `main` at fc0ececb:

- **Map** (`shared/bunker-map.ts`): 40x24 tiles, four rooms (Market hall, Workshop, Quarters, Garage), a fixed exit van. No blast door yet; the Overrun contract #7213 carves it into the hall's west wall.
- **Stations** (`STATION_IDS` in `shared/home-protocol.ts`): `bench, forge, locker, level_map, jukebox` and the four merchants. Each opens with a 0.5 s hold on E.
- **Bench, forge, locker, garage map, jukebox, merchants**: all in the portrait-card layout (#7199, #7209, #7210). Merchant stock rolls only on a banked trip, inside the credit's `save()`.
- **Save** (`src/game/home/home-store.ts`): `HomeStore` with `navigator.locks`, typed saved/conflict/failed results, receipts applied once through `appliedReceipts`, a field-by-field `reviveSave`, and a ledger of trips.
- **Not built**: quests, salvage and the press, perks, costumes (#7173, queued), a records wall, decor, the flip (#7146, blocked on Xopher).

One bug found on the way: `HomeActions.smelt()` is a no-op (`src/game/home-hud.ts:64`) and the forge's Smelt button calls it. The forge already runs on its own while you stay (#7250).

## Shared rules for every slice

These settle the places where the designers' slices touch the same code.

- **No save version bump.** `HomeSave.version` is the compare-and-write counter (`browser-home-store.ts:44-48` compares it and writes `version + 1`), not a schema number. Bumping it would make every open tab's next save a conflict. Every new field is added the way `shop` was: optional on read, revived on its own by a small `revive<X>(value.x, blank.x)` in its own file, so `home-save-revive.ts` (61 lines) gains one line per field. A field that does not read falls back to its blank value without touching the others.
- **Migration order** for `HomeSave` and `TripRecord`, which is the order the slices land in `home-store.ts` and `home-save-revive.ts`. Each slice locks both files, so they serialize without merges:
  1. Overrun contract and save (#7213, #7218): `overruns`, `openOverrun`, `shop.merchants[id].closedTrips` and `thinTrips`.
  2. Quests (#7228): `quests`.
  3. Ledger fields (#7247): optional `score`, `kills`, `hordes`, `seconds` on `TripRecord`.
  4. Salvage (#7240): `salvage`, and optional `salvage` on `TripRecord`.
  5. Costumes (#7173): `costumes`.
  6. Decor (#7249): `bunker.owned`.

  If an earlier step has not landed, the next one goes ahead; the order only fixes who rebases on whom.
- **`Loadout` does not change.** Salvage never enters a `Loadout` (it is banked, never taken out). Quest item rewards reuse a merchant's `ItemDef.grant`. Costumes ride beside `skin`, not in the loadout. So `validateLoadout`, `JoinHome` gear and the worst-case join size stay as they are.
- **Frozen protocol file, additive only.** `shared/home-protocol.ts` is frozen after the contract, so each addition is a DM to the trip-loop owner. New station ids are appended at the end of `STATION_IDS`, after the merchants: `chest` (#7213), then `press` (#7237), then `records` (#7248). Nothing indexes `STATION_IDS` (no `indexOf` or `[n]` in the app), so the order carries no meaning beyond a clean diff. `SALVAGE_TYPES` is appended at the end of `PICKUP_TYPES`.
- **Shared map file.** `shared/bunker-map.ts` is edited by #7213 (blast door, chest spot), #7244 (press) and #7248 (records). Serialize by lock. Each station's circle stays 28 px or more from every other.
- **A station appears last.** The map slice of each new station lands after its screen, so a half-built station never shows once the flag is on.
- **`home-sync.ts` is 366 lines.** New ticking and composition go in their own files (`quest-sync.ts`, `press-run.ts`), and `home-sync.ts` gains call lines only.

## Quests

Merchants give them. A new save starts with one starter quest accepted at each of the four stalls. There is no quest board. The server holds no quest state, nothing new goes on the wire, and no sim file changes.

### What progress can read

- **Reliable, on the receipt.** `TripReceipt` carries `outcome`, `level`, `difficulty`, `replay`, `silver`, `jewels`, `score`, `kills`, `hordes`, `seconds`, `ending` and `gear` (the `Loadout` that came home).
- **Reliable, bunker actions** that already go through `save()`: forge payouts, sales, a station opening.
- **Best effort, a client-side tally of events.** `viewFor` sends every event to every client, and `SnapshotHandler.onSnapshot` runs a snapshot's events before `home.observe`, so a tally is complete before that frame's receipt. Counters, all filtered to the local player's `playerId` or `killerId`:
  - kills by `zombieType` (`zombie_die`);
  - headshots (`headshot`);
  - landed shoves (`melee`, `hit: true`);
  - finds and noisy searches (`container_opened`);
  - bottles (`bottle_smash`);
  - medkits used (`heal`);
  - damage taken (`player_hurt`);
  - suppressed shots;
  - burning kills (an `incendiary` `zombie_status` on that zombie, then its `zombie_die` credited to me);
  - pickups by type.

  It also records the party size and the local `skin`. `RunTracker` in analytics already tallies this way.
- **Not measurable without a sim change, left out:** who revived whom, who applied an effect, which gun made a kill, distance run.

The tally can undercount in co-op if a snapshot is dropped, and is lost on a mid-trip co-op refresh. It never overcounts. Receipt-based objectives have neither problem. Whether to move counters onto the receipt is open question 1 (#7236).

### Model

`src/game/home/quest-data.ts` is a plain readonly table beside `merchant-data.ts`:

- **`QuestDef`**: `id` (never renamed once shipped), `giver: MerchantId`, `title`, `brief`, one `objective`, `reward[]`, `repeat: 'once' | 'job'`, `starter?`, `after?: string[]`, `gate?` (the player's own highest level, as the shop's gates), `owns?: WeaponId`.
- **Objective kinds**:
  - `visit` a station;
  - `bank` N trips;
  - `streak` of N banked trips in a row (a death on a trip the quest's filter counts resets it, unless the streak is already finished);
  - `receipt_total` of `hordes` or `kills` (never silver: towns pay no silver since the jewels-only economy);
  - `fast` (one banked trip at or under S seconds);
  - `bring_home` a gun, any gun, N medkits or N jewels;
  - `tally` of a counter, scoped to one trip or the total, with an optional `atMost` second counter that fails the trip, not the quest;
  - `smelt` N jewels.

  Every kind takes an optional filter: `minLevel`, `survivor` (a character id from `shared/characters.ts`, such as `'satori'` for Kat, never an index), `zombie`, `minParty`.
- **Reward kinds**: `silver`, or `item` naming an existing merchant `ItemDef`, so the icon, facts and price come for free. Costume unlocks are added as a third kind by #7173 once it lands.

**Save** (`HomeSave.quests`, #7228):

```ts
interface QuestState {
  seed: number;    // its own random value, so job rolls never move stock rolls
  rolls: number;
  active: Partial<Record<MerchantId, { id: string; progress: number; acceptedAt: number }>>;
  done: readonly string[];
  jobs: Record<MerchantId, string | null>;
}
```

A blank save gets `starterQuests(seed)`, so an old save loads with the four starters accepted. Unknown ids are dropped one at a time and progress is clamped. Progress counts only from acceptance and never reads the ledger backwards, so nothing completes on load.

**Pure steps** (`src/game/home/quests.ts`, in the `shop.ts` style: each returns a new save or null):

- `accept`, `abandon` and `turnIn` are refused unless the station is that merchant and no trip is open. Abandoning loses progress; a one-time quest goes back on offer, and a job goes back on the counter as the same job. A finished quest cannot be abandoned, and the button asks for a second press (Confirm) before it gives up an open one.
- `applyTripToQuests(save, receipt, tally)` is the only path that moves trip progress.
- `noteSmelted`, `noteVisit`.
- `rollJobs(save, highest)` gives each merchant one job from the rows its gates allow.

### Applied exactly once

In `HomeSync.takeReceipt`:

```ts
const after = applyReceipt(save, receipt);
return after === save ? save : applyTripToQuests(after, receipt, tally);
```

Quest progress lands in the same `save()` as the credit, under the same `appliedReceipts` key. On a conflict the write re-reads and reapplies with the same in-memory tally, which is cleared only once the save lands.

`rollJobs` runs in that write on a banked receipt, beside `rollStock`. It replaces only offers nobody has accepted. A died receipt moves nothing except resetting streaks that are still running, and never rolls jobs, so boarding empty and quitting cannot re-roll offers. A quit or crash is a death, as `resolveOpenTrip` already says, and it goes through the same streak reset (`resolveOpenTripWithQuests`); having no tally, only the trip's level can be checked against the filter. Quests never fail or expire: a finished streak keeps its pay through a death.

The tally resets when the local player's status becomes `dead`. A spectator who comes back with the return kit counts only what they do afterwards, which mirrors gear lost on death. Being revived keeps it.

### Offering, turning in, rewards

- **One active quest per merchant**, so at most four. A merchant with an active quest still lists their next one-time quest and their job, greyed with "Finish my last job first".
- **Turn-in is at the counter.** It works like a sale: one `save()`; a failed save changes nothing; a conflict re-reads and does not retry. Two tabs turning in the same quest pay once.
- **Item rewards go to the locker** under `buy()`'s rules: caps count the locker and hands together, and a box counts its scaled rounds. What does not fit is paid in silver at that item's shop price, and the reward chip says so before turn-in. Turn-in never sticks and never passes a cap (open question 4).
- **Rewards never include fitted upgrades or perks.** Parts and kits still go through the bench, where `gunStats` holds the 1.5x cap.
- **Jobs pay silver only**, so repeat play cannot grow ammo. The one-time table's ammo totals 8 rounds: one pistol box (`out_and_back`). `fast_hands` pays 150 silver instead of carbine boxes (commit 9cad0e22, to fit the 15% budget).
- **Job silver scales** by the player's own highest level: `JOB_BANDS` ×1 for levels 1-3, ×1.5 for 4-6, ×2 for 7-10. These are starting numbers for the soak (#7235). Difficulty scales nothing, because treasure does not scale with it either. Replays count unless a filter excludes them.

### Co-op

Quest state, tally and rewards are per player and live only in that player's browser, like the bank.

- Each tally counts only that player's own credited events.
- Receipt objectives come from each player's own receipt.
- Survivor quests check the `skin` actually played on that trip, since co-op may hand you the next free survivor.
- Cheating is possible, as with the bank, and is accepted among friends.

### Overrun interaction (depends on #7217)

A killed merchant's stall is closed for `OVERRUN_RECOVERY_TRIPS`. Default (open question 8):

- That merchant's active quest waits, and its progress keeps counting.
- Accept and turn-in are refused at a closed stall ("Stall closed").
- The replacement at the same stall honours it.

Quests that read `OverrunReceipt` ("hold the bunker once") are a later table row after #7218, not v1.

### UI

- **Merchant screen** (#7232, waits for #7199 to release `MerchantScreen.vue`). A **Shelf | Work** switch, which opens on Work when something is ready.
  - `MerchantCard` keeps the bust, nameplate and greeting. Its slot shows `QuestPanel`: title, one-line brief, objective bars in the `ShopItemBars` style (5 cells, `STAT_SLOTS`; one per unit up to 5, proportional above, with an "11 / 25" value), and a second bar for `atMost`.
  - A reward row of `ShopItemArt` tiles, with "Paid as N silver" where needed. Accept, Turn in or Abandon. Refusals in `refusalOf` wording.
  - `QuestShelf` follows `ShopShelf`: radiogroup, arrow keys.
- **HUD tracker** (#7233). `QuestTracker.vue` under the treasure chip shows one line per active quest. In town it shows live trip tallies, with "Lost if you die" on lines with trip progress. On a phone it collapses to "Work: N of M ready", M being the quests open ("No work" when none is). One shared "Lost if you die" line sits under the lines rather than one per line. The starters replace the one-line first-visit hint: the tracker is the hint.
- **Stall marker** (#7234): a "!" over a merchant with a new or ready quest, and the prompt "Hold E: Sarge has your pay".
- **View model** (#7231): `src/game/home/quest-view.ts` builds lines and panels from `HomeUi` plus the tally, as `merchant-view.ts` does. `HomeUi` gains `quests`. `HomeActions` gains `acceptQuest`, `turnInQuest` and `abandonQuest`.

### Starting table

The numbers come from the game's tables:

- Level 1 has 130 roamers (`STANDING_POPULATION`), with hordes of 8 and 11.
- Brutes are 0.5% of the crowd at level 4 and 1% at level 5.
- Screamers appear from level 3.
- Prices are those in the Home Loop merchant table.

All rows are content to tune in the soak, not settled data.

| Id | Giver | Objective | Gate / after / owns | Reward |
|---|---|---|---|---|
| **Starters** | | | | |
| `report_in` | Sarge | visit the quartermaster (done in the bunker) | | 2 bottles + 20 silver |
| `bring_iron` | Mags | bring home any gun (the free pistol counts); the brief says to take the van from the garage | | 1 barrel |
| `pharmacy_run` | Doc | bring home 1 medkit; the brief says to take the van from the garage | | 60 silver |
| `first_smelt` | Cinder | smelt 1 jewel (found on a trip; the brief points at the van) | | 1 tranq kit |
| **One-time** | | | | |
| `out_and_back` | Sarge | bank 1 trip | after `report_in` | 50 silver + 1 pistol box |
| `evidence_locker` | Mags | bring home a carbine (always at the police station) | after `bring_iron` | 1 grip + 60 silver |
| `headhunter` | Mags | 15 headshots in one trip | gate 2 | 150 silver |
| `ghost_walk` | Mags | as Night, 8 finds in a trip at level 3+, no noisy search | gate 4 | 1 suppressor |
| `hold_the_line` | Sarge | 10 hordes in total (levels 1-4 give 2+2+3+3) | after `out_and_back` | 1 knife (silver if carried) |
| `shove_and_stab` | Sarge | as Rex, 30 landed shoves in a trip | gate 2 | 120 silver + 3 bottles |
| `fast_hands` | Sarge | as Bear, 50 kills in a trip at level 4+ | gate 4, owns carbine | 150 silver |
| `patch_up` | Doc | use 2 medkits in total | after `pharmacy_run` | 1 medkit + 40 silver |
| `steady_hands` | Doc | 3 banked trips in a row at level 2+ | gate 2 | 2 medkits |
| `run_for_it` | Doc | as Kat, bank a level 3+ trip in 480 s or less | gate 3 | 1 medkit + 100 silver |
| `firestarter` | Cinder | 10 burning kills in total | after `first_smelt` | 1 flame kit + 60 silver |
| `big_game` | Cinder | 1 brute kill in a trip | gate 5 | 1 acid kit + 100 silver |
| `magpie` | Cinder | as Kai, 20 finds in one banked trip at level 3+ | gate 3 | 1 piercing kit |
| **Jobs** (one per stall, silver ×1, ×1.5 or ×2) | | | | |
| `job_range_day` | Mags | 25 kills in a trip | | 40 / 60 / 80 |
| `job_quiet_hands` | Sarge | 15 landed shoves in a trip | | 30 / 45 / 60 |
| `job_field_dressing` | Doc | pick up 2 bandages in a trip | | 30 / 45 / 60 |
| `job_shiny_things` | Cinder | bring home 3 jewels | | 40 / 60 / 80 |

Derivations for the gated rows:

- **`ghost_walk`.** Night clatters about 5% a search, so 8 quiet finds in a row succeed about 0.95⁸ ≈ 66% of the time.
- **`run_for_it`.** Level 3's lulls (140 s, then two of 100 s) plus 3 hordes come to about 340-520 s, which puts 480 s near the top. The bot runs tune it.
- **`big_game`.** A level 5 town holds about 1.6 brutes (1% of the crowd).

The table holds every survivor, with Kai's Magpie as row 17. Kits, the forge, fire and big kills are Cinder's; guns, accuracy and the suppressor are Mags'.

## Workshop and reloading press

### The workshop scene

The bench is already a portrait-card scene (#7210): a `SceneCard` with the static `BENCH_CARD`, then the gun strip, part chips, upgrade tiles and kit tiles. Whether that is the scene the Home Loop spec asked for is open question 5.

If it is not, #7246 makes the picture live, using the existing `SceneCard` with no new component pattern:

- The focused gun sits in the vise with its fitted mods drawn on.
- A fitted effect stands as two coloured rounds beside the vise.
- Carried parts lie on the rag.
- A 3-frame spark plays on each fit, move or replace; with reduced motion on, the card simply changes.

It is a pure sprite builder, `src/art/stations/bench-scene.ts`, cached per weapon and fit key.

### Salvage

| Id | Makes | Found in (rank 0 first, rank 1 once rank 0 is used) | Level 1 / 10 | Recipe |
|---|---|---|---|---|
| `fuel_can` | flame kit | cars, any garage container; then warehouse box/shelf | 3 / 5 | 4 |
| `car_battery` | acid kit | outdoor and garage cars; then garage shelf/cabinet | 2 / 4 | 3 |
| `scrap_steel` | piercing kit | warehouse box/shelf/cabinet; then outdoor crates, garage cabinet | 3 / 5 | 3 |
| `sedatives` | tranq kit | pharmacy and clinic; then police lockers, house drawers | 2 / 3 | 2 |

The sources mirror `KIT_SOURCES`. Fuel and batteries come mostly from cars, which take 2 s to search and can set off an alarm. That is the built-in risk of the two dearer kits.

**Placement** (#7238): `placeTownSalvage(sim)` in a new `shared/salvage.ts`, called right after `placeTownTreasure` at its two call sites.

- It does nothing without `sim.homeRun`.
- It uses its own `createRng(seed ^ SALVAGE_SALT)` and never touches `sim.rng`, `entityId()` or the ammo budget.
- It takes only containers still empty after treasure. A town has about 578 containers at level 1 and 608 at level 10, about 425 of them empty before treasure, and treasure takes 36 to 56 (20 seeds each, measured by the workshop designer), so salvage has room.
- A replay halves the counts and rounds down, as `treasureCounts` does.

**Carry** (#7238, #7239): `PlayerHome.salvage` is carried like treasure and is uncapped while carried.

- Walking over it takes it. It uses the existing `pickup` event, so there is no new event.
- On death, `dropCarried` drops one bundle per kind, so a death adds at most 4 pickups. Anyone can take them.
- It is lost when you are downed at the van, for a body left behind, or after the 60 s disconnect grace, all as treasure is.
- It is credited by the receipt (`TripReceipt.salvage?`) and banked on arrival, so an Overrun death in the bunker never costs salvage.

**Bank** (#7240): `HomeSave.salvage` holds up to `SALVAGE_SHELF_CAP = 8` per kind, and the overflow is lost at banking, as ammo over the reserve cap is. The 8 is `KIT_CARRY_CAP` (2) times the largest recipe (4), enough to refill both flame-kit slots. Uncapped, one good run would refill every kit after any death (open question 15).

### The press

- **Rules** (`src/game/home/press.ts`, #7241). `pressKit(save, effect)` takes the recipe's salvage and adds 1 to `locker.kits[effect]`. It returns null when you are short, or when locker plus hands already hold `KIT_CARRY_CAP`. The cap helper comes out of `shop.ts`'s private `held()` as a shared `kitsHeld`, so the shop and the press count the same way.
- **Timing works like the forge.** `PRESS_SECONDS = 6` per kit, twice a 3 s jewel. It runs only while `home.station === 'press'` and a recipe is picked, one kit at a time.
  - Stepping away or switching recipe resets the timer, and a part-pressed kit keeps its salvage.
  - Each finished kit is one `save()`. A conflict re-reads and stops; a failed save takes nothing.
  - The ticking is in `press-run.ts`, called from one line beside `watchForge`.
- **Output goes to the locker**, as purchases do, so there is no packet and no `equip` round trip (open question 14).
- **Balance:**
  - A player who finds a third of a level 1 town (10 pieces) gets about 3.3 pieces. At an average recipe of 3, that is about 1.1 kits a trip, worth about 175 silver at Cinder's prices, against about 260 silver of treasure.
  - One chosen kind takes 3 to 4 trips of salvage at level 1, against about 0.8 trip of silver at Cinder. The shop stays the fast route and the press the cheap one.
  - When the Overrun kills or thins Cinder, the press keeps special rounds within reach.
  - Implied values are kit price divided by recipe: flame 200/4, acid 150/3 and piercing 150/3 are 50 each, tranq 120/2 is 60. Any later buy price for salvage, or quest reward made of it, stays at or under half of that, so selling never beats pressing.
- **Station** (#7244, lands last).
  - `press` at (144, 304) in the Workshop, just south of the forge, with its customer point at (144, 324).
  - That is 80 px from the forge's point (144, 244), and the hall door and quarters door stay clear.
  - `PROP_DEFS.press` is 20x8, the jukebox's size.
- **Screen** (#7243). `PressScreen` follows `ForgeScreen`:
  - a scene card;
  - `PressLedger`: four salvage rows against the shelf cap, a 10-slot press bar and the time left;
  - `PressTiles`: four recipe tiles showing have/need and the locker count against 2. Arrow keys step through them as on the difficulty cards (#7192). Enter picks a recipe and starts the press; picking it again stops it.

  `TreasureChip` gains salvage icons, and `DeathSummary` lists salvage lost.
- **Art** (#7242): four 15x15 salvage icons and bob clips, which are required because `pickupIcons` and `pickups` are keyed by `PickupType`; a press bunker prop; a 56x40 press scene card; and one press-stroke sound.
- **Co-op**: carried salvage is per player and dropped salvage is shared. The bank and the press are per browser. The town's salvage does not grow with the party, which is accepted, as it is for treasure, and the soak (#7245) reports it.

## Perks

The recommendation is **not to build perks now** (open question 11).

1. **Damage perks do nothing on a finished gun.** `GUN_POWER_CAP = 1.5` (`shared/gun-upgrade-data.ts:47`) is enforced inside `gunStats()` on burst damage per second. A finished gun already sits at the cap, so a damage or fire-rate perk inside `gunStats` is clamped to nothing. One applied outside it breaks the cap.
2. **The free axes belong to the survivors.** `shared/characters.ts` gives each survivor one: sight and noise (Night), reload (Bear 0.75), speed (Kat 1.12), shove (Rex 1.5) and loot (Kai). A perk on any of them blunts the pick. Reload is worst because the cap ignores it. Bear 0.75 × three reload ranks (0.55) × Slick latch (0.8) is already about 0.33 of stock reload time.
3. **What is left is small or tuned for balance.** Medkit heal and bleed-out are scaled per difficulty. The carry caps are the only guard on ammo across trips.
4. **There are already five build layers**: trait, upgrades, quirks, round effect and difficulty.

Quests, costumes and the records wall give the reason to keep playing without adding power.

If Xopher wants perks anyway, the smallest safe form is **Habits**:

- One slot, swapped at the locker, earned by finishing a merchant's quest chain.
- Drawn from a closed `HABIT_AXES` table that excludes damage, fire rate, reload, magazine, the five trait axes, carry caps, ammo, medkit heal and bleed-out.
- Each habit is at most 15%. Examples: search holds 15% shorter; revive 2.5 s instead of 3; bottle range 195 instead of 170.
- A spec asserts `gunStats` output is identical with every habit equipped.

Habits bolt on after quests, so nothing is lost by waiting. There is no task for them.

## Other features

- **Costume locker, #7173 (deep, existing task).** Costume ids are already in `shared/characters.ts`, and quests are an unlock route. Default unlocks (open question 12): one costume per survivor for a banked clear of levels 3, 6 and 9 as that survivor, plus one per survivor through a quest. That covers 3 to 4 extras each. It is cosmetic, so the cap is untouched. #7173 owns the protocol (`costume` beside `skin`, `JoinHome.costume`, server check against `costumesOf(skin)`) and adds the `costume` quest reward kind.
- **Ledger fields (#7247).** `TripRecord` gains optional `score`, `kills`, `hordes` and `seconds`, copied from the receipt in `recordOf`. Old rows still revive.
- **Records wall (#7248).**
  - A `records` station in Quarters, near (240, 336), clear of the locker, the jukebox and the spawn.
  - It shows trips banked and lost, lifetime silver, jewels smelted, best trip, a per-difficulty grid of the highest level cleared, endings, radio finds, costumes, quests done, and overruns held or fled once #7218 writes `HomeSave.overruns`.
  - It reads the ledger, `loadBestTrip`, `loadLevelProgress` and sound unlocks. Nothing goes on the wire.
  - An empty save shows "No trips yet", never filler numbers.
  - Check scope with #7225 (Campaign vs Arcade records) before starting.
- **Decor (#7249).** Posters, rugs and lamps for Quarters, sold by Sarge as a silver sink.
  - Once all three guns are bought, the only silver sinks are consumables, so a long campaign piles up silver. Build it only after the quest soak (#7235) shows that happening.
  - Saved as `HomeSave.bunker.owned` and drawn client-side. It has no effect on the sim.
  - Overrun upgrades such as door bracing are the Overrun spec's to define.
- **Forge Smelt button (#7250).** See "What the bunker has today". Default (open question 10): replace the button with the line "Smelting while you stay" and drop the stub.
- **Van drive-across between bunker and town.** The user asked for this in the same request. It is not a slice of this spec and has no task on the board as of this writing. Notes for whoever builds it:
  - `startTrip()` calls `enterTown()`, and `endTrip()` calls `enterBunker()`, instantly. `run-stage.ts` rebuilds the world on the `mapSeed` change, so a client-only overlay belongs at that seam.
  - Solo keeps simulating in town while an overlay plays, so arrival needs an input and zombie grace, or the overlay must cover only the rebuild.
  - The Overrun clock starts in `enterBunker`, so an overlay on the way home must not eat clock time unnoticed.
  - With reduced motion on, it is a plain fade.
- **Left out of a finished bunker:**
  - a separate mission board: quest markers can go on the garage map rows later;
  - a separate radio room: the Jukebox covers it;
  - merchants buying from you, and delivery quests (open question 13);
  - forthexp, which is blocked outside the game.
- **Docs (#7251).** How to Play and README sections for quests, the press and the records wall, coordinated with the integrator #7146.

## Build order

Dependencies are hard (`deps` on the task) unless marked "lock order", which only serializes edits to one file.

| Task | Slice | Needs | Waits for | Overrun link |
|---|---|---|---|---|
| #7227 | Quest table and pure engine | standard | nothing | none |
| #7229 | Trip tally reducer | standard | nothing | none |
| #7228 | `HomeSave.quests` and revive | standard | #7227 | lock order after #7213 on `home-store.ts` |
| #7231 | Quest view model | standard | #7227 | none |
| #7230 | Wire quests into the save paths and actions | standard | #7227, #7228, #7229 | closed stalls need #7217; until then no stall closes |
| #7233 | HUD tracker, starters replace the hint | standard | #7230, #7231 | the tracker shares the HUD with #7219's clock; place it under the treasure chip |
| #7232 | Merchant Work tab | standard | #7230, #7231, #7199 | "Stall closed" state after #7217 |
| #7234 | "!" marker and stall prompt | light | #7231 | none |
| #7235 | Quest balance soak | standard | #7230 | none |
| #7236 | Receipt counters (only on open question 1) | deep | #7229 | none |
| #7237 | Salvage contract | standard | nothing | lock order with #7213 on `home-protocol.ts` (`chest` then `press`) |
| #7238 | Salvage in towns | standard | #7237 | none |
| #7239 | Salvage on the receipt | standard | #7237, #7238 | bank on arrival keeps salvage out of #7215's bunker deaths |
| #7242 | Salvage and press art | standard | #7237 | none |
| #7240 | Salvage in the save | standard | #7237, #7228 | migration order step 4 |
| #7241 | Press rules and ticking | standard | #7240 | pressing spends Overrun clock at the menu rate, since any open station counts |
| #7243 | Press screen, chip, death summary | standard | #7241, #7242, #7239 | none |
| #7244 | Press on the bunker map (last) | light | #7243 | lock order with #7213 on `bunker-map.ts` |
| #7245 | Salvage and press soak | standard | #7239, #7241 | none |
| #7246 | Live bench scene (only on open question 5) | standard | nothing | none |
| #7247 | Ledger fields | light | #7228 | none |
| #7248 | Records wall | standard | #7247 | shows overruns once #7218 lands; lock order with #7213 on the map |
| #7250 | Forge Smelt button | light | nothing | none |
| #7249 | Decor | standard | #7235 | Overrun upgrades stay with #7212 |
| #7251 | How to Play and README | light | #7233, #7244, #7248 | coordinate with #7223's docs |

#7173 (costumes) can go any time after #7228, with step 5 of the migration order. The flip (#7146) waits on open question 2.

## Open questions for Xopher

Each has a default the build follows until it is answered.

1. **Quest progress source.** A client-side event tally for kills, headshots, shoves, searches, bottles and medkits: it is lossy if a co-op snapshot drops and never overcounts. The alternative is per-player counters on `TripReceipt` (#7236), which are reliable but are a sim and wire change. Default: the client tally; #7236 waits.
2. **Flip timing (#7146).** Default: flip once quests v1 (#7227-#7233) is in, since the Home Loop spec makes starter quests the new-player path. Costumes, the press, the records wall and decor land after, each station appearing only when its last slice lands.
3. **Allowed reward kinds.** Default: silver and capped items now, and costume unlocks when #7173 lands. Merchant goodwill (+1 of a non-ammo stock row) is left out for now.
4. **A reward over a carry cap.** Default: paid in silver at the shop price, so turn-in never sticks. The alternative is to hold the turn-in until there is room.
5. **Workshop scene.** Is #7210's portrait-card bench the scene you wanted, or should the picture go live, with the gun in the vise, its mods drawn on and a beat on each fit (#7246)? Default: #7210 counts, and #7246 waits.
6. **Quest pace.** Default: one active quest per merchant, four at most, with unaccepted jobs re-rolled after each banked trip. The alternative is to re-roll a job only after it is turned in.
7. **Survivor quests.** Default: offered to everyone, counting only trips played as that survivor, with Kai's Magpie as a 17th one-time row. The alternative is to show them only while playing that survivor.
8. **A merchant killed by the Overrun.** Default: their active quest waits for the replacement at the same stall, with progress still counting. The alternatives are to carry it to the replacement as new, or to cancel it. Overrun-specific quests come later, after #7218.
9. **Decor.** Build it at all, and in co-op does each player see their own decor or the room host's? Default: build it only if the soak shows silver piling up, and each player sees their own.
10. **The forge Smelt button.** Default: replace it with a status line and drop the no-op. The alternative is to make it start and stop the forge.
11. **Perks.** Default: defer them; quests, costumes and the records wall carry long-term progress. The alternative is to build one-slot Habits now.
12. **Costume unlocks (#7173).** Default: a mix, with milestones (banked clears of levels 3, 6 and 9 as that survivor) plus one per survivor by quest. Buying with silver is the other option.
13. **Merchants buying from you, and delivery quests.** Default: no. Keep "merchants do not buy" and leave delivery quests out.
14. **Where pressed kits go.** Default: the locker, which needs no packet. The alternative is straight into hands, to fit at the bench next door, which needs an equip round trip.
15. **Banked salvage.** Default: a shelf of 8 per kind, with the overflow lost at banking. The alternative is uncapped, like jewels.
16. **Recipes, names and sources.** Default: one kind per kit (2 sedatives, 3 batteries, 3 scrap steel, 4 fuel cans); the names as given; and sedatives also in police lockers and house drawers once the pharmacy and clinic are used up. The alternative recipe: every kit also takes 1 scrap steel as a casing.
17. **Press timing and place.** Default: 6 s a kit while you stay, so it spends Overrun time, with the press standing south of the forge at (144, 304). The alternatives are instant pressing, or rearranging the Workshop's north wall to put it right beside the forge.
18. **Difficulty and replays.** Default: quest targets and rewards do not scale with difficulty, and replays count. Only job silver scales, by your own highest level.
19. **Wording.** Default: "Work" as the tab name, the titles and briefs as working names, and one short turn-in line per merchant from a list like the greetings.
20. **A schema marker in the save.** Default: none. Migration is field by field, and `version` stays the compare-and-write counter.
