import { describe, expect, it } from 'vitest';
import { TICK_RATE } from '../shared/constants.ts';
import { FINAL_LEVEL, LEVELS } from '../shared/levels.ts';
import type { PlayerEntity, SnapshotPacket } from '../shared/protocol.ts';
import { GameSimulation } from '../shared/simulation.ts';
import { ScavengerBot } from './helpers/bots.ts';
import { eventsOf } from './helpers/sim-harness.ts';

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const RUN_CAP_SEC = 120 * 60;

interface LevelRun {
  /** Level the run ended on. */
  readonly reached: number;
  /** Levels left by the van, in order, with what the bot took with it. */
  readonly left: readonly { readonly level: number; readonly seconds: number; readonly kit: PlayerEntity }[];
  readonly final: SnapshotPacket;
}

function playRun(seed: number): LevelRun {
  const sim = new GameSimulation({ seed });
  sim.addPlayer('bot', 'bot');
  const bot = new ScavengerBot('bot', sim.map, true);
  let snapshot = sim.snapshot();
  const left: { level: number; seconds: number; kit: PlayerEntity }[] = [];
  for (let tick = 0; tick < RUN_CAP_SEC * TICK_RATE && snapshot.phase !== 'gameover'; tick++) {
    const packet = bot.think(snapshot);
    if (packet) sim.setInput('bot', packet);
    sim.step();
    snapshot = sim.snapshot();
    const [kit] = snapshot.players;
    for (const event of eventsOf(snapshot, 'level_complete')) left.push({ level: event.level, seconds: tick / TICK_RATE, kit });
  }
  return { reached: snapshot.level, left, final: snapshot };
}

describe('level balance', () => {
  it('a scavenger that takes the van clears level 1 on most seeds, and carries its kit on', () => {
    const runs = SEEDS.map(playRun);
    for (const { number, title } of LEVELS) {
      const arrived = runs.filter((run) => run.reached >= number).length;
      const cleared = runs.filter((run) => run.left.some((each) => each.level === number)).length;
      console.info(`level ${number} ${title}: ${arrived} arrived, ${cleared} left by the van`);
    }
    console.info(`scavenger levels reached: ${runs.map((run) => run.reached).join(' ')}`);

    const movedOn = runs.filter((run) => run.left.length > 0);
    expect(movedOn.length).toBeGreaterThanOrEqual(5);
    for (const run of movedOn) {
      const [first] = run.left;
      expect(first.level).toBe(1);
      expect(first.kit.status).toBe('alive');
    }
    // Two hordes in, it has been to the shops. A kit on a floor can pull one bot off its way there.
    const armed = movedOn.filter((run) => run.left[0].kit.owned.length > 1);
    expect(armed.length).toBeGreaterThanOrEqual(movedOn.length - 1);
    // Most runs make level 2. Level 3 was only ever reached on one seed in ten, so it moves with how a town is built.
    expect(runs.filter((run) => run.reached >= 2).length).toBeGreaterThanOrEqual(6);
    // This bot is no expert: the deep levels are for people, and the run stays a run.
    expect(runs.every((run) => run.final.phase === 'gameover')).toBe(true);
    expect(runs.every((run) => run.reached <= FINAL_LEVEL)).toBe(true);
    for (const run of runs) expect(run.final.gameOver?.level).toBe(run.reached);
  }, 300000);
});
