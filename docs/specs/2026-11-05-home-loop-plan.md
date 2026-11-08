# Home Loop Implementation Plan

> **For agents:** one task here is one chemx task. Status lives in `.chemx/index.db`, never in this file, so there are no checkboxes. Claim the task, lock each file before editing, commit small and green on `main`, release, then `chemx team task done`.

**Goal:** Turn the game into a campaign played from a saved underground bunker, with treasure, a forge, merchants and trips out to towns, behind one switch.

**Architecture:** The bunker is a reserved-seed map inside the existing `GameSimulation`, which holds only carried treasure and gear in hand. Bank, locker, forge, shops and ledger live in a browser `HomeStore`. Prep splits and one contract commit let seven lanes work in parallel with one owner per file. `HOME_LOOP_LIVE` stays false until the last task.

**Tech Stack:** TypeScript, Vue 3, Vite, Vitest, Node `ws`. Pure RGBA art in `src/art`.

**Spec:** `apps/zombie-survival/docs/specs/2026-11-05-home-loop-design.md`. Read it first: this plan gives names, order and tests, and the spec gives the rules and values.

All paths are under `apps/zombie-survival/`. Tests run as `chemx test tests/<name>.spec.ts --project-root=apps/zombie-survival`, typecheck as `chemx typecheck --project-root=apps/zombie-survival`.

## Global Constraints

- `HOME_LOOP_LIVE = false` until Task 13. With it false, players see no change and existing specs stay green. `?home` turns home mode on in a dev build only.
- Every file has one owner: the lane table in the spec. A file you do not own is refused by DM to the owner, not edited. The frozen list in the spec stays frozen.
- 100 silver = 1 gold. Money is whole silver.
- Treasure uses its own generator and id counter, never `entityId()`, `sim.rng` placement or the ammo budget.
- All home code returns early unless `sim.homeRun` is set.
- Explicit `.ts` imports, no enums, small files, named conditions, matching the code around you. No mock data.
- Lanes run targeted specs. Only Task 13 runs the full suite.
- `#7116` (sprites) and any other live game task must have landed, or its files be left alone, before a task touches them. Check `chemx status` first.
- Agent prompts say the work is authorized and that relayed user messages are for the orchestrator. Set the model from the task's `needs`: light haiku or sonnet low, standard sonnet medium, deep opus high.

## Review Focus

Each line is pinned by a test in the task named.

1. A refresh during the van ride, between a receipt arriving and the save finishing, applies it exactly once (Task 8).
2. A player who closes the tab while downed loses their treasure and gets no bank (Task 7).
3. A browser with storage blocked or full warns and never starts a trip on unsaved gear (Task 8).
4. A second tab open during a trip does not double a result, a smelt or a sale (Task 8, Task 13 in a real browser).
5. A co-op player who changes gear between trips with a stale save gets the server's view, with refused gear still in the locker (Task 8).

---

### Task 1: P1 split `shared/simulation.ts` (#7135, standard)

**Files:** Modify `shared/simulation.ts`. Create `shared/sim-factory.ts`, `shared/snapshot-build.ts`, `shared/run-end.ts`.

**Interfaces:** Produces `createSimState(options: SimulationOptions): SimState`, `buildSnapshot(sim: SimState): SnapshotPacket`, and `leaveTown`, `checkGameOver`, `endRun`, `restartRun` as functions of `SimState`. `GameSimulation`'s public API is unchanged, and `private readonly sim` keeps that name because `stateOf` reads `sim['sim']`.

1. Move the code with no logic change.
2. Run `chemx test tests/lifecycle.spec.ts`, `tests/level-endings.spec.ts`, `tests/reconnect.spec.ts`, then typecheck. Expected: all pass unchanged.
3. Commit `refactor(zombie-survival): split simulation.ts (#7135)`.

### Task 2: P2 events and derived guards (#7136, standard)

**Files:** Modify `shared/protocol.ts`, `src/network/packet-guards.ts`. Create `shared/events.ts`.

**Interfaces:** Produces `GAME_EVENT_TYPES`, `PICKUP_TYPES`, `GAME_PHASES` as `as const` arrays in `shared/`, with `GameEvent['type']`, `PickupType`, `GamePhase` derived from them and re-exported from `protocol.ts`, so no importer changes.

