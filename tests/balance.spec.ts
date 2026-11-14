import { describe, expect, it } from 'vitest';
import { AMMO_POPULATION_SHARE, LEAD_IN_SEC, LEVEL_ONE_LEAD_IN_SEC, STANDING_POPULATION, TICK_RATE } from '../shared/constants.ts';
import { containerLoot } from '../shared/container-loot.ts';
import { ammoKillShare } from '../shared/loot.ts';
import type { ClientInputPacket, PlayerEntity, SnapshotPacket } from '../shared/protocol.ts';
import type { SimState } from '../shared/sim-state.ts';
import { GameSimulation } from '../shared/simulation.ts';
import { ScavengerBot, TriggerBot } from './helpers/bots.ts';
import { clearNeeds, stateOf, stepUntil } from './helpers/sim-harness.ts';

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const RUN_CAP_SEC = 25 * 60;

interface Bot {
  think(snapshot: SnapshotPacket): ClientInputPacket | null;
}

interface BotRun {
  readonly hordes: number;
  readonly seconds: number;
  readonly kills: number;
  readonly shots: number;
  /** Seconds to the first empty click; Infinity if it never came. */
  readonly dryAt: number;
  /** Seconds spent with nothing to fire, gun in hand. */
  readonly emptySeconds: number;
  /** Rounds it could still fire at the end. */
  readonly roundsLeft: number;
  /** Most rounds it ever held for guns it owned. */
  readonly roundsPeak: number;
}

const usableRounds = (p: PlayerEntity): number => p.ammo + p.owned.reduce((sum, gun) => sum + p.ammoBag[gun], 0);

function play(seed: number, makeBot: (sim: GameSimulation) => Bot, needsHeld = false): BotRun {
  const sim = new GameSimulation({ seed });
  sim.addPlayer('bot', 'bot');
  const bot = makeBot(sim);
  let snapshot: SnapshotPacket = sim.snapshot();
  let shots = 0;
  let dryAt = Infinity;
  let emptyTicks = 0;
  let roundsPeak = 0;

  for (let tick = 0; tick < RUN_CAP_SEC * TICK_RATE && snapshot.phase !== 'gameover'; tick++) {
    const packet = bot.think(snapshot);
    if (packet) sim.setInput('bot', packet);
    if (needsHeld) clearNeeds(sim);
    sim.step();
    snapshot = sim.snapshot();
    for (const event of snapshot.events) {
      if (event.type === 'shot') shots += 1;
      if (event.type === 'dry_fire') dryAt = Math.min(dryAt, tick / TICK_RATE);
    }
    const rounds = usableRounds(snapshot.players[0]);
    if (rounds === 0) emptyTicks += 1;
    roundsPeak = Math.max(roundsPeak, rounds);
  }
  const [me] = snapshot.players;
  return {
    hordes: snapshot.wave,
    seconds: snapshot.gameOver?.durationSec ?? RUN_CAP_SEC,
    kills: me.kills,
    shots,
    dryAt,
    emptySeconds: emptyTicks / TICK_RATE,
    roundsLeft: usableRounds(me),
    roundsPeak,
  };
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function idleSurvival(seed: number): number {
  const sim = new GameSimulation({ seed });
  sim.addPlayer('idle', 'idle');
  stepUntil(sim, () => sim.phase === 'gameover', (LEAD_IN_SEC + 120) * TICK_RATE);
  return sim.snapshot().gameOver?.durationSec ?? Infinity;
}

const whole = (values: readonly number[]): string => values.map((value) => Math.round(value)).join(' ');

describe('balance', () => {
  it('an idle player is left alone at first, and dies to the first horde', () => {
    const times = SEEDS.map(idleSurvival);
    console.info(`idle survival (s): ${whole(times)}`);
    for (const seconds of times) {
      // Level 1 puts a few slow walkers in sight of the spawn, so an idle player is bitten early.
      expect(seconds).toBeGreaterThan(5);
      expect(seconds).toBeLessThan(LEAD_IN_SEC + 60);
    }
  }, 60000);

  it('a bot that stands and holds the trigger runs dry fast and dies soon after', () => {
    const runs = SEEDS.map((seed) => play(seed, () => new TriggerBot('bot')));
    console.info(`trigger bot dry at (s): ${whole(runs.map((run) => run.dryAt))}`);
    console.info(`trigger bot died at (s): ${whole(runs.map((run) => run.seconds))}`);
    console.info(`trigger bot kills: ${whole(runs.map((run) => run.kills))}`);
    for (const run of runs) {
      expect(run.dryAt).toBeLessThan(120);
      expect(run.seconds).toBeLessThan(LEAD_IN_SEC + 90);
      expect(run.shots).toBe(24);
    }
  }, 60000);

  it('a bot that scavenges lasts a meaningful while, and runs low doing it', () => {
    const runs = SEEDS.map((seed) => play(seed, (sim) => new ScavengerBot('bot', sim.map), true));
    const seconds = runs.map((run) => run.seconds);
    console.info(`scavenger survival (s): ${whole(seconds)} (median ${Math.round(median(seconds))})`);
    console.info(`scavenger hordes: ${whole(runs.map((run) => run.hordes))}`);
    console.info(`scavenger kills: ${whole(runs.map((run) => run.kills))}`);
    console.info(`scavenger shots: ${whole(runs.map((run) => run.shots))}`);
    console.info(`scavenger peak rounds: ${whole(runs.map((run) => run.roundsPeak))}`);
    console.info(`scavenger rounds left: ${whole(runs.map((run) => run.roundsLeft))}`);
    console.info(`scavenger seconds with nothing to fire: ${whole(runs.map((run) => run.emptySeconds))}`);

    // Meaningful: always into the first horde, and several minutes for a typical run.
    for (const run of runs) {
      expect(run.seconds).toBeGreaterThan(LEVEL_ONE_LEAD_IN_SEC);
      expect(run.hordes).toBeGreaterThanOrEqual(1);
    }
    expect(median(seconds)).toBeGreaterThan(300);
    // But not forever, and never comfortable.
    expect(runs.filter((run) => run.seconds >= RUN_CAP_SEC).length).toBeLessThanOrEqual(1);
    expect(median(runs.map((run) => run.roundsLeft))).toBeLessThan(12);
    expect(runs.filter((run) => run.emptySeconds > 0).length).toBeGreaterThanOrEqual(5);
    for (const run of runs) expect(run.roundsPeak).toBeLessThanOrEqual(60 + 120 + 30 + 30);
  }, 240000);

  it('the map holds enough ammo for about the planned share of the population and no more', () => {
    const stockOf = (state: SimState) => [...state.pickups, ...containerLoot(state)];
    const shares = SEEDS.map((seed) => ammoKillShare(stockOf(stateOf(new GameSimulation({ seed })))));
    console.info(`ammo on the map, as a share of the ${STANDING_POPULATION} standing zombies: ${shares.map((share) => share.toFixed(2)).join(' ')}`);
    for (const share of shares) {
      expect(share).toBeLessThanOrEqual(AMMO_POPULATION_SHARE * 1.02);
      expect(share).toBeGreaterThan(AMMO_POPULATION_SHARE * 0.7);
    }
  }, 60000);
});
