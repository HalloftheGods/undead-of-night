import type { PaletteId, UiScale } from './display-prefs.ts';
import { KEEPSAKES } from '../../shared/keepsakes.ts';
import type { KeepsakeId } from '../../shared/protocol.ts';
import { CANDIES } from '../../shared/candy.ts';
import { BOSSES } from '../../shared/bosses.ts';
import type { CalloutTone } from './kill-juice.ts';
import { displayName } from '../../shared/callsign.ts';
import { characterOf } from '../../shared/characters.ts';
import type { GameStyle } from '../../shared/game-style.ts';
import type { PlayerGear } from '../../shared/gun-upgrades.ts';
import { BUNKER_LEVEL } from '../../shared/home-protocol.ts';
import { WEAPON_ORDER } from '../../shared/protocol.ts';
import type {
  EntityId,
  GameOverStats,
  GamePhase,
  PlayerEntity,
  PlayerStatus,
  SnapshotPacket,
  WeaponId,
} from '../../shared/protocol.ts';
import type { ArtBook } from '../art/types.ts';
import type { TransportKind } from '../network/transport.ts';
import { benchHud } from './bench-view.ts';
import type { BenchHud } from './bench-view.ts';
import type { LogEntry } from './event-log.ts';
import type { HomeUi } from './home-hud.ts';
import type { BestRun, LeaderboardEntry } from './storage.ts';

export type Screen = 'title' | 'game' | 'gameover' | 'lost';

/** At or under this many rounds across every gun, the HUD starts to warn. */
const LOW_AMMO_ROUNDS = 10;

/** The co-op setup page's address box. */
export const SERVER_FIELD_ID = 'server';

export interface TeammateHud {
  readonly id: EntityId;
  readonly name: string;
  /** Which survivor they are playing. */
  readonly character: string;
  readonly health: number;
  readonly maxHealth: number;
  readonly status: PlayerStatus;
}

export interface KeepsakeCard {
  readonly id: KeepsakeId;
  readonly name: string;
  readonly blurb: string;
}

export interface HudState {
  readonly health: number;
  readonly maxHealth: number;
  readonly status: PlayerStatus;
  readonly weapon: WeaponId;
  readonly owned: readonly WeaponId[];
  readonly ammo: number;
  readonly magSize: number;
  readonly reserve: number;
  readonly ammoBag: Readonly<Record<WeaponId, number>>;
  readonly mags: Readonly<Record<WeaponId, number>>;
  readonly medkits: number;
  /** Empty bottles to throw. */
  readonly bottles: number;
  /** Fuel for molotovs (each also takes a bottle), and flares. */
  readonly fuel: number;
  readonly flares: number;
  /** Candy carried, by name, oldest first: the next eaten is the first not already working. */
  readonly candy: readonly string[];
  /** Candy working now, with whole seconds left. */
  readonly sugar: readonly { readonly name: string; readonly left: number }[];
  /** Keepsakes kept this run, by name. */
  readonly keepsakes: readonly string[];
  /** The three to choose one from, while the choice is open. */
  readonly keepsakeOffer: readonly KeepsakeCard[] | null;
  readonly knife: boolean;
  readonly reload: number;
  readonly score: number;
  readonly kills: number;
  readonly bleedout: number;
  readonly revive: number;
  readonly phase: GamePhase;
  readonly level: number;
  /** The van has come for this town. */
  readonly exitOpen: boolean;
  readonly wave: number;
  readonly intermission: number;
  readonly hostiles: number;
  readonly teammates: readonly TeammateHud[];
  /** Who the camera is on, when that is not you. */
  readonly spectating: string | null;
  readonly gear: PlayerGear | null;
  /** Set while the run is held at the workbench. */
  readonly bench: BenchHud | null;
  /** The town's boss while it stands: its name and the share of health it has left. */
  readonly boss: { readonly name: string; readonly share: number } | null;
}

