import { describe, expect, it } from 'vitest';
import { FloatingTexts, type TextLine } from '../src/engine/floating-texts.ts';
import { FONT_HEIGHT, textWidth } from '../src/engine/bitmap-font.ts';

const GOLD = '#d8c89a';
const RED = '#ff5a3c';

function clashes(a: TextLine, b: TextLine): boolean {
  const apart = Math.abs(a.x - b.x) >= (textWidth(a.text) + textWidth(b.text)) / 2;
  const height = FONT_HEIGHT + 2;
  return !apart && a.top < b.top + height && b.top < a.top + height;
}

function settle(texts: FloatingTexts, seconds: number): void {
  for (let t = 0; t < seconds; t += 1 / 60) texts.update(1 / 60);
}

describe('floating texts', () => {
  it('sums a repeated "+N" note into one line', () => {
    const texts = new FloatingTexts();
    texts.add('+4 SHELLS', 100, 100, GOLD);
    texts.update(0.1);
    texts.add('+4 SHELLS', 102, 100, GOLD);
    expect(texts.lines().map((line) => line.text)).toEqual(['+8 SHELLS']);
  });

  it('counts a repeated word', () => {
    const texts = new FloatingTexts();
    texts.add('CLATTER', 50, 50, RED);
    texts.add('CLATTER', 50, 50, RED);
    texts.add('CLATTER', 50, 50, RED);
    expect(texts.lines().map((line) => line.text)).toEqual(['CLATTER x3']);
  });

  it('keeps notes apart that are far away, late, or different', () => {
    const texts = new FloatingTexts();
    texts.add('+4 SHELLS', 0, 0, GOLD);
    texts.add('+4 SHELLS', 400, 0, GOLD);
    texts.add('+25 HEALTH', 0, 0, GOLD);
    texts.add('+50', 0, 0, RED);
    expect(texts.size).toBe(4);
    const late = new FloatingTexts();
    late.add('SHELLS', 0, 0, GOLD);
    late.update(0.8);
    late.add('SHELLS', 0, 0, GOLD);
    expect(late.size).toBe(2);
  });

  it('stacks different notes at the same spot so none overlap', () => {
    const texts = new FloatingTexts();
    texts.add('+12 PISTOL AMMO', 100, 100, GOLD);
    texts.add('+25 HEALTH', 100, 100, GOLD);
    texts.add('KNIFE', 101, 100, GOLD);
    texts.add('+1 MEDKIT', 99, 101, GOLD);
    settle(texts, 0.3);
    const lines = texts.lines();
    expect(lines).toHaveLength(4);
    for (let i = 0; i < lines.length; i += 1) {
      for (let j = i + 1; j < lines.length; j += 1) expect(clashes(lines[i], lines[j])).toBe(false);
    }
    // Newest stays lowest, nearest the player; older ones sit above it.
    const tops = lines.map((line) => line.top);
    expect([...tops].sort((a, b) => a - b)).toEqual(tops);
  });

  it('leaves side-by-side notes where they are', () => {
    const texts = new FloatingTexts();
    texts.add('BANDAGE', 0, 100, GOLD);
    texts.add('KNIFE', 200, 100, GOLD);
    settle(texts, 0.2);
    const [a, b] = texts.lines();
    expect(a.top).toBe(b.top);
  });

  it('fades out and goes away', () => {
    const texts = new FloatingTexts();
    texts.add('SHELLS', 0, 0, GOLD);
    settle(texts, 1);
    expect(texts.lines()[0].alpha).toBeLessThan(1);
    settle(texts, 0.3);
    expect(texts.size).toBe(0);
  });
});
