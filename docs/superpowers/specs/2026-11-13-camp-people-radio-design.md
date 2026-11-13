# Camp, project 2: the people you rescue, the Roster, and The Radio (design)

Epic: chemx #7540, design task #7556. Follows [Outdoor camp (design)](2026-11-13-outdoor-camp-design.md), which is built (project 1). Project 3 (in-game station screens) stays separate.

## Intent

The base should feel built, and built by you. The camp's people are not given: each is somewhere in the first four towns, and you find them and bring them home alive. Each one brought home grows the camp and opens their shop and quests. Finishing a person's quests earns the right to play as them. The jukebox becomes The Radio, dead until you have found a radio.

## Decided by Xopher

- The NPCs (the four merchants) are people to find and rescue in the first four levels.
- Rescue is an escort to the van: the person follows you, and the goal is to get them into the van to add them to the base.
- You can hand them one of your guns; sometimes they have guns or ammo lying about; sometimes they give a clue to a good stash.
- An escorted person who is overrun goes down and can be revived, like a teammate.
- The camp gets bigger as you progress.
- A Roster station next to the map board lets you choose your character in camp: the original survivors, plus each rescued person once all their quests are done.
- The jukebox becomes The Radio, which works only after the radio has been found. The radio unlock logic is to be checked and fixed.

Everything else here is Claude's proposal, listed for review at the end.

## Goals

- One person waits in each of towns 1 to 4 until rescued. Escorting them to the van brings them into the camp for good.
- The camp's size follows the people brought home.
- Rescues, the radio and Roster unlocks live in the campaign's home save (`outbreak.home`), with the camp's other progress, instead of loose browser flags. (That save is itself per browser; moving saves between devices is out of scope.)
- The Radio is gated in the sim, not only in the UI.
- Works the same solo, browser-hosted co-op and on the LAN server.

## Non-goals

- New merchants beyond the four. New perks or stats for playable merchants beyond one small edge each (below).
- Repairing the fence, building, or placing tents yourself.
- Changing what the merchants sell.
- In-game station screens (project 3). The Roster gets a plain screen in the existing style.

## Anti-goals

- A person who is lost for good. Whatever happens, they are back in their town on the next trip there.
- A camp that drifts between players in co-op: the sim decides who is in camp, and every client draws that.
- Hidden randomness. Placement, the stash and the person's own choices (aim, spread) use salted generators, as merchants and treasure do. A zombie the person kills drops loot through the same `sim.rng` roll as any kill, and zombies that see the person behave as they do around a player, so `tests/overrun-off-rng.spec.ts` is re-recorded once, with a note, after checking the overrun code is not what moved it.
- A save field dropped on load. `reviveSave` lists fields by hand and already drops `lockerGrid` (fixed in this project).

## How it works today (verified 2026-11-13)

- Merchants exist only in camp: `placeMerchants` is gated on `isBunkerMap` (`shared/bunker-merchants.ts:102`), `emptyWorld` clears them (`shared/level-change.ts:54`), `updateMerchants` returns outside camp (`shared/merchant-fight.ts:159`).
- A merchant already has its own rng, walk, gun fight (unlimited ammo, at ×0.6 damage, ×1.8 fire interval and extra spread, `merchant-fight.ts:14-18`), health and down state, a snapshot view, and drawing on the survivor rig. Its gun is fixed per merchant (`ARMS`, `bunker-merchants.ts:34-39`), so a person who starts unarmed needs a nullable, changeable weapon.
- Teammates are revived by standing within 28 px for 3 seconds, no key (`shared/player-health.ts:123-142`).
- `sim.clues` is one room-wide map from building to find (`shared/sim-state.ts:377`), shown to every client.
- Following exists only in a breach (`regroup`, `merchant-fight.ts:96`), at speed 60 with no stuck handling, no stairs, manholes or doors.
- Zombies take merchants as prey only while `merchantsFighting` (breach). Awareness and sleep look at players only (`shared/zombies.ts:416-426`).
- Each trip is a new town: `levelSeed(runSeed, level, attempt)`, with `attempt` read before it increments (`shared/trip.ts:87-99`).
- Quests: 17 one-time quests and 4 repeating jobs; a new save accepts a starter at every stall (`src/game/home/home-store.ts:99`).
- Characters: five survivors, chosen at join (`shared/characters.ts`, `character-pref.ts`); nothing changes skin after.
- The radio: a per-browser localStorage flag (`src/game/sound-unlock.ts:7`), set on every client by any player's pickup (deliberate, per the comment at `:60`); the jukebox station and its action are not gated (`shared/stations.ts:45`, `shared/trip.ts:215`).
- "At home" on the client is read from `scene.merchants !== undefined` (`src/engine/overlay-renderer.ts:398`), which breaks the moment a camp has no merchants or a town has one.

