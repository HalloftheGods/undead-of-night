// Every car in all four facings. West is the side-on prop, east its mirror, north the nose-up
// prop (drawn fresh where none exists), and south is its own drawing: windscreen and headlamps
// toward the player, tail lamps at the far end, never the nose-up sprite turned over.

import type { Clip, PixelSprite } from '../types.ts';
import type { PropKind } from '../../../shared/protocol.ts';
import { VEHICLE_BODY_IDS, VEHICLE_FACINGS } from '../../../shared/vehicle-bodies.ts';
import type { VehicleBody, VehicleFacing } from '../../../shared/vehicle-bodies.ts';
import { mirrorClip, mirrorSprite } from '../kit.ts';
import { RAMPS } from '../palette.ts';
import type { Ramp } from '../palette.ts';
import { HATCH_V } from './car-bodies.ts';
import { BLACK, CAR_PAINTS } from './car-paints.ts';
import { AMBULANCE, beacon, BLUE, CLEAR, paintBar, RED, twoTone } from './emergency.ts';
import type { Bar } from './emergency.ts';
import { pickupN, pickupS, VAN_NGROUND, VAN_NH, VAN_NW, vanBodyN, bakeVanN, vanN } from './vehicle-trucks.ts';
import { VAN_LIVERIES } from './van.ts';
import { bakeNoseUp, noseUpBody, SEDAN_V, SEDAN_V_W, STEEL } from './vehicles.ts';

const { ink, blood } = RAMPS;
const V = SEDAN_V;
const bare = (row: string): string => row.replace(/^K/, '.').replace(/K$/, '.');
const front = (row: string): string => row.replaceAll('R', 'L').replaceAll('r', 'l');

/** Nose down: tail lamps at the far edge, boot, rear glass, roof, windscreen, hood, then the grille and bumper. */
export const SEDAN_S = [
  '....RRppppppppRR....',
  ...V.slice(2, 9),
  ...V.slice(12, 19),
  ...V.slice(19, 22), ...V.slice(24, 27), ...V.slice(27, 30),
  ...V.slice(30, 34).map(bare), V[18],
  ...V.slice(2, 10), V[1].replaceAll('P', 'p'),
  ...V.slice(39).map(front),
];

/** The hatch is short in the boot: four rows go from the tail end of the sedan. */
export const HATCH_S = SEDAN_S.filter((_, i) => ![2, 3, 17, 18].includes(i));

const sedanS = (paint: Ramp): PixelSprite => bakeNoseUp(noseUpBody(SEDAN_S, paint), SEDAN_S);
const hatchS = (paint: Ramp): PixelSprite => bakeNoseUp(noseUpBody(HATCH_S, paint), HATCH_S);
const sedanN = (paint: Ramp): PixelSprite => bakeNoseUp(noseUpBody(V, paint), V);
const hatchN = (paint: Ramp): PixelSprite => bakeNoseUp(noseUpBody(HATCH_V, paint), HATCH_V);

/** The cruiser nose down: the roof is white and the bar sits across it, red now to the right. */
const CRUISER_S_BAR: Bar = { first: [[11, 19, 8, 2]], firstColor: RED, second: [[3, 19, 8, 2]], secondColor: BLUE };

function policeS(): PixelSprite {
  const c = noseUpBody(SEDAN_S, BLACK);
  twoTone(c, 1, 9, SEDAN_V_W, 29);
  c.rect(2, 18, 18, 4, ink[1]);
  paintBar(c, CRUISER_S_BAR, null);
  return bakeNoseUp(c, SEDAN_S);
}

const policeSLights = (): Clip => beacon(SEDAN_V_W + 2, SEDAN_S.length + 4, 1, SEDAN_V_W, SEDAN_S.length + 1, CRUISER_S_BAR);

/** A bar over the cab roof and lamps at the far end of the roof. */
const AMBULANCE_N_BAR: Bar = {
  first: [[6, 19, 7, 3], [3, 45, 4, 2]], firstColor: RED,
  second: [[13, 19, 7, 3], [19, 45, 4, 2]], secondColor: CLEAR,
};
const AMBULANCE_S_BAR: Bar = {
  first: [[13, 24, 7, 3], [19, 2, 4, 2]], firstColor: RED,
  second: [[6, 24, 7, 3], [3, 2, 4, 2]], secondColor: CLEAR,
};

