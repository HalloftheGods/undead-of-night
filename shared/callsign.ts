// What a player may be called on screen. The audience includes children, so a callsign goes
// through a small filter, and anything it refuses (or nothing at all) shows the survivor's name.
// There is no chat: this is the only free text one player can put in front of another.
//
// The rule: a blank or refused callsign is '' everywhere (client, packets, simulation). Nothing
// stores the survivor's name in its place; whoever draws a player works the label out from
// name + skin with `displayName` / `tagLabel`.
import { characterOf } from './characters.ts';

/** Longest callsign anywhere: the title screen's input, the room's join and every renderer. */
export const CALLSIGN_MAX_LENGTH = 12;

/** Lookalikes that read as a letter. Digits and symbols only; real letters are left alone. */
const LEET: Readonly<Record<string, string>> = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '9': 'g',
  '@': 'a', $: 's', '!': 'i', '|': 'i', '+': 't',
  // Cyrillic letters that are drawn like Latin ones.
  а: 'a', е: 'e', о: 'o', р: 'p', с: 'c', х: 'x', у: 'y', і: 'i',
};

/**
 * How a stem is matched. The name is cut into words (never joining words across spaces), and
 * a word is refused when:
 * - `inside`: it contains the stem anywhere. Only for stems no ordinary word or name contains.
 * - `whole`: it IS the stem, or the stem plus one of the listed endings. Short stems that sit
 *   inside real names (Knight, Hancock, Grape, Scunthorpe, Shiitake) must use this.
 * Words with repeated letters are also tried with the repeats collapsed ("fuuuck"), but only
 * those, so "Niger" is not mistaken for a collapsed slur.
 */
export interface FilterRule {
  readonly stem: string;
  readonly mode: 'inside' | 'whole';
  /** `whole` only: what may follow the stem. '' (the bare stem) is always included. */
  readonly endings?: readonly string[];
}

const inside = (stem: string): FilterRule => ({ stem, mode: 'inside' });
const whole = (stem: string, ...endings: string[]): FilterRule => ({ stem, mode: 'whole', endings });

/**
 * Deliberately small, and a seed rather than a complete list: stems of the worst English
 * words. A false positive only costs a player their chosen name (the survivor's shows
 * instead), so the matching errs towards refusing, within the whole-word rule above.
 * Grow it by review, never by pasting in a published list.
 */
const RULES: readonly FilterRule[] = [
  inside('fuck'), inside('bitch'), inside('pussy'), inside('whore'), inside('hitler'), inside('molest'),
  whole('shit', 's', 'y', 'ty', 'head', 'heads'),
  whole('cunt', 's', 'y'),
  whole('dick', 's', 'y', 'head', 'heads'),
  whole('cock', 's'),
  whole('slut', 's', 'ty'),
  whole('porn', 's', 'o'),
  whole('rape', 's', 'd', 'r', 'rs'),
  whole('nazi', 's'),
  whole('retard', 's', 'ed'),
  whole('pedo', 's', 'phile', 'philes'),
  whole('nigg', 'a', 'as', 'az', 'er', 'ers'),
  whole('fag', 's', 'g', 'gs', 'got', 'gots', 'gy'),
];

const squeeze = (word: string): string => word.replace(/(.)\1+/g, '$1');

/** Lowercase, width-folded, accents and control characters gone. */
function foldText(text: string): string {
  return text.normalize('NFKC').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[\p{C}]/gu, '');
}

const leetFold = (text: string): string => [...text].map((ch) => LEET[ch] ?? ch).join('');

/**
 * The words to test. Each space-separated chunk is cut at anything that is not a letter, and
 * the pieces of one chunk are also tried joined ("sh.it"); chunks are never joined to each
 * other, except a run of single letters ("f u c k"). Seen twice: with lookalikes read as
 * letters ("sh1t") and without, so a digit stuck on a word ("dick99") cuts it off instead.
 */
export function callsignWords(text: string): string[] {
  const folded = foldText(text);
  const words = new Set<string>();
  for (const view of [leetFold(folded), folded]) {
    const pieces: string[] = [];
    for (const chunk of view.split(/\s+/)) {
      const parts = chunk.split(/[^a-z]+/).filter(Boolean);
      for (const part of parts) words.add(part);
      const isCompoundChunk = parts.length > 1;
      if (isCompoundChunk) words.add(parts.join(''));
      pieces.push(...parts);
    }
    let run = '';
    for (const piece of [...pieces, '']) {
      const isSingleLetter = piece.length === 1;
      if (isSingleLetter) {
        run += piece;
        continue;
      }
      const isLetterRun = run.length > 1;
      if (isLetterRun) words.add(run);
      run = '';
    }
  }
  return [...words];
}

const trimDecoration = (word: string): string => word.replace(/^x+|x+$/g, '');

/** A filter over a rule list. Exported so the tests can drive the mechanics with harmless stems. */
export function compileFilter(rules: readonly FilterRule[]): (text: string) => boolean {
  const insideRaw = rules.filter((r) => r.mode === 'inside').map((r) => r.stem);
  const insideSqueezed = insideRaw.map(squeeze);
  const forms = rules.filter((r) => r.mode === 'whole').flatMap((r) => ['', ...(r.endings ?? [])].map((e) => r.stem + e));
  const wholeRaw = new Set(forms);
  const wholeSqueezed = new Set(forms.map(squeeze));

  const refuses = (word: string): boolean => {
    const bare = trimDecoration(word);
    const isPlainlyRefused = insideRaw.some((stem) => word.includes(stem)) || wholeRaw.has(word) || wholeRaw.has(bare);
    if (isPlainlyRefused) return true;
    const squeezed = squeeze(word);
    const isAlreadySqueezed = squeezed === word;
    if (isAlreadySqueezed) return false;
    return insideSqueezed.some((stem) => squeezed.includes(stem)) || wholeSqueezed.has(squeezed) || wholeSqueezed.has(squeeze(bare));
  };
  return (text) => callsignWords(text).some(refuses);
}

export const isBlockedCallsign: (text: string) => boolean = compileFilter(RULES);

/**
 * The callsign as typed, tidied: control characters gone, spaces collapsed, at most 12
 * characters. '' when nothing is left or the filter refuses it, so the caller picks the label.
 */
export function cleanCallsign(raw: string): string {
  const spaced = raw.replace(/[\p{C}]/gu, '').replace(/\s+/g, ' ').trim();
  const capped = [...spaced].slice(0, CALLSIGN_MAX_LENGTH).join('').trim();
  // Test the whole text as well as the capped one: a stem split by the cap is still there.
  return isBlockedCallsign(spaced) || isBlockedCallsign(capped) ? '' : capped;
}

/** The callsign cut to the cap by code point, so an emoji is never split. Not filtered: that is `cleanCallsign`. */
export function capCallsign(raw: string): string {
  return [...raw].slice(0, CALLSIGN_MAX_LENGTH).join('');
}

/** What to show for a player: their callsign if it passes, otherwise the survivor they play. */
export function displayName(raw: string, skin: number): string {
  return cleanCallsign(raw) || characterOf(skin).name;
}

/** The tag over a survivor in the world: "Ann / Night", or just "Night" when there is no callsign to add. */
export function tagLabel(raw: string, skin: number): string {
  const callsign = cleanCallsign(raw);
  const survivor = characterOf(skin).name;
  return callsign ? `${callsign} / ${survivor}` : survivor;
}

/** What a client puts in its join: public rooms carry no callsign at all. */
export function joinName(raw: string, publicRoom: boolean): string {
  return publicRoom ? '' : cleanCallsign(raw);
}
