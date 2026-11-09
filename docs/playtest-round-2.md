# Playtest: polish round 2

Played 2026-11-08 against branch `polish/round-2` (HEAD `b447ce7`) on the dev server at http://127.0.0.1:5188/, headless Chromium driven by the StarNet browser tools. Desktop viewport 1366x768 unless noted. No code changed.

Findings are written as each check finishes. Bug ranking is at the end.

## Checks

Build stamp on the title: `v26.11.9-150`. Driven with Playwright (playwright-core 1.61.1) against installed Chrome, headless, fresh browser context per run (so localStorage starts empty, like a first-time player). Game state read through the DEV handle `window.__outbreak` (HUD state plus the latest snapshot), screenshots from the real canvas. Scripts and screenshots are kept outside the repo in `/tmp/pt2/` (not committed).

### 1. Level 1, first 60 seconds

Route: Press Any Key > Play > Level Select > 1 One Town > Arcade setup (Solo, Stay Close, Night) > Start. Then the survivor stands still and does nothing, sampled once a second.

Observed (run 1, fresh profile):

| t (s) | Horde clock | HP | Nearest zombie (px) | Zombies within 200 px |
|---|---|---|---|---|
| 0 | 0:59 | 100 | 78 | 3 |
| 1 | 0:58 | 100 | 55 | 3 |
| 4 | 0:56 | 90 | 15 | 3 |
| 5 | 0:55 | 80 | 12 | 3 |
| 6 | 0:54 | 50 | 12 | 3 |
| 7 | 0:53 | 20 | 12 | 3 |
| 7.6 | - | 0 | Game Over | |

- First fight: yes, and far sooner than 20 s. Three opening walkers stand 75 / 110 / 145 px from the spawn (`OPENING_SHAMBLER_RINGS`), all three in contact by about t=4 s.
- First lull: the horde clock does start at 1:00 (was 2:17). Correct.
- But a survivor who does nothing is **dead in 7.6 s, before Horde 1, with the horde clock still at 0:53**. Three walkers at 10 damage per 1.2 s swing is about 25 HP/s once all three are on you. The Game Over card read "TIME 0:07".
- The first 1 to 3 seconds are covered by the "ONE TOWN / Survive 2 hordes" level card band across the middle of the screen; the survivor and the nearest walker are under or right next to it (screenshot `op_1.png`). The "controls" hint only appeared at about t=4, by which time the walkers were already hitting. A brand-new player gets roughly 3 to 4 seconds to read the card, read the hint, and find the mouse before the damage starts.
- Horde 1 softness and staggering could not be observed on this route because the idle survivor never lived to Horde 1. See the follow-up run below.

Verdict for item 1: the "fight within 20 s" target is met, but overshot. The opening went from "nothing for a minute" to "dead in 8 s if you pause to read". That is a new first-session quit point, worse than the old one, because now the player dies before they have pressed anything.

### 2. Game Over card (after a real death)

Same run as above: killed by the opening walkers at 0:07, no input.

- Cause line: "A walker got you. No shots fired in the last 10 seconds." Real data: it was walkers, and no shot was fired. Pass.
- Card: level card art on the left (skull over Silent Ruins), Hordes 0, Time 0:07, Kills 0, Score 0, difficulty "Stay Close", one big red "Try again from One Town", quieter "Main menu", and a Tip box ("Gunshots carry. Shoving is silent, so save the gun for a crowd."). Screenshot `go1.png`. Looks finished. Pass.
- Focus: `document.activeElement` was the "Try again from One Town" button as soon as the card was up. Pass.
- Enter restarts: pressing Enter put the game back on screen in a fresh Level 1 run (horde clock back at 0:57 three seconds later). Pass.
- Minor: no "New best" line on a 0-score death, which is correct (`isNewBest:false`). Not tested: the New best variant.

#### 1b. Repro and Horde 1 (run 3)

