# Changelog - Undead of Night: Last Round

All notable changes to the Undead of Night: Last Round game are documented in this file.

## [2026-11-12] - Level 100 follow-ups

### Changed
- The progression save moves to `outbreak.progression.v2`. The old key is read once to bring a player over and is never written.

### Fixed
- A tab left open on an old build no longer resets XP and owed AP: it writes only the old key, which is ignored once the new save exists.
- Hosting a solo run from the Pause menu no longer charges AP upkeep in the middle of that run.
- A Dev: Test Drive that is then hosted still banks no XP, for the host and for anyone who joins: the room's welcome now says it is a Test Drive.
- A player who drops out with a head round in the air keeps its headshot bonus as well as the kill (`scorerOf` in `shared/kill-points.ts`).
- A daily run on a day carried over from before level 100 counts as that day's first run.

## [2026-11-12] - Record books start again at level 100

### Changed
- Personal bests, the top-five ledger, the best trip and the daily ghosts start again under `.v2` storage keys: points are now a tenth of the old ones times the town, so old records cannot be compared. The old entries stay in storage and are not shown.
- The daily log moves to `outbreak.daily.v2`. Days played before the change are carried over, so streaks and the streak kit survive; they keep their Counted stamp, kills and town, show no points, and are never the best night.
- The day of the change is not carried over, so its first run on the new scale is the one that counts.

## [2026-11-12] - AP upkeep: one level a week

### Changed
- Each full week past the last level-up removes one pip: banked AP first, then the fullest survivor's fullest stat. Only that survivor goes Rusty, until they gain a pip again.
- The level never drops.
- A lost pip becomes owed AP, and each level-up repays one on top of its own AP.
- Level 100 never decays and shows every survivor OP.
- Saves carry a version. Old saves keep their level, AP and pips, restart XP at 0, and get a week's grace.
- Upkeep is checked on the title, setup and Daily Night screens and at run start, never on a kill, so pips do not vanish mid-run.
- The Character Sheet XP bar shows MAX LEVEL and fills at level 100.

## [2026-11-12] - Level 100 curve

### Changed
- The character level cap is 100, up from 21, still 1 AP per level.
- Level L costs round(40 × L^1.5) XP: 113 for level 2, 40,000 for level 100, 1,620,015 in all.
- XP stops accumulating at level 100.
- Dev: Test Drive runs grant no XP, in every town of the run.

## [2026-11-12] - Town-scaled points and once-per-kill headshots

### Changed
- A kill pays a tenth of the zombie's listed worth times the town number, rounded to the nearest point: a walker is 1 point in town 1 and 10 in town 10. Bosses pay 150, 250 and 400 times their town. Score is still the XP a run earned.
- A kill in the bunker pays as the furthest town reached.
- The headshot bonus is 1 point times the town, paid once, on the head shot that kills. Head hits that do not kill pay nothing, and the headshot streak no longer multiplies points. Headshot damage is unchanged.
- The floating kill text names the chain multiplier only when the chain changed the points; the HEADSHOT text shows the bonus only when the shot paid, and still counts the streak.
- `zombie_die` events carry `chainPaid`.

## [2026-11-12] - Car Handling: Driver's-Seat Steering & Turn Models

### Changed
- Cars steer from the driver's seat: up is gas, down brakes and then reverses, left and right turn the wheel. The wheel only bites while the car rolls, steering flips in reverse, and a parked car stirs on a pedal rather than the wheel alone. Keyboard, left stick and touch stick all send the same four directions.
- Snapshots carry a car's heading to four places, since nothing pulls a steered nose back to a round number.

### Fixed
- The news note told players to press H for the horn, which is heal. The horn is Space (rebindable).
- A car left at an angle against a wall no longer snaps square into it and sticks for good; a turning car sorts and glows by the foot of what is drawn; light bars are built ahead of need and light the car's left half in every facing.

### Added
- Loud cars: a rolling engine carries 460px at a crawl up to 780px at top speed (a shotgun is 420px), pulsing every half second, and an idling engine under a driver is heard close by. The horn carries 720px and sounds far louder.
- Turn models: between its four hand-drawn facings a driven car is drawn from a small solid folded out of its side-on, nose-up and nose-down sprites, at 32 steps round the ring, so a turn runs from the side view to the top-down view. Sprites are drawn on first need and warmed one a frame; police and ambulance light bars turn with the car.
- `tools/car-lineup.ts` shows every body round the ring.

## [2026-11-11] - Bunker Locker 4x12 Grid & World Locker Grid Sizing

### Added
- Bunker locker physical 4x12 grid storage recycling DualLootModal interface with drag-and-drop, orientation rotation, and quick transfer.
- World map locker container dimensions configured as 3x8 grid (replacing restrictive 2x6), fitting rotated firearms and medical supplies.
- Bidirectional loadout-to-grid synchronization module (`bunker-locker-grid.ts`) converting between persisted Loadout counters and physical grid items.
- Dual view modes on Bunker Locker screen: physical 4x12 grid mode and classic shelf strip view, toggleable with V key or button.
- Banked trip loot and overrun rewards auto-packing into existing bunker grid without disturbing saved item layouts.
- Dedicated test suite (`tests/locker-grid.spec.ts`) verifying container dimensions, bunker locker grid packing, loadout conversion, and item positioning.

## [2026-11-11] - Carried Survival Supplies & Inventory Integration

### Added
- Carried survival supplies (bandages, canned food, water bottles, disinfectant, antibiotics) stored in bag inventory without instant consumption on pickup.
- Pocket auto-consumption for survival supplies based on health and needs thresholds.
- Direct USE and DROP action buttons on held item panel within the inventory modal.
- Supply synchronization with bunker locker across banked trip receipts.

## [2026-11-11] - Noise in the Night Daily Newspaper

### Added
- "Noise in the Night" daily newspaper replacing the generic changelog book, featured as book #01 on the News Stand.
- Dedicated portrait-style Issues Rack (`PaperIssuesLayout.vue`) displaying daily issues 5 to a slide with pagination navigation.
- Single-issue printed broadsheet reader (`PaperSingleIssue.vue`) for opening and browsing individual daily issues with page turns.
- Daily issue grouping by ship day, mapped directly to version numbers (e.g. 2026-11-07 becomes Issue 26.11.7).
- Front page broadsheet layout with masthead, dateline, lead story headline, and teases for inside stories.
- Pixel cover art for Noise in the Night displaying woodblock typography, moonlit photo, and newsprint columns.

## [2026-11-10] - Dumpsters, map cache clues, and knife cooldown

### Added
- Searchable outdoor dumpsters in town alleys and lots that can yield random loot: ammo, weapons, medical items, parts, or candy.
- Scrawled map cache clues: empty searches have a 20% chance to reveal a map note that marks an unvisited building with remaining loot on the town map.
- Emergency vehicle loot: searching police cruisers can yield a shotgun or carbine, and ambulances can yield bandages, medkits, antibiotics, or disinfectant.
- Bunker jukebox synchronization: track selection in the bunker quarters syncs across all players in the multiplayer room.

