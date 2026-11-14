# Copy audit: Undead of Night: Take One

Audited 2026-11-07. Read only; no source was edited. Every "Current text" cell below was copied from the file named in the Where column.

## What was read, and what was not

Read in full: `src/game/how-to-play.ts` (all 21 sections), `src/game/credits.ts`, `src/game/title-menu.ts`, `src/game/style-select-view.ts`, `src/game/mode-select-view.ts`, `src/game/magazine-pages.ts` (cover, letter and tip text), `README.md`, `docs/README.md`, `LICENSE` (first 3,000 of 15,052 characters), `package.json`, `metadata.json`.

Read, but they hold no words: `HowToPlay.vue` and `CreditsScreen.vue`. HowToPlay.vue hands everything to the magazine builder. CreditsScreen.vue reads its lines from `credits.ts`. The only literal strings in them are the aria-label "How to Play", the aria-label "Credits" and the button "Skip".

Not read, so not audited: `src/game/magazine-hints.ts` (the kickers, decks and cover lines that print on every chapter), `src/game/privacy-text.ts`, `src/game/changelog.ts`, the title screen's credit line, the Options text, the HUD banners and the in-game ending text. Treat those as a second pass. `docs/README.md` already says the Privacy wording "has not been reviewed by anyone qualified"; that is a legal question, not a copy one.

## Vocabulary decisions needed first

Many rows below depend on these. Suggested vocabulary, which the Commander can overrule:

| Word | Should mean | Where it is used wrongly today |
| :--- | :--- | :--- |
| Style | Campaign or Arcade | Fine in the UI and in How to Play. |
| Mode | Solo or Multiplayer only. `docs/README.md` says so itself. | "Difficulty modes" (How to Play chapter title and docs: "Difficulty has four modes"). "In home mode" (docs, van ride) means Campaign. |
| Difficulty | The four settings | Called "modes" in two places. |
| Co-op | Describes playing together, lower-case in prose | The menu button is **Multiplayer**. The docs and the How to Play chapter tell the player to "choose Co-op", which is not a button. |
| Workbench | The gun-upgrade station | Called "the bench", "the workbench" and "Van bench" interchangeably. |
| Home Loop | Internal design name only | Never show it to players. Docs use it as a synonym for Campaign. |

## A. Credits and licensing (the most serious findings)

