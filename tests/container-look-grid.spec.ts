import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CONTAINER_GRID_SIZE, containerGridDimensions, containerGridFor } from '../shared/containers.ts';
import { CONTAINER_LOOK_GRID_SIZE } from '../shared/container-look-grids.ts';
import { containerLookId } from '../shared/container-look.ts';
import { containerLook } from '../src/art/containers.ts';
import type { PropKind } from '../shared/protocol.ts';
import { benchContainers, entryGrid, hasOwnGrid, isContainerModified, resetAllContainers, setEntryBlocked, setEntrySize, setOwnGrid } from '../src/game/dev/bench-store.ts';
import { updateLookGridFile } from '../tools/vite-dev-sync.ts';

const looks = CONTAINER_LOOK_GRID_SIZE as Record<string, (typeof CONTAINER_LOOK_GRID_SIZE)[string]>;

afterEach(() => {
  delete looks.drawer_v2;
  resetAllContainers();
});

describe('container look grids', () => {
  it('a look with its own grid opens in it; any other look uses its kind', () => {
    looks.drawer_v2 = { cols: 3, rows: 2 };
    expect(containerGridDimensions('drawer', 'drawer_v2')).toEqual({ cols: 3, rows: 2 });
    expect(containerGridDimensions('drawer', 'drawer_v1')).toBe(CONTAINER_GRID_SIZE.drawer);
    expect(containerGridDimensions('drawer')).toBe(CONTAINER_GRID_SIZE.drawer);
  });

  it('a town piece resolves its grid by the look it is drawn with', () => {
    looks.drawer_v2 = { cols: 3, rows: 2 };
    const index = Array.from({ length: 200 }, (_, i) => i).find((i) => containerLookId({ kind: 'drawer', prop: 'bed', propIndex: i }) === 'drawer_v2');
    expect(index).toBeDefined();
    expect(containerGridFor({ kind: 'drawer', prop: 'bed', propIndex: index! })).toEqual({ cols: 3, rows: 2 });
  });

  it('the art and the grids agree on every look', () => {
    const props: [PropKind, 'drawer' | 'shelf' | 'car' | 'cabinet'][] = [['bed', 'drawer'], ['shelf', 'shelf'], ['police_v', 'car'], ['workbench', 'cabinet'], ['counter', 'cabinet']];
    for (const [prop, kind] of props) {
      for (let propIndex = 0; propIndex < 40; propIndex++) {
        expect(containerLook({ kind, prop, propIndex })).toBe(containerLookId({ kind, prop, propIndex }));
      }
      expect(containerLook({ kind, prop })).toBe(containerLookId({ kind, prop }));
    }
  });
});

describe('bench own grids', () => {
  const variant = benchContainers.find((entry) => entry.look === 'drawer_v2')!;
  const base = benchContainers.find((entry) => entry.look === 'drawer')!;

  it('an own grid starts as a copy of the base, and edits change only that look', () => {
    setOwnGrid(variant, true);
    expect(hasOwnGrid(variant)).toBe(true);
    expect(entryGrid(variant)).toEqual({ ...entryGrid(base), blocked: entryGrid(base).blocked ?? [] });
    setEntrySize(variant, 4, 3);
    setEntryBlocked(variant, [{ x: 1, y: 1 }]);
    expect(entryGrid(variant)).toEqual({ cols: 4, rows: 3, blocked: [{ x: 1, y: 1 }] });
    expect(entryGrid(base).cols).toBe(CONTAINER_GRID_SIZE.drawer!.cols);
    expect(isContainerModified(variant)).toBe(true);
    expect(isContainerModified(base)).toBe(false);
  });

  it('the base look never takes an own grid, and turning one off follows the base again', () => {
    setOwnGrid(base, true);
    expect(hasOwnGrid(base)).toBe(false);
    setOwnGrid(variant, true);
    setOwnGrid(variant, false);
    expect(hasOwnGrid(variant)).toBe(false);
    setEntrySize(variant, 5, 5);
    expect(entryGrid(base)).toEqual(entryGrid(variant));
  });
});

describe('look grid file', () => {
  it('rewrites only the table, sorted, with blocked cells', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'look-grids-'));
    mkdirSync(path.join(root, 'shared'));
    const file = path.join(root, 'shared/container-look-grids.ts');
    writeFileSync(file, readFileSync(path.resolve(__dirname, '../shared/container-look-grids.ts'), 'utf8'));
    expect(updateLookGridFile(root, { police: { cols: 6, rows: 4 }, drawer_v2: { cols: 3, rows: 2, blocked: [{ x: 1, y: 1 }, { x: 0, y: 0 }] } })).toBe(true);
    const text = readFileSync(file, 'utf8');
    expect(text).toContain('  drawer_v2: { cols: 3, rows: 2, blocked: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },\n  police: { cols: 6, rows: 4 },\n};');
    expect(updateLookGridFile(root, {})).toBe(true);
    expect(readFileSync(file, 'utf8')).toContain('= {\n};');
  });
});
