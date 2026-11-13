# Pad headshots: lock on and close the ring

Status: draft for approval. Replaces the free right-stick crosshair added earlier today (`aimPad` and `PAD_REACH` in `src/game/run-frame.ts`).

## Intent and why

On a controller the right-stick crosshair swings freely and is hard to put on a head about 4-5 px wide. The player wants the feel of the mobile crosshair: pick a zombie, then do something skilful to get the head. It should be a skill that improves with practice, and it should let a player land several headshots in a row and be paid for the streak.

## Goals

- Right stick picks a target; it never has to be steered to a pixel.
- A timing cue on the target (a ring that closes on the head) decides body shot or headshot. Firing as the ring closes is a headshot; firing early is a body shot.
- Back-to-back headshots feel like a rhythm and score a streak multiplier.
- Mouse and touch aiming are unchanged. Left stick still walks.

## Non-goals / anti-goals

- No server or protocol change in v1. The client already sends `aimX/aimY` and the sim decides a headshot by whether that point is on the head circle (`headUnderAim`). Failure if: a pad player can headshot without the timing, or cannot headshot at all.
- Not an aimbot: the ring must be missable, and the cue must not make every shot a headshot.
- No new art beyond a ring and a lock mark.

## Approaches considered

1. **Closing ring (chosen).** Lock a zombie, a ring shrinks onto its head; the last moment of the shrink is a guaranteed headshot.
2. Beat window: crosshair sits on the head, a recurring pulse opens the head zone. Less readable than a shrinking ring.
3. Lock plus a fine stick nudge to the head with magnetism: closest to today, hardest, and keeps the problem the player described.

## Design

**Lock.** The right stick, pushed past 0.5, locks a living, visible zombie. First push with no lock takes the nearest zombie to the survivor in that direction. Later pushes move to the nearest zombie in that screen direction from the current one (up, down, left, right), as menu focus does. A lock drops when its zombie dies, leaves view, or is out of weapon range; it then moves to the nearest zombie to the old one so a chain keeps going. Bosses are lockable but take no headshots (existing rule), so they show the lock mark and no ring. The stick at rest keeps the lock.

**Ring.** Each lock starts a cycle on the locked zombie's head spot (`headSpot`, which follows the zombie's lean). The ring starts at 28 px radius and shrinks to the head's radius over a period of 0.9 s, then restarts (a recurring pulse). The final 0.15 s of the shrink is the **perfect window**. The cycle also restarts after the player fires, so each shot needs a fresh sync.

**Aim point.** Outside the perfect window the aim point is the zombie's chest (a body shot). Inside it, the aim point is the head spot. This is what is sent as `aimX/aimY`, so the sim needs no change. The crosshair is drawn at the aim point, with the ring around the head; the ring and crosshair turn to the existing red "on head" art in the perfect window.

**Streak.** Each perfect-window kill shot continues the existing headshot streak (`chainHeadshot`, 3.5 s window). Two additions, both my calls: (a) the streak now multiplies the headshot bonus using `headshotChainMultiplier` (1, 1.5, 2, 2.5, 3x of the flat 1 x town) so a streak is paid; (b) each headshot in a streak shortens the ring period by 0.05 s down to 0.55 s, so a streak is faster and harder, and it resets with the streak.

**Fallbacks.** With no zombie in range the right stick falls back to today's behaviour: the flashlight faces the stick, no ring. Firing with a lock but no stick input still uses the lock.

## Constraints

- Client-only for aiming. The score change touches `shared/headshots.ts` and its tests (`tests/headshots.spec.ts`), and `HEADSHOT_CHAIN_STEP` is currently documented as "no longer paid"; reversing that is the one rule change.
- Co-op: heads are drawn a network trip late (`COOP_HEAD_MARGIN`); the perfect window must still land inside the head margin.
- Follow the project rules in `CLAUDE.md` / `AGENTS.md` (small files, no mock data, update `docs/gamepad.md`).

## Left to the builder

Exact tuning (28 px, 0.9 s, 0.15 s, 0.05 s step), the ring art, a haptic tick on the perfect window, and how the lock is drawn. A pure module for lock choice and ring phase, with tests, under `src/game/input/`; `run-frame.ts` and `overlay-renderer.ts` consume it.

## Calls made after the builder check (marked: my calls, change if wrong)

- **Which weapons get the ring.** Only single-pellet guns, the only ones that can headshot (`totalPellets === 1`). Shotguns and melee get the lock (it faces and aims at the chest) and no ring.
- **Hold-to-fire.** The phase is read at the moment each shot fires. A body shot does not restart the ring, so it keeps pulsing and automatic fire can catch the perfect window. Only a perfect-window shot restarts it.
- **Streak.** Any head hit continues the streak, as `chainHeadshot` does now. The client learns the count from the `headshot` event's `chain` and resets its own copy after 3.5 s with no headshot. The ring period shortens by 0.05 s per streak step down to 0.55 s.
- **Latency and motion.** The client sets the aim point from the head as drawn when it fires. The perfect window aims at the head's centre, so it has the whole radius plus margin to spare. Tune the 0.15 s window if playtests show co-op misses; no target id is sent, so no protocol change.
- **Facing.** The lock sets the facing angle toward the target and persists while the player walks. It replaces `padOffset`. Using the mouse or touch drops it.
- **What can be locked.** Anything on screen that is alive. "Nearest in a direction" scores like menu focus (distance along plus twice the sideways drift), from the screen position; range is the equipped weapon's range plus the head search margin. Bosses and anything without a head map show the lock mark and no ring.
- **Streak pay (decided by the user): everyone.** The headshot bonus is multiplied by `headshotChainMultiplier` for mouse, touch and pad alike (cap `HEADSHOT_MAX_MULTIPLIER`, 3x). `tests/headshots.spec.ts` and any daily/ghost score expectations move with it; the daily's scoring change needs a note in the changelog.

- **Walls (user, later):** a zombie in a different building, or indoors against outdoors, cannot be locked.
- **No auto-lock (user, later):** the lock is only ever made by a stick push in a direction, from the survivor or the current target. A kill or leaving reach drops it; it does not jump to another zombie.
