// Searchable props. Each has two whole sprites that stand in for the prop itself, one shut and one
// searched, so a room reads as gone through at a glance. Anchored like props, on the footprint.

import type { Container, ContainerKind } from '../../shared/containers.ts';
import type { PropKind } from '../../shared/protocol.ts';
import { buildCrateArt } from './containers/cartons.ts';
import { buildBedArt, buildBenchArt, buildCounterArt, buildDeskArt } from './containers/fittings.ts';
import { buildFridgeArt, buildLockerArt, buildShelfArt } from './containers/shelving.ts';
import type { ContainerArt } from './containers/stage.ts';
import { buildCarArt } from './containers/vehicles.ts';
import { buildCandyBowlArt } from './environment/halloween.ts';
import type { CarLook } from './containers/vehicles.ts';
import type { PixelSprite } from './types.ts';

export type { ContainerArt } from './containers/stage.ts';

export type ContainerLook = ContainerKind | 'bench' | 'desk' | Exclude<CarLook, 'car'>;

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

export const containerLook = ({ kind, prop }: Pick<Container, 'kind' | 'prop'>): ContainerLook => PROP_LOOKS[prop] ?? kind;

export function buildContainers(props: Record<PropKind, PixelSprite>): Record<ContainerLook, ContainerArt> {
  return {
    drawer: buildBedArt(props.bed),
    locker: buildLockerArt(props.locker),
    fridge: buildFridgeArt(props.fridge),
    cabinet: buildCounterArt(props.counter),
    bench: buildBenchArt(props.workbench),
    desk: buildDeskArt(props.table),
    shelf: buildShelfArt(),
    box: buildCrateArt(props.crate_stack),
    ...buildCarArt(props),
    bowl: buildCandyBowlArt(props.candy_bowl),
  };
}
