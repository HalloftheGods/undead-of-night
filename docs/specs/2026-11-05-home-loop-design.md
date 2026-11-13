# Home Loop: design spec

> **Superseded in part (2026-11-13):** home is now an outdoor camp, not an indoor bunker, and the overrun breaks fence sections instead of a blast door. For the map, the stations' places and the breach, read [Outdoor camp (design)](../superpowers/specs/2026-11-13-outdoor-camp-design.md); the rest of this document stands.

Epic: chemx task #7115. An idea from Khronus, shaped with Xopher on 2026-11-05.

The Home Loop turns Undead of Night from one all-or-nothing run into a campaign played from a saved home. You live in an underground bunker, go out to loot a town, and bank what you bring back. This is the first of several specs. It covers treasure, the saved home, the bunker, the van, the forge and the merchants. The forge and merchants are here so that money works from the first trip: jewels become money at the forge, and money buys gear from the merchants. The workshop scene, the overrun, quests, perks and forthexp each get their own spec, and this one only leaves room for them.

## What success looks like

- A new player presses Play and is standing in the bunker.
- A trip out feels like a choice: push on for more, or get to the van and keep it.
- Dying hurts, and never leaves a player stuck.
- Money has something to buy from the first trip, and special rounds can always be saved up for.
- Solo and co-op both work, and repeated trips cannot pile up ammo past the carry caps.
- Old saves load, and nothing changes for players until the switch is flipped.

## The rules

### Treasure

- **Towns hold jewels only, never coin.** Jewels lie mostly in houses and apartments, and most of all in bedroom furniture.
- **The forge turns jewels into silver**, 3 seconds a jewel while you stand at it. Besides the forge, silver comes only from quest rewards and the overrun chest, both straight into the bank.
- **100 silver = 1 gold.** Money is stored as whole silver and shown as gold and silver (`coinText`).
- Each level holds what it was worth when towns also had silver stacks (30 to 45 stacks of 5 to 20 silver), within 5%, with large jewels taking a bigger share as levels rise so a full town smelts in under a minute. `TOWN_JEWELS` in `shared/treasure.ts`:

| Level | Small (40 silver) | Large (200 silver) | Worth once smelted | Was, with stacks | Smelt time |
|---|---|---|---|---|---|
| 1 | 9 | 2 | 760 | 775 | 33 s |
| 2 | 10 | 2 | 800 | 800 | 36 s |
| 3 | 11 | 2 | 840 | 852 | 39 s |
| 4 | 7 | 4 | 1,080 | 1,078 | 33 s |
| 5 | 8 | 4 | 1,120 | 1,102 | 36 s |
| 6 | 9 | 4 | 1,160 | 1,155 | 39 s |
| 7 | 10 | 4 | 1,200 | 1,180 | 42 s |
| 8 | 10 | 5 | 1,400 | 1,405 | 45 s |
| 9 | 11 | 5 | 1,460 | 1,458 | 48 s |
| 10 | 12 | 5 | 1,480 | 1,482 | 51 s |

- A **replay**, a level below the highest anyone in the room has reached, places half as many jewels of each size, rounded down. Each jewel keeps its full value, so a jewel is the same jewel wherever it came from.
- Treasure is placed from its own generator, off the town's seed, as `shared/radio.ts` does, and takes a container only if it was empty. It uses its own id counter, never `entityId()`, both when placed and when a search drops it, because zombie sense timing reads `sim.nextEntity`. A search of a treasure container still makes the luck roll and the bottle roll, so Kai's finds and bottles stay as they are.

### A trip

1. In the bunker, choose gear at the locker and a level at the garage map. Closing the locker puts the gear **in hand**. It is still safe.
2. Stand at the van. When the home save has recorded the trip as open, the player counts as ready. Once everyone standing is ready and has stood there for 2 seconds, the van leaves.
3. Pick up jewels. They count as **carried**, and the HUD shows what they come to in gold and silver, then each size counted.
4. Survive the level's hordes as today, then reach the exit van.
5. The van brings you back and everything you are holding comes home: see below. Reaching it unlocks the next level for everyone aboard.

Every trip gets a freshly generated town. Score, kills and hordes count per trip. The Records page keeps the best trip, recorded when a trip ends, banked or not. Old best runs stay, labelled as classic runs, since a whole run's hordes cannot be compared to one trip's.

### What comes home

Everything on you at the van is yours, found or taken out. The locker holds up to the carry caps and no more:

| Item | Rule |
|---|---|
| Raw jewels | Banked, no cap, for the forge |
| Guns and their mods | One of each gun. If a second copy comes home, the one with more mods stays and the other is stripped, its parts returned |
| Ammo | Magazines empty into your rounds, kept up to each gun's reserve cap, and anything over is lost |
| Medkits, parts, round kits | Up to their carry caps |
| Knife, bottles | Up to their carry caps |

The caps are what stop repeated trips from breaking the ammo balance. A spec proves it.

### Dying

- You lose all carried treasure and everything you took out, guns and mods included. Gear is destroyed, never dropped. Treasure drops in co-op.
- You wake in the bunker with what is stored. A short summary says what was lost.
- **The free pistol:** if you own no gun at all, in hand or in the locker, you are issued a plain pistol at the van, with starting rounds added up to the reserve cap. No bottle comes with it, and it never touches anything else you hold. It comes home like any other gun, so nobody is ever stuck.
- **The van hands over your gun:** boarding with no gun in hand while the locker holds one puts the locker's best gun and its rounds in your hands, then boards you. Best means one with rounds before one without, then the most mods, then the later gun. There is no prompt, so nobody leaves unarmed by accident, and touch players have nothing to answer. Survivors have no empty-handed art, so this is also what keeps the pistol on the sprite honest.
- Dying means trying that level again in a fresh town. Level progress is never lost.
- **Quitting mid-trip counts as dying.** A crash or dead battery counts too. The pause menu warns you before leaving mid-trip. In co-op, a refresh that gets your body back is not a quit.

