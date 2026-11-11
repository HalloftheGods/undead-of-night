import { describe, expect, it } from 'vitest';
import {
  addPlank,
  calculateDoorDamage,
  calculateDoorMaxHealth,
  createBarricadeOpening,
  createDoorOpening,
  createEmptyFortificationInventory,
  damageDoorOpening,
  dismantlePlank,
  DOOR_BASE_HEALTH,
  DOOR_DAMAGE_PER_ZOMBIE_SEC,
  DOOR_MAX_HEALTH,
  DOOR_MAX_PLANKS,
  DOOR_SPLINTER_NOISE_RADIUS,
  HEALTH_PER_PLANK,
  toggleDoor,
} from '../shared/fortifications.ts';

describe('Door Open and Close Toggling', () => {
  it('defaults doors to closed and passageways to open', () => {
    const defaultDoor = createBarricadeOpening('d1', 'b1', 'door', 100, 100, 32, 16, 'south');
    expect(defaultDoor.isOpen).toBe(false);

    const helperDoor = createDoorOpening('d2', 'b1', 100, 100, 32, 16, 'south');
    expect(helperDoor.isOpen).toBe(false);

    const passageway = createBarricadeOpening('p1', 'b1', 'passageway', 100, 100, 32, 16, 'south');
    expect(passageway.isOpen).toBe(true);

    const explicitOpenDoor = createDoorOpening('d3', 'b1', 100, 100, 32, 16, 'south', {
      isOpen: true,
    });
    expect(explicitOpenDoor.isOpen).toBe(true);
  });

  it('toggles an unbarricaded door between open and closed states', () => {
    const door = createDoorOpening('d1', 'b1', 100, 100, 32, 16, 'south');
    expect(door.isOpen).toBe(false);

    const opened = toggleDoor(door);
    expect(opened).toBe(true);
    expect(door.isOpen).toBe(true);

    const closed = toggleDoor(door);
    expect(closed).toBe(true);
    expect(door.isOpen).toBe(false);
  });

  it('refuses to toggle non-door openings', () => {
    const windowOpening = createBarricadeOpening('w1', 'b1', 'window', 100, 100, 16, 16, 'north');
    const initialOpenState = windowOpening.isOpen;

    const toggled = toggleDoor(windowOpening);
    expect(toggled).toBe(false);
    expect(windowOpening.isOpen).toBe(initialOpenState);
  });

  it('refuses to toggle destroyed doors', () => {
    const brokenDoor = createDoorOpening('d1', 'b1', 100, 100, 32, 16, 'south', {
      isBroken: true,
      isOpen: true,
    });

    const toggled = toggleDoor(brokenDoor);
    expect(toggled).toBe(false);
    expect(brokenDoor.isOpen).toBe(true);
  });
});

describe('Barricades Locking Door Shut', () => {
  it('prevents toggling when door has standing planks', () => {
    const barricadedDoor = createDoorOpening('d1', 'b1', 100, 100, 32, 16, 'south', {
      planks: 1,
    });
    expect(barricadedDoor.isOpen).toBe(false);

    const toggled = toggleDoor(barricadedDoor);
    expect(toggled).toBe(false);
    expect(barricadedDoor.isOpen).toBe(false);
  });

  it('remains locked across maximum fortification planks', () => {
    const maxBarricadedDoor = createDoorOpening('d1', 'b1', 100, 100, 32, 16, 'south', {
      planks: DOOR_MAX_PLANKS,
    });

    const toggled = toggleDoor(maxBarricadedDoor);
    expect(toggled).toBe(false);
    expect(maxBarricadedDoor.isOpen).toBe(false);
  });

  it('locks shut when plank is added and unlocks when all planks dismantled', () => {
    const door = createDoorOpening('d1', 'b1', 100, 100, 32, 16, 'south');
    const materials = createEmptyFortificationInventory();
    materials.hasHammer = true;
    materials.hasCrowbar = true;
    materials.planks = 1;
    materials.nails = 2;

    const plankAdded = addPlank(materials, door);
    expect(plankAdded).toBe(true);
    expect(door.planks).toBe(1);

    const toggleAttemptBlocked = toggleDoor(door);
    expect(toggleAttemptBlocked).toBe(false);
    expect(door.isOpen).toBe(false);

    const plankDismantled = dismantlePlank(materials, door);
    expect(plankDismantled).toBe(true);
    expect(door.planks).toBe(0);

    const toggleAttemptAllowed = toggleDoor(door);
    expect(toggleAttemptAllowed).toBe(true);
    expect(door.isOpen).toBe(true);
  });
});

