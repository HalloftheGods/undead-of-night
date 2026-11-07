import type { EntityId, GameEvent } from '../../shared/protocol.ts';
import { formatDuration } from './hud-state.ts';
import type { Banner, LevelCard } from './hud-state.ts';
import type { CalloutTone, CalloutWords } from './kill-juice.ts';

/** Which tab of the full log a line sits under. */
export type LogKind = 'fight' | 'loot' | 'night' | 'team';
export type LogFilter = LogKind | 'all';
/** Coloured as the toast it copies: banner tones, callout tones, or plain for the small stuff. */
export type LogTone = Banner['tone'] | CalloutTone | 'plain';

/** One line of the run's log: what the screen said, and when. */
export interface LogEntry {
  /** Changes whenever the line does, so a repeat replays its entrance. */
  readonly key: number;
  /** The run's clock when it last happened, as "3:07". */
  readonly at: string;
  readonly text: string;
  readonly detail: string;
  readonly tone: LogTone;
  readonly kind: LogKind;
  /** How many times in a row it happened; shown as "×3" past one. */
  readonly count: number;
}

export interface LogLine {
  readonly text: string;
  readonly detail?: string;
  readonly tone: LogTone;
  readonly kind: LogKind;
}

export const LOG_FILTERS: readonly { readonly id: LogFilter; readonly label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'fight', label: 'Fights' },
  { id: 'loot', label: 'Loot' },
  { id: 'night', label: 'Night' },
  { id: 'team', label: 'Team' },
];

/** The oldest lines fall off past this, which is still a long night's reading. */
const LOG_CAP = 200;
/** The same words again inside this window add to the last line instead of a new one. */
const REPEAT_MS = 8000;

/** Fights are the ones over the action; the rest of the banners are the night's own news. */
const FIGHT_BANNERS: ReadonlySet<string> = new Set(['HORDE WIPED OUT', 'BOSS DOWN']);

export function bannerLine(banner: Omit<Banner, 'key'>): LogLine {
  const fight = FIGHT_BANNERS.has(banner.title) || banner.title.startsWith('HORDE ');
  return { text: banner.title, detail: banner.subtitle, tone: banner.tone, kind: fight ? 'fight' : 'night' };
}

export function calloutLine(words: CalloutWords): LogLine {
  return { text: words.text, tone: words.tone, kind: words.tone === 'stamp' ? 'night' : 'fight' };
}

/** The title card's news, a line each: the town, then its weather, night event and boss. */
export function levelLines(card: Omit<LevelCard, 'key'>): readonly LogLine[] {
  const town: LogLine = { text: card.title.toUpperCase(), detail: `${card.heading.toUpperCase()}. ${card.goal.toUpperCase()}`, tone: 'quiet', kind: 'night' };
  const extras = [card.rule, card.event, card.boss].filter((said): said is string => Boolean(said));
  return [town, ...extras.map((said): LogLine => ({ text: said.toUpperCase(), tone: card.boss === said ? 'danger' : 'plain', kind: 'night' }))];
}

/** What a log needs to word a player's event: who is who. */
export interface LogContext {
  readonly localId: EntityId | null;
  readonly nameOf: (id: EntityId) => string | null;
  /** What the pickup gave, worded as the floating note says it. */
  readonly pickupNote?: string;
}

type LineFor<T extends GameEvent['type']> = (event: Extract<GameEvent, { type: T }>, ctx: LogContext) => LogLine | null;

/** The events no banner or callout covers: your pickups, a teammate in trouble, a car alarm. */
const EVENT_LINES: { readonly [T in GameEvent['type']]?: LineFor<T> } = {
  pickup: (event, ctx) => (event.playerId === ctx.localId && ctx.pickupNote ? { text: ctx.pickupNote, tone: 'plain', kind: 'loot' } : null),
  player_downed: (event, ctx) => teamLine(event.playerId, ctx, 'IS DOWN', 'YOU ARE DOWN', 'danger'),
  player_revived: (event, ctx) => teamLine(event.playerId, ctx, 'IS BACK UP', 'YOU ARE BACK UP', 'hope'),
  player_dead: (event, ctx) => teamLine(event.playerId, ctx, 'DIED', 'YOU DIED', 'danger'),
  car_alarm: () => ({ text: 'A CAR ALARM', detail: 'THEY HEARD THAT', tone: 'danger', kind: 'night' }),
  drop_landed: () => ({ text: 'THE DROP IS DOWN', detail: 'SUPPLIES ON THE GROUND', tone: 'hope', kind: 'loot' }),
};

export function eventLine(event: GameEvent, ctx: LogContext): LogLine | null {
  const line = EVENT_LINES[event.type] as LineFor<GameEvent['type']> | undefined;
  return line ? line(event as never, ctx) : null;
}

function teamLine(id: EntityId, ctx: LogContext, said: string, saidOfYou: string, tone: LogTone): LogLine | null {
  const isAboutYou = id === ctx.localId;
  if (isAboutYou) return { text: saidOfYou, tone, kind: 'team' };
  const name = ctx.nameOf(id);
  return name ? { text: `${name.toUpperCase()} ${said}`, tone, kind: 'team' } : null;
}

export function filterLog(entries: readonly LogEntry[], filter: LogFilter): readonly LogEntry[] {
  return filter === 'all' ? entries : entries.filter((entry) => entry.kind === filter);
}

/** Everything the screen said this run, oldest first, so it can be read after the toast has gone. */
export class EventLog {
  private lines: LogEntry[] = [];
  private nextKey = 0;
  private startMs: number | null = null;
  private lastMs = 0;

  reset(): void {
    this.lines = [];
    this.startMs = null;
  }

  get entries(): readonly LogEntry[] {
    return this.lines;
  }

  /** Adds the line, or counts it again on the last line if it just said the same. Returns the new list. */
  add(line: LogLine, now: number): readonly LogEntry[] {
    this.startMs ??= now;
    const at = formatDuration((now - this.startMs) / 1000);
    const detail = line.detail ?? '';
    const last = this.lines.at(-1);
    const repeat = last !== undefined && last.text === line.text && last.detail === detail && now - this.lastMs <= REPEAT_MS;
    this.lastMs = now;
    this.nextKey += 1;
    const entry: LogEntry = { key: this.nextKey, at, text: line.text, detail, tone: line.tone, kind: line.kind, count: repeat ? last.count + 1 : 1 };
    const kept = repeat ? this.lines.slice(0, -1) : this.lines;
    this.lines = [...kept, entry].slice(-LOG_CAP);
    return this.lines;
  }
}
