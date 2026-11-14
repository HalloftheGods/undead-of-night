import type { PixelSprite } from '../../art/types.ts';
import type { PageButton, PageItem, PageModel, PagePanel } from '../../engine/page-ui.ts';
import { BUILDING_KINDS } from '../../../shared/map-protocol.ts';
import type { BuildingKind } from '../../../shared/map-protocol.ts';
import { CONTAINER_LABEL } from '../../../shared/containers.ts';
import type { ContainerKind } from '../../../shared/containers.ts';
import { PICKUP_TYPES } from '../../../shared/events.ts';
import { MAX_WEIGHT, type BuildingDraft } from './bench-store.ts';
import {
  buildingLabel,
  changeSummary,
  friendlyName,
  oddsWords,
  stepCounter,
  stepInfo,
  weightWord,
  type BuildingStep,
} from './building-wizard.ts';

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

/** Where the bench's pictures come from; each returns nothing until the art has loaded. */
export interface BenchIcons {
  readonly building: (kind: BuildingKind) => PixelSprite | undefined;
  readonly prop: (prop: string) => PixelSprite | undefined;
  readonly container: (kind: ContainerKind) => PixelSprite | undefined;
  readonly item: (id: string) => PixelSprite | undefined;
  /** A lootable object's own look, by its catalogue id. */
  readonly object: (id: string) => PixelSprite | undefined;
}

const NO_ICONS: BenchIcons = { building: () => undefined, prop: () => undefined, container: () => undefined, item: () => undefined, object: () => undefined };

export interface BenchView {
  /** The pictures beside each building, spot, box and item. */
  readonly icons?: BenchIcons;
  readonly tab: BenchTab;
  readonly building: BuildingKind;
  /** Where the building wizard is. */
  readonly buildingStep: BuildingStep;
  /** The search spot whose box is being picked, if any. */
  readonly roomPick: string | null;
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

const iconsOf = (view: BenchView): BenchIcons => view.icons ?? NO_ICONS;

const itemsPanels = (view: BenchView): PagePanel[] => [
  {
    heading: `ITEMS (${view.itemsModified} MODIFIED)`,
    items: view.items.map((row) => ({
      kind: 'link' as const,
      id: `item:${row.id}`,
      label: `${row.modified ? '* ' : ''}${row.name}  ${row.width}x${row.height}`,
      icon: iconsOf(view).item(row.id),
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
      icon: iconsOf(view).object(row.id),
    })),
  },
];

const stepPanel = (view: BenchView): PagePanel => {
  const info = stepInfo(view.buildingStep);
  const where = view.buildingStep === 'pick' ? '' : `  (${buildingLabel(view.building)})`;
  return {
    heading: `${stepCounter(view.buildingStep).toUpperCase()}${where}`,
    items: [
      { kind: 'text', text: info.ask, tone: 'accent' },
      { kind: 'text', text: info.hint, tone: 'dim' },
    ],
  };
};

const pickPanels = (view: BenchView): PagePanel[] => [
  {
    heading: 'BUILDINGS',
    items: BUILDING_KINDS.map((kind) => ({
      kind: 'link' as const,
      id: `building:${kind}`,
      label: `${view.buildingDirty(kind) ? '* ' : ''}${buildingLabel(kind)}${kind === view.building ? '  <' : ''}`,
      icon: iconsOf(view).building(kind),
    })),
  },
];

const roomsPanels = (view: BenchView): PagePanel[] => {
  const draft = view.draft;
  // One spot at a time: the box list gets a whole panel, one box per line, instead of a crowded row.
  if (view.roomPick) {
    const current = draft.rooms[view.roomPick as keyof typeof draft.rooms];
    return [
      {
        heading: `WHAT SHOULD ${friendlyName(view.roomPick).toUpperCase()} OPEN AS?`,
        items: [
          ...(Object.keys(CONTAINER_LABEL) as ContainerKind[]).map((kind) => ({
            kind: 'link' as const,
            id: `box:${kind}`,
            label: `${CONTAINER_LABEL[kind]}${kind === current ? '  < now' : ''}`,
            icon: iconsOf(view).container(kind),
          })),
          { kind: 'link' as const, id: 'box-cancel', label: '< Keep it the same' },
        ],
      },
    ];
  }
  const rooms: PageItem[] = Object.entries(draft.rooms).map(([prop, container]) => ({
    kind: 'link' as const,
    id: `spot:${prop}`,
    label: `${friendlyName(prop)}  opens as  ${container ? CONTAINER_LABEL[container] : '?'}   (tap to change)`,
    icon: iconsOf(view).prop(prop),
  }));
  const sizes: PageItem[] = Object.values(draft.rooms)
    .filter((c, i, all): c is ContainerKind => c !== undefined && all.indexOf(c) === i)
    .map((kind) => ({
      kind: 'link' as const,
      id: `size:${kind}`,
      label: `Change the size of: ${CONTAINER_LABEL[kind]}`,
      icon: iconsOf(view).container(kind),
    }));
  return [
    {
      heading: 'SEARCH SPOTS',
      items: rooms.length > 0 ? rooms : [{ kind: 'text', text: 'Nothing to search here. Press NEXT.', tone: 'dim' }],
    },
    ...(sizes.length > 0 ? [{ heading: 'BOX SIZES (OPTIONAL)', items: sizes }] : []),
  ];
};

const lootPanels = (view: BenchView): PagePanel[] => {
  const draft = view.draft;
  const pool: PageItem[] = Object.entries(draft.pool)
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([item, weight]) => [
      { kind: 'link' as const, id: `foot:${item}`, label: friendlyName(item), icon: iconsOf(view).item(item) },
      {
        kind: 'slider' as const,
        id: `weight:${item}`,
        label: '  How often',
        value: Math.min(1, weight / MAX_WEIGHT),
        readout: weightWord(weight),
      },
      { kind: 'link' as const, id: `drop:${item}`, label: `  Take out ${friendlyName(item)}` },
    ]);
  const addable = PICKUP_TYPES.find((item) => !(item in draft.pool));
  return [
    {
      heading: 'HOW LUCKY?',
      items: [
        { kind: 'slider', id: 'odds', label: 'Find stuff', value: draft.odds, readout: `${Math.round(draft.odds * 100)}%` },
        { kind: 'text', text: oddsWords(draft.odds), tone: 'dim' },
      ],
    },
    {
      heading: 'THINGS INSIDE',
      items: [
        ...pool,
        ...(addable ? [{ kind: 'link' as const, id: 'add-item', label: `+ Put in ${friendlyName(addable)}`, icon: iconsOf(view).item(addable) }] : []),
      ],
    },
  ];
};

