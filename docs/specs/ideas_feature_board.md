# Feature Ideas & Backlog Board

Documented from playtest review and design session (Ronan and Commander).

## Status Breakdown

### 1. Weapons and Upgrades
* **Carrying Cap (3 Weapons Max)**
  * Status: Done
  * Implementation: `shared/protocol.ts` (`WEAPON_ORDER = ['pistol', 'carbine', 'shotgun']`).
* **Interactive Suppressor Installation**
  * Status: Proposed (New)
  * Concept: Mouse-driven circular rotation minigame on workbench to screw on suppressor.
* **Pyromaniac Weapon Pack**
  * Status: Proposed (New)
  * Concept: Flamethrower, fuel ammo, car and gas station fuel siphoning.

### 2. Sewer System and Hazards
* **Oversized Zombies Wedged in Manholes**
  * Status: Done
  * Implementation: `shared/zombies.ts` (`MAX_SEWER_ZOMBIE_RADIUS = 6`, `z.stuck = true` on sewer entry).
* **Toxic Sewer Spitter Zombie**
  * Status: Proposed (New)
  * Concept: Distinct roamer with runner health and bloater silhouette; attacks by projectile vomiting toxic sludge.
* **Sewer Stash Chests**
  * Status: Proposed (New)
  * Concept: High-value loot containers placed in dry dead-ends of sewer sumps.
* **Flood Level Drainage Interaction**
  * Status: Proposed (New)
  * Concept: Underground pump/drain station valve to lower surface water level.

### 3. Inventory and Looting
* **DayZ Spatial Grid Inventory**
  * Status: In Progress
  * Built: `shared/grid-inventory.ts` and `shared/bag.ts` with item footprints, multi-slot sizing, and rotation.
  * Remaining: Character sprite rendering of worn backpacks and vests.
* **Mobile Inventory and Map Navigation**
  * Status: Proposed (New)
  * Concept: Walking continues at reduced speed (e.g., 50%) while browsing candy bag, town map, or backpack.
* **Arc Raiders Style Container Searching**
  * Status: Proposed (New)
  * Concept: Container window opens; slots reveal individually over short ticks (~0.5s) with drag-and-drop looting.
* **Themed Loot and Map Clue Caches**
  * Status: Done
  * Implementation: `shared/container-search.ts` (`MAP_CLUE_CHANCE`, dumpster scrounging, emergency vehicle drops).

### 4. Fortifications and Exploration
* **Door Barricades, Window Curtains, and Vaulting**
  * Status: Done
  * Implementation: `shared/fortifications.ts` (door closing, plank/nail counts, zombie door damage scaling, curtains, glass vaulting).
* **Town Street Corpses and Reanimation**
  * Status: Partially Done
  * Built: `shared/hazards.ts` (decaying zombie corpses generate sickness fields).
  * Remaining: Ambient human dead pre-placed on streets with chance to reanimate on close approach.

### 5. Campaign, Story, and Endgame Modes
* **Intel Chain to Military Outpost (Round 10)**
  * Status: Proposed (New)
  * Concept: Narrative intel items dropped per round revealing coordinates to fortified military compound.
* **Endless Military Defense (Horde Mode)**
  * Status: Proposed (New)
  * Concept: Unlockable horde defense mode at Level 10 with allied military NPCs and mounted turrets.

### 6. Vehicles and Transportation
* **Vehicle Spawning and Visual State**
  * Status: Proposed (New)
  * Concept: 95% wrecked static/lootable road obstacles; 5% rare running road spawns with idling lights; high-value indoor garage and storage unit spawns.
* **Streamlined Vehicle Controls**
  * Status: Proposed (New)
  * Concept: Context-sensitive `[E]` interaction (drive/exit/garages), standard WASD/arrow driving controls, Space/H horn attraction pulse.
* **Vehicle Movement, Roadkill Combat, and Maintenance**
  * Status: Proposed (New)
  * Concept: 2D top-down vehicle physics state (acceleration, momentum, angular steering), velocity-threshold zombie roadkill with player XP, fuel/health degradation requiring gas cans or engine blocks.

### 7. UI and Tactical HUD
* **MGS Style Soliton Radar Display (Bottom-Left)**
  * Status: Proposed (New)
  * Concept: Bottom-left tactical radar display showing player position, enemy dots with directional field-of-view vision cones, expanding sound wave pulses (footsteps, gunfire, vehicle horns), and local wall geometry.
