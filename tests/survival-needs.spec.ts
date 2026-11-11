import { describe, expect, it } from 'vitest';
import {
  bandageWound,
  consumeSurvivalItem,
  createDefaultSurvivalNeeds,
  inflictWound,
  moveSpeedMultiplier,
  scroungeSurvivalLoot,
  staminaRecoveryMultiplier,
  SURVIVAL_ITEMS,
  SURVIVAL_LOOT_TABLES,
  type SurvivalItemType,
  type SurvivalNeeds,
  updateSurvivalNeeds,
} from '../shared/survival-needs.ts';
import { SURVIVAL_ITEM_ART, SURVIVAL_LEGEND } from '../src/art/fx/survival-art.ts';
import { buildMoodleIcons, MOODLE_LEGEND } from '../src/art/fx/moodles.ts';
import { buildMoodles } from '../src/game/hud-state.ts';
import { inPalette } from '../src/art/palette.ts';
import { quietSim } from './helpers/sim-harness.ts';

describe('Survival Needs Core Data & Mechanics', () => {
  it('defines valid data for all survival items', () => {
    const itemKeys: SurvivalItemType[] = ['canned_food', 'water_bottle', 'disinfectant', 'antibiotics'];
    for (const key of itemKeys) {
      const def = SURVIVAL_ITEMS[key];
      expect(def).toBeDefined();
      expect(def.name.length).toBeGreaterThan(0);
      expect(def.description.length).toBeGreaterThan(0);
    }
  });

  it('scrounges survival rations based on building types', () => {
    const alwaysRng = () => 0.01;
    const groceryItem = scroungeSurvivalLoot(alwaysRng, 'grocery');
    expect(['canned_food', 'water_bottle']).toContain(groceryItem);

    const clinicItem = scroungeSurvivalLoot(alwaysRng, 'clinic');
    expect(['disinfectant', 'antibiotics', 'water_bottle']).toContain(clinicItem);

    const neverRng = () => 0.99;
    const emptyResult = scroungeSurvivalLoot(neverRng, 'grocery');
    expect(emptyResult).toBeNull();
  });

  it('consumes canned food and quenches hunger', () => {
    const needs: SurvivalNeeds = {
      ...createDefaultSurvivalNeeds(),
      hunger: 60,
    };
    const health = { health: 70, maxHealth: 100 };

    const consumed = consumeSurvivalItem(needs, health, 'canned_food');
    expect(consumed).toBe(true);
    expect(needs.hunger).toBe(15);
    expect(health.health).toBe(78);

    const redundantNeeds: SurvivalNeeds = {
      ...createDefaultSurvivalNeeds(),
      hunger: 0,
    };
    const maxHealth = { health: 100, maxHealth: 100 };
    expect(consumeSurvivalItem(redundantNeeds, maxHealth, 'canned_food')).toBe(false);
  });

  it('consumes water and hydrates survivor', () => {
    const needs: SurvivalNeeds = {
      ...createDefaultSurvivalNeeds(),
      thirst: 70,
    };
    const health = { health: 100, maxHealth: 100 };

    const consumed = consumeSurvivalItem(needs, health, 'water_bottle');
    expect(consumed).toBe(true);
    expect(needs.thirst).toBe(15);
  });

  it('inflicts scratches, lacerations, and lethal bites', () => {
    const needs = createDefaultSurvivalNeeds();
    inflictWound(needs, 'bite', () => 0.5);

    expect(needs.wound).toBe('bite');
    expect(needs.bleeding).toBe(true);
    expect(needs.isInfected).toBe(true);

    const bandaged = bandageWound(needs);
    expect(bandaged).toBe(true);
    expect(needs.bleeding).toBe(false);
  });

  it('disinfects scratches and cures non-fatal infection risk', () => {
    const needs: SurvivalNeeds = {
      ...createDefaultSurvivalNeeds(),
      wound: 'scratch',
      bleeding: true,
      isInfected: true,
      infection: 10,
    };
    const health = { health: 80, maxHealth: 100 };

    const disinfected = consumeSurvivalItem(needs, health, 'disinfectant');
    expect(disinfected).toBe(true);
    expect(needs.isInfected).toBe(false);
    expect(needs.infection).toBe(0);
  });

  it('antibiotics stalls infection progress', () => {
    const needs: SurvivalNeeds = {
      ...createDefaultSurvivalNeeds(),
      wound: 'bite',
      isInfected: true,
      infection: 50,
    };
    const health = { health: 80, maxHealth: 100 };

    const treated = consumeSurvivalItem(needs, health, 'antibiotics');
    expect(treated).toBe(true);
    expect(needs.infection).toBe(15);
  });

  it('calculates stamina and movement speed debuffs for starvation and dehydration', () => {
    const baseNeeds = createDefaultSurvivalNeeds();
    expect(staminaRecoveryMultiplier(baseNeeds)).toBe(1.0);
    expect(moveSpeedMultiplier(baseNeeds)).toBe(1.0);

    const starvingNeeds: SurvivalNeeds = {
      ...createDefaultSurvivalNeeds(),
      hunger: 85,
      thirst: 85,
    };
    expect(staminaRecoveryMultiplier(starvingNeeds)).toBeLessThan(0.4);
    expect(moveSpeedMultiplier(starvingNeeds)).toBeLessThan(0.8);
  });

  it('updates hunger, thirst, and fatigue decay over time', () => {
    const needs = createDefaultSurvivalNeeds();
    updateSurvivalNeeds(needs, 10, false, false);
    expect(needs.hunger).toBeGreaterThan(1.0);
    expect(needs.thirst).toBeGreaterThan(1.8);
    expect(needs.fatigue).toBe(0);

    const sprintNeeds = createDefaultSurvivalNeeds();
    updateSurvivalNeeds(sprintNeeds, 10, true, true);
    expect(sprintNeeds.hunger).toBeGreaterThan(needs.hunger);
    expect(sprintNeeds.thirst).toBeGreaterThan(needs.thirst);
    expect(sprintNeeds.fatigue).toBeGreaterThan(15);
  });

  it('applies bleeding damage ticks and infection escalation', () => {
    const needs: SurvivalNeeds = {
      ...createDefaultSurvivalNeeds(),
      bleeding: true,
      isInfected: true,
      infection: 99,
    };
    const health = { health: 50, maxHealth: 100 };

    updateSurvivalNeeds(needs, 3.5, false, false, health);
    expect(health.health).toBeLessThan(50);
    expect(needs.infection).toBe(100);
    expect(health.health).toBe(0);
  });

  it('kills a solo survivor when bleeding drops health to zero', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    p.health = 4;
    p.needs = {
      ...createDefaultSurvivalNeeds(),
      bleeding: true,
      bleedTimer: 3.0,
    };
    sim.step();
    expect(p.health).toBe(0);
    expect(p.status).toBe('dead');
  });

  it('downs a survivor with living teammates when bleeding drops health to zero', () => {
    const { sim, state } = quietSim(['a', 'b']);
    const [p1, p2] = state.players;
    p1.health = 4;
    p1.needs = {
      ...createDefaultSurvivalNeeds(),
      bleeding: true,
      bleedTimer: 3.0,
    };
    expect(p2.status).toBe('alive');
    sim.step();
    expect(p1.health).toBe(0);
    expect(p1.status).toBe('downed');
    expect(p1.bleedout).toBeGreaterThan(0);
  });
});