### Changed
- Knife cooldown is reduced, allowing combat knives to strike significantly faster than unarmed shoves.
- Dropped magazines from reloading now hit the floor as ground decals, matching spent shell casings.
- Pressing P in solo play now triggers pause, matching Escape.

## [2026-11-10] - Survival needs, moodles, and fortifications

### Added
- Survival moodle system: hunger, thirst, fatigue, infection, pain, and panic tracked and displayed as flat chip HUD badges in the pickup style.
- Survival items: canned food, can opener, water bottles, disinfectant, antibiotics, and clean bandages.
- Fortifications: barricading windows and doors with wooden planks, nails, and a hammer to withstand horde breaches.
- How to Play survival chapter integrated into the Out of Town guide.

## [2026-11-10] - Town salvage and bunker press station

### Added
- Salvage containers placed across towns containing scrap metal, electronics, cloth, and materials.
- Uncapped salvage carry capacity, with carried salvage dropped on death.
- Workshop press station in the bunker for recycling and processing salvaged materials into usable goods.

## [2026-11-10] - Sewer tunnel maze and street grid

### Added
- Branching sewer tunnel maze running beneath the town with brick channels, ladder shafts, and slow sludge canals.
- Interactive street manholes with two-way ladder access (E: CLIMB DOWN / E: CLIMB UP) between streets and sewers.
- Underground map mode rendering the surface town semi-transparent above the sewer network.
- Utah-style street grid (Center St, 100 South, 200 West) and HUD pixel street sign displayed at top center.

## [2026-11-09] - Town renames: Once Home, Two Lake City, and Threetropolis

### Changed
- Level 1 town renamed from "One Town" to "Once Home" across `shared/levels.ts`, setup screens, how-to-play guide, and sound test.
- Level 2 town renamed from "Two City" to "Two Lake City" across level cards, overrun rules, quest definitions, and retry buttons.
- Level 3 town renamed from "Three Country" to "Threetropolis" across level line titles, grey screamer how-to hints, bench notes, and death screens.
- All dependent test suites updated to assert new town titles and uppercase soundtrack origins.

## [2026-11-09] - A Link to the Past stairs transition and wall-flush positioning

### Added
- LTTP-style stairs transition: walking onto stairs triggers a smooth 700ms sequence consisting of a 350ms fade-out to black with camera and player held at departure, peak black floor switch at 350ms, and a 350ms fade-in to the new floor before player movement unlocks.
- Rhythmic stair footstep cadence: `stairs_taken` schedules 4 crisp `step_hard` footsteps across the transition, with ascending pitches when climbing upstairs and descending pitches when going downstairs or to cellar.
- `stairsFade` overlay channel on `ScreenEffects` with full canvas black wash.

### Changed
- Apartment stairs repositioned from col 7 to col 8 in `shared/storeys.ts`, moving flush against the lobby east wall without interfering with flats or furniture.

### Added
- Reusable `PrintedBook.vue` component providing 3D page turn animations (`mag-leaf`) for all book screens: Town Guide (`TownGuidePage.vue`), Records (`RecordsPage.vue`), and Changelog (`ChangelogPage.vue`).
- Generic page turn planner `planBookTurn` and `openLeavesOf` in `src/game/book-turn.ts` supporting both 2-page spreads and single-page reading modes.
- Responsive mobile query `BOOK_MOBILE_QUERY` automatically activating single pageview on mobile devices (`max-width: 768px`, portrait screens, and touch landscape phones) across all books including How to Play.
- True desktop magazine proportions on `.mag-book` with `1000 / 690` spread aspect ratio and `500 / 690` single page aspect ratio in `magazine.css`.
- Comprehensive Vitest unit tests in `tests/book-turn.spec.ts` covering spread opening, gutter turns, single-page swings, boundary conditions, and mobile queries.

### Changed
- Play setup difficulty and character stat bars (`PickBars.vue`) redesigned into a 2x2 grid that fills the card footer, with larger cells and high-legibility Silkscreen typography.

## [2026-11-09] - Glowing eyes on jack-o'-lanterns and candy bowls

### Changed
- Jack-o'-lanterns and candy pails now only glow at their carved eyes in the dark (`litEyes` in `src/art/environment/halloween.ts`), matching the fiery eye glow and pixel spacing of zombies as a doorstep scare tactic.

## [2026-11-09] - In-game pixel art Radio player with tape deck controls

### Added
- The Radio on the Extras menu: finding a radio in any run now adds a dedicated **Radio** option to the Extras menu on the title screen (`RadioPage.vue`).
- Invisible container arcade presentation (`bare` on `TitlePage`) with floating large pixel heading, centered boxed Back button, and wide centered presentation directly over the scene.
- An authentic in-game pixel art boombox overlay (`RadioDeck.vue` in `src/components/radio/`), placed horizontally across the top with olive case, FM stereo frequency tuner with animated red needle, cassette bay with rotating spools, and tactile tape deck transport buttons with crisp pixel SVG icons and zero text labels.
- Interactive mode switches for Shuffle, Repeat (`off`, `all`, `one`), and Favorites directly integrated on the radio faceplate with colored status LEDs.
- Full-width scrollable tape playlist underneath the radio (`RadioPlaylist.vue`) with quick filter tabs (`ALL`, `FAVORITES`, `FINDS`), live search, and favorite toggles persisted to browser storage (`outbreak.radio-favorites`).
- Extended `Soundtrack` and `AudioEngine` with `pausePreview()`, `resumePreview()`, `seekPreview()`, and `getPreviewStatus()`.
- Comprehensive Vitest unit tests in `tests/radio-player.spec.ts` covering favorites persistence, shuffle exhaustion queues, repeat modes, and manual navigation, plus updated menu tests in `tests/title-menu.spec.ts`.

## [2026-11-09] - The dry-gun call over the head

### Added
- When the gun in hand runs its magazine dry, a flashing red call over the local survivor's head says what to press next (`ammoPrompt` in `src/engine/ammo-prompt.ts`, drawn by `OverlayRenderer.drawSearch`): `R: RELOAD!` while that gun has spares, the number key and name of the first carried gun that still fires when it has none (`1: PISTOL`), and `F: SHOVE` (`F: STAB` with a knife) when every gun is empty. Touch players read the word without the key. It goes quiet once a reload starts, when not alive, and in the bunker; it sits one line above a search bar or a search/station prompt rather than over it. The HUD footer's `Press R` / `Press 1` stays as it was.

## [2026-11-08] - The backpack ring on a desktop, and the old touch bar removed

Finishes `docs/superpowers/specs/2026-11-08-hud-mobile-design.md`: piece 3, and the spec's open questions answered in it.

### Added
- A middle-click opens the backpack ring on a desktop and closes it again (`InputCallbacks.onBackpack`, `GameController.toggleBackpack`). While it is open the scroll wheel steps the highlight round the ring instead of cycling guns (`stepSlot` in `src/game/backpack-wheel.ts`, caught in the capture phase so the game's own wheel listener never sees it, one notch per `WHEEL_COOLDOWN_MS` so a trackpad's flurry is one step), `Enter` or `Space` uses whatever it walked to, a click on a slot uses that, and `Esc` or a click outside closes it. `Esc` spends itself on the ring and does not also open the pause menu. Nothing can start a shot while the ring is up, and a trigger already held is let go (`InputManager.letGoButtons`), though the survivor keeps walking: the ring follows them, and on touch the left thumb walks straight through the ring's catcher (`data-touch-walk`).
- `standingInTown` (`src/game/hud-state.ts`): on their feet in a town with nothing up over the game. The ring is gated on it, and every publish re-checks it, so pausing, the map, the workbench, going down or the run ending closes the ring from wherever the news arrives.

