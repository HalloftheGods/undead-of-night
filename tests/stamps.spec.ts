import { describe, expect, it } from 'vitest';
import { nightEventFor } from '../shared/night-events.ts';
import type { GameEvent } from '../shared/protocol.ts';
import { stampCards, stampTally } from '../src/game/record-book.ts';
import { loadStamps, readStamps, STAMPS, StampKeeper } from '../src/game/stamps.ts';
import type { StampBook, StampContext } from '../src/game/stamps.ts';

function memoryStore(): Pick<Storage, 'getItem' | 'setItem'> {
  const data = new Map<string, string>();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => void data.set(key, value) };
}

const TODAY = '2026-11-07';
const EMPTY: StampBook = { earned: {}, headshots: 0, spinners: 0 };
const ctx = (over: Partial<StampContext> = {}): StampContext => ({ localId: 'me', level: 1, mapSeed: 1, kills: 0, drop: null, ...over });
const kill = (killerId: string | null, chain = 1): GameEvent =>
  ({ type: 'zombie_die', zombieId: 'z', zombieType: 'walker', killerId, x: 0, y: 0, points: 10, chain }) as GameEvent;

/** A seed whose town on `level` has the given night event. */
function seedWith(event: string, level: number): number {
  for (let seed = 1; seed < 100000; seed++) if (nightEventFor(seed, level)?.id === event) return seed;
  throw new Error(`no ${event} seed`);
}

describe('stamps', () => {
  it('stamps a first kill of your own, not a teammate\'s', () => {
    expect(readStamps(EMPTY, [kill('them')], ctx(), TODAY).earned).toEqual([]);
    const { book, earned } = readStamps(EMPTY, [kill('me')], ctx(), TODAY);
    expect(earned).toEqual(['first_blood']);
    expect(book.earned.first_blood).toBe(TODAY);
  });

  it('stamps a five-kill chain as a massacre', () => {
    expect(readStamps(EMPTY, [kill('me', 4)], ctx(), TODAY).earned).not.toContain('massacre');
    expect(readStamps(EMPTY, [kill('me', 5)], ctx(), TODAY).earned).toContain('massacre');
  });

  it('counts headshots across runs to fifty', () => {
    const headshot = { type: 'headshot', playerId: 'me' } as GameEvent;
    let book: StampBook = { ...EMPTY, headshots: 48 };
    book = readStamps(book, [headshot], ctx(), TODAY).book;
    expect(book.earned.headhunter).toBeUndefined();
    const second = readStamps(book, [headshot], ctx(), TODAY);
    expect(second.earned).toEqual(['headhunter']);
    expect(second.book.headshots).toBe(50);
  });

  it('never stamps the same stamp twice, and keeps the first day', () => {
    const book: StampBook = { ...EMPTY, earned: { first_blood: '2026-10-31' } };
    const next = readStamps(book, [kill('me')], ctx(), TODAY);
    expect(next.earned).toEqual([]);
    expect(next.book.earned.first_blood).toBe('2026-10-31');
  });

  it('tells a grab from a supply drop from any other pickup', () => {
    const pickup = { type: 'pickup', playerId: 'me', x: 100, y: 100 } as GameEvent;
    expect(readStamps(EMPTY, [pickup], ctx({ drop: { x: 400, y: 400 } }), TODAY).earned).toEqual([]);
    expect(readStamps(EMPTY, [pickup], ctx({ drop: { x: 110, y: 90 } }), TODAY).earned).toEqual(['special_delivery']);
  });

  it('stamps bosses, a blood moon horde, a foggy town, level 5 and the win', () => {
    const boss = { type: 'boss_down', boss: 'mother', x: 0, y: 0 } as GameEvent;
    expect(readStamps(EMPTY, [boss], ctx(), TODAY).earned).toEqual(['mother_down']);
    const moon = seedWith('blood_moon', 4);
    expect(readStamps(EMPTY, [{ type: 'wave_clear' } as GameEvent], ctx({ level: 4, mapSeed: moon }), TODAY).earned).toEqual(['blood_moon']);
    const fog = seedWith('fog', 4);
    expect(readStamps(EMPTY, [{ type: 'level_complete', level: 4 } as GameEvent], ctx({ level: 4, mapSeed: fog }), TODAY).earned).toEqual(['into_the_fog']);
    expect(readStamps(EMPTY, [{ type: 'level_start', level: 5 }], ctx({ level: 5 }), TODAY).earned).toEqual(['halfway']);
    const won = { type: 'game_over', stats: { outcome: 'victory' } } as GameEvent;
    expect(readStamps(EMPTY, [won], ctx(), TODAY).earned).toEqual(['last_stop']);
  });

  it('stamps a hundred kills in a run', () => {
    expect(readStamps(EMPTY, [], ctx({ kills: 100 }), TODAY).earned).toEqual(['crowd_control']);
  });

  it('keeps the book on the device, and a stamp given outright is kept beside the rest', () => {
    const store = memoryStore();
    const keeper = new StampKeeper(store);
    expect(keeper.read([kill('me')], ctx(), TODAY)).toEqual(['first_blood']);
    expect(keeper.give(['daily_bread', 'daily_bread'], TODAY)).toEqual(['daily_bread']);
    expect(keeper.give(['daily_bread'], TODAY)).toEqual([]);
    expect(Object.keys(loadStamps(store).earned).sort()).toEqual(['daily_bread', 'first_blood']);
  });

  it('drops anything in storage that is not a stamp', () => {
    const store = memoryStore();
    store.setItem('outbreak.stamps', JSON.stringify({ earned: { first_blood: TODAY, made_up: TODAY, halfway: 3 }, headshots: 'x' }));
    expect(loadStamps(store)).toEqual({ earned: { first_blood: TODAY }, headshots: 0, spinners: 0 });
  });

  it('lays every stamp across the two stamp leaves, dated once earned', () => {
    const book: StampBook = { ...EMPTY, earned: { first_blood: TODAY } };
    const cards = [...stampCards(book, 'stamps'), ...stampCards(book, 'more_stamps')];
    expect(cards.map((card) => card.id)).toEqual(STAMPS.map((stamp) => stamp.id));
    expect(cards[0].earned).toBe('7 Nov');
    expect(cards[1].earned).toBeNull();
    expect(stampTally(book)).toBe(`1 of ${STAMPS.length} stamped`);
  });
});