## Who is where

| Town | Person | Waits in | Has with them |
| :--- | :--- | :--- | :--- |
| 1 | Sarge, quartermaster | a house or apartment | ammo for every gun type near them |
| 2 | Mags, gunsmith | a garage, else a house | a shotgun lying by them |
| 3 | Doc, medic | a clinic or pharmacy, else a house | two medkits; tells you of a stash |
| 4 | Cinder, powder | a warehouse or garage, else a house | fireworks; tells you of a stash |

Placement: a new placer (`shared/camp/rescue-placement.ts`) runs from `enterTown` only on a home run, with its own `createRng(map.seed ^ RESCUE_SALT)`, like `placeTownKits`. It picks a building of the wished kind if the town has one, else a house or apartment, and a floor spot inside it from `lootSpots`. Nearby finds are pickups spawned at neighbouring loot spots with the same salted generator. A person waits in a town while **anyone on the trip** has not rescued them (co-op: the party all benefits, see Credit).

A **stash** is a real extra cache: better-than-usual finds (a gun upgrade part and a stack of ammo, or a round kit) laid on the floor of another building of that town by the salted generator. The person names it when freed; the building gets the existing clue mark (`sim.clues`), so the whole party sees it on the Tab map. Floor finds, not a container, because the clue only reads floor pickups (`shared/container-search.ts:178-196`).

## The person in town

A new entity list, `sim.rescuees`, separate from `sim.merchants`, so shop, station and "at home" code never see them. It reuses the merchant's body, art, fight and view code; the snapshot carries them as `rescuees` (range-filtered like zombies).

States:

- **Waiting**: stands where placed, idle animation. Zombies ignore a waiting person (keeps the town fair and `sim.rng` untouched).
- **Following**: started by holding E next to them ("HOLD E: TAKE SARGE"). They follow the player who freed them; if that player goes down or leaves, they follow the nearest player on their feet.
- **Downed**: at 0 health. Revived exactly as a teammate is: any player on their feet stands within 28 px for 3 seconds (the loop in `updateDownedPlayers` extended to people, Dog Tags included). A downed person does not bleed out, and zombies lose interest in them (they drop out of the prey list), so a revive means clearing the ones still around, not the whole crowd. A person never revives anyone.
- **Home**: aboard when the van leaves.

Following:

- Speed is the player's walking speed (84); they keep a few steps back and close up when you stop. In a vehicle they take a free passenger seat with their leader; with no free seat they wait where the car stopped and are put back near the leader by the rule below.
- They use their own flow field toward their leader, refreshed as the merchants' breach regroup does, and take stairs, ladders and manholes the way zombies do (`FlowField.stairsDown`, `takeStairs`). They respect closed doors (the door callback zombies pass to `stepMovement`), and a door cannot be shut on them.
- Stuck for more than 3 seconds, or more than 18 tiles behind, they are put down at the open spot nearest their leader that the leader cannot see (no visible teleport).

Fighting: with no gun they keep their head down (no shooting). Hand them a gun from your hands ("HOLD E: GIVE PISTOL" next to a person who is following you; freeing them is "HOLD E: TAKE SARGE", and the two never show at once). They fight with it as merchants do (the merchant damage and rate penalties, unlimited ammo, their own rng) and their shots make noise like a player's. They **hold fire** until their leader fires or a zombie is hunting someone, so sneaking still works. The gun is **lent**: it leaves your hands when you give it and comes back into them when you bank, whatever became of the person; if you die, it is lost with the rest of your hands.

