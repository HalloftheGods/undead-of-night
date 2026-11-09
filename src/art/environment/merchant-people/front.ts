// Merchants are drawn on the survivor rig (survivors/rig.ts) so they share the cast's build,
// outline and lighting. Each one has a drawing from the front, which stands in for the side
// facings too, and one from behind, for walking away up the bunker.

import type { Facings, Part } from '../../survivors/rig.ts';

export function facingFront(front: Part, back: Part = front): Facings {
  return { 0: front, 1: front, 2: front, 6: back, 7: back };
}