| # | Where | Current text | Problem | Replacement |
| :-- | :--- | :--- | :--- | :--- |
| A1 | `README.md` last line vs `src/game/credits.ts` line 15 and `docs/README.md` Audio bullet | README: "Music by ExoticService." Credits roll: `{ kind: 'name', text: 'Majora D.' }` under "Music by". Docs: "all by Majora D." | The two files credit different people for the same music. One of them is wrong, or the same artist goes by two names. I cannot tell which from the repo. | **Commander to confirm the correct credit.** Then use that one name in both places. If one person has two names, write it once: "Music by Majora D. (also ExoticService)". |
| A2 | `README.md` last line | "Music by ExoticService. Licensed under the True Omni-Source License (TOSL) 1.0; see [LICENSE](LICENSE)." | In one sentence it reads as if the music is licensed under the TOSL. The TOSL's copyright holder is Hall of the Gods, Inc. The music is credited to someone else. Nothing in the repo says what licence or permission covers the tracks. | Split into two statements. Code and game: "Copyright Hall of the Gods, Inc. Licensed under the True Omni-Source License (TOSL) 1.0; see [LICENSE](LICENSE)." Music: "Music by [CONFIRM NAME], used under [CONFIRM LICENCE OR PERMISSION]." Do not ship the second line until it is filled in. |
| A3 | `LICENSE` header | "Applied to: This Repository (Xophz-COMPASS), YouMeOS & The Compass Suite" | This repo is the `zombie-survival` submodule. The licence names the monorepo, not the game. That is probably intended, but a reader of the game repo cannot tell. | Add to the README: "This game is part of Xophz-COMPASS and is covered by the licence in LICENSE." Leave LICENSE itself to the Commander. |
| A4 | `package.json` | No `license` field. Verified: the file was read in full and has none. | Package tools and licence scanners report this repo as unlicensed. | Add `"license": "SEE LICENSE IN LICENSE"`, the npm convention for a custom licence. That is a source edit, so it is not made here. |
| A5 | `src/game/credits.ts` | `title`, `studio`, "Music by", "Starring" (Night, Bear, Kat, Rex, Kai), "Thanks for surviving the night" | The roll credits only the studio, one musician and the cast. It has no line for design, code, art or sound effects. `docs/README.md` says every sprite is built in code and every sound effect is synthesised, so those makers go unmentioned. It also has no third-party notices. | Add role and name pairs for the people who made the game. I will not invent names. Template: `role: 'Game design and code by'`, then `name: '[CONFIRM]'`. Add `role: 'Art and sound effects by'`, then `name: '[CONFIRM]'`. |
| A6 | Third-party notices (no file exists) | none | The game bundles the Silkscreen font. `node_modules/@fontsource/silkscreen/LICENSE` says: "Copyright 2001 The Silkscreen Project Authors … licensed under the SIL Open Font License, Version 1.1." The licence text travels with the npm package, but I did not check that a production build copies it into `dist/`. | Add a short "Third-party" line to the README: "Font: Silkscreen, SIL Open Font License 1.1 (The Silkscreen Project Authors). Built with Vue, Vite and Lucide icons." Check that `dist/` carries the OFL text. Lucide's licence I did not open. Verify it before naming it. |
| A7 | Player-facing: `TITLE_MENU` in `title-menu.ts` | Menu items: Play, Nightly Run, Levels, How to Play, Records, Sound Test, Options. No Credits. | The only way to see credits is to win the game (`docs/README.md`: a won run plays Victory, then `CreditsScreen`). A player who never finishes can never see who made the music. | Add a Credits page, or a Credits link on Options or Sound Test. Sound Test already lists track names, so it is the natural place to show the artist next to each one. |
| A8 | `docs/README.md` Audio bullet | "Music is recorded tracks, all by Majora D., in `public/music/` (128-192 kbps MP3)" | `public/music/` holds 48 `.mp3` files and no `.ogg` (checked by listing). If tracks move to OGG, this sentence, the "128-192 kbps MP3" figure, the service-worker music notes and the credit all need updating. | After conversion: "Music is recorded tracks, all by [CONFIRM NAME], in `public/music/` (Ogg Vorbis, [bitrate])." Credit every new track's author when new music is added. |
| A9 | Track names (`public/music/` file names, shown in Sound Test and the Jukebox) | e.g. `level-02-catacombs-of-anubis`, `level-03-chamber-of-mummies`, `level-07-swarm-of-the-scarabs`, `level-06-underground-temple` | Tomb and mummy titles sit on levels that `docs/README.md` describes as an overgrown suburb (2), scrapland (3), a cordon (7) and pinewood (6). A player reading the Sound Test sees names that do not match the towns. I did not read `playlists.ts`, so I do not know which titles are displayed. | Decide whether titles are meant to be flavour. If not, rename the displayed titles to match each biome. |

## B. Player-visible copy: Play flow and title screen

Ordered by how soon a new player meets them.

| # | Where | Current text | Problem | Replacement |
| :-- | :--- | :--- | :--- | :--- |
| B1 | `style-select-view.ts` Arcade card | "Ten levels in a row with a workbench in the van. The game as it always was." | "As it always was" means nothing to a new player. | "Ten levels in a row with a workbench in the van. Die and the run is over." |
| B2 | `style-select-view.ts` Campaign facts | `Dying: Lose your haul` | The Dying chapter says you lose everything carried and everything taken out of the locker, "guns and upgrades included". "Haul" suggests only loot. | `Dying: Lose what you carried` |
| B3 | `style-select-view.ts` Campaign facts | `Saves: Gear and gold` | The Treasure and Merchants chapters say you earn and spend **silver**. Gold appears only as "100 silver make 1 gold", and nothing says what gold buys. See D26. | Use the currency the player actually spends. If silver: `Saves: Gear and silver`. |
| B4 | `style-select-view.ts` Arcade facts | `Between: Van bench` | Three names for one station (see the vocabulary table). | `Between: Workbench` |
| B5 | `mode-select-view.ts` Solo card | "Just you and the night. Pick up where you left off." | The Continue fact on the same card reads `Arcade only` in Campaign, so "pick up where you left off" is half true. Campaign resumes from the bunker, with no Continue button. | "Just you and the night. Your save is waiting." |
| B6 | `mode-select-view.ts` Multiplayer card | "Up to ${MAX_PLAYERS} survivors in one room, joined by an invite link." | The setup page also offers `Join`, `Host room` and `Find a team` (`COOP_LABELS` in `title-menu.ts`), so the invite link is one way in, not the way. | "Up to ${MAX_PLAYERS} survivors in one room. Join with a link or code, host your own, or find a team." The exact join options should be checked against the live setup page. |
| B7 | `title-menu.ts` Controls list | `['Shift', 'Hold to sprint, loud and it tires you out']` and `['F / Right', 'Shove & Stab, makes no noise']` | "Shove & Stab" is only the name once you hold a knife. Before that the action is a plain shove (D5). "F / Right" is unclear. | `['F / Right click', 'Shove. With a knife: Shove & Stab. Silent.']` |
| B8 | `title-menu.ts` `LEVELS_PAGE_NOTE` | "Arcade levels: pick one you have reached to start there. Campaign picks its level at the garage map." | Correct. Leave it as the model for the other style notes. | No change. |