### Changed
- `backpackOpen` lives in `UiState`, so the phone's Backpack button and a desktop middle-click open one ring from one piece of state. `BackpackWheel.vue` moved out of `TouchControls.vue` into `App.vue`, and `TouchControls.vue` no longer takes props.
- The real pointer comes back while the ring is open (`aimsCursor`), since its slots are clicked.
- The ring is marked `data-touch-ui`, so a finger on it is a tap and never a shot or a stick drag.
- `.is-touch .hud` is one rule for both orientations instead of two that each padded one axis: the buttons are a corner block, so the HUD keeps off the safe-area insets on all four sides and reserves no strip for a bar.

### Removed
- The old rectangular touch bar, dead since the buttons became a corner cluster: `.touch-pad`, `.touch-button`, `.touch-glyph`, `.touch-items`, `.touch-item`, `.touch-item-count` and `.touch-candy` with the `--pad-size` and `--item-size` vars (`src/components/touch-ui.css`); `TOUCH_BUTTONS`, the `TouchButton` type and the `PAUSE`, `MAP`, `WEAPON`, `HEAL` and `RELOAD` glyphs (`src/game/touch-pad.ts`); and `src/game/touch-items.ts` with its spec. `[data-touch-pad]` stays and still marks the cluster.
- The `has-touch-items` class on `.game-root`, which nothing styles any more.

## [2026-11-08] - HUD order, the backpack ring and a Sprint button

Builds pieces 1 and 2 of `docs/superpowers/specs/2026-11-08-hud-mobile-design.md`.

### Added
- A zombie head icon, `art.ui.zombieHead` (`src/art/fx/icons.ts`), for the HUD's kill count, plus a wrapped candy (`art.ui.candy`) and a folded town map (`art.ui.townMap`) so the backpack can draw them as the game draws everything else.
- A Sprint button in the touch cluster, held like `ShiftLeft` (`src/game/touch-pad.ts` `SPRINT`, `src/components/TouchControls.vue`).
- `src/game/player-anchor.ts`: the survivor's spot in the window, written onto `<html>` as `--player-x` and `--player-y` once a frame by `src/game/run-frame.ts`, so an overlay can follow them without Vue work per frame. `WorldRenderer.toClientX/toClientY` and `clientFromBuffer` (`src/engine/viewport.ts`) are the maths behind it.
- `src/game/backpack-wheel.ts` and `src/game/weapon-bar.ts`: what the ring holds and what each gun slot stands for, with specs in `tests/`.

### Changed
- The HUD's top right is now health, then kills, then points, in that order; health leaves the bottom-left vitals column. The trip's treasure and quest chips move to the top centre.
- The gun bar is pinned to the middle of the foot of the screen at every width (it used to be pushed aside under 720px), and each slot is a button of at least `--tap` that sends its number key through `input.padDown`/`padUp`. The rest of the HUD stays click-through.
- The run log moves to the right edge, halfway down, clear of the numbers above and the buttons below.
- The backpack ring is pixel chips carrying the real item sprites, opened on the survivor and following them, instead of grey circles over a dimmed screen. It holds the medkit, the gun `Q` hands over to, each throwable carried, the candy and the town map; a slot that would do nothing is greyed out. Esc, a tap outside, or picking anything closes it.
- The touch buttons are the HUD's own pixel chips, two by two in the bottom-right corner, the same block in either orientation (`src/components/MobileFAB.vue`, `src/components/TouchControls.vue`).

### Fixed
- `.is-touch .hud` reserved room for the old rectangular touch bar and, while anything throwable was carried, for a row of item buttons that has not been rendered since the buttons became a corner cluster. The HUD no longer gives up that space (`src/components/touch-ui.css`).

## [2026-11-07] - Title screen layout

### Changed
- The Install Game cartridge moves from the far right screen margin into a second column beside the main menu under the title logo (`src/components/TitleScreen.vue`, `src/components/InstallCartridge.vue`).

## [2026-11-07] - What's New book

### Added
- Clicking the version number in the title screen's corner opens What's New, a changelog printed like How to Play and the Record Book: a front page with the version and a contents list (each line jumps to its page), then every update two to a page, newest first, stamped New, Better or Fixed. Turned with Prev and Next, the arrow keys or a swipe; Esc or Back closes it.
- The notes are written for players in `src/game/changelog.ts`. To add one, put a new `ChangeNote` at the top of `CHANGE_NOTES`; the pages and contents follow.

### Changed
- The Record Book and the changelog share their page turning (`src/game/book-turn.ts`, `src/components/use-book-pages.ts`).

## [2026-11-07] - Run log

### Added
- A run log (`src/game/event-log.ts`): every callout, banner, title card, landmark, pickup and teammate going down or getting back up is written down with the run's clock, so it can still be read after the toast is gone. The same words again within a few seconds count up on one line ("CLOSE CALL ×3").
- The newest five lines sit in the bottom-right corner, older ones dimmer (two lines on touch). Press L, or tap or click the corner, to open the whole log over the run, with tabs for Fights, Loot, Night and Team. The run keeps going underneath.

### Changed
- The gun bar moves to the bottom centre to make room for the log.

## [2026-11-07] - Apartments go up a floor

### Added
- Every apartment block has a second floor (`apartment_upstairs`): two more flats off the same hall, with the same inside walls and furniture as below. The stairs are in the lobby's east end on both floors. It rolls nothing, so the houses' floors come out as before.
- The strip under the town now lays floors out in 13 by 11 tile cells, to fit an apartment's.

## [2026-11-07] - Upstairs and cellars

