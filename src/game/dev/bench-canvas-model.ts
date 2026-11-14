import type { PageButton, PageItem, PageModel, PagePanel } from '../../engine/page-ui.ts';
import { BUILDING_DEFS, BUILDING_KINDS } from '../../../shared/map-protocol.ts';
import type { BuildingKind } from '../../../shared/map-protocol.ts';
import { CONTAINER_LABEL } from '../../../shared/containers.ts';
import type { ContainerKind } from '../../../shared/containers.ts';
import { PICKUP_TYPES } from '../../../shared/events.ts';
import { MAX_WEIGHT, type BuildingDraft } from './bench-store.ts';

/**
 * The canvas bench's page, as the page kit draws it: a pure function of what the bench shows, so it can be read and
 * tested without the canvas. Control ids are prefixed by what they change; the canvas bench reads the prefix back.
 */

export type BenchTab = 'items' | 'containers' | 'buildings';

export interface ItemRow {
  readonly id: string;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly modified: boolean;
}

export interface ObjectRow {
  /** The catalogue entry id: several looks share one kind. */
  readonly id: string;
  readonly kind: ContainerKind;
  readonly name: string;
  readonly cols: number;
  readonly rows: number;
  readonly modified: boolean;
}

export interface BenchView {
  readonly tab: BenchTab;
  readonly building: BuildingKind;
  readonly draft: BuildingDraft;
  readonly buildingDirty: (kind: BuildingKind) => boolean;
  readonly items: readonly ItemRow[];
  readonly objects: readonly ObjectRow[];
  readonly itemsModified: number;
  readonly objectsModified: number;
  /** A one-line status under the heading, such as "SAVED TO CODE!". */
  readonly status: string;
}

const VIEW_LABEL: Record<BenchTab, string> = { items: 'ITEMS', containers: 'LOOTABLE OBJECTS', buildings: 'BUILDINGS' };

const tabPanel = (view: BenchView, counts: { items: number; objects: number }): PagePanel => ({
  heading: 'VIEW',
  items: [
    {
      kind: 'choice',
      id: 'view',
      label: 'Section',
      value: view.tab,
      options: [
        { id: 'items', label: `Items (${counts.items})` },
        { id: 'containers', label: `Objects (${counts.objects})` },
        { id: 'buildings', label: `Buildings (${BUILDING_KINDS.length})` },
      ],
    },
  ],
});

const itemsPanels = (view: BenchView): PagePanel[] => [
  {
    heading: `ITEMS (${view.itemsModified} MODIFIED)`,
    items: view.items.map((row) => ({
      kind: 'link' as const,
      id: `item:${row.id}`,
      label: `${row.modified ? '* ' : ''}${row.name}  ${row.width}x${row.height}`,
    })),
  },
];

const objectsPanels = (view: BenchView): PagePanel[] => [
  {
    heading: `LOOTABLE OBJECTS (${view.objectsModified} MODIFIED)`,
    items: view.objects.map((row) => ({
      kind: 'link' as const,
      id: `object:${row.id}`,
      label: `${row.modified ? '* ' : ''}${row.name}  ${row.cols}x${row.rows}`,
    })),
  },
];

const buildingPanels = (view: BenchView): PagePanel[] => {
  const label = BUILDING_DEFS[view.building].label;
  const draft = view.draft;
  const rooms: PageItem[] = Object.entries(draft.rooms).map(([prop, container]) => ({
    kind: 'choice' as const,
    id: `room:${prop}`,
    label: prop,
    value: container ?? '',
    options: (Object.keys(CONTAINER_LABEL) as ContainerKind[]).map((kind) => ({ id: kind, label: CONTAINER_LABEL[kind] })),
  }));
  const pool: PageItem[] = Object.entries(draft.pool)
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([item, weight]) => [
      {
        kind: 'slider' as const,
        id: `weight:${item}`,
        label: item,
        value: Math.min(1, weight / MAX_WEIGHT),
        readout: `${Math.round(weight * 100) / 100}`,
      },
      { kind: 'link' as const, id: `foot:${item}`, label: `  footprint of ${item}` },
      { kind: 'link' as const, id: `drop:${item}`, label: `  remove ${item}` },
    ]);
  const addable = PICKUP_TYPES.find((item) => !(item in draft.pool));
  const sizes: PageItem[] = Object.values(draft.rooms)
    .filter((c, i, all): c is ContainerKind => c !== undefined && all.indexOf(c) === i)
    .map((kind) => ({ kind: 'link' as const, id: `size:${kind}`, label: `Size grid: ${CONTAINER_LABEL[kind]}` }));

  return [
    {
      heading: `BUILDINGS (${BUILDING_KINDS.length})`,
      items: BUILDING_KINDS.map((kind) => ({
        kind: 'link' as const,
        id: `building:${kind}`,
        label: `${view.buildingDirty(kind) ? '* ' : ''}${BUILDING_DEFS[kind].label}${kind === view.building ? '  <' : ''}`,
      })),
    },
    {
      heading: `${label.toUpperCase()}: ROOMS, PROP TO CONTAINER`,
      items: rooms.length > 0 ? rooms : [{ kind: 'text', text: 'No searchable props in this building.', tone: 'dim' }],
    },
    {
      heading: `${label.toUpperCase()}: CONTAINER SIZES`,
      items: sizes.length > 0 ? sizes : [{ kind: 'text', text: 'Nothing to size here.', tone: 'dim' }],
    },
    {
      heading: `${label.toUpperCase()}: LOOT (ODDS ${Math.round(draft.odds * 100)}%)`,
      items: [
        { kind: 'slider', id: 'odds', label: 'Odds', value: draft.odds, readout: `${Math.round(draft.odds * 100)}%` },
        ...pool,
        ...(addable ? [{ kind: 'link' as const, id: 'add-item', label: `Add item: ${addable}` }] : []),
      ],
    },
  ];
};

const footerFor = (view: BenchView): PageButton[] => {
  const back: PageButton = { id: 'back', label: 'BACK', enabled: true, primary: false };
  if (view.tab === 'items') {
    return [
      back,
      { id: 'reset-items', label: 'RESET ALL ITEMS', enabled: view.itemsModified > 0, primary: false },
      { id: 'save-items', label: 'SAVE ITEMS', enabled: view.itemsModified > 0, primary: true },
    ];
  }
  if (view.tab === 'containers') {
    return [
      back,
      { id: 'reset-objects', label: 'RESET ALL OBJECTS', enabled: view.objectsModified > 0, primary: false },
      { id: 'save-objects', label: 'SAVE OBJECTS', enabled: view.objectsModified > 0, primary: true },
    ];
  }
  return [
    back,
    { id: 'reset-building', label: 'RESET BUILDING', enabled: view.buildingDirty(view.building), primary: false },
    // The building and loot save target lands in a later phase; the draft stays in memory until then.
    { id: 'save-building', label: 'SAVE: PHASE 2', enabled: false, primary: true },
  ];
};

/** The whole bench page for the view given. */
export function buildBenchModel(view: BenchView, counts: { items: number; objects: number }): PageModel {
  const heading = `${VIEW_LABEL[view.tab]} DEV BENCH${view.status ? `  ${view.status}` : ''}`;
  const body =
    view.tab === 'items' ? itemsPanels(view) : view.tab === 'containers' ? objectsPanels(view) : buildingPanels(view);
  return {
    heading,
    panels: [tabPanel(view, counts), ...body],
    buttons: footerFor(view),
  };
}
