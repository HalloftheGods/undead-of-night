import { describe, expect, it } from 'vitest';
import {
  buildItemCatalogue,
  generateFootprintsCode,
  generateFootprintsJson,
} from '../src/game/dev/item-catalogue.ts';

describe('Item Catalogue and Footprints Generator', () => {
  it('builds a catalogue containing items across all categories', () => {
    const catalogue = buildItemCatalogue();
    expect(catalogue.length).toBeGreaterThan(40);

    const categories = new Set(catalogue.map((item) => item.category));
    expect(categories.has('weapons')).toBe(true);
    expect(categories.has('ammo')).toBe(true);
    expect(categories.has('survival')).toBe(true);
    expect(categories.has('fortifications')).toBe(true);
    expect(categories.has('candies')).toBe(true);
  });

  it('includes key items with their expected base footprints', () => {
    const catalogue = buildItemCatalogue();
    const map = new Map(catalogue.map((item) => [item.id, item]));

    const pistol = map.get('pistol');
    expect(pistol).toBeDefined();
    expect(pistol?.defaultFootprint).toEqual({ width: 2, height: 2 });

    const shotgun = map.get('shotgun');
    expect(shotgun).toBeDefined();
    expect(shotgun?.defaultFootprint).toEqual({ width: 4, height: 1 });

    const cannedFood = map.get('canned_food');
    expect(cannedFood).toBeDefined();
    expect(cannedFood?.defaultFootprint).toEqual({ width: 1, height: 1 });
  });

  it('generates full ITEM_FOOTPRINTS TypeScript code snippet', () => {
    const code = generateFootprintsCode({
      knife: { width: 1, height: 2 },
      pistol: { width: 2, height: 1 },
    });

    expect(code).toContain('export const ITEM_FOOTPRINTS: Record<string, GridFootprint> = {');
    expect(code).toContain('knife: { width: 1, height: 2 },');
    expect(code).toContain('pistol: { width: 2, height: 1 },');
    expect(code).toContain('};');
  });

  it('generates modified-only code snippet', () => {
    const original = {
      knife: { width: 1, height: 2 },
      pistol: { width: 2, height: 1 },
    };

    const modified = {
      knife: { width: 1, height: 3 }, // modified
      pistol: { width: 2, height: 1 }, // unchanged
    };

    const diffCode = generateFootprintsCode(modified, true, original);
    expect(diffCode).toContain('knife: { width: 1, height: 3 },');
    expect(diffCode).not.toContain('pistol');
  });

  it('generates JSON output matching footprint data', () => {
    const data = {
      bandage: { width: 1, height: 1 },
    };
    const jsonStr = generateFootprintsJson(data);
    const parsed = JSON.parse(jsonStr);
    expect(parsed).toEqual(data);
  });
});
