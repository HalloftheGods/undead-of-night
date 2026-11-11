import { describe, expect, it } from 'vitest';
import {
  addPlank,
  blocksLineOfSight,
  blocksPassage,
  canAddPlank,
  canDismantlePlank,
  clearBrokenGlass,
  createBarricadeOpening,
  createEmptyFortificationInventory,
  damageBarricade,
  dismantlePlank,
  FORTIFICATION_ITEMS,
  FORTIFICATION_LOOT,
  HEALTH_PER_PLANK,
  installCurtain,
  isFortificationItem,
  MAX_PLANKS_PER_OPENING,
  NAILS_PER_PLANK,
  repairBarricade,
  rollFortificationLoot,
  shatterWindow,
  takeFortificationItem,
  toggleCurtain,
  WINDOW_SHATTER_NOISE_RADIUS,
} from '../shared/fortifications.ts';
import { createPlayer } from '../shared/player-roster.ts';
import { spawnPickup, updatePickups } from '../shared/pickups.ts';
import { createSimState } from '../shared/sim-factory.ts';
import { generateWorldMap } from '../shared/world-map.ts';

describe('Fortification Item Definitions & Loot Tables', () => {
  it('defines valid carpentry materials and tools', () => {
    expect(FORTIFICATION_ITEMS.plank.isTool).toBe(false);
    expect(FORTIFICATION_ITEMS.plank.unitsPerFind).toBe(2);

    expect(FORTIFICATION_ITEMS.nails.isTool).toBe(false);
    expect(FORTIFICATION_ITEMS.nails.unitsPerFind).toBe(8);

    expect(FORTIFICATION_ITEMS.hammer_tool.isTool).toBe(true);
    expect(FORTIFICATION_ITEMS.crowbar.isTool).toBe(true);
    expect(FORTIFICATION_ITEMS.sheet_curtain.isTool).toBe(false);
  });

  it('rolls loot drops matching building kinds', () => {
    const fixedRng = (value: number) => () => value;

    // Garage with 0.1 roll hits the 0.65 odds
    const garageHit = rollFortificationLoot('garage', fixedRng(0.1));
    expect(garageHit).not.toBeNull();

    // Grocery with 0.8 roll misses the 0.15 odds
    const groceryMiss = rollFortificationLoot('grocery', fixedRng(0.8));
    expect(groceryMiss).toBeNull();
  });
});

describe('Barricade Construction & Planks Mechanics', () => {
  it('creates an opening with correct initial health according to planks', () => {
    const emptyDoor = createBarricadeOpening('d1', 'b1', 'door', 100, 100, 32, 16, 'south');
    expect(emptyDoor.planks).toBe(0);
    expect(emptyDoor.health).toBe(0);
    expect(emptyDoor.maxHealth).toBe(0);

    const reinforcedDoor = createBarricadeOpening('d2', 'b1', 'door', 100, 100, 32, 16, 'south', {
      planks: 2,
    });
    expect(reinforcedDoor.planks).toBe(2);
    expect(reinforcedDoor.health).toBe(200);
    expect(reinforcedDoor.maxHealth).toBe(200);
  });

  it('verifies material requirements when adding planks', () => {
    const opening = createBarricadeOpening('d1', 'b1', 'door', 100, 100, 32, 16, 'south');
    const inv = createEmptyFortificationInventory();

    // Missing hammer, planks and nails
    expect(canAddPlank(inv, opening)).toBe(false);

    // Has hammer and planks, but missing nails
    inv.hasHammer = true;
    inv.planks = 2;
    inv.nails = 1;
    expect(canAddPlank(inv, opening)).toBe(false);

    // Has hammer, planks and required nails
    inv.nails = NAILS_PER_PLANK;
    expect(canAddPlank(inv, opening)).toBe(true);

    // Successfully adds plank and consumes resources
    const success = addPlank(inv, opening);
    expect(success).toBe(true);
    expect(inv.planks).toBe(1);
    expect(inv.nails).toBe(0);
    expect(opening.planks).toBe(1);
    expect(opening.health).toBe(HEALTH_PER_PLANK);
    expect(opening.maxHealth).toBe(HEALTH_PER_PLANK);
  });

  it('caps planks at maximum threshold', () => {
    const opening = createBarricadeOpening('d1', 'b1', 'door', 100, 100, 32, 16, 'south', {
      planks: MAX_PLANKS_PER_OPENING,
    });
    const inv = createEmptyFortificationInventory();
    inv.hasHammer = true;
    inv.planks = 10;
    inv.nails = 20;

    expect(canAddPlank(inv, opening)).toBe(false);
    expect(addPlank(inv, opening)).toBe(false);
  });

  it('dismantles planks with crowbar or hammer returning salvage', () => {
    const opening = createBarricadeOpening('d1', 'b1', 'door', 100, 100, 32, 16, 'south', {
      planks: 3,
    });
    const inv = createEmptyFortificationInventory();

    // No tool
    expect(canDismantlePlank(inv, opening)).toBe(false);

    inv.hasCrowbar = true;
    expect(canDismantlePlank(inv, opening)).toBe(true);

    const dismantled = dismantlePlank(inv, opening);
    expect(dismantled).toBe(true);
    expect(opening.planks).toBe(2);
    expect(opening.health).toBe(200);
    expect(inv.planks).toBe(1);
    expect(inv.nails).toBe(1);
  });

  it('repairs damaged barricades with nails and hammer', () => {
    const opening = createBarricadeOpening('d1', 'b1', 'door', 100, 100, 32, 16, 'south', {
      planks: 2,
    });
    opening.health = 120; // Damaged from 200

    const inv = createEmptyFortificationInventory();
    inv.hasHammer = true;
    inv.nails = 2;

    const repaired = repairBarricade(inv, opening);
    expect(repaired).toBe(true);
    expect(opening.health).toBe(170);
    expect(inv.nails).toBe(1);
  });
});

