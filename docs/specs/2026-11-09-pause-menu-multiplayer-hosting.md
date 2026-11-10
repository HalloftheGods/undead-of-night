# Pause Menu Multiplayer Hosting

Seamless transition from an in-progress solo game to a player-hosted WebRTC co-op room.

## Overview

Players can switch an ongoing solo run directly into an online multiplayer session from the pause menu. The existing simulation state, world seed, level, player inventory, health, and zombie spawns are preserved, and a room code is generated for friends to join.

## Architecture & Flow

1. **Pause Menu Trigger**:
   - When in `solo` mode on an active run (excluding daily challenge runs), `PauseMenu.vue` displays a "Switch to multiplayer" button.
   - Pressing the button calls `game.hostCurrentRun()`.

2. **Session Handover**:
   - `RunSession.hostCurrentRun()` extracts the active `GameSimulation` from `LocalSession`.
   - `LocalSession` is paused and held as a fallback.
   - `online-session.ts` is dynamically imported to load RTC and room hosting dependencies without bundle overhead for solo players.
   - `hostRoom` initializes `HostSession` with `existingSim: sim`.

3. **Entity Claiming & Promotion**:
   - `sim.bindLocalPlayerToken(token)` binds the solo `'local'` player entity with the host's session token and switches workbench mode to `timed`.
   - When the host's internal `RemoteSession` loops back and issues a `join` packet, `reclaimLive` in `player-roster.ts` reclaims the existing player entity under the host's new network ID.
   - `onWelcome` updates `ClientWorld` with the new player ID and preserves the pause overlay so the room code remains visible.

4. **Fault Tolerance**:
   - If room creation or signaling negotiation fails before `onWelcome`, `fallbackSoloSession` automatically restores `state.transport` to `LocalSession` and surfaces `ui.error` without losing run progress.