Zombies: a following person is a target like a player for sight, sleep and hunting. This changes zombie behaviour in trips with a rescue, so `OFF_PATH_DRAWS` in the off-rng pin is re-recorded if its scripted trip meets a person (it plays level 1, where Sarge waits); the overrun code must not be what moves it.

The van: a following person counts as aboard when they are within the van's radius as it leaves, like a player. The van's hold does not wait for them; leaving without them fails the rescue for this trip. A downed person is not aboard.

## Credit, the save and the room

- **Save** (`HomeSave.camp`, revived field by field): `rescued: MerchantId[]`, `radio: boolean`, `tracks: string[]`, `rosterUnlocked: MerchantId[]`, `character: number | null`. `lockerGrid` is added to the revive list in the same change.
- **Receipt**: a banked `TripReceipt` gains `rescued?: MerchantId[]` (everyone brought home this trip) for every player who banks alive. A died or lost receipt carries none. `radioLevels?: number[]` rides **any** receipt (banked, died or lost) of a player who was in the room when a radio was picked up, one entry per radio and the level it was found on: finding it is knowledge, kept as today, and today's whole-party rule now lands in each save. Applying the receipt sets `radio` and gives up the next locked track for that level in the existing order (`lockedTracksOf`), once, through `appliedReceipts`.
- **Join**: `JoinHome` gains `rescued`, `radio`, `rosterUnlocked`. The room's camp shows the **union** of the rescued sets of the players in it, latched at arrival like the camp size. The same trust model as `highest` today.
- **Camp size**: `campSizeFor` becomes `1 + rescued in camp` (1 to 5). The Market, Workshop and Quarters stand from the start; each person's tent replaces the pup tent that their size's ground already has (`camp-scenery.ts`).
- **Existing saves**: a save is existing if its ledger or `appliedReceipts` has anything in it. Every existing save starts with all four merchants rescued, keeping quests and stock, so nobody loses a shop or a quest they are partway through. A brand-new save starts with none. A legacy localStorage radio flag and its tracks carry over once.
- **Co-op rights**: the room shows the union of the players' rescued merchants, but a merchant's stall, quests, quest marks and jobs open only for a player whose own save has rescued them. To anyone else they say "WE HAVEN'T MET". A person still waits in town while anyone on the trip lacks them, so that player can earn them there.

## Quests and the start of a campaign

