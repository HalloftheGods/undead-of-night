import { ammoCapOf } from '../../shared/keepsakes.ts';
import { CANDIES } from '../../shared/candy.ts';
import type { CandyId } from '../../shared/protocol.ts';
import { BOSSES } from '../../shared/bosses.ts';
import { MEDKIT_MAX, PICKUP_RADIUS } from '../../shared/constants.ts';
import { PART_CARRY_CAP } from '../../shared/gun-upgrade-data.ts';
import { isPartPickup } from '../../shared/gun-upgrades.ts';
import type { OverrunEnd } from '../../shared/home-protocol.ts';
import type {
  BuildingKind,
  EntityId,
  GameEvent,
  PickupEntity,
  PickupType,
  PlayerEntity,
  WeaponId,
} from '../../shared/protocol.ts';
import { formatDuration } from './hud-state.ts';
import type { Banner, Callout, LevelCard, PlaceBanner, UiState } from './hud-state.ts';
import type { CalloutWords } from './kill-juice.ts';
import { levelTitle } from './level-hud.ts';
import { isRadioFound } from './sound-unlock.ts';

const BANNER_MS = 2600;
const PLACE_BANNER_MS = 2200;
const CALLOUT_MS = 1200;
const LEVEL_CARD_MS = 4200;
/** A refused item on the floor says so once, and again only if the player lingers. */
const REFUSAL_REPEAT_MS = 2500;

const AMMO_GUN: Partial<Record<PickupType, WeaponId>> = {
  pistol_ammo: 'pistol',
  carbine_ammo: 'carbine',
  shells: 'shotgun',
};

const AMMO_NAME: Partial<Record<PickupType, string>> = {
  pistol_ammo: 'PISTOL AMMO',
  carbine_ammo: 'CARBINE AMMO',
  shells: 'SHELLS',
};

/** Too common to announce; the town map still ticks them off. */
const UNNAMED_PLACES: ReadonlySet<BuildingKind> = new Set<BuildingKind>(['house', 'apartment']);

export function isLandmark(kind: BuildingKind): boolean {
  return !UNNAMED_PLACES.has(kind);
}

/** Worded from what actually changed, since a pickup event does not carry an amount. */
export function pickupNote(pickup: PickupType, before: PlayerEntity | null, after: PlayerEntity | null): string {
  const gun = AMMO_GUN[pickup];
  if (gun) {
    const gained = (after?.ammoBag[gun] ?? 0) - (before?.ammoBag[gun] ?? 0);
    return gained > 0 ? `+${gained} ${AMMO_NAME[pickup]}` : `${AMMO_NAME[pickup]}`;
  }
  const isBandage = pickup === 'bandage';
  const isMedkit = pickup === 'medkit';
  if (isBandage) {
    const healed = Math.round((after?.health ?? 0) - (before?.health ?? 0));
    return healed > 0 ? `+${healed} HEALTH` : 'BANDAGE';
  }
  return isMedkit ? '+1 MEDKIT' : pickup.toUpperCase();
}

/** Why an item the player is standing on is still on the floor, or null if there is no such reason. */
export function refusalNote(player: PlayerEntity, type: PickupType): string | null {
  const gun = AMMO_GUN[type];
  const noRoomForAmmo = gun !== undefined && player.ammoBag[gun] >= ammoCapOf(player, gun);
  const wastedBandage = type === 'bandage' && player.health >= player.maxHealth;
  const noRoomForMedkit = type === 'medkit' && player.medkits >= MEDKIT_MAX;
  const secondKnife = type === 'knife' && player.knife;
  const noRoomForPart = isPartPickup(type) && (player.gear?.parts[type] ?? 0) >= PART_CARRY_CAP;
  if (noRoomForPart) return 'PARTS FULL';
  if (noRoomForAmmo) return 'AMMO FULL';
  if (wastedBandage) return 'HEALTH FULL';
  if (secondKnife) return 'ALREADY ARMED';
  return noRoomForMedkit ? 'MEDKITS FULL' : null;
}

