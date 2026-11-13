# Undead of Night: Launch & Promotion Plan

Written 2026-11-07. The living copy, which people edit and comment on, is the [Claude doc](https://claude.ai/artifact/1pWKT9yrTfWyq54t3UoHyr). The checklist at the bottom is also tracked as tasks on the chemx board.

## The right move now

Put the free web build on itch.io and Newgrounds within two weeks. Use the players you get there to tune the game, and open a Steam "Coming Soon" page early so wishlists start piling up before the Next Fest demo. Leave consoles until Steam sales or a publisher pay for the port.

1. **This week:** add gamepad support (there is none today), cut a 30-second trailer and 4 to 6 GIFs, and open a Discord with a feedback channel linked from the title screen.
2. **Weeks 2 and 3:** launch on itch.io and Newgrounds, then post GIFs to the Reddit and short-form channels listed below. Read the GA4 numbers that are already wired in, and fix the spots where players quit early.
3. **Weeks 3 to 6:** apply to CrazyGames or Poki, pay the $100 Steam Direct fee, wrap the game in Electron, and put the Steam page up as Coming Soon.
4. **Next 3 to 8 months:** grow wishlists, ship a Steam demo, and enter a Steam Next Fest. Release on Steam once wishlists reach a few thousand.
5. **After the Steam launch:** go to consoles through a publisher or porting studio. A browser game can't run on console hardware as it is.

## What the game needs before posting

Most of the base is already built. The game has GA4 analytics behind a consent prompt, touch controls, a PWA install, a privacy page, and a live build at [undeadofnight.forthexp.com](https://undeadofnight.forthexp.com/). Two gaps matter most: gamepad support, and the 131 MB of music.

| Item | Status today | What to do | Why it matters |
| --- | --- | --- | --- |
| Gamepad support | Missing (no Gamepad API in `src/`) | Map the twin-stick layout, menus and setup stepper to a controller. | Steam Deck, Big Picture mode and every console expect it. Couch co-op players expect it too. |
| Music size | 131 MB of MP3 in `public/music` | Load only the current level's track and the menu track. Re-encode to 96 kbps OGG/AAC, about a third of the size. | CrazyGames caps the initial download at 50 MB (20 MB for its mobile homepage) and the total at 250 MB. |
| Trailer | None | 30 to 45 seconds. Open on gameplay within 3 seconds, show a horde, a molotov burn and a kill chain, then the title and URL. | Every store page, portal and short-form post uses it. |
| GIFs and screenshots | Some screens in project files | 4 to 6 GIFs of 3 to 6 seconds each (burn chain, Overrun, boss, blood moon), plus 6 clean 16:9 screenshots. | Reddit and Bluesky posts live or die on the GIF. Poki asks for 3 screenshots when you submit. |
| Capsule art | None | Draw a logo and key art. Export at Steam's capsule sizes, plus an itch.io cover at 630x500. | This is the image people click on. It is worth paying an artist for. |
| Feedback channel | None | Start a Discord server with #feedback and #bugs channels. Add a "Feedback" link on the title screen and the results screen. | This is the cheapest place to find out what players want, and it becomes the community that wishlists later. |
| Analytics | GA4, opt-in | Add funnel events: title, setup done, level 1 cleared, first death, results. Watch where players drop out. | It shows which part to fix before the bigger launches. |
| Performance | Unknown on low-end hardware | Test on a 4 GB Chromebook and a mid-range phone in Safari. Hold 60 fps during a full horde. | CrazyGames may disable a game on low-RAM Chromebooks and on Safari. |
| Co-op URL | Play API only accepts undeadofnight.forthexp.com | Send everyone to that URL, not github.io. Make sure the custom domain is set in GitHub Pages. | Co-op will not connect from portal embeds unless the API also accepts those portals' addresses. |

Say "play with a friend by code" in every post. Co-op is invite-only, and there is no matchmaking with strangers yet.

## Where to post the web build

Start with itch.io and Newgrounds, because both take the build as it is. Then pick **either** CrazyGames **or** Poki. Poki requires web exclusivity: if it takes the game, you can't keep it on other web portals. Steam, app stores and consoles are not affected.

| Order | Channel | Effort | Notes |
| --- | --- | --- | --- |
| 1 | [itch.io](https://itch.io/docs/creators/html5) | 1 day | Free. Upload a ZIP with up to 1,000 files and 500 MB, and no single file over 200 MB, so the current build fits. Use the dark page theme, the GIFs and devlog posts. Tag it zombie, top-down, roguelite, co-op, pixel art. Enter a game jam or a Halloween/horror bundle for discovery. |
| 2 | Newgrounds | 1 day | Free. Players there love pixel horror and score chasing. Wire the Nightly Run score to their scoreboard API later. |
| 3 | Reddit | Ongoing | Make one post per subreddit, with a GIF first and the link in a comment, and follow each subreddit's self-promo rules. Good fits: r/WebGames, r/IndieGaming, r/playmygame, r/indiegames, r/roguelites, r/zombies, r/PixelArt (art-led posts). Post the Nightly Run result line to r/WebGames. |
| 4 | Short-form video | 2 posts a week | TikTok, YouTube Shorts and Instagram Reels: 10 to 20 second clips of a horde, a burn chain or a last-second van escape. Put text on screen and keep the URL in your bio. Bluesky and X take the same GIFs, tagged #screenshotsaturday. |
| 5 | Discord | Ongoing | Run your own server for feedback. Share in indie showcase channels (such as r/IndieGaming's Discord and itch.io community servers) only where the rules allow it. |
| 6 | [CrazyGames](https://docs.crazygames.com/requirements/technical) | 1 to 2 weeks | Large audience, with ad revenue share. Needs an initial download of 50 MB or less (20 MB for mobile), 250 MB total, 1,500 files at most, relative paths, and the SDK for a full launch with ads. Fix the music loading first. |
| 6 (alt) | [Poki](https://developers.poki.com/guide/requirements-quality) | 2 to 4 weeks | Curated, biggest reach. Needs web exclusivity, the PokiSDK, 16:9 scaling, desktop and mobile support, play with an ad blocker on, and no outside requests by default. GA4 and the co-op server would need to be off in the Poki build. Apply only if you'd drop the other portals. |

Keep undeadofnight.forthexp.com as the home build with co-op. Portal builds can be solo plus Nightly Run until the play API accepts those portals' addresses.

## Path to Steam

Getting the game onto Steam costs $100 and a few weeks of work. Aim for the **June 2027 Next Fest** (June 14 to 21, registration closes April 25). A game can enter Next Fest only once, so spend that entry on a polished demo, not a rushed one.

1. **Steamworks account and fee.** Sign up as Hall of the Gods, Inc. with tax and bank details, then pay the [Steam Direct fee](https://partner.steamgames.com/doc/gettingstarted/appfee) of $100 per game. Valve pays it back once the game earns $1,000 in adjusted gross revenue. Valve also requires a wait after payment and a Coming Soon page live for a period before release, roughly 30 days and 2 weeks (approximate; check the Steamworks onboarding page).
2. **Desktop wrapper: Electron.** Electron ships its own Chromium, so WebGL, audio and the Gamepad API behave the same on every PC and on Steam Deck. Use [steamworks.js](https://github.com/ceifa/steamworks.js) for achievements, cloud saves, the overlay and leaderboards. Tauri builds are much smaller, but they use the system webview (WebView2 on Windows, WebKitGTK on Linux and Steam Deck). That webview is slower and less consistent for a canvas game.
3. **Steam-only extras.** Turn the Record Book stamps into Steam achievements and the Nightly Run into a Steam leaderboard. Sync saves with Steam Cloud. Offer co-op through Steam Remote Play Together, which works with no netcode changes. Steam lobbies and invites can come later.
4. **Coming Soon page, as early as possible.** Wishlists only grow while the page is up. Use the capsule art, the trailer, 5 or more screenshots, the short description and the tags (Zombies, Top-Down Shooter, Roguelite, Pixel Graphics, Co-op, Survival). People often cite 7,000 to 10,000 wishlists at launch as the point where Steam starts promoting a game (a rule of thumb, not a Valve figure).
5. **Demo.** Levels 1 to 3 plus Nightly Run, on its own demo page linked from the main one. Put a wishlist prompt on the results screen.
6. **Next Fest.** For [June 2027](https://partner.steamgames.com/doc/marketing/upcoming_events/nextfest/june_2027): send the demo and store page in by May 10 to be part of the press preview, and have everything in by May 24. The page must be public and the demo playable when the fest starts. The game must release after June 21. [February 2027](https://partner.steamgames.com/doc/marketing/upcoming_events/nextfest/feb_2027) (February 22 to March 1, registration by January 10) is possible but tight, because gamepad support, the wrapper and the art would all need to be done by mid-January.
7. **Launch.** Release on Steam 1 to 3 months after Next Fest, at $5 to $10 with a launch discount. Keep the web version free as the top of the funnel, with a "Get it on Steam" button.

Also check that every music track's license covers commercial sale on Steam. The tracks are credited to ExoticService.

## Path to consoles

Consoles come after Steam, and they will cost real money or a revenue share. Switch, PlayStation and Xbox can't run a Vue and Canvas web app as it is. There is no supported browser runtime you can ship a game in, so the game has to be rebuilt or ported.

- **Porting options.** (a) Rebuild in an engine with console exports, such as Godot (console export through third-party porters), Unity or GameMaker. The simulation in `shared/` is deterministic TypeScript and maps cleanly to a port, but it is still a rewrite. (b) Hire a porting studio that has a JavaScript runtime for consoles. Expect five to six figures, or a revenue share.
- **Platform access.** Each platform accepts developers by application: Nintendo Developer Portal, PlayStation Partners, and ID@Xbox. Dev kits are loaned or sold only after approval. All three require a registered company, a rating (IARC or ESRB/PEGI) and passing certification. Exact kit costs are under NDA, so the numbers here are approximate.
- **Publishers.** The usual route for a solo or small studio is a publisher that pays for porting and certification, and often marketing, for 30 to 50% of revenue. Pitch them with Steam numbers: wishlists, Next Fest demo plays, reviews and the Nightly Run retention curve.
- **What to do now that makes porting cheaper later:** gamepad-first UI, a 16:9 safe area, no mouse-only menus, keeping game logic out of Vue components, and local co-op with two pads on one screen. Couch co-op sells on Switch.

## Checklist

The plan runs from now to a Steam launch in the second half of 2027.

**November 2026: get ready to post**

- [ ] Gamepad support
- [ ] Load music lazily and re-encode it
- [ ] 30-second trailer, 4 to 6 GIFs, 6 screenshots
- [ ] Discord server plus a Feedback link in the game
- [ ] GA4 funnel events
- [ ] Confirm the custom domain is set in GitHub Pages

**Late November to December 2026: go public on the web**

- [ ] itch.io page live
- [ ] Newgrounds page live
- [ ] First round of Reddit and short-form posts
- [ ] Choose CrazyGames or Poki, and apply

**December 2026 to February 2027: set up Steam**

- [ ] Steamworks account and the $100 fee
- [ ] Capsule art and logo
- [ ] Electron build with steamworks.js
- [ ] Coming Soon page live

**March to June 2027: demo and Next Fest**

- [ ] Demo build and demo page
- [ ] Register for June Next Fest by April 25
- [ ] Submit for press preview by May 10, everything in by May 24
- [ ] Next Fest, June 14 to 21

**Second half of 2027 and later**

- [ ] Steam launch
- [ ] Pitch publishers for consoles

## Sources

- [Steam Next Fest February 2027](https://partner.steamgames.com/doc/marketing/upcoming_events/nextfest/feb_2027) and [June 2027](https://partner.steamgames.com/doc/marketing/upcoming_events/nextfest/june_2027), Steamworks
- [Steam Direct fee](https://partner.steamgames.com/doc/gettingstarted/appfee), Steamworks
- [CrazyGames technical requirements](https://docs.crazygames.com/requirements/technical)
- [Poki requirements](https://developers.poki.com/guide/requirements-quality) and [working with Poki](https://developers.poki.com/guide/working-with-poki)
- [itch.io HTML5 upload limits](https://itch.io/docs/creators/html5)

The wishlist targets, wait periods, porting costs and publisher splits above are approximate industry figures, not taken from the sources.