- Idle repro, second fresh profile: walkers in contact by t=3 s, dead at **0:10**, Game Over again "A walker got you. No shots fired in the last 10 seconds." So 2 of 2 idle runs die before Horde 1, at 7.6 s and 10 s.
- Then Try again (Enter), and to see Horde 1 at all I kept the survivor's health topped up through the dev handle (`run.transport.sim.sim.players[].health`) and shortened the remaining lull to 4 s. This is a test harness shortcut, not real play.
- "Horde in 10 seconds" hint showed before the horde (`hint: horde`). Pass.
- Horde 1 on Level 1 is **5 bodies** (was 7 to 8) and they come out **one at a time**: 1 alive at +0 s, 2 at +3 s, 3 at +6 s, 4 at +12 s, 5 at +13 s (sampled at about 1 Hz). Softer and staggered: pass.
- HUD during the horde reads "HORDE 1 / 5 HOSTILES LEFT" from the first second, even while only 1 of the 5 is out. Fine, arguably useful.
- An off-screen bite marker (red tick at the top-left edge) showed while a body hit from off camera (`h1_20.png`).

### 3 (part). Pause card and candy bag

- **Pause card, 1366x768** (`A_pause.png`): small framed card, "1 ONE TOWN" tab, "PAUSED", Volume slider, big red Resume (has focus on open), quieter Main menu. Clean, centred, game dimmed behind. Pass.
- **Pause has no Options entry.** The only buttons are Resume and Main menu. Options (and so the new Brightness slider) lives only under title > Extras > Options. A player who finds the night too dark has to quit the run to fix it. Not a bug in the brief's terms, but it undercuts the Brightness feature; see ranking.
- **Pause card, phone landscape 844x390 (touch, DPR 2)**: Resume and Main menu both inside the viewport, page does not scroll (`scrollHeight 390 = innerHeight`). Pass.
- **Candy bag over the level card, phone 844x390**: opened the bag (X) in the first second while `ui.levelCard` was still set. Only the bag is drawn; the "ONE TOWN / Survive 2 hordes" band is not painted over or under it (`P_bag_levelcard.png`). Pass. Ugly-but-working: on the phone the bag's Close is a small text word, not a button-shaped target.

### 6/7. Options card and Brightness slider

Options is reached from title > Extras > Options (not from Pause).

- **1366x768**: Options card fits; page does not scroll (`scrollHeight 768`), no control outside the viewport. Pass.
- **Phone 844x390 (touch, DPR 2)**: the card fits the screen; its body is a scrolling sheet (`.px-sheet-body` 796 px of content in 295 px). On open, the first view shows Sound and Comfort; Display (with Brightness), UI size and Privacy are below the fold and need a scroll. Back stays pinned at the bottom. Workable, and the brief's no-scroll rule is about setup screens, not Options. Ugly-but-working: nothing hints that the sheet scrolls, and the Brightness slider, the feature for "I can't see the zombies", is the part you cannot see on open (`B_phone_options.png`, `B_phone_options_scrolled.png`).
- **Brightness slider**: range 0 to 100 step 5, default 0, readout "Normal". Setting it to 100 shows "+40%" and writes `outbreak.display = {"brightness":1}`. A touch tap at 90% of the track on the phone set 95 / "+38%" / `{"brightness":0.95}`. Pass.
- **Persists after reload**: after a full page reload `outbreak.display` still read `{"brightness":1}`. Pass (storage level; slider read-back after reload in progress below).

- **Brightness changes the picture**: set to 100, reloaded, slider still read 100 / "+40%", then started Level 1. Mean frame luminance (0-255) at the same moment of a fresh Level 1: default 19.4, Brightness max 42.5; an unlit patch of park went 14.9 to 38.9. Visibly lifted: ground tiles and an unlit walker at the left edge read clearly (`B_bright_default.png` vs `B_bright_max.png`). Pass. (Different seeds per run, so the comparison is same-level, same-second, not identical scenes.)