describe('Barricade Degradation & Zombie Assault', () => {
  it('damages barricade, reduces health and splinters off planks sequentially', () => {
    const opening = createBarricadeOpening('d1', 'b1', 'door', 100, 100, 32, 16, 'south', {
      planks: 3,
    });
    expect(opening.health).toBe(300);

    // Minor damage: no plank drops yet
    const minorHit = damageBarricade(opening, 40);
    expect(minorHit.brokenPlanks).toBe(0);
    expect(minorHit.destroyed).toBe(false);
    expect(minorHit.remainingHealth).toBe(260);
    expect(opening.planks).toBe(3);

    // Heavy damage crosses plank threshold (260 - 80 = 180 -> 2 planks left)
    const heavyHit = damageBarricade(opening, 80);
    expect(heavyHit.brokenPlanks).toBe(1);
    expect(heavyHit.destroyed).toBe(false);
    expect(heavyHit.remainingHealth).toBe(180);
    expect(opening.planks).toBe(2);

    // Lethal damage wipes remaining health
    const fatalHit = damageBarricade(opening, 250);
    expect(fatalHit.brokenPlanks).toBe(2);
    expect(fatalHit.destroyed).toBe(true);
    expect(fatalHit.remainingHealth).toBe(0);
    expect(opening.planks).toBe(0);
  });
});

describe('Window Shattering, Glass Clearing & Curtains', () => {
  it('shatters window glass and emits noise event', () => {
    const windowOpening = createBarricadeOpening('w1', 'b1', 'window', 100, 100, 16, 16, 'north');
    expect(windowOpening.isBroken).toBe(false);

    const result = shatterWindow(windowOpening);
    expect(result.shattered).toBe(true);
    expect(result.noiseRadius).toBe(WINDOW_SHATTER_NOISE_RADIUS);
    expect(windowOpening.isBroken).toBe(true);
    expect(windowOpening.glassCleared).toBe(false);

    // Second shatter call is no-op
    const repeatResult = shatterWindow(windowOpening);
    expect(repeatResult.shattered).toBe(false);
  });

  it('clears broken glass with tool', () => {
    const windowOpening = createBarricadeOpening('w1', 'b1', 'window', 100, 100, 16, 16, 'north', {
      isBroken: true,
    });

    // Without tool cannot safely clear
    expect(clearBrokenGlass(windowOpening, false)).toBe(false);

    // With tool safely clears jagged glass
    expect(clearBrokenGlass(windowOpening, true)).toBe(true);
    expect(windowOpening.glassCleared).toBe(true);
  });

  it('installs and toggles sheet curtains to block line of sight', () => {
    const windowOpening = createBarricadeOpening('w1', 'b1', 'window', 100, 100, 16, 16, 'north');
    const inv = createEmptyFortificationInventory();
    inv.sheets = 1;

    expect(blocksLineOfSight(windowOpening)).toBe(false);

    const installed = installCurtain(inv, windowOpening);
    expect(installed).toBe(true);
    expect(inv.sheets).toBe(0);
    expect(windowOpening.hasCurtain).toBe(true);
    expect(windowOpening.isCurtainClosed).toBe(true);
    expect(blocksLineOfSight(windowOpening)).toBe(true);

    // Toggle curtain open
    toggleCurtain(windowOpening);
    expect(windowOpening.isCurtainClosed).toBe(false);
    expect(blocksLineOfSight(windowOpening)).toBe(false);
  });

  it('evaluates movement passage blockage', () => {
    const door = createBarricadeOpening('d1', 'b1', 'door', 100, 100, 32, 16, 'south');
    expect(blocksPassage(door)).toBe(false);

    door.planks = 1;
    expect(blocksPassage(door)).toBe(true);

    const windowOpening = createBarricadeOpening('w1', 'b1', 'window', 100, 100, 16, 16, 'north');
    // Intact glass blocks walking through
    expect(blocksPassage(windowOpening)).toBe(true);

    // Shattered window allows vaulting through
    windowOpening.isBroken = true;
    expect(blocksPassage(windowOpening)).toBe(false);
  });
});

