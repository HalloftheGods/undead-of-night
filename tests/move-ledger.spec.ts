import { describe, expect, it } from 'vitest';
import type { BagLayoutRow } from '../shared/bag.ts';
import type { GridItem } from '../shared/grid-inventory.ts';
import type { ItemMove } from '../shared/item-move.ts';
import { MoveLedger, PENDING_TIMEOUT_MS, type LedgerContainer, type LedgerView } from '../src/game/inventory/move-ledger.ts';

const BOX = 7;
const noGear = { primary: null, secondary: null, sidearm: null, armor: null };
const bandage = (id: string, x: number, y = 0): GridItem => ({ id, type: 'bandage', x, y, rotated: false });

function box(items: readonly GridItem[]): LedgerContainer {
  return { id: BOX, cols: 3, rows: 3, items };
}

function view(bag: readonly BagLayoutRow[], lastMoveId: number, container: LedgerContainer | null = box([])): LedgerView {
  return { tier: 'satchel', bag, lastMoveId, container, candy: [], gear: noGear };
}

/** A ledger whose moves are kept, with a clock the spec sets. */
function ledgerAt() {
  const sent: ItemMove[] = [];
  let clock = 0;
  const ledger = new MoveLedger((move) => sent.push(move), () => clock);
  return { ledger, sent, tick: (ms: number) => { clock += ms; } };
}

const takeFromBox = (item: GridItem, x: number, y = 0): Omit<ItemMove, 'id'> => ({
  item: item.id,
  type: item.type,
  from: { kind: 'cell', grid: 'container', x: item.x, y: item.y },
  to: { kind: 'cell', grid: 'pack', x, y, rotated: false },
  container: BOX,
});

const shown = (ledger: MoveLedger) => ({
  pack: ledger.grids().pack.items.map(({ type, x, y, rotated }) => ({ type, x, y, rotated })),
  container: ledger.grids().container?.items.map((item) => item.id) ?? [],
});

