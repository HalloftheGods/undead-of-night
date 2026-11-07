import { openedContainers } from './container-search.ts';
import { SNAPSHOT_RANGE } from './constants.ts';
import { exitEntity } from './level-exit.ts';
import { gearField } from './gun-upgrades.ts';
import { overrunView } from './overrun.ts';
import { WEAPON_ORDER } from './protocol.ts';
import { liveBoss } from './bosses.ts';
import type { BossView, DropView, ExitEntity, GameEvent, PlayerEntity, SnapshotPacket, WeaponId } from './protocol.ts';
import type { PlayerState, SimState } from './sim-state.ts';
import { hordeHostiles } from './waves.ts';
import { statusView } from './zombie-status.ts';
import { benchField } from './workbench.ts';

const ROUNDED_EVENT_FIELDS = ['x', 'y', 'angle', 'radius'] as const;

/** The + 0 folds -0 into 0, which JSON would otherwise change under a reader's feet. */
export const round2 = (value: number): number => Math.round(value * 100) / 100 + 0;

function roundEvent(event: GameEvent): GameEvent {
  const copy: Record<string, unknown> = { ...event };
  for (const field of ROUNDED_EVENT_FIELDS) {
    const value = copy[field];
    const eventHasField = typeof value === 'number';
    if (eventHasField) copy[field] = round2(value);
  }
  return copy as unknown as GameEvent;
}

/** The drop once its flare is up: before that nobody knows where it will come down. */
const bossField = (sim: SimState): { boss?: BossView } => {
  const z = liveBoss(sim);
  return z?.boss ? { boss: { id: z.boss, health: round2(z.health), maxHealth: z.maxHealth } } : {};
};

const dropField = (sim: SimState): { drop?: DropView } =>
  sim.drop && sim.drop.phase !== 'waiting' ? { drop: { x: round2(sim.drop.x), y: round2(sim.drop.y), landed: sim.drop.phase === 'landed' } } : {};

const exitView = (exit: ExitEntity | null): ExitEntity | null => exit && { ...exit, progress: round2(exit.progress) };

/** Snow prints near someone, whole pixels and tenths: they are drawn, not simulated, on the client. */
function tracksField(sim: SimState, inRange: (item: { x: number; y: number }) => boolean): Pick<SnapshotPacket, 'tracks'> {
  const shown = sim.tracks.filter(inRange);
  const hasNoTracks = shown.length === 0;
  if (hasNoTracks) return {};
  const tenth = (value: number): number => Math.round(value * 10) / 10 + 0;
  return {
    tracks: shown.map((print) => ({ x: Math.round(print.x), y: Math.round(print.y), angle: tenth(print.angle ?? 0), left: tenth(print.left) })),
  };
}

/** Left off outside home mode, so a snapshot there is what it always was. */
function playerHomeField(p: PlayerState): Pick<PlayerEntity, 'home'> {
  const { home } = p;
  if (!home) return {};
  const { silver, jewels, station, stationHold, ready, receipt, overrun, chest } = home;
  const view = { silver, jewels: { ...jewels }, station, stationHold: round2(stationHold), ready, receipt, overrun };
  return { home: chest ? { ...view, chest } : view };
}

/** The overrun is left off while there is none, so a room without one sends what it always did. */
function roomHomeField(sim: SimState): Pick<SnapshotPacket, 'home'> {
  const run = sim.homeRun;
  if (!run) return {};
  const overrun = overrunView(sim);
  const room = { pickedLevel: run.pickedLevel, roomHighest: run.roomHighest };
  return { home: overrun ? { ...room, overrun } : room };
}

function magazines(p: PlayerState): Record<WeaponId, number> {
  const entries = WEAPON_ORDER.map((weapon) => [weapon, p.guns[weapon]?.ammo ?? 0]);
  return Object.fromEntries(entries) as Record<WeaponId, number>;
}

