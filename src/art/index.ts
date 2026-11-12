// Assembles the art book. Each lane owns one build function; see the top of its file.

import type { ArtBook } from './types.ts';
import { buildContainers } from './containers.ts';
import { buildPaintedCars } from './containers/vehicles.ts';
import { buildEnvironment } from './environment.ts';
import { buildVehicleArt } from './environment/vehicle-facings.ts';
import { buildMerchants } from './environment/merchants.ts';
import { buildFx, buildPickups } from './fx.ts';
import { buildSurvivors } from './survivors.ts';
import { buildUi } from './ui.ts';
import { buildZombies } from './zombies.ts';

let book: ArtBook | null = null;

function assemble(): ArtBook {
  const environment = buildEnvironment();
  const { vehicles, vehicleBeacons } = buildVehicleArt(environment);
  return {
    survivors: buildSurvivors(),
    zombies: buildZombies(),
    environment,
    pickups: buildPickups(),
    containers: buildContainers(environment.props),
    paintedContainers: buildPaintedCars(environment.paintJobs),
    merchants: buildMerchants(),
    vehicles,
    vehicleBeacons,
    fx: buildFx(),
    ui: buildUi(),
  };
}

export function buildArtBook(): ArtBook {
  book ??= assemble();
  return book;
}
