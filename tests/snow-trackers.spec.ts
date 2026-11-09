import { describe, expect, it } from 'vitest';
import { TICK_RATE, ZOMBIES } from '../shared/constants.ts';
import { LEVELS } from '../shared/levels.ts';
import { viewFor } from '../shared/snapshot-view.ts';
import type { SimState, ZombieState } from '../shared/sim-state.ts';
import { TRACK_ARRIVE_PX, TRACK_LIFE_SEC, TRACK_SEARCH_SEC, TRACKER_SPEED_SCALE } from '../shared/town-rules.ts';
import { circleHitsSolid, segmentHitsSolid } from '../shared/world-query.ts';
import { makeNoise } from '../shared/zombie-senses.ts';
import { isSnapshotPacket } from '../src/network/packet-guards.ts';
import { addRoamer, eventsOf, quietSim, stepUntil, steps } from './helpers/sim-harness.ts';

const SNOW = LEVELS.find((level) => level.theme === 'snow')!.number;
const SPACING = 25;
const PRINTS = 8;
/** Out of the player's sight, well inside waking range. */
const START = 300;

interface Lane {
  readonly points: { x: number; y: number }[];
}

/** A clear straight run of print spots heading away from the player, so a tracker never sees them. */
function laneAway(state: SimState): Lane {
  const [p] = state.players;
  // Sixteen headings round the player, so a tree or a parked car the town happens to put in one lane never sinks the scene.
  const headings = Array.from({ length: 16 }, (_, k) => (k * Math.PI) / 8);
  for (const angle of headings) {
    const points = Array.from({ length: PRINTS + 3 }, (_, k) => ({
      x: p.x + Math.cos(angle) * (START + k * SPACING),
      y: p.y + Math.sin(angle) * (START + k * SPACING),
    }));
    const first = points[0];
    const last = points[points.length - 1];
    const clear = points.every((spot) => !circleHitsSolid(state.map, spot.x, spot.y, 12))
      && !segmentHitsSolid(state.map, first.x, first.y, last.x, last.y);
    if (clear) return { points: points.slice(0, PRINTS) };
  }
  throw new Error('no clear lane near the player');
}

function snowScene(players: readonly string[] = ['a']) {
  const quiet = quietSim(players);
  quiet.state.level = SNOW;
  const lane = laneAway(quiet.state);
  const [p] = quiet.state.players;
  // Oldest at the start of the lane, freshest at its end: the walker went that way.
  lane.points.forEach((spot, k) => quiet.state.tracks.push({ x: spot.x, y: spot.y, by: p.id, angle: 0, left: 14 + k * 0.5 }));
  return { ...quiet, lane, p };
}

const near = (z: ZombieState, spot: { x: number; y: number }, within: number): boolean =>
  Math.hypot(z.x - spot.x, z.y - spot.y) <= within;

