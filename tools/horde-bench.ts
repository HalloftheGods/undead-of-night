/* eslint-disable @typescript-eslint/no-explicit-any -- a dev bench that reaches into the running game's private state, and Playwright has no types in this project */
// Horde stress bench: how many frames a big fight drops on a slow CPU.
//
//   pnpm dev                                    (in another shell; port 8096)
//   node --experimental-strip-types tools/horde-bench.ts [--throttle=4] [--seconds=12] [--profile=out.cpuprofile]
//
// Opens the dev build in headless Chromium with the CPU slowed by --throttle, starts an Arcade run on a boss
// town, fills the town to ZOMBIE_CAP around the player (the size a blood moon horde reaches), adds the boss,
// keeps the player alive and firing, then reports frame times. --scene=overrun runs the bunker breach instead.

import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// Playwright comes with the container (or a global install), not from this project's dependencies.
const { chromium } = createRequire(import.meta.url)('playwright') as { chromium: any };

const args = new Map(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? 'true'] as const;
}));
const url = args.get('url') ?? 'http://localhost:8096/';
const throttle = Number(args.get('throttle') ?? 4);
const seconds = Number(args.get('seconds') ?? 12);
const scene = args.get('scene') ?? 'town';
const level = Number(args.get('level') ?? 9);
const profilePath = args.get('profile');
const tracePath = args.get('trace');
const width = Number(args.get('width') ?? 1280);
const height = Number(args.get('height') ?? 720);
/** How many zombies to keep in the fight; by default the cap for the scene. */
const zombies = Number(args.get('zombies') ?? -1);

