# Undead of Night: Community Plan

Written 2026-11-07. This covers the "Discord server plus a Feedback link in the game" item from the November checklist in `docs/launch-plan.md`. It has three parts: the Discord server, the in-game Feedback link, and a draft of player-facing release notes.

Open items the Commander must supply (marked TODO below): the Discord invite URL, who the moderators are, and the final server name.

---

## 1. Discord server

### Purpose

The launch plan calls Discord the cheapest place to learn what players want, and the community that later turns into Steam wishlists. So the server is built around two jobs: collect feedback and bugs, and give people a reason to come back (Daily Night results, clips, co-op partners).

Co-op is invite-only with no matchmaking, so a "find a partner" channel is a real need, not decoration.

### Server basics

- **Name:** Undead of Night (TODO: confirm).
- **Invite:** one permanent public invite with no expiry (TODO: create it and put the URL in `FEEDBACK_URL`, see section 2).
- **Verification level:** Medium (verified email, account older than 5 minutes). This blocks the cheapest spam without making players jump through hoops.
- **Default notifications:** Only @mentions, so nobody mutes the server on day one.
- **Roles (kept small):**
  - `Commander` (owner, admin)
  - `Mod` (kick, timeout, delete messages; TODO: name people)
  - `Survivor` (default, given on rules acceptance)
  - `Tester` (opt-in, pinged for build tests and playtests)
  - `Stamp Collector` (hand-given for notable stamps; optional, add later)

### Channel list

**START HERE**

| Channel | Type | Who posts | What it is for |
| --- | --- | --- | --- |
| #welcome | Read-only | Mods | One-screen intro: what the game is, the play link, how to give feedback, link to rules. |
| #rules | Read-only | Mods | Short rules (below). Reacting accepts them and grants Survivor. |
| #announcements | Read-only, followable | Commander | Releases, patch notes, events. |
| #roles | Read-only | Bot or mods | Opt in to Tester and ping roles. |

**FEEDBACK** (the point of the server)

| Channel | Type | What it is for |
| --- | --- | --- |
| #feedback | Forum or text | Ideas, balance, "this felt bad". One thread per topic. Pinned post: what is most useful to say. |
| #bugs | Forum | Bug reports, with a pinned template (below). Tags: Open, Confirmed, Fixed, Can't Reproduce. |
| #suggestions-voting | Text | Mods repost the best ideas; players vote with reactions. Add once #feedback gets busy. |

**PLAY**

| Channel | Type | What it is for |
| --- | --- | --- |
| #daily-night | Text | Paste the Copy result line from the Daily Night page or results screen. Everyone gets the same town on the same day, so compare scores and routes. Spoilers about the day's town go in threads. |
| #find-a-partner | Text | Players trade co-op codes ("play with a friend by code"). Post time zone and difficulty. See safety notes. |
| #strategy | Text | Boss tricks, keepsake picks, candy combos, night events. |
| #clips-and-screens | Media | Highlights, burn chains, close calls. Feeds the GIF library for socials (ask permission before reuse). |

**HANGOUT**

| Channel | Type | What it is for |
| --- | --- | --- |
| #general | Text | Everything else. |
| #off-topic | Text | Other games and non-game talk. |
| #fan-art | Media | Art. Credit stays with the artist. |

**TEAM** (private to Commander and mods)

| Channel | What it is for |
| --- | --- |
| #mod-log | Moderation notes and bot logs. |
| #triage | Where bug and feedback threads get sorted before the Commander looks. |

Launch with fewer channels if the server is empty: #welcome, #rules, #announcements, #feedback, #bugs, #daily-night, #find-a-partner, #general. Add the rest as traffic shows up. An empty server with 15 channels looks dead.

### Rules (draft, keep to six)

