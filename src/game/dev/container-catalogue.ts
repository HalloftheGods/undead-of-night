import {
  CONTAINER_GRID_SIZE,
  CONTAINER_LABEL,
  SEARCH_SEC,
  containerGridDimensions,
  type ContainerGridDimensions,
  type ContainerKind,
} from '../../../shared/containers.ts';
import type { ContainerLook } from '../../art/containers.ts';

export interface DevContainerEntry {
  readonly id: string;
  readonly kind: ContainerKind;
  readonly look: ContainerLook;
  readonly label: string;
  readonly name: string;
  readonly searchSec: number;
  readonly defaultDimensions: ContainerGridDimensions;
  readonly isExplicitlyMapped: boolean;
  readonly description: string;
}

const PRIMARY_CONTAINERS: ReadonlyArray<{
  readonly kind: ContainerKind;
  readonly look: ContainerLook;
  readonly name: string;
  readonly description: string;
}> = [
  { kind: 'drawer', look: 'drawer', name: 'Bed / Nightstand Drawer', description: 'Houses, apartments, hospital wards and bedrooms.' },
  { kind: 'locker', look: 'locker', name: 'Storage Locker', description: 'Clinics, gun shops, police stations and garages.' },
  { kind: 'fridge', look: 'fridge', name: 'Kitchen Refrigerator', description: 'Diners, residential kitchens and radio stations.' },
  { kind: 'cabinet', look: 'cabinet', name: 'Kitchen Counter / Cabinet', description: 'Grocery stores, pharmacies, clinics and stores.' },
  { kind: 'shelf', look: 'shelf', name: 'Storage Shelving', description: 'Warehouses, garages, cellars and stores.' },
  { kind: 'box', look: 'box', name: 'Crate Stack / Cardboard Box', description: 'Warehouses, cellars, discount shops and alleys.' },
  { kind: 'car', look: 'car', name: 'Abandoned Vehicle Trunk', description: 'Streets, lots, driveways and outdoor avenues.' },
  { kind: 'bowl', look: 'bowl', name: 'Trick-or-Treat Candy Bowl', description: 'Front porches and residential doorsteps.' },
  { kind: 'booth', look: 'booth', name: 'Fireworks Bus Counter', description: 'Outdoor festival bus in town squares.' },
  { kind: 'dumpster', look: 'dumpster', name: 'Commercial Dumpster', description: 'Alleyways, warehouses and garage lots.' },
];

const VARIANT_CONTAINERS: ReadonlyArray<{
  readonly kind: ContainerKind;
  readonly look: ContainerLook;
  readonly name: string;
  readonly description: string;
}> = [
  { kind: 'cabinet', look: 'bench', name: 'Workbench (Cabinet)', description: 'Cellars, garages, warehouses and workshops.' },
  { kind: 'drawer', look: 'desk', name: 'Classroom Desk (Drawer)', description: 'Schools and administrative offices.' },
  { kind: 'car', look: 'police', name: 'Police Cruiser Trunk', description: 'Streets near police station, armory loot.' },
  { kind: 'car', look: 'ambulance', name: 'Ambulance Medical Bay', description: 'Hospital lots and emergency zones.' },
  { kind: 'car', look: 'van', name: 'Delivery Work Van', description: 'Streets, warehouse loading docks.' },
];

export function buildContainerCatalogue(): DevContainerEntry[] {
  const allDefs = [...PRIMARY_CONTAINERS, ...VARIANT_CONTAINERS];

  return allDefs.map((def) => {
    const isExplicitlyMapped = CONTAINER_GRID_SIZE[def.kind] !== undefined;
    const defaultDimensions = containerGridDimensions(def.kind);

    return {
      id: def.look === def.kind ? def.kind : `${def.kind}_${def.look}`,
      kind: def.kind,
      look: def.look,
      label: CONTAINER_LABEL[def.kind],
      name: def.name,
      searchSec: SEARCH_SEC[def.kind],
      defaultDimensions: { cols: defaultDimensions.cols, rows: defaultDimensions.rows },
      isExplicitlyMapped,
      description: def.description,
    };
  });
}

export function generateContainerGridSizeCode(
  sizes: Record<ContainerKind, ContainerGridDimensions>,
  modifiedOnly = false,
  originalSizes: Partial<Record<ContainerKind, ContainerGridDimensions>> = CONTAINER_GRID_SIZE,
): string {
  const kinds = (Object.keys(CONTAINER_LABEL) as ContainerKind[]).sort();
  const lines: string[] = [];

  if (modifiedOnly) {
    for (const kind of kinds) {
      const current = sizes[kind];
      const original = originalSizes[kind] ?? containerGridDimensions(kind);
      const isModified = current.cols !== original.cols || current.rows !== original.rows;
      if (isModified) {
        lines.push(`  ${kind}: { cols: ${current.cols}, rows: ${current.rows} },`);
      }
    }

    if (lines.length === 0) {
      return '// No container grid sizes modified from original defaults.';
    }

    return [
      '// Modified container grid sizes only:',
      ...lines,
    ].join('\n');
  }

  for (const kind of kinds) {
    const current = sizes[kind];
    lines.push(`  ${kind}: { cols: ${current.cols}, rows: ${current.rows} },`);
  }

  return [
    'export const CONTAINER_GRID_SIZE: Partial<Record<ContainerKind, ContainerGridDimensions>> = {',
    ...lines,
    '};',
  ].join('\n');
}

export function generateContainerGridSizeJson(
  sizes: Record<ContainerKind, ContainerGridDimensions>,
  modifiedOnly = false,
  originalSizes: Partial<Record<ContainerKind, ContainerGridDimensions>> = CONTAINER_GRID_SIZE,
): string {
  if (!modifiedOnly) {
    return JSON.stringify(sizes, null, 2);
  }

  const modified: Partial<Record<ContainerKind, ContainerGridDimensions>> = {};
  for (const [key, current] of Object.entries(sizes) as [ContainerKind, ContainerGridDimensions][]) {
    const original = originalSizes[key] ?? containerGridDimensions(key);
    const isModified = current.cols !== original.cols || current.rows !== original.rows;
    if (isModified) {
      modified[key] = current;
    }
  }

  return JSON.stringify(modified, null, 2);
}
