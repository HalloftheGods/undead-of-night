# Item moves: one pipeline for every bag, container, ground and teammate move

Date: 2026-11-15 · chemx task #7657 (polish that led here), folds in #7630

## Why

Items reach the bag four different ways, each with its own animation rule, and container moves only reach the host
when the window closes, where the host re-checks everything its own way. Result: some items fly in and some don't,
and items can vanish (the host refused a find the player had made room for; fixed in place as `arrangeHeldByLayout`,
but the shape of the system invites more). In co-op the host replaces a container's contents with the last closer's
copy, so two survivors in one car clobber each other. The player wants one reliable system where what you see is
what the host has, and every move looks the same.

## Goals

- Every item move is one record (a **move**) that drives both the animation and the host.
- Each move reaches the host as it happens; the host answers ok/no by move id. Closing the window sends nothing.
- Both loot windows (canvas on desktop, page `DualLootModal` on touch) draw from the same moves.
- Co-op: two survivors can have one container open; an item taken by one vanishes from the other's window with a puff.
- Aimed drops: drag an item out of the window onto the world; it arcs from the survivor to the cursor, clamped to a
  toss range, stopped by walls.
- Teammate care: hover a teammate in reach with an item in hand, click, and a short hands-on action applies it to
  their needs, with speech bubbles everyone sees.
- Moodles float over teammates who have an ailment.

## Non-goals

- No change to loot rolls, search timing, container grid shapes, or what items do when used.
- No new item types. No trading between bags (giving to a teammate applies the item; it does not move it into their bag).
- Gamepad gets the same moves through the existing pad focus, but no new pad gestures in this update.

## Anti-goals (a failure even if it works)

- An item shown in the bag that the host does not have, for longer than one round trip.
- A move that can be lost by closing the window, dying, or a dropped snapshot.
- A sticky-feeling grid online (no waiting for the host before an item moves on screen).
- Trusting the client: the host re-checks reach, room, ownership and range on every move.

## Constraints

- Host-authoritative sim (`shared/`), solo runs the host locally (`local-session.ts`), online uses `remote-session.ts`
  / `host-session.ts`. Client → host messages are the `ClientMessage` union in `shared/protocol.ts`; host → client
  feedback rides snapshot `events`.
- `PlayerEntity` already carries every survivor's `needs`; `consumeSurvivalItem(needs, health, type)` and
  `bandageWound(needs)` work on any player.
- Moodle art exists (`src/art/fx/moodles.ts`); emotes are icon-only (`src/engine/emote-overlay.ts`), no text bubbles yet.
- Project rules: chemx for everything, small files (≤500 lines), composables return plain objects, no mock data.

## Approaches considered

1. **Predict and confirm (picked).** Client keeps the host's last-known bag and open container, plus a short list of
   its own unanswered moves; what's drawn is host state with those moves replayed on top. A `move` message per move;
   the host applies it in one `applyItemMove` and emits `move_ok` / `move_no` with the id. Instant feel online, exact
   fly-backs, fixes the co-op clobber. Most new code.
2. **Host owns the window.** Client sends the move and animates only on the answer. Simplest; a 50–150 ms pause online.
   Fallback if prediction proves too costly.
3. **Whole-bag commit after every move.** Least host change, but a "no" can't name the move and the container is still
   replaced wholesale. Ruled out: fixes timing, not reliability.

The player picked 1.

## The design

### The move record (`shared/item-move.ts`)

```ts
type MoveFrom =
  | { kind: 'cell'; grid: 'pack' | 'pockets' | 'candy' | 'container'; x: number; y: number }
  | { kind: 'gear'; slot: GearSlotId };
type MoveTo =
  | { kind: 'cell'; grid: 'pack' | 'pockets' | 'candy' | 'container'; x: number; y: number; rotated: boolean }
  | { kind: 'gear'; slot: GearSlotId }
  | { kind: 'ground'; x: number; y: number }          // aimed drop, world pixels
  | { kind: 'use' }                                     // use on self
  | { kind: 'player'; id: EntityId };                   // use on a teammate (starts the hands-on action)
interface ItemMove { id: number; item: string; type: string; from: MoveFrom; to: MoveTo; container?: number }
```

