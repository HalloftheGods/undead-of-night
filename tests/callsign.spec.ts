import { describe, expect, it } from 'vitest';
import { CHARACTERS } from '../shared/characters.ts';
import { parseClientPacket } from '../shared/room/client-packets.ts';
import { GameSimulation } from '../shared/simulation.ts';
import {
  CALLSIGN_MAX_LENGTH,
  callsignWords,
  capCallsign,
  cleanCallsign,
  compileFilter,
  displayName,
  isBlockedCallsign,
  joinName,
  tagLabel,
} from '../shared/callsign.ts';

// Names that must never be refused. Most of them held a blocked stem as a substring once.
const SURVIVORS = ['Night', 'Bandus', 'Kat', 'Rex', 'Sol'];
const HELD_A_STEM = [
  'Nigel', 'Knight', 'Midnight', 'Nightingale', 'Dickens', 'Dickson', 'Hancock', 'Peacock', 'Cocktail', 'Grape', 'Drapes',
  'Torpedo', 'Nazir', 'Pornchai', 'Scunthorpe', 'Yoshitaka', 'Fagan', 'Shiitake', 'Niger', 'Nigeria', 'Hitchcock', 'Mitchell',
  'Bullock', 'Wilcock', 'Essex', 'Analyst', 'Therapist', 'Cassidy',
];
const ACROSS_WORDS = ['Josh Itzel', 'Ash It', 'Mo Lester', 'Ann Alyst', 'Pat Ernazi'];
const FIRST_NAMES = [
  'Ann', 'Zoë', 'Wei', 'Li', 'Mohammed', 'Fatima', 'Yuki', 'Haruto', 'Sakura', 'Giovanni', 'Matteo', 'Chiara', 'Sofía', 'José',
  'Müller', 'Søren', 'Łukasz', 'Dmitri', 'Svetlana', 'Priya', 'Rajesh', 'Aarav', 'Olga', 'Ivan', 'Hans', 'Pierre', 'Amélie',
  'Carlos', 'Lucía', 'Ahmed', 'Omar', 'Layla', 'Kwame', 'Chinedu', 'Nguyen', 'Min-jun', 'Seo-yeon', 'Hiroshi', 'Takashi',
  'Ingrid', 'Björn', 'Niamh', 'Siobhan', 'Dwayne', 'Cassandra', 'Scott', 'Tiffany', 'Дмитрий', '李雷', '🧟 Runner',
];

describe('callsign filter: names that must stay', () => {
  it.each([...SURVIVORS, ...HELD_A_STEM, ...ACROSS_WORDS, ...FIRST_NAMES])('keeps %s', (name) => {
    expect(isBlockedCallsign(name), name).toBe(false);
    expect(cleanCallsign(name), name).toBe(name);
  });

  it('keeps ordinary names, accents and emoji', () => {
    for (const name of ['Ann', 'Zoë', 'Mr. Bones', 'Scout 7', '🧟 Runner']) {
      expect(isBlockedCallsign(name)).toBe(false);
      expect(cleanCallsign(name)).toBe(name);
    }
  });

  it('shows all five survivor names as themselves', () => {
    expect(SURVIVORS).toEqual(CHARACTERS.map((c) => c.name));
    for (const [skin, name] of SURVIVORS.entries()) expect(displayName(name, skin)).toBe(name);
  });
});

describe('callsign filter: real stems', () => {
  it('refuses masked blocked words', () => {
    for (const masked of ['sh1t', 'F u c k', 'fuuuck', 'b!tch', 'ｃｕｎｔ', 'nаzi', 'xXh1tl3rXx', 'dick99', 'xXdickXx', 'sh.it', 'shiiit']) {
      expect(isBlockedCallsign(masked), masked).toBe(true);
      expect(cleanCallsign(masked), masked).toBe('');
    }
  });

  it('refuses a short stem that is a whole word, with its plain endings, and one stuck on a name', () => {
    for (const name of ['Dick', 'dicks', 'Cock', 'Ann Rape', 'Rapes', 'Pedo', 'Porn', 'cuntt', 'Slutty', 'Retarded', 'Mr Fuckwit', 'Ann Hitlerson']) {
      expect(isBlockedCallsign(name), name).toBe(true);
    }
  });

  it('a stem split by the 12 character cap is still seen', () => {
    expect(cleanCallsign(`${'x'.repeat(10)}fuck`)).toBe('');
  });
});