1. Add to `tests/client-packets.spec.ts`: `it('accepts every pickup and event type shared declares')`, looping the arrays through `parseServerPacket` and expecting non-null.
2. Run it. Expected: passes for today's names, proving the arrays match the old hand lists exactly.
3. Replace the hand lists in `packet-guards.ts`.
4. Run `tests/client-packets.spec.ts`, `tests/client-session.spec.ts`, typecheck. Commit.

### Task 3: P3 split `game-controller.ts` (#7137, standard)

**Files:** Modify `src/game/game-controller.ts`. Create `src/game/run-session.ts`, `src/game/snapshot-handler.ts`.

**Interfaces:** `RunSession` takes startSolo, continueSolo, startCoop, beginSession, onWelcome, onClosed, toMenu, playAgain, continueAgain. `SnapshotHandler` takes onSnapshot, onGameEvent, enterGameOver. `GameController`'s public methods stay and delegate.

1. Move the code. 2. Run `tests/client-flow.spec.ts`, `tests/client-levels.spec.ts`, typecheck. Expected: unchanged. 3. Commit.

### Task 4: P4 split `server/server.ts` (#7138, light)

**Files:** Modify `server/server.ts`. Create `server/limits.ts`, `server/restart-vote.ts`, `server/room.ts`.

**Interfaces:** `limits.ts` exports the constants and `takePacketAllowance`. `createRestartVote(...)` wraps the vote. `Room` owns join, disconnect and ticking. `startGameServer` keeps its signature.

1. Move the code. 2. Run `tests/server-levels.spec.ts`, `tests/server-workbench.spec.ts`, `tests/reconnect.spec.ts`, typecheck. 3. Commit.

### Task 5: Contract (#7139, deep)

Waits for Tasks 1 to 4. One agent, one commit, no behaviour change. Reviewed by the orchestrator before any lane starts.

**Files:** Create `shared/home-protocol.ts`, `shared/bunker-map.ts` (stub), `shared/stations.ts` (stub), `shared/treasure.ts` (stub), `shared/trip.ts` (stub), `shared/loadout.ts` (stub), `src/game/home/home-store.ts`, `src/game/home/shop.ts` (stub), `src/game/home-hud.ts`, `src/components/MerchantScreen.vue` (stub), `src/art/environment/merchants.ts` (stub), `tests/helpers/home-harness.ts`. Modify `shared/protocol.ts`, `events.ts`, `sim-state.ts`, `simulation.ts`, `world-map.ts`, `world-query.ts`, `exit-van.ts`, `players.ts`, `pickups.ts`, `player-health.ts`, `level-change.ts`, `levels.ts`; `src/network/transport.ts`, `local-session.ts`, `socket-session.ts`; `src/game/hud-state.ts`, `game-controller.ts`; `src/engine/scene.ts`; `src/art/environment.ts`, `types.ts`, `index.ts`; placeholder rows in `art/fx/pickups.ts`, `art/fx/icons.ts`, `art/environment/tiles.ts`, `audio/audio-engine.ts`, `audio/music.ts`, `engine/fx-director.ts`, `engine/level-look.ts`, `game/level-swatches.ts`, `game/town-map.ts`; `tests/world-map.spec.ts`.

**Interfaces, in `shared/home-protocol.ts`:**

```ts
export const HOME_LOOP_LIVE = false;
export type MerchantId = 'gunsmith' | 'quartermaster' | 'medic' | 'powder';
export type StationId = 'bench' | 'forge' | 'locker' | 'level_map' | MerchantId;
export interface Station { readonly id: StationId; readonly x: number; readonly y: number; readonly radius: number }
export interface Jewels { small: number; large: number }
export interface Loadout {
  guns: Partial<Record<WeaponId, { fit?: GunFit }>>;
  ammoBag: Record<WeaponId, number>;
  parts: PartCounts; kits: KitCounts;
  medkits: number; knife: boolean; bottles: number;
}
export interface JoinHome { loadout: Loadout; highest: number }
export type HomeAction =
  | { kind: 'pick_level'; level: number } | { kind: 'equip'; loadout: Loadout }
  | { kind: 'ready'; ready: boolean } | { kind: 'leave_station' } | { kind: 'highest'; highest: number };
export interface TripReceipt {
  simId: string; serial: number; outcome: 'banked' | 'died'; level: number; difficulty: DifficultyId;
  silver: number; jewels: Jewels; replay: boolean; // on 'died', silver and jewels are what was lost, never credited
  score: number; kills: number; hordes: number; seconds: number;
  ending: boolean; gear: Loadout | null;
}
export interface HomeView { silver: number; jewels: Jewels; station: StationId | null; stationHold: number; ready: boolean; receipt: TripReceipt | null }
export interface RoomHomeView { pickedLevel: number | null; roomHighest: number }
```