Move ids are a per-client counter. World pickups are not client moves: the host emits an `item_in` event for them
(item id, type, world point, cell it was packed into), which the arrival animation reads the same way.

### Host (`shared/item-move-sim.ts`)

- `applyItemMove(sim, p, move)` validates and applies one move, returns ok or a reason
  (`no_room`, `gone`, `too_far`, `not_needed`, `bad`). Container items are moved one at a time by id; the container is
  never replaced wholesale. Replaces `applyBagCommit` entirely: gear, candy, pockets and container all move by `move`,
  and `BagCommit` (with `LocalBag.heal`) is deleted by the end of stage 1. One source of truth.
- Emits `move_ok {moveId}` or `move_no {moveId, reason}` to the mover.
- Ground: clamps the target to `TOSS_RANGE` (≈130 px, two-thirds of `FOUNTAIN_RANGE`) along the line from the player,
  stops at the last walkable point before a wall, spawns the pickup there with `leftBy`, and emits `item_tossed
  {from, to, type}` to everyone for the arc.
- Player: starts a **care action** (below) instead of applying at once.
- Snapshots carry the contents of every container that some player has open (`openContainers: {id, items}[]`), so
  every open window stays live.

### Client (`src/game/inventory/move-ledger.ts` + `use-move-ledger.ts`)

- Holds `confirmed` (host bag + open container from the latest snapshot) and `pending: ItemMove[]`.
- `propose(move)`: applies it locally, records the arrival animation, sends it. The working grids both windows draw
  are `confirmed` with `pending` replayed on top, rebuilt on every snapshot and every answer.
- `move_ok`: drop it from `pending`. `move_no`: drop it, replay, and record a fly-back from where it was shown to its
  source plus a shake on the target cell. A pending move unanswered after 2 s is dropped the same way.
- Container items that disappear from `confirmed` without a move of ours get a **puff** (taken by a teammate).
- Replaces `LocalBag.open/close/absorb/heal`, `noteArrivals`' pickup-spot guessing, and the commit-on-close in
  `inventory-modal.ts`. `LocalBag.sync` stays as the shut-bag mirror until the builder folds it in.

### One animation source (`src/game/inventory/move-motion.ts`)

Replaces `pickup-arrivals.ts`'s `noteArrivals/noteMove/notePlaced`. Every move becomes a motion
`{ itemId, from: world point | cell rect | hand, to: cell rect | world point | player, kind: 'fly' | 'land' | 'back' | 'puff' | 'toss' }`.
A drag set down by hand is `land` (pop only); everything else flies. The canvas window (`engine/loot-ui.ts`) and the
page window (`components/use-item-arrivals.ts`, reduced to a renderer) both read it; neither computes its own.

### Aimed drops

Dragging the held item outside every dock and releasing over the world proposes a `ground` move at the cursor's world
point. The window shows a dotted arc to the clamped landing spot while dragging outside. The world renderer draws the
`item_tossed` arc (rise, one bounce, settle) for every player.

### Teammate care

- With an item in hand that `consumeSurvivalItem`/`bandageWound` would help with, hovering a teammate within
  `CARE_REACH` (≈40 px) rings them amber with a hint ("Bandage Dana", "Feed Dana", "Water Dana"); out of reach the ring
  is grey with "too far"; an item that would not help shows nothing.
- Click proposes a `player` move. The host starts a care action: 1.5 s for food/water, 2.5 s for bandage/medkit. It
  breaks if either survivor moves, takes damage, or the item stops being needed; the item flies back, nothing spent.
- Everyone sees the item floating between them, an outline on the receiver, a progress ring, and speech bubbles:
  the giver's line at start, the receiver's reply, a thanks on completion.
