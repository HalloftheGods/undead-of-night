# Undead of Night: Polish Backlog

PRODUCER, 2026-11-07. Lane: `docs/polish-backlog.md` only (see `docs/polish-plan-2026-11-07.md`).

**Outcome.** A stranger on itch.io or Newgrounds, on a laptop or a mid-range phone, plays a run that feels finished: they are fighting within a minute, they understand why they died, they can see their progress is saved, and nothing breaks inside a portal iframe. We know it worked when GA4 shows title→run_start ≥ 60%, runs per session ≥ 2 after a defeat, `perf_summary` mostly in the top fps band on touch, and zero `game_error` from portal origins in week 1.

**Excluded, because another lane already owns it:** OGG music and lazy loading (ENGINEER-2), the SFX pass (ENGINEER), new sprites/props/FX in `src/art` (RESERVE ENGINEER), title page and menu polish (GLOWSMITH), launch art and screenshots (ART DIRECTOR), the playtest (PLAYTESTER), trailer and GIFs, store copy, portal requirements research, Discord and the Feedback link, the copy audit, and gamepad support.

---

## What already exists (checked in source, so it is not re-specced here)

| Area | Already built | Where |
|---|---|---|
| Hit-stop | Freeze frames for headshot 45 ms, brute 110 ms, chain 35 ms, horde wiped 260 ms, boss 420 ms | `src/game/kill-juice.ts` |
| Callouts | DOUBLE/TRIPLE/QUAD/MASSACRE, CLOSE CALL, HORDE WIPED | `kill-juice.ts`, `KillCallout.vue` |
| Screen feedback | Trauma-based shake, damage vignette, low-health pulse, death desaturation, boss white flash | `src/engine/screen-effects.ts` |
| Motion options | Motion: System/Full/Reduced; a 0 to 1 shake slider; Reduced caps the shake and skips the boss flash | `motion-pref.ts`, `MotionOptions.vue` |
| Display options | Hit palette Classic/Clear; UI scale 1x / 1.25x / 1.5x | `display-prefs.ts`, `DisplayOptions.vue` |
| Sound options | Master, Music and SFX sliders, plus Mute | `SoundOptions.vue` |
| Performance | A low-res buffer scaled up by whole numbers; automatic load shedding of particles and small lights (100% / 50% / 25%) | `world-renderer.ts`, `engine/frame-budget.ts` |
| Focus loss | Pauses on window blur and tab hide; held keys are cleared on blur | `game-controller.ts`, `input-manager.ts` |
| Perf telemetry | `perf_summary` with `fps_band` and `device_class` | `analytics/run-tracker.ts` |
| Game over | Stats, New best, Daily counted/practice, Play again, Continue from level N (solo Arcade), Share (Daily), Main menu | `GameOverScreen.vue` |

**Not found in source** (searched `src/`): any tutorial, first-run or onboarding code; key rebinding; save export or import; a `first_kill` event; a cause of death on the Arcade game-over screen (the Campaign `DeathSummary.vue` has a note, Arcade does not).

The juice is already strong. **The biggest gaps are not juice.** They are the first minute, the moment after death, readability in the dark, low-end phones and portal hosting.

---

## Ranked backlog

Effort: S ≤ 1 day, M = 2 to 4 days, L = 1 week or more. Rank = player-visible impact ÷ effort. "Owner" is the suggested lane; the Game Master assigns it.

### Tier 1: ship before the itch page goes live

