# Polish plan: make it feel finished

Written 2026-11-09 against build v26.11.9-115 (main at `15758d3`). This is a review, not a build: nothing here is implemented yet. Pick items by number.

## How this was checked

Played the real build on the dev server with Playwright: the Press Any Key title, the main menu, Play > Daily Night, Play > Arcade setup, Level 1 (Silent Ruins) on Stay Close, the town map (Tab), the run log (L), pause, the candy bag, Horde 1 through to Game Over, and the Campaign bunker. Desktop at 1366x768 and an iPhone 13 held sideways. No console errors in any of it.

Not checked: real co-op (needs two clients), audio by ear (headless has no speakers), a real phone's touch feel, Safari, and anything past Horde 1. The bot aims badly, so treat difficulty notes as "worth a human look", not proof.

Older plans this builds on, so it does not repeat them: `docs/polish-backlog.md` (2026-11-07), `docs/playtest-2026-11-07.md`, `docs/launch-plan.md`, and the chemx fun, feel and launch backlogs in the project files.

---

## 1. What already feels great

- **The look.** The pixel art is the strongest thing in the game. The dripping logo with the moon, the burning barrels, the flashlight cone, the street lamps throwing warm pools: it reads as one confident style, not a pile of asset packs. The town map (Tab) is lovely, with coloured building types, names and a clear legend.
- **The new card screens.** Daily Night, Arcade setup and Level Select with the tall portrait cards look like a real console game's front end. The survivor busts (Night especially) have real personality.
- **Daily Night as the front door.** One fresh town for everyone, a streak, a "new town in 21h 47m" countdown and a tomorrow's-kit teaser. That is a proper reason to come back every day.
- **Depth under the hood.** Upstairs and cellars, schools and hospitals, leftovers marked on the map, candy with timers, fireworks, merchants, a bunker with quests and a forge. There is far more game here than a first screen suggests.
- **Juice that exists already.** Hit-stop, kill callouts, trauma shake, the damage vignette, a heartbeat, motion options. The combat-feel epic shipped.
- **Clean shell.** Press Any Key, a short three-item main menu, a What's New book, a version stamp, privacy link, no errors.

## 2. What feels rough

### The first 60 seconds
- Level 1 opens with **2:17 on the horde clock and nothing to do but walk**. I stood in the park for a minute and saw no zombie at all. New players decide in that minute; right now it is a quiet walk in the dark with a pistol.
- There is still **no first-run teaching** (the Nov 7 backlog item 6 was never built). Nothing says "hold E to search", "candy is in the bowls by front doors", or "the van comes after 2 hordes" at the moment it matters.
- Then **Horde 1 is a cliff**. Seven zombies arrived and the run was over in 19 seconds with 0 kills (the Nov 7 playtester saw the same: 80 HP gone in 6 s standing still). Going from nothing to death with no ramp is the single biggest "this isn't fun" risk.

### Readability
- **Zombies are dark blue on dark blue.** Outside a lamp or the cone, only the yellow eyes show. In the horde shot the three attackers are barely there.
- The bottom-left counters read **"0 H" and "1 G"**. Nobody knows that H is a medkit key and G a grenade key.
- The run log sits **halfway down the right edge as a dark box** over the world ("0:00 ONE TOWN / L: LOG"). It looks like a stray panel, and on a phone it takes a big bite of the screen.
- On the phone, the top-left town / horde / hordes-survived block is three lines of big capitals and covers about a sixth of the view.
- In the bunker the gun bar shouts a red **"0 / 0 EMPTY, F: SHOVE"** while you are safe at home.

### Feedback and juice
- **Game Over is small and flat.** A skull, five numbers in a tight row, Play Again and Main Menu. No cause of death, no "retry this level" as the big button (both are Nov 7 backlog items 3 and 4, still unbuilt), no "new best" moment, no tip.
- The horde arrival has no **build-up** you can see: no siren, no "10 seconds" warning, no screen-edge pulse. It just starts.
- No hit direction marker when something bites you from the dark.

### Audio
- **Biome ambience beds exist but are not hooked into gameplay** (`src/audio/sfx-ambience.ts` is only registered). The quiet first two minutes are exactly where crickets, wind, a distant dog and far-off groans would sell the night.
- **Music is too heavy to ship to portals**: `public/music` is 247 MB on disk, the OGG set alone 117 MB, against the 50 MB CrazyGames cap (20 MB mobile).

### Pacing
- 2+ minutes of lull before the first fight on Level 1, then a fight you lose in seconds. The curve wants a small early skirmish, a shorter first lull on Level 1 only, and a softer first horde.

### Onboarding
- How to Play and the Town Guide are good books, but they are menus you have to choose to read. The game itself teaches nothing in context.