/** What one measured stretch of play reports back from the page. */
interface BenchResult {
  gaps: number[];
  zombies: number;
  dots: number;
  bullets: number;
  frameMs: number;
  tickMs: number;
  screen: string;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
page.on('pageerror', (e: Error) => console.error('pageerror', e.message));
await page.goto(`${url}${scene === 'overrun' ? '?overrun' : ''}`);
await page.waitForFunction(() => window.__outbreak?.ui.value.art != null, null, { timeout: 60_000 });

// Start the run straight from the dev handle, past the setup stepper. Math.random is seeded first, so every
// bench plays the same town with the same horde and runs can be compared.
await page.evaluate(({ scene, level }: { scene: string; level: number }) => {
  let state = 0x2f6b9a1d;
  Math.random = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const game = window.__outbreak as unknown as { session: { startSolo(style: string, level?: number): void } };
  const breach = scene === 'overrun';
  if (breach) game.session.startSolo('campaign');
  else game.session.startSolo('arcade', level);
}, { scene, level });
await page.waitForFunction(() => (window.__outbreak as unknown as { sim: unknown }).sim != null, null, { timeout: 30_000 });
await page.waitForTimeout(1500);

// Fill the town and keep the fight going.
await page.evaluate(async ({ scene, zombies }: { scene: string; zombies: number }) => {
  // The dev server hands out the game's own modules by path, the same instances the running game uses.
  const load = (path: string): Promise<any> => import(path);
  const waves = await load('/shared/waves.ts');
  const constants = await load('/shared/constants.ts');
  const bosses = await load('/shared/bosses.ts');
  const game = window.__outbreak as unknown as { sim: { sim: any } };
  const sim = () => game.sim.sim;
  const s = sim();
  const p = s.players[0];
  const sceneCap = scene === 'overrun' ? 40 : constants.ZOMBIE_CAP;
  const cap = zombies >= 0 ? zombies : sceneCap;
  const types = ['walker', 'walker', 'walker', 'runner', 'bloater', 'brute'];
  let i = 0;
  let tries = 0;
  while (s.zombies.length < cap && tries < 20_000) {
    tries += 1;
    const angle = Math.random() * Math.PI * 2;
    const r = 90 + Math.random() * 260;
    const x = p.x + Math.cos(angle) * r;
    const y = p.y + Math.sin(angle) * r;
    const offMap = x < 20 || y < 20 || x > s.map.width - 20 || y > s.map.height - 20;
    if (offMap) continue;
    waves.spawnZombie(s, types[i++ % types.length], x, y);
    const z = s.zombies[s.zombies.length - 1];
    z.mode = 'hunt';
    z.horde = true;
    z.interestLeft = 999;
  }
  const wantsBoss = scene !== 'overrun' && cap > 0 && bosses.liveBoss(s) === null;
  if (wantsBoss) {
    s.wave = 999; // not the last horde: summon by hand
    const def = bosses.BOSSES.butcher;
    waves.spawnZombie(s, def.base, p.x + 200, p.y);
    const z = s.zombies[s.zombies.length - 1];
    Object.assign(z, { boss: def.id, health: def.health * 50, maxHealth: def.health * 50, mode: 'hunt', horde: true });
    z.radius *= def.scale;
    z.bossState = { id: def.id, trickLeft: def.everySec, chargeLeft: 0, baseSpeed: z.speed };
  }
  // Keep the player standing and loaded, and the horde topped up, for the whole bench.
  // The page is thrown away with the browser at the end, which stops this with it.
  const keeper = setInterval(() => {
    const t = sim();
    if (!t) clearInterval(keeper);
    const me = t?.players[0];
    if (!me) return;
    me.health = 1e6;
    me.maxHealth = 1e6;
    me.status = 'alive';
    me.ammo = 999;
    for (const k of Object.keys(me.ammoBag ?? {})) me.ammoBag[k] = 999;
    let n = 0;
    while (t.zombies.length < cap && n++ < 20) {
      const angle = Math.random() * Math.PI * 2;
      const x = me.x + Math.cos(angle) * 300;
      const y = me.y + Math.sin(angle) * 300;
      const offMap = x < 20 || y < 20 || x > t.map.width - 20 || y > t.map.height - 20;
      if (offMap) continue;
      waves.spawnZombie(t, types[n % types.length], x, y);
      const z = t.zombies[t.zombies.length - 1];
      z.mode = 'hunt';
      z.horde = true;
      z.interestLeft = 999;
    }
  }, 100);
}, { scene, zombies });

// --disable=light,world,sim,hud switches a part off, to see what the frame costs without it.
const disabled = (args.get('disable') ?? '').split(',').filter(Boolean);
await page.evaluate((disabled: string[]) => {
  const game = window.__outbreak as unknown as Record<string, any>;
  const r = game.renderer;
  const off = (o: any, k: string) => { o[k] = () => {}; };
  if (disabled.includes('light')) { off(r, 'composeLight'); off(r.lighting, 'apply'); }
  if (disabled.includes('lightapply')) off(r.lighting, 'apply');
  if (disabled.includes('lightcompose')) off(r, 'composeLight');
  if (disabled.includes('audio')) off(game.run.audio ?? (window.__outbreak as any).audio, 'handleEvent');
  if (disabled.includes('shadows')) off(r.entities, 'drawShadowOf');
  if (disabled.includes('world')) off(r.entities, 'drawWorld');
  if (disabled.includes('overlay')) off(r.overlay, 'draw');
  if (disabled.includes('hud')) off(game.runHud, 'tick');
  if (disabled.includes('sim')) { const sim = game.run.transport.sim; off(sim, 'step'); }
}, disabled);

const cdp = await page.context().newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });

// Hold the trigger and sweep the aim round, so bullets, blood and casings fly the whole time.
const box = { x: width / 2, y: height / 2 };
await page.mouse.move(box.x + 200, box.y);
await page.mouse.down();
const sweep = setInterval(() => {
  const t = Date.now() / 700;
  void page.mouse.move(box.x + Math.cos(t) * 220, box.y + Math.sin(t) * 160).catch(() => {});
}, 120);

