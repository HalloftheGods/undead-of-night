import { reactive } from 'vue';
import { BUILDING_KINDS } from '../../../shared/map-protocol.ts';
import type { BuildingKind, PropKind } from '../../../shared/map-protocol.ts';
import { containerGridDimensions, CONTAINER_LABEL, ROOM_CONTAINERS } from '../../../shared/containers.ts';
import type { ContainerGridDimensions, ContainerKind } from '../../../shared/containers.ts';
import { CONTAINER_LOOT } from '../../../shared/container-loot.ts';
import { CONTAINER_LOOK_GRID_SIZE } from '../../../shared/container-look-grids.ts';
import type { GridFootprint, GridPoint } from '../../../shared/grid-inventory.ts';
import { buildItemCatalogue, type DevItemEntry } from './item-catalogue.ts';
import { buildContainerCatalogue, type DevContainerEntry } from './container-catalogue.ts';

/**
 * The dev bench's shared state, for every bench that draws it (the Vue page and the canvas page). Edits stay here
 * until a bench saves them; each save target posts to the dev sync server.
 */

/** Loot weights in the editor run 0 to this, so a slider covers them evenly. */
export const MAX_WEIGHT = 10;

export const benchItems: readonly DevItemEntry[] = buildItemCatalogue();
export const benchContainers: readonly DevContainerEntry[] = buildContainerCatalogue();

const footprintDefaults = (): Record<string, GridFootprint> =>
  Object.fromEntries(benchItems.map((item) => [item.id, { width: item.defaultFootprint.width, height: item.defaultFootprint.height }]));

export const footprints = reactive<Record<string, GridFootprint>>(footprintDefaults());

const sizeOf = (kind: ContainerKind): ContainerGridDimensions => {
  const base = containerGridDimensions(kind);
  return { cols: base.cols, rows: base.rows, blocked: base.blocked ? [...base.blocked] : [] };
};

export const containerSizes = reactive<Record<string, ContainerGridDimensions>>(
  Object.fromEntries((Object.keys(CONTAINER_LABEL) as ContainerKind[]).map((kind) => [kind, sizeOf(kind)])),
);

const copyGrid = (grid: ContainerGridDimensions): ContainerGridDimensions => ({
  cols: grid.cols,
  rows: grid.rows,
  blocked: grid.blocked ? grid.blocked.map((p) => ({ x: p.x, y: p.y })) : [],
});

/** Looks (sprite styles) with a grid of their own, by look id. A look not listed here uses its kind's grid. */
export const lookSizes = reactive<Record<string, ContainerGridDimensions>>(
  Object.fromEntries(Object.entries(CONTAINER_LOOK_GRID_SIZE).map(([look, grid]) => [look, copyGrid(grid)])),
);

/** The original look of a kind shares the kind's grid; only the other looks can have their own. */
export const isBaseLook = (entry: Pick<DevContainerEntry, 'kind' | 'look'>): boolean => entry.look === entry.kind;

export const hasOwnGrid = (entry: Pick<DevContainerEntry, 'look'>): boolean => lookSizes[entry.look] !== undefined;

/** The grid this entry opens with: its look's own grid when it has one, else its kind's. In the kind's own orientation. */
export function entryGrid(entry: Pick<DevContainerEntry, 'kind' | 'look'>): ContainerGridDimensions {
  return lookSizes[entry.look] ?? containerSizes[entry.kind] ?? containerGridDimensions(entry.kind);
}

/** Gives a look its own grid, starting from the kind's grid, or takes it away so the look follows its kind again. */
export function setOwnGrid(entry: Pick<DevContainerEntry, 'kind' | 'look'>, own: boolean): void {
  if (isBaseLook(entry)) return;
  if (own) lookSizes[entry.look] = copyGrid(containerSizes[entry.kind] ?? containerGridDimensions(entry.kind));
  else delete lookSizes[entry.look];
}

const clampBlocked = (blocked: readonly GridPoint[] | undefined, cols: number, rows: number): GridPoint[] =>
  (blocked ?? []).filter((p) => p.x < cols && p.y < rows);

/** Resizes the grid this entry opens with: its own when it has one, else its kind's (which every look on it shares). */
export function setEntrySize(entry: Pick<DevContainerEntry, 'kind' | 'look'>, cols: number, rows: number): void {
  const own = lookSizes[entry.look];
  if (!own) return setContainerSize(entry.kind, cols, rows);
  lookSizes[entry.look] = { cols, rows, blocked: clampBlocked(own.blocked, cols, rows) };
}

export function setEntryBlocked(entry: Pick<DevContainerEntry, 'kind' | 'look'>, blocked: GridPoint[]): void {
  const own = lookSizes[entry.look];
  if (!own) return setContainerBlocked(entry.kind, blocked);
  lookSizes[entry.look] = { ...own, blocked };
}

