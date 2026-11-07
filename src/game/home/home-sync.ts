// Watches snapshots and turns what happens to this player into saves. Every write to the store is made here.

import { EXIT_RADIUS, TICK_RATE } from '../../../shared/constants.ts';
import { BASELINE_DIFFICULTY } from '../../../shared/difficulty.ts';
import type { DifficultyId } from '../../../shared/difficulty.ts';
import { isBunkerSeed } from '../../../shared/home-protocol.ts';
import type { HomeAction, HomeView, JoinHome, Loadout, MerchantId, OverrunReceipt, OverrunView, StationId, TripReceipt } from '../../../shared/home-protocol.ts';
import { emptyLoadout, loadoutOfEntity, validateLoadout } from '../../../shared/loadout.ts';
import type { PlayerEntity, SnapshotPacket, WelcomePacket } from '../../../shared/protocol.ts';
import type { TransportKind } from '../../network/transport.ts';
import type { LevelProgress } from '../level-progress.ts';
import { SMELT_SECONDS } from './forge.ts';
import { armedHands, settleHands } from './gear-pool.ts';
import type { HomeSave, HomeStore, SaveResult } from './home-store.ts';
import { applyOverrunReceipt, clearOpenOverrun, diedUnseen, openOverrunOf, overrunKey, resolveOpenOverrun, watchBreach } from './overrun-ledger.ts';
import type { BreachWatch } from './overrun-ledger.ts';
import { emptyTally } from './quest-tally.ts';
import type { TripTally } from './quest-tally.ts';
import { abandon } from './quests.ts';
import type { QuestContext } from './quests.ts';
import { acceptAt, applyReceiptWithQuests, resolveOpenTripWithQuests, smeltWithQuests, turnInAt, visited } from './quest-sync.ts';
import type { QuestResult } from './quest-sync.ts';
import { SaveQueue } from './save-queue.ts';
import type { SaveChange } from './save-queue.ts';
import { buy, rollStock } from './shop.ts';
import type { ShopContext } from './shop.ts';
import { receiptKey } from './trip-ledger.ts';

/** How long a co-op trip found open waits for the server to say whether the body is still there. */
export const OPEN_TRIP_WAIT_MS = 10_000;
/** A failed save is tried again this long after, rather than on every frame. */
const RETRY_TICKS = TICK_RATE * 2;
/** An equip unanswered this long was refused, so a later change in hand is not its answer. Not a window for the answer to fit in: the answer is matched to the request. */
const EQUIP_EXPIRES_TICKS = TICK_RATE * 30;
/** The most forge time one frame can count, so a stalled tab is not paid for the stall. */
const MAX_FRAME_SECONDS = 1;
const TRIP_ALREADY_OPEN = 'A trip is already open in another tab.';

type VanState = 'away' | 'boarding' | 'ready' | 'refused';
export type SaleResult = 'bought' | 'refused' | 'conflict' | 'failed';

export interface HomeSyncOptions {
  readonly store: HomeStore;
  readonly mode: TransportKind;
  readonly sendHome: (action: HomeAction) => void;
  /** The save, the error or the forge moved. */
  readonly onChange?: () => void;
  /** A receipt was credited here, once. */
  readonly onReceipt?: (receipt: TripReceipt) => void;
  /** An overrun receipt was credited here, once. */
  readonly onOverrunReceipt?: (receipt: OverrunReceipt) => void;
  /** What the local player did this trip, as last counted. Left off for none. */
  readonly tally?: () => TripTally;
  /** The player's own highest level, which the jobs rolled for a banked trip are gated by. Left off for none. */
  readonly highest?: () => number;
}

/** A trip or a breach still on file has the gear in hand at stake: the room's body has it, or nobody does. */
const handsAtStake = (save: HomeSave): boolean => save.openTrip !== null || save.openOverrun !== null;

/** What to bring to the room. With a trip or a breach still open the gear is forfeit, and a body the room still holds keeps what it has. */
export function joinHomeFor(save: HomeSave, { highest, finished }: LevelProgress): JoinHome {
  return { loadout: handsAtStake(save) ? emptyLoadout() : save.hands, highest, ...(finished ? { finished } : {}) };
}

const firstStock: SaveChange = (save) => (save.shop.rolls === 0 ? rollStock(save) : save);

/** What was asked of the room. `text` is the loadout sent, or null for a join, where whatever the room holds is the answer. */
interface HandsRequest {
  readonly text: string | null;
  readonly expires: number;
}

const sortedKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortedKeys);
  const isNotObject = typeof value !== 'object' || value === null;
  if (isNotObject) return value;
  const entries = Object.entries(value).sort(([a], [b]) => (a < b ? -1 : 1));
  return Object.fromEntries(entries.map(([key, inner]) => [key, sortedKeys(inner)]));
};

/** The same gear reads the same whatever order its keys were built in. */
const textOf = (loadout: Loadout): string => JSON.stringify(sortedKeys(loadout));

/** Hands the room would refuse go back in the locker before connecting, so the join brings nothing and no frame order can lose them. A trip or a breach still open keeps its forfeit. */
const putBackRefused: SaveChange = (save) => {
  const refused = !handsAtStake(save) && validateLoadout(save.hands) === null;
  return refused ? settleHands(save, emptyLoadout()) : save;
};

export class HomeSync {
  private readonly options: HomeSyncOptions;
  private readonly saves: SaveQueue;
  private difficulty: DifficultyId = BASELINE_DIFFICULTY;
  private tick: number | null = null;
  private retryAt = 0;
  private van: VanState = 'away';
  private atVan = false;
  private arriving = false;
  private receiptInFlight: string | null = null;
  private overrunInFlight: string | null = null;
  /** The breach is being opened or closed in the save, so a second sight of it does not queue another write behind the first. */
  private breachWriting = false;
  /** The room's furthest level as last seen, which an overrun's record reads. */
  private roomHighest = 0;
  private forgeSeconds = 0;
  private lastHeld: string | null = null;
  /** The equip or join the room has not yet answered. Its answer settles against the locker; any other change in hand is a bench action. */
  private request: HandsRequest | null = null;
  private tripWait: ReturnType<typeof setTimeout> | undefined;
  /** Asked the room for a level while standing at the van with none picked. */
  private pickAsked = false;
  /** Back in a body the room kept, which may already be waiting at the van. */
  private bodyResumed = false;

  constructor(options: HomeSyncOptions) {
    this.options = options;
    this.saves = new SaveQueue({
      store: options.store,
      onChange: options.onChange,
      onFailed: () => {
        this.retryAt = this.now + RETRY_TICKS;
      },
    });
  }

  /** The save as last read, or null until it has loaded. */
  get save(): HomeSave | null {
    return this.saves.save;
  }

  /** Why the last save did not land, or null if it did. */
  get saveError(): string | null {
    return this.saves.error;
  }

  /** 0..1 through the jewel on the forge. */
  get forgeProgress(): number {
    return this.forgeSeconds / SMELT_SECONDS;
  }

  /** Reads the save and settles what can be settled before connecting. Solo has no body to return to. */
  async open(): Promise<HomeSave> {
    await this.saves.load();
    const resumed = this.options.mode === 'solo' ? false : null;
    await this.saves.write((save) => putBackRefused(firstStock(resolveOpenOverrun(resolveOpenTripWithQuests(save, resumed), resumed))));
    const save = this.saves.save as HomeSave;
    const stillOpen = save.openTrip !== null || save.openOverrun !== null;
    if (stillOpen) this.tripWait = setTimeout(() => this.settleOpenTrip(false), OPEN_TRIP_WAIT_MS);
    return save;
  }

  /** The room's answer. A join with nothing resumed means the body is gone, so there is nothing left to wait for. */
  welcomed(packet: WelcomePacket): void {
    this.difficulty = packet.difficulty ?? BASELINE_DIFFICULTY;
    this.request = { text: null, expires: Number.POSITIVE_INFINITY };
    this.bodyResumed = packet.resumed === true;
    this.settleOpenTrip(this.bodyResumed);
  }

  observe(snapshot: SnapshotPacket, yourId: string): void {
    const entity = snapshot.players.find((player) => player.id === yourId);
    const home = entity?.home;
    const canWatch = entity !== undefined && home !== undefined && this.saves.save !== null;
    if (!canWatch) return;
    const elapsed = this.advance(snapshot.tick);
    const { receipt, overrun } = home;
    this.roomHighest = snapshot.home?.roomHighest ?? this.roomHighest;
    if (receipt) this.takeReceipt(receipt);
    if (overrun) this.takeOverrunReceipt(overrun);
    if (isBunkerSeed(snapshot.mapSeed)) this.watchBunker(snapshot, entity, home, elapsed);
    else this.watchTown(snapshot.level, receipt);
  }