describe('callsign filter: mechanics, with harmless stems', () => {
  const isRefused = compileFilter([
    { stem: 'zorp', mode: 'inside' },
    { stem: 'blub', mode: 'whole', endings: ['s', 'ber'] },
    { stem: 'niggle', mode: 'whole' },
  ]);

  it('matches an inside stem anywhere in a word', () => {
    expect(isRefused('zorp')).toBe(true);
    expect(isRefused('Mr Zorpington')).toBe(true);
    expect(isRefused('aazorpaa')).toBe(true);
    expect(isRefused('Zorn')).toBe(false);
  });

  it('matches a whole stem only as a word, or the word with a listed ending', () => {
    for (const refused of ['blub', 'Blubs', 'blubber', 'Ann Blub', 'xXblubXx']) expect(isRefused(refused), refused).toBe(true);
    for (const kept of ['Blubird', 'Sublub', 'Blubbing', 'Reblub']) expect(isRefused(kept), kept).toBe(false);
  });

  it('folds lookalikes, case, width, accents and cyrillic', () => {
    for (const masked of ['z0rp', 'Z0RP', 'ｚｏｒｐ', 'zórp', 'zоrp', 'blu8']) expect(isRefused(masked), masked).toBe(true);
  });

  it('sees through separators and spaced-out letters', () => {
    for (const masked of ['z.o.r.p', 'z_o-r p', 'z o r p', 'bl.ub', 'b l u b']) expect(isRefused(masked), masked).toBe(true);
  });

  it('collapses repeats, but only on words that have some', () => {
    expect(isRefused('zzzorp')).toBe(true);
    expect(isRefused('bluuub')).toBe(true);
    expect(isRefused('blubbb')).toBe(true);
    expect(isRefused('niggle')).toBe(true);
    // 'nigle' only ever meets the stem by dropping letters, which a word without repeats never does.
    expect(isRefused('nigle')).toBe(false);
  });

  it('never joins words across spaces, except a run of single letters', () => {
    expect(isRefused('Bl ub')).toBe(false);
    expect(isRefused('Zo rp')).toBe(false);
    expect(isRefused('Sub Lub')).toBe(false);
    expect(isRefused('Ann Z O R P')).toBe(true);
  });

  it('exposes the words it tests', () => {
    expect(callsignWords('Mo Lester')).toEqual(expect.arrayContaining(['mo', 'lester']));
    expect(callsignWords('Mo Lester')).not.toContain('molester');
    expect(callsignWords('F.U_C-K')).toContain('fuck');
  });
});

describe('callsign cap, cleaning and fallbacks', () => {
  it('caps at 12 characters and counts emoji as one', () => {
    expect(CALLSIGN_MAX_LENGTH).toBe(12);
    expect(cleanCallsign('x'.repeat(40))).toBe('x'.repeat(12));
    expect([...cleanCallsign('🧟'.repeat(20))].length).toBe(12);
    expect([...capCallsign('🧟'.repeat(20))]).toHaveLength(12);
    expect(capCallsign('🧟'.repeat(20))).toBe('🧟'.repeat(12));
    expect(capCallsign('Ann')).toBe('Ann');
  });

  it('strips control characters and collapses spaces', () => {
    expect(cleanCallsign('  Ann\u0000 \n Lee  ')).toBe('Ann Lee');
    expect(cleanCallsign('\u0007\u0008')).toBe('');
  });

  it('falls back to the survivor name when blank or blocked', () => {
    expect(displayName('', 2)).toBe(CHARACTERS[2].name);
    expect(displayName('sh1t', 3)).toBe(CHARACTERS[3].name);
    expect(displayName('Ann', 3)).toBe('Ann');
    expect(displayName('', 99)).toBe(CHARACTERS[0].name);
  });

  it('labels a tag with the callsign and the survivor, or the survivor alone', () => {
    expect(tagLabel('Ann', 1)).toBe(`Ann / ${CHARACTERS[1].name}`);
    expect(tagLabel('', 1)).toBe(CHARACTERS[1].name);
    expect(tagLabel('sh1t', 0)).toBe(CHARACTERS[0].name);
  });

  it('a join keeps a clean callsign, blanks a refused one, and the sim stores blanks as blanks', () => {
    const join = (name: string) => parseClientPacket(JSON.stringify({ type: 'join', name, token: 't1' }));
    expect(join('Ann')).toMatchObject({ name: 'Ann' });
    expect(join('sh1t')).toMatchObject({ name: '' });
    expect(join('Knight')).toMatchObject({ name: 'Knight' });
    expect(join('x'.repeat(30))).toMatchObject({ name: 'x'.repeat(12) });
    const sim = new GameSimulation({ seed: 7 });
    const a = sim.addPlayer('a', '', 'ta', 1);
    const b = sim.addPlayer('b', 'Bea', 'tb', 1);
    // The room stores what it was told; the label is worked out where it is drawn.
    expect([a.name, b.name]).toEqual(['', 'Bea']);
    expect([tagLabel(a.name, a.skin), displayName(a.name, a.skin)]).toEqual([CHARACTERS[1].name, CHARACTERS[1].name]);
  });

  it('sends no callsign to a public room', () => {
    expect(joinName('Ann', true)).toBe('');
    expect(joinName('Ann', false)).toBe('Ann');
    expect(joinName('sh1t', false)).toBe('');
    expect(joinName('Knight', false)).toBe('Knight');
  });
});