const donePanels = (view: BenchView): PagePanel[] => {
  const lines = changeSummary(view.building, view.draft);
  return [
    {
      heading: 'YOUR CHANGES',
      items:
        lines.length > 0
          ? lines.map((text) => ({ kind: 'text' as const, text, tone: 'bone' as const }))
          : [{ kind: 'text', text: 'You did not change anything. That is OK!', tone: 'dim' }],
    },
    { heading: 'WHAT NEXT?', items: [{ kind: 'link', id: 'pick-another', label: 'Change another building' }] },
  ];
};

const buildingPanels = (view: BenchView): PagePanel[] => {
  const body =
    view.buildingStep === 'pick'
      ? pickPanels(view)
      : view.buildingStep === 'rooms'
        ? roomsPanels(view)
        : view.buildingStep === 'loot'
          ? lootPanels(view)
          : donePanels(view);
  return [stepPanel(view), ...body];
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
  const step = view.buildingStep;
  const backButton: PageButton =
    step === 'pick' ? back : { id: 'step-back', label: '< BACK', enabled: true, primary: false };
  if (step === 'pick') return [backButton];
  if (step === 'done') {
    return [
      backButton,
      { id: 'reset-building', label: 'UNDO MY CHANGES', enabled: view.buildingDirty(view.building), primary: false },
      // The building and loot save target lands in a later phase; the draft stays in memory until then.
      { id: 'save-building', label: 'SAVE: PHASE 2', enabled: false, primary: false },
      { id: 'pick-another', label: 'FINISH', enabled: true, primary: true },
    ];
  }
  if (view.roomPick) return [{ id: 'box-cancel', label: '< BACK', enabled: true, primary: false }];
  return [backButton, { id: 'step-next', label: 'NEXT >', enabled: true, primary: true }];
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