const SET_BANNERS: Partial<Record<GameEvent['type'], Omit<Banner, 'key'>>> = {
  wave_clear: { title: 'THE HORDE MOVES ON', subtitle: 'FOR NOW', tone: 'quiet' },
  exit_open: { title: 'THE VAN IS HERE', subtitle: 'GET EVERYONE ON BOARD', tone: 'hope' },
  drop_called: { title: 'SUPPLY DROP', subtitle: 'FOLLOW THE RED FLARE', tone: 'hope' },
};

/** The loud banner for a horde or the van, or null for anything else. */
/** Said instead of the horde moving on, when the last of it fell. */
export const HORDE_WIPED_BANNER: Omit<Banner, 'key'> = { title: 'HORDE WIPED OUT', subtitle: 'FOR NOW', tone: 'quiet' };

/** Said to whoever ate it: what the candy does. */
export function candyBanner(candy: CandyId, saved: boolean): Omit<Banner, 'key'> {
  const def = CANDIES[candy];
  if (saved) return { title: 'CARAMEL APPLE', subtitle: 'BACK ON YOUR FEET', tone: 'hope' };
  return { title: def.name.toUpperCase(), subtitle: def.blurb.replace(/\.$/, '').toUpperCase(), tone: 'hope' };
}

export function hordeBanner(event: GameEvent): Omit<Banner, 'key'> | null {
  const hordeCame = event.type === 'wave_start';
  if (hordeCame) return { title: `HORDE ${event.wave}`, subtitle: `${event.hostiles} HOSTILES`, tone: 'danger' };
  const isBossArrival = event.type === 'boss_arrive';
  if (isBossArrival) return { title: BOSSES[event.boss].name.toUpperCase(), subtitle: 'BOSS NIGHT', tone: 'danger' };
  const isBossDown = event.type === 'boss_down';
  if (isBossDown) return { title: 'BOSS DOWN', subtitle: BOSSES[event.boss].name.toUpperCase(), tone: 'hope' };
  return SET_BANNERS[event.type] ?? null;
}

/** One warning step's banner. A null subtitle shows the clock's own time left. */
interface OverrunWarning {
  readonly title: string;
  readonly subtitle: string | null;
  readonly tone: Banner['tone'];
}

/** Each warning step, from the first (2:30) to the last (0:30), when guns come free. */
const OVERRUN_WARNING_STEPS: readonly OverrunWarning[] = [
  { title: 'SOMETHING AT THE BLAST DOOR', subtitle: null, tone: 'quiet' },
  { title: 'THE DOOR IS BUCKLING', subtitle: null, tone: 'danger' },
  { title: "IT WON'T HOLD", subtitle: 'GUNS FREE', tone: 'danger' },
];

/** A fallen bunker has no banner: the death summary shows. */
const OVERRUN_ENDINGS: Record<OverrunEnd, Omit<Banner, 'key'> | null> = {
  held: { title: 'THE BUNKER HOLDS', subtitle: 'A CHEST BY THE DOOR', tone: 'hope' },
  lost: null,
};

/** The banner for a warning step, the breach or a held bunker, or null for any other event. */
export function overrunBanner(event: GameEvent): Omit<Banner, 'key'> | null {
  switch (event.type) {
    case 'overrun_warning': {
      const step = OVERRUN_WARNING_STEPS[Math.min(event.step, OVERRUN_WARNING_STEPS.length - 1)];
      return { title: step.title, subtitle: step.subtitle ?? formatDuration(event.left), tone: step.tone };
    }
    case 'overrun_breach': return { title: 'THE BLAST DOOR IS DOWN', subtitle: `${event.hostiles} HOSTILES`, tone: 'danger' };
    case 'overrun_end': return OVERRUN_ENDINGS[event.outcome];
    default: return null;
  }
}

