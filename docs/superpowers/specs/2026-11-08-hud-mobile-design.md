# HUD and mobile controls redesign

Date: 2026-11-08. Status: awaiting review.

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

## Open questions

- Is the dead touch-bar code safe to remove? (Ask before deleting.)
- Should Sprint also toggle for players who cannot hold it? (Not in this design.)
