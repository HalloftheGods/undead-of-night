import { describe, expect, it } from 'vitest';
import { materialChips } from '../src/game/material-chips.ts';

const none = { planks: 0, nails: 0, sheets: 0, hasHammer: false, hasCrowbar: false };

describe('materialChips', () => {
  it('shows nothing without materials or when nothing is held', () => {
    expect(materialChips(undefined, 'satchel')).toEqual([]);
    expect(materialChips(none, 'alice')).toEqual([]);
  });

  it('shows planks over the tier cap, satchel when no tier is sent', () => {
    expect(materialChips({ ...none, planks: 2 }, undefined)[0]).toMatchObject({ type: 'plank', count: '2/2' });
    expect(materialChips({ ...none, planks: 3 }, 'duffel')[0]?.count).toBe('3/4');
    expect(materialChips({ ...none, planks: 1 }, 'alice')[0]?.count).toBe('1/8');
  });

  it('counts nails and sheets, and shows tools as icons alone', () => {
    const chips = materialChips({ planks: 0, nails: 12, sheets: 2, hasHammer: true, hasCrowbar: true }, 'satchel');
    expect(chips.map((chip) => [chip.type, chip.count])).toEqual([
      ['nails', '12'],
      ['sheet_curtain', '2'],
      ['hammer_tool', null],
      ['crowbar', null],
    ]);
  });
});
