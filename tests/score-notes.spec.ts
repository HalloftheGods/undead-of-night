import { describe, expect, it } from 'vitest';
import { headshotNote, killNote } from '../src/engine/score-notes.ts';

const die = (points: number, chain: number, chainPaid?: boolean) =>
  ({ type: 'zombie_die', zombieId: 'z', zombieType: 'walker', x: 0, y: 0, angle: 0, killerId: 'me', points, chain, ...(chainPaid === undefined ? {} : { chainPaid }) }) as const;
const head = (points: number, chain: number) =>
  ({ type: 'headshot', playerId: 'me', zombieId: 'z', zombieType: 'walker', x: 0, y: 0, angle: 0, points, chain }) as const;

describe('score notes', () => {
  it('names the chain only when it changed the points', () => {
    expect(killNote(die(2, 3, true))).toBe('+2 XP x1.5');
    expect(killNote(die(1, 2, false))).toBe('+1 XP');
    expect(killNote(die(12, 1))).toBe('+12 XP');
  });

  it('shows a headshot bonus only when the shot paid, and the streak past the first', () => {
    expect(headshotNote(head(0, 1))).toBe('HEADSHOT');
    expect(headshotNote(head(0, 4))).toBe('HEADSHOT x4');
    expect(headshotNote(head(3, 1))).toBe('HEADSHOT +3 XP');
    expect(headshotNote(head(3, 4))).toBe('HEADSHOT +3 XP x4');
  });
});
