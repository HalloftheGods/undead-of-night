// The client's end of the home loop: opens the save, brings the room its gear, and turns what comes
// back into screens. Every write to the save is HomeSync's. This decides what the player sees and holds.

import { BASELINE_DIFFICULTY } from '../../shared/difficulty.ts';
import type { DifficultyId } from '../../shared/difficulty.ts';
import { isBunkerSeed } from '../../shared/home-protocol.ts';
import type { HomeAction, JoinHome, Loadout, MerchantId, OverrunPhase, OverrunReceipt, StationId, TripReceipt } from '../../shared/home-protocol.ts';
import { characterOf } from '../../shared/characters.ts';
import { emptyLoadout } from '../../shared/loadout.ts';
import type { PlayerEntity, SnapshotPacket, WelcomePacket } from '../../shared/protocol.ts';
import type { GameTransport, TransportKind } from '../network/transport.ts';
import { questContext, shopContext } from './home-hud.ts';
import type { ChestOpened, HomeActions, HomeDeath, HomeFacts, HomeUi } from './home-hud.ts';
import type { HomeStore } from './home/home-store.ts';
import { HomeSync, joinHomeFor } from './home/home-sync.ts';
import type { QuestResult } from './home/quest-sync.ts';
import { QuestTally } from './home/quest-tally.ts';
import type { Banner, RunResult, UiState } from './hud-state.ts';
import { loadCampaignProgress, recordCampaignFinished, recordLevelCleared } from './level-progress.ts';
import { inSightSince } from './stage-cut.ts';
import { endingResult, recordTrip } from './trip-record.ts';

/** The death summary stays this long in plain sight before Enter can wake past it, so a mashed key cannot skip what was lost. */
const SUMMARY_READ_MS = 1000;

/** The parts of the controller a home session reaches into. */
export interface HomeLinkHost {
  transport(): GameTransport | null;
  ui(): UiState;
  localPlayer(): PlayerEntity | null;
  /** The save, an error, a death or the ending moved, and the screens should hear of it now. */
  refresh(): void;
  /** Whether the player's hands are free may have changed. */
  syncControls(): void;
  say(banner: Omit<Banner, 'key'>, nowMs: number): void;
  showEnding(result: RunResult): void;
  hideEnding(): void;
}

export interface HomeLinkOptions {
  readonly store: () => HomeStore;
  readonly host: HomeLinkHost;
}

/** Stands idle until a Campaign run opens it, and an Arcade run never does. */
export class HomeLink {
  /** What the screens can ask for. */
  readonly actions: HomeActions;

  private readonly createStore: () => HomeStore;
  private readonly host: HomeLinkHost;
  private sync: HomeSync | null = null;
  private highest = loadCampaignProgress().highest;
  private difficulty: DifficultyId = BASELINE_DIFFICULTY;
  /** The station this player has open. */
  private station: StationId | null = null;
  /** What the open screen says closing means, if it has anything to settle first. */
  private closer: (() => void) | null = null;
  private death: HomeDeath | null = null;
  private diedAtMs = 0;
  /** The chest just opened, until it is put away. */
  private chest: ChestOpened | null = null;
  /** The room's overrun phase as the last snapshot had it, and as it stood when this player's overrun receipt first showed. */
  private phase: OverrunPhase | undefined;
  private phaseAtReceipt: OverrunPhase | undefined;
  private seenReceipt: OverrunReceipt | null = null;
  private inBunker = false;
  private ending = false;
  /** The gear this trip took out, which a death takes with it. */
  private takenOut: Loadout = emptyLoadout();
  private saidError: string | null = null;
  /** What the local player has done this trip. Lives only here, and is cleared once the save that counted it lands. */
  private readonly tally = new QuestTally();
  private wasDead = false;

  constructor({ store, host }: HomeLinkOptions) {
    this.createStore = store;
    this.host = host;
    this.actions = {
      pickLevel: (level) => this.send({ kind: 'pick_level', level }),
      equip: (loadout) => this.sync?.equip(loadout),
      closeStation: () => void this.putStationAway(),
      closeWith: (closer) => {
        this.closer = closer;
      },
      // The forge runs by itself for as long as the player stays at it.
      smelt: () => {},
      buy: (merchant, item) => this.buy(merchant, item),
      acceptQuest: (merchant, id) => this.quest((home, sync) => sync.acceptQuest(merchant, id, questContext(home))),
      turnInQuest: (merchant) => this.quest((home, sync) => sync.turnInQuest(merchant, questContext(home))),
      abandonQuest: (merchant) => this.quest((home, sync) => sync.abandonQuest(merchant, questContext(home))),
      wake: () => this.wake(),
      closeChest: () => this.putChestAway(),
      continueFromEnding: () => this.continueFromEnding(),
    };
  }