| # | Item | Area | Effort | Definition of done |
|---|---|---|---|---|
| 1 | **Funnel instrumentation**: `style` and `daily` params on `run_start`, a `first_kill` event with `seconds`, and a Campaign trip death sent as `run_end result=defeat` | Store-readiness (measurement) | S | All three appear in GA4 DebugView on a test run, and each new event or param is listed in both `analytics/catalog.ts` and `privacy-text.ts`. |
| 2 | **One-click first run**: a first-time visitor's PLAY starts solo Arcade, Level 1, Stay Close, with the default survivor. The 4-step setup appears from the second run on. | Onboarding | S | Given empty storage, clicking PLAY reaches gameplay with no setup step shown; given one saved run, the stepper shows as today. Invite links and Levels-page picks are unchanged. **Coordinate with GLOWSMITH**, who owns the title files; the logic lives in `play-flow.ts` and `shared/game-style.ts`. |
| 3 | **Retry in one key**: on a solo Arcade defeat, "Try again from level N" becomes the focused primary button, and Enter (or gamepad A) activates it. | Game feel / retention | S | Given a solo Arcade defeat on level N, pressing Enter on the game-over screen starts level N within 2 s. Today the primary is "Play again" (from level 1) and Continue is secondary. Daily and co-op are unchanged. |
| 4 | **Cause of death on the Arcade game-over screen**: one line naming the killer type, plus "you fired N shots in the 10 s before" when that is true | Game feel / fairness | S | Given a death, the game-over screen shows a line such as "A runner got you from behind. You fired 6 shots in the last 10 seconds." built from data the run already tracks (`killer_type`, `shots_fired`). Given a death with no killer recorded, the line is omitted, not "Unknown". |
| 5 | **Brightness / gamma slider** in Display options (default = today's look) | Accessibility / readability | S | The slider runs from the current image to about +40% lift on the lighting layer, persists in `outbreak.display`, and a screenshot of Level 1 at max shows containers, doors and zombies distinguishable at 3 m from the survivor. The play plan logged darkness as the main readability problem on first contact. |
| 6 | **Contextual first-run hints**, shown once each and stored in prefs: move/aim/fire at spawn; "Hold E" at the first container; "F: Shove is silent" at first contact or an empty mag; "Zombies heard that" on the first shot that alerts zombies; a 10 s horde warning | Onboarding | M | Given a fresh profile, each hint appears exactly once at its trigger and never again after it is dismissed or acted on. Touch players see touch wording. A "Reset hints" button in Options brings them back. Uses the existing hint banner in `run-hud.ts`. |
| 7 | **Portal iframe hardening**: arrow keys and Space never scroll the host page; a "Click to play" focus gate when the frame has no focus; audio resumes on the first input; a fullscreen button that works in an iframe; the game runs (with a warning) when `localStorage` throws | Store-readiness | M | Tested in a local page that embeds the build in an `<iframe>` like itch.io does: the host page does not scroll during play, keys work after one click, sound plays after that click, fullscreen toggles, and a sandboxed frame without storage shows "Progress will not be saved in this window" instead of failing. |
| 8 | **Low-end phone pass**: on touch devices with `navigator.deviceMemory ≤ 4` or `hardwareConcurrency ≤ 4`, start the frame budget at level 1 (50% extras) instead of 0, and add a manual Graphics option: Auto / Low | Performance | M | On a throttled mid-range phone profile (Chrome DevTools 4x CPU slowdown, 412x915 viewport), a full horde on Level 1 holds ≥ 50 fps median. Low also drops the most expensive lighting pass. `perf_summary` on touch shows the top fps band in ≥ 70% of runs in week 1. *Assumption: lighting is the heaviest cost; ENGINEER to profile and confirm before choosing what Low cuts.* |

### Tier 2: ship in the first two weeks after launch

| # | Item | Area | Effort | Definition of done |
|---|---|---|---|---|
| 9 | **Visible noise ripple**: a faint ring at the survivor when a shot, sprint or bottle makes noise, sized to the real alert radius | Game feel + accessibility (deaf and muted players) | S–M | Given a gunshot, a ring the size of the sim's alert radius draws for about 0.4 s; sneak shows no ring; a toggle sits in Display options, on by default. Draws only from existing events, so the sim and the Daily seed are untouched. This makes the game's core verb readable without sound. |
| 10 | **Off-screen threat arrows**: when the survivor takes a hit from outside the view or from behind, a short red edge marker points toward the attacker | Game feel / fairness | S | Given damage from a zombie outside the flashlight cone or the view, a marker appears on that screen edge for ≤ 0.6 s. Reduced motion keeps it but removes the pulse. *Assumption: none exists today; I found no direction indicator in `screen-effects.ts`.* |
| 11 | **Sound captions for sound-only threats**: short text tags such as "[horde coming]", "[screamer]" and "[runner close]" near the HUD edge | Accessibility | S | An Options toggle (off by default); when on, each of the listed cues shows a tag for 2 s when the sound plays. The cue list is decided with ENGINEER, who owns the SFX lane, so the tags match real sounds. |
| 12 | **Save clarity**: a "Saved on this device" line with the last save time on Records, and on the title "Continue: Level N" when Arcade progress exists | Save and progression | S | Given level progress, the title shows the Continue level; given no progress, it shows nothing. Records states that progress lives in this browser only and that private windows and other sites (itch vs. the home site) keep separate saves. |
| 13 | **Save export and import**: a code or a file in Options that carries records, stamps, level progress, streak and settings | Save and progression | M | Exporting on the home site and importing on itch reproduces Records, stamps and Continue level exactly; a corrupt or old code is refused with a message and changes nothing. This matters because each portal origin has its own `localStorage`. |
| 14 | **Hold-to-toggle options** for hold E (search) and Shift (sprint) | Accessibility | S | Options has "Search: Hold / Toggle" and "Sprint: Hold / Toggle"; in Toggle mode one press starts and the next press or the end of the action stops. Default stays Hold. |
| 15 | **Loading feedback**: a progress readout during first load and the art bake, and a clear message on a failed load | Onboarding / perf | S | First load on a throttled "Fast 4G" profile never shows a blank or frozen screen for more than 1 s; the existing `PageLoadFailed.vue` appears on a network failure with a Retry button. |
| 16 | **Pause hygiene check**: on tab hide, audio is suspended, not just the sim; on return, the game stays paused until input | Store-readiness | S | Switching tabs mid-horde silences all audio within 0.5 s, and returning shows the pause menu, not live play. Portal reviewers test this. *The blur and visibility listeners exist; the audio side is unverified.* |
| 17 | **Build stamp**: the version and build date in small text on the title and in Options | Store-readiness / support | S | The text matches the deployed commit, so bug reports from Discord and portals name a build. |

### Tier 3: later (needed for CrazyGames/Poki or Steam, not for itch)

| # | Item | Area | Effort | Definition of done |
|---|---|---|---|---|
| 18 | **Portal build flag** (`VITE_PORTAL`): hides co-op (or links out to the home site), hides the Install cartridge in iframes, and can switch GA4 and any outside requests off | Store-readiness | M | A portal build makes zero requests to outside origins with analytics off (checked in the network panel), and the title shows no co-op or install entry. Poki requires no outside requests by default (launch plan). |
| 19 | **Portal SDK hooks**: `gameplayStart`, `gameplayStop` and pause-for-ad calls behind one adapter | Store-readiness | M | One adapter module, a no-op on itch and the home site; on the CrazyGames test page the SDK sees start and stop at run start, pause, death and the menu. |
| 20 | **Key rebinding** for keyboard | Accessibility | M | Every action in How to Play can be rebound in Options, conflicts are refused with a message, and the How to Play page shows the current keys. Expected by Steam players; not needed on portals. |
| 21 | **Camera aim kick and a light recoil nudge** on firing (camera only, scaled by the shake slider) | Game feel | S | Each shot offsets the camera ≤ 2 px opposite the aim and returns within 80 ms; a shake level of 0 removes it. Low priority: the juice is already strong. |
| 22 | **Photosensitivity notice** on first launch, with a link to the Motion option | Accessibility / store | S | Shown once before the first run; it names the boss flash and the blood moon, and links to Reduced motion. |

---

## Edge cases, each decided

| Case | Decision |
|---|---|
| Empty storage or a private window | Counts as a first visit every time: hints and the one-click start repeat. Acceptable. Records shows the "not saved" warning (#7, #12). |
| Storage throws (sandboxed iframe) | The game runs; progress is not kept; one warning line on the title (#7). |
| Huge input (a 3+ hour run, 999+ kills) | The game-over stats must not overflow at UI scale 1.5x. Add to the RC check, no new work unless it breaks. |
| Offline | The home site has the PWA. Portal builds: out of scope. A first load that fails shows `PageLoadFailed.vue` (#15). |
| Co-op | Items 2, 3 and 6 do not change co-op behaviour. `first_kill` and the cause-of-death line count the local player only. |
| Nightly Run | No item changes the Daily seed or the sim. #9 and #10 draw only from existing events. Level 1 pacing changes are excluded until PLAYTESTER reports. |
| Gamepad | Every new button or toggle must be reachable by gamepad focus; #3's primary button is the default focus. Coordinate with the gamepad layer. |

---

## Release-candidate checklist

A build is a release candidate when every line is checked on the deployed URL, not a dev server.

**Build and code**
- [ ] `pnpm exec vue-tsc --noEmit`, vitest, lint and the production build all pass.
- [ ] The title shows the build stamp (#17), and it matches the deployed commit.
- [ ] The initial download is ≤ 50 MB (CrazyGames cap) and the music loads lazily (ENGINEER-2 lane).

**First minute**
- [ ] A fresh profile reaches gameplay in one click from the title (#2).
- [ ] Each first-run hint appears once (#6).
- [ ] The first zombie is on screen within 30 s on Level 1. *To be confirmed by PLAYTESTER.*

**Feel and fairness**
- [ ] Dying in solo Arcade shows the cause line (#4) and Enter retries from the same level (#3).
- [ ] Hit-stop, shake and the vignette respond to the shake slider and to Reduced motion.

**Accessibility**
- [ ] Brightness (#5), palette, UI scale, Motion, shake and the three volume sliders all persist after a reload.
- [ ] All menus work by keyboard only and by gamepad only.
- [ ] At UI scale 1.5x on a 360 px-wide phone, no HUD or menu text is clipped.

**Performance**
- [ ] On a 4x CPU-throttled phone profile, a full horde holds ≥ 50 fps (#8).
- [ ] On a real mid-range phone in Safari and a 4 GB Chromebook, Level 1 plays through without a stall over 1 s (launch-plan item).
- [ ] Music plays in Safari through the OGG → MP3 fallback (polish-plan kill-test).

**Saves and progression**
- [ ] Records, stamps, streak and the Continue level survive a reload and a browser restart.
- [ ] The title shows the Continue level (#12).

**Portal hosting**
- [ ] Inside an iframe: no host scrolling, keys work after one click, audio starts, fullscreen works (#7).
- [ ] Tab switching silences audio and keeps the game paused (#16).
- [ ] No console errors on load or during one full level.
- [ ] Zero `game_error` events in GA4 DebugView during a test run.

**Store page**
- [ ] The itch.io page has the cover at 630x500, the GIFs, the tags and the Feedback / Discord link (other lanes).
- [ ] The music license covers commercial use on every target store (ExoticService credit; launch plan).

---

## Cuts and open questions

**Cut from this backlog (explicitly later):** an online leaderboard, shared Daily ghosts, a Devvit port, new content (biomes, weapons, bosses), Steam Cloud and achievements, any Level 1 pacing change before the playtest, and Campaign rework.

| Open question | Owner |
|---|---|
| Should Arcade be the first-time default (#2)? It reverses `DEFAULT_STYLE` and the docs. | Commander |
| Does GLOWSMITH's title work already change the PLAY flow? If so, #2 merges into that lane. | Game Master |
| What does Low graphics cut (#8)? Profile lighting vs. particles first. | ENGINEER |
| Which sounds get captions (#11)? Match the list to the SFX pass. | ENGINEER |
| Does the audio context suspend on tab hide today (#16)? | PLAYTESTER or ENGINEER |
| Is there any existing off-screen damage indicator (#10)? I found none in `screen-effects.ts`. | ENGINEER |
