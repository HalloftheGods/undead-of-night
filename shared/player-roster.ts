import { PLAYER_MAX_HEALTH } from './constants.ts';
import { freshEmoteBudget } from './emotes.ts';
import { noParts } from './gun-upgrades.ts';
import { giveStartingLoadout } from './player-health.ts';
import { noKits } from './round-effects.ts';
import type { PlayerState, SimState } from './sim-state.ts';
import { moveBurnCredit } from './zombie-status.ts';

/** Records kept per run, so a client churning through tokens cannot grow the list for ever. */
const DEPARTED_LIMIT = 32;

/** Everything about a connection that does not outlive it. */
const FRESH_CONNECTION = {
  moving: false,
  reload: 0,
  revive: 0,
  lastInputSeq: 0,
  up: false,
  down: false,
  left: false,
  right: false,
  shoot: false,
  aim: null,
  touchAim: false,
  queuedSeq: 0,
  reloadQueued: false,
  weaponQueued: null,
  meleeQueued: false,
  healQueued: false,
  shootQueued: false,
  fireCooldown: 0,
  dryFireCooldown: 0,
  meleeCooldown: 0,
  reloadLeft: 0,
  search: 0,
  searchHeld: false,
  searchSpent: false,
  searchingId: null,
  searchLeft: 0,
  searchHealth: 0,
  stance: 'walk',
  stanceWanted: 'walk',
  stamina: 1,
  winded: false,
  staminaRest: 0,
  stepNoiseLeft: 0,
  throwQueued: false,
  molotovQueued: false,
  flareQueued: false,
  throwCooldown: 0,
} as const;

export interface Arrival {
  readonly id: string;
  readonly name: string;
  readonly token: string | null;
  readonly skin: number;
}

export function createPlayer(arrival: Arrival, spot: { x: number; y: number }): PlayerState {
  const player: PlayerState = {
    ...arrival,
    ...FRESH_CONNECTION,
    x: spot.x,
    y: spot.y,
    angle: 0,
    status: 'alive',
    health: PLAYER_MAX_HEALTH,
    maxHealth: PLAYER_MAX_HEALTH,
    weapon: 'pistol',
    ammo: 0,
    magSize: 0,
    reserve: 0,
    owned: [],
    ammoBag: { pistol: 0, carbine: 0, shotgun: 0 },
    medkits: 0,
    knife: false,
    bottles: 0,
    fuel: 0,
    flares: 0,
    candy: [],
    sugar: [],
    eatQueued: false,
    keepsakes: [],
    keepsakeOffer: null,
    keepsakeQueued: null,
    indoors: null,
    bleedout: 0,
    score: 0,
    kills: 0,
    guns: {},
    parts: noParts(),
    kits: noKits(),
    benchReady: false,
    ...freshEmoteBudget(),
    home: null,
  };
  giveStartingLoadout(player);
  return player;
}

/** Keeps a leaver's run, position included, so a refresh is neither a respawn nor a teleport. */
export function rememberDeparted(sim: SimState, p: PlayerState): void {
  const hasNoToken = p.token === null;
  if (hasNoToken) return;
  sim.departed.delete(p.token);
  sim.departed.set(p.token, p);
  const [oldest] = sim.departed.keys();
  const overLimit = sim.departed.size > DEPARTED_LIMIT;
  if (overLimit) sim.departed.delete(oldest);
}

/** The results screen and a body still on fire find a player by id, and a new connection has a new one. */
function renameInResults(sim: SimState, from: string, to: string): void {
  moveBurnCredit(sim, from, to);
  if (!sim.gameOver) return;
  const players = sim.gameOver.players.map((p) => (p.id === from ? { ...p, id: to } : p));
  sim.gameOver = { ...sim.gameOver, players };
}

/** A token still in the room moves to its new connection: a link dropped too recently for the server to notice. */
export function reclaimLive(sim: SimState, arrival: Arrival): PlayerState | null {
  const at = sim.players.findIndex((p) => p.token !== null && p.token === arrival.token);
  const nobodyHere = at < 0;
  if (nobodyHere) return null;
  const body = sim.players[at];
  renameInResults(sim, body.id, arrival.id);
  sim.players[at] = { ...body, ...arrival, ...FRESH_CONNECTION, skin: body.skin };
  return sim.players[at];
}

/** The run a known token left behind, on its new connection, or null for a token new to this run. */
export function reclaimDeparted(sim: SimState, arrival: Arrival): PlayerState | null {
  const hasNoToken = arrival.token === null;
  if (hasNoToken) return null;
  const left = sim.departed.get(arrival.token);
  if (!left) return null;
  sim.departed.delete(arrival.token);
  renameInResults(sim, left.id, arrival.id);
  const skinTaken = sim.players.some((p) => p.skin === left.skin);
  return { ...left, ...arrival, ...FRESH_CONNECTION, skin: skinTaken ? arrival.skin : left.skin };
}
