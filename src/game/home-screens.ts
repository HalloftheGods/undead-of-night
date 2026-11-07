// What the home screens say and decide. The components only lay these out.

import { playsFromHome } from '../../shared/game-style.ts';
import type { GameStyle } from '../../shared/game-style.ts';
import { EFFECT_ORDER, GUN_EFFECTS } from '../../shared/round-effect-data.ts';
import { PART_LABELS, PART_ORDER } from '../../shared/gun-upgrade-data.ts';
import type { Jewels, Loadout } from '../../shared/home-protocol.ts';
import { FINAL_LEVEL, LEVELS } from '../../shared/levels.ts';
import { WEAPON_ORDER } from '../../shared/protocol.ts';
import type { WeaponId } from '../../shared/protocol.ts';
import { coinText, jewelWorth } from '../../shared/treasure.ts';
import type { ChestOpened, HomeActions, HomeDeath, HomeUi } from './home-hud.ts';
import type { HomeSave } from './home/home-store.ts';
import { COOP_LEVEL_NOTE, startAtLabel } from './level-select.ts';

const SMELT_SECONDS = 3;

const WEAPON_LABELS: Readonly<Record<WeaponId, string>> = { pistol: 'Pistol', carbine: 'Carbine', shotgun: 'Shotgun' };

/** Shown in place of either style's note on an invite link, where the room says which style it plays once connected. */
export const ROOM_DECIDES_NOTE = 'The room decides the style.';

export const HOME_COOP_NOTE = 'Pick the level at the garage map. The room can go as far as its best player has.';

export const LEAVE_WARNING = 'Leaving now counts as dying. You lose what you are carrying, and any gear you took out.';

// The locker

export interface LockerRow {
  /** `gun:pistol`, `ammo:pistol`, `part:barrel`, `kit:acid`, `medkit`, `knife` or `bottle`. */
  readonly key: string;
  readonly label: string;
  readonly count: number;
}

export interface LockerDraft {
  readonly locker: Loadout;
  readonly hands: Loadout;
}

const NONE: Loadout['parts'] = { barrel: 0, grip: 0, magazine: 0, suppressor: 0, toolkit: 0 };

function copyOf(loadout: Loadout): Loadout {
  return { ...loadout, guns: { ...loadout.guns }, ammoBag: { ...loadout.ammoBag }, parts: { ...NONE, ...loadout.parts }, kits: { ...loadout.kits } };
}

/** What a loadout holds, in the order the screens list it. */
export function loadoutRows(loadout: Loadout): readonly LockerRow[] {
  const rows: LockerRow[] = [];
  for (const weapon of WEAPON_ORDER) {
    if (loadout.guns[weapon]) rows.push({ key: `gun:${weapon}`, label: WEAPON_LABELS[weapon], count: 1 });
  }
  for (const weapon of WEAPON_ORDER) {
    const rounds = loadout.ammoBag[weapon] ?? 0;
    const hasRounds = rounds > 0;
    if (hasRounds) rows.push({ key: `ammo:${weapon}`, label: `${WEAPON_LABELS[weapon]} rounds`, count: rounds });
  }
  for (const part of PART_ORDER) {
    const count = loadout.parts[part] ?? 0;
    const hasParts = count > 0;
    if (hasParts) rows.push({ key: `part:${part}`, label: PART_LABELS[part], count });
  }
  for (const effect of EFFECT_ORDER) {
    const count = loadout.kits[effect] ?? 0;
    const hasKits = count > 0;
    if (hasKits) rows.push({ key: `kit:${effect}`, label: `${GUN_EFFECTS[effect].label} kit`, count });
  }
  const hasMedkits = loadout.medkits > 0;
  if (hasMedkits) rows.push({ key: 'medkit', label: 'Medkit', count: loadout.medkits });
  const hasBottles = loadout.bottles > 0;
  if (hasBottles) rows.push({ key: 'bottle', label: 'Bottle', count: loadout.bottles });
  if (loadout.knife) rows.push({ key: 'knife', label: 'Knife', count: 1 });
  return rows;
}