function ambulance(noseUp: boolean): PixelSprite {
  const c = vanBodyN(AMBULANCE, noseUp);
  const bar = noseUp ? AMBULANCE_N_BAR : AMBULANCE_S_BAR;
  const top = noseUp ? 16 : 1;
  c.rect(5, bar.first[0][1] - 1, 16, 5, ink[1]);
  paintBar(c, bar, null);
  // The invented six-armed star again, on the roof behind the bar, and a stripe down each flank.
  const [sx, sy] = [12, top + (noseUp ? 15 : 12)];
  c.rect(sx - 2, sy, 5, 1, blood[2]).rect(sx, sy - 2, 1, 5, blood[2]);
  c.px(sx - 1, sy - 1, blood[2]).px(sx + 1, sy + 1, blood[2]).px(sx + 1, sy - 1, blood[2]).px(sx - 1, sy + 1, blood[2]);
  c.rect(3, top + 4, 1, 22, blood[1]).rect(VAN_NW - 2, top + 4, 1, 22, blood[1]);
  return bakeVanN(c);
}

const ambulanceLights = (noseUp: boolean): Clip =>
  beacon(VAN_NW + 2, VAN_NH, 1, VAN_NW, VAN_NGROUND, noseUp ? AMBULANCE_N_BAR : AMBULANCE_S_BAR);

type Facings<T> = Record<VehicleFacing, T>;

/** The four facings of a body, each one sprite per coat; east is west mirrored, anchor and all. */
function facings(west: readonly PixelSprite[], north: (i: number) => PixelSprite, south: (i: number) => PixelSprite): Facings<readonly PixelSprite[]> {
  return {
    w: west,
    e: west.map(mirrorSprite),
    n: west.map((_, i) => north(i)),
    s: west.map((_, i) => south(i)),
  };
}

export interface VehicleArt {
  /** Every body, every facing, one sprite per coat in the order of that body's side-on paintJobs. */
  readonly vehicles: Record<VehicleBody, Facings<readonly PixelSprite[]>>;
  /** The light bars of the police car and the ambulance, over the sprite of the same facing. */
  readonly vehicleBeacons: Partial<Record<VehicleBody, Facings<Clip>>>;
}

/** What the environment already drew: the side-on props, their coats and the beacons. */
export interface SideOnArt {
  readonly props: Record<PropKind, PixelSprite>;
  readonly paintJobs: Partial<Record<PropKind, readonly PixelSprite[]>>;
  readonly beacons: Partial<Record<PropKind, Clip>>;
}

/** Builds the four-facing vehicle art around the side-on sprites, which are reused as they are. */
export function buildVehicleArt(env: SideOnArt): VehicleArt {
  const coats = (kind: PropKind): readonly PixelSprite[] => env.paintJobs[kind] ?? [env.props[kind]];
  const paint = (i: number): Ramp => CAR_PAINTS[i] ?? STEEL;
  const van = (noseUp: boolean) => (i: number): PixelSprite => vanN(VAN_LIVERIES[i], noseUp);
  const vehicles: Record<VehicleBody, Facings<readonly PixelSprite[]>> = {
    sedan: facings(coats('car_sedan_h'), (i) => sedanN(paint(i)), (i) => sedanS(paint(i))),
    hatch: facings(coats('car_hatch_h'), (i) => hatchN(paint(i)), (i) => hatchS(paint(i))),
    pickup: facings(coats('pickup_h'), (i) => pickupN(paint(i)), (i) => pickupS(paint(i))),
    police: facings(coats('police_h'), () => env.props.police_v, policeS),
    ambulance: facings(coats('ambulance_h'), () => ambulance(true), () => ambulance(false)),
    van: facings(coats('van_h'), van(true), van(false)),
  };
  const police = env.beacons.police_h!;
  const policeN = env.beacons.police_v!;
  const ambulanceW = env.beacons.ambulance_h!;
  const vehicleBeacons: Partial<Record<VehicleBody, Facings<Clip>>> = {
    police: { w: police, e: mirrorClip(police), n: policeN, s: policeSLights() },
    ambulance: { w: ambulanceW, e: mirrorClip(ambulanceW), n: ambulanceLights(true), s: ambulanceLights(false) },
  };
  return { vehicles, vehicleBeacons };
}

/** Every body and facing the art book must cover, for tests and the lineup. */
export const VEHICLE_SLOTS = VEHICLE_BODY_IDS.flatMap((body) => VEHICLE_FACINGS.map((facing) => ({ body, facing })));
