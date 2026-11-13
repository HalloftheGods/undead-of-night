# Outdoor Camp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Status is NOT tracked in this file: each task below is a chemx task under epic #7540 (claim it, lock its files, comment progress, `task done`). This repo forbids markdown checklists, so the steps here are numbered, not ticked.

**Goal:** Replace the indoor bunker with a fenced outdoor camp of five sizes whose fence the horde breaks at randomly picked, pre-announced sections.

**Architecture:** One fixed 72x48 map built by `generateBunkerMap(size, open)`; the fence ring is data from a pure geometry module, and a map object exists per (size, open sections). The sim latches size and level at arrival, picks breach sections with `sim.rng` when the clock arms, and swaps the map quietly when they fall. Size and open sections travel on the welcome packet and the snapshot so every client builds the same map.

**Tech Stack:** TypeScript, shared deterministic sim (`shared/`), canvas renderer (`src/engine`), vitest through `chemx test`, `chemx verify` as the gate.

**Spec:** `docs/superpowers/specs/2026-11-13-outdoor-camp-design.md`. Read it first; this plan argues from it.

## Global Constraints

- Run everything through `chemx` (`chemx test <file>`, `chemx typecheck`, `chemx verify`), from `apps/zombie-survival`. Identity `--as=@claude-camp-<role>` on every `chemx team` command.
- Work on `main` in the shared checkout. Lock each file before editing; commit small and green; no branches, worktrees or stash. Do not touch `shared/containers.ts` or `src/game/title-menu.ts` (another session's uncommitted work).
- `shared/home-protocol.ts` is frozen: additions only, and DM the trip-loop owner before the first edit (find the owner with `chemx team task show 7213`).
- All sim randomness through `sim.rng`, in tick order. No new draw while the overrun is off or the room is at peace: `tests/overrun-off-rng.spec.ts` must pass unchanged.
- Identifiers keep "bunker" (`isBunkerMap`, `BUNKER_SEED`, `bunker-map.ts`, theme id `'bunker'`). Player-facing text says "camp".
- Root vitest only collects `tests/**/*.spec.ts`. Files stay under 500 lines; split by responsibility.
- No invented data; no nested ternaries; composables return plain objects.
- Commit trailer: `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`.

## Review Focus

1. **A guest joins while sections are down.** They must build the same map and stay connected (Task 5 test).
2. **A breach spawn spot is blocked or cut off.** For every breachable section at every size, the spawn ground outside it is open and the flow field reaches the camp spawn from it (Task 6 test).
3. **The ring is too small for the gap count.** At size 1 on the hardest difficulty the picker returns as many gaps as fit, at least one, and terminates (Task 6 test).
4. **The best player leaves mid-visit.** `roomHighest` drops; camp size, gap count and horde do not change until the next arrival (Task 4 test).
5. **A view or welcome with no camp field** (an old save, a replayed packet in tests) reads as size 1 with nothing open (Task 5 test).

---

### Task 1: A prop class that blocks movement but not shots or sight

**Files:**
- Modify: `shared/map-protocol.ts` (PROP_DEFS, PropKind), `shared/world-query.ts`, `src/engine/occlusion.ts`
- Check callers, change none of their signatures: `shared/combat.ts:237`, `shared/zombie-senses.ts:88`, `shared/flow-field.ts:55`
- Test: `tests/world-query-cover.spec.ts` (create)

**Interfaces:**
- Produces: prop kinds `camp_fence_h` `{w:32,h:6}`, `camp_fence_v` `{w:6,h:32}`, `camp_gate` `{w:6,h:64}`, `camp_post` `{w:6,h:6}`, `camp_fence_down_h` and `camp_fence_down_v` (footprint height 0, walk-over decals). `export const MOVEMENT_ONLY_PROPS: ReadonlySet<PropKind>` (the first four) in `map-protocol.ts`. `export function stopsShots(prop: PropInstance): boolean` in `world-query.ts` (solid and not movement-only).

1. Write the failing test: on a small hand-built map, `circleHitsSolid` is true on a `camp_fence_h` and the tile is in `blockedTiles`; `segmentHitsSolid` across it is false; the same two calls on a town `fence_h` are both true (unchanged behaviour).
2. Run `chemx test tests/world-query-cover.spec.ts`; expect failure on unknown prop kind.
3. Add the kinds and `MOVEMENT_ONLY_PROPS`. In the solid index keep two per-tile bucket sets: all solids (movement, `blockedTiles`, spawning) and shot-stoppers (`segmentHitsSolid`). Leave the occlusion grid's light blocking to `BLOCKS_LIGHT` as today and confirm the new kinds are not in it.
4. Run the test, then `chemx test tests/world-query*.spec.ts tests/combat*.spec.ts`; expect pass.
5. Commit: `feat(camp): fence props that stop bodies but not shots or sight (#7540)`.

### Task 2: Fence ring geometry

**Files:**
- Create: `shared/camp/camp-ring.ts`
- Test: `tests/camp-ring.spec.ts`

**Interfaces:**
- Produces:
  - `CAMP_COLS = 72`, `CAMP_ROWS = 48`, `CAMP_EAST_COL = 56` (first column outside the ring's east fence), `CAMP_MID_ROW = 24`
  - `type CampSize = 1 | 2 | 3 | 4 | 5`; `clampCampSize(n: number): CampSize` (non-finite or below 1 gives 1)
  - `CAMP_RING_TILES: Record<CampSize, { w: number; h: number }>` = 24x14, 28x16, 32x18, 36x22, 40x26
  - `ringRect(size): { col0, row0, col1, row1 }` (inclusive interior; east edge fixed, centred on `CAMP_MID_ROW`)
  - `interface FenceSection { index: number; side: 'n' | 'e' | 's' | 'w'; kind: 'camp_fence_h' | 'camp_fence_v' | 'camp_gate' | 'camp_post'; x: number; y: number; breachable: boolean; out: { x: number; y: number } }` where `x,y` is the prop anchor (bottom centre) and `out` is the unit normal pointing away from camp
  - `fenceSections(size): readonly FenceSection[]`, indexed clockwise from the north-west corner, stable for a size
  - `gapGround(section): { x0, y0, x1, y1 }` the walkable strip a fallen section leaves

Rules the test pins: the gate is one `camp_gate` on the east side at tile rows 22 to 25 at every size; the east side is tiled outward from the gate and the other sides from their west or north end in 2-tile sections; a leftover single tile is a `camp_post`; posts, the gate, and the first and last section of each side are not breachable; the ring is closed (walking the sections' footprints leaves no gap wider than 1 px); every interior tile of `ringRect(1)` is inside `ringRect(n)` for all n; the largest ring is at least 11 tiles from every map edge.

1. Write `tests/camp-ring.spec.ts` with those assertions for all five sizes.
2. Run it; expect "cannot find module".
3. Implement the module (pure data and arithmetic, no imports from the sim).
4. Run it; expect pass.
5. Commit: `feat(camp): fence ring geometry for five camp sizes (#7540)`.

### Task 3: The camp map replaces the bunker map

**Files:**
- Modify: `shared/bunker-map.ts` (becomes the map build only), `shared/world-map.ts:201`, `shared/map-protocol.ts` (WorldMap, scenery prop kinds), `shared/bunker-merchants.ts`, `shared/stations.ts:56`, `shared/level-exit.ts` (van spot), `src/engine/entity-renderer.ts:4`, `src/game/client-world.ts`, `src/game/home/quest-marks.ts` and any other importer of the constants below (`chemx q -g "CHEST_SPOT" -l`, same for the other three)
- Create: `shared/camp/camp-layout.ts` (station, spawn, chest, van and area positions), `shared/camp/camp-scenery.ts` (tents, awning, campfire, wilderness scatter)
- Test: rewrite `tests/bunker-map.spec.ts`; update `tests/home-contract.spec.ts:217-229`, `tests/bunker-merchants.spec.ts`, `tests/client-world.spec.ts`, `tests/quest-marks.spec.ts`, `tests/bunker-look.spec.ts`, and any spec asserting `cols === 40`

**Interfaces:**
- Consumes: Task 1 kinds, Task 2 `fenceSections`, `ringRect`, `CampSize`.
- Produces:
  - `interface CampShape { readonly size: CampSize; readonly open: readonly number[] }`; `WHOLE_CAMP: CampShape = { size: 1, open: [] }`
  - `generateBunkerMap(shape: CampShape = WHOLE_CAMP): WorldMap`; the map carries `camp: { size, open, sections }` (new optional `WorldMap.camp`)
  - `generateWorldMap(seed: number, level = 1, camp: CampShape = WHOLE_CAMP): WorldMap`
  - `chestSpot(map)`, `chestStation(map)`, `merchantStarts(map)`, `merchantRoam(map)` replace the constants `CHEST_SPOT`, `CHEST_STATION`, `MERCHANT_STARTS`, `MERCHANT_ROAM`. `MERCHANT_REACH` stays.
  - `BLAST_DOOR_SPOT` stays exported for now, moved to open ground just inside the west fence of size 1, so the overrun keeps working until Task 6 removes it. The `blast_door` prop is no longer placed.

Layout rules from the spec: 72x48 tiles, `grass` everywhere, `dirt` inside the ring and on a track from the gate to the east edge; `map.walls` is `[]`; an open section's fence prop is replaced by the matching `camp_fence_down_*` decal. Every station, the spawn, the chest spot and the van spot sit inside `ringRect(1)` and are identical at every size. Station circles stay 28 px or more apart. Areas: Market along the north (the four merchants start there), Workshop to the west (bench, candy shop, locker), Quarters and the campfire in the middle and south (jukebox, spawn), the level map board by the gate with one free station-sized spot beside it (reserved for the Roster). `districts` = Market, Workshop, Quarters, Gate. Lights: a flickering campfire light at the centre, lanterns at Market and Workshop. Merchants roam only inside the current ring. Wilderness scatter (trees, pines, dead trees, bushes) uses a `createRng` seeded from a constant, never `sim.rng`, and keeps 3 tiles clear of `ringRect(5)`'s fence and off the gate track. Scenery for sizes 2 to 5 is added only in ground that size opens.

1. Rewrite `tests/bunker-map.spec.ts`: dimensions 72x48; for each size, the same station ids and positions as size 1; every station, spawn, chest and van spot is open ground (`circleHitsSolid` false) and inside `ringRect(1)`; the map with `open: [k]` has no solid at `gapGround(section k)` and a decal prop there; two calls with the same shape give equal `townPrint`; different sizes give different prints; no tile is `bunker_wall`.
2. Run it; expect failures.
3. Build the layout, scenery and map; move the four constants to functions and fix every importer.
4. Update the other listed specs to the new layout (replace room rectangles with `ringRect`, door assertions with fence assertions).
5. Run `chemx test tests/bunker-map.spec.ts tests/home-contract.spec.ts tests/bunker-merchants.spec.ts tests/client-world.spec.ts tests/quest-marks.spec.ts tests/bunker-look.spec.ts tests/overrun*.spec.ts` then `chemx typecheck`. `tests/overrun-horde.spec.ts` room assertions (82-126) are rewritten in Task 6; here, change only what stops it compiling and mark the two layout cases `it.skip` with `// #7540 task 6`.
6. Commit: `feat(camp): the home map is a fenced outdoor camp (#7540)`.

### Task 4: Latch camp size and level at arrival; swap maps in the sim

**Files:**
- Create: `shared/camp/camp-latch.ts`
- Modify: `shared/sim-state.ts` (HomeRun), `shared/level-change.ts` (raiseMap, enterBunker), `shared/trip.ts:137-141`, `shared/trip-roster.ts` (fresh room's first join), `shared/sim-factory.ts`
- Test: `tests/camp-latch.spec.ts` (create)

**Interfaces:**
- Consumes: Task 3 `CampShape`, `generateWorldMap(seed, level, camp)`.
- Produces:
  - `HomeRun.campLevel: number` and `HomeRun.campSize: CampSize` (defaults 1 and 1)
  - `campSizeFor(level: number): CampSize` = `clampCampSize(level)` (the one function project 2 replaces)
  - `latchCamp(sim: SimState): void` sets both from `homeRun.roomHighest`
  - `campShape(sim: SimState): CampShape` (size from the latch, `open` from `sim.map.camp`)
  - `swapCampMap(sim: SimState, open: readonly number[]): void` replaces `sim.map` with the same size and the given open sections and rebuilds `sim.flow` and `sim.noiseFlow`; it does not empty the world
  - `raiseMap` rebuilds when the seed or the camp size differs

1. Write the failing tests: arriving home after banking level 3 gives `campSize` 3 on that arrival (this needs `syncRoomHighest` before `enterBunker` in `endTrip`); the first player into a fresh room with `highest: 4` gets size 4 and stands on open ground; a player whose departure drops `roomHighest` mid-visit leaves `campSize`, `campLevel` and `sim.map` unchanged (Review Focus 4); `swapCampMap(sim, [k])` keeps players, merchants and zombies where they are and makes the gap tile unblocked in `sim.flow`.
2. Run; expect failures.
3. Implement. In `endTrip`: bank, `syncRoomHighest`, `latchCamp`, `enterBunker`. In the fresh-room first join: `latchCamp`, then rebuild map and re-place merchants and the van if the size changed, before the welcome is sent.
4. Run `chemx test tests/camp-latch.spec.ts tests/trip*.spec.ts tests/home*.spec.ts tests/overrun-off-rng.spec.ts`; expect pass.
5. Commit: `feat(camp): camp size and level latch at arrival (#7540)`.

### Task 5: Camp shape on the wire; quiet map swap on the client

**Files:**
- Modify: `shared/protocol.ts` (Snapshot near 378, WelcomePacket near 441, `PROTOCOL_VERSION` 469), `shared/snapshot-build.ts:182`, `shared/room/game-room.ts:231`, `src/network/home-guards.ts` and the welcome/snapshot guards beside it, `src/game/run-session.ts:412-419`, `src/game/run-stage.ts`, `src/game/client-world.ts`, `src/engine/world-renderer.ts`
- Test: `tests/camp-wire.spec.ts` (create); update `tests/home-packets.spec.ts` and the protocol version spec

**Interfaces:**
- Consumes: Task 4 `campShape(sim)`.
- Produces:
  - Optional `camp?: { size: number; open?: number[] }` on both `Snapshot` and `WelcomePacket`, left off entirely outside the bunker and when size is 1 with nothing open
  - `readCampShape(camp: unknown): CampShape` (anything missing or malformed gives `WHOLE_CAMP`; size through `clampCampSize`; `open` filtered to integers that are breachable indices for that size)
  - `PROTOCOL_VERSION = 6`, with the comment extended: "v6: the home map is the camp"
  - `RunStage.open(mapSeed, level, camp?)`; `RunStage.follow` takes the arrival path when seed or size changes and calls a new `ClientWorld.swapMap(map)` when only `open` changes
  - `ClientWorld.swapMap(map: WorldMap): void` and `WorldRenderer.swapMap(map)`: replace the map, refresh collision, occlusion, ground chunks and prop draw list; no `noteStageCut`, no snapshot-buffer clear, no prediction reset, no camera reset

1. Write the failing tests: a snapshot in a town and one in a whole size-1 camp have no `camp` key (byte-equal to today's for the size-1 case); a welcome from a size-3 camp makes a guest build a map whose `townPrint` equals the host's; the same with two sections open (Review Focus 1); `readCampShape(undefined)`, `({})`, `({ size: 99, open: ['x', -1] })` give size 1 or 5 as clamped and no open sections (Review Focus 5); following a snapshot whose only change is `open` calls `swapMap` and does not call `noteStageCut`; a join with protocol 5 is refused with close code 4014.
2. Run; expect failures.
3. Implement.
4. Run `chemx test tests/camp-wire.spec.ts tests/home-packets.spec.ts tests/room*.spec.ts tests/run-stage*.spec.ts tests/client-world.spec.ts`, then `chemx typecheck`.
5. Commit: `feat(camp): camp size and open sections travel on welcome and snapshot; protocol 6 (#7540)`.

### Task 6: The breach picks fence sections, shows them, and opens them

**Files:**
- Create: `shared/camp/breach-pick.ts`
- Modify: `shared/overrun.ts`, `shared/sim-state.ts` (OverrunState), `shared/home-protocol.ts` (OverrunView, additive), `src/network/home-guards.ts`, `shared/bunker-map.ts` (remove `BLAST_DOOR_SPOT`), `tools/horde-bench.ts:61-133`
- Test: `tests/breach-pick.spec.ts` (create); rewrite `tests/overrun-horde.spec.ts:82-126`; update `tests/overrun-soak.spec.ts`; `tests/overrun-off-rng.spec.ts` must pass untouched

**Interfaces:**
- Consumes: Task 2 sections, Task 4 `swapCampMap`, `HomeRun.campLevel`.
- Produces:
  - Constants in `overrun.ts`: `OVERRUN_GAPS_MAX = 4`, `OVERRUN_GAP_SPACING = 4` (sections), `OVERRUN_SPAWN_OUT_TILES = [4, 7]`
  - `gapCount(campLevel: number, difficulty: DifficultyId): number` = clamp(byLevel + byDifficulty, 1, 4); byLevel 1 below level 4, 2 for 4-6, 3 from 7; byDifficulty 1 for `lights_out` and `undead_tired`, else 0
  - `pickGaps(sections: readonly FenceSection[], count: number, rng: () => number): number[]` returns sorted section indices: breachable only, none adjacent, at least `OVERRUN_GAP_SPACING` apart around the ring while that many still fit, otherwise as many as fit non-adjacent, never fewer than 1, a bounded number of draws
  - `OverrunState.gaps: number[]` (empty until armed) and `OverrunState.gapTurn: number`
  - `OverrunView.gaps?: number[]`, present from the arming tick on; phase `armed` means rattling, `breached`/`held`/`lost` means down
  - `gapSpawn(sim, section): { x, y }` open ground 4 to 7 tiles out along `section.out`

Behaviour: gaps are picked on the tick the phase turns `armed`, and nowhere else. At zero, `swapCampMap(sim, gaps)` then the roster as today (`campLevel` in place of the live `roomHighest` for the level), dealt round-robin over the gaps at the unchanged global 0.22 s interval, each zombie spawned at its gap's `gapSpawn` and set hunting. Gaps stay open until the next arrival rebuilds a whole map. The event `overrun_warning` at step 2 and `overrun_breach` each gain an optional `gaps` count.

1. Write `tests/breach-pick.spec.ts`: `gapCount` table (level 2 Night Light 1; level 5 Stay Close 2; level 10 Undead Tired 4; level 1 any difficulty at least 1); `pickGaps` with a seeded rng returns only breachable, non-adjacent indices for every size and count 1 to 4, and at size 1 with count 4 returns between 1 and 4 without hanging (Review Focus 3); for every breachable section of every size, `gapSpawn` is open ground on the map and a `FlowField` built on the opened map has a path from it to the camp spawn (Review Focus 2).
2. Rewrite the horde spec's layout cases: no gaps in the view before arming; `view.gaps` equals `state.gaps` after; at zero the map's `camp.open` equals the gaps; every zombie's spawn is outside the ring; with 2 gaps the first 10 zombies alternate gaps.
3. Run both; expect failures.
4. Implement; delete `BLAST_DOOR_SPOT`; point `tools/horde-bench.ts --scene=overrun` at the gap spawns.
5. Run `chemx test tests/breach-pick.spec.ts tests/overrun*.spec.ts`. If the soak's hold rate moves by more than 10 points from its current pinned value, stop and report the numbers in a task comment instead of retuning.
6. Commit: `feat(camp): the horde breaks the fence at picked sections (#7540)`.

### Task 7: How the camp looks

**Files:**
- Create: `src/art/environment/camp-fence.ts`, `src/art/environment/camp-props.ts`
- Modify: the prop sprite registry those files plug into (follow `src/art/environment/bunker-props.ts`), `src/engine/overrun-look.ts`, `src/engine/entity-renderer.ts:391-401`, `src/engine/level-look.ts` (the `'bunker'` entry), `src/engine/ground-motion.ts:16`, `src/game/map/town-map.ts:64-211`, `src/game/map/map-key.ts:61-65`, `tools/contact-sheet.ts:118`
- Test: rewrite `tests/overrun-look.spec.ts`; update `tests/bunker-look.spec.ts`, `tests/art-environment.spec.ts`

**Interfaces:**
- Consumes: `OverrunView.gaps`, `WorldMap.camp.sections`.
- Produces: `fenceState(view: OverrunView | null, sectionIndex: number): 'whole' | 'rattling' | 'down'` in `overrun-look.ts` (rattling only for a listed gap while `armed`). Sprites for every Task 1 and Task 3 prop kind, with `rattling` frames for the two fence kinds.

Look rules from the spec: scrap fence of corrugated sheet, pallets and chain-link in the game's existing pixel style; night with a cool ambient, the campfire as a warm flickering light, lanterns at Market and Workshop, no weather; the rattle leans the section and throws sparks or dust. The Tab map draws grass, dirt, the ring and open gaps, and its key reads "Camp map". The `blast_door` art and prop definition are not deleted.

1. Rewrite `tests/overrun-look.spec.ts` for `fenceState` (whole while counting; rattling for listed gaps and whole for the rest while armed; down once breached, held or lost; whole when the view is null).
2. Run; expect failure. Implement the state function and the art; wire the renderer to draw each fence prop by its own section state.
3. Run `chemx test tests/overrun-look.spec.ts tests/bunker-look.spec.ts tests/art-environment.spec.ts` and `chemx typecheck`.
4. Open the game (WordPress admin route, per the root CLAUDE.md, or `pnpm dev:zombie-survival` if that is how this app is served; check `chemx p -s`) and screenshot the camp at sizes 1 and 5 and during a rattle. Attach paths in a task comment.
5. Commit: `feat(camp): camp art, night look and per-section fence states (#7540)`.

### Task 8: Sound, the warning banner and the reload prompt

**Files:**
- Modify: `src/audio/sfx-ambience.ts:93-97`, `src/audio/music.ts:29`, `src/audio/sfx-world.ts` and `src/audio/event-sounds.ts` (fence tell and fall, positioned at each gap), `src/game/run-notices.ts:129-158`, `src/engine/ammo-prompt.ts:26-38`
- Test: `tests/ammo-prompt.spec.ts`, `tests/run-notices.spec.ts` (create or extend whichever exists)

**Interfaces:**
- Consumes: the `gaps` count on `overrun_warning` step 2 and `overrun_breach`.

1. Write the failing tests: the step 2 notice reads `THE FENCE IS GIVING` with `1 PLACE` or `N PLACES`; steps 0 and 1 name no place; the empty-magazine prompt shows at home when guns are free and stays hidden otherwise.
2. Run; expect failure. Implement: a quiet night bed with wind at home, the positioned rattle while armed, the fall at the breach.
3. Run the two specs and `tests/audio*.spec.ts`.
4. Commit: `feat(camp): camp ambience, the fence tell, and reload prompts during a breach (#7540)`.

### Task 9: Words and docs

**Files:**
- Modify: `src/game/how-to-play.ts` (18, 28, 171-181, 224, 237, 250, 253-255), `src/game/how-to-play-visuals.ts` (71-76, 158-160), `src/game/magazine-hints.ts` (373, 431-442), `src/engine/station-labels.ts`, `docs/README.md` (home section; horde cap 140), `docs/CHANGELOG.md`, `docs/community.md:222`, and a one-line "superseded by" note at the top of `docs/specs/2026-11-05-home-loop-design.md` and `docs/specs/2026-11-06-bunker-features-design.md`
- Test: whichever specs pin that copy (`chemx q -g "blast door" -l tests`)

1. Replace every player-facing "bunker", "hall", "blast door" and "safe: no zombies" line with camp wording that matches the built behaviour. The base's name stays Zero Point. Follow the tone of the lines around each one.
2. `chemx q -g "blast door" -l src docs` and `chemx q -g "bunker" -l src/game/how-to-play.ts src/game/magazine-hints.ts` return only code identifiers and the level 6 art.
3. Run the affected specs; commit: `docs(camp): copy and docs say camp, fence and gaps (#7540)`.

### Task 10: Gate

1. `chemx verify` from `apps/zombie-survival`; all green.
2. Run the overrun soak and `tools/horde-bench.ts --scene=overrun`; record hold rate and frame time against the values before Task 3 in a task comment.
3. In the running game: arrive at sizes 1 and 5; watch a 1-gap and a 3-gap breach from the tell to the end; host a room and join it from a second tab at size 3, once at peace and once mid-breach.
4. Release every lock; `chemx team task done` each task with its `--target`; report anything not verified.