## C. Player-visible copy: Credits and magazine frame

| # | Where | Current text | Problem | Replacement |
| :-- | :--- | :--- | :--- | :--- |
| C1 | `credits.ts` | `'Majora D.'` | A bare initial gives the player nothing to look up. Resolved with A1. | Full credit as the artist wants it, with a link if allowed. |
| C2 | `credits.ts` | `{ kind: 'role', text: 'Starring' }` then Night, Bear, Kat, Rex, Kai | "Night" is both a survivor and the setting ("Survive the night", the "Night Light On" difficulty). On the roll it reads as a theme word. | Leave the roll as is. In How to Play, label the survivor (see D17). |
| C3 | `magazine-pages.ts` | `MAGAZINE_STRAP`: "The Town Survival Bureau's official survival manual and travel guide" | Reads fine. It repeats "survival", and "Bureau" is capitalised the same way on the letter's signature. | No change needed. |
| C4 | `magazine-pages.ts` | `MAGAZINE_ISSUE`: "Vol. 10: Take One Edition" | Fine. It matches the ten levels. Note that adding a level would make "Vol. 10" wrong. | No change. |
| C5 | `magazine-pages.ts` tip | "Prev and Next turn the page, and so do the arrow keys. On a touch screen, swipe." | Fine. | No change. |

## D. How to Play chapters (`src/game/how-to-play.ts`)

Chapter order is the printed order. Exact text copied; chapter ids in brackets.

