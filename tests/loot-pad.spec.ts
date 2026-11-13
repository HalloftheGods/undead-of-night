import { describe, expect, it } from 'vitest';
import { createInventoryGrid } from '../shared/grid-inventory.ts';
import type { InventoryGrid } from '../shared/grid-inventory.ts';
import type { GridIdentifier } from '../src/game/inventory/dual-loot-modal.ts';
import { moveCursor, settleCursor, startCursor } from '../src/game/inventory/loot-pad.ts';

const grids: Record<GridIdentifier, InventoryGrid> = {
  container: createInventoryGrid(4, 3),
  pockets: createInventoryGrid(2, 2),
  candyBag: createInventoryGrid(2, 6),
  backpack: createInventoryGrid(5, 4),
};
const gridOf = (id: GridIdentifier) => grids[id];

describe('the controller cursor in a loot screen', () => {
  it('starts on the first item of the container, reading top-left first', () => {
    grids.container.items = [
      { id: 'b', type: 'bandage', x: 2, y: 0, rotated: false },
      { id: 'a', type: 'bandage', x: 1, y: 2, rotated: false },
    ];
    expect(startCursor(gridOf)).toEqual({ gridId: 'container', col: 2, row: 0 });
  });

  it('starts at the corner of an empty container when the bag is empty too', () => {
    grids.container.items = [];
    expect(startCursor(gridOf)).toEqual({ gridId: 'container', col: 0, row: 0 });
  });

  it('steps one cell, and stops at an edge with no neighbour', () => {
    expect(moveCursor({ gridId: 'container', col: 1, row: 1 }, 'down', gridOf)).toEqual({ gridId: 'container', col: 1, row: 2 });
    expect(moveCursor({ gridId: 'container', col: 0, row: 0 }, 'up', gridOf)).toBeNull();
    expect(moveCursor({ gridId: 'container', col: 0, row: 0 }, 'left', gridOf)).toBeNull();
  });

  it('crosses to the next grid at the same height', () => {
    expect(moveCursor({ gridId: 'container', col: 3, row: 2 }, 'right', gridOf)).toEqual({ gridId: 'pockets', col: 0, row: 1 });
    expect(moveCursor({ gridId: 'backpack', col: 0, row: 3 }, 'left', gridOf)).toEqual({ gridId: 'container', col: 3, row: 2 });
    expect(moveCursor({ gridId: 'pockets', col: 1, row: 1 }, 'down', gridOf)).toEqual({ gridId: 'backpack', col: 3, row: 0 });
  });

  it('goes past a blocked cell', () => {
    grids.container.blocked = [{ x: 1, y: 1 }];
    expect(moveCursor({ gridId: 'container', col: 0, row: 1 }, 'right', gridOf)).toEqual({ gridId: 'container', col: 2, row: 1 });
    delete grids.container.blocked;
  });

  it('rests on the nearest item left when the one it was on is taken', () => {
    grids.container.items = [{ id: 'a', type: 'bandage', x: 3, y: 2, rotated: false }];
    expect(settleCursor({ gridId: 'container', col: 0, row: 0 }, gridOf)).toEqual({ gridId: 'container', col: 3, row: 2 });
  });
});

describe('a canvas screen on the pad', () => {
  it('turns the D-pad into arrows, A into Enter and B into Escape, without waking the keyboard', async () => {
    const { keyBridgePad, isPadKey } = await import('../src/game/inventory/loot-pad.ts');
    const seen: string[] = [];
    const fake = { body: { dispatchEvent: (e: Event) => seen.push(`${(e as KeyboardEvent).code}:${isPadKey(e)}`) } };
    (globalThis as { document?: unknown }).document = fake;
    (globalThis as { KeyboardEvent?: unknown }).KeyboardEvent ??= class extends Event {
      code: string;
      constructor(type: string, init: { code?: string }) {
        super(type);
        this.code = init.code ?? '';
      }
    };
    const pad = keyBridgePad();
    pad.press('a');
    pad.move('down');
    pad.press('a');
    pad.press('b');
    delete (globalThis as { document?: unknown }).document;
    expect(seen).toEqual(['ArrowDown:true', 'ArrowDown:true', 'Enter:true', 'Escape:true']);
  });
});
