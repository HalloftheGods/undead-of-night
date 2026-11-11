# Carried Survival Supplies

## Overview
Survival supplies (`bandage`, `canned_food`, `water_bottle`, `disinfectant`, `antibiotics`) are carried grid items rather than instant-use pickups. They integrate with the player bag, auto-use from pockets when needed, support manual use and dropping via inventory actions, and persist across banked trips into the bunker locker.

## Core Mechanics

### 1. Pickup and Bag Storage
* Walking over a supply item automatically stores it into the player's carried supplies.
* No individual numerical caps exist; inventory grid space is the sole limit.
* If the player's pack and pockets have no free slot, the supply remains on the ground.
* Supplies clear on player death or run reset, matching medkit behavior.

### 2. Auto-Consumption from Pockets
Each simulation tick evaluates supplies held in the 2x2 pocket grid via `usePocketSupplies(p)`:
* **Bandage:** Used when player is bleeding, or health is at or below 50% (`POCKET_BANDAGE_SHARE = 0.5`). Heals missing HP (up to max HP) and binds open bleeding wounds.
* **Canned Food:** Consumed when hunger reaches or exceeds 60 (`POCKET_EAT_AT = 60`).
* **Water Bottle:** Consumed when thirst reaches or exceeds 60 (`POCKET_DRINK_AT = 60`).
* **Disinfectant:** Applied when infected and wound type is a scratch or laceration.
* **Antibiotics:** Taken when infection progression reaches or exceeds 35 (`POCKET_ANTIBIOTICS_AT = 35`).
* Pack items are never auto-consumed; only pocketed items trigger automated survival responses.

### 3. Manual Bag Actions (USE and DROP)
* In the inventory modal, holding an item displays action buttons on `HeldItemPanel.vue`:
  * **USE:** Uses the item immediately if applicable, consuming one unit from carried supplies.
  * **DROP:** Leaves the item on the ground as a world pickup.
* Manual uses are sent with the bag commit wire packet under `BagCommit.use` (`readonly BagDrop[]`).
* Wire validation ensures counts are positive integers and types match valid supplies before applying via `useSupply`.

### 4. Bunker Locker Carryover
* Banked trip receipts merge carried supplies into the bunker locker via `mergeHome(locker, gear)`.
* In the bunker, the locker screen allows transferring supplies between the player's hands and the locker.