  /** Asks the room for this gear. The save changes when the answer comes back on the player. */
  equip(loadout: Loadout): void {
    this.request = { text: textOf(loadout), expires: this.now + EQUIP_EXPIRES_TICKS };
    this.options.sendHome({ kind: 'equip', loadout });
  }

  /** A sale never retries: on a conflict the shop has already refreshed, and the player can look again. */
  async buy(merchant: MerchantId, item: string, context: ShopContext): Promise<SaleResult> {
    let sold = false;
    const result = await this.saves.write((save) => {
      const next = buy(save, merchant, item, context);
      sold = next !== null;
      return next ?? save;
    }, 0);
    const landed = result.kind === 'saved';
    if (!landed) return result.kind;
    return sold ? 'bought' : 'refused';
  }

  /** Takes a quest on at its giver's counter. Like a sale it never retries: on a conflict the screen has already refreshed. */
  acceptQuest(merchant: MerchantId, id: string, context: QuestContext): Promise<QuestResult> {
    return this.counter((save) => acceptAt(save, merchant, id, context));
  }

  turnInQuest(merchant: MerchantId, context: QuestContext): Promise<QuestResult> {
    return this.counter((save) => turnInAt(save, merchant, context));
  }

  abandonQuest(merchant: MerchantId, context: QuestContext): Promise<QuestResult> {
    return this.counter((save) => abandon(save, merchant, context));
  }

  /** One write that stops at its first conflict. A step that returns null leaves the save as it was. */
  private async counter(step: (save: HomeSave) => HomeSave | null): Promise<QuestResult> {
    let stepped = false;
    const result = await this.saves.write((save) => {
      const next = step(save);
      stepped = next !== null;
      return next ?? save;
    }, 0);
    const isNotSaved = result.kind !== 'saved';
    if (isNotSaved) return result.kind;
    return stepped ? 'saved' : 'refused';
  }

  /** Resolves once every save asked for so far has finished. */
  settled(): Promise<void> {
    return this.saves.settled();
  }

  close(): void {
    this.clearTripWait();
  }

  /** Quitting on purpose from the van, before it leaves, is stepping away: no trip was made, so none is left on file to count as a death. */
  leave(): void {
    const boarded = this.van === 'ready' || this.van === 'boarding';
    if (!boarded) return;
    this.atVan = false;
    this.stepAway();
  }

  private get now(): number {
    return this.tick ?? 0;
  }

  private get mustWait(): boolean {
    return this.now < this.retryAt;
  }

  /** Seconds since the last frame. The first frame has none. */
  private advance(tick: number): number {
    const previous = this.tick ?? tick;
    this.tick = tick;
    return Math.min(MAX_FRAME_SECONDS, (tick - previous) / TICK_RATE);
  }

  private isApplied(receipt: TripReceipt): boolean {
    return this.saves.save?.appliedReceipts.includes(receiptKey(receipt)) ?? false;
  }

  private clearTripWait(): void {
    clearTimeout(this.tripWait);
    this.tripWait = undefined;
  }

  private settleOpenTrip(resumed: boolean): void {
    this.clearTripWait();
    void this.saves.write((save) => resolveOpenOverrun(resolveOpenTripWithQuests(save, resumed), resumed));
  }

  private isOverrunApplied(receipt: OverrunReceipt): boolean {
    return this.saves.save?.appliedReceipts.includes(overrunKey(receipt)) ?? false;
  }

  /** The same rule as a trip's: the key goes in the same save as the credit, a failed save leaves it unapplied for the retry, and a conflict re-reads before deciding. */
  private takeOverrunReceipt(receipt: OverrunReceipt): void {
    const key = overrunKey(receipt);
    const nothingToDo = this.isOverrunApplied(receipt) || this.overrunInFlight === key || this.mustWait;
    if (nothingToDo) return;
    this.overrunInFlight = key;
    let credited = false;
    const context = { highest: this.roomHighest, difficulty: this.difficulty };
    void this.saves.write((save) => {
      const next = applyOverrunReceipt(save, receipt, context);
      credited = next !== save;
      return next;
    }).then((result) => {
      this.overrunInFlight = null;
      const landed = credited && result.kind === 'saved';
      if (landed) this.options.onOverrunReceipt?.(receipt);
    });
  }