**Protocol:** `PickupType` gains `silver`, `jewel_small`, `jewel_large`. `PROP_DEFS` gains `forge`, `level_map`, and one prop per `MerchantId`; stalls reuse `counter`. `TILE_KINDS` appends `bunker_wall`. `PlayerEntity.home?: HomeView`, `SnapshotPacket.home?: RoomHomeView`, `WelcomePacket.resumed?: boolean`, join gains `home?: JoinHome`, `ClientPacket` gains `{ type: 'home'; action: HomeAction }`. `events.ts` gains `trip_start { level, attempt }`. `LevelTheme` gains `bunker`. `WorldMap` gains optional `walls: Box[]`, `exit: Point`, `stations: Station[]`.

**Sim:** `SimulationOptions.home?: boolean`. `SimState.homeRun: { simId: string; tripLevel: number | null; pickedLevel: number | null; attempt: number; roomHighest: number; nextTreasure: number; nextReceipt: number } | null`. `PlayerState.home: { silver: number; jewels: Jewels; station: StationId | null; stationHold: number; ready: boolean; receipt: TripReceipt | null; highest: number; lost: { silver: number; jewels: Jewels }; lastActiveTick: number } | null`. `GameSimulation.homeCommand(id: string, action: HomeAction): void`, `hasBodyFor(token: string): boolean`, `addPlayer(id, name, token, character, home?: JoinHome)`. `BUNKER_SEED = -1`, `isBunkerSeed(seed: number): boolean`, `isBunkerMap(map: WorldMap): boolean`, `levelSeed(runSeed, level, attempt = 0)`.

**Stubbed hooks, called from their real sites, empty until the owning lane fills them:** `updateStations(sim, p)` in `players.ts` beside `updateSearch`; `takeTreasure(p, item): boolean` in `pickups.ts` `applyPickup`; `dropCarried(sim, p)` in `player-health.ts` on death; `placeTownTreasure(sim)` in `level-change.ts` and the constructor path, after `seedPopulation`.

**Client:** `transport.connect(options: ConnectOptions)` with `{ name, difficulty, character, startLevel, home, homeLoop }`, `sendHome(action: HomeAction)`. In `home-store.ts`:

```ts
export type SaveResult = { kind: 'saved'; version: number } | { kind: 'conflict' } | { kind: 'failed'; reason: string };
export interface HomeStore { load(): Promise<HomeSave>; save(next: HomeSave): Promise<SaveResult> }
export interface HomeSave {
  version: number; silver: number; rawJewels: Jewels; locker: Loadout; hands: Loadout;
  openTrip: OpenTrip | null; appliedReceipts: readonly string[]; ledger: readonly TripRecord[]; shop: ShopState;
}
export interface OpenTrip { level: number; mode: 'solo' | 'coop'; difficulty: DifficultyId; startedAt: number }
export interface TripRecord { level: number; outcome: 'banked' | 'died'; difficulty: DifficultyId; silver: number; jewels: Jewels; replay: boolean; at: number }
```

In `shop.ts`: `ShopState { seed: number; rolls: number; merchants: Record<MerchantId, MerchantStock> }`, `MerchantStock { items: Record<string, number> }`, `ShopContext { highest: number; station: StationId | null; difficulty: DifficultyId }`, `ShopRow { item: string; price: number; stock: number }`, `rollStock(save: HomeSave): HomeSave`, `buy(save: HomeSave, merchant: MerchantId, item: string, context: ShopContext): HomeSave | null`, `shopRows(save: HomeSave, merchant: MerchantId, context: ShopContext): ShopRow[]`. `UiState.home: HomeUi | null` with `shop: MerchantId | null`, `highest: number`, `difficulty: DifficultyId`. `shopContext(home: HomeUi): ShopContext` in `home-hud.ts`. `GameController.home: HomeActions { pickLevel, equip, closeStation, smelt, buy, wake, continueFromEnding }` as stubs, with `buy(merchant, item)` building its own context. `SceneView.station?: StationId`. `ArtBook.merchants`. `homeSim(options?)` in `tests/helpers/home-harness.ts`.