describe('snow trackers', () => {
  it('a roamer on a print starts tracking, quietly: no shared noise, a sniff instead of an alert', () => {
    const { sim, state, lane } = snowScene();
    const tracker = addRoamer(state, 'walker', lane.points[0].x, lane.points[0].y);
    expect(stepUntil(sim, () => tracker.trail !== undefined, 12)).toBeGreaterThanOrEqual(0);
    expect(tracker.mode).toBe('alert');
    expect(state.noises).toEqual([]);
    const frame = sim.snapshot();
    expect(eventsOf(frame, 'zombie_track').map((e) => e.zombieId)).toContain(tracker.id);
    expect(eventsOf(frame, 'zombie_alert').map((e) => e.zombieId)).not.toContain(tracker.id);
  });

  it('only the zombie that found the trail follows it; one going to a bottle keeps going to the bottle', () => {
    const { sim, state, lane, p } = snowScene();
    const bottle = { x: lane.points[PRINTS - 1].x, y: lane.points[PRINTS - 1].y };
    // Off to the side of the lane, on open ground so it can walk.
    const side = [40, -40, 30, -30].find((dy) => !circleHitsSolid(state.map, lane.points[2].x, lane.points[2].y + dy, ZOMBIES.walker.radius + 1))!;
    const investigator = addRoamer(state, 'walker', lane.points[2].x, lane.points[2].y + side);
    makeNoise(state, bottle.x, bottle.y, 250);
    expect(investigator.mode).toBe('alert');
    const tracker = addRoamer(state, 'walker', lane.points[0].x, lane.points[0].y);
    stepUntil(sim, () => tracker.trail !== undefined, 12);
    expect(investigator.trail).toBeUndefined();
    const before = Math.hypot(investigator.x - p.x, investigator.y - p.y);
    steps(sim, TICK_RATE * 2);
    // Still walking the bottle's way, which is away from the player, not toward them.
    expect(Math.hypot(investigator.x - p.x, investigator.y - p.y)).toBeGreaterThan(before);
  });

  it('follows the prints toward the newer ones, slower than a chase, and shows it is tracking', () => {
    const { sim, state, lane } = snowScene();
    const tracker = addRoamer(state, 'walker', lane.points[0].x, lane.points[0].y);
    stepUntil(sim, () => tracker.trail !== undefined, 12);
    expect(sim.snapshot().zombies.find((z) => z.id === tracker.id)?.tracking).toBe(true);

    const start = { x: tracker.x, y: tracker.y };
    steps(sim, TICK_RATE);
    const pace = Math.hypot(tracker.x - start.x, tracker.y - start.y);
    expect(pace).toBeGreaterThan(0);
    expect(pace).toBeLessThanOrEqual(ZOMBIES.walker.speed * TRACKER_SPEED_SCALE + 1);

    const end = lane.points[PRINTS - 1];
    // It walks the whole trail and only casts about once it reaches the freshest print.
    expect(stepUntil(sim, () => tracker.trail?.searching === true, TICK_RATE * 15)).toBeGreaterThanOrEqual(0);
    expect(near(tracker, end, ZOMBIES.walker.radius + TRACK_ARRIVE_PX + 1)).toBe(true);
  });

  it('where the prints run out it casts about, gives up, and leaves the cold trail alone for a while', () => {
    const { sim, state, lane } = snowScene();
    const tracker = addRoamer(state, 'walker', lane.points[0].x, lane.points[0].y);
    stepUntil(sim, () => tracker.trail !== undefined, 12);
    expect(stepUntil(sim, () => tracker.trail?.searching === true, TICK_RATE * 15)).toBeGreaterThanOrEqual(0);
    expect(sim.snapshot().zombies.find((z) => z.id === tracker.id)?.tracking).toBeUndefined();

    expect(stepUntil(sim, () => tracker.mode === 'wander', TICK_RATE * (TRACK_SEARCH_SEC + 1))).toBeGreaterThanOrEqual(0);
    expect(tracker.trail).toBeUndefined();
    // Put it back on the freshest print: resting, it does not take the trail up again at once.
    const end = lane.points[PRINTS - 1];
    tracker.x = end.x;
    tracker.y = end.y;
    steps(sim, TICK_RATE);
    expect(tracker.trail).toBeUndefined();
    expect(state.tracks.length).toBeGreaterThan(0);
  });

  it('a noise pulls a tracker off the trail', () => {
    const { sim, state, lane } = snowScene();
    const tracker = addRoamer(state, 'walker', lane.points[0].x, lane.points[0].y);
    stepUntil(sim, () => tracker.trail !== undefined, 12);
    makeNoise(state, tracker.x, tracker.y + 30, 80);
    expect(tracker.trail).toBeUndefined();
    expect(tracker.mode).toBe('alert');
  });

  it('a trail left by someone who has died leads nowhere', () => {
    // A teammate keeps the run going.
    const { sim, state, lane, p } = snowScene(['a', 'b']);
    const tracker = addRoamer(state, 'walker', lane.points[0].x, lane.points[0].y);
    stepUntil(sim, () => tracker.trail !== undefined, 12);
    p.status = 'dead';
    expect(stepUntil(sim, () => tracker.trail?.searching === true || tracker.trail === undefined, TICK_RATE * 3)).toBeGreaterThanOrEqual(0);
  });

  it('sends nearby prints to the client, fading, and trims the far ones from each view', () => {
    const { sim, state, lane, p } = snowScene();
    state.tracks.push({ x: p.x + 5000, y: p.y, by: p.id, angle: 0, left: TRACK_LIFE_SEC });
    const frame = sim.snapshot();
    expect(isSnapshotPacket(JSON.parse(JSON.stringify(frame)))).toBe(true);
    expect(frame.tracks?.length).toBe(PRINTS);
    expect(frame.tracks?.[0]).toEqual({ x: Math.round(lane.points[0].x), y: Math.round(lane.points[0].y), angle: 0, left: 14 });

    const view = viewFor(frame, p.id);
    expect(view.tracks?.length).toBe(PRINTS);
    p.x += 3000;
    const away = viewFor(sim.snapshot(), p.id);
    expect(away.tracks).toBeUndefined();
  });

  it('no prints field outside a snowy town', () => {
    const { sim } = quietSim();
    expect('tracks' in sim.snapshot()).toBe(false);
  });
});