### 3. First-run hints, once each

- Fresh profile: "controls" appeared about 2 s into the first run, held about 6 s, stored as `outbreak.hints = ["controls"]`. The "horde" hint ("Horde in 10 seconds...") appeared 10 s before Horde 1 and was stored too.
- Clean check (run H): first run on a fresh profile showed "controls" then "horde" (lull shortened to 12 s through the dev handle to reach it), storage `["controls","horde"]`. Full page reload, new Level 1 run, same 20 s wait and same shortened lull: **no hint at all**, storage unchanged. Once each, and not again after reload: pass.
- Side note, not a bug: a hint is only marked seen when it finishes. In another run I reloaded about 2 s into Level 1 while "controls" was still up; storage stayed `null` and "controls" showed again next run. That is the right behaviour for a hint nobody had time to read.
- Not reached: the "search", "bowl" and "van" hints (need walking to a container, a bowl, and surviving 2 hordes; my harness stands still).

### 4. HUD

- **Medkit and grenade**: bottom-left now shows a medkit icon + "0" + boxed "H", and a grenade/bottle icon + "1" + boxed "G" (`B_bright_max.png`). Readable as icon+count+key. Pass. On the phone the key boxes are gone and the icons are tappable (`P_hud.png`).
- **Run log docked**: bottom-right strip "0:00 ONE TOWN / L: LOG", no longer floating halfway down the right edge. Pass.
- **Top-left block on desktop**: still three lines (town, horde clock, hordes survived) but in a small compact box. Fine.
- **Bunker** (Play > Campaign > Start, `C_bunker.png`): the red "EMPTY / F: SHOVE" is gone. **But it is replaced by a red "PRESS R" under "0 / 0"** in the gun bar. You are at home with no ammo at all, so pressing R does nothing; it is the same false alarm in new words. Cause: `HudOverlay.vue:125` shows "Press R" whenever `hud.ammo === 0`, and the bunker has `ammo 0, reserve 0`. Low severity, but it is the exact thing item 7 meant to remove. Repeats every time.
- Off-screen bite marker: seen once at the screen edge while being hit from off camera during Horde 1. Pass on sight, not studied.

### 5. Zombies outside the light

- At default brightness, a walker standing in an unlit patch of park (outside lamps and the cone) shows a lighter rim and the yellow eyes; the body silhouette is separable from the ground at desktop size (`op_1.png`, `B_bright_default.png`). Clearly better than the Nov 9 "eyes only" note. Still dim at default; with Brightness up they read easily. Pass, with the caveat that this is my eye on a headless screenshot, not a real monitor in a dark room.

### 8. Console errors

Console errors, warnings and uncaught page errors were captured on every run (title, menus, Level Select, Arcade and Campaign setup, Level 1 at 1366x768 and 844x390 touch, Game Over, restart, Pause, Options, bunker, reloads). **None.** Pass.

---

## Bugs, ranked by what they cost a player

### 1. HIGH: an idle new player dies on Level 1 in 7 to 10 s, before Horde 1
Steps:
1. Fresh browser profile. Title > Play > Level Select > 1 One Town > Start (Solo, Stay Close, Night).
2. Do not touch anything.

Expected: the first fight starts within about 20 s and can be survived by someone still reading the level card and the controls hint; Horde 1 is the first real threat.
Actual: three opening walkers stand 75 / 110 / 145 px from the spawn and reach you in about 3 s. HP 100 > 90 > 80 > 50 > 20 > 0 between t=3 and t=8 (run 1) or t=10 (run 3). Game Over "A walker got you", Time 0:07 / 0:10, horde clock still on 0:53 / 0:50. The level card band covers the middle of the screen for the first seconds and the controls hint is still up when you die.
Repeats: 2 of 2 fresh runs.
Why it matters: the old first minute was boring; this one kills you before you have pressed a key. Suggestions for the engineer (not built): push the rings out (e.g. 160 / 220 / 280 px) so contact lands around 8 to 15 s, or make the opening shamblers half damage / wake on sight, or hold their first swing until the level card is gone. A real player who moves and shoots will usually survive, but "first touch is death" is the worst first impression.