### Added
- Floors above and below (`shared/storeys.ts`). About 30% of houses get an upstairs and 20% a cellar, drawn from the town seed on a generator of its own. Each floor is a building of its own (`upstairs` or `cellar`, with `of` naming its house), laid out in a strip of rows below the town (`WorldMap.townRows`), walled in and surrounded by solid dark (`void` tiles and boxes).
- Stairs in the house's kitchen corner and at the same spot on the floor. Pressing the search key on them takes them (`stairs_taken` event). The flow fields link the two stairs tiles, so a hunting or investigating zombie walks onto the stairs and comes out on the other floor when that is its way to you.
- Distances that ignore walls (hearing, dozing off, picking whom to chase, the town map's markers, where a horde or boss spawns) are measured from the same spot in the house (`groundOf`), so someone upstairs counts as being in their house.
- Upstairs is two bedrooms and a landing; a cellar is one room of shelves, crates and a workbench. Their containers and floor loot roll on their own generators, after the town's, and hold no ammo, so the town's rolls and its ammo budget are as they were. Bedrooms hide candy more often than any other room.
- The stairs are drawn going up or down, with an "E: UPSTAIRS / DOWNSTAIRS / CELLAR" prompt. A floor nobody is on is drawn dark.

## [2026-11-07] - Back doors and rooms

### Added
- Back doors (`shared/building-plans.ts`): houses, apartments, the clinic, the police station, the garage, the warehouse and the grocery have a second door in the north wall, so a crowd at the front is no longer a trap. One tile of sidewalk outside each back door is paved and kept clear of props.
- Rooms: houses have a bedroom wall on the left, and apartments are split into two flats and a shared hall. The furniture is rearranged around them, and every room is still reachable by the widest body.
- The north wall draws with its gap, a dark doorway and a mat, and inner walls draw their cap and face.

### Fixed
- The van could park with a street lamp right where a survivor stands beside it to wait. Its spot now needs that room free.

### Changed
- The diner keeps its single door. The grocery's north row has four shelves to leave its back door clear.
- Tests: the floor-loot cap allows the one top-up box a short town adds per building.

## [2026-11-07] - Keepsakes

### Added
- Keepsakes (`shared/keepsakes.ts`), the slow, permanent side of the perks. Reaching towns 3, 5, 7 and 9, each survivor is offered three they do not have (drawn from the town seed and their id on a generator of its own) and keeps one for the rest of the run. An offer not taken is replaced at the next one, and a restart clears them.
  - Lucky Rabbit's Foot (+15% chance an empty search turns something up), Worn Sneakers (sprint 20% longer), Bandolier (25% more spare ammo), Rosary (bleedout 1.5× longer), Pocket Lighter (molotov fires 1.5× longer), Old Watch (reload 10% faster), Trick-or-Treat Bag (carry 3 candies), Dog Tags (revive teammates twice as fast).
- A "Choose a keepsake" card over the HUD, picked with a click, a tap, or J, K, L. The click never reaches the gun. A banner names the keepsake kept.
- `keepsake_taken` event, `PlayerEntity.keepsakes` and `.keepsakeOffer`, and the `keepsake` input field.

### Fixed
- A remote player's `eat` input was dropped by the room's packet parser, so candy could not be eaten in online co-op. The parser now reads `eat` and `keepsake`.

## [2026-11-07] - Halloween candy

### Added
- Candy (`shared/candy.ts`): twelve short boosts hidden in containers, most of them in houses and apartments. A survivor carries two and eats the next with X. Each lasts 75 seconds, and a candy already working is skipped for the next one in the bag, so boosts never stack. Where candy is hidden comes off the town's seed on a generator of its own, so the sim's other rolls stay put and a Daily Night hides the same candy for everyone.
  - Sour Skulls (reload ×2), Fang Taffy (shove and knife ×2), Ghost Gum (silent sprint), Pumpkin Fizz (+25% speed, matched by the client's prediction), Witch's Brittle (+2 health a kill), Bat Bites (bullets pierce one zombie), Candy Corn Rush (chain window ×5), Jawbreaker (half damage), Black Licorice Lash (+3px head margin), Caramel Apple (one instant revive), Popping Eyeballs (molotovs without fuel), and the rare Full-Size Bar (everything at half strength for 20 seconds).
  - Going down ends whatever is working, and a fresh start empties the bag. Candy rides along to the next town.
- `candy_eaten` event, `PlayerEntity.candy` and `.sugar`, the `eat` input, and `container_opened.candy`. The HUD shows the bag and what is working, with a banner saying what the candy does.

## [2026-11-07] - Furniture against the side walls

### Fixed
- Furniture now stands flush against a building's side walls. The room layouts were drawn for walls a tile thick, but walls are 6px, so pieces near a side wall stood 10px off it. That left a gap that looked like a way round but was too tight for anyone, and it trapped players. A row that nearly meets one side wall now closes up against it. A row that nearly meets both is laid wall to wall, opening a real aisle at its widest gap when there is room for one (`placedLefts` in `shared/building-interiors.ts`).

## [2026-11-07] - Stamps

### Added
- Achievements as rubber stamps (`src/game/stamps.ts`): 17 of them, from First Blood and Headhunter (50 headshots across runs) to the three boss stamps, Blood Moon, Into the Fog, Last Stop (all ten towns) and Three Nights (a Daily Night streak of three). They are read off the events every client already gets, so play is the same with them or without them, and kept on the device under `outbreak.stamps` with the day each was earned.
- A stamp earned in play shows as a "STAMP:" callout once no kill callout has the screen.
- Two new leaves at the back of the Record Book: each stamp is a ring, inked and dated once earned, and dashed with how to earn it while empty.

## [2026-11-07] - Boss nights

### Added
- Levels 3, 6 and 9 are boss nights (`shared/bosses.ts`). The town's last horde brings a boss: a zombie of an existing kind grown huge, with far more health and a trick of its own. The horde does not end while it stands, and it leaves a medkit and a prize (a large jewel on a Campaign trip, a gun part otherwise) when it falls.
  - **The Howler** (level 3, a giant screamer): every 7 seconds it screams across 700 pixels, and two runners come.
  - **Mother** (level 6, a giant bloater): every 9 seconds she gives birth to three walkers.
  - **The Butcher** (level 9, a giant brute): every 6 seconds, if anyone is within 260 pixels, it charges at 2.6 times its speed for 1.2 seconds.
- A boss health bar across the top of the screen, a banner when it comes and when it falls, and a warning on the level card. Bosses are drawn at their size, and take no headshots, since their heads are far above their kind's.
- `boss_arrive`, `boss_trick` and `boss_down` events, `SnapshotPacket.boss` and `ZombieEntity.boss`.

### Changed
- A blood moon now brings hordes twice the size (was 1.5 times).

## [2026-11-07] - S.O.S. Discount

### Added
- How to Play (Searching) and the README name S.O.S. Discount, the downtown store with a back room worth checking (#7319).

## [2026-11-07] - Night events

### Added
- About three towns in ten, from level 2, get a night event, drawn from the town's seed on a generator of its own (`shared/night-events.ts`):
  - **Fog**: zombies spot you from 55% of the usual range, and the town is washed grey.
  - **Blood moon**: hordes twice the size, every kill worth double, and a red sky that pulses.
  - **Power cut**: zombies see 70% as far and hear 30% further, and most lamps are dead. A blackout town gets fog instead.
- The level card names the event ("Tonight: Fog. ..."), and the Daily Night page shows it next to the difficulty. The client works it out from the snapshot's map seed, so nothing new goes over the wire.

## [2026-11-07] - Chains that pay, and a Daily result to share

### Added
- Kill chains pay: each kill by the same survivor within 1.4 seconds of the last is worth a quarter more, up to double from the fifth (`shared/kill-chain.ts`). The floating score says so ("+18 x1.5"), and `zombie_die` carries the kill's place in the chain.
- A Copy result button on the Daily Night page (once played) and on the results screen after a Daily run. It copies the day, level, points, kills and streak with the game's link, ready to paste anywhere.

## [2026-11-07] - The record book

### Changed
- Records is now a printed record book on the How to Play magazine's paper: four ruled pages read as two spreads (one page at a time on a tall screen), turned with Prev and Next, the arrow keys or a swipe.
- Personal bests: a card each for Campaign and Arcade, the numbers written in by hand, stamped "No run yet" until there is one.
- The ledger: the top five with hordes, kills, time and date as well as the score, the empty lines left ruled and waiting.
- Daily Night: tonight's town on a ticket stub, your streak, best night and nights logged.
- The last seven nights, each stamped Counted, Missed or Tonight (`src/game/record-book.ts`, tests in `tests/record-book.spec.ts`).

## [2026-11-07] - Daily Night

### Added
- A Daily Night item on the title menu, after Play. Its page shows today's town (level, rule and difficulty, all picked from the date), your run today, your streak and the time to the next town, then the survivor select and Start tonight.
- The day's run is solo with Arcade rules on a seed from the date (`src/game/daily-night.ts`), so every player gets the same town on the same day. The first run of the day counts; later ones count as practice and keep a practice best. Days are kept on this device (60 at most), under `outbreak.daily`.
- The results screen says "Daily Night, 7 Nov" and whether that run counted. Daily runs leave level progress and Arcade bests alone.
- `ConnectOptions.seed`, so a local session can be started on a fixed seed. Tests in `tests/daily-night.spec.ts`.

## [2026-11-07] - Supply drops

### Added
- Once a town, after the first horde, a red flare goes up on open ground a fair walk away and a supply crate lands on it ten seconds later: a round kit, two double boxes of ammo, a medkit, and a large jewel (Campaign) or a gun part (Arcade). The flare hisses the whole time and the crate lands loud, so the town comes too.
- `drop_called` and `drop_landed` events, `SnapshotPacket.drop`, a SUPPLY DROP banner, a red arrow on screen, a red box on the town map (with a key entry) and dust when it lands.
- Spot and contents are rolled from the town's seed on their own generator (`shared/supply-drop.ts`), so the simulation's rolls are unchanged. Tests in `tests/supply-drop.spec.ts`.

## [2026-11-07] - Molotovs and flares

### Added
- Fuel and flares, found by searching (fuel in garages, warehouses and diners; flares at the police station, in garages and in cars) and carried two of each. Which containers hold them is rolled from the town's seed on a generator of its own (`stashIn` in `shared/throwables.ts`), so the simulation's rolls are unchanged.
- T throws a molotov (a bottle plus a fuel): a smash heard 240 pixels off, then a 30-pixel pool of fire for 5 seconds that lights every zombie that walks in and burns any survivor standing in it.
- V throws a flare: a red light that hisses for 20 seconds, a noise every 1.5 seconds that keeps pulling zombies in.
- HUD chips for fuel (greyed with no bottle to fill) and flares, new icons, flames and glow drawn from the `molotov_burst` and `flare_lit` events, and a How to Play note.
- Fuel and flares stay in the town: the van leaves them behind. A molotov counts toward bottle quests.

## [2026-11-07] - Kills that land

### Added
- A hit-stop: in solo the picture and the sim hold still for a beat on your headshot (45 ms), a chain kill (35 ms) and a brute you drop (110 ms). Co-op keeps moving, since the town does.
- Kill-chain callouts over the action (`KillCallout.vue`): DOUBLE, TRIPLE, QUAD, then MASSACRE xN for your kills less than 1.4 seconds apart, counting every kill in one shotgun blast.
- CLOSE CALL for a kill made at 20% health or less, at most once every 8 seconds.
- When the last zombie of a horde falls (rather than the horde giving up), the banner reads HORDE WIPED OUT, the frame holds for a quarter second and the screen flashes warm white. Reduced motion skips the flash.
- The rules are one pure module, `src/game/kill-juice.ts`, reading only snapshot events, so play is unchanged; tests in `tests/kill-juice.spec.ts`.

## [2026-11-07] - The Overrun goes live

### Changed
- `OVERRUN_LIVE` is now true: every Campaign player gets the bunker clock, the breach and the reward chest once someone in the room has reached level 2. Solo and the co-op server both follow it.
- How to Play has a Campaign chapter on the overrun (the clock by difficulty, the half-speed menus, the warnings, and holding, running or going down), with the blast door and the chest as its pictures.

## [2026-11-07] - Biomes, terrain, ground effects and footsteps

### Added
- Per-level biomes (`shared/biomes.ts`): plants, ground, density, litter, park layout, a park landmark and town pieces differ by level. New props `pine`, `cactus`, `dead_tree`, `scrub`, `reeds`, `fungus`. The welcome packet gained an optional `level`.
- Ground tiles `water`, `snow`, `ash`, `sludge`, laid in patches by a biome; they slow players and zombies and scale sprint-step noise (`shared/ground.ts`).
- Six footstep sounds, one per ground, spaced by distance walked.
- Town pieces: fenced and junk-barricaded side streets with a gate, and burning, sunk, overgrown or snowed-in houses.

### Changed
- Street lamps stand on street corners and at an even pitch along each kerb instead of at random.
- Solids keep clear of the fence so the map repair cannot take a fence piece down.

## [2026-11-06] - Towns hold jewels only

### Changed
- Towns drop jewels only: silver stacks are gone from towns, and the forge is where silver comes from (with quest rewards and the overrun chest). Each level is worth what it was, within 5%: `TOWN_JEWELS` in `shared/treasure.ts` holds 9 small and 2 large jewels at level 1 (760 silver once smelted, was 775) up to 12 small and 5 large at level 10 (1,480, was 1,482), with large jewels taking a bigger share as levels rise. A full town smelts in 33 to 51 seconds at 3 seconds a jewel. A replay still holds half of each, rounded down. Arcade runs place no treasure and are unchanged, as is every draw on `sim.rng` (#7266).
- The HUD's carried chip shows what the jewels come to in gold and silver (`coinText`, `jewelWorth`), then each size counted; the death summary counts the jewels lost and what they would have smelted to.
- The overrun chest keeps paying silver straight to the bank: six stacks of 5 to 20, now its own `CHEST_STACK_MIN`/`CHEST_STACK_MAX` in `shared/overrun-chest.ts`, with the same draws on `sim.rng`.

### Removed
- The `silver` pickup type, its ground sprite, its pickup sound (`pickup_silver`) and its floating label. The coin pile stays as the money icon, `art.ui.silverIcon`, on the shop, the forge and the How to Play card. The trip receipt and the body keep their `silver` slot, which a trip now leaves at 0.

## [2026-11-06] - The Overrun (behind a switch)

### Added
- The overrun: a clock on every arrival in the bunker whose length depends on difficulty (240 seconds on Night Light On, 180 on Stay Close, 150 on Lights Out, 120 on Undead Tired; a flat 300 felt too long, #7264), at half speed while everyone who counts has a station open and stopped by the solo pause menu. Warnings, then the blast door bursts and a horde (sized by the room's highest level, at most 40) comes in. Killing it pays each player a reward chest; running for the van kills merchants and thins the rest; dying costs the gear in hand. A first visit (below level 2) has no clock. It is built across #7213 to #7222 with HUD, sound, art, screens, save receipts and co-op specs.
- It is **off for players**: `OVERRUN_LIVE` in `shared/home-protocol.ts` stays false. A dev build turns it on with `?overrun` in the address (solo only; a co-op server follows `OVERRUN_LIVE`). Tuning constants: `OVERRUN_CLOCK_BY_DIFFICULTY` (read through `overrunClockSec(difficulty)`) and `OVERRUN_MENU_RATE` in `shared/overrun.ts`. The clock length is on `OverrunState.spanSec` and the wire's `OverrunView.spanSec` (optional, so an older view reads as `OVERRUN_CLOCK_SEC`, 150), and the warnings, the door's buckling and the soak follow it.
- `tests/overrun-soak.spec.ts`: a bot that shops at menu speed and holds the quarters, printing the clear rate and minutes per visit at highest 1, 5 and 10 on each difficulty.
- How to Play does not mention the overrun yet; its chapter goes in with the flip, since the text would describe a feature players cannot reach.

### Fixed (final review, #7262)
- A co-op refresh in the middle of the breach joins with empty hands, as a refresh mid-trip does, so the death on file is not undone by the body rejoining armed. The locker comes through untouched. Hands the room would refuse stay forfeit while a breach is on file.
- HOLD E: CHEST (OPEN on touch) shows for a player whose chest is waiting, and no merchant prompt shows while the horde is in. The client asks the same rule the sim does (`openableStation` in `shared/stations.ts`). The snapshot carries `home.chest` on its owner's view only, and the chest is drawn only for a player who has one.
- A body written off as the van left gets its died receipt applied and recorded in town without the bunker death summary, and a fall summary or chest card still up when the van leaves is put away, so neither holds the keys over the town.
- A body that left from the van before the breach gets no flight receipt and costs no merchants.
- Opening the chest after falling in the horde keeps the died receipt inside the held one (`died`), so a death the save had not applied yet is still applied and both are recorded.
- A home view without an overrun receipt, from a server older than the overrun, is read as none.
- A breach closing (survived or over) is written once while the write is in flight, so a failed save waits for its retry.
- `tests/overrun-off-rng.spec.ts` pins the `sim.rng()` draws of a seeded home run with the overrun off.

## [2026-11-06] - Campaign and Arcade

### Added
- Two game styles, chosen for each run. Campaign is the bunker, trips, treasure, forge and merchants; Arcade is the game as it was, ten levels in a row with the van workbench. A first-time player gets Campaign and the last choice is remembered. Nothing is switched on for everyone: the player decides, and `HOME_LOOP_LIVE` and the dev-only `?home` are gone.
- The Play page opens on a Style step (Campaign or Arcade, with card pictures and four facts each) before Solo or Multiplayer, difficulty and survivor. Starting from the Levels page means Arcade and an invite link lets the room decide, so both skip it. The cards are placeholders drawn in `src/art/styles/` until the card painter gets to them.
- In co-op the first player into an empty room chooses its style and everyone after plays it, even if it differs from their remembered choice. The server tells a connection the room's style before any join. A client from before styles is Arcade and is turned away from a Campaign room with close code 4000. Deploy the server first.
- How to Play has a chapter on the two styles and six on Campaign: the bunker, trips, treasure, the forge, the merchants and dying. A contents page of more than fourteen chapters shows one line each so they all fit.
- Records shows Campaign's best trip and Arcade's best run in separate blocks, and each leaderboard row says "Campaign trip" or "Arcade run".
- The bunker has its own map key: "Bunker map" with a Stations colour, and none of the town's legend or marks.

### Changed
- Level 6 is called Blackout in both styles. The music title Underground Bunker is a track name and stays.
- The Levels page says it is Arcade's page, and Continue from level N is Arcade only. Campaign resumes from its bunker save.
- The controls list and How to Play call the Tab or N key "Map".
- Campaign keeps its level progress apart from Arcade's, and a returning Arcade player starts Campaign at level 1 with nothing carried over.

### Fixed
- A Campaign co-op player who left the bunker without being ready for the van is no longer held as a body in the room. Rejoining from the same tab brings the gear and level from the save, so a solo run played in between cannot be undone by the old body, and a banked gun keeps its mods. A body that is ready for the van, out on a trip, or home with a result nobody has credited yet is still kept.
- Choosing Main menu while standing at the van with the trip boarded calls the trip off. Before, the open trip stayed on file and the next Campaign run counted it as a death, losing the gear in hand.
- Backing out of an invite link's Play page ends the invite. Play from the menu then starts on Style again, and a level picked on the Levels page starts Arcade there.
- On an invite link the Play page no longer says which style the room plays: the co-op line reads "The room decides the style." and the Solo card's Continue says "Arcade only". A player who turns to Solo there is told which style they will play.
- Esc closes the locker the way its Close button does. Before, gear moved between the locker and your hands stayed where it was if you left with Esc.
- A Campaign save that could not be read no longer stays half open: the Arcade run after it cannot close an open trip or write to the save.
- An old co-op error no longer shows on a solo setup, where only a Campaign save that could not be read is said.
- A Records row has a gap between the callsign and the style.

### Analytics
- No event or parameter was added. A Campaign run reaches the existing ones differently: `run_start` on entering the bunker with `start_level` 0, `level_start` once for each trip, no `level_complete`, and a single `run_start`/`run_end` pair for a whole bunker session whose end only says quit or disconnected. Read from the tracker, not observed. The Privacy page's wording has not been reviewed against this.

## [2026-11-06] - Sharper Sprites and Costumes

### Changed
- The sound test lays its track tiles out four across instead of five, so titles stop wrapping.
- The app icon is now the game's cartridge with its name on the label (UNDEAD OF / NIGHT), instead of the zombie head, filling the icon on a transparent background so the desktop shows around it (the maskable and Apple icons stay on ink, as they must be opaque). The Install Game cartridge and the browser-tab favicon are unchanged. Reinstall the app to see it: installed shortcuts keep the icon they were made with.

### Added
- Sprinting now tires you. The Sprint bar drains while you sprint on the move, refills when you do not, and a survivor who runs it dry walks until it is back to a quarter. A survivor's Speed sets how long a bar lasts. How to Play and Options list the sprint and sneak keys.
- Every survivor has a list of costumes, default first: Night (Starfield, Aurora, Nebula), Bandus (Grizzly, Polar Bear, Honey Bear, Recruit), Queen (Tabby, Black Cat, Siamese, Grey Tabby), Rex (Green Dino, Purple Dino, Red Dino, Triceratops) and Sol (Kid, Plumber, Adventurer, Caped Hero; his glasses stay on in all of them). The art is in `src/art/survivors/costumes/`, the ids and names in `shared/characters.ts`. Only the default can be worn: the bunker locker that unlocks the rest is not built yet.
- A survivor who fires or reloads on the move keeps walking instead of sliding on standing legs. The frames are drawn the first time they are needed.
- Going down from standing starts with a kneel, and a downed survivor who bleeds out dies where they lie instead of standing up first.
- `tools/contact-sheet.ts` takes a ground (`flat` or `asphalt`) as its fifth argument and has a `costumes` sheet with rows like `night/aurora/pistol/idle`.

### Changed
- Khronus8 is now Bandus and wears a brown grizzly bear suit. His old red-shirt look is the Recruit costume. Saved survivor choices carry over; analytics reports him as `bandus` from now on.
- Night's hair is a starfield: navy with a violet cloud and stars, in clusters instead of scattered single pixels, on her sprite and on her select screen portrait.
- The road is one palette step lighter and the outline rule no longer vanishes on the darkest colours, so survivors and zombies keep an edge on the street. Hair, boots and far legs no longer use outline black as a fill.
- All five survivors are redrawn: arms separate from the body, back views are shaded, Sol's glasses are rims with his eyes showing and his legs show under his gun.
- All five zombie types are redrawn: the brute in three clear planes with a solid club, the screamer with white hair and dark boots, the bloater's arms darker than its belly, the runner's ribs as arcs. Blood and acid pools lie flat with no outline.
- Shadows are firmer, drawn before any figure, and sit under zombie feet.
- The reload has more frames, the working hand shows when reloading sideways, and a dying survivor drops the gun they held.
- Sprites in the menus and HUD are sized in whole device pixels, so every art pixel is the same width.

## [2026-11-06] - Radio Finds

### Added
- Ten more level tracks by Majora D. (one per level).
- Each level's first take is its own; every take after it is a radio find. A Radio now gives up the next unfound track of the level it was found in, with a banner naming it, and the track joins that level's rotation.
- The Sound Test is always open and shows ??? for tracks not yet found, with a count of radio finds.

- A Jukebox station in the bunker's quarters (hold E) plays any track already heard or found, and says how many radio finds are still missing. Dark with the rest of the bunker until the home loop goes live.

### Changed
- All the music is credited to Majora D.
- Night now moves quieter: her shots, sprinting steps and search clatter carry three quarters as far, and a search clatters half as often. She is still spotted from three quarters as far. The select screen's Stealth bar weighs sight and noise together.

## [2026-11-06] - Majora D. Level Music

### Added
- Twelve new level tracks by Majora D. (128 kbps MP3, 48 kHz stereo, like the rest) join the lull of their level as alternate takes: two more for levels 3 and 10, one each for the other eight.
- Majora D. is credited in the end credits beside ExoticService, and in the MP3 artist tag of the new tracks.

### Changed
- A level's music now starts on a random one of its takes, then plays the others in turn, so a level never goes quiet and level N only ever plays level N's music.

## [2026-11-06] - Combat & Scavenging Telemetry

### Added
- Expanded Google Analytics telemetry for insider gameplay metrics:
  - Per-level telemetry: `kills`, `headshots`, `damage_taken`, and `containers_searched` recorded on `level_complete`.
  - Run outcome telemetry: cumulative totals for `kills`, `headshots`, `damage_taken`, `containers_searched`, and `killer_type` (the zombie type that landed the final hit: walker, runner, bloater, brute, screamer) recorded on `run_end`.
  - Privacy and catalog boundaries: parameter bounds and type guards registered in `catalog.ts` and documented in `privacy-text.ts`.

## [2026-11-05] - Special Rounds

### Added
- Special rounds: Flame, Acid, Piercing and Tranq kits turn up in searched containers and on floors, are fitted at the workbench (one effect a gun, a new kit replaces the old after a confirm) and move between guns with a toolkit. Flame burns 18 damage over 3 seconds and spreads by touch, acid stacks corrosion, piercing goes through the first zombie at half damage, tranq slows what it hits. Every build still stays under the power cap. Tables in `shared/round-effect-data.ts`, rules in `shared/round-effects.ts`, `shared/zombie-status.ts` and `shared/zombie-burn.ts`. They are in the How to Play magazine as a Rounds chapter.
- The Radio: some towns hide one in a house, apartment, diner or garage. Finding it unlocks the Sound Test on the title menu, a list of the music for levels reached and every sound effect, in that browser. The pick is by the town's seed alone, so the simulation's rolls do not move (`shared/radio.ts`, `src/game/sound-test.ts`).
- Level select: a level you have reached on the Levels page starts a solo run there. Co-op always starts on level 1 (`src/game/level-select.ts`).
- The survivor picker turns the highlighted survivor through all eight facings, under reduced motion too, since pointing at one asks for it. On a touch screen the chosen survivor keeps turning by itself, and reduced motion keeps that one still (`src/game/survivor-spin.ts`).

### Changed
- Round kits are easier to find: three a town, sometimes a fourth on later levels, up from one or two, and four in five now lie on a floor rather than in a container.
- The Radio is far easier to find: about one car in ten now has one, on top of the one some towns leave in a building. Only the first find shows the banner.

### Fixed
- Acid: a shotgun blast now adds one corrosion stack, not one per pellet, and corrosion only raises the damage of acid rounds and burns, so a plain gun beside an acid one no longer passes the power cap. Brutes corrode 15% a stack against 10% for the rest, so a capped acid gun now beats a capped plain gun on a brute.
- A kill a burn lands while the shooter has disconnected is credited to their departed record and is still theirs when they reconnect.
- A zombie closing on a player backed into a corner behind furniture no longer stalls a few strides away, shuffling on the spot while the player stood there. The flow field walked it back out of each part-blocked tile; a body there with the prey in sight now keeps walking at them (`shared/zombies.ts`).
- Players sharing a corner no longer widen the flow field's seed by a ring each, which left a flat patch with no way through it (`shared/flow-field.ts`).

## [2026-11-04] - Open Town

### Added
- Link previews: shared links to the game now show a title, description and a 1200x630 image (Open Graph and Twitter card tags in `index.html`). The image is `public/og-image.png`, rendered from the game's own night scene and logo by `tools/share-image.ts`.
- Redesigned Levels screen (`LevelsPage.vue`) with compact card heights and calibrated thumbnail scaling so all 10 sector cards fit cleanly within the viewport without vertical scrolling, displaying previews, horde counts, theme pills, and difficulty multipliers.
- How to Play is now *Out of Town*, the Town Survival Bureau's printed survival manual and travel guide. It fills the frame with a thin edge of the moving map showing: a cover, a contents page with chapter links, and a two-page spread per section with loud colour bands, taped snapshots posed from the game's own art, sticky notes, marker pen and a deadpan voice. Prev and Next turn the page, with reduced motion getting a plain swap; the arrow keys and a swipe do too. A tall screen shows one page at a time, a phone on its side keeps the spread, and nothing scrolls. New sections in `src/game/how-to-play.ts` get a spread of their own with no other change.
- Touch play on phones and tablets, either way up: a floating left thumb stick, touch anywhere else to aim there and fire with a little extra headshot margin, edge buttons for Shove, Reload, Heal, Search, Weapon, Map and Pause, larger menu tap targets, and a tall view that sees no further than the same phone on its side, capped in co-op.
- Gun upgrades at a workbench after each van ride, except the last. Barrels, grips, magazines, suppressors and rare toolkits are town loot, lost on death like everything carried. They buy damage, fire rate, magazine size or reload speed within each gun's slots, a suppressor cuts a gun's noise radius by 65%, and a toolkit moves one upgrade between guns. A found gun can carry a quirk with an upside and a downside. Upgrades stay on the gun across levels and go with it on death, no build passes 1.5 times the stock damage per second, and the HUD slots show pips. Solo holds until you are ready; a co-op server gives 45 seconds. Tables in `shared/gun-upgrade-data.ts`, rules in `shared/gun-upgrades.ts`, the hold in `shared/workbench.ts`.
- Searchable cars, boxes (crates), shelves, drawers, lockers, fridges and cabinets across streets and interiors. Hold E near one to search it; moving or a hit cancels, opened ones show as opened to everyone, and a search sometimes clatters through the noise system. Most hold nothing, and every home holds something. The ammo budget rises to 1.15 of the population and counts containers: every town settles on budget with half on its floors and half shut away, at every level and difficulty.
- Every searchable piece now has two whole sprites, shut and searched: shelves go from squared-away stock to shoved about with goods on the floor, taped cartons end up torn open and crushed, cars get smashed glass, a hanging door and a popped boot, and doors and drawers hang open with their contents turned out. Fridges are a prop of their own, the size of a locker, standing against the wall in homes and diners instead of drawn on tables and counters.
- Sol's luck reaches searches: an empty container has a 15% chance of turning something up, rolled at search time in the sim so solo and co-op agree.
- A findable knife turns the shove into Shove & Stab: four and a half times the damage, silent, with stagger immunity and the two-target limit kept. Kept across levels, lost on death, with its own pickup sprite and HUD icon.
- Headshots: input now carries the crosshair's world aim point, and a pistol or carbine bullet that hits the zombie whose drawn head was under the crosshair when it fired does 2.5x damage (1.5x on brutes) and pays bonus score, with its own hit effect and sound. The crosshair turns red over a lit head. Rules live in `shared/headshots.ts`.
- Levels on the client: the world, renderer, town map and prediction rebuild when the sim moves to the next town, each level gets its look and weather, and a title card opens it. The van gets a banner, a labelled arrow on screen and a town map marker. The HUD shows the level and the hordes left, and the results show the level reached.
- Four difficulty modes (Night Light On, Stay Close, Lights Out, Undead Tired) scaling ammo, zombie speed and damage, horde size and lull length from one table in `shared/difficulty.ts`. A picker on the title screen remembers the choice, the first co-op player into a room sets it through the join packet, and the results show it. Lights Out is the old exact balance; a bare `GameSimulation` still runs on it.
- Five playable survivors replace the four placeholders: Night, Khronus8, Satori, Rex and Sol, each with full sprites in the rig and one small trait from `shared/characters.ts`. A picker on the title screen shows portrait, name and trait and remembers the choice. In co-op the server seats you on your survivor or the next free one, and tags and HUD chips show who is who. The rig gains a smaller build for the younger cast, and a fallen survivor no longer leaves blood.
- How to Play button on the title screen opens a tabbed overview of the game. The words live in `src/game/how-to-play.ts`; Esc or Back returns to the title and Enter does not start a run.
- Levels page on the title screen lists all ten levels. A level you have reached shows its number, title and theme color; the rest show ??? until a run starts them. The highest level reached is kept in `src/game/level-progress.ts`, and finishing the game adds a marker. Esc or Back returns to the title and Enter does not start a run.
- The escape van is solid for survivors, zombies and bullets, in solo and co-op. Its body comes from the town seed in `shared/exit-van.ts`, so the exit spot is unchanged and the 2 second wait still works from beside it.
- Generated open town with five districts, enterable buildings, furniture and a fenced edge. Roofs fade when you walk in.
- Finite ammo by gun type, with caps. Loot is placed by building type, and the carbine and shotgun have fixed homes.
- Roaming zombies that notice by sight and noise, with hordes after scavenging lulls in place of endless waves.
- Gun shove, medkits, bandages, a town map, and HUD warnings for low and empty ammo.
- Fourteen building shells, four floors, new furniture, and new sounds for shoves, healing, pickups, zombie alerts and the horde siren.
- Third title card displaying survivor telemetry (best score, hordes survived, kills, best time) and top survivor leaderboard rankings.
- Ten new alternate level music tracks converted to MP3 (192 kbps) and registered across all 10 levels, providing rotating alternate takes during town lulls.
- Each of the ten towns has its own lull music, alternating between multiple takes on subsequent waves. Winning the run shows a victory screen to *Dark Salvation*, then skippable scrolling credits to *Surviving the Night*, then the title.

### Changed
- Play steps regrouped: step 1 is who you are (callsign and survivor), step 2 is how you play (Solo or Multiplayer with the server address, difficulty, then Start or Join). Back, Next and How to Play's Prev and Next are now `MenuLink` text links that look like the title menu, Back on the left and Next on the right; the chosen mode and difficulty are marked in amber so Start is the only red button.
- Play is now two steps and Co-op leaves the title menu (Play, Levels, How to Play, Records, Options). Step 1 takes the callsign and Solo or Multiplayer, which reveals the server address; step 2 takes character and difficulty, then Start or Join, with connection errors shown there. Back and Esc go one step back, and Enter moves forward but never starts a run from a text field. Step logic lives in `src/game/play-flow.ts`.
- The title screen is now the logo, a short menu (Play, Co-op, Levels, How to Play, Records, Options) and the studio credit, over the moving town. Play and Co-op open a setup page, records and options moved to their own pages, and every page is one tinted panel with Back and Esc. Enter only starts a run on Start or Join.
- Hall of the Gods, Inc. branding: a studio splash on load and a credit on the title screen.
- Recorded music by ExoticService replaces the generated score, streamed as MP3 at about a twelfth of the size of the WAVs.
- Rebuilt the simulation as one deterministic `GameSimulation` shared by solo play and the co-op server.
- Redrew all pixel art and rebuilt the audio, with a title screen, game over screen and restart.
- Rewrote the lighting as a typed-array `LightField`. Nights are darker and the flashlight matters.

### Fixed
- Movement tied to packet rate, bullets passing through targets, the black flashlight, the stuck lobby, and runs that could not end in death.
- Guns firing too fast after a reload, quick taps and clicks that fired nothing, and buttons or keys lost across pause and the map.
- Shoves stun-locking anything, now limited to two targets with a short immunity. Zombies attacking through walls, stalling beside props, and big bodies stuck behind furniture.
- Co-op refreshes giving a free respawn, restarts hanging on "Waiting...", game over not reaching the player left behind, and more zombies crowding in than the cap allowed.
- The HUD reading EMPTY with another gun loaded, Enter in the server field starting solo, the wrong music for a mid-horde joiner, and audio bursts while muted.
- The server now limits packet rates and sockets waiting to join, and sends each client only what is around them.

## [2026-11-04] - Initial Architecture

### Added
- Core top-down 2D pixel engine with sub-pixel camera tracking and dynamic Y-sorting.
- 2D spatial hash grid partitioning for O(1) horde collision and proximity queries.
- Authoritative WebSocket multiplayer game server supporting room synchronization and entity interpolation.
- Full 360-degree twin-stick aiming and raycast projectile combat system.
- Zombie swarm AI state machine featuring wandering, aggro detection, and separation steering.
- Glassmorphic HUD overlay displaying player health, weapon ammo, survivor count, and connection status.
