import { describe, expect, it } from 'vitest';
import { heldAnchor, heldBox, layoutLootUi, lootHitAt } from '../src/engine/loot-ui.ts';
import { createInventoryGrid } from '../shared/grid-inventory.ts';
import { createDualLootState } from '../src/game/inventory/dual-loot-modal.ts';

describe('canvas loot window layout', () => {
  // An explicit grid, so the tests do not move when a container's saved size is edited on the Dev bench.
  const state = createDualLootState({ containerKind: 'drawer', containerTitle: 'Drawer', containerGrid: createInventoryGrid(4, 2) });
  const layout = layoutLootUi(state, 480, 270);

  it('puts the container on the left, the survivor on the right, and leaves a gap between', () => {
    expect(layout.container).not.toBeNull();
    const left = layout.container!;
    expect(left.x + left.w).toBeLessThan(layout.survivor.x);
    expect(layout.survivor.x + layout.survivor.w).toBeLessThanOrEqual(480);
  });

  it('keeps every dock inside the view', () => {
    for (const dock of [layout.container!, layout.survivor]) {
      expect(dock.y).toBeGreaterThanOrEqual(0);
      expect(dock.y + dock.h).toBeLessThanOrEqual(270);
    }
  });

  it('finds the cell under a point, and nothing in the empty gap', () => {
    const board = layout.pack;
    const hit = lootHitAt(layout, board.x + 17 * 2 + 3, board.y + 17 + 3);
    expect(hit).toEqual({ kind: 'cell', gridId: 'backpack', col: 2, row: 1 });
    expect(lootHitAt(layout, 240, 135)).toBeNull();
  });

  it('finds the gear slots and the buttons', () => {
    const slot = layout.gear[1];
    expect(lootHitAt(layout, slot.x + 2, slot.y + 2)).toEqual({ kind: 'gear', slot: 'secondary' });
    const close = layout.buttons.find((b) => b.id === 'close')!;
    expect(lootHitAt(layout, close.x + 1, close.y + 1)).toEqual({ kind: 'button', id: 'close' });
  });

  it('hangs the item in hand at the size its grid footprint shows, and lands it by its first cell', () => {
    const pointer = { x: 200, y: 100 };
    const pistol = { id: 'g', type: 'pistol', x: 0, y: 0, rotated: false };
    const box = heldBox(pistol, pointer);
    expect(box.w + 2).toBeGreaterThanOrEqual(17);
    expect((box.w + 2) % 17).toBe(0);
    expect((box.h + 2) % 17).toBe(0);
    const anchor = heldAnchor(pistol, pointer);
    expect(anchor.x).toBe(box.x + 8);
    expect(anchor.y).toBe(box.y + 8);
  });

  it('lays out the dev edit panel in the gap and finds its buttons, only when asked for', () => {
    expect(layout.editor).toBeNull();
    const edit = { on: true, cols: 4, rows: 2, item: { type: 'bandage', width: 1, height: 1 } };
    const withEditor = layoutLootUi(state, 480, 270, edit);
    const panel = withEditor.editor!;
    expect(panel.box.x).toBeGreaterThan(withEditor.container!.x + withEditor.container!.w);
    expect(panel.box.x + panel.box.w).toBeLessThan(withEditor.survivor.x);
    const up = panel.buttons.find((b) => b.id === 'colsUp')!;
    expect(lootHitAt(withEditor, up.x + 1, up.y + 1)).toEqual({ kind: 'edit', id: 'colsUp' });
    expect(panel.buttons.some((b) => b.id === 'wUp')).toBe(true);
    const noItem = layoutLootUi(state, 480, 270, { ...edit, item: null }).editor!;
    expect(noItem.buttons.some((b) => b.id === 'wUp')).toBe(false);
  });
});