  /** A breach is written to the save when first seen, so quitting in it is a death, and closed once it is survived or over. */
  private watchBreach(home: HomeView, phase: OverrunView['phase'] | undefined): void {
    const save = this.saves.save;
    const cannotWriteYet = !save || this.mustWait || this.breachWriting;
    if (cannotWriteYet) return;
    const seen = watchBreach(save, phase, (home.overrun ?? null) !== null);
    const change = this.breachChange(seen);
    if (!change) return;
    this.breachWriting = true;
    void this.saves.write(change).then(() => {
      this.breachWriting = false;
    });
  }

  /** The write a breach watch asks for, or null when it asks for none. */
  private breachChange(seen: BreachWatch): SaveChange | null {
    const mode = this.options.mode;
    const open = { simId: '', mode, startedAt: Date.now(), highest: this.roomHighest, difficulty: this.difficulty };
    const changes: Record<BreachWatch, SaveChange | null> = {
      open: (current) => openOverrunOf(current, open),
      survived: clearOpenOverrun,
      died: (current) => diedUnseen(current),
      none: null,
    };
    return changes[seen];
  }

  private takeReceipt(receipt: TripReceipt): void {
    const key = receiptKey(receipt);
    const nothingToDo = this.isApplied(receipt) || this.receiptInFlight === key || this.mustWait;
    if (nothingToDo) return;
    this.receiptInFlight = key;
    let credited = false;
    const tally = this.options.tally?.() ?? emptyTally();
    void this.saves.write((save) => {
      const next = applyReceiptWithQuests(save, receipt, tally, this.options.highest?.() ?? 0);
      credited = next !== save;
      return next;
    }).then((result) => {
      this.receiptInFlight = null;
      const landed = credited && result.kind === 'saved';
      if (landed) this.options.onReceipt?.(receipt);
    });
  }

  private watchBunker(snapshot: SnapshotPacket, entity: PlayerEntity, home: HomeView, elapsed: number): void {
    this.watchForge(home, elapsed);
    this.watchBreach(home, snapshot.home?.overrun?.phase);
    const overrun = home.overrun ?? null;
    const overrunSettled = overrun === null || this.isOverrunApplied(overrun);
    const receiptSettled = overrunSettled && (home.receipt === null || this.isApplied(home.receipt));
    if (!receiptSettled) return;
    this.watchVan(snapshot, entity);
    this.watchHands(entity);
  }

  private watchTown(level: number, receipt: TripReceipt | null): void {
    this.van = 'away';
    this.atVan = false;
    this.forgeSeconds = 0;
    const shouldClearOverrun = this.saves.save?.openOverrun && !this.mustWait;
    if (shouldClearOverrun) void this.saves.write(clearOpenOverrun);
    const onFile = this.saves.save?.openTrip?.level === level;
    const shouldOpen = receipt === null && !onFile && !this.arriving && !this.mustWait;
    if (shouldOpen) this.arrive(level);
  }

  private withTrip(save: HomeSave, level: number): HomeSave {
    const startedAt = save.openTrip?.startedAt ?? Date.now();
    return { ...save, openTrip: { level, mode: this.options.mode, difficulty: this.difficulty, startedAt } };
  }

  /** In a town with no trip on file: carried along by the idle rule, or joined mid-trip. Also corrects a pick changed at the van. */
  private arrive(level: number): void {
    this.arriving = true;
    void this.saves.write((save) => this.withTrip(save, level)).then(() => {
      this.arriving = false;
    });
  }

  /** A refresh at the van: the room still has this body ready, and the trip on file is its own, not another tab's. */
  private rejoinVan(entity: PlayerEntity): void {
    const stillBoarded = this.bodyResumed && entity.home?.ready === true && this.saves.save?.openTrip != null;
    this.bodyResumed = false;
    if (stillBoarded) this.van = 'ready';
  }

  private watchVan(snapshot: SnapshotPacket, entity: PlayerEntity): void {
    this.rejoinVan(entity);
    const { exit } = snapshot;
    const level = snapshot.home?.pickedLevel ?? null;
    const inReach = exit !== null && Math.hypot(entity.x - exit.x, entity.y - exit.y) <= EXIT_RADIUS;
    const standing = inReach && entity.status === 'alive';
    this.atVan = standing && level !== null;
    this.pickFurthest(snapshot, standing && level === null);
    const shouldBoard = this.atVan && this.van === 'away' && !this.mustWait;
    if (shouldBoard) this.boardArmed(level as number);
    const walkedOff = !this.atVan && this.van === 'ready';
    if (walkedOff) this.stepAway();
    const mayTryAgain = !this.atVan && this.van === 'refused';
    if (mayTryAgain) this.van = 'away';
  }