1. Add `it('reserves the bunker seed for a map of its own')` to `tests/world-map.spec.ts`: `generateWorldMap(BUNKER_SEED)` has `walls`, `exit`, `stations` and `districts`, and no `buildings`. Change that spec's tile assertion so `bunker_wall` is excused in towns.
2. Add `it('changes nothing when home is off')` to a new `tests/home-contract.spec.ts`: two sims, same seed, 600 steps, equal snapshots, and `levelSeed(s, l)` equals `levelSeed(s, l, 0)`.
3. Build the seams. The stub map is one room with spawn, exit and every station.
4. Run those specs, `tests/art-environment.spec.ts`, `tests/art-book.spec.ts`, typecheck. Expected: pass. Placeholder sprites must pass the size checks; add a minimal real sprite rather than edit the test.
5. Commit, then stop for review.

### Task 6: Lane bunker-world (#7140, standard)

Waits for Task 5. Owns its row in the spec's lane table.

**Interfaces:** Fills `updateStations`, `takeTreasure`, `dropCarried` (which adds what it drops to `p.home.lost`), `placeTownTreasure`. Produces `stationInReach(map, x, y): Station | null`, `silverToCoins(silver: number): { gold: number; silver: number }`. `spawnPickup` takes treasure ids from `sim.homeRun.nextTreasure`, as `t<n>`, including drops from a search. `groundSpeedScale` and the other town rules are neutral on a bunker map.

Tests, in `tests/bunker-map.spec.ts`, `tests/stations.spec.ts`, `tests/treasure.spec.ts`:

- `every room and station is reachable from spawn` (flood fill over `map.walls`).
- `each merchant station sits on the customer's side of its counter`.
- `holding E at a station sets p.home.station, and walking off clears it`.
- `home off places no treasure`.
- `treasure leaves ammo in town and every roll on sim.rng as they were` (same seed with and without, compare ammo budget and `sim.nextEntity`).
- `a treasure container still makes the luck and bottle rolls` (Kai's find rate over 2000 searches matches an empty container's).
- `a replay places half as many treasures, rounded down, at full value`.
- `a coin stack vanishes when taken` (rounds zeroed in `takeTreasure`).
- `a dead player's carried treasure drops where they fell, p.home.lost records it, and a teammate can take it`.
- `the treasure table's counts hold at levels 1 and 10` (about 30 silver, 5 small, 1 large; 45, 8, 3).

Write each failing, implement, run, commit per file group. The real map is a tile plan about 40 wide; do not use `MapBuilder.place`.

### Task 7: Lane trip-loop (#7141, deep)

Waits for Task 5. Sole arbiter of `protocol.ts`, `events.ts`, `home-protocol.ts`.

**Interfaces:** `startTrip(sim, level)`, `returnToBunker(sim)`, `wipeToBunker(sim)` in `shared/trip.ts`. `startTrip` clears each `p.home.receipt` and `p.home.lost`. `validateLoadout(value: unknown): Loadout | null`, `applyLoadout(p, loadout)`, `loadoutOf(p): Loadout`, `loadoutOfEntity(entity: PlayerEntity): Loadout`, `mergeHome(locker: Loadout, gear: Loadout): Loadout`, `issueFreePistol(p)` in `shared/loadout.ts`. `homeCommand` handles every `HomeAction`. `sim.level` is 0 in the bunker. Receipts are built here: each takes its serial from `sim.homeRun.nextReceipt` and its difficulty from `sim.difficulty`, and a died receipt reads `p.home.lost`. `viewFor` in `shared/snapshot-view.ts` drops other players' receipts. Specs that need treasure wait for Task 6's `takeTreasure`.

Tests, in `tests/trip-loop.spec.ts`, `tests/loadout.spec.ts`, `tests/coop-trip.spec.ts`:

