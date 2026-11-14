# Undead of Night: Take One — Trailer and GIF Plan

Status: DRAFT for Commander approval. Nothing here has been posted.
Built from docs/launch-plan.md (2026-11-07) plus a read of the live build, v26.11.8-191, https://undeadofnight.forthexp.com/.

## Facts used, and what is still unconfirmed

Confirmed on the live build:
- Menu: PLAY, Nightly Run, LEVELS, HOW TO PLAY, RECORDS, SOUND TEST, OPTIONS.
- 10 levels, unlocked in order. Level 01 is SILENT RUINS (Night): "Survive 2 hordes to open the exit." Tags for 02-10: Night, Dusk, Flooded, Toxic, Blackout, Emergency, Blizzard, Infested, Inferno. Only Level 01 is playable on a fresh save.
- The level screen lists Hordes, Difficulty, Brutes and Runners.

From launch-plan.md, not yet seen by me in play: the molotov burn chain, Overrun, a boss, the blood moon, the van escape, and the kill chain. Which level each one lives on is NOT confirmed. The "Level" fields below are my best placement; the person filming should confirm each against the build and change the field if it is wrong.

Capture prerequisite: a save with all 10 levels unlocked (or a debug unlock). Without it only Level 01 can be filmed.

Positioning line for every caption: free, in your browser, no download. Say "play with a friend by code" where co-op shows (co-op is invite-only, no matchmaking).

---

## PART 1 — Trailer

Length: 40 s master (inside the 30-45 s brief). A 30 s cut-down for Steam and portals drops the 0:03-0:08 beat and shortens the horde and chain beats by 2 s each.
Format: 1920x1080 (16:9), 30 fps, H.264 MP4. A 9:16 crop (1080x1920) from the same footage for TikTok, Shorts and Reels.
Audio: one music track (the OGG build), gunfire and groans in, no voiceover. Hard cut to silence on the title.
Captions: burned in, 4 words max per card, large pixel font.

| Time | Shot | Level / moment | Card |
|---|---|---|---|
| 0:00-0:03 | Cold open on gameplay. Player already firing, zombies closing. No logo, no fade. | L01 Silent Ruins, mid-wave | none |
| 0:03-0:08 | Wider view. Survivor in the ruins, zombies drifting in from several sides. | L01, wave 1 build-up | "THEY KEEP COMING" |
| 0:08-0:16 | The horde. Screen fills, runners sprint ahead, a brute lumbers behind. | L01, horde 2 arrival (or the Overrun moment if it looks bigger) | "TWO HORDES" |
| 0:16-0:24 | Molotov throw, fire spreads, zombies burn and scatter. Hold two beats on the flames. | Level with the best fire. L10 Inferno is the likely pick; confirm | "BURN IT DOWN" |
| 0:24-0:34 | Kill chain. Cuts every ~1.5 s across three chain moments, counter visible each time. Mix of two levels with different looks (e.g. L06 Blackout, L08 Blizzard). | Confirm chain counter shows on screen | "CHAIN THE KILLS" |
| 0:34-0:37 | Exit opens. Player runs for it, or the van escape, zombies trailing. | L01 post-horde 2 | none |
| 0:37-0:40 | Title: UNDEAD OF NIGHT: LAST ROUND. URL underneath: undeadofnight.forthexp.com. Small line: "Free. No download." Hold 3 s. | Black background | none |

Pass/fail checks before export:
- Frame 0 already shows gameplay (gameplay inside the first 3 s).
- Horde, molotov burn and kill chain each appear at least once.
- Title and URL are on screen for the final 3 s; URL readable on a phone.
- Runtime between 30 and 45 s.

---

## PART 2 — GIFs (6)

All GIFs run 3 to 6 seconds, per launch-plan.md. Reddit and short-form: GIF first, link in a comment.

