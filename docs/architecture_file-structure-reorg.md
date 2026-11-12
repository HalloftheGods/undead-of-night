# Architecture Intel: File Structure Reorganization & Path Aliasing

Documented: 2026-11-11
Reference Task: #7501 (Decision)

## 1. Current Structure Inventory

* **src/game/**: 128 flat files, 3 subdirectories (`analytics/`, `home/`, `pwa/`).
  * High friction: gameplay loop, input handlers, UI modals, lore text, and preferences live side by side.
* **src/components/**: 237 flat files.
  * Violates AGENTS.md architectural hierarchy (no atom/molecule/organism/view division).
* **shared/**: 120 flat files, 2 subdirectories (`lobby/`, `room/`).
  * Sim state, combat formulas, map building, and loot definitions sit in a single directory.
* **src/engine/**: 41 flat files.
* **src/art/**: 32 files, 11 subdirectories (already grouped cleanly by asset category).
* **src/audio/**: 20 flat files.
* **tests/**: 320 flat spec files referencing brittle relative paths (`../shared/...`, `../src/...`).
* **Path Aliasing**: Only `@/*` -> `./src/*` exists in `tsconfig.json` and `vite.config.ts`.
  * Deep relative traversal (`../../shared/...`, `../../../shared/...`) breaks during file moves.

## 2. Path Alias Strategy

Configure TypeScript, Vite, and Vitest with first-class domain aliases:

* `@/*` -> `src/*`
* `@shared/*` -> `shared/*`
* `@game/*` -> `src/game/*`
* `@components/*` -> `src/components/*`
* `@engine/*` -> `src/engine/*`
* `@art/*` -> `src/art/*`
* `@audio/*` -> `src/audio/*`

Enables zero-breakage file movement across nested folders.

## 3. Proposed Directory Reorganization

### A. `src/game/` Domain Grouping
* `src/game/session/`: `game-controller.ts`, `run-session.ts`, `run-frame.ts`, `run-stage.ts`, `run-notices.ts`, `client-world.ts`, `prediction.ts`, `snapshot-buffer.ts`, `snapshot-handler.ts`, `play-flow.ts`, `seat-check.ts`, `van-transition.ts`
* `src/game/input/`: `input-manager.ts`, `input-sender.ts`, `gamepad-input.ts`, `touch-input.ts`, `touch-marks.ts`, `touch-pad.ts`, `touch-pref.ts`, `touch-stick.ts`, `touch-tabs.ts`, `swipe-arrows.ts`, `swipe-gesture.ts`, `tap-aim-assist.ts`, `pad-focus.ts`, `pad-glyphs.ts`, `pad-hint.ts`
* `src/game/map/`: `town-map.ts`, `town-guide.ts`, `map-buildings.ts`, `map-cursor.ts`, `map-fog.ts`, `map-ground.ts`, `map-key.ts`, `map-leftovers.ts`, `map-markers.ts`, `map-sprite.ts`, `map-teammate.ts`
* `src/game/inventory/`: `local-bag.ts`, `candy-bag.ts`, `candy-bag-panel.ts`, `backpack-wheel.ts`, `dual-loot-modal.ts`, `inventory-modal.ts`, `loot-item-art.ts`, `material-chips.ts`, `workbench-gesture.ts`
* `src/game/hud/`: `hud-state.ts`, `hud-keys.ts`, `run-hud.ts`, `level-hud.ts`, `overrun-hud.ts`, `weapon-bar.ts`, `bite-marker.ts`, `first-run-hints.ts`
* `src/game/menus/`: `title-menu.ts`, `title-nav.ts`, `press-start.ts`, `setup-picks.ts`, `character-select-view.ts`, `mode-select-view.ts`, `style-select-view.ts`, `level-select.ts`, `level-swatches.ts`, `level-progress.ts`, `level-meters.ts`, `game-over-view.ts`, `death-cause.ts`, `death-tips.ts`, `credits.ts`, `changelog.ts`, `change-notes*.ts`
* `src/game/home/`: consolidate bunker and merchant logic (`bench-view.ts`, `bench-effects.ts`, `bench-link.ts`, `home-hud.ts`, `home-link.ts`, `home-mode.ts`, `home-screens.ts` alongside existing `home/` items)
* `src/game/lore/`: `books-data.ts`, `book-turn.ts`, `candy-magazine-data.ts`, `candy-brands.ts`, `magazine-*.ts`, `record-book.ts`
* `src/game/prefs/`: `character-pref.ts`, `controls-prefs.ts`, `difficulty-pref.ts`, `display-prefs.ts`, `loot-prefs.ts`, `menu-info-pref.ts`, `motion-pref.ts`, `motion.ts`, `style-pref.ts`, `storage.ts`
* `src/game/audio/`: `run-audio.ts`, `radio-player.ts`, `sound-test.ts`, `sound-unlock.ts`, `heartbeat.ts`, `kill-juice.ts`, `haptic-feedback.ts`
* `src/game/daily/`: `daily-ghost.ts`, `daily-night.ts`, `streak-reward.ts`, `event-log.ts`, `invite-link.ts`, `pending-room.ts`, `trip-record.ts`

### B. `src/components/` Tier Alignment (AGENTS.md Hierarchy)
* `src/components/atoms/`: `PixelButton.vue`, `PixelSwitch.vue`, `SpriteImg.vue`, `PadHint.vue`, `SoundChip.vue`, `SlotMeter.vue`, `MaterialChips.vue`
* `src/components/molecules/`: `BrightnessSlider.vue`, `OptionSlider.vue`, `OptionChoice.vue`, `GunFitPips.vue`, `MapKeyIcon.vue`, `ShopItemBars.vue`, `LevelCard.vue`, `DifficultyBars.vue`
* `src/components/organisms/`: `BossBar.vue`, `EmoteWheel.vue`, `BackpackWheel.vue`, `DualLootModal.vue`, `OverrunClock.vue`, `QuestPanel.vue`, `HudOverlay.vue`, `TownMap.vue`
* `src/components/views/`: `TitleScreen.vue`, `ControlsPage.vue`, `OptionsPage.vue`, `RecordsPage.vue`, `RadioPage.vue`, `SoundTestPage.vue`, `LevelsPage.vue`, `BooksPage.vue`, `GameOverScreen.vue`, `CreditsScreen.vue`

### C. `shared/` Domain Grouping
* `shared/combat/`: `combat.ts`, `melee.ts`, `headshots.ts`, `weapons.ts`, `gun-upgrades.ts`, `gun-upgrade-data.ts`, `throwables.ts`, `kitchen-knives.ts`, `kill-chain.ts`
* `shared/entities/`: `players.ts`, `player-health.ts`, `player-roster.ts`, `characters.ts`, `character-stats.ts`, `loadout.ts`, `stamina.ts`, `callsign.ts`, `zombies.ts`, `zombie-burn.ts`, `zombie-senses.ts`, `zombie-status.ts`, `bosses.ts`
* `shared/world/`: `levels.ts`, `biomes.ts`, `ground.ts`, `flow-field.ts`, `spatial-grid.ts`, `world-map.ts`, `world-blocks.ts`, `world-query.ts`, `landmarks.ts`, `street-names.ts`, `sewers.ts`, `storeys.ts`, `snow-tracks.ts`, `town-*.ts`
* `shared/items/`: `loot.ts`, `pickups.ts`, `containers.ts`, `container-*.ts`, `bag.ts`, `bag-*.ts`, `grid-inventory.ts`, `backpack.ts`, `candy.ts`, `supplies.ts`, `supply-*.ts`, `bottles.ts`, `keepsakes.ts`, `salvage.ts`, `salvage-data.ts`, `treasure.ts`
* `shared/environment/`: `doors.ts`, `door-view.ts`, `fortifications.ts`, `hazards.ts`, `building-*.ts`, `fireworks-booth.ts`, `exit-van.ts`, `radio.ts`, `radio-tower.ts`, `stations.ts`, `workbench.ts`
* `shared/progression/`: `progression.ts`, `challenges.ts`, `difficulty.ts`, `game-style.ts`, `night-events.ts`, `waves.ts`, `round-effects.ts`, `round-effect-data.ts`, `overrun.ts`, `overrun-*.ts`, `trip.ts`, `trip-*.ts`
* `shared/sim/`: `simulation.ts`, `sim-state.ts`, `sim-factory.ts`, `snapshot-build.ts`, `snapshot-view.ts`, `movement.ts`, `action-skills.ts`, `rng.ts`, `constants.ts`
* `shared/protocol/`: `protocol.ts`, `close-codes.ts`, `events.ts`, `home-protocol.ts`, `map-protocol.ts`, `sandbox.ts`
* `shared/bunker/`: `bunker-map.ts`, `bunker-merchants.ts`, `merchant-fight.ts`

## 4. Rollout Protocol

1. **Step 1: Alias Configuration**: Add `@shared/*`, `@game/*`, `@components/*`, `@engine/*`, `@art/*`, `@audio/*` into `tsconfig.json`, `vite.config.ts`, and `vitest.config.ts`.
2. **Step 2: Barrel Re-exports**: Keep index/re-export compatibility shims during transition so existing references continue to work.
3. **Step 3: Sequential Domain Moves**: Move files domain by domain with single-batch updates, verifying after each step with `chemx typecheck` and `chemx test`.