- Lines are original, small pools per item kind, picked by the host's rng so all clients agree:
  giver "Here, you need this more than me." / "Hold still, this'll sting." / "Eat. That's an order.";
  receiver "Yes, please!" / "Ow— thanks." / "You're a lifesaver." / "Finally."
  (Not the famous "It's dangerous to go alone" line: it belongs to another game.)
- Events: `care_start {giver, receiver, type, line}`, `care_reply {receiver, line}`, `care_break {giver}`,
  `care_done {giver, receiver, type, line}`.

### Speech bubbles (`src/engine/speech-overlay.ts`)

A small text bubble over a survivor's head for ~2 s, using the emote overlay's placement (above head, pinned to the
screen edge with an arrow when off screen) and the bitmap font. Driven by the care events only in this update.

### Moodles over teammates (`src/engine/teammate-moodles.ts`)

For each other survivor, the worst active ailment's moodle icon floats above their head during play (order: bleeding,
infection, thirst, hunger, fatigue; thresholds the same as the local HUD's). Not drawn for the local player.

## Stages (each lands green on its own)

1. **Move core.** `item-move.ts`, `applyItemMove` with cell/gear/use targets, `move` message, `move_ok/no` events,
   `openContainers` in snapshots, the ledger, `move-motion.ts`, both windows switched over, commit-on-close removed.
   Folds in #7630 (the deposit specs move to the new host API).
2. **Aimed drops.** `ground` target, toss clamp and wall stop, `item_tossed` arc, drag-out preview.
3. **Teammate care + bubbles.** `player` target, care action and events, speech overlay, hover ring and hint.
4. **Teammate moodles.**

Tests, lint and `chemx verify` run once at the end of stage 4, per the player's instruction; each stage still adds
its specs as it goes.

## Settled during review (my calls)

- **Ordering.** Move ids are a per-client sequence. The host applies a client's moves in id order and ignores an id
  at or below the last it applied. On a `move_no` the client rebuilds `confirmed` + the remaining `pending`; any
  pending move that no longer applies locally is dropped and flown back on the spot (the host would refuse it too).
- **Snapshot reconciliation.** Each snapshot carries, per player, `lastMoveId`, the last move the host applied. The
  ledger drops every pending move at or below it before replaying, so a snapshot that already includes a move never
  double-applies it. `move_ok` / `move_no` events then only drive the animation and the fly-back.
- **Open containers.** Explicit `container_open {id}` / `container_close {id}` client messages. The host keeps the set of
  viewers per container and drops a viewer who walks out of reach (`SEARCH_WALK_AWAY`), dies or disconnects. A
  container stays in `openContainers` while it has a viewer, even when empty. Two moves on one item in one tick: the
  first by host order wins, the other gets `gone`.
- **The item during care.** On `care_start` the host takes the item out of the giver's grid into their hand: it can't be
  moved, used or dropped while the action runs. On a break it goes back to its cell (or the nearest free cell, or the
  ground at the giver's feet if the bag has no room). If the giver dies mid-action it drops at their feet like any
  carried item.
- **Solo.** Solo runs the same ledger and messages against the local host; answers arrive on the next tick. No bypass,
  so one set of tests covers both.

## Left to the builder

- Exact file splits inside the ≤500-line rule, and whether `BagCommit` is deleted or kept as a thin wrapper.
- Pending-move timeout value (2 s proposed) and the ledger's replay details.
- Bubble styling within the existing UI palette (amber accent, bitmap font).
- Toss arc easing and bounce height.

## Calls made without the player (check these)

- Toss range ≈130 px; care reach ≈40 px; care durations 1.5 s / 2.5 s.
- Giving applies to the teammate's needs; it never moves the item into their bag.
- A pending move with no answer after 2 s is treated as a "no".
- Moodle order: bleeding, infection, thirst, hunger, fatigue.
- Everything under "Settled during review".