  /** What the screens know that no snapshot carries. */
  facts(): HomeFacts {
    const { sync } = this;
    return {
      save: sync?.save ?? null,
      highest: this.highest,
      difficulty: this.difficulty,
      forgeProgress: sync?.forgeProgress ?? 0,
      saveError: sync?.saveError ?? null,
      death: this.death,
      chest: this.chest,
      tally: this.tally.snapshot(),
    };
  }

  /** A station, the death summary, the opened chest or the ending is up, and the keys are theirs. */
  get holdsControls(): boolean {
    return this.station !== null || this.death !== null || this.chest !== null || this.ending;
  }

  get endingShowing(): boolean {
    return this.ending;
  }

  /** Reads the save and settles what can be settled, then says what to bring to the room. */
  async open(kind: TransportKind): Promise<JoinHome> {
    this.close();
    const current = (): boolean => this.sync === sync;
    const sync: HomeSync = new HomeSync({
      store: this.createStore(),
      mode: kind,
      sendHome: (action) => this.send(action),
      onChange: () => current() && this.host.refresh(),
      onReceipt: (receipt) => current() && this.onReceipt(receipt),
      onOverrunReceipt: (receipt) => current() && this.onOverrunReceipt(receipt),
      tally: () => this.tally.snapshot(),
      highest: () => this.highest,
    });
    this.sync = sync;
    const save = await sync.open();
    const progress = loadCampaignProgress();
    const isCurrentVisit = current();
    if (isCurrentVisit) this.highest = progress.highest;
    return joinHomeFor(save, progress);
  }

  welcomed(packet: WelcomePacket): void {
    this.difficulty = packet.difficulty ?? BASELINE_DIFFICULTY;
    this.sync?.welcomed(packet);
  }

  /** Called with every snapshot, once the run has a world. */
  observe(snapshot: SnapshotPacket, localId: string, nowMs: number): void {
    const { sync } = this;
    if (!sync) return;
    const entity = snapshot.players.find((player) => player.id === localId);
    const trip = sync.save?.openTrip ?? null;
    if (trip) this.takenOut = sync.save?.hands ?? this.takenOut;
    this.watchOverrun(snapshot, entity);
    this.feedTally(snapshot, entity, localId);
    sync.observe(snapshot, localId);
    this.watchStation(entity?.home?.station ?? null);
    this.sayError(nowMs);
  }

  /** Esc: the same as the screen's Close button. True if a station or the chest was open. */
  closeOpenStation(): boolean {
    const isChestOut = this.chest !== null;
    if (isChestOut) return this.putChestAway();
    const { closer } = this;
    const screenCloses = closer !== null && this.station !== null;
    if (!screenCloses) return this.putStationAway();
    closer();
    return true;
  }

  /** The room puts the station away, and the next snapshot says so. True if one was open. */
  private putStationAway(): boolean {
    const nothingOpen = this.station === null;
    if (nothingOpen) return false;
    this.send({ kind: 'leave_station' });
    return true;
  }

  /** Enter: reads the death summary, once it has been seen. True if the press was the summary's. */
  confirm(): boolean {
    const isChestOut = this.chest !== null;
    if (isChestOut) return this.putChestAway();
    if (!this.death) return false;
    const hasSeenSummary = inSightSince(this.diedAtMs, SUMMARY_READ_MS);
    if (hasSeenSummary) this.wake();
    return true;
  }

  /** The player is leaving the run for the menu: a boarded van that has not left is called off first. */
  leave(): void {
    this.sync?.leave();
  }

  /** The run is over, or this session was never going to start. */
  close(): void {
    this.sync?.close();
    this.sync = null;
    this.station = null;
    this.closer = null;
    this.death = null;
    this.chest = null;
    this.phase = undefined;
    this.phaseAtReceipt = undefined;
    this.seenReceipt = null;
    this.inBunker = false;
    this.ending = false;
    this.takenOut = emptyLoadout();
    this.saidError = null;
    this.tally.reset();
    this.wasDead = false;
  }

  /** Counts what this snapshot says the local player did. Dying loses the count, as it loses the gear; being revived keeps it. */
  private feedTally(snapshot: SnapshotPacket, entity: PlayerEntity | undefined, localId: string): void {
    if (!entity) return;
    this.tally.observe(snapshot.events, localId);
    this.tally.setContext(snapshot.players.length, characterOf(entity.skin).id);
    const dead = entity.status === 'dead';
    const hasJustDied = dead && !this.wasDead;
    if (hasJustDied) this.tally.reset();
    this.wasDead = dead;
  }

  private send(action: HomeAction): void {
    this.host.transport()?.sendHome(action);
  }

  private watchStation(station: StationId | null): void {
    const changed = station !== this.station;
    this.station = station;
    if (changed) this.host.syncControls();
    const opened = changed && station !== null;
    if (opened) this.sync?.visit(station);
  }