### The forge

- A machine in the workshop room. Jewels only become money here.
- Smelting takes 3 seconds a jewel, and a small jewel gives 40 silver and a large one 200.
- It only runs while you stay at the forge, so a big haul costs you time in the bunker. Stepping away keeps whatever finished and leaves the rest as raw jewels.
- It is browser-side, so it can never be lost.

### Winning

The first clear of level 10 plays the ending, and play then carries on from the bunker. A later clear is a normal trip. In co-op, each player who had not finished the game watches it on their own screen while the room carries on, and the rest stay in the bunker. Any level reached can still be chosen. The 1.5 times power cap stays, and is enforced at runtime by `gunStats`.

### Difficulty

Chosen on the setup page as today and fixed for the session. In co-op the first player into an empty room sets it. It does not scale treasure. The ledger records it.

## The bunker

A small, fixed, hand-built map about 40 tiles wide, in concrete, pipes and warm light. Rooms:

- **Bunks:** your locker.
- **Workshop:** the bench and the forge.
- **Blast door:** sealed in this spec. The overrun horde comes through it later, in the market hall's west wall: see [Overrun (design)](#overrun-design).
- **Main hall:** four merchant stalls.
- **Garage:** the van and the level map. Standing at the van with no level picked picks the furthest the room has reached, so the map is only for going somewhere else. A pick clears when the van leaves.

It holds no zombies in this spec. Guns cannot fire there. Town rules (flood, blackout, snow) do not apply.

Walking up to a station and holding E opens it, the same way searching a container works. The bench opens the workbench screen for that player alone, with a Close button and no van timer, and works on gear in hand. The stop between towns goes away in home mode.

Arriving heals you to full. A first visit shows a one-line hint pointing to the van. Every new game starts in the bunker, and the title's level picker goes away in home mode.

## Merchants

Four people keep stalls in the main hall. Each stands behind a stall as a solid figure, and holding E opens their shop, with a portrait and one greeting line from a short list. There are no dialogue trees in this spec. The names are working names and easy to change.

| Merchant | Sells | Silver | Stock |
|---|---|---|---|
| **Mags**, gunsmith | Pistol | 50 | Always |
| | Carbine, once level 2 is reached | 300 | Always |
| | Shotgun, once level 3 is reached | 400 | Always |
| | Barrel, grip, magazine | 120 each | 2 parts, rolled |
| | Suppressor, once level 4 is reached | 200 | 1 in 2 trips |
| | Toolkit | 150 | 1 in 3 trips |
| **Sarge**, quartermaster | Pistol ammo, 8 rounds | 10 | 2 boxes |
| | Carbine ammo, 15 rounds | 20 | 2 boxes, shown if you own a carbine |
| | Shells, 4 rounds | 20 | 1 box, shown if you own a shotgun |
| | Bottle | 5 | 3 |
| | Knife | 100 | 1 |
| **Doc**, medic | Medkit | 60 | 2 |
| **Cinder**, powder maker | Tranq kit | 120 | 2 kits, rolled across the four kinds |
| | Acid or piercing kit | 150 | |
| | Flame kit | 200 | |

- **Prices are starting numbers.** A level 1 town holds jewels worth 760 silver once smelted, so a player who finds a third of it earns about 253 a trip, after the forge. The spending half of the soak tunes them.
- **Shop guns are a convenience.** Every town still has a carbine at the police station and a shotgun at the gun shop, free if you can reach them. Buying one saves you that run after a death. Level gates read the player's own highest level.
- **Ammo stays scarce because stock is small, not because it is dear.** Sarge's full stock is about 12% of a level 1 town's ammo. Boxes scale with difficulty as town pickups do (`scaleRounds`), so Undead Tired boxes hold fewer rounds. A spec holds bought ammo under 15% of the town's budget. Each co-op player has their own stock while the town does not grow, which is accepted, and the balance spec reports it.
- **Everything bought goes to the locker,** so it is safe until you take it out. Caps and "own" count the locker and gear in hand together, so shops are no way past the carry caps. A box is refused unless all of it fits. A gun you own is not offered, and a bought gun comes empty.
- **A sale** writes the money, the stock and the locker in one `save()`. If the save fails, nothing is charged. A version conflict re-reads the save, refreshes the screen and does not retry. Buying is refused unless your station is that merchant and no trip is open.
- **Stock** is held in `HomeSave.shop` per merchant, so the overrun can later mark a merchant dead or thin their stock without changing the shape. A new save rolls it at creation. **Only a banked trip rolls it again,** once per trip, inside the same `save()` as the credit, and each roll replaces all stock. A death or a quit never rolls it, so boarding empty and quitting cannot refill the shops. Rolls use a stored counter mixed with a random value kept in the save, so reloading cannot reroll and saves differ. Boxes are always rolled, and hidden at display if you own no such gun.
- Merchants do not buy anything from you in this spec.
- Prices and stock never push a gun past the power cap, because `gunStats` enforces it at runtime.
- Each player has their own money and stock in co-op. Input is held while a shop is open, but the run is not paused, and the shop closes the moment the station clears.

## Co-op

