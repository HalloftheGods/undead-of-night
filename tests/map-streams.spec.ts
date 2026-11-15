import { describe, expect, it } from 'vitest';
import { interiorStream, MAP_SALTS, mapStream } from '../shared/map-streams.ts';
import type { MapPhase } from '../shared/map-streams.ts';
import type { WorldMap } from '../shared/protocol.ts';
import { buildingAt } from '../shared/world-query.ts';
import { buildTown, generateWorldMap } from '../shared/world-map.ts';

const SEEDS = [3, 11];
const isRoom = (kind: string | undefined): boolean => kind !== undefined && kind !== 'sewer_maze';
const LEVEL = 4;

/** The town on `seed` with one phase's stream moved to another salt. */
const withPhaseMoved = (seed: number, phase: MapPhase): WorldMap => buildTown(seed, LEVEL, { ...MAP_SALTS, [phase]: MAP_SALTS[phase] ^ 0x5a5a5a5a });

const footprints = (map: WorldMap) => map.buildings.map((b) => `${b.kind}@${b.x},${b.y}#${b.variant}`);
const propsOf = (map: WorldMap) => map.props.map((p) => `${p.kind}@${Math.round(p.x)},${Math.round(p.y)}`);
/** The plan's own districts; the sewers' follow the storeys and manholes, which later phases lay down. */
const surfaceDistricts = (map: WorldMap) => map.districts.filter((d) => !d.underground);
/** What furnishes the rooms of the town and its storeys; the sewers' ladders follow the manholes instead. */
const indoorProps = (map: WorldMap) => map.props.filter((p) => isRoom(buildingAt(map, p.x, p.y)?.kind)).map((p) => `${p.kind}@${Math.round(p.x)},${Math.round(p.y)}`);

describe('map streams', () => {
  it('builds the same town as generateWorldMap with the shipped salts', () => {
    const shipped = generateWorldMap(SEEDS[0], LEVEL);
    const built = buildTown(SEEDS[0], LEVEL, MAP_SALTS);
    expect(footprints(built)).toEqual(footprints(shipped));
    expect(propsOf(built)).toEqual(propsOf(shipped));
    expect(Array.from(built.tiles)).toEqual(Array.from(shipped.tiles));
  });

  it('gives every phase its own stream, and the plan the town seed itself', () => {
    const firsts = (['plan', 'buildings', 'interiors', 'terrain', 'lights'] as const).map((phase) => mapStream(7, phase)());
    expect(new Set(firsts).size).toBe(firsts.length);
    expect(interiorStream(7, 100, 200)()).not.toBe(interiorStream(7, 116, 200)());
  });

  it.each(SEEDS)('seed %i: moving the lights stream leaves the ground, the buildings and every prop where they were', (seed) => {
    const town = generateWorldMap(seed, LEVEL);
    const moved = withPhaseMoved(seed, 'lights');
    expect(Array.from(moved.tiles)).toEqual(Array.from(town.tiles));
    expect(footprints(moved)).toEqual(footprints(town));
    expect(propsOf(moved)).toEqual(propsOf(town));
    expect(moved.lights).not.toEqual(town.lights);
  });

  it.each(SEEDS)('seed %i: moving the terrain stream leaves the plan, the buildings and the rooms alone', (seed) => {
    const town = generateWorldMap(seed, LEVEL);
    const moved = withPhaseMoved(seed, 'terrain');
    expect(surfaceDistricts(moved)).toEqual(surfaceDistricts(town));
    expect(footprints(moved)).toEqual(footprints(town));
    expect(indoorProps(moved)).toEqual(indoorProps(town));
    expect(Array.from(moved.tiles)).not.toEqual(Array.from(town.tiles));
  });

  it.each(SEEDS)('seed %i: moving the interiors stream refurnishes rooms but leaves the ground and the buildings', (seed) => {
    const town = generateWorldMap(seed, LEVEL);
    const moved = withPhaseMoved(seed, 'interiors');
    expect(Array.from(moved.tiles)).toEqual(Array.from(town.tiles));
    expect(footprints(moved)).toEqual(footprints(town));
    expect(indoorProps(moved)).not.toEqual(indoorProps(town));
  });

  it.each(SEEDS)('seed %i: moving the buildings stream keeps the plan: the same districts and spawn', (seed) => {
    const town = generateWorldMap(seed, LEVEL);
    const moved = withPhaseMoved(seed, 'buildings');
    expect(surfaceDistricts(moved)).toEqual(surfaceDistricts(town));
    expect(moved.spawn).toEqual(town.spawn);
  });
});