describe('Survival Pixel Art Standards', () => {
  it('uses only valid palette colors in SURVIVAL_LEGEND', () => {
    for (const [key, color] of Object.entries(SURVIVAL_LEGEND)) {
      expect(color === null || inPalette(color)).toBe(true);
    }
  });

  it('contains valid legend characters in all item grids', () => {
    const validChars = new Set(['.', ...Object.keys(SURVIVAL_LEGEND)]);
    for (const [name, spec] of Object.entries(SURVIVAL_ITEM_ART)) {
      for (const row of spec.rows) {
        for (const char of row) {
          expect(validChars.has(char)).toBe(true);
        }
      }
    }
  });

  it('builds active moodles based on thresholds', () => {
    expect(buildMoodles(undefined)).toEqual([]);

    const criticalNeeds: SurvivalNeeds = {
      ...createDefaultSurvivalNeeds(),
      hunger: 85,
      thirst: 90,
      bleeding: true,
      wound: 'laceration',
      isInfected: true,
      infection: 80,
      fatigue: 85,
    };

    const moodles = buildMoodles(criticalNeeds);
    expect(moodles.length).toBe(5);
    expect(moodles.find((m) => m.id === 'hunger')?.label).toBe('STARVING');
    expect(moodles.find((m) => m.id === 'thirst')?.label).toBe('DEHYDRATED');
    expect(moodles.find((m) => m.id === 'bleeding')?.label).toBe('HEAVY BLEEDING');
    expect(moodles.find((m) => m.id === 'infection')?.label).toBe('TERMINAL ZOONOSIS');
    expect(moodles.find((m) => m.id === 'fatigue')?.label).toBe('EXHAUSTED');
    for (const moodle of moodles) {
      expect(typeof moodle.remedy).toBe('string');
      expect(moodle.remedy.length).toBeGreaterThan(0);
    }
  });

  it('renders all 16x16 moodle pixel art sprites adhering to palette rules', () => {
    for (const [key, color] of Object.entries(MOODLE_LEGEND)) {
      expect(color === null || inPalette(color)).toBe(true);
    }

    const icons = buildMoodleIcons();
    const moodleKeys = ['hunger', 'thirst', 'bleeding', 'infection', 'fatigue'] as const;
    for (const key of moodleKeys) {
      const sprite = icons[key];
      expect(sprite).toBeDefined();
      expect(sprite.w).toBe(16);
      expect(sprite.h).toBe(16);
    }
  });
});
