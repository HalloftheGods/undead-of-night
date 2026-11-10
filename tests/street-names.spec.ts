import { describe, expect, it } from 'vitest';
import { TILE_SIZE } from '../shared/protocol.ts';
import { CENTER_STREET, EAST_WEST_STREETS, MAIN_STREET, NORTH_SOUTH_STREETS, columnName, rowName, streetAt } from '../shared/street-names.ts';
import { GRID_CENTRE_COL, GRID_CENTRE_ROW, GRID_PITCH_COLS, GRID_PITCH_ROWS, MAP_TILES } from '../shared/town-plan.ts';

const at = (col: number, row: number) => streetAt((col + 0.5) * TILE_SIZE, (row + 0.5) * TILE_SIZE);

describe('street names', () => {
  it('numbers streets in hundreds out from the avenues', () => {
    expect(NORTH_SOUTH_STREETS.map((street) => street.name)).toEqual(['200 W', '100 W', MAIN_STREET, '100 E', '200 E']);
    expect(EAST_WEST_STREETS.map((street) => street.name)).toEqual(['200 N', '100 N', CENTER_STREET, '100 S', '200 S']);
    expect(columnName(-3)).toBe('300 W');
    expect(rowName(1)).toBe('100 S');
  });

  it('reads the road and its nearest cross street along a straight', () => {
    // On 100 N, west of Main St: nearest north-south street is 100 W when close to it.
    const row = GRID_CENTRE_ROW - GRID_PITCH_ROWS;
    expect(at(GRID_CENTRE_COL - GRID_PITCH_COLS - 10, row)).toEqual({ road: '100 N', cross: '100 W', junction: false });
    expect(at(GRID_CENTRE_COL - 8, row)).toEqual({ road: '100 N', cross: MAIN_STREET, junction: false });
    // On Main St, the nearest cross street changes at the halfway line between 100 N and Center St.
    const col = GRID_CENTRE_COL;
    expect(at(col, GRID_CENTRE_ROW - 4 - GRID_PITCH_ROWS / 2 - 3)).toMatchObject({ road: MAIN_STREET, cross: '100 N' });
    expect(at(col, GRID_CENTRE_ROW - 10)).toMatchObject({ road: MAIN_STREET, cross: CENTER_STREET });
  });

  it('shows both streets at a junction', () => {
    expect(at(GRID_CENTRE_COL - GRID_PITCH_COLS, GRID_CENTRE_ROW - GRID_PITCH_ROWS)).toEqual({ road: '100 N', cross: '100 W', junction: true });
    expect(at(GRID_CENTRE_COL, GRID_CENTRE_ROW)).toEqual({ road: CENTER_STREET, cross: MAIN_STREET, junction: true });
    expect(at(GRID_CENTRE_COL + 2 * GRID_PITCH_COLS, GRID_CENTRE_ROW + 2 * GRID_PITCH_ROWS)).toEqual({ road: '200 S', cross: '200 E', junction: true });
  });

  it('is null in a block, past the fence and in the annex under the town', () => {
    expect(at(GRID_CENTRE_COL - 18, GRID_CENTRE_ROW - 16)).toBeNull();
    expect(streetAt(-5, 100)).toBeNull();
    expect(streetAt(100, (MAP_TILES + 5) * TILE_SIZE)).toBeNull();
    // A sewer under a crossing is not a street.
    expect(streetAt((GRID_CENTRE_COL + 0.5) * TILE_SIZE, (MAP_TILES + 40) * TILE_SIZE)).toBeNull();
  });
});