await page.waitForTimeout(1500); // settle after the throttle starts
if (args.has('count-draws')) {
  const counts = await page.evaluate(() => new Promise<Record<string, number>>((resolve) => {
    const proto = CanvasRenderingContext2D.prototype;
    const original = proto.drawImage;
    const counts: Record<string, number> = {};
    let calls = 0;
    proto.drawImage = function (this: CanvasRenderingContext2D, ...a: unknown[]) {
      calls += 1;
      const frame = (new Error().stack ?? '').split('\n')[2] ?? '';
      const key = frame.replace(/\?[^:]*/, '').replace(/.*\//, '').replace(/:\d+\)?$/, '');
      counts[key] = (counts[key] ?? 0) + 1;
      return (original as (...b: unknown[]) => void).apply(this, a);
    } as typeof proto.drawImage;
    let frames = 0;
    const tick = () => {
      frames += 1;
      const sampling = frames < 120;
      if (sampling) requestAnimationFrame(tick);
      else {
        proto.drawImage = original;
        const per: Record<string, number> = { total: Math.round(calls / frames) };
        for (const [k, v] of Object.entries(counts).sort((x, y) => y[1] - x[1]).slice(0, 15)) per[k] = Math.round(v / frames);
        resolve(per);
      }
    };
    requestAnimationFrame(tick);
  }));
  process.stdout.write(`drawImage calls per frame ${JSON.stringify(counts)}\n`);
}
if (args.has('count-sounds')) {
  const sounds = await page.evaluate(() => new Promise<unknown>((resolve) => {
    const mixer = (window.__outbreak as any).audio.mixer;
    const play = mixer.play.bind(mixer);
    const counts: Record<string, number> = {};
    let started = 0;
    mixer.play = (name: string, o: unknown) => {
      const before = mixer.total;
      play(name, o);
      const voiceStarted = mixer.total > before;
      if (voiceStarted) {
        started += 1;
        counts[name] = (counts[name] ?? 0) + 1;
      }
    };
    const done = setTimeout(() => {
      clearTimeout(done);
      mixer.play = play;
      resolve({ startedPerSec: started / 3, state: mixer.ctx.state, counts });
    }, 3000);
  }));
  process.stdout.write(`sounds ${JSON.stringify(sounds)}\n`);
}
if (tracePath) await browser.startTracing(page, { path: tracePath, categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline'] });
if (profilePath) {
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
  await cdp.send('Profiler.start');
}
const result = await page.evaluate((seconds: number) => new Promise<BenchResult>((resolve) => {
  // Time spent in the game's own frame and tick, which unlike the frame gaps does not snap to vsync.
  const controller = window.__outbreak as unknown as { frame: (ms: number) => void; run: { transport: { tick: () => void } } };
  let frameMs = 0;
  let tickMs = 0;
  let frames = 0;
  const frame = controller.frame;
  controller.frame = (ms: number) => {
    const t = performance.now();
    frame(ms);
    frameMs += performance.now() - t;
    frames += 1;
  };
  const transport = controller.run.transport;
  const tick = transport.tick.bind(transport);
  transport.tick = () => {
    const t = performance.now();
    tick();
    tickMs += performance.now() - t;
  };
  const particleCount = (renderer: any): number => {
    const dots = renderer ? renderer.fx.particles.dots : null;
    return dots ? dots.length : -1;
  };
  const gaps: number[] = [];
  let last = performance.now();
  const end = last + seconds * 1000;
  const game = window.__outbreak as unknown as { sim: { sim: any }; renderer: any };
  const step = (now: number) => {
    gaps.push(now - last);
    last = now;
    const running = now < end;
    if (running) requestAnimationFrame(step);
    else {
      const s = game.sim.sim;
      controller.frame = frame;
      transport.tick = tick;
      resolve({ frameMs: frameMs / frames, tickMs: (tickMs / seconds) / 30, gaps, zombies: s.zombies.length, bullets: s.bullets.length, dots: particleCount(game.renderer), screen: (window.__outbreak as any).ui.value.screen });
    }
  };
  requestAnimationFrame(step);
}), seconds);
if (profilePath) {
  const { profile } = await cdp.send('Profiler.stop');
  writeFileSync(profilePath, JSON.stringify(profile));
}
if (tracePath) await browser.stopTracing();
clearInterval(sweep);
if (args.has('shot')) await page.screenshot({ path: args.get('shot') });
await page.mouse.up();

const gaps = result.gaps.slice(1).sort((a: number, b: number) => a - b);
const sum = gaps.reduce((a: number, b: number) => a + b, 0);
const at = (q: number) => gaps[Math.min(gaps.length - 1, Math.floor(gaps.length * q))];
const slow = gaps.filter((g: number) => g > 1000 / 55).length;
process.stdout.write(`${JSON.stringify({
  scene, throttle, seconds, disabled: disabled.join(','), frames: gaps.length,
  fps: +(1000 * gaps.length / sum).toFixed(1),
  avgMs: +(sum / gaps.length).toFixed(2),
  p50Ms: +at(0.5).toFixed(2), p95Ms: +at(0.95).toFixed(2), p99Ms: +at(0.99).toFixed(2),
  over18ms: +(100 * slow / gaps.length).toFixed(1),
  // Main-thread work per drawn frame and per sim tick (30 a second), in throttled milliseconds.
  renderMs: +result.frameMs.toFixed(2), tickMs: +result.tickMs.toFixed(2),
  zombies: result.zombies, screen: result.screen, bullets: result.bullets, dots: result.dots,
})}\n`);
await browser.close();
