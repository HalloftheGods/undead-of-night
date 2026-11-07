// A client-side count of what happened to the local player during a trip, read from snapshot events.
// It can undercount when a co-op snapshot is dropped and never overcounts. Receipt objectives do not use it.

import type { EntityId, GameEvent, ZombieType } from '../../../shared/protocol.ts';
import { TALLY_COUNTERS } from './quest-data.ts';
import type { TallyCounter } from './quest-data.ts';

const ZOMBIE_TYPES: readonly ZombieType[] = ['walker', 'runner', 'bloater', 'brute', 'screamer'];

type ZombieStatusEvent = Extract<GameEvent, { type: 'zombie_status' }>;
type ZombieDieEvent = Extract<GameEvent, { type: 'zombie_die' }>;

/** What the quest rules read: counters, kills by kind, and who was in the trip. */
export interface TripTally {
  readonly counts: Readonly<Record<TallyCounter, number>>;
  readonly killsBy: Readonly<Record<ZombieType, number>>;
  /** Players in the room when the trip ended, at least 1. */
  readonly party: number;
  /** The character id worn on the trip, or null if it is not known. */
  readonly survivor: string | null;
}

const blankCounts = (): Record<TallyCounter, number> => Object.fromEntries(TALLY_COUNTERS.map((name) => [name, 0])) as Record<TallyCounter, number>;
const blankKills = (): Record<ZombieType, number> => Object.fromEntries(ZOMBIE_TYPES.map((kind) => [kind, 0])) as Record<ZombieType, number>;

export const emptyTally = (): TripTally => ({ counts: blankCounts(), killsBy: blankKills(), party: 1, survivor: null });

export class QuestTally {
  private counts = blankCounts();
  private killsBy = blankKills();
  /** Zombies set alight by an incendiary round, so a later death counts as a burning kill. */
  private burning = new Set<EntityId>();
  private party = 1;
  private survivor: string | null = null;

  /** Who is in the trip and who the local player is. Read at the moment the trip ends. */
  setContext(party: number, survivor: string | null): void {
    this.party = Math.max(1, Math.floor(party));
    this.survivor = survivor;
  }

  /** The counts so far, which the next call to `observe` will not change. */
  snapshot(): TripTally {
    return { counts: { ...this.counts }, killsBy: { ...this.killsBy }, party: this.party, survivor: this.survivor };
  }

  /** Clears the counts, as when the local player dies or a trip is banked. */
  reset(): void {
    this.counts = blankCounts();
    this.killsBy = blankKills();
    this.burning = new Set();
  }

  /** Counts only what the local player did or suffered. */
  observe(events: readonly GameEvent[], localId: EntityId): void {
    for (const event of events) this.read(event, localId);
  }

  private bump(counter: TallyCounter, by = 1): void {
    this.counts[counter] += by;
  }

  private read(event: GameEvent, localId: EntityId): void {
    switch (event.type) {
      case 'zombie_status':
        this.noteBurn(event);
        break;
      case 'zombie_die':
        this.noteKill(event, localId);
        break;
      default:
        this.readOwn(event, localId);
    }
  }

  private noteBurn(event: ZombieStatusEvent): void {
    const isOnFire = event.effect === 'incendiary';
    if (isOnFire) this.burning.add(event.zombieId);
  }

  private noteKill(event: ZombieDieEvent, localId: EntityId): void {
    const burned = this.burning.delete(event.zombieId);
    const isSomeoneElsesKill = event.killerId !== localId;
    if (isSomeoneElsesKill) return;
    this.bump('kills');
    this.killsBy[event.zombieType] += 1;
    if (burned) this.bump('burning');
  }

  /** Everything else, counted only when the local player did it. */
  private readOwn(event: GameEvent, localId: EntityId): void {
    const isSomeoneElse = 'playerId' in event && event.playerId !== localId;
    if (isSomeoneElse) return;
    if (event.type === 'headshot') this.bump('headshots');
    else if (event.type === 'melee' && event.hit) this.bump('shoves');
    else if (event.type === 'container_opened') this.searched(event.found, event.noisy);
    else if (event.type === 'bottle_smash' || event.type === 'molotov_burst') this.bump('bottles');
    else if (event.type === 'heal') this.bump('medkits');
    else if (event.type === 'player_hurt') this.bump('damage', event.damage);
    else if (event.type === 'shot' && event.suppressed) this.bump('suppressed');
    else if (event.type === 'pickup' && event.pickup === 'bandage') this.bump('bandages');
  }

  private searched(found: boolean, noisy: boolean): void {
    if (found) this.bump('finds');
    if (noisy) this.bump('noisy');
  }
}
