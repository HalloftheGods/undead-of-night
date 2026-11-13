# Outdoor camp: the bunker becomes a fenced camp the horde breaks into (design)

Epic: chemx task #7540. This is project 1 of 3. Project 2 (people you rescue, growth driven by them, The Radio) and project 3 (in-game station screens) get their own design docs and are summarised at the end only so this one leaves room for them.

## Intent

Xopher does not like that home is an indoor bunker. Home should read as an outdoor survivor camp that you build up, and the horde should not come through one known door: it breaks the perimeter at a random place, and at more than one place as the game gets harder. The base should feel built, not given.

## Goals

- Home is an open-air camp: ground, a scrap fence around it, tents and awnings where the rooms were, the van at a gate, wilderness outside.
- The overrun breaks the fence at randomly chosen sections. The sections about to give show a tell at the last warning. The number of sections grows with the furthest town reached and the difficulty.
- The camp has sizes. A bigger size puts the fence further out. Which size a room gets is a small integer both the sim and every client agree on.
- Solo, browser-host co-op and the LAN server all run the same code, as today.

## Non-goals (this project)

- Rescuing people, hiding merchants who are not rescued, The Radio. All four merchants and the jukebox stay as they are (project 2).
- Station screens drawn on the canvas (project 3). The Vue screens keep working unchanged.
- Repairing or reinforcing fence, zombies damaging fence by attacking it, players placing anything.
- Renaming code identifiers. `isBunkerMap`, `BUNKER_SEED`, `bunker-map.ts` and the `'bunker'` theme id keep their names; only what the player reads and sees says "camp". (Claude's call: about 20 code sites and 30 test sites use them.)

## Anti-goals

- A client that builds a different camp than the sim (walking through fence on one side). Size and open sections are always sim-authoritative and carried to clients.
- A breach the player could not have read. Every section that falls showed its tell first.
- Any new `sim.rng` draw while the overrun is off or the room is at peace (`tests/overrun-off-rng.spec.ts` pins 5067 draws).
- A `PROTOCOL_VERSION` bump. Every wire change is an optional, additive field; station ids do not change.

## How it works today (verified 2026-11-13)

- `shared/bunker-map.ts`: a fixed 40x24 tile map, four rooms cut from `bunker_wall`, built by `generateBunkerMap()` with no inputs. Sim and client each build it from `mapSeed === BUNKER_SEED`; both skip the rebuild when the seed is unchanged (`shared/level-change.ts:21-23`, `src/game/run-stage.ts:41-42`).
- `shared/overrun.ts`: one clock per arrival; warnings at 50%, 25% and 10% of the span; guns free at 10%; at zero the whole horde trickles in at `BLAST_DOOR_SPOT`, a point inside the hall. The blast door is a prop on solid rock, not an opening. The renderer starts the door buckling at the second warning (`src/engine/overrun-look.ts:10`).
- The overrun is live for every Campaign room (`OVERRUN_LIVE = true`).
- `CHEST_SPOT`, `CHEST_STATION`, `MERCHANT_STARTS`, `MERCHANT_ROAM` are module constants imported by sim and client.
- In `endTrip` (`shared/trip.ts:137-141`) `enterBunker` runs before `syncRoomHighest`.

## The camp map

- **One fixed-size map**, 72x48 tiles (1152x768 px; the view is 480x270). Ground is `grass` with worn `dirt` inside the fence and on a track from the gate. Nothing is `bunker_wall`.
- **Camp sizes 1 to 5.** The fence is a rectangle centred on the map centre, built from the existing 32 px `fence_h` / `fence_v` footprints (new scrap-fence art, see Look):

  | Size | Fence rectangle (tiles) |
  | :--- | :--- |
  | 1 | 24 x 14 |
  | 2 | 28 x 16 |
  | 3 | 32 x 18 |
  | 4 | 36 x 22 |
  | 5 | 40 x 26 |

  The largest ring leaves at least 11 tiles of wilderness on every side for the horde to arrive across.
- **Nothing moves between sizes.** Every station, the spawn spot, the chest spot and the van's parking spot sit inside the size 1 rectangle at fixed pixels, so growth only adds room. The extra ground at sizes 2 to 5 holds scenery in this project (crates, a second fire barrel, bedrolls) and is where project 2 pitches each rescued person's tent.
- **Areas, not rooms.** Market awning along the north side (the four merchants start there), workshop lean-to (bench, candy shop, locker) to the west, quarters tents and the campfire in the middle and south (jukebox, spawn), garage map on a board by the gate. `districts` names them Market, Workshop, Quarters, Gate for the Tab map.
- **The gate** is on the east side: a two-section gap closed by a gate prop, with the van parked just inside it. Gate sections never breach.
- **Wilderness**: trees, bushes and dead trees scattered from the map seed outside the fence, kept 3 tiles clear of the largest ring so no breach spawn is blocked. The map edge is the world edge as in towns.
- **Collision**: fence sections and the gate are solid props; `map.walls` is empty. Tents and awnings are scenery with small solid footprints at their poles only, so the yard stays open.
- **Size is an input.** `generateBunkerMap(size)`; `generateWorldMap` passes it through. A map object is built per (size, set of open sections), so the existing per-map caches (solid index, flow field, occlusion, ground chunks) stay correct without new invalidation code.
- `CHEST_SPOT`, the chest station, merchant starts and roam boxes are read from the built map (or exported as functions of size), not as bare constants, on both sides. Merchants roam only inside the current ring.

## Camp size: who decides and when

- In this project the size comes from the room's furthest town: `size = clamp(roomHighest, 1, 5)`. Project 2 replaces this one function with "people brought home", and nothing else here changes.
- The size is latched when the room arrives home and when the first player joins a fresh room, never mid-visit, so a rebuild always happens behind the van transition. `syncRoomHighest` moves ahead of `enterBunker` in `endTrip` so the arrival sees the banked level.
- The size rides the snapshot as an optional field beside `mapSeed` (absent means 1). The sim rebuilds when seed or size changes; the client rebuilds when either changes in the snapshot.
- A player who self-reports a high level gets a bigger camp. That is the existing trust model for `highest` and stays.

## The breach

- **Phases** stay `counting → armed → breached → held | lost`. Warnings stay at 50%, 25% and 10%.
- **Choosing sections.** On the tick the clock arms (the last warning, 10% left, the moment guns go free) the sim picks the sections with `sim.rng`. Candidates are every fence section of the current ring except the gate's and the corner pieces. No two picks are adjacent, and picks are at least 4 sections apart along the ring when the ring allows it.
- **How many.** `gaps = min(4, byLevel + byDifficulty)`, with `byLevel` 1 for roomHighest 2-3, 2 for 4-6, 3 for 7-10, and `byDifficulty` 0 for Night Light and Stay Close, 1 for Lights Out and Undead Tired. These are starting numbers for the soak, in named constants.
- **The tell.** From that tick each picked section rattles, leans and throws sparks or dust, with a positioned groan/creak sound, and the HUD's last-warning banner says how many sides are giving ("THE FENCE IS GIVING: 2 PLACES"). The earlier two warnings stay as banners with no location. The buckling art that today starts at the second warning moves to the last.
- **At zero** each picked section falls: its prop is replaced by a walkable "fallen fence" decal, the map is rebuilt without those sections, and the flow field with it.
- **The horde** is the same roster as today (3.5 times the furthest town's hardest horde, capped at 140), dealt round-robin across the gaps. Zombies spawn in the wilderness 4 to 7 tiles outside their gap and hunt in through it. The global gap between spawns stays 0.22 s. More gaps is harder because the horde arrives from several sides, not because it is bigger; the soak decides whether the numbers move.
- **Afterwards.** The gaps stay open for the rest of the visit. The fence is whole again on the next arrival. Held and lost outcomes, the chest, receipts and merchant casualties work as today.
- **On the wire.** `OverrunView` gains an optional list of picked sections (index along the ring, or the section's position; builder's choice) present from the arming tick on and left off otherwise, so snapshots outside an overrun are byte-for-byte what they are now. The view's phase tells the client whether a listed section is rattling or down.
- **Existing rule fixed in passing:** the empty-magazine RELOAD prompt is suppressed at home (`src/engine/ammo-prompt.ts`); it shows whenever guns are free.

## Look and sound

- A `camp` look in `level-look.ts`: night, cool moonlit ambient, a warm flickering campfire light at the centre, lanterns at the market and workshop, no weather. (Claude's call: night keeps the firelight and the lighting system doing the work the bunker lamps did.)
- New art: scrap fence (corrugated sheet, pallets, chain-link; h and v; rattling and fallen frames), gate, market awning, lean-to, two tent kinds, campfire, bedroll, lantern. Existing station props are reused as they are. The style follows the current pixel art; exact drawings are the builder's.
- Sound: a quiet night bed with wind in camp (today the bunker has none), soft footsteps on grass and dirt, the fence tell, the fall.
- Tab map: draws grass, dirt, the fence ring and open gaps; the "Bunker map" key becomes "Camp map".
- The blast door prop leaves the map. Its art, prop definition and the level 6 art that mentions a blast door are not deleted in this project.

## Words the player reads

Every player-facing "bunker", "hall", "blast door", "safe: no zombies" line changes to match: `src/game/how-to-play.ts` (175, 176, 224, 254), `how-to-play-visuals.ts` (71-76, 158-160), `magazine-hints.ts` (373, 431-442), `map-key.ts`, `run-notices.ts` warning titles, `station-labels.ts` where it names a room. The base's name, Zero Point, stays.

## Approaches considered

1. **Sized camp on one fixed map with picked breach sections (chosen).** Growth is a number; the fence ring moves out; nothing placed moves; sim and clients agree by sending one integer. Breaches are chosen, so they are fair and tunable.
2. **Free building**: the player places tents and fence pieces. The strongest "build" feel, but it needs a placement editor, a saved layout, and a rule for merging layouts in co-op. A much larger game; ruled out for now by Xopher's "camp can get bigger as you progress".
3. **Zombies chew through any section by damage.** Emergent, but breach location stops being readable and balancing 140 zombies against fence health is open-ended. Ruled out; it also conflicts with the tell Xopher asked for.
4. **A map that changes dimensions per size.** Moves every coordinate and cache on growth. Ruled out in favour of a fixed map with a moving ring.

## Decided by Xopher

- Outdoor camp, not an indoor bunker.
- Breach at random edges, more than one as the game gets harder.
- The sections about to give show a tell at the last warning.
- The camp gets bigger as you progress.

Everything else in this document is Claude's proposal.

## Constraints

- `shared/home-protocol.ts` is frozen: additions are additive and announced to the trip-loop owner by DM. New view fields need their guard in `src/network/home-guards.ts`.
- Determinism: all randomness in the sim through `sim.rng`, in tick order.
- Shared checkout on `main`: lock each file, commit small and green, no branches or stashes. Other sessions have uncommitted edits in `shared/containers.ts` and `src/game/title-menu.ts`; do not touch them.
- Project rules: files under 500 lines and split by responsibility, no invented data, living docs updated with behaviour.

## What will break and must be rewritten

- Tests that pin the indoor layout or the single door: `tests/bunker-map.spec.ts`, `tests/home-contract.spec.ts` (217-229), `tests/overrun-horde.spec.ts` (82-126), `tests/overrun-look.spec.ts`, `tests/overrun-soak.spec.ts`, `tests/bunker-merchants.spec.ts`, and any spec reading `cols === 40`.
- `tools/horde-bench.ts` (hard-coded spawn box by the door) and `tools/contact-sheet.ts` (blast door row).
- Docs: `docs/README.md` (the home section; it also says the horde cap is 40 where the code has 140), `docs/CHANGELOG.md`, and a note at the top of the two older specs that this document supersedes their map and door sections.

## Left to the builder

- Exact pixel positions of stations, tents and scenery, within the rules above.
- How the sim and client share the "map for this size and these open sections" (rebuild vs filtered copy), as long as collision and drawing can never disagree.
- The shape of the optional view fields.
- File splits (`bunker-map.ts` is 205 lines today and will need splitting: layout data, fence ring, map build).
- Balance numbers after the soak, reported back rather than silently changed.

## Later projects, so this one leaves room

- **Project 2: people, growth, The Radio.** One merchant per level 1 to 4 (Sarge, Mags, Doc, Cinder), found in town and **escorted to the van** (Xopher's decision): you can hand them one of your guns, some have guns or ammo lying about, some give a clue to a good stash. Each one brought home pitches a tent and raises the camp size. The jukebox becomes The Radio, dead until the radio is found; the found flag and rescues move into the campaign save; several unlock bugs found on 2026-11-13 get fixed there.
- **Project 3: in-game screens.** Workbench, locker and merchant menus drawn on the game canvas beside the station or person, keyboard and mouse first.