  /** A save that did not land can hold the van back, and the locker and shops are not the only place to hear of it. */
  private sayError(nowMs: number): void {
    const error = this.sync?.saveError ?? null;
    const isNew = error !== null && error !== this.saidError;
    this.saidError = error;
    if (isNew) this.host.say({ title: 'THE SAVE DID NOT LAND', subtitle: error.toUpperCase(), tone: 'danger' }, nowMs);
  }

  /** Credited here, once. */
  private onReceipt(receipt: TripReceipt): void {
    this.tally.reset();
    const isNewBest = recordTrip(receipt, this.host.ui().callsign);
    const died = receipt.outcome === 'died';
    if (died) this.die(receipt);
    else this.bank(receipt, isNewBest);
    this.host.refresh();
  }

  /**
   * Credited here, once. A held chest shows what it held; a fall shows the gear in hand that went. A flight shows nothing, for the stalls say it.
   * Either card belongs to the bunker: a body written off as the van left lands in town with its receipt, which is applied and recorded there
   * without a word, since the summary would say it stands up in the bunker.
   */
  private onOverrunReceipt(receipt: OverrunReceipt): void {
    const { outcome } = receipt;
    const chestShows = outcome === 'held' && this.inBunker;
    if (chestShows) this.chest = { gear: receipt.chest ?? emptyLoadout(), silver: receipt.silver, jewels: receipt.jewels };
    const fallShows = outcome === 'died' && this.inBunker;
    if (fallShows) this.fall(receipt);
    this.host.syncControls();
    this.host.refresh();
  }

  private fall(receipt: OverrunReceipt): void {
    const bunkerFell = this.phaseAtReceipt === 'lost';
    this.death = { overrun: { bunkerFell }, lost: receipt.lost ?? emptyLoadout() };
    this.diedAtMs = performance.now();
  }

  /** The room's phase now, and the phase at the moment this player's receipt first showed, since the save lands a little later. */
  private watchOverrun(snapshot: SnapshotPacket, entity: PlayerEntity | undefined): void {
    this.phase = snapshot.home?.overrun?.phase;
    this.inBunker = isBunkerSeed(snapshot.mapSeed);
    this.putBunkerCardsAway();
    const receipt = entity?.home?.overrun ?? null;
    const isNew = receipt !== null && (this.seenReceipt === null || this.seenReceipt.serial !== receipt.serial || this.seenReceipt.simId !== receipt.simId);
    if (isNew) this.phaseAtReceipt = this.phase;
    const hasReceipt = receipt !== null;
    if (hasReceipt) this.seenReceipt = receipt;
  }

  /** The van left with a bunker card up, the fall summary or the chest: the save already has what it said, and the town is not the bunker. */
  private putBunkerCardsAway(): void {
    const fallUp = this.death?.overrun !== undefined;
    const leftWithACard = !this.inBunker && (fallUp || this.chest !== null);
    if (!leftWithACard) return;
    if (fallUp) this.death = null;
    this.chest = null;
    this.host.syncControls();
    this.host.refresh();
  }

  private putChestAway(): boolean {
    const wasUp = this.chest !== null;
    this.chest = null;
    if (wasUp) {
      this.host.syncControls();
      this.host.refresh();
    }
    return wasUp;
  }

  private die(receipt: TripReceipt): void {
    this.death = { receipt, lost: this.takenOut };
    this.diedAtMs = performance.now();
    this.takenOut = emptyLoadout();
    this.host.syncControls();
  }

  /** Reaching the van opens the next level, and the first clear of the last one plays the ending. */
  private bank(receipt: TripReceipt, isNewBest: boolean): void {
    this.highest = recordLevelCleared(receipt.level).highest;
    this.takenOut = emptyLoadout();
    if (!receipt.ending) return;
    recordCampaignFinished();
    const me = this.host.localPlayer();
    const survivor = { id: me?.id ?? '', name: me?.name ?? this.host.ui().callsign, skin: me?.skin ?? 0 };
    this.ending = true;
    this.host.showEnding(endingResult(receipt, survivor, isNewBest));
    this.host.syncControls();
  }

  private wake(): void {
    if (!this.death) return;
    this.death = null;
    this.host.syncControls();
    this.host.refresh();
  }

  /** The credits are over: back to the bunker, in the same session. */
  private continueFromEnding(): void {
    if (!this.ending) return;
    this.ending = false;
    this.host.hideEnding();
    this.host.syncControls();
  }

  /** A quest step at a counter. Like a sale it never retries, and the screens refresh whatever the outcome. */
  private quest(step: (home: HomeUi, sync: HomeSync) => Promise<QuestResult>): void {
    const home = this.host.ui().home;
    const { sync } = this;
    const canWork = sync !== null && home !== null;
    if (!canWork) return;
    void step(home, sync).then(() => this.host.refresh());
  }

  private buy(merchant: MerchantId, item: string): void {
    const home = this.host.ui().home;
    const { sync } = this;
    const canSell = sync !== null && home !== null;
    if (!canSell) return;
    void sync.buy(merchant, item, shopContext(home)).then(() => this.host.refresh());
  }
}
