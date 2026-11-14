import { readdirSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The room runs in a browser tab and a Durable Object as well as Node, so everything it reaches must stay
// runtime-agnostic: no Node-only modules or globals, and no hidden clocks or randomness (those come in injected).
const APP = fileURLToPath(new URL('../', import.meta.url));
const at = (path: string): string => resolve(APP, path);

const ROOM_DIR = at('shared/room');
const LOBBY_DIR = at('shared/lobby');
const ROOTS = [at('shared/room/room-host.ts'), at('shared/room/game-room.ts')];
const LOOSE_FILES = [at('shared/close-codes.ts'), at('shared/callsign.ts')];

const tsFilesIn = (dir: string): string[] =>
  readdirSync(dir).filter((file) => file.endsWith('.ts')).map((file) => resolve(dir, file));

/** Source without comments, so a doc comment that says "Date.now" does not count as a use. */
function codeOf(file: string): string {
  return readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const RELATIVE_IMPORT = /(?:from\s+|import\s*\(\s*|import\s+)['"](\.{1,2}\/[^'"]+)['"]/g;

/** Every file reachable from the roots through relative imports. */
function reachableFrom(roots: readonly string[]): string[] {
  const seen = new Set<string>();
  const queue = [...roots];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const match of codeOf(file).matchAll(RELATIVE_IMPORT)) {
      const target = resolve(dirname(file), match[1]);
      if (target.endsWith('.ts')) queue.push(target);
    }
  }
  return [...seen].sort();
}

interface Ban {
  readonly name: string;
  readonly pattern: RegExp;
}

const BANNED: readonly Ban[] = [
  { name: 'ws', pattern: /from\s+['"]ws['"]|import\(\s*['"]ws['"]\s*\)/ },
  { name: 'node: module', pattern: /['"]node:/ },
  { name: 'NodeJS types', pattern: /\bNodeJS\./ },
  { name: 'process', pattern: /(?<![.\w])process\./ },
  { name: 'Buffer', pattern: /(?<![.\w])Buffer\b/ },
  { name: 'require(', pattern: /(?<![.\w])require\s*\(/ },
  // Only the globals: `clock.setTimeout(...)` or a `setTimeout` parameter on an injected clock is how a room is meant to wait.
  { name: 'global setTimeout/setInterval', pattern: /(?<![.\w])(?:setTimeout|setInterval)\s*\(/ },
  { name: 'Math.random', pattern: /\bMath\.random\b/ },
  { name: 'Date.now', pattern: /\bDate\.now\b/ },
  { name: 'performance.now', pattern: /\bperformance\.now\b/ },
];

/** Hits that exist on purpose, as { path from the app root: { ban name: why it is safe } }. A manual search found none today. */
const ALLOWED: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  'shared/grid-inventory.ts': {
    'Math.random': 'only the default of randomPackItem rng; the room (shared/container-search.ts) always passes sim.rng, the dev inventory page passes its own',
  },
};

const scanned = [...new Set([...tsFilesIn(ROOM_DIR), ...tsFilesIn(LOBBY_DIR), ...LOOSE_FILES, ...reachableFrom(ROOTS)])].sort();
const label = (file: string): string => relative(APP, file);

describe('everything the room reaches stays runtime-agnostic', () => {
  it('scans the room, the lobby, the shared helpers and the simulation behind it', () => {
    const names = scanned.map(label);
    expect(names).toEqual(expect.arrayContaining([
      'shared/room/room-host.ts', 'shared/room/game-room.ts', 'shared/simulation.ts', 'shared/close-codes.ts',
      'shared/callsign.ts', 'shared/lobby/lobby-protocol.ts', 'shared/lobby/match.ts',
    ]));
    expect(names.every((name) => name.startsWith('shared/'))).toBe(true);
  });

  it('follows imports into the simulation and what it imports', () => {
    const reached = reachableFrom(ROOTS).map(label);
    expect(reached).toContain('shared/simulation.ts');
    expect(reached.length).toBeGreaterThan(20);
  });

  it.each(scanned.map(label))('%s uses no Node-only API, global timer, clock or random source', (name) => {
    const code = codeOf(at(name));
    const allowed = ALLOWED[name] ?? {};
    const hits = BANNED.filter((ban) => ban.pattern.test(code) && !(ban.name in allowed)).map((ban) => ban.name);
    expect(hits).toEqual([]);
  });

  it('would catch each banned thing, and leaves an injected clock alone', () => {
    const hit = (name: string, code: string) => BANNED.find((ban) => ban.name === name)?.pattern.test(code);
    expect(hit('ws', "import { WebSocket } from 'ws';")).toBe(true);
    expect(hit('node: module', "import fs from 'node:fs';")).toBe(true);
    expect(hit('process', 'process.env.X')).toBe(true);
    expect(hit('Buffer', 'Buffer.from(x)')).toBe(true);
    expect(hit('require(', "require('x')")).toBe(true);
    expect(hit('global setTimeout/setInterval', 'const t = setTimeout(f, 5);')).toBe(true);
    expect(hit('global setTimeout/setInterval', 'clock.setTimeout(f, 5);')).toBe(false);
    expect(hit('Math.random', 'Math.random()')).toBe(true);
    expect(hit('Date.now', 'Date.now()')).toBe(true);
    expect(hit('performance.now', 'performance.now()')).toBe(true);
    expect(hit('process', 'subprocess.run')).toBe(false);
  });

  it('keeps every allowlist entry honest: the file still has the hit', () => {
    for (const [name, bans] of Object.entries(ALLOWED)) {
      const code = codeOf(at(name));
      for (const banName of Object.keys(bans)) {
        const ban = BANNED.find((each) => each.name === banName);
        expect(ban?.pattern.test(code), `${name}: ${banName}`).toBe(true);
      }
    }
  });
});
