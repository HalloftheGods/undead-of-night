/**
 * The only events and parameters analytics may send. A value that is not on its list is dropped,
 * so free text (a callsign, an address, a chat line) can never ride along by accident.
 */
import { CHARACTERS } from '../../../shared/characters.ts';
import { DIFFICULTIES } from '../../../shared/difficulty.ts';
import { EFFECT_ORDER } from '../../../shared/round-effect-data.ts';
import { FPS_BANDS, SCORE_BANDS } from './bands.ts';

export const EVENT_NAMES = [
  'title_view',
  'how_to_play_open',
  'play_setup_open',
  'run_start',
  'level_start',
  'level_complete',
  'run_end',
  'workbench_use',
  'gun_effect_fit',
  'radio_found',
  'sound_test_open',
  'invite_opened',
  'coop_join',
  'install_prompt',
  'app_installed',
  'perf_summary',
  'game_error',
] as const;
export type EventName = (typeof EVENT_NAMES)[number];

/** A value must be one of these exact strings. */
interface OneOf {
  readonly kind: 'one_of';
  readonly values: readonly string[];
}

/** A whole number, rounded and held inside the range. */
interface Whole {
  readonly kind: 'whole';
  readonly max: number;
}

type Rule = OneOf | Whole;

const oneOf = (values: readonly string[]): OneOf => ({ kind: 'one_of', values });
const whole = (max: number): Whole => ({ kind: 'whole', max });

export const ERROR_TYPES = ['Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError', 'promise', 'other'] as const;

const SURVIVOR = oneOf(CHARACTERS.map((each) => each.id));
const DIFFICULTY = oneOf(DIFFICULTIES.map((each) => each.id));
const LEVEL = whole(99);

const RUN_RESULTS = ['victory', 'defeat', 'quit', 'disconnected'] as const;
export type RunResultName = (typeof RUN_RESULTS)[number];

export const KILLER_TYPES = ['walker', 'runner', 'bloater', 'brute', 'screamer', 'unknown'] as const;
const KILLER = oneOf(KILLER_TYPES);

const RULES: Readonly<Record<EventName, Readonly<Record<string, Rule>>>> = {
  title_view: {},
  how_to_play_open: {},
  play_setup_open: {},
  run_start: {
    survivor: SURVIVOR,
    difficulty: DIFFICULTY,
    mode: oneOf(['solo', 'coop']),
    start_level: LEVEL,
    input: oneOf(['touch', 'mouse']),
    orientation: oneOf(['landscape', 'portrait']),
  },
  level_start: { level: LEVEL, difficulty: DIFFICULTY, survivor: SURVIVOR },
  level_complete: {
    level: LEVEL,
    seconds: whole(86400),
    downs: whole(999),
    ammo_left: whole(9999),
    shots_fired: whole(99999),
    dry_fires: whole(9999),
    kills: whole(99999),
    headshots: whole(9999),
    damage_taken: whole(99999),
    containers_searched: whole(999),
    difficulty: DIFFICULTY,
    survivor: SURVIVOR,
  },
  run_end: {
    result: oneOf(RUN_RESULTS),
    level_reached: LEVEL,
    seconds: whole(86400),
    score_band: oneOf(SCORE_BANDS),
    kills: whole(99999),
    headshots: whole(9999),
    damage_taken: whole(99999),
    containers_searched: whole(999),
    killer_type: KILLER,
    difficulty: DIFFICULTY,
    survivor: SURVIVOR,
  },
  workbench_use: { level: LEVEL },
  gun_effect_fit: { effect: oneOf(EFFECT_ORDER) },
  radio_found: { level: LEVEL },
  sound_test_open: {},
  invite_opened: {},
  coop_join: {},
  install_prompt: { source: oneOf(['native', 'guide']) },
  app_installed: {},
  perf_summary: { fps_band: oneOf(FPS_BANDS), device_class: oneOf(['touch', 'desktop']) },
  game_error: { error_type: oneOf(ERROR_TYPES) },
};

export type EventParams = Readonly<Record<string, string | number>>;

export function isEventName(name: unknown): name is EventName {
  return EVENT_NAMES.includes(name as EventName);
}

function allowedValue(rule: Rule, value: unknown): string | number | null {
  const isListType = rule.kind === 'one_of';
  const isListed = typeof value === 'string' && isListType && rule.values.includes(value);
  const isCount = typeof value === 'number' && Number.isFinite(value) && !isListType;
  if (isListed) return value;
  return isCount ? Math.min(rule.max, Math.max(0, Math.round(value))) : null;
}

/** The parameters that are on the event's list with a listed value, or null if the event itself is not allowed. */
export function allowedParams(name: string, raw: Readonly<Record<string, unknown>>): EventParams | null {
  const isAllowedEvent = isEventName(name);
  if (!isAllowedEvent) return null;
  const rules = RULES[name];
  const kept: Record<string, string | number> = {};
  for (const [param, rule] of Object.entries(rules)) {
    const value = allowedValue(rule, raw[param]);
    const isKeptParam = value !== null;
    if (isKeptParam) kept[param] = value;
  }
  return kept;
}