- `starts in the bunker with no zombies, no waves, and sim.level 0`.
- `arriving in the bunker heals to full`.
- `guns cannot fire in the bunker`.
- `the van leaves only when every counted player is ready for 2 seconds, and needs a picked level`.
- `a player with no keys and no station for 60 seconds stops counting and rides along`.
- `an open station keeps a player counted`.
- `each trip gets a new town, and attempt 0 keeps today's seed`.
- `banking returns treasure and gear on a receipt, with magazines emptied into rounds and clamped to the reserve cap`.
- `a second copy of a gun keeps the one with more mods and returns the other's parts`, through `mergeHome`.
- `mergeHome keeps the locker to the carry caps`.
- `loadoutOfEntity reads the same gear as loadoutOf`.
- `receipts in a room never repeat a serial, across players, restarts and an emptied room`.
- `a client sees only its own receipt` (`viewFor`).
- `a new trip clears the last receipt and what was lost`.
- `a wipe leaves the sim running and returns everyone to the bunker with a died receipt`.
- `the level 10 van flags the receipt as the ending and carries on in the bunker`.
- `a teammate who dies spectates, returns with the kit, and what they find after banks`.
- `downed when the van leaves counts as dead`.
- `a disconnect drops carried treasure after 60 seconds, at once if downed, and gets no banked receipt` (Review Focus 2).
- `a refresh inside the grace period keeps everything`.
- `pick_level is capped at the room's highest`.
- `the free pistol adds a gun and starting rounds up to the cap, no bottle, and keeps other gear`.
- `validateLoadout refuses unknown ids and anything over a slot or cap`.
- `workbench actions work per player at the bench with sim.bench null`.

Commit in small green steps, since this is the critical path.

### Task 8: Lane net-save (#7142, standard)

Waits for Task 5. Socket specs wait for Task 7.

**Interfaces:** `createBrowserHomeStore(store?): HomeStore` in `browser-home-store.ts`, under key `outbreak.home`, using `navigator.locks` and never `writeJson`. `applyReceipt(save, receipt): HomeSave` in `trip-ledger.ts`, keyed `${simId}:${serial}`, calling `mergeHome` for the gear and `rollStock` on a banked receipt, and crediting nothing on a died one. A ledger row takes its difficulty from the receipt, or from `OpenTrip.difficulty` when `resolveOpenTrip` closes a trip with no receipt. `smeltTick(save, seconds): HomeSave` in `forge.ts`, 3 seconds a jewel, paying 40 and 200. `resolveOpenTrip(save, resumed: boolean | null): HomeSave`. `HomeSync` in `home-sync.ts` observes snapshots and owns every save call. `recordLevelCleared(n)` in `level-progress.ts`. `parseHome(value: unknown): HomeAction | null` in `server/home-packets.ts`.

When `save.openTrip` is set, connect uses `home: { loadout: emptyLoadout(), highest }`, so a quit trip cannot be escaped in co-op: the gear stays forfeit, and a body the room still holds keeps what it has.

Tests, in `tests/home-store.spec.ts`, `tests/level-progress.spec.ts`, `tests/server-home.spec.ts`, `tests/home-soak.spec.ts`:

- `old level progress and best runs load untouched`.
- `a write failure comes back as failed, not silence` and `the player is never ready on a failed save` (Review Focus 3).
- `a stale save returns conflict, and a receipt re-reads and reapplies` (Review Focus 4).
- `a receipt applied, then a refresh before the save finished, applies once` (Review Focus 1).
- `a new sim's serial 1 is not mistaken for an old one`.
- `a player carried along by the idle rule has a trip opened on arrival`.
- `an open solo trip resolves as a death on load`, and `an open co-op trip waits for welcome.resumed up to 10 seconds`.
- `a death clears gear and carried treasure, and keeps the bank and locker`, and `a died receipt credits nothing and records what was lost in the ledger`.
- `the forge pays per jewel and only while at the forge`.
- `welcome sends sim.map.seed`, and `solo keeps one sim across trips`.
- Over sockets, in `tests/server-home.spec.ts`: `join with gear`, `refused gear stays in the locker, and the client takes the server's view` (Review Focus 5), `a new loadout between trips`, `a join with a trip still open brings an empty loadout`, `an emptied room resets to the bunker`, `a worst-case join fits MAX_PACKET_BYTES`.
- Soak: `treasure is conserved except where a rule forfeits it`, and `repeated trips cannot grow ammo past the caps`.

### Task 9: Lane merchants (#7149, standard)

Waits for Task 5, and Task 8's store for the end-to-end spec.

**Interfaces:** Fills `rollStock`, `buy` and `shopRows`. `MERCHANTS: Readonly<Record<MerchantId, MerchantDef>>` in `merchant-data.ts`, with the spec's table of items, prices and gates. `shopRows(save, merchant, context): ShopRow[]` for display, with `shopContext(home)` giving the screen its context. `MerchantScreen.vue` reads `UiState.home` and calls `GameController.home.buy`.

