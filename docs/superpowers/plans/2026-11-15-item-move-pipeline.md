# Item Move Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every item move (cell, gear, use, ground, teammate) is one record that reaches the host as it happens and drives one animation source in both loot windows.

**Architecture:** A shared `ItemMove` type and one grid-level apply function used by both sides. The host validates and applies each move (`applyItemMove`), answers with `move_ok`/`move_no` events, and broadcasts each survivor's bag layout, `lastMoveId` and the contents of viewed containers. The client keeps a `MoveLedger` (host state + its unanswered moves replayed on top) and a single `move-motion` store both windows draw from.

**Tech Stack:** TypeScript, Vue 3, canvas 2D, vitest, chemx.

**Spec:** `docs/superpowers/specs/2026-11-15-item-move-pipeline-design.md` (read it with this plan).

## Global Constraints

- Run every command through chemx (`chemx test`, `chemx typecheck`, `chemx lint`, `chemx verify`, `chemx read --outline`, `chemx q`). Pass `--as=@<you>` on every `chemx team` command; lock each file before editing.
- **Per the player: no test, lint, typecheck or verify runs until Task 12.** Each task still writes its specs. Commit at the end of each stage, staging only the files you touched (the tree holds another session's uncommitted edits: never stage `shared/containers.ts`, `shared/grid-inventory.ts`, `shared/container-look-grids.ts`, `src/App.vue`, `src/game/title-menu.ts`, `tools/*`, `public/*` unless your task names them).
- Files ≤500 lines; composables return plain objects; Vue same-name shorthand; no nested ternaries; no mock data.
- Values: `TOSS_RANGE = 130` (px), `CARE_REACH = 40` (px), care 1500 ms food/water and 2500 ms bandage/medkit, pending move timeout 2000 ms, moodle order bleeding > infection > thirst > hunger > fatigue.
- Care lines (exact copy). Giver: "Here, you need this more than me." / "Hold still, this'll sting." / "Eat. That's an order." Receiver reply: "Yes, please!" / "Ow— thanks." Receiver thanks on done: "You're a lifesaver." / "Finally."
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- Two survivors take the same container item in one tick: the second gets `move_no` `gone`, their window flies it back, and the first sees no puff. Test in Task 2.
- A snapshot that already includes a move arrives before its `move_ok`: the item does not flicker or double-place. Test in Task 4.
- The window closes (or the survivor dies) with moves still pending: nothing is lost; answers still settle the ledger. Test in Task 4.
- A ground drop aimed through a wall lands on the near side of it, never inside a building. Test in Task 7.
- The giver drops, uses or moves the item being given mid-care: impossible (it is in hand); breaking returns it to a cell, or the ground if the bag is full. Test in Task 9.

---

## Stage 1 — Move core

### Task 0: Land the search polish and lost-item fix already in the tree

**Files:** commit only `src/engine/loot-ui.ts`, `src/engine/loot-bare-cells.ts`, `src/engine/loot-container-art.ts`, `src/engine/world-renderer.ts`, `shared/bag.ts`, `shared/bag-sim.ts`, `tests/loot-bare-cells.spec.ts`, `tests/bag-commit-room.spec.ts`, the spec and this plan.

- [ ] **Step 1:** `git add` exactly those files and commit `feat(loot): bare container board, per-cell open reveal, finds land in the room the player made (#7657)`.

### Task 1: The move record and the shared grid apply

**Files:**
- Create: `shared/item-move.ts`, `shared/item-move-grids.ts`
- Test: `tests/item-move.spec.ts`

**Interfaces:**
- Produces (`shared/item-move.ts`): the `MoveFrom`, `MoveTo`, `ItemMove` types exactly as in the spec; `type MoveReason = 'no_room' | 'gone' | 'too_far' | 'not_needed' | 'bad'`; `parseItemMove(value: unknown): ItemMove | null` (rejects non-integer ids/coords, unknown grids/slots, ids ≤ 0); `TOSS_RANGE = 130`; `CARE_REACH = 40`.
- Produces (`shared/item-move-grids.ts`): `interface MoveGrids { pack; pockets; candy; container: InventoryGrid | null; gear: Record<GearSlotId, GridItem | null> }` and `applyMoveToGrids(grids: MoveGrids, move: ItemMove): MoveReason | null` — handles `cell`/`gear` sources and `cell`/`gear` targets only (null = applied); takes the item by id from its source, checks the footprint with `canPlaceItem` / `isItemValidForGearSlot`, returns `'gone'` if the id is not at the source and `'no_room'` if it does not fit. `use`/`ground`/`player` targets just remove the item and return null (the host decides their effect).

- [ ] **Step 1: Write tests** — `parseItemMove` accepts each target kind and rejects `{ id: 0 }`, `{ to: { kind: 'cell', grid: 'roof' } }`, fractional coords; `applyMoveToGrids` moves a medkit from `container` (0,0) to `pack` (1,1) and returns null; returns `'gone'` for a missing id; returns `'no_room'` onto an occupied cell and leaves both grids unchanged.
- [ ] **Step 2: Implement** both files.

### Task 2: Host applies moves; container viewers

**Files:**
- Create: `shared/item-move-sim.ts`, `shared/container-viewers.ts`
- Modify: `shared/sim-state.ts` (PlayerState `lastMoveId: number`, SimState `containerViewers: Map<number, Set<EntityId>>`), `shared/protocol.ts` (GameEvent: `{ type: 'move_ok'; playerId; moveId }`, `{ type: 'move_no'; playerId; moveId; reason: MoveReason }`, `{ type: 'item_in'; playerId; itemId; itemType; x; y; grid; cellX; cellY }`)
- Modify: `shared/pickups.ts` / wherever a world pickup is packed, to emit `item_in` with the packed cell
- Test: `tests/item-move-sim.spec.ts`; rewrite the deposit specs in `tests/container-search-loot.spec.ts` against `applyItemMove` (closes #7630)

**Interfaces:**
- Consumes: Task 1.
- Produces: `applyItemMove(sim: SimState, p: PlayerState, move: ItemMove): MoveReason | null` — ignores `move.id <= p.lastMoveId` (returns `'bad'`, no event); builds `MoveGrids` from `p.inventory`, the candy bag (from `p.candy`) and `sim.containers[move.container].items` (only if `p` is a viewer); applies; on success updates counters with the existing `takeFromContainer` / `take` / `useSupply` / `eatCandyDirect` helpers, sets `p.lastMoveId = move.id`, emits `move_ok`; on failure emits `move_no` and changes nothing. Ground/player targets return `'bad'` until Tasks 7/9.
- Produces (`shared/container-viewers.ts`): `viewContainer(sim, p, id): boolean` (needs the container in reach and searched), `leaveContainer(sim, p, id)`, `dropStaleViewers(sim)` (called once per tick from the sim step: out of `SEARCH_WALK_AWAY`, dead, or gone), `viewedContainers(sim): { id: number; items: GridItem[] }[]`.

- [ ] **Step 1: Write tests** — take a medkit into the pack (`p.medkits` 1, container empty, `move_ok`); the same move id again is ignored; two players viewing one container both take item X in order: first ok, second `move_no` `gone`; a non-viewer's container move is `'bad'`; deposit a knife (`p.knife` false, container holds it); deposit candy (removed from `p.candy`); a player walking past `SEARCH_WALK_AWAY` stops being a viewer.
- [ ] **Step 2: Implement.** `applyItemMove` stays under 200 lines: grid work in `applyMoveToGrids`, counter effects in a small `moveEffects(p, item, from, to)` helper in the same file.

### Task 3: Wire messages and snapshots

**Files:**
- Modify: `shared/protocol.ts` (ClientMessage: `{ type: 'move'; move: ItemMove }`, `{ type: 'container_view'; id: number; open: boolean }`; PlayerEntity: `bag?: BagLayoutRow[]`, `lastMoveId?: number`; SnapshotPacket: `viewedContainers?: { id: number; items: GridItem[] }[]`), `shared/room/client-packets.ts`, `shared/room/game-room.ts`, `shared/simulation.ts` (`moveCommand(id, move)`, `viewCommand(id, containerId, open)`), `shared/snapshot-build.ts`, `src/network/transport.ts`, `local-session.ts`, `remote-session.ts`, `host-session.ts` (`sendMove(move)`, `sendView(id, open)`), `src/game/game-controller.ts`, `src/game/hud-state.ts` (carry `bag` rows and `lastMoveId` into HudState)
- Test: `tests/item-move-wire.spec.ts`

**Interfaces:** Produces `GameController.sendMove(move: ItemMove)`, `GameController.sendView(id: number, open: boolean)`; HudState `bag?: BagLayoutRow[]`, `lastMoveId?: number`; snapshot `viewedContainers`.

- [ ] **Step 1: Write tests** — `parseClientPacket` round-trips a `move` and a `container_view` and rejects a malformed move; `buildSnapshot` includes the mover's `bag` rows and `lastMoveId`, and `viewedContainers` only for containers with a viewer.
- [ ] **Step 2: Implement** the wiring, following the existing `bag` / `bench` message paths line for line.

### Task 4: Client move ledger

**Files:**
- Create: `src/game/inventory/move-ledger.ts`
- Test: `tests/move-ledger.spec.ts`

**Interfaces:**
- Consumes: Tasks 1, 3.
- Produces: `class MoveLedger { constructor(send: (m: ItemMove) => void, now?: () => number); confirm(view: { bag: BagLayoutRow[]; lastMoveId: number; container: { id: number; items: GridItem[] } | null; candy: CandyId[]; gear: WornGear }): LedgerChange; propose(move: Omit<ItemMove, 'id'>): ItemMove | null; answer(moveId: number, ok: boolean): LedgerChange; expire(): LedgerChange; grids(): MoveGrids; }` where `LedgerChange = { rejected: ItemMove[]; vanished: GridItem[] }`. `propose` applies locally with `applyMoveToGrids`, returns null (and sends nothing) if it does not apply. `confirm` drops pending ids ≤ `lastMoveId`, rebuilds grids from the host view, replays the rest; a replayed move that no longer applies goes to `rejected`. Container items gone from the host view and not moved by a pending move go to `vanished`. `expire` rejects pending moves older than 2000 ms.

- [ ] **Step 1: Write tests** — propose then confirm with `lastMoveId` = that id: no flicker (grid identical before and after), pending empty; confirm with an older `lastMoveId`: move still shown; `answer(id, false)`: item back at source, listed in `rejected`; two pending moves where the second depends on the first, first rejected: both in `rejected`; host view drops a container item nobody here moved: in `vanished`; `expire` after 2001 ms rejects.
- [ ] **Step 2: Implement.**

### Task 5: One motion source

**Files:**
- Create: `src/game/inventory/move-motion.ts` (moves the camera, `hop` and `nowMs` helpers out of `pickup-arrivals.ts`; deletes `pickup-arrivals.ts` and updates its importers)
- Test: rename `tests/pickup-arrivals.spec.ts` → `tests/move-motion.spec.ts` and rewrite

**Interfaces:**
- Produces: `type MotionKind = 'fly' | 'land' | 'back' | 'puff' | 'toss'`; `type MotionEnd = { world: WorldPoint } | { cell: CellOrigin } | { hand: true } | { player: EntityId }`; `noteMotion(m: { itemId: string; itemType: string; kind: MotionKind; from: MotionEnd | null; to: MotionEnd | null }, at?): void`; `motionOf(itemId: string, at?): { kind: MotionKind; phase: 'fly' | 'pop' | 'puff'; t: number; motion: Motion } | null`; `motionTick` ref; keeps `FLY_MS = 420`, `POP_MS = 520`, adds `PUFF_MS = 300`, `SHAKE_MS = 240`; `shakeOf(cellKey: string, at?): number | null`; `clearMotions()`; plus the moved `setArrivalCamera` / `arrivalCamera` / `ArrivalCamera` / `CellOrigin` / `ScreenRect` / `WorldPoint`.
- `land` has no fly phase; `puff` is a single `PUFF_MS` phase; `back` flies to its source then pops.

- [ ] **Step 1: Write tests** — `fly` reports fly then pop then null; `land` pops only; `puff` reports puff for 300 ms; reduced-motion camera turns `fly`/`back`/`toss` into `land`.
- [ ] **Step 2: Implement.**

### Task 6: Switch both windows to the ledger

**Files:**
- Modify: `src/game/inventory/inventory-modal.ts` (owns a `MoveLedger`; feeds `confirm` from the hud watch and `viewedContainers`; feeds `answer` from `move_ok`/`move_no` events in `src/game/snapshot-handler.ts`; calls `sendView` on open/close; `onTransfer`/`onUse`/`onDrop` become `onMove(move)`; turns `LedgerChange` into `back` motions, cell shakes and `puff` motions), `src/game/inventory/canvas-loot.ts` and `src/components/DualLootModal.vue` (emit `move` with exact from/to at every place they call `transfer`, `use`, `drop`; a hand-set drop emits with `land`, double-click with `fly`), `src/game/inventory/use-canvas-loot.ts`, `src/engine/loot-ui.ts` and `src/components/use-item-arrivals.ts` (read `motionOf`/`shakeOf` only; draw `puff` as a 3-frame dust burst at the cell), `src/game/snapshot-handler.ts` (`item_in` → `fly` motion from the world point, replacing `notePickup`)
- Delete: `LocalBag.open/close/absorb/heal` and the `bag` message path (`BagCommit`, `applyBagCommit`, `arrangeHeldByLayout`, `parseBagCommit`, `sendBag`, `bagCommand`) once nothing calls them; keep `LocalBag.sync` only if the shut HUD still needs it, else delete the file
- Test: update `tests/local-bag.spec.ts`, `tests/bag-commit-room.spec.ts`, `tests/bag-drops.spec.ts`, `tests/candy-bowls.spec.ts`, `tests/ammo-boxes.spec.ts`, `tests/radio.spec.ts` to drive `applyItemMove` instead of commits (same assertions)

**Interfaces:** Consumes Tasks 1–5. Produces `InventoryModal.onMove(move: Omit<ItemMove, 'id'>, motion: MotionKind): void`.

- [ ] **Step 1: Implement**, file by file, keeping each under 500 lines (`inventory-modal.ts` splits the ledger glue into `use-move-ledger.ts` if it grows past it).
- [ ] **Step 2: Commit stage 1** — `feat(inventory): every item move goes to the host as it happens (#<stage-1 task>)`.

## Stage 2 — Aimed drops

### Task 7: Ground target on the host

**Files:** Modify `shared/item-move-sim.ts`; create `shared/toss.ts`; protocol GameEvent `{ type: 'item_tossed'; playerId; itemType; fromX; fromY; toX; toY }`. Test `tests/toss.spec.ts`.

**Interfaces:** `tossLanding(map: WorldMap, from: WorldPoint, aim: WorldPoint): WorldPoint` — clamps to `TOSS_RANGE` along the line, then walks the line in 4 px steps and returns the last walkable point before a wall or building edge. `applyItemMove` for `ground`: removes the item, spawns the pickup at `tossLanding` with `leftBy`, emits `item_tossed` and `move_ok`.

- [ ] **Step 1: Write tests** — aim 300 px away lands at 130 px; aim through a wall lands on the near side; aim at your own feet lands there; the spawned pickup has `leftBy` = the dropper.
- [ ] **Step 2: Implement.**

### Task 8: Drag-out drop and the arc

**Files:** Modify `src/game/inventory/canvas-loot.ts`, `src/components/DualLootModal.vue` (release outside every dock → `ground` move at the pointer's world point), `src/engine/loot-ui.ts` (dotted arc preview to the clamped spot while dragging outside; reuse `tossLanding` client-side), `src/engine/world-renderer.ts` + new `src/engine/toss-arc.ts` (draws `item_tossed` for everyone: rise, one bounce, settle, 500 ms). Test `tests/toss-arc.spec.ts` (arc height 0 at both ends, bounce after 70%).

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Commit stage 2.**

## Stage 3 — Teammate care

### Task 9: Care action on the host

**Files:** Create `shared/care.ts`; modify `shared/item-move-sim.ts` (`player` target), `shared/sim-state.ts` (PlayerState `care: { receiver: EntityId; item: GridItem; leftMs: number; from: MoveFrom } | null`), sim tick (calls `tickCare(sim, dt)`), protocol events `care_start {giver, receiver, itemType, line}`, `care_reply {receiver, line}`, `care_break {giver}`, `care_done {giver, receiver, itemType, line}`; PlayerEntity `care?: { receiver; itemType; progress }`. Test `tests/care.spec.ts`.

**Interfaces:** `careHelps(receiver: PlayerState, type: string): boolean` (would `consumeSurvivalItem` or `bandageWound` change anything); `startCare(sim, giver, receiver, move): MoveReason | null` (reach ≤ `CARE_REACH`, helps, item into the giver's hand); `tickCare(sim, dtMs)` (breaks on either moving, either taking damage, or `careHelps` turning false; on done applies to the receiver's needs/health); lines picked with `sim.rng` from the Global Constraints pools; `care_reply` fires 600 ms after start.

- [ ] **Step 1: Write tests** — out of reach → `too_far`; fed receiver offered food → `not_needed`; a bandage on a bleeding receiver completes after 2500 ms and stops the bleeding; receiver moving at 1 s → `care_break`, item back in the giver's cell; giver's bag full on break → item on the ground at the giver's feet; giver dies mid-care → item on the ground.
- [ ] **Step 2: Implement.**

### Task 10: Hover ring, speech bubbles, care visuals

**Files:** Create `src/engine/speech-overlay.ts` (bitmap-font bubble, 2 s, placed like `emote-overlay.ts`, pinned to the edge off screen), `src/engine/care-overlay.ts` (item floating between giver and receiver, receiver outline, progress ring), `src/game/inventory/care-hover.ts` (`careHint(held, teammates, me): { id; label: string; inReach: boolean } | null`; label "Bandage <name>" / "Feed <name>" / "Water <name>" / "Heal <name>"). Modify `src/engine/world-renderer.ts`, `src/engine/fx-director.ts` (care events → bubbles), `canvas-loot.ts` / `DualLootModal.vue` (click on a ringed teammate → `player` move). Test `tests/care-hover.spec.ts`.

- [ ] **Step 1: Write tests** for `careHint`: in reach and helpful → amber label; out of reach → `inReach: false`; unhelpful item → null.
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Commit stage 3.**

## Stage 4 — Teammate moodles

### Task 11: Moodles over teammates

**Files:** Create `src/engine/teammate-moodles.ts` (`worstMoodle(needs): MoodleId | null` using the HUD's thresholds and the order in Global Constraints; draws it above each non-local survivor's head, under the speech bubble). Modify `src/engine/world-renderer.ts`. Test `tests/teammate-moodles.spec.ts` (bleeding beats hunger; no ailment → null; local player never drawn).

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Commit stage 4.**

## Task 12: Gates, docs, close

- [ ] **Step 1:** `chemx test` (full suite in the background; if chemx times out, run it per folder), then `chemx typecheck`, `chemx lint src shared tests`. Fix what fails.
- [ ] **Step 2:** Update `docs/` (inventory/features doc and `docs/INDEX.md`) and `docs/CHANGELOG.md` for moves, drops, care and moodles.
- [ ] **Step 3:** `chemx verify`; commit; release locks; `chemx team task done` on each stage task and #7630, #7657.