/** One building's draft: its prop-to-container map, its loot odds and its loot pool. Copies, so the code's tables are never touched. */
export interface BuildingDraft {
  rooms: Partial<Record<PropKind, ContainerKind>>;
  odds: number;
  pool: Record<string, number>;
}

export const copyBuildingDraft = (kind: BuildingKind): BuildingDraft => ({
  rooms: { ...ROOM_CONTAINERS[kind] },
  odds: CONTAINER_LOOT[kind].odds,
  pool: { ...CONTAINER_LOOT[kind].table },
});

export const buildingDrafts = reactive<Record<string, BuildingDraft>>(
  Object.fromEntries(BUILDING_KINDS.map((kind) => [kind, copyBuildingDraft(kind)])),
);

const sameJson = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

const sortedEntries = <T>(record: Record<string, T> | Partial<Record<string, T>>): [string, T][] =>
  Object.entries(record as Record<string, T>).sort(([a], [b]) => a.localeCompare(b));

export function isBuildingDirty(kind: BuildingKind): boolean {
  const draft = buildingDrafts[kind];
  const original = CONTAINER_LOOT[kind];
  const roomsDirty = !sameJson(sortedEntries(draft.rooms), sortedEntries(ROOM_CONTAINERS[kind] ?? {}));
  const poolDirty = !sameJson(sortedEntries(draft.pool), sortedEntries(original.table));
  return roomsDirty || poolDirty || draft.odds !== original.odds;
}

export function resetBuilding(kind: BuildingKind): void {
  buildingDrafts[kind] = copyBuildingDraft(kind);
}

export function isItemModified(entry: DevItemEntry): boolean {
  const current = footprints[entry.id];
  if (!current) return false;
  return current.width !== entry.defaultFootprint.width || current.height !== entry.defaultFootprint.height;
}

const sameGrid = (a: ContainerGridDimensions | undefined, b: ContainerGridDimensions | undefined): boolean => {
  if (!a || !b) return a === b;
  return a.cols === b.cols && a.rows === b.rows && sameJson(sortedBlocked(a.blocked), sortedBlocked(b.blocked));
};

/** The look's own grid differs from the code's: added, removed or changed. */
export const isLookModified = (look: string): boolean => !sameGrid(lookSizes[look], CONTAINER_LOOK_GRID_SIZE[look]);

export function isContainerModified(entry: DevContainerEntry): boolean {
  if (isLookModified(entry.look)) return true;
  if (lookSizes[entry.look]) return false;
  const current = containerSizes[entry.kind];
  if (!current) return false;
  const defaults = entry.defaultDimensions;
  const blockedSame = sameJson(sortedBlocked(current.blocked), sortedBlocked(defaults.blocked));
  return !(current.cols === defaults.cols && current.rows === defaults.rows && blockedSame);
}

const sortedBlocked = (blocked?: readonly GridPoint[]): string[] =>
  (blocked ?? []).map((p) => `${p.x}:${p.y}`).sort();

export function setItemSize(id: string, width: number, height: number): void {
  if (!footprints[id]) return;
  footprints[id] = { width: Math.min(6, Math.max(1, width)), height: Math.min(6, Math.max(1, height)) };
}

export function setContainerSize(kind: ContainerKind, cols: number, rows: number): void {
  const current = containerSizes[kind];
  if (!current) return;
  containerSizes[kind] = {
    cols,
    rows,
    blocked: (current.blocked ?? []).filter((p) => p.x < cols && p.y < rows),
  };
}

export function setContainerBlocked(kind: ContainerKind, blocked: GridPoint[]): void {
  const current = containerSizes[kind];
  if (!current) return;
  containerSizes[kind] = { ...current, blocked };
}

export function resetAllItems(): void {
  for (const item of benchItems) footprints[item.id] = { width: item.defaultFootprint.width, height: item.defaultFootprint.height };
}

export function resetAllContainers(): void {
  for (const kind of Object.keys(CONTAINER_LABEL) as ContainerKind[]) containerSizes[kind] = sizeOf(kind);
  for (const look of Object.keys(lookSizes)) delete lookSizes[look];
  for (const [look, grid] of Object.entries(CONTAINER_LOOK_GRID_SIZE)) lookSizes[look] = copyGrid(grid);
}

/** The sync server's save for one target. Resolves true when the code was written. */
export async function syncToCodebase(target: 'items' | 'containers'): Promise<boolean> {
  try {
    const body = target === 'items' ? { target, footprints } : { target, containerSizes, lookSizes };
    const response = await fetch('/api/dev/inventory-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export const containerLabel = (kind: ContainerKind): string => CONTAINER_LABEL[kind];
