# Gamepad mode

Status: second slice. In-game input, menu confirm/back/pause and **focus moving between buttons on every screen** are done (`src/game/pad-focus.ts`, no per-screen work). The title controller hint (`PadHint.vue`) and the prompt helpers (`fillPadPrompt`, `promptFor` in `pad-glyphs.ts`) exist; the hint needs one line in `TitleScreen.vue` to show (see "What is left"). Nothing here has been tried on a physical pad.

Target: the web build for itch.io and Reddit. Any controller the browser maps to the **Standard Gamepad** layout works: Xbox One/Series, Xbox 360, DualShock 4, DualSense, Switch Pro, and 8BitDo in X-input or D-input mode. That covers ordinary Bluetooth pads in current Chrome, Edge and Firefox (Safari is untested). Steam Input is not part of this.

## How the browser exposes a pad

- `navigator.getGamepads()` returns no pad until the player **presses a button on it** while the page is open. So the title shows a controller line only once a pad has been seen (`PadHint.vue`: "Controller ready. Press any button.", then the pad's own confirm, back and pause names). A pad pressed during the studio splash is seen by the time the title asks for a press. A keyboard player with no pad sees nothing extra. The press that reveals the pad also counts as an input, so pressing Start or A on the title does what those buttons normally do.
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

**At the wheel of a car** the move keys are read from the driver's seat, not the screen (`drive` in `shared/vehicle-physics.ts`): up is gas, down brakes and then backs up, left and right turn the wheel. The wheel only bites while the car rolls, and in reverse it swings the nose the other way, as a real car does. A car pointing down the screen therefore turns to the screen's left when the right key is held. The keyboard, the left stick and the touch stick all send the same four directions, so no packet field changed.

The pad keeps none of its own state in the packet. Each button stands in for the key it maps to (`PLAY_BINDINGS` in `src/game/gamepad-input.ts`), so `InputManager.sample()` builds the same `ClientInputPacket` with the same latch rules. Two pseudo-keys only the pad sends: `PadFire` (RT) and `PadPrevWeapon` (D-pad Left). No protocol fields changed. While the pad steers, the packet leaves out `aimX/aimY`, which is what it already does when there is no crosshair.

## Device in charge

`InputManager.lastDevice` is `'keyboard' | 'touch' | 'gamepad'`, and `onDeviceChange` fires whenever it changes.

- **gamepad**: any button press, or either stick outside the dead zone. A resting pad never takes over, which keeps stick drift from stealing control.
- **keyboard**: any key down, mouse down, or a real mouse move (not the fake mouse events a tap generates).
- **touch**: any touch start or end.

The pad steers the flashlight only while it is the device in charge, and the mouse crosshair is hidden in that case. With two pads plugged in, whichever one was pressed or pushed most recently takes charge.

## Menu focus navigation

These rules apply whenever input is disabled (title, pause, map, bench, stations, game over). `GamepadInput` does the work through `DOM_PAD_MENU` in `src/game/pad-focus.ts` unless the host says it moved focus itself (`navigate` returning `true`), so no callback has to be wired for it to work.

| Pad | Does | Status |
|---|---|---|
| D-pad / left stick | Moves focus to the nearest visible, enabled control in that direction. Nothing focused yet: focuses the screen's default control. On a range slider, Left/Right changes the value and Up/Down moves focus | Done (`navigateFocus`) |
| A | Clicks the focused button, link, `role=button`, checkbox or radio. With nothing focused, falls back to the screen's own confirm (`onConfirm`: play again, back to menu, resume) | Done (`activateFocus`) |
| B | Clicks the screen's Back or Close (a control marked `data-pad-back`, else one whose label is exactly Back, Close, Cancel or Done). With none showing, falls back to `onPause` (the Esc path: closes a station or the map, else resumes from pause) | Done (`pressBack`). Covers every title sub-page, since each has a Back button |
| Start | Pause / resume | Done |
| View | Map toggle | Done |
| LB / RB | Previous / next tab (How to Play tabs, style cards) | Not built: no screen marks its tabs yet |

How the focus mover works (as built):

1. **Default control.** With nothing focused (or focus on something hidden), the first push focuses, in order: `[data-pad-default]`, the title menu's `aria-current="true"` row, `.is-selected`, `.is-primary`, else the first control. It does not also move.
2. **Target choice** (`pickTarget`, pure geometry, tested without a page). Candidates are visible, enabled controls (tabindex -1 included: the shelves, tab strips and rosters keep every tile but the chosen one at -1) matching `button, a[href], summary, select, textarea, input, [role=button], [tabindex="0"]`. The score is distance ahead plus twice the sideways offset, lowest wins. A control on the same row is not "below". With nothing ahead it wraps to the far end of the line, inside the group when the current control sits in a `[data-pad-group]`.
3. **Layers.** A control counts only if it is the topmost thing at the centre of its visible part (`elementFromPoint`), so a pause menu or candy bag over a screen cannot let focus slip to the screen behind. A control entirely off screen is not a candidate; a half-visible one is, and focusing it scrolls it in.
4. **Sliders.** With a `input[type=range]` focused, Left/Right steps it by its `step` (a twentieth of the range for `step="any"`) and fires `input` and `change`, which `v-model` reads.
5. **Repeat.** A held direction (D-pad or stick past 0.5) moves once, repeats after 400 ms, then every 120 ms (`NAV_REPEAT_DELAY_MS`, `NAV_REPEAT_MS`). A change of direction moves at once. A direction already held when a menu opens waits for a release: it was walking the survivor, not choosing a button.
6. **Visible focus.** Focus is set with `focus({ focusVisible: true })`, so the existing `:focus-visible` styles on `.px-button` and `.px-link` draw. Safari ignores the option and may not draw the ring after a scripted focus: untested.
7. **Gates.** While an element marked `data-pad-gate` is on screen (the title's Press Any Key, via `PadHint.vue`), the D-pad does not move focus, so the press that wakes the title does not also pick a footer link.
8. A button pressed on a menu does not count in play until it is released, so the A that confirms Resume cannot start a search. The D-pad is treated the same way.

Optional markers a screen may add: `data-pad-default` (first focus), `data-pad-group="name"` (wrap within a list), `data-pad-back` (the control B clicks), `data-pad-gate` (a gate is up).

## Button-prompt glyph plan

- `padFamily(id)` in `src/game/pad-glyphs.ts` reads `Gamepad.id`. It returns `xbox` for `xbox|xinput|045e`, `playstation` for `054c|playstation|dualshock|dualsense`, and `nintendo` for `057e|nintendo|pro controller|joy-con|2dc8|8bitdo`. Anything else falls back to Xbox. Chrome ids look like `"DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)"`; Firefox ids look like `"054c-0ce6-..."`.
- `fillPadPrompt(template, padId)` writes a pad's own words into a prompt: `'{a}: confirm'` is "A: confirm" on Xbox, "Cross: confirm" on PlayStation, "B: confirm" on Switch. Tokens are the keys of `PAD` (`a b x y lb rb lt rt view start l3 r3 up down left right`); anything else in braces is left alone. `promptFor(device, { keys, pad }, padId)` picks the keyboard words or the filled pad words by `InputManager.lastDevice`. The HUD and first-run hints already use `padLabel` through `hud-keys.ts`.
- `padLabel(family, index)` gives the word for each button. On Nintendo pads index 0 is labelled **B**: the standard mapping is positional, so the bottom button stays bottom and only the label changes.
- An itch.io thread reports that embedded games could detect a pad but not its type. Treat id sniffing as a best guess and add a manual choice in Options ("Button prompts: Auto / Xbox / PlayStation / Nintendo"), stored with the other display prefs.
- Prompts show when `lastDevice === 'gamepad'`. That covers the How to Play Controls tab, the HUD hints, station "Hold E" prompts and the touch-pad labels. Draw them as small pixel-art button sprites to match the art kit, with text labels as the fallback.

## What is left

1. Mount the title hint: in `TitleScreen.vue`, after the `title-columns` div, add `<PadHint v-if="asking" />` (and `import PadHint from './PadHint.vue';`). It goes after the `v-else` div so the `v-if` / `v-else` chain stays intact. Without it the hint does not show; focus moving works regardless.
2. When a pad disconnects mid-run in solo, pause (`onGamepadConnection` in `game-controller.ts` is not wired), plus a toast on connect.
3. Button prompts: an Options override ("Auto / Xbox / PlayStation / Nintendo") and sprites. The How to Play Controls tab needs gamepad lines (use `promptFor`). Screens that show a prompt by device need `lastDevice` published to the UI state (`onDeviceChange` is not wired in `game-controller.ts`).
4. LB / RB tab switching: needs a marker on each screen's tabs.
5. First focus on arrival: the first push lands on the default control, but nothing focuses it when a screen opens with the pad already in charge. `focusDefault()` exists for a screen to call.
6. A pad reticle (`TODO(pad-reticle)` in `run-frame.ts`): a virtual crosshair along the right stick, so headshots get an `aimX/aimY` spot and "throw at the crosshair" has a target. Until then, pad aim is angle-only.
7. Rumble and aim assist (`TODO(rumble)`, `TODO(aim-assist)`).
8. Hands-on checks with real pads: Xbox (Bluetooth), DualSense (Bluetooth), 8BitDo (both modes) in Chrome, Edge and Firefox, both locally and inside the itch.io iframe. Specifically for this slice: the D-pad and stick repeat feel, that focus rings draw after a scripted focus (Chrome, Firefox, Safari), that B backs out of every title sub-page, and that a sound-only click is still asked for when the pad is the only input.
