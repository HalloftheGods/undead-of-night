# Live multiplayer: player-hosted rooms, routed by Cloudflare

Epic: chemx task #7272. This merges three design passes (architecture, matchmaking, server port), all read-only. Nothing was deployed and no Cloudflare account was used. Cloudflare prices and limits were checked on **2026-11-06** on developers.cloudflare.com (sources at the end). Code facts were checked against `main` on the same day. Byte and CPU figures come from a scratch measurement on the dev desktop (Node 22, 2026-11-06) and are marked as such.

**The recommendation is option A: player-hosted rooms over WebRTC.** One player's browser runs the room. Cloudflare only finds rooms and sets up connections, so the bill is close to zero at hobby scale. Server-run rooms in a Durable Object (option C) stay as the later, paid upgrade. A Durable Object WebSocket relay (option B) is not built unless telemetry shows it is needed.

## What exists today

- **Hosting.** The PWA is a static site on GitHub Pages at `https://undeadofnight.forthexp.com`. That stays. The GitHub Pages constraints:
  - Pages cannot set response headers. There is no CSP, COOP or COEP header, and nothing here needs one. `index.html` has no CSP meta tag, so a cross-origin API needs no `connect-src` change.
  - Paths are relative (`base: './'` in `vite.config.js`). A module Web Worker built with `new URL('./x.ts', import.meta.url)` works under that base.
  - `public/sw.js` scopes itself with `new URL('./', self.location)` and only handles same-origin GET requests. Calls to `play-api.forthexp.com`, its `wss://` sockets and WebRTC all bypass it, so the service worker needs no change.
- **DNS.** forthexp.com is on Cloudflare nameservers (`nitin`, `sue`; checked 2026-11-06). `undeadofnight` is a DNS-only CNAME to GitHub. A Worker custom domain such as `play-api.forthexp.com` can join the same zone, if the zone is in the account you sign in with (open question 8).
- **Co-op server.** `server/server.ts` and `server/room.ts` run one Node process with **one room** on one port (default 8097, `DEFAULT_SERVER_PORT`). The room has no id: the address is the whole invite (`?join=host:port`, `src/game/invite-link.ts`).
  - The room steps `GameSimulation` at 30 Hz with a drift-corrected `setTimeout` loop (250 ms lag reset, at most 3 catch-up ticks). Each joined client gets `JSON.stringify(viewFor(frame, id))` (`shared/snapshot-view.ts`). A client whose `bufferedAmount` is 32 KB or more skips the frame.
  - Handshake. On connect the server sends `{type:'room', style}`. The client answers with `join`, which carries the callsign, `tabToken`, survivor, difficulty, style and home. The first player into an empty room sets the difficulty and style. A join that names a different style is sent `room` again. The reply is `welcome`, and snapshots and `player_disconnected` follow.
  - Close codes: 4000 room full (also sent to a style-less old client in a Campaign room), 4001 busy (16 sockets waiting to join, 4 per address), 4002 no join within 10 s.
  - Limits: 2048-byte packets, 120 packets/s with a burst of 240, a 10 s ping heartbeat and a 15 s restart vote.
  - When the last player leaves, the room stops ticking and calls `sim.restart()`.
  - Reconnect works by `tabToken()` in sessionStorage: `welcome.resumed` returns the same body.
  - Co-op never shares a survivor: `freeCharacter`. There are 5 survivors and `MAX_PLAYERS = 5`, one seat each. Find a team only offers rooms where your survivor is free, and a code join looks the room up first (`seatRefusal`).
- **Portability.** `shared/` imports nothing from Node and uses only `crypto.getRandomValues`. Solo play already runs the whole sim in the browser: `LocalSession` steps `GameSimulation` through `TickClock`. On the server, only `server.ts` and `room.ts` touch Node or `ws` (`node:crypto`, `ws`, `NodeJS.Timeout`), about 510 lines across 6 files. The same sim can therefore run in a host's tab, in Node or in a Durable Object.
- **Client seam.** `GameTransport` (`src/network/transport.ts`). `SocketSession` touches its socket only through `new WebSocket(url)`, `send`, `onmessage` and `onclose(code)`.
- **Play flow** (`src/game/play-flow.ts`): style, then mode (callsign; Multiplayer adds a server address and Copy invite link), then difficulty, then survivor. An invite skips Style.
- **Callsigns** are free text. Every layer caps them at 12 characters (`CALLSIGN_MAX_LENGTH` in `shared/callsign.ts`, cut by code point) and runs them through `cleanCallsign`: control characters stripped, then a small whole-word blocklist. A blank or refused callsign travels as `''` and is never replaced in storage; every screen labels it from the survivor's name and skin (`displayName`, `tagLabel`). A server older than this rule shows `Survivor` for `''`. Callsigns are never sent to analytics.

### Measured load (scratch script, dev desktop, Node 22, 2026-11-06)

Setup: 4 players, Arcade, seed 271828, CirclingBots, 12,000 ticks, peak 141 zombies.

| Measure | Result |
|---|---|
| Per-client snapshot (`viewFor` + JSON) | mean 3,468 B, p95 3,932 B, max 4,215 B |
| Same, `deflate-raw` | mean about 847 B, p95 about 943 B (about 4x smaller) |
| `sim.step()` + `snapshot()` | mean 1.05 ms, p99 6.3 ms (the budget is 33.3 ms) |
| Four `viewFor` + stringify | mean 0.50 ms, p99 3.7 ms |
| Host upload for 3 guests at 30 Hz | about 312 KB/s, about 2.5 Mbps (p95 about 2.8 Mbps); about 0.6 Mbps compressed |
| Data per guest-hour | about 0.40 GB (about 0.12 GB compressed) |

The port designer measured an idle-bot room at 2.2 to 2.5 KB per view, 0.3 to 0.8 ms per tick with four views, and about 1 MB of heap per room. The busier figures above are the ones used in this spec. The matchmaking designer's 4 to 8 KB guess is replaced by them. A Campaign room in a full overrun has not been measured: `tests/server-overrun.spec.ts` only bounds it under 32 KB. Task #7276 measures it. Expect a phone to run 3 to 5 times slower than this desktop.

## Architecture on Cloudflare

### The three options

| | A. Player-hosted, WebRTC (**chosen**) | B. Player-hosted, Durable Object relay | C. Server-run room in a Durable Object |
|---|---|---|---|
| Where the sim runs | Host's browser | Host's browser | Room Durable Object |
| Game traffic | Directly between peers, or through Cloudflare TURN | Through the DO, two hops | Clients to the DO |
| Cloudflare cost per 4-player room-hour | A few hundred DO requests, plus TURN bytes when relayed | 21,600 requests + 450 GB-s (13,500 requests if inputs are sent at 15 Hz) | 21,600 requests + 450 GB-s |
| Host leaves | Room ends | Room ends | Room survives |
| Cheating | Host can cheat (accepted among friends) | Host can cheat | Not possible |