- Everyone shares one bunker and can see each other. Each player has their own carried treasure, bank and locker.
- Anyone can pick the level at the garage map, up to the highest level reached by anyone in the room. The van leaves once everyone standing is ready. A player with no keys pressed and no station open for 60 seconds stops counting, so one person gone quiet cannot hold the room. They ride along, and their trip opens on arrival the way a joiner's does.
- Someone carried to a higher level than their own unlocks the next level by reaching the van with the party, the same as anyone aboard.
- A room has one map at a time, so **a teammate who dies mid-trip stays in town as a spectator** and comes back at the next horde with the existing return kit. Their carried treasure drops where they fell and anyone can pick it up. Their gear is gone. Whatever they pick up after coming back banks normally, and the return kit comes home with them. Everyone returns to the bunker together, when the party reaches the van or is wiped out.
- A revived player has not died and keeps everything.
- **Downed when the van leaves** counts as dead: carried treasure and gear are lost with the town.
- **Disconnecting counts as quitting.** The body's carried treasure drops after a 60 second grace period for refreshes, or at once if the body was downed. Anyone not back when the van leaves counts as left behind and dead. Closing the tab is never an escape.
- Someone who joins mid-trip lands in the town with what they have in hand, or the free pistol, and that gear counts as taken out.
- When the last player leaves, the room resets to the bunker and any bodies still out count as dead.
- **Bank, locker, forge and shops live only in each player's browser.** The server checks that gear is legal (known ids, slots, caps) but cannot prove it was earned, and a player could lie about their highest level. That is acceptable among friends. It stops being acceptable with leaderboards, which is why forthexp needs server-owned saves.

## The save

- One `HomeStore` interface: async `load()` and `save()`, with a version number. A browser implementation now, a forthexp one later.
- **Every write goes through `save()`,** banking and forge payouts included. The browser store wraps read, compare and write in `navigator.locks`, because a version check alone is not atomic across tabs. It does not use `writeJson`, which hides failures.
- `save()` returns a typed result: saved, conflict or failed. A failed save warns the player. On a conflict a trip result re-reads the save and reapplies under the same key, and a sale stops, as the Merchants section says. A player whose save failed never becomes ready, so a trip cannot start on gear that was not recorded.
- The game saves on closing the locker, after each bench action, on each forge payout, on each sale, when a trip opens, and on each trip result.
- An **open trip** is written before the player counts as ready. Stepping away from the van before it leaves cancels it. On the next load, solo resolves an open trip as a death at once. Co-op holds it until the server says whether the body was reclaimed, for up to 10 seconds, then resolves it as a death.
- A **ledger** records every trip: level, outcome, difficulty, silver, jewels, replay or not. forthexp can turn these into XP, GP and AP later, including trips made before an account existed.
- `outbreak.level-progress` keeps its key and shape. Home data goes under a new key.

## Later specs: what they must do

