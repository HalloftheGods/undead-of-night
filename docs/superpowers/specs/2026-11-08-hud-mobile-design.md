# HUD and mobile controls redesign

Date: 2026-11-08. Status: built, all three pieces.

Two things were deliberately not done as written, and both are recorded under Open questions below:
the Sprint button does not carry its own Sprint bar, and the ring has no focus trap.

## Intent

Make the HUD quick to read and natural to use, mainly on a phone. The pixel-art look stays. Controls should look like part of the game and be real tap targets, not floating grey circles.

Said by the player (project owner): health belongs top right, above kills; kills get a zombie head icon; points sit under kills. On mobile the weapon bar is centered and tappable, the event feed sits right-center, the backpack icon should look like a backpack, and the circular buttons must be clickable and look native to the game. Search and Shove stay as their own buttons (Search is not in the backpack), and a Sprint button is needed. The backpack opens a circular menu. On desktop it opens with a middle-click, then you scroll through it or click an item.

Assumptions (correct me): a new pixel-art zombie head, not the existing `skull`; Sprint is hold-to-sprint; desktop is click to open, then click an item (not hold-and-release).

## Findings from the code

- `HudOverlay.vue` has `pointer-events: none`; vitals (health, medkits, throwables) are bottom-left; the weapon bar is centered only above 720px and is pushed right under the feed below that.
- `TouchControls.vue` renders three `MobileFAB` circles (Search `KeyE`, Backpack, Shove `KeyF`) bottom-right, through `input.padDown`/`padUp`. `BackpackWheel.vue` is a ring of round buttons over a dimmed screen, opened by the Backpack FAB. Both use flat grey circles with soft shadows, unlike the pixel HUD.
- The old rectangular touch bar styles (`.touch-pad`, `.touch-items`, `touch-ui.css`) may be dead code now that `TouchControls` renders FABs. To verify before removal; deleting files needs approval.
- Sprint is held `ShiftLeft`/`ShiftRight` (`input-manager.ts`). The mouse wheel already cycles weapons in play; left fires, right shoves. Middle-click is unused.
- The BACKPACK glyph (`game/touch-pad.ts`) is an 11x11 box with two bumps and does not read as a backpack.

## Piece 1: HUD layout and mobile buttons (build first)

1. **Top-right stack**, top to bottom: health (heart, bar, number; low-health blink kept), kills (zombie head icon plus count), points (amber). The co-op "Linked / Signal weak" line stays as a small line under points. Health leaves the bottom-left vitals column.
2. **Zombie head sprite**: `art.ui.zombieHead`, built in `art/fx/icons.ts`, wired in `art/ui.ts` and `art/types.ts`, drawn like the heart.
3. **Weapon bar** centered at the bottom at every width. Each slot is a button of at least `--tap` (44px) that presses the slot's `Digit` key through `input.padDown`/`padUp`. Slots turn `pointer-events` back on; the rest of the HUD stays click-through. Desktop keeps key hints.
4. **Event feed** moves to the right-center, clear of the top-right stack and the bottom-right buttons.
5. **Mobile action cluster**, bottom right, in the pixel style: Search (`KeyE`), Shove (`KeyF`), Sprint (hold = `ShiftLeft`), Backpack. Sprint sits where the thumb rests and shows the Sprint bar (ring or fill) when low. All buttons are at least `--tap`, respect safe-area insets, and do not cover the weapon bar or stack.
6. **Backpack glyph** redrawn (top handle, front pocket with flap, side straps) and checked at 24px.

## Piece 2: backpack wheel restyle

Pixel-art ring matching the HUD chips (dark panels, amber highlight, pixel borders), opening centered on the player instead of a dimmed full-screen overlay. Items: Heal, Switch Weapon, Map, and carried throwables and candy, each with a count and a label. Items are at least `--tap`. Search and Shove are not in it.

## Piece 3: desktop wheel

Middle-click opens the same wheel. Click an item to use it. While open, the scroll wheel steps the highlight and does not cycle weapons; `Esc` or a click outside closes it. Fire and shove are suppressed while open.

## Testing

- Pure logic (stack order, Sprint-bar threshold, wheel item list, wheel scroll stepping) goes in `game/*.ts` modules with specs in `tests/`.
- Sprint button: a spec that press and release send `ShiftLeft` down and up (like `tests/touch-input.spec.ts`).
- Run `chemx verify` and look at the result at phone size, landscape and portrait, in WordPress-free dev (`pnpm dev`) with touch emulation.

## Out of scope

Top-left level/wave chip, boss bar, quest tracker, the title screens, new HUD features.

## How it was built