Option B costs as much as C and keeps every weakness of a player-hosted room, so it would only make sense as a last-resort fallback. TURN over TLS on port 443 already gets through almost every firewall that allows HTTPS. B (task #7295) waits for connection-path telemetry to show that players are stuck on networks that block WebRTC entirely.

**Designer conflict resolved.** The matchmaking pass proposed shipping B first because the guest client barely changes. The architecture and port passes showed B costs the same as C (§Costs). The guest client barely changes under A either: `RemoteSession` over a `PacketPipe` (task #7277) speaks the same packets over a data channel. A ships first.

### Components (option A)

```
GitHub Pages (static PWA)               Cloudflare  play-api.forthexp.com   (Worker "undead-play-api")
 Host tab                                Worker   /v1/rooms  /v1/match  /v1/rooms/:code  /health
  HostSession                              │        CORS, Origin check, per-IP limits
   GameSimulation + RoomHost               │
   own player in-process                   ├──► Lobby DO (one, SQLite): codes, listings, match, tombstones
   RtcPeerSocket per guest ◄─RTCDataChannel─┼──► Guest tab: RemoteSession(RtcPipe)
   signal socket (hibernating) ────────────┴──► Room DO (one per code, SQLite meta): host auth,
                                                  signaling relay, liveness, TURN credential minting
          STUN stun.cloudflare.com (free) · TURN turn.cloudflare.com (relay fallback; forced in public rooms)
```

- **Worker** `undead-play-api` on the custom domain `play-api.forthexp.com`. It routes requests, answers CORS for the Pages origin, checks `Origin` on every WebSocket upgrade (browsers do not apply CORS to upgrades, and non-browsers can forge the header, so this only filters out nuisance traffic), and applies per-IP limits.
- **Lobby DO**: one global SQLite-backed object.
  - It allocates codes, skipping codes that are live, tombstoned or on the blocklist.
  - It holds public listings and runs `POST /v1/match` find-or-create atomically. DO input gates serialise the calls, so two searchers who arrive together meet instead of both hosting.
  - It sweeps stale rows with an alarm.
  - Location does not matter for it.
- **Room DO**: one per code, addressed with `getByName(code)`.
  - It authenticates the host. The host socket must send its `hostKey` in the first message within 5 s; the key is never in the URL, so it never reaches logs.
  - It relays SDP and ICE between the host and each guest, tagged by `peerId`.
  - It tracks the host's liveness and mints TURN credentials.
  - Both sockets use the hibernation API (`ctx.acceptWebSocket`), so an idle room costs almost nothing. It never uses `setTimeout` or `setInterval`, which would block hibernation.
  - It is created near its first caller, the host. Option C later reuses this same class (see the option C section below).
- **Who owns what** (the designers disagreed on this). The **Lobby** owns codes, listings and matching. The **Room DO** owns the host's identity, signaling and liveness, and reports listing changes to the Lobby over DO RPC, coalesced to at most one per second.
- **Game packets never touch a Worker in option A.** Guests talk to the host over one negotiated `RTCDataChannel` (`{negotiated: true, id: 0, ordered: true}`). It is reliable and ordered, the same semantics as today's WebSocket, so the packet protocol is unchanged. An unreliable snapshot channel is a later option: head-of-line blocking on lossy links is accepted for v1.

### Flows

1. **Host.** `POST /v1/rooms {protocol, style, difficulty, visibility, device}` returns `{code, hostKey}`.
   - The host opens `wss://play-api.forthexp.com/v1/rooms/CODE/host`, authenticates in the first message and keeps the socket open (hibernating) to hear about new guests.
   - It stores `hostKey` in sessionStorage so a dropped signal socket can reconnect.
   - The host's own player joins `RoomHost` in-process.
2. **Guest.** The guest opens a `?room=CODE` link, types the code, or is matched.
   - `GET /v1/rooms/:code` returns a room card: style, difficulty, level, seats, taken survivors, protocol. A missing code gets 404 and an ended (tombstoned) one gets 410.
   - The guest opens `wss://…/v1/rooms/CODE/guest`. The Room DO refuses with a close code (4010, 4013, 4014 or 4015, or 4000 when full by the host's last report), or admits the guest with `{peerId, iceServers}`.
   - The guest sends its offer and trickled ICE, and the host answers through the DO.
   - When the channel opens, `RoomHost` greets the guest with `room` and today's handshake runs unchanged.
   - The guest closes its signal socket. The DO keeps each guest's signaling for at most 60 s and 200 messages of 16 KB each.
3. **Liveness and end.** These merge the architecture and matchmaking designs.
   - **Keepalive.** The host's signal socket sends `"ping"` every 20 s. `setWebSocketAutoResponse` answers it without waking the DO.
   - **Liveness check.** A Room DO alarm every 60 s checks `getWebSocketAutoResponseTimestamp` and the last message, and touches `seenAt` on the Lobby.
   - **Listing visibility.** The Lobby hides rows unseen for 90 s and deletes them after 180 s.
   - **Host signal socket drops** without an `end` message. The room is hidden and the host has 2 minutes to reconnect with its `hostKey`. Game traffic is unaffected meanwhile, because it runs peer to peer. After that the room ends.
   - **Host quits.** The host sends `end`, and the room ends at once.
   - **Hard cap.** Every room ends after 12 h.
   - **When a room ends.**
     - The Room DO calls `storage.deleteAll()`.
     - The Lobby deletes the listing and tombstones the code for 15 minutes, so an old invite says "That game has ended" instead of opening a stranger's new room.
     - The host sends `bye 4011` to every guest.
4. **Room lifetime inside the host** keeps today's rules. When the last guest leaves, the host keeps playing alone and a public room stays listed ("Finding survivors"). The room resets only when the host leaves.

### ICE and IP privacy

- **STUN.** `stun.cloudflare.com`, which is free.
- **TURN.**
  - `turn.cloudflare.com` offers UDP 3478/443, TCP 3478/80 and TLS 5349/443.
  - Credentials come from `POST https://rtc.live.cloudflare.com/v1/turn/keys/$TURN_KEY_ID/credentials/generate-ice-servers` (Bearer token, `{"ttl": 21600}`); drop the `:53` URLs.
  - They are minted only for an authenticated host or an admitted guest, over the room socket, never over plain HTTP.
- **Direct WebRTC shows each player's public IP to the other players** (the server-reflexive candidate). Browsers already hide local IPs behind mDNS. Default policy:
  - **Public rooms** set `iceTransportPolicy: 'relay'` on both ends, so strangers see only Cloudflare addresses.
  - **Private friend rooms** connect directly where possible, with the IP visibility disclosed on the Privacy page (open question 4).

## Server port (RoomHost extraction)

Task #7273 does this first. Every option needs it.

- **`shared/room/room-host.ts`.** `RoomHost` is today's `createRoom()` plus the admission and message-intake code now in `server.ts`, so the per-address caps, the join deadline, the oversize check and the flood allowance are shared by every adapter.
- **What is injected.** `RoomHost` talks to sockets through a `PeerSocket` interface and takes its clock and ID functions as parameters:

  ```ts
  export interface PeerSocket {
    readonly open: boolean;
    send(text: string): void;
    close(code: number, reason: string): void;
    drop(): void;                          // Node terminate(); DO close(1001); RTC close()
    canTakeFrame(bytes: number): boolean;  // Node/RTC bufferedAmount; DO ack frame gate
    probe(): void;                         // Node ping; DO and RTC no-op
  }
  export interface HostClock { now(): number; after(ms: number, fn: () => void): unknown; cancel(h: unknown): void }
  // RoomHostOptions: { sim, clock, newId(), restartVoteMs, joinDeadlineMs, heartbeatMs }
  ```

- **Files that move.** `server/packets.ts`, `home-packets.ts`, `limits.ts` and `restart-vote.ts` move into `shared/room/`, and `server/` re-exports them.
- **The Node adapter is `server/server.ts`.** It keeps `startGameServer(options)` and its test hooks, so `pnpm dev:server` and all the server suites stay unchanged:
  - `server.spec`
  - `server-home`
  - `server-home-stale-body`
  - `server-levels`
  - `server-overrun`
  - `server-style`
  - `server-workbench`
  - `coop-style`
  - `reconnect`
- **Adapters.**

  | Adapter | Link to the guest | `canTakeFrame` |
  |---|---|---|
  | Node `ws` | WebSocket (LAN and dev) | `bufferedAmount` |
  | Browser host | `RtcPeerSocket` over the data channel | `bufferedAmount` |
  | Room DO (option C) | hibernation-API sockets | the ack frame gate |

- **Guards.** An import guard spec fails on any `ws`, `node:` or `NodeJS.` reference under `shared/room/`.
- **Workerd hazards the port pass found:**
  - `randomInt` and `randomUUID` from `node:crypto`. The seed and `newId` are injected. The browser host uses `getRandomValues`, because `crypto.randomUUID` needs a secure context and a LAN http host is not one.
  - Module-level `WeakMap` caches in `shared/world-query.ts`, `exit-van.ts`, `loot.ts` and `containers.ts`. These are shared between rooms in one isolate. The risk is low because the keys belong to each sim. Task #7274 proves isolation.
  - `crypto.getRandomValues` works in workerd only inside handlers, never at module scope. Never build a sim at module top level.
- **Workers have no `bufferedAmount`.** The Workers WebSocket docs do not list it, so option C replaces it with an **ack frame gate**:
  - Input packets gain an optional `ack` field carrying the last snapshot tick received.
  - The server holds frames back while more than `MAX_BUFFERED_BYTES` (32 KB) are unacknowledged.
  - Only clients that have sent at least one ack are gated.
  - The client also sends a 20 s `"ping"` text keepalive. It is not JSON, so old servers drop it.

  This lands with option C (task #7296). It does nothing harmful against the Node server.

### Option C details (upgrade path, tasks #7297 and #7298)

- **Same class.** Option C runs in the same Room DO class with room kind `'server'`, so it needs no class migration. The DO runs `RoomHost` over hibernation-API sockets.
- **Tick timer.**
  - The tick is a `setTimeout` that runs only while players are joined.
  - Do not use alarms for the tick. Each alarm is a billed request, and 30 per second is about 2.6M a day.
  - When the room empties, the DO calls `sim.restart()`, stops its timers and can hibernate.
- **Rules the Node server does not have:**
  - Oversize frames are checked inside `RoomHost`, because Workers accept messages up to 32 MiB.
  - `CF-Connecting-IP` is kept in memory only.
  - The `ping` auto-response plus a 75 s sweep replace the 10 s protocol ping. Dead links are then detected in about 75 to 150 s (open question 18).
  - An idle room closes with 4017 after 10 min with no input from anyone (open question 17). Without that rule, a room where every tab is hidden could hit the 30 s CPU limit: the limit resets only when a message arrives, and the docs do not say that alarms or auto-replies reset it.
  - `locationHint` is taken from the host's continent.
  - A daily room-hour budget counter in the Lobby stops the free plan from overrunning silently.
- **Spike first.**
  - CPU use of a 30 Hz loop when every client is idle.
  - Memory per sim (the isolate limit is 128 MB).
  - Bundle size of `shared/`: 3 MB on Free and 10 MB on Paid, compressed.

## Matchmaking and teaming up

### Journeys

**(a) Friends: a code or a link.**
1. **Host a game** creates a **private** room. The host lobby shows the code and **Copy invite link** (`?room=CODE`).
2. A friend chooses **Join with code**: big letter boxes that auto-uppercase and accept only the code alphabet. The room is looked up on the last letter.
3. A room card then shows the style, difficulty, level, seats, which survivors are taken and the host's label.
4. The friend picks a free survivor. Taken survivors are greyed out with a "Taken" tag.
5. The walk is `mode`, then `who`. Style and difficulty are skipped because the room decides them, as `PLAY_JOIN` does today.

**(b) Strangers: Find a team (Quick play).**
- The walk is style, mode (Find a team), preferred difficulty, survivor, and then the **Find a team** button.
- That button sends `POST /v1/match`. The Lobby joins the best open public room or creates one with this player as host.
- **Filters.**
  - Style and protocol must match exactly.
  - Difficulty: an exact match comes before ±1, and ±2 never matches.
  - Campaign: the room's highest level must sit within [myHighest−2, myHighest+3] (open question 14).
  - Arcade: the room is in muster or at level 3 or lower.
  - The room is not full, locked, stale or on the player's `avoid` list.
- **Ranking:** same continent, then a free survivor for this player, then a desktop host, then more seats filled, then the younger room.
- **See open teams** lists up to 8 public rooms. The Worker edge-caches the list for 2 s, and the client polls every 10 s only while the list is open.
  - Rows show no callsigns.
  - The architecture pass proposed up to 50 rows; 8 fits a phone and shields the single Lobby.

**(c) Public and private.**
- Host a game is **private** by default. The host can flip **Open to anyone** at the mode step or later from the room chip.
- Find a team rooms are always public.
- The host can **Lock** a room. A locked room refuses new joins with 4013, and its code lookup says "This game is closed to new survivors".

**(d) Waiting room, joins and leaving.**
- **The host sets difficulty and style**, as the first player does today.
- **Campaign rooms wait in the bunker.** The bunker is the waiting room, and the van's everyone-ready rule is the ready-up.
- **Arcade rooms open on a Muster screen** (task #7293), with four seat cards.
  - The run starts when the fill timer ends (45 s, Quick play only; open question 16), when every seat is ready, or when the host presses Start now. A 5 s countdown comes first.
  - Players who are not ready come along.
- **Mid-run joins keep today's rules.** An Arcade player who joins after the first horde starts at half health. A Campaign player who joins mid-trip lands in town with gear in hand.
- **Survivor races.** The `taken` bitmask greys out survivors and feeds the ranking. The host's `freeCharacter` remains the backstop, and the muster card says which survivor you got.
- **Reconnect.** A guest's refresh keeps `tabToken()` plus `outbreak.room` (`{code, at}`) in sessionStorage. The title screen offers "Rejoin CODE" for 60 s, matching the home-loop body grace. `welcome.resumed` works unchanged (task #7287).
- **The host's refresh or tab close ends the room.**
  - The host gets a `beforeunload` warning.
  - Guests get `bye 4011`, "The host left".
  - Quick play guests re-match automatically with `avoid=[code]`. Code guests see ConnectionLost.
- **Host away.**
  - When the host's tab goes hidden, it sends `host_away`.
  - Guests show "Waiting for the host…" after 3 s with no frames.
  - After 30 s the room ends with 4016. Guests end it on their own timer, and a host that returns after 30 s ends it too.
  - A hosting phone must stay in front: iOS suspends a backgrounded page within seconds and Android freezes background tabs. The host holds a Screen Wake Lock and `GameController.onAway` never pauses a host.
- **Remove and leave.**
  - The host can **Remove** a player from the room chip: `bye 4012`, and that token is barred for the life of the room.
  - Any guest can **Leave team**. In Quick play that offers **Find another team**, which re-matches with `avoid=[code]`. That is the identity-free way to avoid a player.
- **No host migration.** The sim state includes RNG and map state, so moving it to a guest is a deep project. Option C is the answer if "the host left" becomes the top complaint.
- **Campaign rule needed (task #7284, open question 1).** Today a disconnect mid-trip counts as dying. A room the host ended (4011 or 4016) should instead **call off** the guest's trip: the gear taken out comes home, carried treasure is lost and nothing is gained. A guest's own quit or a plain drop still counts as dying.
- **Guests' Campaign homes and saves are unchanged.** A guest's `join.home` is validated by the host with the same `parseJoinHome` and `validateLoadout`. Each guest writes its own save from the receipt in its own snapshot. The host's save is the host's localStorage, as in solo play.

**(e) Latency and region.**
- The Lobby keeps the host's coarse `request.cf.continent` with the listing, and nowhere else.
- Matching widens to other continents only when nothing on the same continent fits.
- After connecting, the client takes five pings and shows bars: good under 80 ms, fair under 160 ms, poor above. In Quick play, over 250 ms offers "Find a closer team".
- Phone hosts are ranked last. Task #7290 has them send snapshots to guests at 15 Hz instead of 30; `interpolationDelayMs = 100` already absorbs that.

### Room codes (designer conflict resolved)

The three passes proposed different codes:
- 6 characters from a 28-character set, with digits (about 481M codes).
- 4 letters from 16 (65,536 codes).
- Unspecified.

**This spec uses 5 letters from `BCDFGHJKMNPRTVWX`**, which gives 1,048,576 codes (open question 6).

- **Letters only.** No vowels, so codes cannot spell words, and no look-alikes (I, L, O, Q, S, Z, Y or digits), so a child can read one aloud.
- **Why 5, not 4.** A guessed code in a friend room that connects directly would reveal a child's IP address, so 5 letters buys 16 times the guessing space.
- **Generation and input.** Codes come from `crypto.getRandomValues` and are checked against a small blocklist. Input is uppercased; digits and I, L and O are refused with "letters only".
- **Invite links.** Room invites use their own parameter, `?room=`. `sanitizeJoinAddress` accepts a bare host label, so a code must never travel in `?join=`. When both are present, `?room` wins. `?join=host:port` stays the LAN invite.

### UI in the Play flow (task #7283)

- **Mode step with Multiplayer chosen.** Three tiles appear under the callsign: **Find a team**, **Host a game** (with an Open to anyone toggle), and **Join with code**.
- **The server address field** becomes "Advanced: server address". It is shown only in dev builds, with `?server`, or after opening a LAN `?join=` invite. The LAN path is unchanged (open question 11).
- **`CoopEntry = 'find' | 'host' | 'code' | 'address'`** is a new field on `PlayFlow`. Each entry gets these steps:

  | Entry | Steps |
  |---|---|
  | find, host | style, mode, difficulty, who |
  | code, or a `?room=` link | mode, who |
  | address | today's walk |

- **Room chip in the HUD**, for example "CODE · 3/4 · Open". Tapping it gives Copy link, Open to anyone, Lock and Remove (Remove is host only).
- **ConnectionLost** gains text for every new close code.
- **Offline.** When the PWA is offline, the online tiles are disabled with "Needs internet". Solo is unaffected.
- **Builds without a play API.** With no `ZOMBIE_PLAY_API` set at build time, the Multiplayer screen is exactly today's.

### Callsign safety, chat and emotes

- **No free-text chat, ever.** There are six icon emotes instead (task #7294):

  | Emote | Icon |
  |---|---|
  | `help` | SOS hand |
  | `go` | arrow |
  | `thanks` | heart |
  | `wait` | palm |
  | `danger` | skull with `!` |
  | `nice` | thumbs-up |

  - Each is 16×16 pixel art. It shows over the survivor for 2 s, with an edge arrow when the player is off screen.
  - The host limits each player to 1 emote per 1.5 s, with a burst of 3.
  - Binding (open question 15, decided): hold **V** to open the six-way wheel and let go over an icon to send it, or click one. Nothing else uses V. On touch an HUD button on the left edge opens the same wheel. The wheel only shows in co-op. Sending bumped `PROTOCOL_VERSION` to 2.
- **Public rooms send no callsign.** The join carries `name: ''` and everyone is labelled by survivor name, which is unique in a room. (The architecture pass proposed generated names from word lists. Survivor names need no new list, so this spec uses them.)
- **Private rooms show the callsign after a shared filter**, `shared/callsign.ts`:
  1. normalise with NFKC;
  2. strip leetspeak and collapse repeated letters;
  3. check a small blocklist;
  4. fall back to the survivor name.

  The length is capped at 12 everywhere: the server's 16 is brought down to match the input. Guests run the same filter on what they display, because a host is just a browser (task #7285; open question 5).
- **No reports or mutes.** With no chat there is nothing to report. The tools are Leave team, Find another team and the host's Remove.
- **An optional "Play with strangers" switch in Options** hides Find a team (open question 3).

## Protocol changes and versioning

- **`PROTOCOL_VERSION = 1`** in `shared/protocol.ts` (task #7275).
  - Any packet change bumps it. The muster and emotes slices each bump it.
  - The room stores it when created. Listings, lookups and `join` carry it.
  - Quick play only pairs rooms with the same version.
  - A code join with a different version is closed with 4014. The older side reads "This game needs an update: reload", which triggers the existing SKIP_WAITING update prompt. The newer side reads "Your friend needs to update their game".
  - The Node adapter still accepts a join with no version, so LAN play keeps working with old tabs.
- **New ServerPackets:**
  - `{type:'bye', code, reason}`: a data channel has no close code, so this is sent before closing. `RtcPipe` maps it to `onClose(code)`.
  - `{type:'host_away', away}`.
  - `{type:'muster', seats, startsAt, fillEndsAt}`: Arcade online rooms only, sent before `welcome`.
- **New ClientPackets:**
  - `{type:'emote', emote}`.
  - `{type:'ready', ready}`: muster only.
  - Later, `{type:'seat', character}` to swap survivors while in muster.
  - `input` gains `ack` (option C only).
- **New event:** `{type:'emote', playerId, emote}` in `shared/events.ts`. It must be listed in the event arrays so `packet-guards.ts` accepts it. Unknown events must never freeze old clients.
- **Close codes** live in one table, `shared/close-codes.ts`. The client's duplicated constants are removed.
  - **Designer conflict:** the architecture pass used 4003 to 4005 for new codes, and the port pass used 4003 for "room idle". This spec takes the matchmaking pass's 4010 block and leaves 4003 to 4009 unused.

  | Code | Meaning | Code | Meaning |
  |---|---|---|---|
  | 4000 | room full (existing) | 4013 | locked |
  | 4001 | busy (existing) | 4014 | needs update (version mismatch) |
  | 4002 | no join within 10 s (existing) | 4015 | rate limited |
  | 4010 | no such room, or ended | 4016 | host away too long |
  | 4011 | host left | 4017 | room idle (option C only, if approved) |
  | 4012 | removed by host | 1009 | packet too big (existing `ws` behaviour) |

- **Lobby HTTP API** (`/v1`, JSON, CORS for `https://undeadofnight.forthexp.com` and `http://localhost:8096`):

  | Method and path | Request | Response |
  |---|---|---|
  | `POST /v1/rooms` | `{protocol, style, difficulty, visibility, device}` | `{code, hostKey}` |
  | `GET /v1/rooms/:code` | | `RoomCard`; 404 if missing, 410 if ended |
  | `POST /v1/match` | `{protocol, style, difficulty, character, highest?, avoid?: string[≤5]}` | `{kind:'join', code, card}`, `{kind:'host', code, hostKey}` or `{kind:'busy'}` |
  | `GET /v1/rooms?style=` | | up to 8 public open `RoomCard`s, edge-cached for 2 s |
  | `WS /v1/rooms/:code/host` | `hostKey` in the first message | the host's signal socket |
  | `WS /v1/rooms/:code/guest` | | the guest's signal socket |
  | `GET /health` | | ok |

  The shared types and runtime guards live in `shared/lobby/` (task #7280): `room-code.ts`, `types.ts`, `lobby-protocol.ts`, `match.ts` and `ttl.ts`. Both the Worker and the client import them, and they are tested by the root vitest.
- **Deploy order.** The Worker deploys before any client that calls new endpoints. In option A the "server" is a browser on some build, so `PROTOCOL_VERSION` replaces the README's "deploy the server before the client" rule for online rooms. The Worker never parses game packets, so game packet changes do not need a Worker redeploy.

## Privacy and child safety

The audience includes children, and the survivors are modelled on real kids.

- **No accounts, emails or device ids.** Tokens are per tab.
- **No free-text chat.**
- **Public rooms show no callsigns and hide IP addresses:** they send no callsign and are relay-only.
- **Private rooms are invite-only.** They are reached by code, can be locked, and the host can remove a player.
- **The Worker never stores an IP address.**
  - Per-IP limits are keyed by an HMAC of the IP with a daily in-memory salt.
  - Logs carry event names and reasons only (`room_created`, `join_refused:full`, `turn_minted`). They never contain IPs, callsigns or codes.
- **Room listings hold only:** code, style, difficulty, level, seats, taken survivors, phase, the host's device class and rough continent. They are deleted when the room ends, and the code is tombstoned for 15 min.
- **Per-IP limits.** The architecture and matchmaking passes proposed different values. These merge them:

  | Action | Limit per IP |
  |---|---|
  | Create a room | 6 per hour, and 2 live rooms at a time |
  | `match` | 30 per minute |
  | Code lookup | 20 per minute and 100 per hour; misses count double |
  | Room socket connects | 10 per minute |
  | TURN credential mints | 6 per hour |

  Schools and mobile carriers share IPs, so these may need loosening (see Risks).
- **Analytics** (task #7288; the allow-list lives in `catalog.ts`, and the privacy text changes in the same commit).
  - **New events:**
    - `lobby_open {entry}`
    - `match_result {result, wait_band, style}`
    - `room_end {reason, team_size, minutes_band}`
    - `connect_fail {stage, reason}`
  - **Changed events:**
    - `coop_join` gains `via`, `transport` (`direct`, `turn`, `relay`, `lan`) and `team_size`.
    - `run_start.mode` gains `host` and `guest`.
    - `run_end` gains an `emotes` count.
  - **Never sent:** room codes (they work like addresses), callsigns, continent or ping. GA already strips the query from `page_location`.
- **The Privacy page gains a Multiplayer section.** It explains:
  - play-api sees your IP address to connect you and does not store it;
  - what a room listing holds, and that it is deleted minutes after the room closes;
  - public rooms send no callsign and relay through Cloudflare, so other players cannot see your IP;
  - in friend rooms that connect directly, the players' devices can see each other's IP addresses.
- **COPPA.** The home-loop spec already flags COPPA for forthexp. **Public rooms (`PUBLIC_ROOMS_LIVE`) stay off until a qualified person has reviewed the updated Privacy page and the COPPA position** (open question 2). Private code rooms (`ONLINE_ROOMS_LIVE`) carry less risk and can ship first.
- **Turnstile** on room creation only if abuse appears, and only after checking its privacy fit.

## Deploy and rollback

### Project layout

```
apps/zombie-survival/play-api/      cf project (no wrangler file)
  package.json          {"type":"module","private":true}; devDeps cf, @cloudflare/workers-types (need your approval)
  tsconfig.json         workers types; the root tsconfig does not include play-api/
  cloudflare.config.ts  name "undead-play-api"; domains ["play-api.forthexp.com"]; observability {enabled, logs};
                        env: LOBBY, ROOM = durable objects; ALLOWED_ORIGINS text
                        ("https://undeadofnight.forthexp.com,http://localhost:8096"); TURN_ENABLED text ("1");
                        TURN_KEY_ID, TURN_KEY_API_TOKEN as secrets;
                        exports: Lobby, Room = exports.durableObject({storage: "sqlite"})
  src/index.ts  src/lobby.ts  src/room.ts  src/turn.ts  src/limits.ts  src/cors.ts
```

- The three passes used three folder names (`worker/`, `play-api/`, `cloud/`), three Worker names and three env vars. This spec settles on:
  - **`play-api/`** for the folder;
  - **`undead-play-api`** for the Worker;
  - **`ZOMBIE_PLAY_API`** for the env var, injected as `__ZOMBIE_PLAY_API__` through `vite.config.js` `define`, beside `__ZOMBIE_SERVER_PORT__`, following the existing `ZOMBIE_PORT` pattern.
- Free-plan Durable Objects must be SQLite-backed, so both classes are.
- `cf` (beta) needs Node 22.18 or later; this machine has 22.23.
- Task #7279 is a go/no-go spike that checks `cf dev` can host hibernating DO sockets. If it cannot, it records that as a decision and switches to a `wrangler.jsonc`.

### Commands you run (no credentials were used here)

`cf` does dev, build and deploy. `npx wrangler … --name undead-play-api` covers what `cf` cannot do yet: tail, single secrets and rollback. Check exact flags with `--help` first.

1. Install and check the CLI.
   ```bash
   npm install --global cf
   cf --version
   ```
   This installs `cf` and `cloudflare`. Use `cloudflare` if another `cf` is on your PATH.
2. Sign in and check the account.
   ```bash
   cf auth login
   cf auth whoami
   ```
   On the SSH host (mycompass.tempurl.host), use `cf auth login --no-browser` and approve on another device. Check that `whoami` shows the account that holds the forthexp.com zone.
3. In the dashboard, open **Realtime → TURN** and create a TURN key. Note the Key ID and the API token, and keep both out of chat and git.
4. Build without uploading anything.
   ```bash
   cd apps/zombie-survival/play-api
   cf build
   ```
5. Deploy.
   ```bash
   cf deploy
   ```
   This uploads the Worker, creates the `Lobby` and `Room` SQLite classes and attaches `play-api.forthexp.com`, with its DNS record and certificate made automatically.
   - **If `play-api` already has a DNS record,** remove it first.
   - **If the zone is not on this account,** deploy to `*.workers.dev` instead. CORS and the Origin check work the same.
6. Set the two secrets.
   ```bash
   npx wrangler secret put TURN_KEY_ID --name undead-play-api
   npx wrangler secret put TURN_KEY_API_TOKEN --name undead-play-api
   ```
   Or use `cf deploy --secrets-file <a file outside git>`.
7. Smoke-test the deploy.
   ```bash
   curl https://play-api.forthexp.com/health
   curl -i -H 'Origin: https://undeadofnight.forthexp.com' https://play-api.forthexp.com/v1/rooms
   npx wrangler tail undead-play-api
   ```
   The first should print `ok`. The second should print `[]` with an `Access-Control-Allow-Origin` header. The third streams live logs.
8. Build the client with the API address and publish to Pages as today.
   ```bash
   ZOMBIE_PLAY_API=https://play-api.forthexp.com chemx build -- vite build --config vite.config.js
   ```
   Whatever builds the Pages site must set this variable (open question 9).
9. Preview a deploy.
   ```bash
   cf previews deploy
   ```
   This prints the `preview_urls`.
10. Roll back.
    ```bash
    npx wrangler versions list --name undead-play-api
    npx wrangler rollback <VERSION_ID> --name undead-play-api --message "…"
    ```
    To take the client offline, rebuild Pages without `ZOMBIE_PLAY_API`. Rollback cannot undo creating or deleting a DO class. **Never delete a class:** that drops live rooms.
11. Optional, later: a GitHub Actions secret `CLOUDFLARE_API_TOKEN` with Workers Scripts Edit plus DNS and Workers Routes on forthexp.com. Keep deploys manual at first.

**Local dev.** Run `cd play-api && cf dev` and note the local URL it prints. Then run `ZOMBIE_PLAY_API=<that URL> pnpm dev`. The Node `ws` server stays for LAN play (`pnpm dev:server`).

## Things you must do yourself

1. Install `cf`, run `cf auth login` (with `--no-browser` over SSH) and confirm with `cf auth whoami` that this account holds the forthexp.com zone.
2. Confirm `play-api.forthexp.com` is free, with no existing DNS record.
3. Create the Realtime TURN key in the dashboard and set the `TURN_KEY_ID` and `TURN_KEY_API_TOKEN` secrets.
4. Choose Workers Free or Paid. A runs on Free; C needs Paid.
5. Set billing and usage alerts for Workers, Durable Objects and Realtime.
6. Run `cf deploy`, the smoke tests and any rollback.
7. Set `ZOMBIE_PLAY_API=https://play-api.forthexp.com` wherever the Pages site is built.
8. Approve the new dev dependencies in `play-api/package.json`: `cf` and `@cloudflare/workers-types`.
9. Have someone qualified review the Privacy page and the COPPA position before public rooms.
10. Flip `ONLINE_ROOMS_LIVE`, and later `PUBLIC_ROOMS_LIVE`.
11. Answer the open questions below.

## Costs

Prices were checked on 2026-11-06 on the Durable Objects pricing page (updated Oct 18, 2026), the DO limits page (Oct 29), the Workers pricing page (Oct 2) and the Realtime pricing and TURN pages.

| Item | Workers Free | Workers Paid ($5/month minimum) |
|---|---|---|
| Worker requests | 100,000/day | 10M/month, then $0.30/M |
| DO requests: a connect counts 1; incoming WebSocket messages are billed 20:1; outgoing messages are free | 100,000/day | 1M/month, then $0.15/M |
| DO duration (none while hibernated or idle) | 13,000 GB-s/day | 400,000 GB-s/month, then $12.50/M GB-s |
| DO SQLite | 5M rows read and 100k written per day, 5 GB | 25B read and 50M written per month included |
| STUN | free, unlimited | free, unlimited |
| Realtime TURN (shared with the SFU) | 1,000 GB free | then $0.05/GB egress |

The Realtime pricing page gives TURN's 1,000 GB as monthly. The TURN FAQ does not say per month. Check the dashboard. Workers have no egress charge.

**Option A.**
- Matchmaking with the 60 s liveness alarm costs roughly **150 to 200 DO requests per 4-player room-hour**. **The free tier covers about 500 room-hours a day.** (The architecture pass counted about 20 requests per room session without the liveness alarm. The alarm is part of this design, so the higher figure applies.)
- Each player on See open teams adds 360 Worker requests an hour while the list is open. The 2 s edge cache keeps most of these off the Lobby.
- **TURN** (when relayed, and always in public rooms): about 0.40 GB per relayed guest-hour, or about 0.12 GB compressed (measured above). The 1,000 GB free allowance covers about 2,500 relayed guest-hours uncompressed, or about 8,000 compressed.
  - Example: 6,000 public guest-hours a month is about 720 GB compressed (free) against about 2,400 GB uncompressed (about $70).
  - **That is why compression (task #7290) should land before public rooms go live.**

**Options B and C, per 4-player room-hour:**

| | Figure |
|---|---|
| Incoming messages | 120 per second |
| Billed requests (20:1) | 6 per second, **21,600** per room-hour |
| Duration | 3,600 s × 0.125 GB = **450 GB-s** |
| Free plan | runs out of requests after **about 4.6 room-hours a day** |
| Paid plan, included use | covers about 46 room-hours a month in requests and about 889 in duration |
| Paid plan, beyond that | about **$0.009 per room-hour** |
| Always-on rooms | 1 room ≈ $7/month; 10 ≈ $65/month; 100 ≈ $650/month |

Batching inputs at 15 Hz roughly halves the request share. B with 15 Hz inputs comes to about 13,500 requests and 460 GB-s per room-hour, about 7 room-hours a day on Free.

## Risks

- **The host is a single point of failure.** A room dies with the host's tab, or when a hosting phone goes to the background. Mitigated by the called-off trip rule, Quick play re-match, the Wake Lock, the 30 s host-away end, and C as the upgrade.
- **Host CPU and uplink on phones.**
  - Hosting adds the fan-out plus a constant 2.5 Mbps upload for three guests at 30 Hz.
  - On a slow phone the p99 step plus fan-out could approach the 33 ms budget while it is also rendering.
  - Mitigated by:
    - a "Best hosted on a computer" note;
    - a host Web Worker;
    - `deflate-raw`;
    - 15 Hz from touch hosts (task #7290).
- **Background throttling.** A hidden desktop tab throttles main-thread timers, and its Worker's behaviour needs checking (task #7290). Mobile browsers suspend background pages.
- **The `cf` CLI is beta.** Commands may change. It has no tail, single-secret or documented rollback commands yet. Hibernating DO sockets under `cf dev` are unproven, which the spike (task #7279) checks.
- **Children and strangers.** Mitigated by private-by-default rooms, public rooms gated behind a review, forced relay, no callsigns in public, no chat, and the host's Remove and Lock.
- **TURN abuse or cost spikes.** Mitigated by minting only after admission, per-IP caps, the `TURN_ENABLED` kill switch and billing alerts.
- **Shared IPs** (schools, carrier-grade NAT) can hit per-IP limits. Watch `connect_fail reason=rate_limited`.
- **Version drift** between host and guest builds is handled by `PROTOCOL_VERSION`, 4014 and the update prompt.
- **Reliable, ordered SCTP stalls on lossy links.** Accepted for v1.
- **A DO redeploy or restart** drops signaling sockets. In option A, live games carry on peer to peer. In option C, live rooms drop.
- **The Pages build pipeline is not in this repo** (open question 9).
- **The Workers vitest plugin documents Vitest 4.1 and later.** This repo pins vitest 5.1.0. DO contract tests therefore run against `cf dev` (open question 19), and pure logic stays in root specs.

## Test and rollout plan

**Tests.**
- **Pure TS, in the root vitest:**
  - `room-host` (all of today's server behaviour through `FakePeer` and a manual clock, plus host controls and muster), with an import guard;
  - two-sim isolation;
  - close codes, `room-code`, `invite-link`, `lobby-match`, `lobby-ttl`, `lobby-protocol`;
  - `callsign`, `emote`, `room-memory`, `play-flow`;
  - `analytics-catalog`, `privacy-text`, `snapshot-size`.
- **Node adapter:** every existing `tests/server*.spec.ts`, unchanged.
- **Worker:** logic is tested through the shared specs. Behaviour against `cf dev`:
  - find-or-create atomicity;
  - Origin refusal;
  - rate limits;
  - liveness alarm.
- **Real browsers (task #7292):** two Chrome profiles, Firefox and a phone. Check:
  - code join and Quick play;
  - host refresh ends the room (4011);
  - guest refresh resumes;
  - public rooms show only relay candidates in `getStats`;
  - a phone host at 15 Hz;
  - the 4014 and 4015 text.
- **Option C:** opt-in contract tests (`ZOMBIE_CLOUD_TESTS=1`) and a soak against `cf dev`: 4 bots for 10 min, 30 ± 1 snapshots/s, 0 unexpected closes, under 1% of frames held. Load at 10, 25, 50 and 100 rooms (task #7298).

**Rollout.**
0. Foundations, with no visible change: RoomHost, close codes, RemoteSession, room codes, lobby rules.
1. Spike, then deploy `/health` and an empty `/v1/rooms` to `play-api.forthexp.com`.
2. **Private rooms by code** behind `ONLINE_ROOMS_LIVE`, plus `?online` in a build that has `ZOMBIE_PLAY_API`. Ships with the privacy text, the called-off rule and rejoin.
3. **Host hardening:** Web Worker, compression, 15 Hz.
4. **Find a team** behind `PUBLIC_ROOMS_LIVE`, after a qualified review.
5. Muster and emotes.
6. Only if telemetry shows WebRTC-blocked players: the B relay.
7. Server-run rooms (C) on Workers Paid, for always-on public rooms that survive the host leaving.

## Build order

Dependency-ordered. The arrows show prerequisites.

1. #7273 RoomHost extraction (deep). #7274 isolation test (light), #7276 snapshot size (light), #7278 room codes (light) and #7279 cf spike (standard) can run in parallel with it.
2. #7275 close codes, bye and PROTOCOL_VERSION (standard), after #7273. #7280 lobby rules (standard), after #7278. #7285 callsign filter (standard), after #7273.
3. #7277 RemoteSession (standard), after #7275. #7284 called-off trip rule (standard), after #7275, once open question 1 is answered. #7294 emotes (standard), after #7275.
4. #7281 play-api Worker (deep), after #7279, #7280 and #7275. #7289 runbook (light), after #7281.
5. #7282 HostSession and RtcPipe, private rooms (deep), after #7273, #7277 and #7281.
6. After #7282: #7283 play flow (standard; also after #7278), #7286 host controls (standard), #7287 rejoin (standard), #7288 privacy and analytics (light), #7290 host hardening (deep; also after #7276) and #7293 muster (standard).
7. #7291 Find a team (deep), after #7281, #7283, #7285, #7286 and #7287.
8. #7292 real-browser check (standard), after #7291 and #7290.
9. Later: #7296 frame gate (standard) → #7297 server-run rooms (deep, also after #7274 and #7281) → #7298 contract tests and soak (standard). #7295 B relay (standard) is conditional on telemetry from #7288.

## Open questions for the user

Each has a recommended default.

1. **Host-ended Campaign trips.** Should a guest whose host left (4011) or went away too long (4016) have the trip *called off*: gear taken out comes home, carried treasure is lost, nothing is gained? Today any disconnect counts as dying. **Default: yes.** A guest's own quit or drop still counts as dying.
2. **Public rooms before review.** Should Find a team ship before a qualified privacy/COPPA review? **Default: no.** Ship private code rooms first and keep `PUBLIC_ROOMS_LIVE` off until the review signs off.
3. **"Play with strangers" switch.** Once public rooms are live, should Options have this switch, and what should it default to? **Default: present and on.** Public rooms already send no callsigns, force relay and have no chat.
4. **IP addresses in friend rooms.** Direct WebRTC lets friends' devices see each other's IPs. **Default: accept, with a disclosure on the Privacy page.** The alternative is to force relay for every room, at about 0.12 GB of TURN per guest-hour compressed.
5. **Callsigns.** **Default: public rooms send none and label players by survivor name; private rooms keep free text (12 characters) through the blocklist filter.** The alternative is a pick-from-a-list name everywhere.
6. **Room code length.** **Default: 5 letters from 16** (1,048,576 codes). 4 letters is easier for kids but gives only 65,536 codes; 6 is safer and harder to read aloud.
7. **Workers plan.** **Default: Free for option A.** Move to Paid ($5/month) only when building C or the B relay.
8. **The zone.** Is the forthexp.com zone in the Cloudflare account you will sign in with, and is `play-api.forthexp.com` free? **Default: yes.** If not, start on a `*.workers.dev` URL.
9. **The Pages build.** What builds and publishes the GitHub Pages site (hallofthegods.github.io)? It is not in this repo's `.github`. **Default:** add `ZOMBIE_PLAY_API` as a repository variable in that workflow.
10. **Phone hosts.** **Default: allowed, with a "Best hosted on a computer: keep the game in front and plug in" note, ranked last in Quick play, and sending 15 Hz to guests.**
11. **LAN play.** Keep the Node server's address field and `?join=host:port` invites? **Default: yes, under "Advanced: server address".** It shows in dev builds, with `?server`, or after a LAN invite.
12. **Connection telemetry.** Send the connection path (direct, turn, relay, failed) to Google Analytics, with a Privacy page line? **Default: yes.** It decides whether B is ever built.
13. **CLI and dependencies.** **Default:** `cf` (beta) with `cloudflare.config.ts`, plus `npx wrangler` for tail, secrets and rollback; and approve the new dev dependencies `cf` and `@cloudflare/workers-types` in `play-api/`. The alternative is Wrangler only, with a `wrangler.jsonc`.
14. **Campaign level band in Quick play.** **Default: the room's highest level must be within [myHighest−2, myHighest+3].** The alternative is to match any level.
15. **Emote binding.** **Default:** hold one key that weapons do not use to open a six-way wheel, plus a HUD button on touch. The emote slice checks the input map first.
16. **Arcade muster fill timer.** **Default: 45 s in Quick play, none in private rooms.** The host can always Start now.
17. **Option C only: idle rooms.** May a server-run room close with 4017 after 10 min with no input from any joined player? **Default: yes, on the Durable Object only.** The Node server never idles.
18. **Option C only: dead links.** Is it acceptable that a server-run room notices a dead link after about 75 to 150 s instead of today's 10 to 20 s? **Default: yes.** The longer window keeps hidden tabs in the room, and token takeover handles ghosts.
19. **Contract tests.** Should the Durable Object contract tests run against a `cf dev` process, opt-in with `ZOMBIE_CLOUD_TESTS=1`, instead of inside the Workers vitest plugin? **Default: yes,** because of the vitest 5.1.0 pin.

## Sources (checked 2026-11-06)

- [DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- [DO limits](https://developers.cloudflare.com/durable-objects/platform/limits/)
- [DO WebSockets and hibernation](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)
- [Workers WebSockets](https://developers.cloudflare.com/workers/runtime-apis/websockets/)
- [Workers performance and timers](https://developers.cloudflare.com/workers/runtime-apis/performance/)
- [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Realtime pricing](https://developers.cloudflare.com/realtime/pricing/)
- [Realtime TURN](https://developers.cloudflare.com/realtime/turn/)
- [TURN FAQ](https://developers.cloudflare.com/realtime/turn/faq/)
- [TURN credentials](https://developers.cloudflare.com/realtime/turn/generate-credentials/)
- [cf config](https://developers.cloudflare.com/cf/projects/cloudflare-config/)
- [cf projects](https://developers.cloudflare.com/cf/projects/)
- [Wrangler to cf reference](https://developers.cloudflare.com/cf/wrangler/reference/)
- [Wrangler versions and rollback](https://developers.cloudflare.com/workers/wrangler/commands/workers/)
- [Workers vitest integration](https://developers.cloudflare.com/workers/testing/vitest-integration/write-your-first-test/)