| # | Chapter | Current text | Problem | Replacement |
| :-- | :--- | :--- | :--- | :--- |
| D1 | Difficulty [difficulty] | title: "Difficulty modes" | "Mode" is reserved for Solo/Multiplayer. | title: "Difficulty" |
| D2 | Controls [controls] | "WASD: move. Shift: sprint. C: sneak." | Three keys in one point. `splitLead` in `magazine-pages.ts` splits at the first colon, so only WASD prints as a keycap. Also: "hold" is missing. | Three points: "WASD: move." / "Shift (hold): sprint." / "C (hold): sneak." |
| D3 | Controls | "R: reload. 1 2 3 or Q: switch weapon." | Also two keys in one point, and "1 2 3 or Q" is ambiguous. | "R: reload." / "1, 2, 3 or Q: switch weapon." / "Mouse wheel: cycle weapons." (The wheel is documented in `docs/README.md` but missing here.) |
| D4 | Controls | "H: use a medkit. G: throw a bottle at the crosshair. T: a molotov. V: a flare. X: eat a candy." | "T: a molotov. V: a flare." are fragments, and five keys share one point. | "H: use a medkit." / "G: throw a bottle at the crosshair." / "T: throw a molotov." / "V: throw a flare." / "X: eat a candy." |
| D5 | Controls | "F or right click: Shove & Stab." | You cannot stab without a knife (chapter [melee]). | "F or right click: shove. With a knife, shove and stab." |
| D6 | Controls | "Tab or N: map. M: mute. Esc: pause." | `L` (run log) is in `docs/README.md` and not here. | Add "L: run log." Keep map, mute and pause as separate points. |
| D7 | Controls | "The buttons along the edge do the rest. Hold Search." | "Hold Search" is unclear. | "The buttons along the edge do the rest. Hold the Search button to search." |
| D8 | Controls | "Bottles, molotovs, flares and candy get their own buttons beside the bar while you carry them." | "The bar" is unnamed. | Name it (the weapon bar or the HUD bar). I did not read the HUD to confirm. |
| D9 | Controls and Supplies | "J, K, L or a tap" (keepsake choice, in [supplies]) | J, K, L appear nowhere in Controls. | Add "J, K, L: pick a keepsake" to Controls, or leave them out of the sentence. |
| D10 | Noise [noise] | "Sneaking is slow, but zombies spot you from much closer." | Reads as if sneaking makes you easier to see. | "Sneaking is slow, but zombies only spot you from much closer." |
| D11 | Noise | "Stay quiet and let them wander past." | It sits in the middle of the flare and supply-drop points. | Move it to follow the sneaking point. |
| D12 | Noise | "…a supply crate comes down on it: ammo, a medkit, a round kit and something better." | "Something better" is vague. `docs/README.md` says it is a large jewel in Campaign or a gun part in Arcade. | "…ammo, a medkit, a round kit, and a large jewel (Campaign) or a gun part (Arcade)." |
| D13 | Supplies [supplies] | "It is Halloween: houses and apartments hide the most candy." | A fixed claim. `shared/candy.ts` says "Candy is a Halloween night's loot", so it looks like fiction, not a date check. I did not find a calendar condition in the matches I saw, but the search stopped at its time budget. | If candy is year-round: "It is a Halloween night: houses and apartments hide the most candy." If it is seasonal, this must change with the season. **Commander or dev to confirm.** |
| D14 | Supplies | "Sour Skulls reload twice as fast. … A Jawbreaker halves damage. … Witch\'s Brittle heals 2 a kill." (11 candies in one point) | One very long point. "Halves damage" does not say whose damage. "Heals 2 a kill" is clipped. "Pumpkin Fizz runs a quarter faster" has no subject. "Bat Bites pierce" has no object. | Give each candy its own line. Fixes: "Jawbreaker: halves the damage you take." "Witch's Brittle: heals 2 health per kill." "Pumpkin Fizz: you run a quarter faster." "Bat Bites: your shots pierce." |
| D15 | Supplies | "…you choose one of three keepsakes (J, K, L or a tap), yours for the rest of the run: a Lucky Rabbit's Foot, Worn Sneakers, a Bandolier, a Rosary, a Pocket Lighter, an Old Watch, a Trick-or-Treat Bag or Dog Tags." | It says "one of three" and then lists eight. The reader cannot tell the eight are the whole pool. | "Reaching towns 3, 5, 7 and 9, you are offered three keepsakes (J, K, L or a tap) and keep one for the rest of the run. Any of these can turn up: …" |
| D16 | Searching [searching] | "Downtown, a town may still have S.O.S. Discount, a cheap-goods store its survivors stripped for supplies. Check the back room." | "Its survivors stripped" is unclear. The sentence opens on "Downtown" with no reason. | "Some towns have S.O.S. Discount downtown, a cheap-goods store survivors have already stripped. Check the back room." |
| D17 | Survivors [survivors] | "Night: harder for zombies to see." | Night is also the setting (see C2). | "Night (the survivor): harder for zombies to see." |
| D18 | Hordes [hordes] | "Zombies roam the town and notice by sight and sound." | Missing "you". | "Zombies roam the town and notice you by sight and sound." |
| D19 | Bunker [bunker] | "Campaign starts in your bunker. It is safe: no zombies, and guns cannot fire." | Contradicted by the Overrun chapter, now live (`docs/README.md`: live since 2026-11-07): "The bunker is not safe for long… a horde comes in." | "Campaign starts in your bunker. It is safe at first: no zombies, and guns cannot fire. (See The overrun for when that ends.)" |
| D20 | Bunker | "The garage map picks the level to go to, as far as your room has reached." | "Your room" is confusing. In solo there is no other room. | "The garage map picks which level to visit, up to the furthest you have reached." |
| D21 | Bunker | "Walking in heals you to full." | Unclear what you are walking into. | "Walking into the bunker heals you to full." |
| D22 | Bunker | "The bunker is saved in this browser." | The save is tied to this browser and can be lost. I have not confirmed the storage type; the keys are named `outbreak.*`, which suggests browser storage. | "The bunker is saved in this browser only. Clearing site data erases it." Confirm before adding. |
| D23 | Bunker, Forge, Workbench | "the bench", "the bench next to it", "Workbench" | See the vocabulary table. | "workbench" throughout. |
| D24 | Trips [trips] | "Everything you hold when you reach the van comes home, up to the carry caps." | "Carry caps" are never stated. | State them, or say "up to the limit shown on the HUD". The numbers are not in the files I read. |
| D25 | Trips | "Records keeps your best trip." | Reads like a stray noun. | "The Records page keeps your best trip." |
| D26 | Treasure [treasure] | "100 silver make 1 gold. Silver comes from the forge, quest rewards and the overrun chest." | Gold is never given a use (see B3). | Add what gold buys, or drop gold from the page. Grammar: "100 silver makes 1 gold." |
| D27 | Forge [forge] | "Smelting takes three seconds a jewel" | | "three seconds per jewel" |
| D28 | Rounds [rounds] | "A gun with a special round does less direct damage, so no build passes the power cap." | "Power cap" is not defined anywhere in player text. | "…so no build can out-damage the cap (1.5 times stock damage per second)." |
| D29 | Rounds, Overrun | "most of all on brutes" | "Brute" is never introduced. Boss nights (levels 3, 6, 9: Howler, Mother, Butcher), night events (fog, blood moon, power cut), kill chains and the Nightly Run are all in `docs/README.md` and missing from How to Play. | Add a short zombie-types chapter and a "Special nights" chapter. Say what a brute is the first time it appears. |
| D30 | Difficulty | "Night Light On: plenty of ammo, slow weak zombies, small hordes." / "Stay Close: more ammo, slightly slower zombies, smaller hordes." / "Lights Out: the game as it was built." | "More" and "smaller" have no baseline. The default (Stay Close, per `docs/README.md`) is not marked. | Compare to Lights Out, the balance the game was tuned on. "Stay Close (default): more ammo than Lights Out, slightly slower zombies, smaller hordes." "Lights Out: the balance the game was tuned on." |
| D31 | Co-op [coop] | "Press Play, choose a style, pick Multiplayer, enter a server address, then press Next until Join. An invite link skips the style." | Out of step with the setup page, which has `Join`, `Host room` and `Find a team`. `mode-select-view.ts` also says that with online rooms live, a host's tab is the room and no server is needed. | Rewrite after checking the live setup page. The repo does not tell me whether online rooms are on. |
| D32 | Styles [styles] and Co-op | "…the first player into an empty room chooses its style…" / "The first player into a room sets its difficulty and its style." | "Chooses" and "sets" for the same act. | Use "sets" in both. |
| D33 | Chapter count (`docs/README.md` How to Play bullet) | "Twenty chapters share the thirteen page layouts" and "six on Campaign (bunker, trips, treasure, forge, merchants, dying)" | Counted from `HOW_TO_SECTIONS`: **21** chapters and **seven** Campaign chapters (the overrun is the seventh). The Overrun bullet in the same file even says "How to Play has a chapter on it". | "Twenty-one chapters… seven on Campaign (bunker, trips, treasure, forge, merchants, dying, the overrun)". The layout count of thirteen I did not check. |