describe('Zombie Count Damage Scaling', () => {
  it('calculates zero damage for non-positive zombie counts or elapsed time', () => {
    const noZombiesDamage = calculateDoorDamage(0, 1.0);
    expect(noZombiesDamage).toBe(0);

    const negativeZombiesDamage = calculateDoorDamage(-3, 1.0);
    expect(negativeZombiesDamage).toBe(0);

    const noTimeDamage = calculateDoorDamage(2, 0);
    expect(noTimeDamage).toBe(0);

    const negativeTimeDamage = calculateDoorDamage(2, -0.5);
    expect(negativeTimeDamage).toBe(0);
  });

  it('scales breach damage proportionally with zombie count', () => {
    const dt = 1.0;
    const singleZombieDamage = calculateDoorDamage(1, dt);
    const tripleZombieDamage = calculateDoorDamage(3, dt);
    const quintupleZombieDamage = calculateDoorDamage(5, dt);

    expect(singleZombieDamage).toBe(DOOR_DAMAGE_PER_ZOMBIE_SEC);
    expect(tripleZombieDamage).toBe(singleZombieDamage * 3);
    expect(quintupleZombieDamage).toBe(singleZombieDamage * 5);
  });

  it('deals greater damage to doors with larger zombie mobs over time', () => {
    const doorSolo = createDoorOpening('d1', 'b1', 100, 100, 32, 16, 'south');
    const doorHorde = createDoorOpening('d2', 'b1', 100, 100, 32, 16, 'south');
    const dt = 0.5;

    const soloResult = damageDoorOpening(doorSolo, 1, dt);
    const hordeResult = damageDoorOpening(doorHorde, 4, dt);

    expect(hordeResult.damageDealt).toBeGreaterThan(soloResult.damageDealt);
    expect(doorHorde.health).toBeLessThan(doorSolo.health);
  });

  it('handles damage application with zero zombies gracefully', () => {
    const door = createDoorOpening('d1', 'b1', 100, 100, 32, 16, 'south');
    const initialHealth = door.health;

    const result = damageDoorOpening(door, 0, 1.0);
    expect(result.damageDealt).toBe(0);
    expect(result.remainingHealth).toBe(initialHealth);
    expect(result.destroyed).toBe(false);
    expect(result.noiseRadius).toBe(0);
  });
});

