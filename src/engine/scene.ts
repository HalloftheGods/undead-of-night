import type { Container } from '../../shared/containers.ts';
import type { DoorChoice, PlacedDoor } from '../../shared/door-view.ts';
import type { LeftoverView } from '../../shared/leftovers.ts';
import type { BulletEntity, DropView, EntityId, ExitEntity, GamePhase, PickupEntity, PlayerEntity, TrackEntity, VehicleView, ZombieEntity } from '../../shared/protocol.ts';
import type { MerchantEntity, MerchantId, OverrunView, StationId } from '../../shared/home-protocol.ts';

export { CHEST_HEIGHT } from '../../shared/constants.ts';

/** What fingers leave on screen, all in buffer pixels. */
export interface TouchMarks {
  /** The crosshair, while a finger is on it or just off it. */
  readonly aim: { readonly x: number; readonly y: number } | null;
  readonly stick: {
    readonly baseX: number;
    readonly baseY: number;
    readonly knobX: number;
    readonly knobY: number;
    readonly reach: number;
  } | null;
  /** How far from the crosshair a fingertip stops covering the picture. */
  readonly fingertip: number;
}

/** A "!" over a merchant who has a quest on offer, or one finished and owed its pay. */
export interface QuestMark {
  readonly merchant: MerchantId;
  /** What the prompt calls them: "Sarge". */
  readonly name: string;
  /** The merchant's feet, where they stand now. */
  readonly x: number;
  readonly y: number;
  /** Owed pay, as against only on offer. */
  readonly ready: boolean;
}

/** What the search key would do at a car: get in or get out, and whether a boot there could be searched too. */
export interface VehicleHint {
  readonly kind: 'enter' | 'exit';
  readonly boot: boolean;
}

/** Everything the renderer draws this frame. Plain values; nothing here is reactive. */
export interface SceneView {
  readonly players: readonly PlayerEntity[];
  /** The Daily Night's ghost: the day's counted run, replayed. Drawn pale and apart; it touches nothing. */
  readonly ghost?: PlayerEntity | null;
  readonly zombies: readonly ZombieEntity[];
  readonly bullets: readonly BulletEntity[];
  readonly pickups: readonly PickupEntity[];
  /** The van out of town, once it has come. */
  readonly exit: ExitEntity | null;
  /** The town's supply drop, from its flare until it stops being marked. */
  readonly drop: DropView | null;
  /** Ids of the town's containers that have been opened. */
  readonly openedContainers: readonly number[];
  /** Buildings the team has been in that still hold supplies, for the map. Absent when there are none. */
  readonly leftovers?: readonly LeftoverView[];
  /** Footprints in the snow, drawn on the ground. Absent outside a snowy town. */
  readonly tracks?: readonly TrackEntity[];
  /** Every car that has been driven, where it is drawn this frame. Absent while all of them stand parked. */
  readonly vehicles?: readonly VehicleView[];
  /** What the search key would do at a car, for the local player. Absent when it does neither. */
  readonly vehicle?: VehicleHint;
  /** What the local player could search from where they stand, if anything. */
  readonly searchable: Container | null;
  /** The bunker's merchants, where they are walking. Absent anywhere else. */
  readonly merchants?: readonly MerchantEntity[];
  /** A manhole (topside) or sewer ladder (below) the local player is close enough to climb with the search key: which way it goes. */
  readonly climb?: { readonly down: boolean };
  /** The bunker station the local player could open from where they stand. Absent anywhere else. */
  readonly station?: StationId;
  /** Doors near the local player that are shut, boarded or broken in. Absent when every one stands open. */
  readonly doors?: readonly PlacedDoor[];
  /** What the search key would do at the door the local player stands at. */
  readonly door?: DoorChoice;
  /** Emergency radio tower the local player can trigger: canTrigger is true if in intermission with remaining hordes. */
  readonly radioTower?: { readonly canTrigger: boolean; readonly hold: number };
  /** The bunker's horde clock, which the door and the chest are drawn from. Absent when there is none. */
  readonly overrun?: OverrunView;
  /** The overrun is switched on for this build, so the blast door is drawn. Absent or false, the bunker looks as it did before it. */
  readonly overrunOn?: boolean;
  /** Stalls the overrun emptied, by this player's own save. Their merchants stand down until the stall reopens. */
  readonly closedStalls?: readonly MerchantId[];
  /** Stalls whose merchant has work to offer or pay, by this player's own save. */
  readonly questMarks?: readonly QuestMark[];
  /** The player at this keyboard, if they exist yet. */
  readonly localId: EntityId | null;
  /** Whose eyes the camera is behind: localId, or a teammate when spectating. */
  readonly viewerId: EntityId | null;
  readonly focusX: number;
  readonly focusY: number;
  /** Buffer pixels, or null when the pointer is not steering the camera. */
  readonly pointerX: number | null;
  readonly pointerY: number | null;
  readonly showCrosshair: boolean;
  /** Set while fingers are playing, when the crosshair follows them and the pointer steers nothing. */
  readonly touch?: TouchMarks | null;
  readonly phase: GamePhase;
  readonly hostiles: number;
}

export const EMPTY_SCENE: SceneView = {
  players: [],
  zombies: [],
  bullets: [],
  pickups: [],
  exit: null,
  drop: null,
  openedContainers: [],
  searchable: null,
  localId: null,
  viewerId: null,
  focusX: 0,
  focusY: 0,
  pointerX: null,
  pointerY: null,
  showCrosshair: false,
  phase: 'intermission',
  hostiles: 0,
};
