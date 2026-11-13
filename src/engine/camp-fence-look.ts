// Which sprite a camp fence section is drawn with: its own, rocking, or flat on the ground once it has given.

import type { PropKind } from '../../shared/protocol.ts';
import type { EnvironmentArt, PixelSprite } from '../art/types.ts';
import type { FenceState } from './overrun-look.ts';
import { clipFrame } from './sprite-cache.ts';

type FenceArt = Pick<EnvironmentArt, 'props' | 'overrun'>;

/** The sprite for a fence section in a state, or null for any prop that is not a breakable section, which keeps its own. */
export function fenceSprite(art: FenceArt, kind: PropKind, state: FenceState, time: number): PixelSprite | null {
  const across = kind === 'camp_fence_h';
  const along = kind === 'camp_fence_v';
  if (!across && !along) return null;
  if (state === 'down') return across ? art.props.camp_fence_down_h : art.props.camp_fence_down_v;
  if (state === 'rattling') return clipFrame(across ? art.overrun.fenceRattleH : art.overrun.fenceRattleV, time);
  return across ? art.props.camp_fence_h : art.props.camp_fence_v;
}
