# Pad headshot lock Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. Steps use checkbox syntax.

**Goal:** Replace the free right-stick crosshair with a lock-on target and a closing ring that decides a headshot, and pay headshot streaks.

**Architecture:** A pure module `src/game/input/pad-lock.ts` picks the lock and computes the ring phase. `run-frame.ts` replaces `aimPad` with it and sends the aim point (chest, or head in the perfect window), so the sim is unchanged. `overlay-renderer.ts` draws the ring from a `padRing` on the scene. `shared/headshots.ts` multiplies the headshot bonus by the streak.

**Spec:** docs/superpowers/specs/2026-11-13-pad-headshot-lock-design.md

## Global Constraints
- Ring 28 px start radius, period 0.9 s, perfect window last 0.15 s, period -0.05 s per streak step to a floor of 0.55 s.
- Streak multiplier is `headshotChainMultiplier` (cap 3x) for everyone. Rings only for single-pellet guns (`WEAPONS[w].pellets === 1`).
- No protocol change. Mouse and touch aiming unchanged.

## Review Focus
- No zombies on screen: stick falls back to flashlight facing, no ring.
- Locked zombie dies mid-ring: lock moves to the nearest one, ring restarts.
- Boss locked: lock mark, no ring, never a headshot aim.
- Streak expires after 3.5 s: ring period returns to 0.9 s.

### Task 1: Lock and ring logic
**Files:** Create `src/game/input/pad-lock.ts`; Test `tests/pad-lock.spec.ts`
**Produces:** `pickLock(from: Pt, zombies, current: number|null, dir: NavDirection|null, reach: number): number|null`; `ringPeriod(streak: number): number`; `ringAt(elapsedSec: number, streak: number): { radius: number; perfect: boolean }`; `noteHeadshotStreak(chain: number, nowMs: number)` / `currentStreak(nowMs: number): number`.
- [ ] Tests: `ringPeriod(1)` is 0.9, `ringPeriod(4)` is 0.75, `ringPeriod(20)` is 0.55; `ringAt(0).radius` is 28 and not perfect; `ringAt(0.8).perfect` true; wraps at the period; `currentStreak` is 0 after 3.5 s; `pickLock` with no current takes the nearest to the survivor, with a direction takes the nearest that way, and returns null when empty or out of reach.
- [ ] Implement. Direction scoring: along + 2 x across, as `pickTarget` in `pad-focus.ts`.
- [ ] Commit.

### Task 2: Streak pays
**Files:** Modify `shared/headshots.ts` (`payHeadshot`); Test `tests/headshots.spec.ts`
- [ ] Test: third chained headshot kill pays `HEADSHOT_BONUS * town * 2`.
- [ ] Multiply points by `headshotChainMultiplier(chain)`. Update affected tests, the `HEADSHOT_CHAIN_STEP` comment.
- [ ] Commit.

### Task 3: Run integration, drawing, docs
**Files:** Modify `src/game/run-frame.ts`, `src/engine/scene.ts`, `src/engine/overlay-renderer.ts`, `src/game/snapshot-handler.ts` (feed `noteHeadshotStreak` from the local player's `headshot` events), `docs/gamepad.md`, `src/game/change-notes.ts`, `docs/CHANGELOG.md`
- [ ] Replace `aimPad`/`padOffset`/`PAD_REACH`: right stick edge past 0.5 calls `pickLock`; lock persists; chest aim point outside the perfect window, `headSpot` inside; ring restarts only after a perfect shot or a lock change; facing follows the lock.
- [ ] Scene gets `padRing: { x; y; radius; perfect; head: boolean } | null`; overlay draws the ring and a lock mark; the crosshair uses the existing on-head sprite when perfect.
- [ ] `chemx verify` passes; commit.
