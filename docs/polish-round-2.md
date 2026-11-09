# Polish round 2: lanes

Source of truth: `docs/polish-plan.md` (ranked top 10, built against `15758d3`). Item 5 (phone bottom bar) already shipped in #65. Baseline here is `main` at `b29ad69`.

## Ground rules (every worker)
- Repo: `~/www/x/Xophz-COMPASS/apps/zombie-survival`. One shared checkout, clean at start. Touch ONLY the files in your lane; if you need a file outside it, say so in your report instead of editing it.
- Do not run `git checkout`, `commit`, `push`, `merge`, `stash` or `reset`. The Game Master commits.
- Do not delete existing files.
- Verify with `pnpm exec vue-tsc --noEmit` and the narrowest `pnpm exec vitest run <your specs>`. A typecheck error in a file outside your lane is another worker's in-progress edit: note it, do not fix it.
- Add or update tests for behaviour you change. Keep the no-scroll rule on setup screens and the existing pixel style.
- Report: files changed, commands run with results, what is NOT verified.

## Lanes
| Agent | Plan items | Lane |
|---|---|---|
| ENGINEER | 1: first fight in 20s, shorter first lull and softer Horde 1 on Level 1 only | server/shared spawn, horde and level config, level-1 tests, `OFF_PATH_DRAWS` re-record if town-gen moves |
| CHEMIST (engineer-2) | 9: music under the cap; then 6: ambience beds hooked in, horde siren/stinger 10s before each horde | `public/music/**`, `src/audio/**`, `tools/vite-pwa.ts`, audio tests |
| RESERVE ENGINEER (engineer-3) | 2: contextual first-run hints; 7: HUD tidy (icon+count+key, docked run log, one-line phone block, no bunker EMPTY, off-screen bite marker) | `src/components/HudOverlay.vue`, `GestureHints`, new hint files, `src/game/hud-state.ts`, `run-hud.ts`, `run-notices.ts`, `touch-*` files |
| GLOWSMITH (webdesigner) | 4: Game Over with cause, big Retry, New best, tip; 8: card style on Pause, Game Over, Options; overlays clear banners; Brightness slider | `GameOverScreen.vue`, `DeathSummary.vue`, `PauseMenu.vue`, `OptionsPage.vue`, `DisplayOptions.vue`, `pixel-ui.css`, `src/game/display-prefs.ts` |
| ART DIRECTOR | 3: zombies readable outside the light (1px rim), no new silhouettes | `src/art/zombies/**`, `src/art/zombies.ts`, `src/engine/zombie-eyes.ts`, art specs |
| Clone (gamepad) | 10: focus moves between buttons, press-any-button hint, pad glyphs in prompts | `src/game/gamepad-input.ts`, `title-nav.ts`, `pad-glyphs.ts`, `docs/gamepad.md` |
| PLAYTESTER | after the builders: play the merged build, verify each item | `docs/playtest-round-2.md` |

## Game Master
Integrate, run `vue-tsc`, `vitest`, `eslint`, `build`, commit per lane, push, verify.

## Riskiest assumption
Parallel edits in one checkout stay disjoint. Kill-test: `git status` shows only lane files; final typecheck passes before any commit.

## Music decision (Commander, 2026-11-08)

The 50 MB portal cap is dropped as a constraint. All tracks stay. The OGG set is re-encoded from the MP3s at Vorbis quality 2 (about 96 kbps): 117 MB down to 91 MB, durations unchanged. MP3s stay as the fallback for browsers that cannot play Ogg. No compact set and no MUSIC_DIR build switch. Loader prefetch (menu track plus the current level's track) stays.
