import { describe, expect, it } from 'vitest';
import { MEDKIT_MAX } from '../shared/constants.ts';
import { emptySave } from '../src/game/home/home-store.ts';
import { merchantView } from '../src/game/home/merchant-view.ts';
import { emptyTally } from '../src/game/home/quest-tally.ts';
import { rollStock } from '../src/game/home/shop.ts';
import type { HomeUi } from '../src/game/home-hud.ts';

function homeAt(station: HomeUi['station'], silver: number, highest = 1): HomeUi {
  const save = { ...rollStock(emptySave(2)), silver };
  return {
    inBunker: true, station, stationHold: 0, shop: station === 'medic' ? 'medic' : null, ready: false,
    carried: { jewels: { small: 0, large: 0 }, worth: 0 }, pickedLevel: null, roomHighest: 1, overrun: null, highest,
    difficulty: 'lights_out', receipt: null, save, forgeProgress: 0, saveError: null, death: null, chest: null, quests: { tally: emptyTally() },
  };
}

describe('merchant view', () => {
  it('lists the shelf and marks what the player can buy now', () => {
    const rich = merchantView(homeAt('medic', 100), 'medic');
    expect(rich.lines).toEqual([{ item: 'medkit', label: 'Medkit', price: 60, stock: 2, grant: { kind: 'medkit' }, canBuy: true, refusal: null }]);
    expect(rich.name).toBe('Doc');
    expect(merchantView(homeAt('medic', 10), 'medic').lines[0].canBuy).toBe(false);
  });

  it('cannot buy when the station is another', () => {
    expect(merchantView(homeAt('gunsmith', 100), 'medic').lines[0].canBuy).toBe(false);
  });

  it('says why a line cannot be bought', () => {
    const refusalAt = (home: HomeUi) => merchantView(home, 'medic').lines[0].refusal;
    expect(refusalAt(homeAt('medic', 10))).toBe('Not enough silver');
    expect(refusalAt(homeAt('gunsmith', 100))).toBe('Walk up to them first');
    const home = homeAt('medic', 100);
    const save = home.save!;
    const full = { ...home, save: { ...save, locker: { ...save.locker, medkits: MEDKIT_MAX } } };
    expect(refusalAt(full)).toBe('You carry all you can');
  });

  it('carries each line\'s grant, so the screen can draw it', () => {
    const lines = merchantView({ ...homeAt('medic', 500), shop: 'quartermaster', station: 'quartermaster' }, 'quartermaster').lines;
    expect(lines.find((line) => line.item === 'bottle')?.grant).toEqual({ kind: 'bottle' });
    expect(lines.find((line) => line.item === 'knife')?.grant).toEqual({ kind: 'knife' });
  });

  it('holds one greeting for a save and shows an empty shelf before the save loads', () => {
    const home = homeAt('medic', 100);
    expect(merchantView(home, 'medic').greeting).toBe(merchantView(home, 'medic').greeting);
    expect(merchantView({ ...home, save: null }, 'medic').lines).toEqual([]);
  });
});
