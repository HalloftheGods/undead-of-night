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
  MAX_PLANKS_PER_OPENING,
  NAILS_PER_PLANK,
  repairBarricade,
  rollFortificationLoot,
  shatterWindow,
  toggleCurtain,
  WINDOW_SHATTER_NOISE_RADIUS,
} from '../shared/fortifications.ts';

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