## E. README.md

| # | Current text | Problem | Replacement |
| :-- | :--- | :--- | :--- |
| E1 | "A top-down pixel art zombie survival game across ten levels at night." | Leaves out Campaign. A Campaign player does not play "ten levels" in a row. | "…Play it two ways: Campaign, where you live in a bunker and go out on trips, or Arcade, ten levels in a row." |
| E2 | "Multiplayer needs the game server, which GitHub Pages cannot host. Run it yourself to play together; see [docs/README.md]" | May be stale. `mode-select-view.ts` says that with online rooms a host's tab is the room and no server is needed. The repo has a `play-api` folder. | Confirm whether online rooms are live, then rewrite. |
| E3 | `pnpm test # the test suite` | `docs/README.md` runs the same checks as `chemx test` and `chemx typecheck`. | One command set. `package.json` has `test`, `typecheck` and `lint`, so pnpm works. |
| E4 | "Music by ExoticService. Licensed under…" | See A1 and A2. | See A1 and A2. |
| E5 | Whole file | No mention of: Campaign vs Arcade, credits, third-party notices, or what `dist/` and `play-api/` are. | Add a "Credits and licences" section (see A2, A3, A6). |

## F. docs/README.md (developer docs)

| # | Current text | Problem | Replacement |
| :-- | :--- | :--- | :--- |
| F1 | "The finds are saved apart from the level progress (`src/game/sound-unlock.ts`), survives reloads and old saves" | Grammar. | "…survive reloads and old saves" |
| F2 | "4. Open `http://localhost:8096` … Choose Solo, or enter the server address and choose Co-op in each browser window." | There is no "Co-op" button; the menu says Multiplayer. | "…choose Multiplayer in each browser window." |
| F3 | "Difficulty has four modes" | See the vocabulary table. | "Difficulty has four settings" |
| F4 | "in home mode, leaving the bunker…" | "Home mode" is not a player term. | "in Campaign, leaving the bunker…" |

## Suggested order of work

1. Settle A1 (whose music) and A2 (its licence). Nothing else on credits can be finished until then.
2. Make the vocabulary decisions in the table near the top.
3. Fix D19 (the bunker "is safe" line), D5, D15 and D30. These mislead a player today.
4. Make the wording fixes in B and D, then update the README and the docs.
5. Second pass on the unread files named at the top.

## Not verifiable from the files I could read

- Whether candy is tied to the calendar (D13).
- Whether online rooms are live, which decides E2 and D31.
- What the carry caps are (D24).
- Which music titles the Sound Test actually displays (A9).
- That the production build ships the OFL text (A6).