export interface Banner {
  /** Changes with every banner, so the component replays its entrance. */
  readonly key: number;
  readonly title: string;
  readonly subtitle: string;
  /** 'quiet' is for a horde moving on: nothing here is ever safe, so it gets no green. 'hope' is the van. */
  readonly tone: 'danger' | 'quiet' | 'hope';
}

/** A word or two over the action for a kill worth noticing: a chain, a close call, a horde wiped out. */
export interface Callout {
  /** Changes with every callout, so the component replays its entrance. */
  readonly key: number;
  readonly text: string;
  readonly tone: CalloutTone;
}

/** Names a level as it starts. */
export interface LevelCard {
  readonly key: number;
  readonly heading: string;
  readonly title: string;
  readonly goal: string;
  /** What this town's weather does to play, for towns where it does something. */
  readonly rule?: string;
  /** A night event, for towns that drew one (`shared/night-events.ts`). */
  readonly event?: string;
  /** A boss night's warning (`shared/bosses.ts`). */
  readonly boss?: string;
}

/** A small label for the place the player just walked into. */
export interface PlaceBanner {
  readonly key: number;
  readonly label: string;
}

export interface RunResult {
  readonly stats: GameOverStats;
  readonly localId: EntityId;
  readonly score: number;
  readonly kills: number;
  readonly isNewBest: boolean;
  /** Set for a Daily Night: which day, and whether this was the run that counts or practice. */
  /** A Daily Night run: its day, whether it counted, and the day's counted run in words to share. */
  readonly daily?: { readonly label: string; readonly counted: boolean; readonly share: string | null };
}

/** Small, plain and replaced whole; the only game state Vue ever sees. */
export interface UiState {
  /** Fingers are how this device plays, so the touch buttons show. */
  touch: boolean;
  readonly screen: Screen;
  readonly art: ArtBook | null;
  readonly mode: TransportKind;
  readonly connecting: boolean;
  readonly error: string | null;
  readonly paused: boolean;
  readonly mapOpen: boolean;
  readonly hud: HudState | null;
  readonly banner: Banner | null;
  readonly callout: Callout | null;
  readonly place: PlaceBanner | null;
  readonly levelCard: LevelCard | null;
  /** Everything the screen said this run, oldest first (`event-log.ts`). */
  readonly log: readonly LogEntry[];
  /** The full log is open over the run. */
  readonly logOpen: boolean;
  /** The bunker and the trip, on a Campaign run. */
  readonly home: HomeUi | null;
  /** The style the player last chose: what the Play page offers, and what an empty room is given. */
  readonly style: GameStyle;
  /** The style of the run under way, and null off a run. In co-op it is the room's, which can differ from `style`. */
  readonly runStyle: GameStyle | null;
  readonly result: RunResult | null;
  readonly restarting: boolean;
  readonly lostReason: string;
  readonly signalWeak: boolean;
  /** Arcade's best run. */
  readonly best: BestRun | null;
  /** Campaign's best single trip, which a whole run is never compared to. */
  readonly bestTrip: BestRun | null;
  readonly leaderboard: readonly LeaderboardEntry[];
  readonly callsign: string;
  readonly serverAddress: string;
  /** The code of the online room this tab is hosting, for the host to share; null otherwise. */
  readonly onlineRoom: string | null;
  readonly volume: number;
  /** Music and sound effects, each a share of volume. */
  readonly musicVolume: number;
  readonly sfxVolume: number;
  readonly muted: boolean;
  readonly palette: PaletteId;
  readonly uiScale: UiScale;
}