export function lockerView(save: HomeSave): { readonly locker: readonly LockerRow[]; readonly hands: readonly LockerRow[] } {
  return { locker: loadoutRows(save.locker), hands: loadoutRows(save.hands) };
}

/** Takes the item out of one loadout, or null when it is not there. A stack of ammo goes whole; the rest go one at a time. */
function take(from: Loadout, key: string): { rest: Loadout; item: Partial<Loadout> | null } {
  const rest = copyOf(from);
  const [kind, id = ''] = key.split(':');
  const isGun = kind === 'gun';
  if (isGun) {
    const gun = rest.guns[id as WeaponId];
    if (!gun) return { rest: from, item: null };
    delete rest.guns[id as WeaponId];
    return { rest, item: { guns: { [id]: gun } } };
  }
  const isAmmo = kind === 'ammo';
  if (isAmmo) {
    const rounds = rest.ammoBag[id as WeaponId] ?? 0;
    const isOutOfRounds = rounds <= 0;
    if (isOutOfRounds) return { rest: from, item: null };
    rest.ammoBag[id as WeaponId] = 0;
    return { rest, item: { ammoBag: { pistol: 0, carbine: 0, shotgun: 0, [id]: rounds } } };
  }
  const isPartOrKit = kind === 'part' || kind === 'kit';
  if (isPartOrKit) {
    const pool = (kind === 'part' ? rest.parts : rest.kits) as Record<string, number>;
    const isOutOfStock = (pool[id] ?? 0) <= 0;
    if (isOutOfStock) return { rest: from, item: null };
    pool[id] -= 1;
    return { rest, item: { [kind === 'part' ? 'parts' : 'kits']: { [id]: 1 } } };
  }
  const canTakeMedkit = kind === 'medkit' && rest.medkits > 0;
  if (canTakeMedkit) return { rest: { ...rest, medkits: rest.medkits - 1 }, item: { medkits: 1 } };
  const canTakeBottle = kind === 'bottle' && rest.bottles > 0;
  if (canTakeBottle) return { rest: { ...rest, bottles: rest.bottles - 1 }, item: { bottles: 1 } };
  const canTakeKnife = kind === 'knife' && rest.knife;
  if (canTakeKnife) return { rest: { ...rest, knife: false }, item: { knife: true } };
  return { rest: from, item: null };
}

function put(into: Loadout, item: Partial<Loadout>): Loadout {
  const next = copyOf(into);
  Object.assign(next.guns, item.guns);
  for (const weapon of WEAPON_ORDER) next.ammoBag[weapon] = (next.ammoBag[weapon] ?? 0) + (item.ammoBag?.[weapon] ?? 0);
  for (const [part, count] of Object.entries(item.parts ?? {})) next.parts[part as keyof Loadout['parts']] += count;
  for (const [kit, count] of Object.entries(item.kits ?? {})) next.kits[kit as keyof Loadout['kits']] += count;
  next.medkits += item.medkits ?? 0;
  next.bottles += item.bottles ?? 0;
  next.knife = next.knife || item.knife === true;
  return next;
}

function shift(draft: LockerDraft, key: string, from: 'locker' | 'hands', to: 'locker' | 'hands'): LockerDraft {
  const { rest, item } = take(draft[from], key);
  const isNothingTaken = item === null;
  if (isNothingTaken) return draft;
  return { ...draft, [from]: rest, [to]: put(draft[to], item) };
}

export function moveToHands(draft: LockerDraft, key: string): LockerDraft {
  return shift(draft, key, 'locker', 'hands');
}

export function moveToLocker(draft: LockerDraft, key: string): LockerDraft {
  return shift(draft, key, 'hands', 'locker');
}