Tests, in `tests/shop.spec.ts`, `tests/shop-balance.spec.ts`:

- `prices and level gates match the table`, gates reading `context.highest`.
- `a sale takes money, stock and adds to the locker in one save`, and `a failed save charges nothing`.
- `a conflict refreshes the shop and does not retry`.
- `a cap counts locker and gear in hand`.
- `a box is refused at 56 of 60 rounds`.
- `a gun you own is not offered, and a bought gun comes empty`.
- `a roll replaces all stock, and stock survives a reload`.
- `ten empty quit-trips leave stock unchanged`.
- `saves roll different stock`.
- `box rounds scale with difficulty`, and `bought ammo stays under 15% of the town budget at every difficulty`.
- `boxes are rolled always and hidden if you own no such gun`.
- `buy is refused unless context.station is that merchant and no trip is open`.
- Spending soak: a bot buys ammo, then a medkit, then a carbine over 20 trips of `shop.ts`, and reports silver left. No assertion beyond it finishing; the numbers tune prices.

Sprites and portraits are original art in `src/art/environment/merchants.ts`. Add them to a contact sheet and check them by eye.

### Task 10: Lane client-run (#7143, standard)

Waits for Tasks 5, 7, 8.

**Interfaces:** Implements `GameController.home`, with `buy` keeping its signature and building its context by `shopContext(ui.home)`. `run-hud` gives `homeUi` its `HomeFacts`: the save, the player's own highest from level progress, and the difficulty from welcome, since a guest plays the room's. `run-stage` branches on `isBunkerSeed` for theme `bunker` and no level card. Input is held for an open station without calling `setPaused`. `recordLevelReached` is off the home path. `client-world` feeds `SceneView.station`. Results are recorded from receipts.

Tests, in `tests/client-home.spec.ts`:

- `Play starts in the bunker`, and `?home` turns home mode on in a dev build only.
- `a first visit shows the hint pointing to the van, and a later one does not`.
- `owning a gun but boarding without one prompts at the van`.
- `the bunker shows no horde timer, level card or town weather`.
- `a death shows the summary and wakes in the bunker, with no game over screen`.
- `a carried player does not unlock on arrival, and does at the van`.
- `a first clear of level 10 plays the ending and returns to the bunker without toMenu`, and `a later clear does not`.
- `a shop holds input without pausing the run, and closes when the station clears`.
- `Esc closes a station before it toggles pause`.
- `the best trip is recorded from a receipt, banked or not`.

### Task 11: Lane screens (#7144, standard)

Waits for Task 5. Built only against `UiState.home` and `GameController.home`. Split `HudOverlay` and `LevelsPage` first, into `TreasureChip` and `LevelGrid`. Keep every legacy path until Task 13.

Tests, in `tests/home-screens.spec.ts`:

- `the locker shows both sides and closing it calls equip`.
- `the forge shows per-jewel progress`.
- `the garage map caps at the room's highest and marks replays`.
- `the death summary lists what was lost`.
- `the pause menu warns before leaving mid-trip`, and `does not warn in the bunker`.
- `the cursor shows while a shop is open`.
- `old best runs are labelled classic`.
- `PlaySetup hides level choice in home mode, and the co-op note no longer says level 1`.

### Task 12: Lane look-sound (#7145, standard)

Waits for Task 5. Replaces every placeholder row except merchants. Sprites for forge, level map, bunker wall, silver and jewels. Bunker look with no weather and warm lamps. Bunker scene and playlist entry, wired but inert until the flip. Station prompt from `SceneView.station`. A small rectangular town map with room labels. Treasure pickup sounds.

Tests, in `tests/bunker-look.spec.ts` plus the existing art specs:

- `the bunker has no weather and its own light`.
- `the town map draws a small map with room labels`.
- `every new prop and pickup has a sprite and icon`.
- `the bunker scene plays the bunker track only with HOME_LOOP_LIVE`.
- `the Sound Test lists the bunker track from the start in home mode`.

Check the contact sheets by eye, and a frame time check in the bunker.

### Task 13: Integrator (#7146, standard)

Waits for every task above, and the user's go-ahead.