- **Piece 1.** The top of the HUD is a three-column grid: the town on the left, the trip's chips in the middle, and health / kills / points down the right (`HudOverlay.vue`). `art.ui.zombieHead` is a new 11x11 walker's head in the rot ramp. The gun bar is pinned to the middle of the foot of the screen rather than laid out, so a long vitals column can never shove it, and each slot is a `<button>` carrying `aria-pressed`, sized to `--tap` only under `.is-touch` so a mouse keeps the small chip and its key hints and a click there still fires the gun. What each slot stands for is `game/weapon-bar.ts`. The feed is pinned to the right edge, halfway down.
- **Piece 2.** `game/backpack-wheel.ts` says what the ring holds, from the HUD alone. Each slot carries the sprite the game already draws that thing with; `art.ui.candy` and `art.ui.townMap` are new, because candy was CSS boxes and the map had no art at all. `ready` is false where the sim would refuse the pick (a medkit at full health, `shared/player-health.ts`; a candy already working, `shared/candy.ts`). The ring follows the survivor through `--player-x` / `--player-y`, written onto `<html>` once a rendered frame by `game/run-frame.ts` from `game/player-anchor.ts`; the HUD's own state is rebuilt ten times a second, which cannot track a walking survivor. Slot art is sized off the chip, not off `--u`: `SpriteImg`'s own unit times a scale drew the 32-wide gun icon at nearly 200px inside a 44px chip.
- **Piece 3.** `backpackOpen` moved into `UiState`, so the phone's button and a desktop middle-click open the same ring from the same state (`GameController.toggleBackpack`, `closeBackpack`, `pickFromBackpack`). The gate is `standingInTown` in `game/hud-state.ts`, checked on every publish, so whatever closes the moment for the ring — pausing, the map, a station or the death summary, the workbench, going down, the run ending — closes the ring with it from wherever the news arrives. A middle press goes through `InputCallbacks.onBackpack`. While the ring is up it covers the screen and stops `mousedown`, so no shot can start, and `InputManager.letGoButtons()` drops a trigger already held without touching the movement keys. The scroll wheel is caught on the window in the capture phase and stopped there, so the game's own bubbling wheel listener never cycles guns; `stepSlot` walks the highlight at `WHEEL_COOLDOWN_MS`, the pace the wheel already cycles guns at, and `Enter` or `Space` uses what it walked to. `aimsCursor` hands the real pointer back, since the slots are clicked.
- **Esc belongs to `togglePause`, not `shutOverlay`.** `Esc` reaches the game as `onPause`, so the ring has to be taken off there or one press would close the ring *and* pause the run. It is handled in `togglePause` rather than in `shutOverlay` because `onAway` (a blurred window or a hidden tab) calls `flipPause` directly: a `shutOverlay` branch would mean tabbing away with the ring open stopped pausing a solo run, and it would keep taking hits unseen.
- **The ring's catcher is walk-through on touch.** The full-screen catcher carries `data-touch-walk` and the ring itself carries `data-touch-ui` (`game/touch-input.ts`). A finger on a chip is left alone so the browser turns it into a click; a finger on the catcher fires nothing, but the left thumb may still take the movement stick through it, because the ring does not hold the run.

## Answers to the open questions

- **Is the dead touch-bar code safe to remove?** Yes, and it is gone: `.touch-pad`, `.touch-button`, `.touch-glyph`, `.touch-items`, `.touch-item`, `.touch-item-count` and `.touch-candy` in `touch-ui.css` with the `--pad-size` and `--item-size` vars; `TOUCH_BUTTONS`, the `TouchButton` type and the `PAUSE`, `MAP`, `WEAPON`, `HEAL` and `RELOAD` glyphs in `game/touch-pad.ts`; and `game/touch-items.ts` with its spec. Nothing rendered any of it once `TouchControls` became a corner cluster. The padding those vars drove had already gone with piece 1: `.is-touch .hud` was reserving a 58px strip for the bar, and another 52px while anything throwable was carried, so the HUD was giving up screen for buttons that were not there. What was left to remove here was the unreachable code itself. `[data-touch-pad]` stays: it is live, and marks the cluster so a thumb that misses a button is not a shot.
- **Should Sprint also toggle for players who cannot hold it?** Not in this design, and still not. Worth revisiting as an accessibility option beside Reduced Motion rather than as a second behaviour on the button.
- **Does the Sprint button show the Sprint bar?** No. The bar is already drawn under the survivor's feet in the world (`engine/overlay-renderer.ts`), so a second one on the button would say the same thing twice, in the corner the eye is not on.
- **Does the ring trap keyboard focus?** No. Tab reaches its slots and `Esc` closes it, which is enough for an overlay that does not hold the run; a trap would fight the fact that the survivor keeps walking underneath.