describe('Breach Destruction on Zero Health', () => {
  it('calculates door maximum health with baseline and plank bonuses', () => {
    expect(calculateDoorMaxHealth(0)).toBe(DOOR_BASE_HEALTH);
    expect(calculateDoorMaxHealth(1)).toBe(DOOR_BASE_HEALTH + HEALTH_PER_PLANK);
    expect(calculateDoorMaxHealth(2)).toBe(DOOR_BASE_HEALTH + 2 * HEALTH_PER_PLANK);
    expect(calculateDoorMaxHealth(4)).toBe(DOOR_MAX_HEALTH);
    expect(calculateDoorMaxHealth(6)).toBe(DOOR_MAX_HEALTH);
  });

  it('splinters off planks sequentially as damage reduces health', () => {
    const door = createDoorOpening('d1', 'b1', 100, 100, 32, 16, 'south', {
      planks: 2,
    });
    expect(door.health).toBe(350);
    expect(door.planks).toBe(2);

    // Deal 60 damage (350 - 60 = 290). Plank threshold for 2 planks is > 250.
    const minorHit = damageDoorOpening(door, 3, 1.0);
    expect(minorHit.remainingHealth).toBe(290);
    expect(minorHit.brokenPlanks).toBe(0);
    expect(door.planks).toBe(2);

    // Deal 60 more damage (290 - 60 = 230). Crosses 250 threshold down to 1 plank.
    const plankBreakHit = damageDoorOpening(door, 3, 1.0);
    expect(plankBreakHit.remainingHealth).toBe(230);
    expect(plankBreakHit.brokenPlanks).toBe(1);
    expect(door.planks).toBe(1);

    // Deal 100 more damage (230 - 100 = 130). Crosses 150 threshold to 0 planks.
    const secondPlankBreak = damageDoorOpening(door, 5, 1.0);
    expect(secondPlankBreak.remainingHealth).toBe(130);
    expect(secondPlankBreak.brokenPlanks).toBe(1);
    expect(door.planks).toBe(0);
    expect(secondPlankBreak.destroyed).toBe(false);
  });

  it('destroys unreinforced door when health reaches zero', () => {
    const door = createDoorOpening('d1', 'b1', 100, 100, 32, 16, 'south');
    expect(door.health).toBe(DOOR_BASE_HEALTH);
    expect(door.isBroken).toBe(false);
    expect(door.isOpen).toBe(false);

    // Apply lethal damage over multiple seconds: 15 zombies * 20 DPS * 0.6s = 180 damage >= 150 HP
    const fatalHit = damageDoorOpening(door, 15, 0.6);

    expect(fatalHit.destroyed).toBe(true);
    expect(fatalHit.remainingHealth).toBe(0);
    expect(fatalHit.noiseRadius).toBe(DOOR_SPLINTER_NOISE_RADIUS);
    expect(door.isBroken).toBe(true);
    expect(door.isOpen).toBe(true);
    expect(door.planks).toBe(0);
  });

  it('destroys heavily barricaded door and emits splinter noise on breach', () => {
    const reinforcedDoor = createDoorOpening('d1', 'b1', 100, 100, 32, 16, 'south', {
      planks: 4,
    });
    expect(reinforcedDoor.health).toBe(550);

    // Apply massive damage: 30 zombies * 20 DPS * 1.0s = 600 damage >= 550 HP
    const breachResult = damageDoorOpening(reinforcedDoor, 30, 1.0);

    expect(breachResult.destroyed).toBe(true);
    expect(breachResult.remainingHealth).toBe(0);
    expect(breachResult.brokenPlanks).toBe(4);
    expect(breachResult.noiseRadius).toBe(DOOR_SPLINTER_NOISE_RADIUS);
    expect(reinforcedDoor.isBroken).toBe(true);
    expect(reinforcedDoor.isOpen).toBe(true);
    expect(reinforcedDoor.planks).toBe(0);
  });

  it('ignores further damage attempts on already broken doors', () => {
    const brokenDoor = createDoorOpening('d1', 'b1', 100, 100, 32, 16, 'south', {
      isBroken: true,
      isOpen: true,
    });

    const result = damageDoorOpening(brokenDoor, 5, 1.0);
    expect(result.damageDealt).toBe(0);
    expect(result.remainingHealth).toBe(0);
    expect(result.destroyed).toBe(true);
    expect(result.noiseRadius).toBe(0);
  });

  it('ignores damage attempts on non-door openings', () => {
    const windowOpening = createBarricadeOpening('w1', 'b1', 'window', 100, 100, 16, 16, 'north');
    const result = damageDoorOpening(windowOpening, 5, 1.0);

    expect(result.damageDealt).toBe(0);
    expect(result.destroyed).toBe(false);
  });
});
