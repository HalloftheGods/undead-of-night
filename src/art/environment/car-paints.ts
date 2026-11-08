// The colours a town's cars come in. A car's paint is a three-step ramp, dark to light, and none
// of them is the glass blue, so a searched car can still find its windows by colour.

import { RAMPS } from '../palette.ts';
import type { Ramp } from '../palette.ts';
import { RUST, STEEL } from './vehicles.ts';

const { ink, ash, blood, bone, teal, olive, violet, wood, fire, rot } = RAMPS;

export const WHITE: Ramp = [bone[1], bone[2], bone[3]];
export const BLACK: Ramp = [ink[1], ash[0], ash[1]];

/** Every paint a car can be found in. The first is each body's look in the Town Guide. */
export const CAR_PAINTS: readonly Ramp[] = [
  STEEL,
  RUST,
  [blood[0], blood[1], blood[2]],
  WHITE,
  [bone[0], bone[1], bone[2]],
  [teal[0], teal[1], teal[2]],
  [olive[0], olive[1], olive[2]],
  [violet[0], violet[1], violet[2]],
  [wood[1], wood[2], wood[3]],
  [fire[0], fire[1], fire[2]],
  BLACK,
  [rot[0], rot[1], rot[2]],
];

/** Lots are mostly rust and steel, so the nose-up sedan keeps rust first, as it always looked. */
export const LOT_PAINTS: readonly Ramp[] = [CAR_PAINTS[1], CAR_PAINTS[0], ...CAR_PAINTS.slice(2)];