  /** Nobody stands at the van with nowhere to go. The map can still pick another level. */
  private pickFurthest(snapshot: SnapshotPacket, nothingPicked: boolean): void {
    const level = snapshot.home?.roomHighest;
    const shouldAsk = nothingPicked && !this.pickAsked && level !== undefined;
    this.pickAsked = nothingPicked;
    if (shouldAsk) this.options.sendHome({ kind: 'pick_level', level });
  }

  /** Empty hands take the gun from the locker first: once a trip is on file, hands stop settling against the locker. */
  private boardArmed(level: number): void {
    const save = this.saves.save;
    const gear = save && armedHands(save);
    if (!gear) {
      this.board(level);
      return;
    }
    const asked = this.request;
    const stillAsking = asked !== null && asked.text !== null && this.now <= asked.expires;
    if (!stillAsking) this.equip(gear);
  }

  /** The trip is on file before the room hears ready, so nothing leaves on gear the save does not know about. */
  private board(level: number): void {
    this.van = 'boarding';
    let opened = false;
    void this.saves.write((save) => {
      opened = save.openTrip === null;
      return opened ? this.withTrip(save, level) : save;
    }).then((result) => this.boarded(opened, result));
  }

  private boarded(opened: boolean, result: SaveResult): void {
    const landed = result.kind === 'saved';
    const onFile = opened && landed;
    this.van = onFile ? 'ready' : 'refused';
    const anotherTabHasIt = landed && !opened;
    if (anotherTabHasIt) this.saves.fail(TRIP_ALREADY_OPEN);
    if (!onFile) return;
    if (this.atVan) this.options.sendHome({ kind: 'ready', ready: true });
    else this.stepAway();
  }

  private stepAway(): void {
    this.van = 'away';
    this.options.sendHome({ kind: 'ready', ready: false });
    void this.saves.write((save) => ({ ...save, openTrip: null }));
  }

  /** Only whole jewels pay, and leaving drops the part-done one, which stays raw. */
  private watchForge(home: HomeView, elapsed: number): void {
    const jewels = this.saves.save?.rawJewels;
    const hasJewels = jewels !== undefined && jewels.small + jewels.large > 0;
    const smelting = home.station === 'forge' && hasJewels;
    this.forgeSeconds = smelting ? this.forgeSeconds + elapsed : 0;
    const finished = this.forgeSeconds >= SMELT_SECONDS;
    if (!finished) return;
    this.forgeSeconds -= SMELT_SECONDS;
    void this.saves.write((save) => smeltWithQuests(save, SMELT_SECONDS));
  }

  /** The player opened a station, which a visit quest counts. */
  visit(station: StationId): void {
    const canWrite = !this.mustWait;
    if (canWrite) void this.saves.write((save) => visited(save, station));
  }

  /** Gear in hand follows the player. An answer to an equip moves it out of the locker; a bench action just changes it. */
  private watchHands(entity: PlayerEntity): void {
    const tripUnderway = this.van !== 'away' || this.saves.save?.openTrip != null;
    const tripHoldsTheGear = tripUnderway;
    if (tripHoldsTheGear) this.request = null;
    const isBusy = tripUnderway || this.mustWait;
    if (isBusy) return;
    const held = loadoutOfEntity(entity);
    const text = textOf(held);
    const sameAsLast = text === this.lastHeld;
    if (sameAsLast) return;
    this.lastHeld = text;
    const answering = this.answeredBy(text);
    const change: SaveChange = (save) => (answering ? settleHands(save, held) : { ...save, hands: held });
    void this.saves.write(change).then((result) => {
      const landed = result.kind === 'saved';
      const settledIt = landed && answering !== null && this.request === answering;
      if (!landed) this.lastHeld = null;
      if (settledIt) this.request = null;
    });
  }

  /** The request this hand answers, if any. A request stays open until its write lands, so a retry settles the same way. */
  private answeredBy(text: string): HandsRequest | null {
    const asked = this.request;
    const refused = asked !== null && this.now > asked.expires;
    if (refused) this.request = null;
    const answers = asked !== null && this.request === asked && (asked.text === null || asked.text === text);
    return answers ? asked : null;
  }
}
