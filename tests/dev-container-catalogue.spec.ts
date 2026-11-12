import { describe, expect, it } from 'vitest';
import {
  buildContainerCatalogue,
  generateContainerGridSizeCode,
  generateContainerGridSizeJson,
} from '../src/game/dev/container-catalogue.ts';

describe('Container Catalogue and CONTAINER_GRID_SIZE Generator', () => {
  it('builds a catalogue covering all primary container kinds and variants', () => {
    const catalogue = buildContainerCatalogue();
    expect(catalogue.length).toBeGreaterThanOrEqual(10);

    const kinds = new Set(catalogue.map((c) => c.kind));
    expect(kinds.has('drawer')).toBe(true);
    expect(kinds.has('locker')).toBe(true);
    expect(kinds.has('fridge')).toBe(true);
    expect(kinds.has('cabinet')).toBe(true);
    expect(kinds.has('shelf')).toBe(true);
    expect(kinds.has('box')).toBe(true);
    expect(kinds.has('car')).toBe(true);
    expect(kinds.has('bowl')).toBe(true);
    expect(kinds.has('booth')).toBe(true);
    expect(kinds.has('dumpster')).toBe(true);
  });

  it('includes default dimensions for standard containers and locker', () => {
    const catalogue = buildContainerCatalogue();
    const map = new Map(catalogue.map((c) => [c.id, c]));

    const locker = map.get('locker');
    expect(locker).toBeDefined();
    expect(locker?.defaultDimensions).toEqual({ cols: 5, rows: 9 });

    const drawer = map.get('drawer');
    expect(drawer).toBeDefined();
    expect(drawer?.defaultDimensions).toEqual({ cols: 4, rows: 4 });
  });

  it('generates full CONTAINER_GRID_SIZE TypeScript code snippet', () => {
    const code = generateContainerGridSizeCode({
      drawer: { cols: 4, rows: 2 },
      locker: { cols: 3, rows: 8 },
      fridge: { cols: 4, rows: 6 },
      cabinet: { cols: 5, rows: 3 },
      shelf: { cols: 5, rows: 4 },
      box: { cols: 3, rows: 3 },
      car: { cols: 6, rows: 4 },
      bowl: { cols: 2, rows: 2 },
      booth: { cols: 5, rows: 3 },
      dumpster: { cols: 6, rows: 5 },
    });

    expect(code).toContain('export const CONTAINER_GRID_SIZE: Partial<Record<ContainerKind, ContainerGridDimensions>> = {');
    expect(code).toContain('drawer: { cols: 4, rows: 2 },');
    expect(code).toContain('locker: { cols: 3, rows: 8 },');
    expect(code).toContain('};');
  });

  it('generates modified-only code snippet', () => {
    const original = {
      drawer: { cols: 5, rows: 4 },
      locker: { cols: 3, rows: 8 },
    };

    const modified = {
      drawer: { cols: 4, rows: 2 }, // modified
      locker: { cols: 3, rows: 8 }, // unchanged
      fridge: { cols: 5, rows: 4 },
      cabinet: { cols: 5, rows: 4 },
      shelf: { cols: 5, rows: 4 },
      box: { cols: 5, rows: 4 },
      car: { cols: 5, rows: 4 },
      bowl: { cols: 5, rows: 4 },
      booth: { cols: 5, rows: 4 },
      dumpster: { cols: 5, rows: 4 },
    };

    const diffCode = generateContainerGridSizeCode(modified, true, original);
    expect(diffCode).toContain('drawer: { cols: 4, rows: 2 },');
    expect(diffCode).not.toContain('locker');
  });

  it('generates valid JSON output for container grid sizes', () => {
    const sizes = {
      drawer: { cols: 4, rows: 2 },
    };
    const jsonStr = generateContainerGridSizeJson(sizes as any);
    const parsed = JSON.parse(jsonStr);
    expect(parsed).toEqual(sizes);
  });
});
