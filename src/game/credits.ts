/** The end credits, top to bottom. Names are the game's own cast and makers. */
export type CreditKind = 'title' | 'studio' | 'role' | 'name' | 'thanks';

export interface CreditLine {
  readonly kind: CreditKind;
  readonly text: string;
}

export const CAST: readonly string[] = ['Night', 'Bear', 'Kat', 'Rex', 'Rich'];

export const CREDITS: readonly CreditLine[] = [
  { kind: 'title', text: 'Undead of Night: Last Round' },
  { kind: 'studio', text: 'Hall of the Gods, Inc.' },
  { kind: 'role', text: 'Music by' },
  { kind: 'name', text: 'Majora D.' },
  { kind: 'role', text: 'Starring' },
  ...CAST.map((text): CreditLine => ({ kind: 'name', text })),
  { kind: 'thanks', text: 'Thanks for surviving the night' },
];

/** Seconds a line takes to cross the screen, so a longer roll runs longer and no faster. */
export const SECONDS_PER_LINE = 2.4;
/** The empty screen the roll starts and ends on. */
export const LEAD_SECONDS = 6;

export function creditsSeconds(lines: readonly CreditLine[] = CREDITS): number {
  return LEAD_SECONDS + lines.length * SECONDS_PER_LINE;
}