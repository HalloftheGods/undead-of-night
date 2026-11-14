// Searchable props. Each has two whole sprites that stand in for the prop itself, one shut and one
// searched, so a room reads as gone through at a glance. Anchored like props, on the footprint.

import type { Container, ContainerKind } from '../../shared/containers.ts';
import type { PropKind } from '../../shared/protocol.ts';
import { buildCrateArt } from './containers/cartons.ts';
import { buildDumpsterArt } from './containers/dumpster.ts';
import { buildBedArt, buildBenchArt, buildCounterArt, buildDeskArt } from './containers/fittings.ts';
import { buildCabinetVariants } from './containers/variants/cabinet-variants.ts';
import { buildCrateVariants } from './containers/variants/box-variants.ts';
import { buildDeskVariants } from './containers/variants/desk-variants.ts';
import { buildDrawerVariants } from './containers/variants/drawer-variants.ts';
import { buildDumpsterVariants } from './containers/variants/dumpster-variants.ts';
import { buildFridgeVariants } from './containers/variants/fridge-variants.ts';
import { buildLockerVariants } from './containers/variants/locker-variants.ts';
import { buildRackShelfArt, buildWireShelfArt, buildWoodShelfArt } from './containers/shelf-variants.ts';
import { buildFridgeArt, buildLockerArt, buildShelfArt } from './containers/shelving.ts';
import type { ContainerArt } from './containers/stage.ts';
import { buildCarArt } from './containers/vehicles.ts';
import { buildCandyBowlArt } from './environment/halloween.ts';
import { buildFireworksBusSoldOut } from './environment/fireworks-bus.ts';
import type { CarLook } from './containers/vehicles.ts';
import type { PixelSprite } from './types.ts';

export type { ContainerArt } from './containers/stage.ts';

export type ShelfLook = 'shelf' | 'shelf_wood' | 'shelf_wire' | 'shelf_rack';
/** The pieces that come in five looks: the original and four more, picked per piece by its place in the map. */
export const VARIED_PROPS: Partial<Record<PropKind, ContainerLook>> = {
  bed: 'drawer', locker: 'locker', fridge: 'fridge', counter: 'cabinet', crate_stack: 'box', table: 'desk', dumpster: 'dumpster',
};
export type VariedLook = 'drawer' | 'locker' | 'fridge' | 'cabinet' | 'box' | 'desk' | 'dumpster';
export const VARIANTS_PER_LOOK = 4;
export type VariantLook = `${VariedLook}_v${1 | 2 | 3 | 4}`;

export type ContainerLook = ContainerKind | 'bench' | 'desk' | ShelfLook | VariantLook | Exclude<CarLook, 'car'>;

/** Every shelf look, in the order a town hands them out. */
export const SHELF_LOOKS: readonly ShelfLook[] = ['shelf', 'shelf_wood', 'shelf_wire', 'shelf_rack'];

/** A shelf's look is fixed by its place in the map's props, so it never changes between frames or clients. */
export function shelfLook(propIndex: number): ShelfLook {
  return SHELF_LOOKS[(Math.imul(propIndex + 1, 2654435761) >>> 16) % SHELF_LOOKS.length];
}

/** The props that look different from the rest of their kind. */
const PROP_LOOKS: Partial<Record<PropKind, ContainerLook>> = {
  workbench: 'bench',
  table: 'desk',
  car_sedan_v: 'car_v',
  car_wreck_h: 'wreck',
  van_h: 'van',
  car_hatch_h: 'hatch',
  car_hatch_v: 'hatch_v',
  pickup_h: 'pickup',
  police_h: 'police',
  police_v: 'police_v',
  ambulance_h: 'ambulance',
};

/** Look 0 is the original; 1 to 4 are its variants. The same piece always gets the same one. */
export function variedLook(look: VariedLook, propIndex: number): ContainerLook {
  const n = (Math.imul(propIndex + 1, 2654435761) >>> 16) % (VARIANTS_PER_LOOK + 1);
  return n === 0 ? look : (`${look}_v${n}` as VariantLook);
}

export const containerLook = ({ kind, prop, propIndex }: Pick<Container, 'kind' | 'prop'> & Partial<Pick<Container, 'propIndex'>>): ContainerLook => {
  if (propIndex === undefined) return PROP_LOOKS[prop] ?? kind;
  if (kind === 'shelf') return shelfLook(propIndex);
  const varied = VARIED_PROPS[prop];
  return varied ? variedLook(varied as VariedLook, propIndex) : (PROP_LOOKS[prop] ?? kind);
};

/** Names a prop's variants in order, so a builder's four arts land on the right looks. */
const variantEntries = (look: VariedLook, arts: readonly ContainerArt[]): Record<string, ContainerArt> =>
  Object.fromEntries(arts.slice(0, VARIANTS_PER_LOOK).map((art, i) => [`${look}_v${i + 1}`, art]));

export function buildContainers(props: Record<PropKind, PixelSprite>): Record<ContainerLook, ContainerArt> {
  return {
    drawer: buildBedArt(props.bed),
    locker: buildLockerArt(props.locker),
    fridge: buildFridgeArt(props.fridge),
    cabinet: buildCounterArt(props.counter),
    bench: buildBenchArt(props.workbench),
    desk: buildDeskArt(props.table),
    shelf: buildShelfArt(),
    shelf_wood: buildWoodShelfArt(),
    shelf_wire: buildWireShelfArt(),
    shelf_rack: buildRackShelfArt(),
    ...(variantEntries('drawer', buildDrawerVariants(props.bed)) as Record<`drawer_v${1 | 2 | 3 | 4}`, ContainerArt>),
    ...(variantEntries('locker', buildLockerVariants(props.locker)) as Record<`locker_v${1 | 2 | 3 | 4}`, ContainerArt>),
    ...(variantEntries('fridge', buildFridgeVariants(props.fridge)) as Record<`fridge_v${1 | 2 | 3 | 4}`, ContainerArt>),
    ...(variantEntries('cabinet', buildCabinetVariants(props.counter)) as Record<`cabinet_v${1 | 2 | 3 | 4}`, ContainerArt>),
    ...(variantEntries('box', buildCrateVariants(props.crate_stack)) as Record<`box_v${1 | 2 | 3 | 4}`, ContainerArt>),
    ...(variantEntries('desk', buildDeskVariants(props.table)) as Record<`desk_v${1 | 2 | 3 | 4}`, ContainerArt>),
    ...(variantEntries('dumpster', buildDumpsterVariants(props.dumpster)) as Record<`dumpster_v${1 | 2 | 3 | 4}`, ContainerArt>),
    box: buildCrateArt(props.crate_stack),
    ...buildCarArt(props),
    bowl: buildCandyBowlArt(props.candy_bowl),
    booth: { closed: props.fireworks_bus, opened: buildFireworksBusSoldOut() },
    dumpster: buildDumpsterArt(props.dumpster),
  };
}