/** Closing the locker puts what is in hand on the player. The caps are the server's and the store's to enforce. */
export function closeLocker(draft: LockerDraft, actions: HomeActions): void {
  actions.equip(draft.hands);
  actions.closeStation();
}

/**
 * The locker went away without Close, as when the blast door bursts and every station shuts. Hands that were
 * moved still go on the player, so nobody faces the horde with the old ones. `sent` is the draft last put on.
 */
export function lockerGone(draft: LockerDraft | null, sent: LockerDraft | null, actions: HomeActions): void {
  const unsent = draft !== null && draft !== sent;
  if (unsent) actions.equip(draft.hands);
}

// The forge

export interface ForgeView {
  readonly waiting: Jewels;
  /** 0..1 through the jewel on the forge. */
  readonly progress: number;
  readonly secondsLeft: number;
  readonly idle: boolean;
}

export function forgeView(home: HomeUi): ForgeView {
  const waiting = home.save ? { ...home.save.rawJewels } : { small: 0, large: 0 };
  const count = waiting.small + waiting.large;
  const idle = count === 0;
  const secondsLeft = idle ? 0 : (count - home.forgeProgress) * SMELT_SECONDS;
  return { waiting, progress: home.forgeProgress, secondsLeft, idle };
}

// The garage map

export type GarageState = 'replay' | 'frontier' | 'locked';

export interface GarageLevel {
  readonly number: number;
  readonly title: string;
  readonly state: GarageState;
  readonly picked: boolean;
  readonly selectable: boolean;
}

function garageState(number: number, reach: number): GarageState {
  const isWithinReach = number < reach;
  if (isWithinReach) return 'replay';
  return number === reach ? 'frontier' : 'locked';
}

/** Every level up to the room's highest can be picked, and all but the highest are replays. */
export function garageLevels(home: HomeUi): readonly GarageLevel[] {
  const reach = Math.min(home.roomHighest, FINAL_LEVEL);
  return LEVELS.map((level) => {
    const state = garageState(level.number, reach);
    return { number: level.number, title: level.title, state, picked: home.pickedLevel === level.number, selectable: state !== 'locked' };
  });
}

// The death summary

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

export const LOCKER_HELD = 'The locker held';

/** The heading: a trip names its level, the overrun says who fell. */
export function deathHeading(death: HomeDeath): string {
  if (death.overrun) return death.overrun.bunkerFell ? 'The bunker fell' : 'You fell holding the bunker';
  return `You died on level ${death.receipt.level}`;
}

export function deathNote(death: HomeDeath): string {
  return death.overrun ? 'You stand up in the bunker again. Lost:' : 'You wake in the bunker with what was stored. Lost:';
}

/** In the bunker only the gear in hand goes, and the line after it says the rest did not. */
function overrunLost(lost: Loadout): readonly string[] {
  const gear = loadoutRows(lost).map(gearLine);
  return [...(gear.length > 0 ? gear : ['Nothing was in your hands']), LOCKER_HELD];
}

export function deathSummary(death: HomeDeath): readonly string[] {
  if (death.overrun) return overrunLost(death.lost);
  const { receipt, lost } = death;
  const lines: string[] = [];
  const hasSilver = receipt.silver > 0;
  if (hasSilver) lines.push(coinText(receipt.silver));
  lines.push(...jewelLines(receipt.jewels));
  for (const row of loadoutRows(lost)) lines.push(gearLine(row));
  return lines.length > 0 ? lines : ['Nothing was lost'];
}

/** Each size of jewel counted, leaving out a size there is none of. */
function jewelCounts(jewels: Jewels): string[] {
  const counts: string[] = [];
  const hasSmallJewels = jewels.small > 0;
  if (hasSmallJewels) counts.push(plural(jewels.small, 'small jewel'));
  const hasLargeJewels = jewels.large > 0;
  if (hasLargeJewels) counts.push(plural(jewels.large, 'large jewel'));
  return counts;
}

