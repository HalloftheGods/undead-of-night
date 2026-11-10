# Subterranean Sewer System & Street Manhole Network

Status: APPROVED by Commander (2026-11-09). Design decisions are locked; only balance numbers stay open for playtesting.
Line: GAME FORGE · FEATURE PIPELINE (Producer → Engineer → Playtester → Game Master). The line never deploys.
Coordination: all edits go through Chemical X (chemx). Claim the phase task, lock files, run `chemx test` / `chemx typecheck`.

Introduce a connected subterranean sewer tunnel network beneath the town map, reached through surface street manholes. It gives underground traversal between distinct town districts, dark tunnels with murky sludge canals, sparse zombie lurkers, interactive manhole covers, and multi-mode horde dynamics.

## Locked decisions
- **Interaction**: Option 2. Players must interact (`E: Climb Down` or touch equivalent) with manhole covers and sewer ladders to move between street and sewer. Zombies use automatic flow-field traversal.
- **Sludge**: sludge canals use standard sludge properties (0.65x movement, 1.2x noise, sludge splash audio).
- **Hordes**: blended model (Surface Horde Descent + Sewer Pipe Surges + Tunnel Horde Spawning).
- Open tuning only: 50% tunnel-vs-surface horde roll while underground, 8-12 surge zombie count.

## Phasing (one line job per phase; each phase must pass tests on its own)
- **Phase 1: World + interaction.** map-protocol.ts, sewers.ts (new), world-map.ts, world-query.ts, take-manhole.ts (new), players.ts. Tests: sewers.spec.ts, take-manhole.spec.ts; storeys/flow-field/world-map specs stay green.
- **Phase 2: Zombie dynamics.** town-population.ts (sewer roamers), waves.ts (surface descent, tunnel spawn roll, pipe surges).
- **Phase 3: Art, HUD, audio.** src/art/environment/sewer-props.ts (new, Art Director), environment.ts, overlay-renderer.ts, town-map.ts, event-sounds.ts.

## Proposed changes

### Data model & world protocol: `shared/map-protocol.ts`
- `PROP_DEFS`: `manhole` `{ w: 16, h: 16 }` (walk-through street prop); `sewer_ladder` `{ w: 16, h: 6 }` (wall-mounted iron ladder in the shaft).
- `BUILDING_DEFS`:
  - `sewer_junction`: `{ label: 'Sewer Junction', w: 128, h: 128, doorX: 64, floor: 'floor_concrete' }`
  - `sewer_tunnel_h`: `{ label: 'Sewer Tunnel', w: 192, h: 96, doorX: 96, floor: 'floor_concrete' }`
  - `sewer_tunnel_v`: `{ label: 'Sewer Tunnel', w: 96, h: 192, doorX: 48, floor: 'floor_concrete' }`
  - `sewer_pump_station`: `{ label: 'Pump Station', w: 160, h: 128, doorX: 80, floor: 'floor_concrete' }`
- Sewer district labels in the `District` interface.

### Procedural generation: `shared/sewers.ts` (new)
- `planSewers(seed, roads, cols, townRows)`, deterministic:
  - Pick 4-6 road crossings/intersections across distinct quadrants (NW residential, NE industrial/medical, Downtown commercial, SE park/edge).
  - Place `manhole` props on surface streets.
  - Generate a connected underground layout in the annex band below `townRows`.
  - Carve central drainage trenches of `sludge`/`water` tiles flanked by `floor_concrete` walkways.
  - Connect each manhole to a ladder shaft with two-way `Flight` pairs (`label: 'SEWERS'` down, `label: 'SURFACE'` up).
  - Mark manhole flights interactive (need `E`, not walk-over).

### `shared/world-map.ts`
- `withSewers(town, plan)` in the pipeline alongside `withStoreys`.
- Annex rows sized for both storeys and the sewer grid.
- Sewer lights (dim sodium yellow, emergency green) in `lightsFor`.

### `shared/world-query.ts`
- `groundOf(map, x, y)`: sewer coordinates map to the nearest surface street / manhole, so sound, gunshot alerts and map indicators project to the town.
- `voidBoxes` wraps sewer corridors in solid void.

### Interaction: `shared/take-manhole.ts` (new) + `shared/players.ts`
- Check player distance to `manhole` / `sewer_ladder`; on `search` (`E` or touch) inside range, move across the flight and play lid clank / ladder sound.
- Zombies keep using `takeStairs(z, sim.flow)` through shafts.
- `players.ts` calls `takeManhole(sim, p)` in the action loop.

### Zombies: `shared/town-population.ts`, `shared/waves.ts`
- Sewer roamers: 1-2 per chamber, more bloaters/crawlers/shamblers, no brutes.
- Surface Horde Infiltration: horde spawns on streets via `groundOf`; pathing zombies descend open manholes.
- Tunnel Horde Spawning: if the player is underground when a horde triggers, a roll (50%) spawns it in distant sewer chambers out of sight.
- Sewer Pipe Surges: periodic 8-12 fast lurkers/bloaters from pipe outflows with an audio cue.

### Art, HUD, audio
- `src/art/environment/sewer-props.ts` (new): manhole (cast iron, crosshatch, perimeter ring, keyhole slot), sewer_ladder (iron rungs, drop shadow), pipe mouths, overflow grates, wall conduits.
- `src/art/environment.ts`: register `manhole`, `sewer_ladder` in `buildEnvironment().props`.
- `src/engine/overlay-renderer.ts`: `PRESS E: CLIMB DOWN` / `CLIMB DOWN` (touch) at manholes; `PRESS E: CLIMB TO STREET` / `CLIMB UP` at ladders.
- `src/game/town-map.ts`: iron-circle manhole markers; "UNDERGROUND - SEWERS" subtitle when below town rows.
- `src/audio/event-sounds.ts`: lid scrape/clank, echoey ladder climb, pipe rattle / rushing water on surges.

## Done means (playtester checklist)
1. `chemx test tests/sewers.spec.ts`, `tests/take-manhole.spec.ts`, `tests/storeys.spec.ts`, `tests/flow-field.spec.ts`, `tests/world-map.spec.ts` pass; `chemx typecheck` clean.
2. Sewer layout is deterministic per seed.
3. Every manhole has a matching ladder flight and vice versa.
4. Manhole transition happens only on `search` / `E`.
5. FlowField connects street tiles to tunnel tiles across manhole flights.
6. `circleHitsSolid`: walkways/tunnels clear; perimeter walls and void solid.
7. Sludge tiles give 0.65x base speed; concrete gives 1.0x.
8. Sewer roamer density stays within 1-2 per chamber; no brutes.
9. Horde routing picks surface descent or tunnel spawn per the roll.
10. Manual: prompt at manhole, E climbs down with sound, sludge slows and splashes, horde descends shafts, tunnel spawn emerges from pipe chambers, ladder exits in a different district.