**Files:** `shared/home-protocol.ts`, `shared/levels.ts`, `src/audio/playlists.ts`, `tests/levels.spec.ts`, `src/game/how-to-play.ts`, `src/game/magazine-hints.ts`, `src/game/analytics/`, `docs/README.md`, `docs/CHANGELOG.md`, and the specs the flip breaks (`client-flow`, `client-levels`, `continue-run`, `level-select`, `server-levels`, `server-workbench`).

1. Set `HOME_LOOP_LIVE = true`. Rename level 6 to Blackout, and move `level-06-underground-bunker.mp3` to the bunker, leaving `level-06-toxic-silo.mp3` on level 6.
2. Rewrite the broken specs to the home flow. A spec that only described the old game over stays, on `home: false`.
3. Update How to Play with new sections, and analytics with Privacy text in the same commit.
4. Run the real-browser loop: solo with reduced motion on and off, co-op, and two real tabs. Screenshot each.
5. Run `chemx test --all --project-root=apps/zombie-survival` once on a clean tree, then `chemx verify` and `chemx audit`.
6. Commit. Deploying to the public repo waits for the user.

## Lane notes

From the contract review (#7161). These landed after Task 5 and before any lane started.

**New names, all in the code now:**

- `HomeRun.nextReceipt` is the next receipt's serial, from 1, for the whole room. No room reset or restart puts it back. `PlayerHome.serial` is gone.
- `HomeRun.simId` is the seed plus random bytes, so two sims on one seed still differ.
- `GameSimulation.hasBodyFor(token)` is true for a token in `sim.players` or `sim.departed`. `Room.join` asks it after `setDifficulty` and before `addPlayer`, and `WelcomePacket.resumed` is left off for a new body. `LocalSession` never sets it.
- `loadoutOfEntity(entity)` is `loadoutOf` for a client, a stub for trip-loop, built from `owned`, `ammoBag`, `mags`, `gear.parts`, `gear.fits`, `gear.kits`, `medkits`, `knife` and `bottles`. `gear`, `gear.kits` and `bottles` are left off the wire at none.
- `mergeHome(locker, gear)` is a stub for trip-loop to fill and test, and `applyReceipt` calls it.
- `ShopContext`, `ShopRow` and `shopRows` are in `shop.ts`, and `buy` takes a context. `HomeUi` has `highest` and `difficulty`. `shopContext(home)` builds a context from `HomeUi`. `homeUi(snapshot, local, facts)` takes `HomeFacts { save, highest, difficulty }` in place of `save`, and defaults to none until client-run passes them.
- `TripReceipt.difficulty` comes from `sim.difficulty`. `OpenTrip.difficulty` is written when the trip opens. Together they fill the ledger's `difficulty`.
- On a died receipt, `silver` and `jewels` are what was lost and are never credited. `PlayerHome.lost` holds them, written by `dropCarried`, and stays off the wire.

**Open items:**

- **bunker-world:** `updateSearch` returns early on `isBunkerMap(sim.map)` after clearing release state, since `sim.containers` does not match the bunker.
- **trip-loop:** owns `shared/snapshot-view.ts`, so `viewFor` drops other players' receipts. `startTrip` clears `p.home.receipt`.
- **net-save:** `room.ts` `receive()` sends unknown packets to `vote.ask`, so add the home branch with `parseHome`. Parse `join.home`. `server.ts` must pass `home: true` when live. `LocalSession`'s welcome must send `sim.map.seed`. `packet-guards` must check `PlayerEntity.home`, `SnapshotPacket.home` and `WelcomePacket.resumed`.
- **trip-loop and net-save:** `restartRun` and `setDifficulty` drop a home sim into level 1's town, and home mode must reset to the bunker. `leaveTown` is still the only path out of `exitBoarded`.
- **client-run:** `run-session` passes `homeLoop` and `home`. `?home` is Task 10. `hud-state.ts` has a local `Loadout` type, so alias the import.
- **client-run and screens:** `UiState.homeLoop` is set by client-run and read by screens.

## Execution

Run through a Workflow, per the user's instruction to use chemx lanes. Wave 1: Tasks 1 to 4 in parallel. Wave 2: Task 5, then the orchestrator reviews it. Wave 3: Tasks 6, 7, 11, 12 at once, Tasks 8 and 9 alongside with their end-to-end specs last, Task 10 once 7 and 8 land. Each lane gets one independent review at its own tier. Task 13 runs after the user approves the flip.
