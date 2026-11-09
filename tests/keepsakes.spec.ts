import { describe, expect, it } from 'vitest';
import { CANDY_SEC, candySeconds } from '../shared/candy.ts';
import { WEAPONS } from '../shared/constants.ts';
import { ammoCapOf, KEEPSAKE_ORDER, offerDue, offerFor, OFFER_SIZE } from '../shared/keepsakes.ts';
import { hurtPlayer } from '../shared/player-health.ts';
import { parseClientPacket } from '../shared/room/client-packets.ts';
import { boardVan, eventsOf, input, openLevelExit, quietSim } from './helpers/sim-harness.ts';

describe('keepsakes', () => {
  it('are offered entering towns 3, 5, 7 and 9', () => {
    const due = Array.from({ length: 10 }, (_, i) => i + 1).filter(offerDue);
    expect(due).toEqual([3, 5, 7, 9]);
  });

  it('offers three the survivor does not have, the same each time', () => {
    const p = { id: 'a', keepsakes: ['bandolier' as const] };
    const offer = offerFor(99, p);
    expect(offer).toHaveLength(OFFER_SIZE);
    expect(new Set(offer).size).toBe(OFFER_SIZE);
    expect(offer).not.toContain('bandolier');
    expect(offerFor(99, p)).toEqual(offer);
    expect(offerFor(99, { id: 'a', keepsakes: KEEPSAKE_ORDER.slice(0, 7) })).toEqual([KEEPSAKE_ORDER[7]]);
  });

  it('makes an offer on reaching town 3, and keeps the one picked for the run', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    openLevelExit(state);
    boardVan(sim, state);
    expect(p.keepsakeOffer).toBeNull();
    openLevelExit(state);
    boardVan(sim, state);
    expect(state.level).toBe(3);
    const offer = p.keepsakeOffer ?? [];
    expect(offer).toHaveLength(3);
    expect(sim.snapshot().players[0].keepsakeOffer).toEqual(offer);

    const notOffered = KEEPSAKE_ORDER.find((id) => !offer.includes(id))!;
    sim.setInput('a', input({ seq: 1, keepsake: notOffered }));
    sim.step();
    expect(p.keepsakes).toEqual([]);

    sim.setInput('a', input({ seq: 2, keepsake: offer[1] }));
    sim.step();
    expect(p.keepsakes).toEqual([offer[1]]);
    expect(p.keepsakeOffer).toBeNull();
    expect(eventsOf(sim.snapshot(), 'keepsake_taken')).toEqual([{ type: 'keepsake_taken', playerId: 'a', keepsake: offer[1] }]);
  });

  it('carries more ammo with a Bandolier, and candy lasts half as long again with the bag', () => {
    const { state } = quietSim();
    const [p] = state.players;
    expect(ammoCapOf(p, 'pistol')).toBe(WEAPONS.pistol.reserveCap);
    p.keepsakes = ['bandolier', 'treat_bag'];
    expect(ammoCapOf(p, 'pistol')).toBeGreaterThan(WEAPONS.pistol.reserveCap);
    expect(candySeconds('ghost_gum', p)).toBeCloseTo(CANDY_SEC * 1.5);
  });

  it('bleeds out slower with a Rosary', () => {
    const { state } = quietSim(['a', 'b', 'c']);
    const [plain, holy] = state.players;
    holy.keepsakes = ['rosary'];
    hurtPlayer(state, plain, 1000);
    hurtPlayer(state, holy, 1000);
    expect(holy.bleedout).toBeCloseTo(plain.bleedout * 1.5);
  });

  it('reads the eat and keepsake fields off a remote input, and drops a made-up keepsake', () => {
    const base = input({ seq: 1 });
    const packet = parseClientPacket(JSON.stringify({ type: 'input', input: { ...base, eat: true, keepsake: 'rosary' } }));
    expect(packet).toMatchObject({ type: 'input', input: { eat: true, keepsake: 'rosary' } });
    const picked = parseClientPacket(JSON.stringify({ type: 'input', input: { ...base, eat: 'jawbreaker' } }));
    expect(picked).toMatchObject({ type: 'input', input: { eat: 'jawbreaker' } });
    const madeCandy = parseClientPacket(JSON.stringify({ type: 'input', input: { ...base, eat: 'toffee' } }));
    expect(madeCandy && 'input' in madeCandy ? madeCandy.input.eat : 'missing').toBeUndefined();
    const made = parseClientPacket(JSON.stringify({ type: 'input', input: { ...base, keepsake: 'horseshoe' } }));
    expect(made && 'input' in made ? made.input.keepsake : 'missing').toBeUndefined();
  });
});
