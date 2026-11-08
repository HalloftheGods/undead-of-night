# Gamepad mode

Status: first slice. In-game input, menu confirm/back/pause and focus-move events are wired up. Moving DOM focus between buttons, the "press any button" hint and on-screen button prompts are not built yet (see "What is left").

Target: the web build for itch.io and Reddit. Any controller the browser maps to the **Standard Gamepad** layout works: Xbox One/Series, Xbox 360, DualShock 4, DualSense, Switch Pro, and 8BitDo in X-input or D-input mode. That covers ordinary Bluetooth pads in current Chrome, Edge and Firefox (Safari is untested). Steam Input is not part of this.

## How the browser exposes a pad

- `navigator.getGamepads()` returns no pad until the player **presses a button on it** while the page is open. Because of this, the title screen needs a "Press any button on your controller" hint (not built yet). The press that reveals the pad also counts as an input, so pressing Start or A on the title does what those buttons normally do.
- Only pads with `mapping === 'standard'` are read. Any other connected pad goes into `input.gamepad.unsupportedId`, so the UI can say "Controller not recognised. Try Chrome or Edge, or switch the pad to X-input mode."
- The Gamepad API requires a secure context. itch.io serves over HTTPS, and `localhost` also counts as secure. The `gamepad` permissions policy defaults to `*`, so the itch.io iframe can read pads without an `allow="gamepad"` attribute (MDN: Permissions-Policy `gamepad`). If a policy blocks the API, `getGamepads()` throws. The poller catches that and reads no pads.
- **A pad press does not unlock audio.** Browsers do not treat gamepad input as a user activation (Mozilla bug 1679817). Sound still needs one click, tap or key press. The studio splash already asks for one. Keep that, and have the hint say so when a pad is the only input.
- `vibrationActuator` (rumble) is optional and only exists in Chrome and Edge. It is not used yet; see `TODO(rumble)` in `gamepad-input.ts`.

## In-game mapping (twin-stick)

The table uses standard-mapping indexes, which are positional: index 0 is the bottom face button on every pad.

| Action | Keyboard / mouse | Pad index | Xbox | PlayStation | Switch / 8BitDo | How it is read |
|---|---|---|---|---|---|---|
| Move | WASD / arrows | axes 0,1 | Left stick | Left stick | Left stick | Radial dead zone 0.2, snapped to 8 directions like the touch stick |
| Aim / flashlight | Mouse | axes 2,3 | Right stick | Right stick | Right stick | `atan2` of the stick. With the right stick at rest, the survivor faces the move direction and keeps the last angle when stopped |
| Fire | Left click (hold) | 7 | RT | R2 | ZR | Held. The press also latches, so a tap between ticks still fires. An analog trigger counts as down past 0.3 |
| Shove & Stab | F / right click | 6 | LT | L2 | ZL | Held (KeyF) |
| Search / use station | E (hold) | 0 | A | Cross | B | Held (KeyE) |
| Use medkit | H | 1 | B | Circle | A | Latched once per press |
| Reload | R | 2 | X | Square | Y | Latched |
| Eat candy | X | 3 | Y | Triangle | X | Latched |
| Sprint | Shift (hold) | 4 | LB | L1 | L | Held. Pressing it also ends a sneak toggle |
| Throw bottle | G | 5 | RB | R1 | R | Latched |
| Sneak | C (hold) | 10 | L3 (click left stick) | L3 | LS click | **Toggle** (holding a stick click is tiring) |
| Run log | L | 11 | R3 | R3 | RS click | Toggles the log panel |
| Molotov | T | 12 | D-pad Up | D-pad Up | D-pad Up | Latched |
| Flare | V | 13 | D-pad Down | D-pad Down | D-pad Down | Latched |
| Previous weapon | (wheel up) | 14 | D-pad Left | D-pad Left | D-pad Left | Cycle -1 |
| Next weapon | Q / wheel | 15 | D-pad Right | D-pad Right | D-pad Right | Cycle +1 |
| Weapons 1 / 2 / 3 | 1 2 3 | — | — | — | — | No direct slots. With three guns, every gun is one D-pad press away |
| Map | Tab / N | 8 | View | Create / Share | − | Toggles. Works behind menus, as Tab does |
| Pause | Esc | 9 | Menu | Options | + | Toggles. Works everywhere |
| Mute | M | — | — | — | — | Not bound. Use the Options volume controls |
| Confirm | Enter | 0 | A | Cross | B | Only when a menu is up (see below) |
| (Space) | Space | — | — | — | — | In `GAME_CODES`, but `sample()` never reads it, so nothing to bind |
| Home / PS / Guide | — | 16 | — | — | — | Never read. The OS or browser often claims it |
| Keepsake pick | J K L / tap | — | — | — | — | Left to menu focus: focus a card, press A |

