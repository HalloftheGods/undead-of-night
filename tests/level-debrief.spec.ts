import { describe, expect, it } from 'vitest';
import { createSimState } from '../shared/sim-factory.ts';
import { assembleDebrief, finishDebrief, leaveTown } from '../shared/run-end.ts';
import { townContainers } from '../shared/containers.ts';

describe('level debrief screen and transition', () => {
  it('assembles level debrief stats on leaving town', () => {
    const sim = createSimState({ seed: 12345, startLevel: 1 });
    const map = sim.map;
    sim.players = [
      {
        id: 'p1',
        name: 'Player 1',
        skin: 0,
        x: 0,
        y: 0,
        hp: 100,
        maxHp: 100,
        kills: 12,
        status: 'alive',
        invulnerableUntil: 0,
        speed: 1,
        bag: { items: [] },
        weapon: 'pistol',
        ammo: { pistol: 30, carbine: 0, shotgun: 0 },
        magazines: { pistol: 10, carbine: 0, shotgun: 0 },
        facing: 0,
      } as any,
    ];

    const allContainers = townContainers(map);
    if (allContainers.length > 0) {
      sim.containers[allContainers[0].id].opened = true;
      sim.containers[allContainers[0].id].openedBy = 'p1';
    }

    leaveTown(sim);

    expect(sim.debrief).not.toBeNull();
    expect(sim.debrief?.kills).toBe(12);
    expect(sim.debrief?.level).toBe(1);
    expect(sim.debrief?.containersSearched).toBe(allContainers.length > 0 ? 1 : 0);
    expect(sim.debrief?.players[0].id).toBe('p1');
    expect(sim.debrief?.players[0].kills).toBe(12);
  });

  it('resumes transition and clears debrief on finishDebrief', () => {
    const sim = createSimState({ seed: 12345, startLevel: 1 });
    sim.players = [
      {
        id: 'p1',
        name: 'Player 1',
        skin: 0,
        x: 0,
        y: 0,
        hp: 100,
        maxHp: 100,
        kills: 5,
        status: 'alive',
        invulnerableUntil: 0,
        speed: 1,
        bag: { items: [] },
        weapon: 'pistol',
        ammo: { pistol: 30, carbine: 0, shotgun: 0 },
        magazines: { pistol: 10, carbine: 0, shotgun: 0 },
        facing: 0,
      } as any,
    ];

    assembleDebrief(sim);
    expect(sim.debrief).not.toBeNull();

    finishDebrief(sim);
    expect(sim.debrief).toBeNull();
  });
});