/** Each size of jewel counted, then what they come to at the forge in gold and silver. Nothing when there are none. */
export function jewelLines(jewels: Jewels): string[] {
  const worth = jewelWorth(jewels);
  const hasWorth = worth > 0;
  return hasWorth ? [...jewelCounts(jewels), `${coinText(worth)} once smelted`] : [];
}

/** The HUD's jewels in hand: what they come to at the forge first, then each size counted. */
export function carriedLines({ jewels, worth }: HomeUi['carried']): { readonly worth: string; readonly counts: readonly string[] } {
  const carrying = worth > 0;
  return { worth: carrying ? `${coinText(worth)} in jewels` : 'No jewels', counts: jewelCounts(jewels) };
}

const UNIT_ROWS = /^(gun:|knife)/;
const COUNTED_NOUNS: Readonly<Record<string, readonly [string, string]>> = {
  medkit: ['medkit', 'medkits'],
  bottle: ['bottle', 'bottles'],
};

/** A gun or the knife is named; a stack is counted. */
function gearLine(row: LockerRow): string {
  const isUnitRow = UNIT_ROWS.test(row.key);
  if (isUnitRow) return row.label;
  const noun = COUNTED_NOUNS[row.key];
  if (noun) return `${row.count} ${row.count === 1 ? noun[0] : noun[1]}`;
  return `${row.count} ${row.label.toLowerCase()}`;
}

// The reward chest

export const CHEST_HEADING = 'The chest held';
export const CHEST_NOTE = 'The gear is in your locker. The silver and jewels are in the bank.';

/** What the chest held: silver, jewels, then each piece of gear. */
export function chestLines(chest: ChestOpened): readonly string[] {
  const lines: string[] = [];
  const hasSilver = chest.silver > 0;
  if (hasSilver) lines.push(`${chest.silver} silver`);
  lines.push(...jewelCounts(chest.jewels));
  for (const row of loadoutRows(chest.gear)) lines.push(gearLine(row));
  return lines;
}

// Pause, cursor and setup

/** Quitting mid-trip counts as dying, so the pause menu says so first. */
export function leaveWarning(home: HomeUi | null): string | null {
  return home !== null && !home.inBunker ? LEAVE_WARNING : null;
}

export interface AimState {
  readonly screen: string;
  readonly paused: boolean;
  readonly mapOpen: boolean;
  readonly bench: boolean;
  readonly home: HomeUi | null;
}

/** The crosshair stands in for the cursor, except where a station screen or the death summary needs the real one. */
export function aimsCursor(state: AimState): boolean {
  const { screen, paused, mapOpen, bench, home } = state;
  const stationOpen = home !== null && home.station !== null;
  const summaryOpen = home !== null && (home.death !== null || home.chest !== null);
  return screen === 'game' && !paused && !mapOpen && !bench && !stationOpen && !summaryOpen;
}

export interface SetupLevelInput {
  /** Null when the room decides (an invite link), so neither style's note is claimed. */
  readonly style: GameStyle | null;
  readonly multi: boolean;
  readonly level: number | null;
  readonly unlocked: boolean;
  readonly chosen: number | null;
}

/** The level lines under the setup page. Campaign picks the level at the garage, so it shows none of its own. */
export function setupLevelLines(input: SetupLevelInput): { readonly startLine: string | null; readonly coopNote: string | null } {
  const { style, multi, level, unlocked, chosen } = input;
  const roomDecides = style === null;
  if (roomDecides) return { startLine: null, coopNote: multi ? ROOM_DECIDES_NOTE : null };
  const isHomeStyle = playsFromHome(style);
  if (isHomeStyle) return { startLine: null, coopNote: multi ? HOME_COOP_NOTE : null };
  return {
    startLine: !multi && unlocked ? startAtLabel(level) : null,
    coopNote: multi && chosen !== null ? COOP_LEVEL_NOTE : null,
  };
}
