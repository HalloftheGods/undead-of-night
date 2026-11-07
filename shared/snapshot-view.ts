import { VIEWER_RANGE } from './constants.ts';
import type { EntityId, PlayerEntity, SnapshotPacket } from './protocol.ts';

/** What came home, what an overrun gave or took, and a chest still to open are nobody else's business: everyone but the viewer reads as having none. */
function withOwnReceipt(players: readonly PlayerEntity[], viewerId: EntityId): PlayerEntity[] {
  return players.map((p) => {
    const hidden = p.id !== viewerId && (p.home?.receipt || p.home?.overrun || p.home?.chest);
    if (!hidden) return p;
    const { chest: _theirs, ...home } = p.home!;
    return { ...p, home: { ...home, receipt: null, overrun: null } };
  });
}

/**
 * One client's cut of a frame: zombies, pickups and snow prints around them, everyone in the room, and
 * every event. A dead player's camera sits on a teammate, so they get what the whole room can see.
 */
export function viewFor(frame: SnapshotPacket, viewerId: EntityId): SnapshotPacket {
  const viewer = frame.players.find((p) => p.id === viewerId);
  const watchingOthers = !viewer || viewer.status === 'dead';
  const eyes: readonly PlayerEntity[] = watchingOthers ? frame.players : [viewer];
  const inView = (item: { x: number; y: number }): boolean =>
    eyes.some((p) => Math.hypot(p.x - item.x, p.y - item.y) <= VIEWER_RANGE);
  const view: SnapshotPacket = { ...frame, players: withOwnReceipt(frame.players, viewerId), zombies: frame.zombies.filter(inView), pickups: frame.pickups.filter(inView) };
  if (!frame.tracks) return view;
  const tracks = frame.tracks.filter(inView);
  const hasTracksInView = tracks.length > 0;
  if (hasTracksInView) return { ...view, tracks };
  const { tracks: _none, ...withoutTracks } = view;
  return withoutTracks;
}