- **Workshop scene:** replaces the bench screen with a scene where you mod the gun, and adds a reloading press beside the forge that makes round kits from salvage: fuel cans (flame), car batteries (acid), scrap steel (piercing), sedatives (tranq). Salvage is common, carried like treasure, and lost on death.
- **Overrun:** a clock of about 5 minutes starts on arrival and keeps running in menus, with rising warnings until the blast door bursts. Surviving pays a reward chest. Dying there loses only what you carry. Leaving mid-horde kills some merchants and thins the rest, more of them the earlier you ran. A merchant killed this way is replaced at the same stall after about 3 trips, and thin stock refills over the same 3 trips. The full rules are in [Overrun (design)](#overrun-design) below.
- **Quests:** merchants give them, and a new player always has starter quests waiting before their first trip.
- **Perks:** must respect the power cap.
- **forthexp:** needs #5996 fixed first, plus a login route, CORS, a registered leaderboard, and a qualified review of children's accounts under COPPA.

## Overrun (design)

Epic: chemx task #7212. Decided with Xopher on 2026-11-06: menus slow the clock and never stop it. Everything here sits behind its own switch and changes nothing until it is flipped.

Every time the room comes home, a clock starts. When it runs out, the blast door bursts and a horde comes in. The bunker becomes a place to spend fast, not a place to stay. It ends one of three ways: kill the horde and open a reward chest, run for the van and the merchants pay for it, or go down and lose what you carry.

### The clock

The constants live in a new `shared/overrun.ts`. They are starting numbers for the soak (#7223).

| Constant | Value | What it sets |
|---|---|---|
| `OVERRUN_CLOCK_BY_DIFFICULTY` | 240, 180, 150, 120 | Seconds from arrival to the breach at full speed on Night Light On, Stay Close, Lights Out and Undead Tired. `overrunClockSec(difficulty)` reads it; `OVERRUN_CLOCK_SEC` (150, the baseline's) is only what a view without a length is read as |
| `OVERRUN_MENU_RATE` | 0.5 | How fast the clock runs while the room is in menus |
| `OVERRUN_WARNINGS` | 0.5, 0.25, 0.1 | Share of the clock left at each warning: on 150 seconds, 1:15, 0:38 and 0:15; on 120, 1:00, 0:30 and 0:12 |
| `OVERRUN_ARM_FRACTION` | 0.1 | Guns are free from the last warning on: 24 seconds on the longest clock and 12 on the shortest, never more than a quarter of the shortest clock |
| `OVERRUN_FIRST_HIGHEST` | 2 | No clock until someone in the room has reached level 2 |
| `OVERRUN_HORDE_MAX` | 40 | Most zombies one breach sends, for the bunker's floor space |
| `OVERRUN_SPAWN_INTERVAL_SEC` | 0.6 | Gap between zombies coming through the door |
| `OVERRUN_MAX_KILLED` | 3 | Most merchants one flight kills, so one stall always survives |
| `OVERRUN_RECOVERY_TRIPS` | 3 | Banked trips until a stall reopens or a thin stock is full |
| `OVERRUN_CHEST_FINDS`, `OVERRUN_CHEST_STACKS` | 3, 6 | Ammo finds and silver stacks (5 to 20 each, `CHEST_STACK_MIN`/`MAX`) in a chest |

- **It starts on arrival.** The clock starts when the room enters the bunker: `enterBunker` after a trip or a wipe, or the first player into a fresh home sim. Every arrival is a fresh clock of `overrunClockSec(sim.difficulty)` seconds. The span rides in `OverrunState.spanSec` and on `OverrunView.spanSec` (optional on the wire, so a view from an older build is read as `OVERRUN_CLOCK_SEC`), so the warning shares and the door's buckling threshold follow the run's own length. Someone joining later joins the room's clock where it stands.
- **There is no clock on a first visit.** It does not run while the room's highest level is below `OVERRUN_FIRST_HIGHEST`, so a new player learns the bunker in peace.
- **One clock per room.** It is sim state, `sim.overrun`, advanced by `step()` in the bunker branch, so solo and co-op run the same code and the server only runs the sim.
- **Slowed in menus, never stopped.** Each tick takes `TICK_DT × rate` off the clock. The rate is `OVERRUN_MENU_RATE` while every player who counts has a station open, and 1 otherwise. Who counts is who the van waits for: alive and not gone quiet (60 seconds with no key and no station). If nobody counts, the clock runs at full speed. Any station counts: the shops, the locker, the bench, the forge, the garage map and the jukebox.
- **Why half speed.** A full stop would make the clock meaningless. Input is held while a station is open, so a player who goes from screen to screen would only spend clock on the short walks between stations, and the horde would never come. Full speed punishes reading a shop. At half speed, a player who spends the whole visit in screens gets twice the clock and one who wanders the floor gets the clock (5 and 2.5 minutes on Lights Out). A jewel's 3 seconds at the forge cost 1.5. It is also easy to say and to show: "the clock runs at half speed in menus". At 0.25 only the walk would cost anything, and 0.75 is too small a change to notice.
- **Why everyone, not anyone and not each player.** There is one door, one horde and so one clock. If anyone is free to act, the room is acting. It is the same test the van uses, so players learn one rule. With "slowed if anyone is in a menu", one friend parked at the jukebox would stretch the clock for everybody.
- **The solo pause menu stops it.** Pausing solo already stops the whole sim (`LocalSession.setPaused` stops its clock), so the overrun clock stops too, as a town horde does. That is a pause, not a menu. Esc puts a station away before the pause menu opens, so nothing can be bought, smelted or equipped while paused. The co-op pause menu stops nothing and is not a station, so the clock runs at full speed under it. Settled: question 2 below.
- **Leaving before the breach costs nothing.** `startTrip` sets `sim.overrun` to null. The clock is a deadline for shopping, not a sentence.
- **A trip already open.** Saving the open trip and being ready do not touch the clock. A ready player still in the bunker at the breach is in the fight like anyone else. If they die there, the died overrun receipt clears `openTrip` along with their gear in hand, as stepping away from the van does.

### Phases

`sim.overrun.phase` runs `counting`, then `armed`, then `breached`, then `held` or `lost`. `sim.overrun` is null when there is no overrun: switch off, a first visit, out on a trip, or after `held` or `lost` until the next arrival.

| Phase | Starts when | Guns | Stations |
|---|---|---|---|
| `counting` | Arrival | Held, as today | All |
| `armed` | The clock is at `OVERRUN_ARM_FRACTION` (0:30) | Free | All |
| `breached` | The clock reaches 0 | Free | Every open station closes once at the breach, so nobody is caught reading. Merchants refuse to open, their stalls shuttered. The locker, bench, forge, map and jukebox open as normal: input is held and the horde does not wait |
| `held` | The spawn queue is empty and no horde zombie stands | Held again | All, and the chest |
| `lost` | Nobody is standing | Held | All |

Guns are free from `armed`, which gives 30 seconds to take a gun from the locker, load it and choose a spot. A shot before then has nothing to hit, so holding fire until the warning costs nothing and keeps the bunker quiet. `holdFire` in `shared/players.ts` reads the phase instead of the map alone, and fire is held again at `held` and `lost`.

### Warnings

The sim emits `overrun_warning { step, left }` once at each step, then `overrun_breach { hostiles }` and `overrun_end { outcome }`. They are added to `GAME_EVENT_TYPES` in `shared/events.ts`, so the packet guards accept them with no second list. Banners go through `RunNotices`, as an `overrunBanner(event)` beside `hordeBanner`, and show in `WaveBanner.vue`. Sound goes through `AudioEngine.handleEvent`, using sounds the `SFX` registry already has. Music goes through `audio.setScene`.

| When | Banner (title / subtitle) | Tone | Sound |
|---|---|---|---|
| Half the clock left (2:30) | SOMETHING AT THE BLAST DOOR / 2:30 | quiet | `distant_groan` |
| A quarter left (1:15) | THE DOOR IS BUCKLING / 1:15 | danger | `distant_crash` |
| A tenth left (0:30) | IT WON'T HOLD / GUNS FREE | danger | `distant_crash` |
| Zero | THE BLAST DOOR IS DOWN / N HOSTILES | danger | `wave_start`, scene `wave` |
| `held` | THE BUNKER HOLDS / A CHEST BY THE DOOR | hope | scene `bunker` |
| `lost` | none: the death summary shows | | scene `bunker` |

- **The countdown is state.** `RoomHomeView.overrun` carries `{ phase, left, slowed, hostiles, total }` in every snapshot, so a joiner or a slow client that lost an event still shows the right clock. Only a banner can be missed. The times in the subtitles are the clock's own, which pass at half speed in menus.
- **On screen.** A new `OverrunClock.vue` reads BLAST DOOR 4:12, adds the word SLOWED while the rate is below 1, and shows N HOSTILES once breached. It shows over the HUD and over every station screen, since the clock runs there too.
- **Accessibility.** Banners are `role="status"` text, so a sound cue is never the only cue. SLOWED is a word, not a colour. With reduced motion on, the clock neither pulses nor blinks, the burst shake goes through `screen-effects.ts`'s `REDUCED_MOTION_SHAKE`, and the door's frames change without flashing. Screen readers hear the clock at each warning, not every second.

### The blast door and the horde

- **Where.** The bunker as built has no blast door room. The door goes in the market hall's west wall, tile column 0, rows 4 to 6, at the far end of the hall from the garage, so running for the van means crossing the hall. A `blast_door` prop is drawn closed, buckling from the second warning, and burst. The rock stays solid. Zombies come in at `BLAST_DOOR_SPOT`, just inside the door, so the map, its walls and the flow fields never change during play.
- **Size.** The roster is `waveRoster(lastHorde, sim.rng, levelDef(roomHighest), sim.difficulty)`, where `lastHorde` is `levelDef(roomHighest).hordes`: the hardest horde of the furthest town the room has reached, with the difficulty scaling the towns already use (`scaleHordeSize`, `zombieSpeed`, `zombieDamage`). It is cut to what the zombie cap has room for and to `OVERRUN_HORDE_MAX`. `sim.wave` is set to `lastHorde` so `spawnZombie` scales health and speed to match, and `emptyWorld` puts it back when the van leaves. Trip count does not grow it: the horde should match the gear the room has, and gear follows the highest level, while a player replaying low levels for money already pays in time. **Open:** question 4.
- **Spawning.** Zombies come through the door one at a time, every `OVERRUN_SPAWN_INTERVAL_SEC`, at `openGroundNear(BLAST_DOOR_SPOT)`, each with `horde = true`, mode `hunt` and `HORDE_SPEED_SCALE`, as `trickleSpawns` does. `waves.ts` stays frozen: the overrun uses its exported `waveRoster` and `spawnZombie` and keeps its own small trickle in `shared/overrun.ts`.
- **No give-up timer.** A town horde gives up after `HORDE_MAX_SEC`. This one hunts until it is killed or the room leaves.

### How it ends

**Kill the horde (`held`).** Everyone in the room at that moment gets a chest, the dead included, since they stand back up then.
- The chest stands at `CHEST_SPOT`, in the hall's south-west corner, clear of every station's circle. It is a station, `chest`, live only while that player's chest is unopened. Holding E opens it, and the sim rolls it and writes a held receipt.
- The roll uses tables that already exist, in a new `shared/overrun-chest.ts`. It makes `OVERRUN_CHEST_FINDS` draws from `CONTAINER_LOOT.police` through `rollFind`, as full boxes (`scaleRounds` of the `AMMO_PICKUPS` rounds, not the half-used drawer rule). It adds one medkit, `OVERRUN_CHEST_STACKS` silver stacks of 5 to 20 silver each (`CHEST_STACK_MIN`/`CHEST_STACK_MAX`, 75 on average, about a tenth of a level 1 town; the chest is the one place silver still comes as coin), and one small jewel once the room's highest level is 5 or more.
- The chest goes to the locker through `mergeHome`, so the carry caps hold. Silver and the jewel go to the bank.
- If the van leaves before a chest is opened, `startTrip` writes that chest's receipt first, so leaving never costs a chest. A player who disconnects before opening theirs loses it.

**Run for the van (`fled`).** Leaving mid-horde means the van leaves the bunker while `breached`. Ready and the 2 second hold work as they do now, and the downed cannot board, as in town.
- At departure the sim writes a fled receipt on every body, with `share = (spawnQueue.length + standing horde zombies) / roster size`. That is 1 at the breach and falls toward 0 as the horde dies. "The earlier you ran" is this share.
- Each player's client applies the casualties to their own merchants, from the receipt. It kills `ceil(share × OVERRUN_MAX_KILLED)` merchants: 3 for a share above 2/3, 2 above 1/3, and 1 for any share above 0. They are picked from the living merchants with the shop's stored rng (its seed and roll count, as `rollStock` does), so reloading cannot reroll them. One stall always survives.
- A killed merchant's stall is emptied and gets `closedTrips = OVERRUN_RECOVERY_TRIPS`. Every survivor's stock counts drop to a quarter, rounded down, with `thinTrips = 3`.
- **Recovery.** Each banked trip's `rollStock` counts a closed stall down, and at 0 a replacement opens at the same stall with a full roll. A thin stall counts down first, then rolls at `1 − thinTrips / 4` of its counts: a quarter at the flight, then a half, three quarters and full. Only banked trips roll stock, so dying and quitting cannot speed recovery up. What is always on the shelf (Mags' guns) has no count, so a thin gunsmith still sells guns. A dead one sells nothing until replaced, and the free pistol still means nobody is stuck.
- A body downed or dead in the bunker at departure gets a died receipt and loses its gear in hand. It then rides along the way a gone-quiet player does: it lands on its feet under the free pistol rule, and its trip opens on arrival like a joiner's.
- The client applies a fled receipt as soon as it sees it, in town, in a save of its own, so dying on that trip does not undo it.

**Go down (`died`, `lost`).** Dying in the bunker costs only what you carry, and in the bunker that is the gear in hand (`HomeSave.hands`, what the body holds). There is never carried treasure in the bunker. The locker, the bank, raw jewels and the stock are untouched.
- Solo, nobody can revive you, so bleeding out leaves nobody standing (`standingPlayers` counts the downed) and the overrun is `lost`.
- Co-op, the downed can be revived as in town. A bleed-out writes a died receipt at once. The body stays dead and watches until the overrun ends, then stands at the spawn, healed and holding nothing.
- Nobody standing makes it `lost`. Every body still holding gear gets a died receipt, the horde goes back out through the door (every horde zombie is removed), and everyone stands at the spawn, healed. No merchant dies when the bunker falls. Settled: question 5. The overrun is over until the next arrival.
- **Quitting, a crash or a disconnect while `breached` counts as dying there.** The client writes `HomeSave.openOverrun` when it first sees `breached`. If it is still there on load, it resolves as a died overrun and the gear in hand is lost: at once in solo, and in co-op once the server answers `resumed` or `OPEN_TRIP_WAIT_MS` passes, as an open trip does. Quitting before the breach costs nothing.

### Co-op

- One clock and one horde per room, both in the sim. `server/room.ts` needs nothing new.
- The clock is slowed only while everyone who counts has a station open.
- Each player gets their own chest roll, their own casualties on their own merchants, and their own died receipt. Teammates' stalls can differ, so each client draws its own player's stalls.
- Someone joining during the countdown joins the room's clock. Someone joining during the breach arrives in the bunker with the gear they bring and is in the fight.
- `viewFor` drops other players' overrun receipts, as it does their trip receipts.
- The overrun adds one small room view to the snapshot, and a spec checks that a full horde's snapshot stays under `MAX_PACKET_BYTES`.

### Wire and save

- **Wire.** `shared/home-protocol.ts` gains `OverrunView` on `RoomHomeView.overrun`, and `OverrunReceipt` on `HomeView.overrun`: `{ simId, serial, outcome: 'held' | 'fled' | 'died', share, chest: Loadout | null, silver, jewels, lost: Loadout | null, kills, seconds }`. Its serial comes from `run.nextReceipt`, so `${simId}:${serial}` stays unique across both kinds of receipt and `appliedReceipts` takes overrun keys unchanged. The next arrival in the bunker clears the last overrun receipt. `setOut` does not, so a fled receipt reaches the client in town.
- **Save.** `HomeSave` gains three things:
  - `overruns: OverrunRecord[]`, each `{ outcome, share, highest, difficulty, kills, merchantsLost: MerchantId[], silver, at }`. It is a list of its own, so `ledger` stays a list of trips for the Records page and forthexp.
  - `openOverrun: { simId, mode, startedAt } | null`.
  - `shop.merchants[id].closedTrips` and `thinTrips`, which use the room the Merchants section left in `HomeSave.shop`.
- Every write goes through `save()`, with the applied key in the same save as the credit. Old saves load with `[]`, `null` and 0.
- `outbreak.level-progress` keeps its key and shape. No level progress changes in the bunker.

### The switch

`OVERRUN_LIVE = false` sits in `shared/home-protocol.ts`. `SimulationOptions.overrun` is off by default. The solo session and the renderer ask `overrunOn(search, dev)` in `src/game/home-mode.ts`, which is `OVERRUN_LIVE`, or a dev build with `?overrun` in its address. `server/server.ts` passes `overrun: OVERRUN_LIVE` alone, so a co-op room has no dev switch and runs the overrun only once `OVERRUN_LIVE` is flipped. The overrun has its own switch because the home loop shipped first and the overrun needed its own soak. With it off there is no clock, so every existing home spec stays green. The flip is the user's call, made after the soak report in `tests/overrun-soak.spec.ts`.

### Build order

| Task | Slice | Needs | Waits for |
|---|---|---|---|
| #7213 | Contract: types, shells, switch, map spots, no behaviour change | deep | nothing |
| #7214 | Clock, slow rate, phases up to `armed` | standard | #7213 |
| #7215 | Breach, horde, gun rule, bunker deaths and `lost` | deep | #7214 |
| #7216 | Reward chest | standard | #7215 |
| #7217 | Flight, merchant casualties, recovery | standard | #7215 |
| #7218 | Save: receipts applied once, open overrun, records | standard | #7216, #7217 |
| #7219 | HUD clock, banners, sound, reduced motion | standard | #7214 |
| #7220 | Door, chest and empty-stall art | standard | #7213 |
| #7221 | Death summary, chest card, closed-stall card | standard | #7218 |
| #7222 | Co-op over real sockets | standard | #7215, #7217 |
| #7223 | Soak, docs, the flip | standard | all of the above, and approval |

### Open questions for Xopher

These are the calls only Xopher can make. Settled ones are marked; the others keep the default the build follows until they are answered.

1. **Settled:** half speed in menus (`OVERRUN_MENU_RATE`), and a clock that depends on difficulty: 240, 180, 150 and 120 seconds (`OVERRUN_CLOCK_BY_DIFFICULTY`). The first settling was a flat 300 seconds; the user changed it after seeing it, because 300 felt like too much waiting, and made the hardest run the shortest. The soak (#7223) reports at each difficulty's own length.
2. **Settled:** the solo pause menu stops the clock, as a true pause. Leaving the tab pauses solo too, so a phone call costs nothing.
3. **Default kept, not yet confirmed:** should the first visit be free of the clock (no clock below level 2), or should it run from the very first visit? Default: free.
4. **Settled:** the horde is sized by the room's highest level only, capped at 40.
5. **Settled:** spared. When the bunker falls (`lost`), should the merchants be spared, or die as in a flight at share 1? Default: spared, so dying costs gear and running costs merchants, a real choice.
6. **Settled:** yes, any merchant can die, Mags included. Can Mags the gunsmith be killed? Default: yes, since the free pistol still means nobody is stuck.
7. **Default kept, not yet confirmed:** should a replacement merchant keep the same name and portrait, or get a new one? Default: the same, since the names are working names.
8. **Settled:** one each. One chest per player in co-op, or one shared chest? Default: one each, since banks and lockers are per player.
9. **Default kept, not yet confirmed:** should leaving while `armed` (door holding, guns free) cost anything? Default: no, only the breach does.
10. **Default kept, not yet confirmed:** should the co-op pause menu count as a menu? Default: no. The sim cannot see it, and it would need a new packet.

## How it is built

These decisions were checked against the code.

1. **Walls are data.** `WorldMap` gains optional `walls`, `exit` and `stations`. `wallBoxes()` returns `map.walls` when set. No new `BuildingKind`, so the tables keyed by it and `building-layer.ts` stay untouched. Walls draw as an appended `bunker_wall` tile, and `map.districts` name the rooms.
2. **The bunker is a reserved seed.** `BUNKER_SEED = -1`, and `generateWorldMap` dispatches on it, so welcome and snapshot packets need no new field. `isBunkerSeed(snapshot.mapSeed)` is the client's signal. `sim.level` is 0 there, which clamps to level 1's look and triggers no town rule and no unlock. Phase stays `intermission`, `step()` skips waves and population on the bunker, and the HUD, `run-stage` and audio each branch on the signal, so they show no horde timer, level card or town weather.
3. **One switch.** `home?: boolean` on `SimulationOptions`, off by default. `HOME_LOOP_LIVE = false` in `shared/home-protocol.ts` is the only flip, so players see nothing and existing specs stay green on `main`. (Superseded: `HOME_LOOP_LIVE` and `?home` are gone, and the player chooses Campaign or Arcade for each run. The overrun keeps a switch of its own, see [The switch](#the-switch).)
4. **The sim holds carried treasure and gear in hand.** Bank, locker, forge, shops and ledger stay in the browser, so they never go on the wire. The one privacy change to `viewFor` is that it drops other players' receipts.
5. **Home packets.** `ClientPacket` gains `{ type: 'home', action }`, `GameTransport` gains `sendHome`, `GameSimulation` gains `homeCommand`, and `server/home-packets.ts` parses it. `HomeAction` is `pick_level`, `equip`, `ready`, `leave_station` and `highest`. A join carries the same gear and highest level. Gear the server refuses stays in the locker: the client debits only what comes back on `PlayerEntity`, and a bad loadout gets the free pistol.
6. **The van waits for ready.** `exitBoarded` counts `ready` riders. The sim cannot wait on an async save, so the client saves the open trip first and then sends `ready`. This reuses the 2 second hold, with `sim.exit` pre-opened at a fixed spot and a destination added.
7. **Trip results are state, not events.** A slow client can lose an event, so `PlayerEntity.home.receipt` carries the result. A receipt holds an id unique to the sim, a room-wide serial that no reset or restart puts back, the outcome, level, difficulty, silver, jewels, replay, score, kills, hordes, duration, the ending flag, and the gear that came home. On a death, its silver and jewels are what was lost, and are never credited. The applied key is stored in the same `save()` as the credit, so a refresh cannot apply it twice and a new sim's serials are never mistaken for old ones. Only connected players get a banked receipt, because a departed body counts as dead. A new trip clears the last receipt.
8. **Fresh towns.** `levelSeed(runSeed, level, attempt = 0)`, with attempt as the room's trip serial. Attempt 0 gives today's seeds exactly.
9. **Stations reuse the search pattern,** a per-player hold on E, so `ClientInputPacket` and `parseInput` do not change. Each merchant is a station and a solid prop, and a shop is a client screen over the store, so merchants add no packets.
10. **The bench is per player.** `p.home.station === 'bench'` passes the `benchCommand` gate, `openBench` is off in home mode, and `sim.bench` stays null. After each action the client saves gear in hand from `loadoutOfEntity(entity)`.
11. **Unlocks move.** New `recordLevelCleared(n)` sets highest to at least n+1 from a banked receipt. `recordLevelReached` comes off the home path, or a carried player would unlock on arrival.
12. **Solo uses one long-lived sim** across trips, and welcome sends `sim.map.seed`.
13. **The ending has its own seam.** A receipt flagged as the ending shows `EndingFlow` over the live session, and when it finishes the player is back in the bunker, without `toMenu()`. Results are recorded from receipts, because a trip's end no longer passes through `enterGameOver`.

## Lanes

The work splits so every file has exactly one owner. Agents use chemx throughout: claim the task, lock each file, commit small and green on `main`, with no worktrees or side branches.

### Order

1. **Prep, in parallel.** Pure moves with no behaviour change, one commit each.
   - P1 `shared/simulation.ts` into `sim-factory.ts`, `snapshot-build.ts`, `run-end.ts`. The public class stays the same, and `private readonly sim` keeps its name because the frozen harness reaches into it.
   - P2 `GameEvent` into `shared/events.ts`. Pickup and event names become `as const` arrays with the unions derived from them, and `packet-guards.ts` reads those. Today one unknown pickup or event silently freezes every co-op client.
   - P3 `src/game/game-controller.ts` into `run-session.ts`, `snapshot-handler.ts`.
   - P4 `server/server.ts` into `limits.ts`, `restart-vote.ts`, `room.ts`.
2. **Contract, one deep agent, one commit.** Shared types in `shared/home-protocol.ts`, protocol additions including decision 5, sim shells, stubbed hooks, a stub bunker map, a minimal `tests/helpers/home-harness.ts`, the client seams (`ConnectOptions`, `sendHome`, `HomeStore`, `UiState.home`, `GameController.home`), `StationId` rows for the four merchants, the four props registered in `environment.ts` from a stub `merchants.ts`, `ArtBook.merchants` in `src/art/types.ts` and `index.ts`, `HomeSave.shop`, `UiState.home.shop` driven by `p.home.station`, `GameController.home.buy`, a stub `src/game/home/shop.ts` with pure `rollStock` and `buy`, a stub `MerchantScreen.vue`, placeholder art and sound rows including the `town-map.ts` tile row, and the `tests/world-map.spec.ts` change that `bunker_wall` requires. It changes no behaviour. It is reviewed before any lane starts, because a wrong signature costs every lane.
3. **Seven lanes, in parallel.** The stubs `takeTreasure`, `dropCarried`, `placeTownTreasure` and `updateStations` let trip-loop and bunker-world work side by side, and specs that need both wait until both have landed.
4. **Integrator, serial, once the flip is approved.** Flips `HOME_LOOP_LIVE`, renames level 6 to **Blackout** and moves its track (see below), rewrites the specs the flip breaks, updates How to Play, analytics, the Privacy text and the docs, runs the real-browser loop, then the one full suite, `chemx verify` and `chemx audit`.

### The seven lanes

| Lane | Needs | Waits for | Owns | Builds |
|---|---|---|---|---|
| bunker-world | standard | contract | `shared/`: `bunker-map`, `stations`, `treasure`, `world-map`, `world-query`, `exit-van`, `town-rules`, `pickups`, `container-search` | The real map, stations, treasure rolls and drops. Each stall is a `counter` prop with the merchant behind it, and the station point is on the customer's side |
| trip-loop | deep | contract | `shared/`: `simulation`, `sim-factory`, `snapshot-build`, `snapshot-view`, `run-end`, `trip`, `loadout`, `sim-state`, `level-change`, `level-exit`, `levels`, `player-health`, `player-roster`, `players`, `workbench`, `protocol`, `events`, `home-protocol`; `tests/helpers/home-harness.ts` | Trips, what comes home, receipts, death, loadouts, ready, per-player bench, the 60 second rules, blocking guns in the bunker |
| net-save | standard | contract, trip-loop for socket specs | `server/`; `src/network/`; `src/game/home/` except the merchants lane's files; `src/game/level-progress.ts`, `storage.ts` | Home packets, the store, ledger, forge rules, long-lived solo sim, empty-room reset, calling `rollStock` when a banked receipt is applied, the soak and socket specs |
| client-run | standard | contract, trip-loop, net-save | `src/game/`: `game-controller`, `run-session`, `snapshot-handler`, `run-stage`, `client-world`, `hud-state`, `home-hud`, `run-hud`, `run-notices`, `level-hud`, `bench-view`, `bench-link`, `input-manager` | Title to bunker, wake after death, walk-up bench, ending return, recording from receipts, HUD state, the input hold for shops, wiring `home.buy` |
| screens | standard | contract | `src/App.vue`; `src/components/`: `LockerScreen`, `ForgeScreen`, `GarageMap`, `LevelGrid`, `DeathSummary`, `TreasureChip`, `HudOverlay`, `WorkbenchScreen`, `GameOverScreen`, `EndingFlow`, `VictoryScreen`, `PlaySetup`, `LevelsPage`, `TitleScreen`, `PauseMenu`, `RecordsPage`, `DifficultyPicker`; `src/game/title-menu.ts`, `level-select.ts` | Every new screen, mounting `MerchantScreen` and its cursor rule in `App.vue`, the mid-trip quit warning, classic-run labels, built only against `UiState.home` and `GameController.home` |
| merchants | standard | contract, net-save for the store | `src/game/home/`: `merchant-data`, `shop`; `src/components/MerchantScreen.vue`; `src/art/environment/merchants.ts` | The merchant table, stock rolls, buying, the shop screen, merchant sprites and portraits, and the spending soak: pure `shop.ts` over a `HomeSave`, with a bot that buys ammo, then a medkit, then a carbine |
| look-sound | standard | contract | `src/engine/`: `world-renderer`, `level-look`, `entity-renderer`, `overlay-renderer`, `fx-director`, `scene`; `src/art/`: `environment`, `environment/bunker-props`, `environment/tiles`, `fx/pickups`, `fx/icons`, `fx/treasure`, `level-thumbnails`; `src/audio/`: `playlists`, `music`, `audio-engine`, `soundtrack`, the sfx files; `src/game/sound-test.ts`, `level-swatches.ts`, `town-map.ts`; `src/components/TownMap.vue`; `tools/contact-sheet.ts` | All sprites except merchants, the bunker's look and music, treasure sounds, the small town map |

Each lane also owns its own spec files.

### Shared files

- `shared/protocol.ts`, `events.ts` and `home-protocol.ts` are frozen after the contract. Other lanes ask trip-loop by `chemx team dm`, additive changes only.
- **Frozen, no lane edits:** `tests/helpers/sim-harness.ts`, `bots.ts`, `lone-chase.ts`; `shared/waves.ts`, `town-population.ts`, `loot.ts`, `container-loot.ts`, `containers.ts`; `src/engine/occlusion.ts`, `building-layer.ts`. A lane that needs one asks the orchestrator.
- **Integrator only:** `src/game/how-to-play.ts`, `magazine-hints.ts`, `src/game/analytics/`, `tests/levels.spec.ts`, `docs/README.md`, `docs/CHANGELOG.md`.

### Level 6

At the flip, level 6 is renamed **Blackout**, and `level-06-underground-bunker.mp3` moves to the bunker. Level 6 keeps `level-06-toxic-silo.mp3`, already its second take. The Sound Test lists the bunker track from the start. This waits for the flip so players see nothing early.

## Testing

- **Specs per lane:** treasure leaves the ammo budget and placement rolls alone, Kai's finds and bottles still roll, every room is reachable, what comes home, repeated trips cannot grow ammo past the caps, boarding with an empty locker, dying and smelting, prices and level gates, a sale at the cap counting gear in hand is refused, a box refused at 56 of 60 rounds, a failed save charges nothing, stock survives a reload, ten empty quit-trips leave stock unchanged, bought ammo stays under 15% of the town budget at every difficulty, boarding with bought gear and no gun keeps that gear, old saves load, an open trip resolves as a death, a refresh between receipt and save applies it exactly once.
- **Soak:** a bot loops bunker, trip, death and bank, checking that treasure is conserved except where a rule forfeits it, and reports treasure per trip for tuning. The merchants lane's half reports spending.
- **Co-op over real sockets:** join with gear, refused gear stays in the locker, a new loadout between trips, level pick is capped, the idle rule, a teammate dies mid-trip, downed at departure, disconnecting while downed, an empty room, and a worst-case join stays under `MAX_PACKET_BYTES`.
- **Real browser:** one full loop solo with reduced motion on and off, in co-op, and with two real tabs trying to take the same gear, smelt the same jewels and buy the same stock.
- Lanes run targeted specs. The full suite runs once, at the integrator's gate.

## Risks

- The contract is one large serial step, and trip-loop is the critical path.
- Two flows live side by side until the flip, and the existing specs do not cover home mode. Only the new specs guard it.
- After the flip the old game-over path and `GameOverScreen` stay in the code. Removing them is a large delete and needs asking first, as its own task.
- Default-on analytics gets new events, so the Privacy text must change in the same commit.
- Other agents are working in the game now (#7116 sprites, #7118 snow trackers). The prep and contract must start from their landed commits, and `art/` work needs checking against #7116.