/** Left off while the bar is full, which is nearly always. */
function staminaField(p: PlayerState): Pick<PlayerEntity, 'stamina' | 'winded'> {
  const tired = p.stamina < 1;
  if (!tired) return {};
  return { stamina: round2(p.stamina), ...(p.winded ? { winded: true } : {}) };
}

export function playerSnapshot(p: PlayerState): PlayerEntity {
  return {
    id: p.id,
    name: p.name,
    skin: p.skin,
    x: round2(p.x),
    y: round2(p.y),
    angle: round2(p.angle),
    moving: p.moving,
    status: p.status,
    health: round2(p.health),
    maxHealth: p.maxHealth,
    weapon: p.weapon,
    ammo: p.ammo,
    magSize: p.magSize,
    reserve: p.reserve,
    owned: [...p.owned],
    ammoBag: { ...p.ammoBag },
    mags: magazines(p),
    medkits: p.medkits,
    knife: p.knife,
    ...(p.bottles > 0 ? { bottles: p.bottles } : {}),
    ...(p.fuel > 0 ? { fuel: p.fuel } : {}),
    ...(p.flares > 0 ? { flares: p.flares } : {}),
    ...(p.candy.length > 0 ? { candy: [...p.candy] } : {}),
    ...(p.keepsakes.length > 0 ? { keepsakes: [...p.keepsakes] } : {}),
    ...(p.keepsakeOffer ? { keepsakeOffer: [...p.keepsakeOffer] } : {}),
    ...(p.sugar.length > 0 ? { sugar: p.sugar.map((sugar) => ({ id: sugar.id, left: round2(sugar.left) })) } : {}),
    ...staminaField(p),
    search: round2(p.search),
    indoors: p.indoors,
    reload: round2(p.reload),
    bleedout: round2(p.bleedout),
    revive: round2(p.revive),
    score: p.score,
    kills: p.kills,
    lastInputSeq: p.lastInputSeq,
    ...gearField(p),
    ...playerHomeField(p),
  };
}

/** A detached, JSON-safe view of the world. Drains the event queue. */
export function buildSnapshot(sim: SimState): SnapshotPacket {
  const events = sim.events.map(roundEvent);
  sim.events = [];
  const inRange = (item: { x: number; y: number }): boolean =>
    sim.players.some((p) => Math.hypot(p.x - item.x, p.y - item.y) <= SNAPSHOT_RANGE);
  return {
    type: 'snapshot',
    tick: sim.tick,
    phase: sim.phase,
    level: sim.level,
    mapSeed: sim.map.seed,
    wave: sim.wave,
    intermission: sim.phase === 'intermission' ? round2(Math.max(0, sim.intermissionLeft)) : 0,
    hostiles: hordeHostiles(sim),
    players: sim.players.map(playerSnapshot),
    zombies: sim.zombies.filter(inRange).map((z) => ({
      id: z.id,
      type: z.type,
      x: round2(z.x),
      y: round2(z.y),
      angle: round2(z.angle),
      health: round2(z.health),
      maxHealth: z.maxHealth,
      attacking: z.attacking,
      ...statusView(z),
      ...(z.trail && !z.trail.searching ? { tracking: true } : {}),
      ...(z.boss ? { boss: z.boss } : {}),
    })),
    bullets: sim.bullets.map((b) => ({
      id: b.id,
      shooterId: b.shooterId,
      x: round2(b.x),
      y: round2(b.y),
      vx: round2(b.vx),
      vy: round2(b.vy),
      ...(b.effect ? { effect: b.effect } : {}),
    })),
    pickups: sim.pickups.filter(inRange).map((item) => ({ id: item.id, type: item.type, x: round2(item.x), y: round2(item.y) })),
    exit: exitView(exitEntity(sim)),
    openedContainers: openedContainers(sim),
    ...dropField(sim),
    ...bossField(sim),
    ...tracksField(sim, inRange),
    events,
    gameOver: sim.gameOver ? { ...sim.gameOver, players: sim.gameOver.players.map((p) => ({ ...p })) } : null,
    ...benchField(sim),
    ...roomHomeField(sim),
  };
}