describe('Fortification Drops, Pickup Collection & Inventory Caps', () => {
  it('correctly validates fortification item types', () => {
    expect(isFortificationItem('plank')).toBe(true);
    expect(isFortificationItem('nails')).toBe(true);
    expect(isFortificationItem('hammer_tool')).toBe(true);
    expect(isFortificationItem('crowbar')).toBe(true);
    expect(isFortificationItem('sheet_curtain')).toBe(true);
    expect(isFortificationItem('bandage')).toBe(false);
  });

  it('enforces plank storage caps based on backpack tier', () => {
    const inv = createEmptyFortificationInventory();

    // Satchel tier allows up to 2 planks
    const satchelPlank1 = takeFortificationItem(inv, 'plank', 'satchel');
    const satchelPlank2 = takeFortificationItem(inv, 'plank', 'satchel');
    const satchelPlank3 = takeFortificationItem(inv, 'plank', 'satchel');
    expect(satchelPlank1).toBe(true);
    expect(satchelPlank2).toBe(true);
    expect(satchelPlank3).toBe(false);
    expect(inv.planks).toBe(2);

    // Duffel tier allows up to 4 planks
    const duffelPlank3 = takeFortificationItem(inv, 'plank', 'duffel');
    const duffelPlank4 = takeFortificationItem(inv, 'plank', 'duffel');
    const duffelPlank5 = takeFortificationItem(inv, 'plank', 'duffel');
    expect(duffelPlank3).toBe(true);
    expect(duffelPlank4).toBe(true);
    expect(duffelPlank5).toBe(false);
    expect(inv.planks).toBe(4);

    // Alice tier allows up to 8 planks
    inv.planks = 6;
    const alicePlank7 = takeFortificationItem(inv, 'plank', 'alice');
    const alicePlank8 = takeFortificationItem(inv, 'plank', 'alice');
    const alicePlank9 = takeFortificationItem(inv, 'plank', 'alice');
    expect(alicePlank7).toBe(true);
    expect(alicePlank8).toBe(true);
    expect(alicePlank9).toBe(false);
    expect(inv.planks).toBe(8);
  });

  it('rejects duplicate hammer and crowbar tools', () => {
    const inv = createEmptyFortificationInventory();

    const hammerFirst = takeFortificationItem(inv, 'hammer_tool');
    const hammerSecond = takeFortificationItem(inv, 'hammer_tool');
    expect(hammerFirst).toBe(true);
    expect(hammerSecond).toBe(false);
    expect(inv.hasHammer).toBe(true);

    const crowbarFirst = takeFortificationItem(inv, 'crowbar');
    const crowbarSecond = takeFortificationItem(inv, 'crowbar');
    expect(crowbarFirst).toBe(true);
    expect(crowbarSecond).toBe(false);
    expect(inv.hasCrowbar).toBe(true);
  });

  it('collects ground fortification pickups into player materials', () => {
    const map = generateWorldMap(1234);
    const sim = createSimState({ map, difficulty: 'stay_close' });
    const player = createPlayer({ id: 'p1', name: 'Builder', token: null, skin: 0 }, { x: 100, y: 100 });
    sim.players = [player];
    sim.pickups = [];

    spawnPickup(sim, 'plank', 100, 100);
    spawnPickup(sim, 'nails', 100, 100);
    spawnPickup(sim, 'hammer_tool', 100, 100);

    expect(sim.pickups.length).toBe(3);
    updatePickups(sim);

    expect(player.materials.planks).toBe(1);
    expect(player.materials.nails).toBe(8);
    expect(player.materials.hasHammer).toBe(true);
    expect(sim.pickups.length).toBe(0);

    const pickupEvents = sim.events.filter((e) => e.type === 'pickup');
    expect(pickupEvents.length).toBe(3);
  });

  it('leaves excess planks on the ground when player inventory is full', () => {
    const map = generateWorldMap(5678);
    const sim = createSimState({ map, difficulty: 'stay_close' });
    const player = createPlayer({ id: 'p1', name: 'Survivor', token: null, skin: 0 }, { x: 200, y: 200 });
    player.backpackTier = 'satchel';
    player.materials.planks = 2; // Cap for satchel
    sim.players = [player];
    sim.pickups = [];

    spawnPickup(sim, 'plank', 200, 200);
    expect(sim.pickups.length).toBe(1);

    updatePickups(sim);

    // Plank could not be picked up, stays on ground
    expect(player.materials.planks).toBe(2);
    expect(sim.pickups.length).toBe(1);
  });
});