### 2. LOW: bunker gun bar still shouts in red, now "PRESS R"
Steps: Title > Play > Campaign > Start. Look at the gun bar.
Expected: no red warning at home (item 7).
Actual: "EMPTY / F: SHOVE" is gone, but the bar shows "0 / 0" with a red "PRESS R". R does nothing with no reserve. `HudOverlay.vue:125` shows it whenever `hud.ammo === 0`.
Repeats: every time (`C_bunker.png`).

### 3. LOW: Brightness is hard to reach when you need it
- Pause has only Resume and Main menu; Options (and Brightness) is only under title > Extras > Options. A player who cannot see zombies mid-run must quit the run to fix it.
- On phone landscape the Options sheet opens on Sound and Comfort; Brightness is below the fold of a scroll area with no scroll cue.
Not a defect against the brief, but it blunts item 3/8's purpose.

### Cosmetic / ugly but working
- On the phone the candy bag's Close is a small word, not a button-shaped target.

## Tested and fine
- Level 1 horde clock opens at 1:00 (was 2:17).
- Horde 1 on Level 1: 5 bodies, released one at a time over about 13 s; "Horde in 10 seconds" hint before it.
- Game Over card: real cause line ("A walker got you. No shots fired in the last 10 seconds."), Try again focused on open, Enter restarts a fresh Level 1, a tip shown.
- First-run hints: shown once each, not again after reload; an unfinished hint is shown again.
- HUD: medkit and grenade as icon + count + key; run log docked bottom-right; no red EMPTY in the bunker (but see bug 2).
- Zombies outside the light: rim and eyes separate them from the ground at default brightness; Brightness max makes them obvious.
- Pause card at 1366x768 and 844x390: fits, Resume focused. Options at 1366x768: fits without scroll. Candy bag opened during the level card: the card is not drawn over the bag.
- Brightness: 0 to 100, writes `outbreak.display`, survives reload, lifts mean frame luminance from 19 to 43 when a run starts.
- No console errors anywhere.

## Could not test
- Audio by ear (headless, no speakers): ambience beds, horde warning drum, music prefetch.
- A real phone (touch feel, notch, thermal), a real gamepad (item 10 focus nav and pad glyphs), co-op by code (needs two clients).
- Safari: the only WebKit on this machine is Playwright revision 2083 and the installed playwright-core 1.61.1 wants 2311; I did not download a browser.
- Horde frame rate and load size: not measured this round (dev server, unminified, not representative).
- Search, bowl and van hints: my harness stands still and never reached a container, a bowl, or the van.
- "New best" variant of the Game Over card.
- Real play past Horde 1. Horde 1 was observed with health topped up through the dev handle, so it shows pacing, not difficulty.

## Late note: retest of bug 1 against the uncommitted ring change

At 22:25 someone changed `shared/constants.ts` in the working tree (not committed): `OPENING_SHAMBLER_RINGS` 75/110/145 to 110/150/195, with "the others start beyond sight range and join as the fight makes noise". The dev server picked it up. My runs 1 and 3 above were before that change.

Idle retest on the new values, fresh profile, same route, no input:
- One walker reaches you at about t=3 s (starts 91 px away); the other two stay 165 to 198 px away and never close in while you stand still.
- HP falls 10 about every 1.2 s from t=4: **dead at t=16 s**, horde clock 0:45. Game Over again.

So the change halves the damage rate and doubles the time to death, but an idle new player still dies on Level 1 before Horde 1, now to a single walker. Bug 1 stays HIGH until either the first walker cannot kill (or wakes late), or the first contact comes after the level card and controls hint have had time to be read. 3 of 3 idle runs died across both versions.
