import type { Container } from '../../shared/containers.ts';
import type { BulletEntity, DropView, EntityId, ExitEntity, GamePhase, PickupEntity, PlayerEntity, TrackEntity, ZombieEntity } from '../../shared/protocol.ts';
import type { MerchantId, OverrunView, StationId } from '../../shared/home-protocol.ts';

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

/** A "!" over a stall whose merchant has a quest on offer, or one finished and owed its pay. */
export interface QuestMark {
  readonly merchant: MerchantId;
  /** What the prompt calls them: "Sarge". */
  readonly name: string;
  /** The stall prop's bottom centre. */
  readonly x: number;
  readonly y: number;
  /** Owed pay, as against only on offer. */
  readonly ready: boolean;
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
  /** Footprints in the snow, drawn on the ground. Absent outside a snowy town. */
  readonly tracks?: readonly TrackEntity[];
  /** What the local player could search from where they stand, if anything. */
  readonly searchable: Container | null;
  /** Where the stairs underfoot lead, said in the prompt. Absent off the stairs. */
  readonly stairs?: string;
  /** The bunker station the local player could open from where they stand. Absent anywhere else. */
  readonly station?: StationId;
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