- A merchant's quests, jobs, stock rolls and quest marks exist only while they are in camp (guards in `questRows`, accept, `rollJobs`, marks, tracker). Their starter is accepted on the receipt that brings them home, so the trip that rescued them can count.
- A brand-new campaign starts with an empty camp: candy shop, locker, bench, map board, Radio, no merchants. The first-run hint is "Find Sarge in One Lake City" (town 1's name as `shared/levels.ts` has it), with Sarge's waiting spot marked on the Tab map for the first trip only.
- **Lost in an overrun**: the overrun's flee rule closes stalls as today; it never un-rescues anyone, and picks only from merchants in camp.

## The breach while the camp is small

The breach horde scales with the furthest town reached, which can now run ahead of the camp. The horde is multiplied by `0.5 + 0.125 × people in camp` (half at none, full at four). It's a starting number for the soak, in a named constant.

## The Roster

- A station next to the map board (`ROSTER_PLACE`), prop and label "ROSTER", opened with HOLD E like any station.
- It lists the five survivors and the four merchants. A merchant is pickable once **all of their one-time quests** are done (jobs never finish and do not count); the unlock is stored in `rosterUnlocked` when the last one is turned in, so a later content update never takes a character away.
- Picking is a new home action, checked in the sim: in camp, not ready at the van, the pick unlocked for that player, and not worn by a teammate. The pick takes effect at once, is saved as `character`, and is what the next join sends.
- Each merchant has one edge, as each survivor does: Mags has better search luck (an existing `Character` read); Sarge carries one more spare magazine, Doc's medkits heal 50% more, Cinder throws 25% further. Those three are new `Character` fields read at one place each (`spareMags`, `medkitHeal`, `throwRange`), 1 for every other survivor. Their progression gets its own slot (`SURVIVOR_COUNT` grows to 9).
- The merchant you play as is still in camp running their shop. It's a game; there are two of them.

## The Radio

- The jukebox station becomes The Radio (station id stays `jukebox`, so no packet changes; label "RADIO", new prop art: a field radio on a crate).
- **Dead** until that player's save has `radio`: the prop shows no lights, and HOLD E shows "NO SIGNAL" and opens nothing. In co-op it works for anyone who has one; the room's track plays for everyone in camp, as now.
- **Fixed in the sim**: `openableStation` refuses the Radio without `home.radio`; the jukebox action requires the Radio open and `home.radio`, caps the track name's length and checks it against known track names; the room track clears when nobody left in camp has a radio.
- **Track list**: campaign progress and the save's `tracks`, not Arcade progress.
- **Finding it**: a radio is guaranteed in town 2 on a home run until the room's players all have one, placed by the radio's own generator so no other roll moves. Arcade keeps today's chances.
- **Title menu**: the Radio entry reads the save's flag OR the legacy flag (so Arcade finds still count). Another session is reworking `src/game/title-menu.ts` now; the locked-section fix (`TitleMenu.vue:99` lets a locked section be entered) goes to them by DM rather than into this project.

## "At home" on the client

`atHome` and every other "is this the camp" read on the client use `isBunkerMap(map)`, never `scene.merchants`. This is a prerequisite: an empty camp and a town with a person in it both break the current read.

## Approaches considered

1. **Three slices, Radio and save first (chosen).** The save, the Radio and its bug fixes stand alone and ship first; rescues build on the save; the Roster builds on quests and the save.
2. **Rescues as quests only** (the person is a pickup-like token you carry to the van). Far less code, but not an escort; ruled out by Xopher's escort decision.
3. **Merchants in camp from the start, rescues unlock their shops.** Keeps the tutorial, but nobody is ever found; ruled out by "people you need to find".

## Constraints

- `shared/home-protocol.ts` is frozen: additive fields only, DM the owner (`@claude-c08ac7b0-contract`). Snapshot gains `rescuees` and a new event or two, so `PROTOCOL_VERSION` goes to 7.
- Other sessions have uncommitted work in `shared/levels.ts`, `src/game/how-to-play.ts`, `src/game/hud-state.ts`, `src/game/title-menu.ts`: commit only this work's lines in those files.
- Files under 500 lines; `shared/protocol.ts` and `shared/fortifications.ts` are already over, so new types go in new files.

## Left to the builder

- Exact waiting spots, finds and stash contents within the rules above; dialogue lines.
- The follow field's refresh rate and the "close up" distance.
- Art for the Radio prop and each person's tent (in the camp's style).
- File splits.

## For Xopher to check

1. The person **waits safely** until you free them: zombies ignore them until they follow you. Downed, they are revived by standing by them as for a teammate, and zombies leave a downed person alone.
2. The gun is **lent**: it comes back to you when you bank, whatever happened to the person. An armed person **holds fire** until you fire or something is hunting you, so sneaking still works.
3. **Co-op**: everyone sees the union of rescued merchants, but you can only shop and quest with ones **you** have rescued. A person waits in town while anyone on the trip still needs them, and everyone who banks gets them.
4. A **new campaign starts with an empty camp**, and the first goal is finding Sarge in town 1.
5. **Existing saves keep all four merchants**; only new campaigns start empty.
6. **Camp size follows people brought home**, not the furthest town.
7. **The breach is smaller while the camp is small** (half at none, full at four).
8. **Roster**: all one-time quests, unlock kept for good, one small edge each, and the merchant still runs their shop while you play as them.
9. **The radio is still a party find**: everyone in the room when it is picked up gets it, now in their own save, and it counts even if you die before the van. It is guaranteed in town 2.
10. **Build order**: Radio and save, then rescues, then the Roster.