describe('the move ledger', () => {
  it('shows a proposed move at once and sends it numbered', () => {
    const { ledger, sent } = ledgerAt();
    ledger.confirm(view([], 0, box([bandage('c-1', 0)])));
    const move = ledger.propose(takeFromBox(bandage('c-1', 0), 2));
    expect(move?.id).toBe(1);
    expect(sent).toEqual([move]);
    expect(shown(ledger)).toEqual({ pack: [{ type: 'bandage', x: 2, y: 0, rotated: false }], container: [] });
  });

  it('sends nothing for a move that does not apply where it is shown', () => {
    const { ledger, sent } = ledgerAt();
    ledger.confirm(view([{ type: 'bandage', grid: 'pack', x: 2, y: 0, rotated: false, id: 'bandage:1' }], 0, box([bandage('c-1', 0)])));
    expect(ledger.propose(takeFromBox(bandage('c-1', 0), 2))).toBeNull();
    expect(ledger.propose(takeFromBox(bandage('nope', 1), 0))).toBeNull();
    expect(sent).toEqual([]);
  });

  it('does not flicker when a snapshot that already has the move comes before its answer', () => {
    const { ledger } = ledgerAt();
    ledger.confirm(view([], 0, box([bandage('c-1', 0)])));
    const move = ledger.propose(takeFromBox(bandage('c-1', 0), 2))!;
    const before = shown(ledger);
    // The host packed the find under its own id, in the cell the move named.
    const change = ledger.confirm(view([{ type: 'bandage', grid: 'pack', x: 2, y: 0, rotated: false, id: 'bandage:9' }], move.id, box([])));
    expect(shown(ledger)).toEqual(before);
    expect(ledger.pendingMoves()).toEqual([]);
    expect(change).toMatchObject({ rejected: [], vanished: [] });
    expect(change.renamed).toEqual([['c-1', 'bandage:9']]);
    // The late answer changes nothing.
    expect(ledger.answer(move.id, true)).toMatchObject({ rejected: [], vanished: [] });
    expect(shown(ledger)).toEqual(before);
  });

  it('keeps showing a move that a snapshot from before it does not have yet', () => {
    const { ledger } = ledgerAt();
    ledger.confirm(view([], 0, box([bandage('c-1', 0)])));
    ledger.propose(takeFromBox(bandage('c-1', 0), 2));
    const before = shown(ledger);
    ledger.confirm(view([], 0, box([bandage('c-1', 0)])));
    expect(shown(ledger)).toEqual(before);
    expect(ledger.pendingMoves()).toHaveLength(1);
  });

  it('keeps an answered ok on screen until a snapshot has it', () => {
    const { ledger } = ledgerAt();
    ledger.confirm(view([], 0, box([bandage('c-1', 0), bandage('c-2', 1)])));
    const first = ledger.propose(takeFromBox(bandage('c-1', 0), 2))!;
    const second = ledger.propose(takeFromBox(bandage('c-2', 1), 3))!;
    ledger.answer(first.id, true);
    // The second is refused: the rebuild must not lose the first, which the host has but no snapshot showed yet.
    const change = ledger.answer(second.id, false);
    expect(change.rejected.map((move) => move.id)).toEqual([second.id]);
    expect(shown(ledger).pack).toEqual([{ type: 'bandage', x: 2, y: 0, rotated: false }]);
    expect(shown(ledger).container).toEqual(['c-2']);
  });

  it('puts a refused item back at its source and names the move', () => {
    const { ledger } = ledgerAt();
    ledger.confirm(view([], 0, box([bandage('c-1', 0)])));
    const move = ledger.propose(takeFromBox(bandage('c-1', 0), 2))!;
    const change = ledger.answer(move.id, false);
    expect(change.rejected).toEqual([move]);
    expect(shown(ledger)).toEqual({ pack: [], container: ['c-1'] });
    expect(ledger.pendingMoves()).toEqual([]);
  });

  it('rejects a move that leaned on a refused one along with it', () => {
    const { ledger } = ledgerAt();
    ledger.confirm(view([], 0, box([bandage('c-1', 0)])));
    const first = ledger.propose(takeFromBox(bandage('c-1', 0), 2))!;
    // Then the same bandage moves on within the pack: that only applies if the first did.
    const second = ledger.propose({ item: 'c-1', type: 'bandage', from: { kind: 'cell', grid: 'pack', x: 2, y: 0 }, to: { kind: 'cell', grid: 'pack', x: 4, y: 3, rotated: false } })!;
    const change = ledger.answer(first.id, false);
    expect(change.rejected.map((move) => move.id)).toEqual([first.id, second.id]);
    expect(shown(ledger)).toEqual({ pack: [], container: ['c-1'] });
  });

  it('says a container item vanished when the host lost it and no move here took it', () => {
    const { ledger } = ledgerAt();
    ledger.confirm(view([], 0, box([bandage('c-1', 0), bandage('c-2', 1)])));
    const change = ledger.confirm(view([], 0, box([bandage('c-2', 1)])));
    expect(change.vanished.map((item) => item.id)).toEqual(['c-1']);
    expect(change.rejected).toEqual([]);
  });

  it('does not call an item vanished that our own move took, and rejects ours if a teammate took it first', () => {
    const { ledger } = ledgerAt();
    ledger.confirm(view([], 0, box([bandage('c-1', 0)])));
    const move = ledger.propose(takeFromBox(bandage('c-1', 0), 2))!;
    // A teammate's move took it first: the host has it gone, and ours has not been applied.
    const change = ledger.confirm(view([], 0, box([])));
    expect(change.vanished).toEqual([]);
    expect(change.rejected).toEqual([move]);
    expect(shown(ledger)).toEqual({ pack: [], container: [] });
  });

  it('takes a move left unanswered past the timeout as a no', () => {
    const { ledger, tick } = ledgerAt();
    ledger.confirm(view([], 0, box([bandage('c-1', 0)])));
    const move = ledger.propose(takeFromBox(bandage('c-1', 0), 2))!;
    tick(PENDING_TIMEOUT_MS);
    expect(ledger.expire().rejected).toEqual([]);
    tick(1);
    expect(ledger.expire().rejected).toEqual([move]);
    expect(shown(ledger)).toEqual({ pack: [], container: ['c-1'] });
  });

  it('keeps moves on a closed window pending, and their answers still settle the ledger', () => {
    const { ledger } = ledgerAt();
    ledger.confirm(view([], 0, box([bandage('c-1', 0)])));
    const move = ledger.propose(takeFromBox(bandage('c-1', 0), 2))!;
    // The window closes: no container in view any more. The move waits; it is not thrown away.
    ledger.confirm(view([], 0, null));
    expect(ledger.pendingMoves()).toEqual([move]);
    // The host took it: the snapshot has it in the bag, and nothing is lost.
    ledger.confirm(view([{ type: 'bandage', grid: 'pack', x: 2, y: 0, rotated: false, id: 'bandage:4' }], move.id, null));
    expect(ledger.pendingMoves()).toEqual([]);
    expect(shown(ledger).pack).toEqual([{ type: 'bandage', x: 2, y: 0, rotated: false }]);
  });

  it('numbers past the host when the host has applied more than this window sent', () => {
    const { ledger } = ledgerAt();
    ledger.confirm(view([{ type: 'bandage', grid: 'pack', x: 0, y: 0, rotated: false, id: 'bandage:1' }], 12));
    const move = ledger.propose({ item: 'bandage:1', type: 'bandage', from: { kind: 'cell', grid: 'pack', x: 0, y: 0 }, to: { kind: 'cell', grid: 'pockets', x: 0, y: 0, rotated: false } });
    expect(move?.id).toBe(13);
  });

  it('leaves a box of rounds in the bag when it is loaded', () => {
    const { ledger } = ledgerAt();
    ledger.confirm(view([{ type: 'pistol_ammo', grid: 'pack', x: 0, y: 0, rotated: false, id: 'pistol_ammo:1', ammo: 12 }], 0));
    const move = ledger.propose({ item: 'pistol_ammo:1', type: 'pistol_ammo', from: { kind: 'cell', grid: 'pack', x: 0, y: 0 }, to: { kind: 'use' } });
    expect(move).not.toBeNull();
    expect(ledger.grids().pack.items.map((item) => item.id)).toEqual(['pistol_ammo:1']);
  });

  it('keeps the candy bag as the window had it, brought to the host count', () => {
    const { ledger } = ledgerAt();
    ledger.confirm({ ...view([], 0), candy: [{ id: 'jawbreaker', count: 2 }] });
    const ids = ledger.grids().candy.items.map((item) => item.id);
    ledger.confirm({ ...view([], 0), candy: [{ id: 'jawbreaker', count: 3 }] });
    const after = ledger.grids().candy.items.map((item) => item.id);
    expect(after).toHaveLength(3);
    expect(after.slice(0, 2)).toEqual(ids);
  });
});