### Consistency with the new menu style
- The card style (Daily, Arcade, Levels) is now the house look, but **Pause, Game Over, the candy bag and Options are still plain centred text** in the older style.
- The candy bag opened **on top of the level title card**, which showed through behind it ("ONE TOWN" ghosted over "CANDY BAG"). Overlays should clear banners first.
- Daily Night's cards are noticeably smaller than Arcade's, and the info under them is three dense lines of orange capitals.

### Phone
- The touch buttons are four **icon-only squares** (magnifier, backpack, sparkle, fast-forward). Without labels a new player has to guess. Xopher has asked for an **iOS-style pixel bottom nav bar with icon and label**, and that is now being built in its own thread.
- No visible movement stick until you touch; a faint ghost stick on the first run would help.
- Setup screens fit well sideways (the no-scroll rule holds).

### Known gaps (already tracked, listed so nothing is lost)
- Biome ambience unhooked (above).
- Gamepad: in-game twin-stick, confirm, back and pause work (`src/game/gamepad-input.ts`); moving focus between menu buttons, the "press any button" hint and on-screen pad prompts are not built (`docs/gamepad.md`).
- Music size over the 50 MB cap (above).
- Stat bars on the setup option cards: still an open call for Xopher (PR #52 kept them).

---

## 3. Ranked top 10

Effort: **S** about a day or less, **M** 2 to 4 days, **L** a week or more. Ranked by how much a stranger would notice it in their first five minutes, divided by effort.

| # | Change | Why | Effort |
|---|---|---|---|
| 1 | **A first fight within 20 seconds.** On Level 1 only: two or three slow shamblers placed near spawn, the first lull cut to about 60 s, and Horde 1 on Level 1 softened (fewer, staggered arrivals instead of seven at once). Daily Night and later levels unchanged. | Fixes the empty first minute and the Horde 1 cliff together. This is the biggest fun lever. Needs `OFF_PATH_DRAWS` re-recorded if town-gen rolls move. | M |
| 2 | **Contextual first-run hints**, shown once each: move/aim/fire at spawn, "Hold E" at the first container, candy bowls at the first front door, "the van comes after 2 hordes", and a 10 s horde warning. Touch wording on phones, pad glyphs on a pad, a "Reset hints" switch in Options. | The game teaches nothing in context today. Already specced as Nov 7 item 6. | M |
| 3 | **Zombies you can see.** A one-pixel dark-red or bone rim on zombies outside the light, plus the Brightness slider from Nov 7 item 5. | Dying to things you can't see feels unfair, not scary. | S–M |
| 4 | **Game Over that makes you press retry.** Bigger card-style panel; one line on what got you ("A runner from behind. 6 shots in the last 10 s."); "Try again from this town" as the big focused button on Enter; a "New best!" stamp; one rotating tip. | The moment after death decides whether there is a second run. Nov 7 items 3 and 4. | S–M |
| 5 | **Pixel bottom nav bar on phones**, icon plus label for each action (Xopher's call). Plus a ghost stick on the first run. | Labels remove the guessing. Already being built in its own thread; keep it on this list so the plan is complete. | M (in progress) |
| 6 | **The night sounds alive.** Hook the existing biome ambience beds into gameplay, ducked under music; add a horde siren or drum stinger 10 s before each horde with a screen-edge pulse. | The quiet lull becomes tension instead of dead air, and the horde gets a build-up. | S–M |
| 7 | **HUD tidy.** Medkit and grenade as icon + count + key glyph (no "H"/"G"); the run log docked to a corner and faded after a few seconds; the top-left block one line on phones; no red EMPTY warning in the bunker; a short red edge marker when bitten from off-screen. | Every frame of play looks cleaner. Mostly CSS and `hud-state.ts`. | S |
| 8 | **Card style on every overlay.** Pause, Game Over, the candy bag (an empty bag illustration instead of plain text) and Options in the same framed, portrait-card look as setup. Opening any overlay clears banners and title cards first. | Makes it look like one product. Fixes the candy bag drawing over the level card. | M |
| 9 | **Music under the cap.** Re-encode to 64–96 kbps OGG with MP3 fallback, load only the menu track and the current level's, everything else on demand. | Launch blocker for portals; also faster first load everywhere. | M |
| 10 | **Gamepad, finished.** Focus moves between buttons on every screen, a "press any button" hint on the title, and pad glyphs in hints and prompts (the `pad-glyphs.ts` set exists). | Needed for Steam Deck and Next Fest, and pads are the "real console game" feel. | M |

**Honourable mentions** (good, smaller, or later): kill-chain score multiplier and a shareable Daily result (fun backlog), a "Continue: Town N" line on the title, a photosensitivity note before the first blood moon, perk picks between hordes, and making the Daily cards the same size as Arcade's.

## If you only do three

Do **1, 2 and 4**. Together they turn the first five minutes into: a fight in 20 seconds, a nudge at each new thing, and a death screen that says why and puts retry under your thumb. That is the difference between "cool art" and "one more go".
