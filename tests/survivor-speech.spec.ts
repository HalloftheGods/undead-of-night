import { afterEach, describe, expect, it } from 'vitest';
import { bagLines } from '../src/game/inventory/bag-notes.ts';
import { VOICES } from '../src/game/inventory/survivor-voices.ts';
import { hush, PICKUP_QUIET_MS, speak, SPEECH_MS, speechNow } from '../src/game/survivor-speech.ts';

describe('the survivor talking about what they pick up and drop', () => {
  afterEach(hush);

  it('says a pickup line in their own voice, for a while', () => {
    expect(speak('pickup', 1000)).toBe(true);
    const said = speechNow(1, 1000);
    expect(said?.kind).toBe('pickup');
    expect(VOICES[1].pickup).toContain(said?.line);
    expect(speechNow(1, 1000 + SPEECH_MS)).toBeNull();
  });

  it('keeps quiet about a pickup straight after the last line, but always speaks on a drop', () => {
    speak('pickup', 1000);
    expect(speak('pickup', 1000 + PICKUP_QUIET_MS - 1)).toBe(false);
    expect(speak('drop', 1001)).toBe(true);
    expect(speechNow(0, 1001)?.kind).toBe('drop');
    expect(speak('pickup', 1001 + PICKUP_QUIET_MS)).toBe(true);
  });

  it('does not say the same line twice in a row', () => {
    speak('drop', 0);
    const first = speechNow(2, 0)?.line;
    speak('drop', 10);
    expect(speechNow(2, 10)?.line).not.toBe(first);
  });
});

describe('the log lines for what the inventory did', () => {
  it('logs drops, uses and takes from a container', () => {
    const lines = bagLines({
      layout: [],
      drop: [{ type: 'plank', count: 2 }],
      use: [{ type: 'canned_food', count: 1 }],
      container: { id: 3, items: [], taken: [{ id: 'c1', type: 'bandage', x: 0, y: 0, rotated: false }], deposited: [] },
    });
    expect(lines.map((line) => line.text)).toEqual([expect.stringMatching(/^DROPPED 2 /), expect.stringMatching(/^ATE /), expect.stringMatching(/^\+1 /)]);
    expect(lines.every((line) => line.kind === 'loot')).toBe(true);
  });

  it('logs nothing for a bag that was only rearranged', () => {
    expect(bagLines({ layout: [], drop: [] })).toEqual([]);
  });
});
