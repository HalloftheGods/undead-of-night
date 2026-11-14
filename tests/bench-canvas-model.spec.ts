import { describe, expect, it } from 'vitest';
import { buildBenchModel, type BenchView } from '../src/game/dev/bench-canvas-model.ts';
import { copyBuildingDraft } from '../src/game/dev/bench-store.ts';

const base = (tab: BenchView['tab']): BenchView => ({
  tab,
  building: 'pharmacy',
  buildingStep: 'pick',
  roomPick: null,
  draft: copyBuildingDraft('pharmacy'),
  buildingDirty: () => false,
  items: [{ id: 'bandage', name: 'Bandage', width: 1, height: 1, modified: false }],
  objects: [{ id: 'box', kind: 'box', name: 'Box', cols: 9, rows: 8, modified: true }],
  itemsModified: 0,
  objectsModified: 1,
  status: '',
});

describe('canvas bench page model', () => {
  it('lists every item as a link keyed by its id', () => {
    const model = buildBenchModel(base('items'), { items: 1, objects: 1 });
    const links = model.panels.flatMap((p) => p.items).filter((i) => i.kind === 'link');
    expect(links.map((l) => l.id)).toContain('item:bandage');
  });

  it('keys object rows by catalogue id and marks modified ones', () => {
    const model = buildBenchModel(base('containers'), { items: 1, objects: 1 });
    const row = model.panels[1].items[0];
    expect(row.kind === 'link' && row.id).toBe('object:box');
    expect(row.kind === 'link' && row.label.startsWith('* ')).toBe(true);
  });

  it('walks the building wizard one step at a time', () => {
    const ids = (step: BenchView['buildingStep']) => {
      const model = buildBenchModel({ ...base('buildings'), buildingStep: step }, { items: 1, objects: 1 });
      return { model, ids: model.panels.flatMap((p) => p.items).map((i) => ('id' in i ? i.id : '')) };
    };
    const pick = ids('pick');
    expect(pick.ids).toContain('building:pharmacy');
    expect(pick.ids).not.toContain('odds');
    expect(pick.model.panels[1].heading).toMatch(/^STEP 1 OF 4/);

    const loot = ids('loot');
    expect(loot.ids).toContain('odds');
    expect(loot.ids).not.toContain('building:pharmacy');
    expect(loot.model.buttons.map((b) => b.id)).toEqual(['step-back', 'step-next']);

    const done = ids('done');
    expect(done.model.buttons.find((b) => b.id === 'save-building')?.enabled).toBe(false);
    expect(done.model.buttons.find((b) => b.id === 'pick-another')?.primary).toBe(true);
  });

  it('lists search spots one per line, and opens a one-box-per-line picker for a spot', () => {
    const rooms = buildBenchModel({ ...base('buildings'), buildingStep: 'rooms' }, { items: 1, objects: 1 });
    const spot = rooms.panels.flatMap((p) => p.items).find((i) => 'id' in i && i.id.startsWith('spot:'));
    expect(spot).toBeDefined();
    expect(rooms.panels.flatMap((p) => p.items).some((i) => i.kind === 'choice' && i.id.startsWith('room:'))).toBe(false);
    const prop = spot && 'id' in spot ? spot.id.slice('spot:'.length) : '';
    const picking = buildBenchModel({ ...base('buildings'), buildingStep: 'rooms', roomPick: prop }, { items: 1, objects: 1 });
    const ids = picking.panels.flatMap((p) => p.items).map((i) => ('id' in i ? i.id : ''));
    expect(ids).toContain('box:locker');
    expect(ids).toContain('box-cancel');
    expect(picking.buttons.map((b) => b.id)).toEqual(['box-cancel']);
  });

  it('puts a picture beside each building, box and item when the art is there', () => {
    const sprite = { w: 4, h: 4, ax: 0, ay: 0, rgba: new Uint8ClampedArray(64) };
    const icons = { building: () => sprite, prop: () => sprite, container: () => sprite, item: () => sprite, object: () => sprite };
    const pick = buildBenchModel({ ...base('buildings'), icons }, { items: 1, objects: 1 });
    const row = pick.panels.flatMap((p) => p.items).find((i) => 'id' in i && i.id === 'building:pharmacy');
    expect(row && row.kind === 'link' && row.icon).toBe(sprite);
    const loot = buildBenchModel({ ...base('buildings'), icons, buildingStep: 'loot' }, { items: 1, objects: 1 });
    expect(loot.panels.flatMap((p) => p.items).some((i) => i.kind === 'link' && i.id.startsWith('foot:') && i.icon === sprite)).toBe(true);
  });
});