1. Be decent. No harassment, hate or slurs.
2. No spam, and no self-promotion outside a designated channel (TODO: decide whether to allow a #self-promo channel; default is no).
3. Spoilers for bosses and night events go in threads or spoiler tags.
4. Report bugs and ideas in the right channel with details.
5. No cheating tools, shared exploits for leaderboards, or pirated copies.
6. Don't share personal information, yours or anyone else's.

### Bug report template (pin in #bugs)

```
What happened:
What you expected:
Steps to repeat it:
Style (Campaign or Arcade), solo or co-op, level / town:
Device and browser:
Version (click the version number in the title screen corner):
Screenshot or clip, if you have one:
```

The version line works because the version number on the title screen opens the What's New book, so players can read it off the game.

### Bots

- A moderation/anti-raid bot (any mainstream one).
- Optional: a reaction-role bot for the Tester role.
- Do not wire the game to Discord (rich presence, webhooks of player data) until there is a privacy review. GA4 is already opt-in behind a consent prompt; Discord should not become a back door around that.

### Moderation and safety

- At least two mods before the public launch posts go out (TODO: name them).
- Enable Discord's automod for slurs and mass mentions on day one.
- Co-op invites are between players who choose to share a code. Do not pair strangers with a bot. Pin a line in #find-a-partner saying the game does not verify ages and that chat there is moderated.
- Keep a pinned link to the game's privacy page.

### First-week rhythm

| When | Action |
| --- | --- |
| Launch | Pin #welcome. Post the play link and the first release notes (section 3) in #announcements. |
| Daily | One mod checks #bugs and tags new threads. The Daily Night thread is made by hand until a bot does it. |
| Weekly | Commander posts what changed and answers the top three feedback threads. Saturday: #screenshotsaturday clips reposted from #clips-and-screens (with permission). |
| After two weeks | Review which channels have traffic; merge the dead ones. |

### Measuring it

Track weekly: members joined, feedback threads opened, bugs confirmed and fixed, and clicks from the in-game Feedback link (via the analytics event in section 2). Member count alone says little.

---

## 2. In-game Feedback link spec

### Goal

One obvious, low-friction way for a player to tell us something while the game is fresh in their mind, without leaving a half-played run.

### Where it goes

Two places, per the launch plan ("title screen and the results screen"):

1. **Title screen.** A text link labelled **Feedback** in the secondary row near the version number in the screen's corner (the version number is what opens What's New, so players already look there). It must not compete with the main menu items or the Install Game cartridge in the second column. Component: `src/components/TitleScreen.vue`. (TODO: confirm exact placement against the current layout before building; the title layout changed on 2026-11-07.)
2. **Results screen** (after a run, including a Daily Night run). A secondary link **Tell us how it went**, below the primary actions, beside the Copy result button when that is shown. It must not displace Play again or Main menu.

Not on the HUD. The run log sits bottom-right and the gun bar bottom centre, and nothing should invite a player to leave mid-fight.

Optional later: a line at the end of the What's New book ("Got a thought? Tell us in Discord").

### What it opens

- **Target:** the Discord invite URL (TODO: from section 1), opened in a **new tab** (`target="_blank"` with `rel="noopener noreferrer"`), so the game and any co-op connection stay alive.
- Never replaces the current page. In the installed PWA and on touch devices the link should still open outside the game surface.
- Keep the URL in one constant (for example `FEEDBACK_URL` in a small shared config module) so changing the destination, or switching to a form later, is one edit.
- A Discord invite ignores query strings, so do not rely on UTM tags. Count clicks with an analytics event instead.

### Behaviour and rules

- **No data sent to Discord.** The link is a plain URL. Do not pass player ids, scores, seeds or session data.
- **Analytics.** If the player accepted GA4 consent, log a `feedback_click` event with a `source` parameter (`title` or `results`). If not, log nothing.
- **Keyboard and controller.** Reachable by tab and, once gamepad support lands, by gamepad focus. Visible focus state. Accessible name: "Feedback, opens Discord in a new tab".
- **Touch.** Tap target at least 44 px.
- **Styling.** Match the title screen. No pulsing, no badge.
- **Portal builds (later).** CrazyGames and Poki restrict outside links and outside requests. Their builds must hide the link behind a build flag. Check each portal's current guidelines before submitting.
- **Copy.** Plain text, no emoji. Title: "Feedback". Results: "Tell us how it went".

### Acceptance checks

1. Title screen shows Feedback; clicking it opens the invite in a new tab and the game stays on the title screen.
2. Results screens after a Campaign run, an Arcade run and a Daily Night run each show the link; Play again and Main menu still work and remain the primary actions.
3. With analytics consent declined, no `feedback_click` is sent; with consent, one event with the right `source`.
4. Reachable by keyboard; on a phone-sized screen it is tappable and does not overlap the Install Game cartridge.
5. With the portal build flag on, the link is absent.
6. Playwright coverage in `tests/` for checks 1, 2 and 5.

### Out of scope

An in-game text box that posts to a server, attached screenshots, and a bug form. Consider these after Discord shows what players actually say.

---

## 3. Release notes draft (player-facing)

A draft for #announcements and the itch.io devlog, summarising the changelog entries dated 2026-11-06 and 2026-11-07 in plain language. Code names, file paths and event names are left out. Players can also read the same notes in the game: click the version number on the title screen to open What's New.

Check each claim against the build that actually ships before posting. This draft was written from the changelog text, not by playing the build.

---

### Undead of Night: Last Round, the November update

Thanks for playing, and for telling us what you think. The community server is open. Use the Feedback link on the title screen or the results screen, or find us at (TODO: Discord invite).

**New: Boss nights**
Levels 3, 6 and 9 end with a boss.
- **The Howler** (level 3) screams across the map and calls runners.
- **Mother** (level 6) gives birth to walkers.
- **The Butcher** (level 9) charges when you get too close.

The horde does not end while the boss stands. A boss health bar runs across the top of the screen. Bosses leave a medkit and a prize when they fall. They don't take headshots.

**New: Night events**
About three towns in ten, from level 2, have something going on.
- **Fog:** zombies spot you from much closer, and the town goes grey.
- **Blood moon:** hordes twice the size, and every kill is worth double.
- **Power cut:** most lamps die. Zombies see less far but hear further.

