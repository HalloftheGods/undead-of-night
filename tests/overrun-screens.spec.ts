import { describe, expect, it } from 'vitest';
import { emptyLoadout } from '../shared/loadout.ts';
import type { Loadout } from '../shared/home-protocol.ts';
import { aimsCursor, chestLines, deathHeading, deathNote, deathSummary } from '../src/game/home-screens.ts';
import type { HomeDeath, HomeUi } from '../src/game/home-hud.ts';
import { emptySave } from '../src/game/home/home-store.ts';
import { merchantView, stallNotice } from '../src/game/home/merchant-view.ts';
import { rollStock } from '../src/game/home/shop.ts';

const gear = (patch: Partial<Loadout> = {}): Loadout => ({ ...emptyLoadout(), ...patch });
const fall = (bunkerFell: boolean, lost: Loadout): HomeDeath => ({ overrun: { bunkerFell }, lost });

describe('an overrun death', () => {
  it('names who fell', () => {
    expect(deathHeading(fall(true, gear()))).toBe('The bunker fell');
    expect(deathHeading(fall(false, gear()))).toBe('You fell holding the bunker');
  });

  it('lists only the gear in hand, then says the locker held', () => {
    const lines = deathSummary(fall(false, gear({ medkits: 2, knife: true })));
    expect(lines).toHaveLength(3);
    expect(lines.at(-1)).toBe('The locker held');
    expect(lines).toContain('2 medkits');
    expect(lines.some((line) => /silver|jewel/.test(line))).toBe(false);
  });

  it('says so when the hands were empty, and still that the locker held', () => {
    expect(deathSummary(fall(true, gear()))).toEqual(['Nothing was in your hands', 'The locker held']);
  });

  it('does not use the trip wording', () => {
    expect(deathNote(fall(false, gear()))).not.toMatch(/wake/i);
  });

  it('leaves a trip death as it was', () => {
    const trip = { receipt: { outcome: 'died', level: 3, silver: 0, jewels: { small: 1, large: 0 } }, lost: gear() } as unknown as HomeDeath;
    expect(deathHeading(trip)).toBe('You died in Three Suns');
    expect(deathSummary(trip)).toEqual(['1 small jewel', '40 silver once smelted']);
  });
});

describe('the reward chest card', () => {
  it('lists the silver, the jewels and the gear it held', () => {
    const lines = chestLines({ gear: gear({ medkits: 1 }), silver: 120, jewels: { small: 1, large: 0 } });
    expect(lines).toEqual(['120 silver', '1 small jewel', '1 medkit']);
  });

  it('shows the real cursor while it is up', () => {
    const home = { station: null, death: null, chest: { gear: gear(), silver: 1, jewels: { small: 0, large: 0 } } } as unknown as HomeUi;
    expect(aimsCursor({ screen: 'game', paused: false, mapOpen: false, bench: false, backpackOpen: false, home })).toBe(false);
  });
});

describe('a stall after a flight', () => {
  const homeWith = (stock: { closedTrips?: number; thinTrips?: number }): HomeUi => {
    const save = rollStock(emptySave(3));
    const merchants = { ...save.shop.merchants, medic: { ...save.shop.merchants.medic, ...stock } };
    return { save: { ...save, shop: { ...save.shop, merchants } }, station: 'medic', highest: 1, difficulty: 'lights_out' } as unknown as HomeUi;
  };

  it('says no one keeps a closed stall, and when a keeper comes', () => {
    const view = merchantView(homeWith({ closedTrips: 3 }), 'medic');
    expect(view.stall).toEqual({ kind: 'closed', trips: 3 });
    expect(view.notice).toBe('No one at this stall. A new keeper in 3 trips.');
    expect(merchantView(homeWith({ closedTrips: 1 }), 'medic').notice).toBe('No one at this stall. A new keeper in 1 trip.');
  });

  it('says a thin stall is short on stock', () => {
    const view = merchantView(homeWith({ thinTrips: 2 }), 'medic');
    expect(view.stall).toEqual({ kind: 'thin', trips: 2 });
    expect(view.notice).toBe('Short on stock for 2 trips');
  });

  it('says nothing of an ordinary stall', () => {
    const view = merchantView(homeWith({}), 'medic');
    expect(view.stall).toEqual({ kind: 'open' });
    expect(view.notice).toBeNull();
    expect(stallNotice({ kind: 'open' })).toBeNull();
  });
});
