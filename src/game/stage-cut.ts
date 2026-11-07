// Where the stage last built the world, written the moment it builds it. The HUD only catches up on
// its next beat (100 ms), too late to hide the cut, so the van drive (VanTransition.vue) listens here.

import { shallowRef } from 'vue';

export interface StageCut {
  readonly inBunker: boolean;
  /** Counts builds, so building the same place twice still reads as news. */
  readonly seq: number;
}

export const stageCut = shallowRef<StageCut | null>(null);

/** When the drive's cover last came off, or null while it is on. */
let coverOffMs: number | null = Number.NEGATIVE_INFINITY;

export function noteVanCover(covering: boolean): void {
  coverOffMs = covering ? null : performance.now();
}

/** Whether what is under the drive has been in plain sight since this time, for this long. */
export function inSightSince(sinceMs: number, forMs: number): boolean {
  const coverOff = coverOffMs;
  const hasNoCover = coverOff === null;
  if (hasNoCover) return false;
  return performance.now() >= Math.max(sinceMs, coverOff) + forMs;
}

export function noteStageCut(inBunker: boolean): void {
  stageCut.value = { inBunker, seq: (stageCut.value?.seq ?? 0) + 1 };
}