The level card tells you which one you've got, and the Daily Night page shows it too.

**New: Daily Night**
A new item on the title menu. Every player gets the same town on the same day. Your first run of the day counts; later runs are practice. Track your streak and your best night. When you finish, use **Copy result** to paste your day, level, points, kills and streak anywhere. Days are kept on your device.

**New: Stamps**
17 rubber-stamp achievements, from First Blood to Headhunter to clearing all ten towns. They live on two new pages at the back of the Record Book and are kept on your device.

**New: Candy and keepsakes**
- Twelve Halloween candies are hidden in houses and apartments. Carry two and eat with **X**. Each lasts 75 seconds and they don't stack. Sour Skulls double your reload speed, Ghost Gum makes sprinting silent, Caramel Apple is a one-time instant revive, and the rare Full-Size Bar boosts everything for 20 seconds.
- At towns 3, 5, 7 and 9, pick one of three keepsakes to keep for the run: Lucky Rabbit's Foot, Worn Sneakers, Bandolier, Rosary, Pocket Lighter, Old Watch, Trick-or-Treat Bag or Dog Tags. Click, tap, or press J, K, L.

**New: Molotovs, flares and supply drops**
- Search garages, warehouses, diners, the police station and cars for fuel and flares. **T** throws a molotov; **V** throws a flare that pulls zombies toward it for 20 seconds.
- Once a town, after the first horde, a red flare goes up and a supply crate lands ten seconds later with ammo, a medkit and a prize. It's loud, so the town comes too.

**New: Upstairs, cellars and back doors**
- Some houses have an upstairs or a cellar, and every apartment block has a second floor. Press the search key on the stairs to use them. Zombies use the stairs too.
- Houses, apartments and several shops now have a back door, so a crowd at the front is no longer a trap.

**New: The Overrun is live (Campaign)**
Back in the bunker, a clock is ticking. When it runs out, the blast door bursts and a horde comes in. Clear it for a reward chest. Run for the van and you lose merchants. Go down and you lose the gear in your hands. The clock length depends on difficulty. How to Play has a new chapter on it.

**Better: Kills feel better**
- Chain kills pay more: each kill within 1.4 seconds of the last is worth a quarter more, up to double.
- Callouts for DOUBLE, TRIPLE, QUAD and MASSACRE, CLOSE CALL for a kill at low health, and HORDE WIPED OUT when the last zombie falls. In solo, a short hit-stop adds weight to headshots, chain kills and brute kills. Reduced motion skips the screen flash.
- Blood moon hordes are now twice the size.

**Better: Campaign and Arcade**
Choose your style each run. **Campaign** is the bunker, trips, treasure, the forge and merchants. **Arcade** is ten levels in a row with the van workbench. Towns now drop jewels only; the forge turns them into silver.

**Better: World and interface**
- New biomes by level (pine, cactus, snow, ash, sludge, water), with ground that slows you and six different footsteps.
- A **run log** in the bottom-right corner. Press **L** or tap it to open the full log over the run.
- A **What's New** book, opened from the version number on the title screen.
- The Record Book is now a printed book with personal bests, a top-five ledger and your last seven Daily Nights.
- The Install Game button moved beside the main menu under the title.
- The gun bar moved to the bottom centre.

**Fixed**
- Furniture now stands flush against side walls, so no more gaps that looked like a way round but trapped you.
- Candy and keepsakes now work in online co-op.
- The van could park with a street lamp in the way of a waiting survivor.
- A batch of Campaign co-op fixes: leaving the bunker unready, quitting to the menu at the van, backing out of an invite, and closing the locker with Esc.

**Playing together**
Co-op is by invite code. Send your friend the link to **undeadofnight.forthexp.com** (not the github.io address) along with your code.

**Tell us what you think**
Bugs and ideas: Feedback on the title screen, or Discord (TODO: invite). Include your version number (click it on the title screen) and whether you were in Campaign or Arcade.

---

### Notes on this draft

- Only the first 24,000 of the changelog's roughly 42,000 characters were read for this draft. Entries older than the Campaign and Arcade entry are not summarised. If the Commander wants a full history for the itch.io page, read the rest first.
- The Overrun is described as live because the changelog says `OVERRUN_LIVE` is now true. Confirm that in the deployed build.
- Keep these notes in sync with `src/game/changelog.ts` (the source of the in-game What's New book) so the Discord post and the book don't disagree.

---

## 4. Checklist (to close the launch-plan item)

- [ ] Create the Discord server, roles and the launch channel set (section 1)
- [ ] Name at least two mods
- [ ] Create a permanent invite and record it as `FEEDBACK_URL`
- [ ] Build the Feedback link on the title screen and results screen (section 2)
- [ ] Add the `feedback_click` analytics event behind consent
- [ ] Add the portal-build flag that hides the link
- [ ] Publish the release notes (section 3) after checking each claim against the live build
- [ ] Pin the bug template and rules
- [ ] Review channels two weeks after launch