### Capture settings (every GIF)
- Fullscreen game window, no tabs or bookmarks bar, browser zoom 100%, devicePixelRatio 1.
- Record in OBS at the game canvas size, integer scale only (2x or 3x), nearest-neighbor, no smoothing. 60 fps, CRF 16 MKV.
- Export 15 fps, 640 px wide (480 px for Discord), 64-color palette. Target under 8 MB. Limits: X 15 MB, Discord 10 MB.
- Cut so the last frame resembles the first for a clean loop.
- Command (run from a terminal; input.mkv in, out.gif out; START and DURATION in seconds):
  ffmpeg -ss START -t DURATION -i input.mkv -vf "fps=15,scale=640:-1:flags=neighbor,split[a][b];[a]palettegen=max_colors=64[p];[b][p]paletteuse=dither=none" out.gif
- Keep an audio take of each moment for the 9:16 short-form versions (TikTok, Shorts, Reels).

### GIF 1 — Burn chain
- Level: the level with the best fire (L10 Inferno likely; confirm).
- Moment: molotov lands, flames spread, zombies ignite in sequence, flames fade.
- Duration: 4 s. 640 px.
- Caption: "Fire solves most problems. Ask the zombies."
- Platform: r/IndieGaming (GIF, link in comment); vertical cut with sound to TikTok, Shorts, Reels.

### GIF 2 — Overrun
- Level: L01 horde 2, or wherever Overrun triggers (confirm).
- Moment: screen fills with zombies, runners first, brute behind.
- Duration: 5 s. 640 px.
- Caption: "Level one has two hordes. This is the second."
- Platform: X and Bluesky with #screenshotsaturday #pixelart #indiedev; r/PixelArt as an art-led post only if the frame composition holds up.

### GIF 3 — Boss
- Level: the boss encounter (level to confirm).
- Moment: boss enters, first hit lands, player backs off.
- Duration: 5 s. 640 px.
- Caption: "Something big is walking this way."
- Platform: r/roguelites and r/playmygame; Newgrounds devlog.

### GIF 4 — Blood moon
- Level: the level or mode with the blood moon (confirm).
- Moment: sky shifts red, zombie count jumps, player keeps firing.
- Duration: 4 s. 640 px.
- Caption: "Then the moon turned red."
- Platform: r/zombies and r/WebGames; Instagram Reels cut.

### GIF 5 — Kill chain
- Level: L01 horde 2 (or any level where the counter reads clearly).
- Moment: chain counter climbs while the player clears a pack. Counter in frame throughout.
- Duration: 6 s. 640 px.
- Caption: "Don't stop shooting. The chain doesn't wait."
- Platform: X and Bluesky; r/WebGames (pair with the Nightly Run result line, per launch-plan.md).

### GIF 6 — Last-second van escape
- Level: L01 exit sequence (or the first level where the van appears; confirm).
- Moment: exit opens, player sprints for the van, doors close with zombies one step behind.
- Duration: 5 s. 640 px.
- Caption: "Two hordes down. One door left."
- Platform: Discord #showcase and the itch.io page header; Shorts cut.

Also needed from the same session: 6 clean 16:9 screenshots (no HUD clutter, one per distinct look: Silent Ruins, Flooded, Blackout, Blizzard, Infested, Inferno). Poki asks for 3 at submission.

---

## What to measure
- Trailer: link clicks per 100 views, using ?utm_source=youtube&utm_medium=trailer on the URL. GA4 is already wired in (opt-in), so watch sessions from that source. Goal: 100 trailer-sourced plays in week 1.
- GIFs: upvotes and comment-link clicks per post, tagged with utm_source=reddit / x / bluesky / discord. Goal: at least one GIF over 50 upvotes. The winner becomes the itch.io header.
- Rank by clicks per 100 views, then reuse the winning angle for the next post.
- Deadline: assets filmed and edited within the "This week" window in launch-plan.md; first posts in weeks 2-3.

## Open items for the Commander
1. Approve before anything is posted. Nothing has been published.
2. Provide or create a save with all 10 levels unlocked.
3. Confirm where molotov, Overrun, boss, blood moon, kill chain and the van escape live, and correct the Level fields above.
4. Capture is manual (OBS). I can write the shot list into a one-page filming checklist if that helps.
