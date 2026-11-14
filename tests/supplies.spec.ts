import { describe, expect, it } from 'vitest';
import { BANDAGE_HEAL } from '../shared/constants.ts';
import { emptySupplies } from '../shared/supply-types.ts';
import {
  applySupply,
  pocketWants,
  useSupply,
  usePocketSupplies,
  POCKET_EAT_AT,
  POCKET_DRINK_AT,
  POCKET_BANDAGE_SHARE,
  POCKET_ANTIBIOTICS_AT,
} from '../shared/supplies.ts';
import { createDefaultSurvivalNeeds } from '../shared/survival-needs.ts';
import { createPlayer } from '../shared/player-roster.ts';
import { applyBagCommit } from '../shared/bag-sim.ts';
import { bagLayout, bagWanted, syncBag } from '../shared/bag.ts';
import { quietSim } from './helpers/sim-harness.ts';
import type { PlayerState } from '../shared/sim-state.ts';

function makePatient(health = 100, maxHealth = 100): PlayerState {
  const player = createPlayer({ id: 'p1', name: 'ANA', token: null, skin: 0 }, { x: 500, y: 500 });
  player.health = health;
  player.maxHealth = maxHealth;
  player.needs = createDefaultSurvivalNeeds();
  player.supplies = emptySupplies();
  return player;
}

describe('applySupply', () => {
  it('heals missing health with a bandage', () => {
    const patient = makePatient(50, 100);
    const healed = applySupply(patient, 'bandage');
    expect(healed).toBe(true);
    expect(patient.health).toBe(50 + BANDAGE_HEAL);
  });

  it('heals up to max health without exceeding it', () => {
    const patient = makePatient(95, 100);
    const healed = applySupply(patient, 'bandage');
    expect(healed).toBe(true);
    expect(patient.health).toBe(100);
  });

  it('stops bleeding with a bandage even at full health', () => {
    const patient = makePatient(100, 100);
    patient.needs!.bleeding = true;
    const healed = applySupply(patient, 'bandage');
    expect(healed).toBe(true);
    expect(patient.needs!.bleeding).toBe(false);
  });

  it('refuses a bandage at full health with no bleed', () => {
    const patient = makePatient(100, 100);
    patient.needs!.bleeding = false;
    const healed = applySupply(patient, 'bandage');
    expect(healed).toBe(false);
    expect(patient.health).toBe(100);
  });

  it('relieves hunger with canned food', () => {
    const patient = makePatient();
    patient.needs!.hunger = 70;
    const satisfied = applySupply(patient, 'canned_food');
    expect(satisfied).toBe(true);
    expect(patient.needs!.hunger).toBeLessThan(70);
  });

  it('relieves thirst with water bottle', () => {
    const patient = makePatient();
    patient.needs!.thirst = 70;
    const satisfied = applySupply(patient, 'water_bottle');
    expect(satisfied).toBe(true);
    expect(patient.needs!.thirst).toBeLessThan(70);
  });

  it('disinfects a dirty scratch', () => {
    const patient = makePatient();
    patient.needs!.isInfected = true;
    patient.needs!.wound = 'scratch';
    const treated = applySupply(patient, 'disinfectant');
    expect(treated).toBe(true);
    expect(patient.needs!.isInfected).toBe(false);
  });

  it('treats progressive infection with antibiotics', () => {
    const patient = makePatient();
    patient.needs!.infection = 50;
    const treated = applySupply(patient, 'antibiotics');
    expect(treated).toBe(true);
    expect(patient.needs!.infection).toBeLessThan(50);
  });
});

describe('pocketWants', () => {
  it('wants a bandage when bleeding or at half health', () => {
    const patient = makePatient(100, 100);
    expect(pocketWants(patient, 'bandage')).toBe(false);

    patient.health = 100 * POCKET_BANDAGE_SHARE;
    expect(pocketWants(patient, 'bandage')).toBe(true);

    patient.health = 100;
    patient.needs!.bleeding = true;
    expect(pocketWants(patient, 'bandage')).toBe(true);
  });

  it('wants food and water once threshold reached', () => {
    const patient = makePatient();
    patient.needs!.hunger = POCKET_EAT_AT - 1;
    patient.needs!.thirst = POCKET_DRINK_AT - 1;
    expect(pocketWants(patient, 'canned_food')).toBe(false);
    expect(pocketWants(patient, 'water_bottle')).toBe(false);

    patient.needs!.hunger = POCKET_EAT_AT;
    patient.needs!.thirst = POCKET_DRINK_AT;
    expect(pocketWants(patient, 'canned_food')).toBe(true);
    expect(pocketWants(patient, 'water_bottle')).toBe(true);
  });

  it('wants antibiotics once infection reaches threshold', () => {
    const patient = makePatient();
    patient.needs!.infection = POCKET_ANTIBIOTICS_AT - 1;
    expect(pocketWants(patient, 'antibiotics')).toBe(false);

    patient.needs!.infection = POCKET_ANTIBIOTICS_AT;
    expect(pocketWants(patient, 'antibiotics')).toBe(true);
  });
});

describe('useSupply', () => {
  it('decrements carried count when used', () => {
    const patient = makePatient(50, 100);
    patient.supplies!.bandage = 2;
    const used = useSupply(patient, 'bandage');
    expect(used).toBe(true);
    expect(patient.supplies!.bandage).toBe(1);
    expect(patient.health).toBe(50 + BANDAGE_HEAL);
  });

  it('does not decrement when none is carried or when ineffective', () => {
    const patient = makePatient(100, 100);
    patient.supplies!.bandage = 2;
    const usedFull = useSupply(patient, 'bandage');
    expect(usedFull).toBe(false);
    expect(patient.supplies!.bandage).toBe(2);

    patient.health = 50;
    patient.supplies!.bandage = 0;
    const usedEmpty = useSupply(patient, 'bandage');
    expect(usedEmpty).toBe(false);
    expect(patient.supplies!.bandage).toBe(0);
  });
});

describe('usePocketSupplies', () => {
  it('automatically consumes a pocketed item when wanted', () => {
    const patient = makePatient(40, 100);
    patient.supplies!.bandage = 1;
    syncBag(patient.inventory, bagWanted(patient));

    const itemInPockets = patient.inventory.pockets.items.some((item) => item.type === 'bandage');
    if (!itemInPockets) {
      patient.inventory.pockets.items.push({
        id: 'bandage:1',
        type: 'bandage',
        x: 0,
        y: 0,
        rotated: false,
      });
    }

    const used = usePocketSupplies(patient);
    expect(used).toContain('bandage');
    expect(patient.health).toBe(40 + BANDAGE_HEAL);
    expect(patient.supplies!.bandage).toBe(0);
  });
});

describe('applyBagCommit with use entries', () => {
  it('applies use actions from bag commit', () => {
    const { state } = quietSim();
    const [p] = state.players;
    p.health = 40;
    p.supplies = { ...emptySupplies(), bandage: 2 };
    syncBag(p.inventory, bagWanted(p));

    // Player used one bandage, leaving one in layout
    p.inventory.pack.items.pop();

    const commit = {
      layout: bagLayout(p.inventory),
      drop: [],
      use: [{ type: 'bandage' as const, count: 1 }],
    };

    const accepted = applyBagCommit(state, p, commit);
    expect(accepted).toBe(true);
    expect(p.health).toBe(40 + BANDAGE_HEAL);
    expect(p.supplies.bandage).toBe(1);
  });
});
