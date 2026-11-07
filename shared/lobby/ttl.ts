// How long a room lives in the Lobby. Times are ms; callers pass the clock in so the rules stay testable.

/** A listing unseen this long is hidden from matching and lists. */
export const HIDE_AFTER_MS = 90_000;
/** A listing unseen this long is deleted by the sweep. */
export const SWEEP_AFTER_MS = 180_000;
/** A host whose signal socket dropped may reconnect with its hostKey for this long. */
export const HOST_RECONNECT_GRACE_MS = 2 * 60_000;
/** An ended room's code is refused (410) for this long, so an old invite never opens a stranger's room. */
export const TOMBSTONE_MS = 15 * 60_000;
/** Every room ends after this, however busy. */
export const ROOM_MAX_AGE_MS = 12 * 60 * 60_000;

export type ListingFate = 'live' | 'hidden' | 'sweep';

/** What the Lobby does with a listing last seen at seenAt. */
export function listingFate(seenAt: number, now: number): ListingFate {
  const unseen = now - seenAt;
  const isDueForSweep = unseen >= SWEEP_AFTER_MS;
  if (isDueForSweep) return 'sweep';
  return unseen >= HIDE_AFTER_MS ? 'hidden' : 'live';
}

export const isStale = (seenAt: number, now: number): boolean => listingFate(seenAt, now) !== 'live';

/** True once a host that dropped at droppedAt has used up its grace and the room ends. */
export const hostGraceExpired = (droppedAt: number, now: number): boolean => now - droppedAt >= HOST_RECONNECT_GRACE_MS;

/** True while an ended room's code is still refused. */
export const isTombstoned = (endedAt: number, now: number): boolean => now - endedAt < TOMBSTONE_MS;

/** True once a room created at createdAt has hit the hard cap. */
export const roomTooOld = (createdAt: number, now: number): boolean => now - createdAt >= ROOM_MAX_AGE_MS;
