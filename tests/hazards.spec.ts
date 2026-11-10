import { describe, expect, it } from 'vitest';
import {
  calculateCorpseSicknessLevel,
  createAuditoryTrap,
  createFireGrid,
  createRottingCorpse,
  igniteCell,
  isPointInFire,
  isTileCombustible,
  updateAuditoryTraps,
  updateCorpsesDecay,
  updateFireGrid,
} from '../shared/hazards.ts';
import type { TileKind } from '../shared/map-protocol.ts';

describe('Auditory Traps & Alarm Clocks', () => {
  it('counts down timer and begins ringing with noise emissions', () => {
    const trap = createAuditoryTrap('trap_1', 100, 100, 5, 300);
    const traps = [trap];

    // Tick 3 seconds: still winding down
    const update1 = updateAuditoryTraps(traps, 3);
    expect(update1.activeClocks.length).toBe(1);
    expect(trap.isRinging).toBe(false);
    expect(update1.ringingNoises.length).toBe(0);

    // Tick 2 more seconds: timer hits zero, starts ringing
    const update2 = updateAuditoryTraps(traps, 2);
    expect(trap.isRinging).toBe(true);
    expect(update2.ringingNoises.length).toBe(1);
    expect(update2.ringingNoises[0].radius).toBe(300);

    // Tick past ringing duration (8 seconds): shuts off and expires
    const update3 = updateAuditoryTraps(traps, 10);
    expect(trap.isRinging).toBe(false);
    expect(update3.activeClocks.length).toBe(0);
  });
});

describe('Combustible Tile Grid & Fire Spread', () => {
  it('distinguishes combustible tiles from firebreaks', () => {
    expect(isTileCombustible('floor_wood')).toBe(true);
    expect(isTileCombustible('grass')).toBe(true);
    expect(isTileCombustible('floor_carpet')).toBe(true);

    expect(isTileCombustible('asphalt')).toBe(false);
    expect(isTileCombustible('floor_concrete')).toBe(false);
    expect(isTileCombustible('water')).toBe(false);
  });

  it('ignites combustible cells and spreads to adjacent flammable tiles', () => {
    const grid = createFireGrid();
    const map = new Map<string, TileKind>();

    // Center tile is wood, east neighbor is wood, west neighbor is asphalt firebreak
    map.set('10,10', 'floor_wood');
    map.set('11,10', 'floor_wood');
    map.set('9,10', 'asphalt');

    const getTile = (tx: number, ty: number) => map.get(`${tx},${ty}`) ?? null;

    const ignited = igniteCell(grid, 10, 10, 50);
    expect(ignited).toBe(true);
    expect(grid.cells.size).toBe(1);

    // Point in fire check
    expect(isPointInFire(grid, 165, 165)).toBe(true);
    expect(isPointInFire(grid, 250, 250)).toBe(false);

    // Update 2.5s: spread interval triggers
    updateFireGrid(grid, getTile, 2.5);

    // East neighbor ignited, west asphalt resisted fire
    expect(grid.cells.has('11,10')).toBe(true);
    expect(grid.cells.has('9,10')).toBe(false);
  });

  it('burns out fuel over time', () => {
    const grid = createFireGrid();
    igniteCell(grid, 5, 5, 20); // 20 fuel at 15 burn rate = ~1.33s life

    updateFireGrid(grid, () => null, 2.0);
    expect(grid.cells.size).toBe(0);
  });
});

describe('Rotting Corpse Decay & Sickness Field', () => {
  it('advances corpse decay stages from fresh to rotting to skeleton', () => {
    const corpse = createRottingCorpse('corpse_1', 200, 200);
    const corpses = [corpse];

    expect(corpse.stage).toBe('fresh');

    // 70s elapsed: enters decaying stage
    updateCorpsesDecay(corpses, 70);
    expect(corpse.stage).toBe('decaying');

    // 310s total elapsed: skeletonizes
    updateCorpsesDecay(corpses, 240);
    expect(corpse.stage).toBe('skeleton');
  });

  it('calculates corpse sickness based on decaying corpse proximity and clustering', () => {
    const freshCorpse = createRottingCorpse('c1', 100, 100);
    const decaying1 = createRottingCorpse('c2', 105, 100);
    decaying1.stage = 'decaying';

    const decaying2 = createRottingCorpse('c3', 100, 105);
    decaying2.stage = 'decaying';

    const corpses = [freshCorpse, decaying1, decaying2];

    // 2 nearby decaying corpses: mild sickness (2 * 0.5 = 1.0)
    const mildSickness = calculateCorpseSicknessLevel(corpses, 100, 100);
    expect(mildSickness).toBe(1.0);

    // Add 3rd decaying corpse to trigger dangerous cluster threshold (3+ corpses)
    const decaying3 = createRottingCorpse('c4', 110, 100);
    decaying3.stage = 'decaying';
    corpses.push(decaying3);

    const clusterSickness = calculateCorpseSicknessLevel(corpses, 100, 100);
    expect(clusterSickness).toBe(4.5); // 3 * 1.5 = 4.5
  });
});
