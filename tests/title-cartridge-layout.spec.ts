import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isConfirmKey, menuStep, steppedRow } from '../src/game/title-menu.ts';

/**
 * vitest has no layout engine and the repo has no browser harness, so this reads the CSS the title uses and checks
 * how the Install cartridge is anchored. The hit-test itself (document.elementFromPoint at each menu row's centre,
 * at 390x844, 360x640, 320x568 and 844x390) was run by hand in headless Chrome, not here (#7455).
 */
const cartridge = readFileSync(new URL('../src/components/InstallCartridge.vue', import.meta.url), 'utf8');
const title = readFileSync(new URL('../src/components/TitleScreen.vue', import.meta.url), 'utf8');

function block(source: string, header: string): string {
  const start = source.indexOf(header);
  expect(start, `${header} is in the source`).toBeGreaterThanOrEqual(0);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') depth -= 1;
    if (depth === 0) return source.slice(open + 1, i);
  }
  throw new Error(`${header} never closes`);
}

describe('Install cartridge in portrait', () => {
  const portrait = block(cartridge, '@media (orientation: portrait) {');

  it('hangs off the bottom edge of the menu column, not a fixed height up from the screen bottom', () => {
    expect(portrait).toMatch(/position:\s*absolute/);
    expect(portrait).toMatch(/top:\s*100%/);
    expect(portrait).toMatch(/margin-top:\s*calc\(var\(--u\) \* [1-9]/);
    expect(portrait).not.toMatch(/bottom:\s*calc/);
  });

  it('has no portrait rule that puts it back at a bottom offset', () => {
    const portraitRules = cartridge.match(/@media \(orientation: portrait\)[^{]*\{[^]*?\n\}/g) ?? [];
    for (const rule of portraitRules) expect(rule).not.toMatch(/bottom:\s*calc/);
  });

  it('is positioned against the menu column', () => {
    expect(block(title, '.title-columns {')).toMatch(/position:\s*relative/);
  });

  it('still drops out on a screen too short to hold it', () => {
    expect(cartridge).toMatch(/max-height: 600px[^]*display:\s*none/);
  });
});

describe('main menu keys (#7457)', () => {
  it('ArrowDown steps to the next row and Enter confirms, by KeyboardEvent.code', () => {
    expect(steppedRow(0, menuStep('ArrowDown') ?? 0, 3)).toBe(1);
    expect(isConfirmKey('Enter')).toBe(true);
    // The menu reads event.code, so a synthetic event with only `key` set does nothing.
    expect(menuStep('')).toBeNull();
  });
});
