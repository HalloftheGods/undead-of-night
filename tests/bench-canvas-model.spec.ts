import { describe, expect, it } from 'vitest';
import { buildBenchModel, type BenchView } from '../src/game/dev/bench-canvas-model.ts';
import { copyBuildingDraft } from '../src/game/dev/bench-store.ts';

const base = (tab: BenchView['tab']): BenchView => ({
  tab,
  building: 'pharmacy',
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

  it('shows the building editor with its rooms, odds and loot pool, and keeps saving disabled', () => {
    const model = buildBenchModel(base('buildings'), { items: 1, objects: 1 });
    const ids = model.panels.flatMap((p) => p.items).map((i) => ('id' in i ? i.id : ''));
    expect(ids).toContain('building:pharmacy');
    expect(ids).toContain('odds');
    expect(model.buttons.find((b) => b.id === 'save-building')?.enabled).toBe(false);
  });
});
