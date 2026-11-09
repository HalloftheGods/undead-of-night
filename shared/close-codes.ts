// One table of the codes a room closes a link with, used by every host and every client.
// A data channel has no close code, so the same pair also travels as a `bye` packet before the link goes.

export const CLOSE = {
  roomFull: 4000,
  serverBusy: 4001,
  noJoin: 4002,
  notFound: 4010,
  hostLeft: 4011,
  removed: 4012,
  locked: 4013,
  needsUpdate: 4014,
  rateLimited: 4015,
  hostAway: 4016,
  /** Reserved for the Durable Object option, if it is approved. */
  roomIdle: 4017,
  /** What `ws` sends itself for a frame over the cap, and what other links get from the room host. */
  tooBig: 1009,
} as const;

export type CloseCode = (typeof CLOSE)[keyof typeof CLOSE];

export const CLOSE_CODES: readonly CloseCode[] = Object.values(CLOSE);

/** The reasons that go with 4014, so the player is told which side is behind. */
export const UPDATE_REASON = {
  /** The one joining runs the older build. */
  guestOlder: 'guest older',
  /** The host runs the older build. */
  hostOlder: 'host older',
} as const;

export const NEEDS_UPDATE_TEXT = 'This game needs an update: reload';
export const FRIEND_NEEDS_UPDATE_TEXT = 'Your friend needs to update their game';
/** A guest built a different town from the host's seed: one of the two runs an older build. */
export const DIFFERENT_TOWN_TEXT = 'You and the host have different versions of the game: both reload';

const TEXT: Readonly<Record<Exclude<CloseCode, typeof CLOSE.needsUpdate>, string>> = {
  [CLOSE.roomFull]: 'That room is full.',
  [CLOSE.serverBusy]: 'That server is busy. Try again in a moment.',
  [CLOSE.noJoin]: 'The room did not hear from you in time. Try again.',
  [CLOSE.notFound]: 'That room is not open any more.',
  [CLOSE.hostLeft]: 'Your friend left, so the game ended.',
  [CLOSE.removed]: 'The host removed you from the room.',
  [CLOSE.locked]: 'That room is locked.',
  [CLOSE.rateLimited]: 'Too many tries. Wait a moment and try again.',
  [CLOSE.hostAway]: 'The host was away too long, so the game ended.',
  [CLOSE.roomIdle]: 'That room was idle for too long and has closed.',
  [CLOSE.tooBig]: 'The connection sent something too big and was closed.',
};

/** What to tell the player, or null for a code that is not in the table. Only 4014 reads the reason. */
export function closeText(code: number, reason = ''): string | null {
  const isUpdate = code === CLOSE.needsUpdate;
  if (isUpdate) return reason === UPDATE_REASON.hostOlder ? FRIEND_NEEDS_UPDATE_TEXT : NEEDS_UPDATE_TEXT;
  return TEXT[code as keyof typeof TEXT] ?? null;
}
