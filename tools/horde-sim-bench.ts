// The sim alone under a full horde: ms per tick with ZOMBIE_CAP zombies hunting one player who keeps firing.
//
//   node --experimental-strip-types tools/horde-sim-bench.ts [--ticks=900] [--level=9]
//
// Deterministic (seeded), so a change can be checked for speed and for an unchanged result (the hash).

import { ZOMBIE_CAP } from '../shared/constants.ts';
import { GameSimulation } from '../shared/simulation.ts';
import { spawnZombie } from '../shared/waves.ts';
import type { SimState } from '../shared/sim-state.ts';

const args = new Map(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? 'true'] as const;
}));
const ticks = Number(args.get('ticks') ?? 900);
const level = Number(args.get('level') ?? 9);

const game = new GameSimulation({ seed: 1234, startLevel: level, workbench: 'hold' });
game.addPlayer('p', 'bench');
const sim = (game as unknown as { sim: SimState }).sim;
const me = sim.players[0];
const types = ['walker', 'walker', 'walker', 'runner', 'bloater', 'brute'] as const;

function fill(): void {
  let tries = 0;
  while (sim.zombies.length < ZOMBIE_CAP && tries++ < 5000) {
    const angle = sim.rng() * Math.PI * 2;
    const r = 90 + sim.rng() * 260;
    const x = me.x + Math.cos(angle) * r;
    const y = me.y + Math.sin(angle) * r;
    const offMap = x < 20 || y < 20 || x > sim.map.width - 20 || y > sim.map.height - 20;
    if (offMap) continue;
    spawnZombie(sim, types[tries % types.length], x, y);
    const z = sim.zombies[sim.zombies.length - 1];
    z.mode = 'hunt';
    z.horde = true;
    z.interestLeft = 999;
  }
}

let snapshotMs = 0;
let events = 0;
const t0 = performance.now();
for (let tick = 0; tick < ticks; tick += 1) {
  me.health = 1e6;
  me.maxHealth = 1e6;
  for (const k of Object.keys(me.ammoBag)) me.ammoBag[k as keyof typeof me.ammoBag] = 999;
  const topUp = tick % 10 === 0;
  if (topUp) fill();
  game.setInput('p', {
    seq: tick, up: false, down: false, left: false, right: false, angle: tick * 0.05,
    shoot: true, reload: false, weapon: null, melee: false, heal: false, search: false,
  });
  game.step();
  const s0 = performance.now();
  events += game.snapshot().events.length;
  snapshotMs += performance.now() - s0;
}
const total = performance.now() - t0;
let hash = 0;
for (const z of sim.zombies) hash = (Math.imul(hash, 31) + Math.round(z.x * 100) + Math.round(z.y * 7)) | 0;
process.stdout.write(`${JSON.stringify({
  ticks, msPerTick: +(total / ticks).toFixed(3), snapshotMsPerTick: +(snapshotMs / ticks).toFixed(3),
  zombies: sim.zombies.length, kills: me.kills, events, hash,
})}\n`);