export function buildHud(snapshot: SnapshotPacket, local: PlayerEntity, spectating: string | null): HudState {
  return {
    health: local.health,
    maxHealth: local.maxHealth,
    status: local.status,
    weapon: local.weapon,
    owned: local.owned,
    ammo: local.ammo,
    magSize: local.magSize,
    reserve: local.reserve,
    ammoBag: local.ammoBag,
    mags: local.mags,
    medkits: local.medkits,
    bottles: local.bottles ?? 0,
    fuel: local.fuel ?? 0,
    flares: local.flares ?? 0,
    candy: (local.candy ?? []).map((id) => CANDIES[id].name),
    sugar: (local.sugar ?? []).map((sugar) => ({ name: CANDIES[sugar.id].name, left: Math.ceil(sugar.left) })),
    keepsakes: (local.keepsakes ?? []).map((id) => KEEPSAKES[id].name),
    keepsakeOffer: local.keepsakeOffer ? local.keepsakeOffer.map((id) => ({ id, name: KEEPSAKES[id].name, blurb: KEEPSAKES[id].blurb })) : null,
    knife: local.knife,
    reload: local.reload,
    score: local.score,
    kills: local.kills,
    bleedout: local.bleedout,
    revive: local.revive,
    phase: snapshot.phase,
    level: snapshot.level,
    exitOpen: snapshot.exit !== null,
    wave: snapshot.wave,
    intermission: snapshot.intermission,
    hostiles: snapshot.hostiles,
    teammates: snapshot.players
      .filter((player) => player.id !== local.id)
      .map(({ id, name, skin, health, maxHealth, status }) => ({ id, name: displayName(name, skin), character: characterOf(skin).name, health, maxHealth, status })),
    spectating,
    gear: local.gear ?? null,
    bench: benchHud(snapshot, local),
    boss: snapshot.boss ? { name: BOSSES[snapshot.boss.id].name, share: snapshot.boss.health / Math.max(1, snapshot.boss.maxHealth) } : null,
  };
}

export type AmmoState = 'ok' | 'low' | 'empty';

type Loadout = Pick<HudState, 'owned' | 'ammoBag' | 'mags'>;

/** All a gun can still fire: what is loaded plus what is spare. */
export function gunRounds(hud: Pick<HudState, 'ammoBag' | 'mags'>, weapon: WeaponId): number {
  return hud.mags[weapon] + hud.ammoBag[weapon];
}

/** 'empty' means nothing left in any gun, not just a magazine to refill or a gun to swap. */
export function ammoState(hud: Loadout): AmmoState {
  const rounds = hud.owned.reduce((sum, weapon) => sum + gunRounds(hud, weapon), 0);
  const allDry = rounds === 0;
  if (allDry) return 'empty';
  return rounds <= LOW_AMMO_ROUNDS ? 'low' : 'ok';
}

/** The number key of a gun with rounds, when the one in hand has none, or null. */
export function switchKey(hud: Loadout & Pick<HudState, 'weapon'>): number | null {
  const inHandFires = gunRounds(hud, hud.weapon) > 0;
  if (inHandFires) return null;
  const loaded = WEAPON_ORDER.findIndex((weapon) => hud.owned.includes(weapon) && gunRounds(hud, weapon) > 0);
  return loaded < 0 ? null : loaded + 1;
}

export interface HordeStatus {
  readonly title: string;
  readonly detail: string;
  /** A horde is on the street, as opposed to the quiet between them. */
  readonly loud: boolean;
}

export function hordeStatus(hud: Pick<HudState, 'phase' | 'wave' | 'intermission' | 'hostiles'> & Partial<Pick<HudState, 'level'>>): HordeStatus {
  const home = hud.level === BUNKER_LEVEL;
  if (home) return { title: 'Bunker', detail: '', loud: false };
  const runOver = hud.phase === 'gameover';
  if (runOver) return { title: 'Game over', detail: '', loud: true };
  const hunted = hud.phase === 'wave';
  if (hunted) {
    return { title: `Horde ${hud.wave}`, detail: `${hud.hostiles} hostile${hud.hostiles === 1 ? '' : 's'} left`, loud: true };
  }
  return { title: `Horde in ${formatDuration(Math.ceil(hud.intermission))}`, detail: '', loud: false };
}

export function formatDuration(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(whole / 60);
  return `${minutes}:${String(whole % 60).padStart(2, '0')}`;
}