/** The find banner for a Radio, shown to everyone in the run, or null for anything else. */
export function radioBanner(event: GameEvent, track: string | null): Omit<Banner, 'key'> | null {
  const gaveUpATrack = isRadioFound(event) && track !== null;
  return gaveUpATrack ? { title: 'A RADIO', subtitle: `NEW TRACK: ${track.toUpperCase()}`, tone: 'hope' } : null;
}

/** Banners, place labels and the words over the player's head: timing and wording, no drawing. */
export class RunNotices {
  private bannerKey = 0;
  private bannerUntilMs = 0;
  private calloutKey = 0;
  private calloutUntilMs = 0;
  private placeKey = 0;
  private placeUntilMs = 0;
  private levelCardKey = 0;
  private levelCardUntilMs = 0;
  private indoors: string | null = null;
  private refusedId: EntityId | null = null;
  private refusedAtMs = 0;

  reset(): void {
    this.bannerUntilMs = 0;
    this.calloutUntilMs = 0;
    this.placeUntilMs = 0;
    this.levelCardUntilMs = 0;
    this.indoors = null;
    this.refusedId = null;
  }

  banner(banner: Omit<Banner, 'key'>, now: number): Banner {
    this.bannerKey += 1;
    this.bannerUntilMs = now + BANNER_MS;
    return { ...banner, key: this.bannerKey };
  }

  callout(words: CalloutWords, now: number): Callout {
    this.calloutKey += 1;
    this.calloutUntilMs = now + CALLOUT_MS;
    return { ...words, key: this.calloutKey };
  }

  /** Whether a callout still has the screen. */
  calloutShowing(now: number): boolean {
    return now <= this.calloutUntilMs;
  }

  place(label: string, now: number): PlaceBanner {
    this.placeKey += 1;
    this.placeUntilMs = now + PLACE_BANNER_MS;
    return { key: this.placeKey, label };
  }

  levelCard(level: number, now: number, mapSeed: number | null = null): LevelCard {
    this.levelCardKey += 1;
    this.levelCardUntilMs = now + LEVEL_CARD_MS;
    return { ...levelTitle(level, mapSeed), key: this.levelCardKey };
  }

  /** The building id the player has just stepped into, or null if nothing changed. */
  entered(indoors: string | null): string | null {
    const changed = indoors !== this.indoors;
    this.indoors = indoors;
    return changed ? indoors : null;
  }

  /** The words to show, and where, if the player is standing on something they cannot take. */
  refusal(player: PlayerEntity, pickups: readonly PickupEntity[], now: number): string | null {
    const down = player.status !== 'alive';
    if (down) return null;
    for (const pickup of pickups) {
      const inReach = Math.hypot(pickup.x - player.x, pickup.y - player.y) <= PICKUP_RADIUS;
      const note = inReach ? refusalNote(player, pickup.type) : null;
      if (!note) continue;
      const fresh = pickup.id !== this.refusedId || now - this.refusedAtMs > REFUSAL_REPEAT_MS;
      if (!fresh) return null;
      this.refusedId = pickup.id;
      this.refusedAtMs = now;
      return note;
    }
    return null;
  }

  /** Clears whatever has run its time. */
  expired(ui: UiState, now: number): Partial<UiState> {
    const bannerDone = ui.banner !== null && now > this.bannerUntilMs;
    const calloutDone = (ui.callout ?? null) !== null && now > this.calloutUntilMs;
    const placeDone = ui.place !== null && now > this.placeUntilMs;
    const levelCardDone = ui.levelCard !== null && now > this.levelCardUntilMs;
    return {
      ...(bannerDone ? { banner: null } : {}),
      ...(calloutDone ? { callout: null } : {}),
      ...(placeDone ? { place: null } : {}),
      ...(levelCardDone ? { levelCard: null } : {}),
    };
  }
}
