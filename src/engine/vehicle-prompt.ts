// The words over a survivor who can get into a car or out of one.

import type { VehicleHint } from './scene.ts';

/** What the search key does at a car: DRIVE (with a hold to search its boot when it has one) or EXIT. Touch has no key to name. */
export function vehiclePrompt(hint: VehicleHint, touch: boolean): string {
  const keyed = touch ? '' : 'E: ';
  if (hint.kind === 'exit') return `${keyed}EXIT`;
  const boot = hint.boot ? ' / HOLD: SEARCH' : '';
  return `${keyed}DRIVE${boot}`;
}
