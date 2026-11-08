// A public room shows no callsigns. The host's room already drops them on the way in; a guest drops
// any that still arrive, because the host is just another browser and could send anything.
import type { GameEvent, GameOverStats, SnapshotPacket } from '../../shared/protocol.ts';

const nameless = (stats: GameOverStats): GameOverStats => ({ ...stats, players: stats.players.map((each) => ({ ...each, name: '' })) });

const namelessEvent = (event: GameEvent): GameEvent => (event.type === 'game_over' ? { ...event, stats: nameless(event.stats) } : event);

/** The same snapshot with every player name blanked, so each one is drawn by survivor name. */
export function withoutNames(packet: SnapshotPacket): SnapshotPacket {
  return {
    ...packet,
    players: packet.players.map((each) => ({ ...each, name: '' })),
    events: packet.events.map(namelessEvent),
    gameOver: packet.gameOver ? nameless(packet.gameOver) : null,
  };
}