The pad keeps none of its own state in the packet. Each button stands in for the key it maps to (`PLAY_BINDINGS` in `src/game/gamepad-input.ts`), so `InputManager.sample()` builds the same `ClientInputPacket` with the same latch rules. Two pseudo-keys only the pad sends: `PadFire` (RT) and `PadPrevWeapon` (D-pad Left). No protocol fields changed. While the pad steers, the packet leaves out `aimX/aimY`, which is what it already does when there is no crosshair.

## Device in charge

`InputManager.lastDevice` is `'keyboard' | 'touch' | 'gamepad'`, and `onDeviceChange` fires whenever it changes.

- **gamepad**: any button press, or either stick outside the dead zone. A resting pad never takes over, which keeps stick drift from stealing control.
- **keyboard**: any key down, mouse down, or a real mouse move (not the fake mouse events a tap generates).
- **touch**: any touch start or end.

The pad steers the flashlight only while it is the device in charge, and the mouse crosshair is hidden in that case. With two pads plugged in, whichever one was pressed or pushed most recently takes charge.

## Menu focus navigation spec

These rules apply whenever input is disabled (title, pause, map, bench, stations, game over):

| Pad | Does | Status |
|---|---|---|
| D-pad / left stick | Moves focus one step to the nearest focusable control in that direction | **Event wired** (`onNavigate(direction)`). The DOM mover is not built |
| A | Clicks the focused `<button>`. With nothing focused, falls back to the screen's own confirm (`onConfirm`: play again, back to menu, resume) | Done |
| B | Back: closes the open station, log or map, otherwise resumes from pause (`onPause`, the same path as Esc) | Done for in-run menus. Title sub-pages need an `onBack` hook (see below) |
| Start | Pause / resume | Done |
| View | Map toggle | Done |
| LB / RB | Previous / next tab (How to Play tabs, style cards) | Not built |

Rules for the focus mover (next slice):

1. When a screen opens and the pad is in charge, focus its primary button (Play, Resume, Play Again). Use the `autofocus`-style marker `data-pad-default`.
2. Pick the move target spatially: among visible, enabled `button, [role=button], input[type=range], [tabindex="0"]`, choose the nearest centre in the pushed direction, weighting lateral offset ×2. A screen can override this with `data-pad-group` to wrap within a list.
3. When a range slider has focus, D-pad Left/Right changes its value instead of moving focus.
4. The stick repeats after 400 ms held, then every 120 ms (`TODO(menu-nav)` in `navStick`). The D-pad repeats on the same schedule.
5. Focus must always be visible. Add a `:focus-visible` ring in the Silkscreen palette, and with `prefers-reduced-motion` (the `motion.ts` setting) make it a plain outline with no tween.
6. A button pressed on a menu does not count in play until it is released. This is already enforced, so the A that confirms Resume cannot start a search.

## Button-prompt glyph plan

- `padFamily(id)` in `src/game/pad-glyphs.ts` reads `Gamepad.id`. It returns `xbox` for `xbox|xinput|045e`, `playstation` for `054c|playstation|dualshock|dualsense`, and `nintendo` for `057e|nintendo|pro controller|joy-con|2dc8|8bitdo`. Anything else falls back to Xbox. Chrome ids look like `"DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)"`; Firefox ids look like `"054c-0ce6-..."`.
- `padLabel(family, index)` gives the word for each button. On Nintendo pads index 0 is labelled **B**: the standard mapping is positional, so the bottom button stays bottom and only the label changes.
- An itch.io thread reports that embedded games could detect a pad but not its type. Treat id sniffing as a best guess and add a manual choice in Options ("Button prompts: Auto / Xbox / PlayStation / Nintendo"), stored with the other display prefs.
- Prompts show when `lastDevice === 'gamepad'`. That covers the How to Play Controls tab, the HUD hints, station "Hold E" prompts and the touch-pad labels. Draw them as small pixel-art button sprites to match the art kit, with text labels as the fallback.

## What is left

1. DOM focus mover implementing the spec above, wired to `onNavigate`, plus a `data-pad-default` per screen.
2. An `onBack` callback for title sub-pages (`title-nav.ts` `closePage` / `closePlay`). B currently calls `onPause`, which does nothing on the title.
3. A "Press any button on your controller" hint on the title, plus a toast from `onGamepadConnection`. When a pad disconnects mid-run in solo, pause.
4. Button prompts: an Options override and sprites. The How to Play Controls tab needs gamepad lines.
5. A pad reticle (`TODO(pad-reticle)` in `run-frame.ts`): a virtual crosshair along the right stick, so headshots get an `aimX/aimY` spot and "throw at the crosshair" has a target. Until then, pad aim is angle-only.
6. Rumble and aim assist (`TODO(rumble)`, `TODO(aim-assist)`).
7. Hands-on checks with real pads: Xbox (Bluetooth), DualSense (Bluetooth), 8BitDo (both modes) in Chrome, Edge and Firefox, both locally and inside the itch.io iframe.
