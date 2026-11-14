import { describe, expect, it } from 'vitest';
import { addZombie, quietSim } from './helpers/sim-harness.ts';
import { doorsOf, doorBlocksCircle, doorBlocksSegment, DOOR_PLANK_SEC } from '../shared/doors.ts';
import { buildSnapshot } from '../shared/snapshot-build.ts';
import { calculateDoorMaxHealth, DOOR_SPLINTER_NOISE_RADIUS } from '../shared/fortifications.ts';
import { TICK_DT } from '../shared/constants.ts';
import { containerInReach } from '../shared/containers.ts';
import type { PlayerState } from '../shared/sim-state.ts';

function world() {
  const { sim: game, state: sim } = quietSim();
  const door = doorsOf(sim).find((d) => containerInReach(sim.map, d.x, d.y + 20) === null && containerInReach(sim.map, d.x, d.y - 20) === null)!;
  // Each door rolls open or shut at the start; these scenarios begin from an open door.
  door.isOpen = true;
  return { game, sim, door, p: sim.players[0] as PlayerState };
}

function stand(p: PlayerState, x: number, y: number): void {
  p.x = x;
  p.y = y;
  p.moving = false;
}

const hold = (p: PlayerState, down: boolean): void => {
  p.searchHeld = down;
};

describe('doors in the sim', () => {
  it('rolls each door open or shut at the start, at base health', () => {
    const { sim } = world();
    const doors = doorsOf(sim);
    expect(doors.some((door) => door.isOpen)).toBe(true);
    expect(doors.some((door) => !door.isOpen)).toBe(true);
    for (const door of doors) expect(door.health).toBe(calculateDoorMaxHealth(0));
  });

  it('a press closes the door and a short press opens it again', () => {
    const { game, sim, door, p } = world();
    stand(p, door.x, door.y + 20);
    hold(p, true);
    game.step();
    expect(door.isOpen).toBe(false);
    expect(sim.events.some((e) => e.type === 'door_closed')).toBe(true);
    hold(p, false);
    game.step();
    hold(p, true);
    game.step();
    hold(p, false);
    game.step();
    expect(door.isOpen).toBe(true);
  });

  it('a closed door stops a walker and a shot', () => {
    const { game, sim, door, p } = world();
    stand(p, door.x, door.y + 20);
    hold(p, true);
    game.step();
    hold(p, false);
    game.step();
    expect(doorBlocksCircle(sim, door.x, door.y, 6)).toBe(true);
    expect(doorBlocksSegment(sim, door.x, door.y + 30, door.x, door.y - 30)).not.toBeNull();
    p.up = true;
    for (let i = 0; i < 60; i++) game.step();
    expect(p.y).toBeGreaterThan(door.y + door.h / 2);
  });

  it('will not close on a body', () => {
    const { game, door, p } = world();
    stand(p, door.x, door.y);
    hold(p, true);
    game.step();
    expect(door.isOpen).toBe(true);
  });

  it('holding with planks, nails and a hammer boards the door; sneaking pries a plank off', () => {
    const { game, sim, door, p } = world();
    p.materials.planks = 2;
    p.materials.nails = 10;
    p.materials.hasHammer = true;
    stand(p, door.x, door.y + 20);
    hold(p, true);
    game.step();
    hold(p, false);
    game.step();
    hold(p, true);
    for (let i = 0; i < Math.ceil(DOOR_PLANK_SEC / TICK_DT) + 1; i++) game.step();
    expect(door.planks).toBe(1);
    expect(p.materials.planks).toBe(1);
    expect(sim.events.some((e) => e.type === 'plank_added')).toBe(true);
    p.stance = 'sneak';
    p.stanceWanted = 'sneak';
    hold(p, false);
    game.step();
    hold(p, true);
    for (let i = 0; i < Math.ceil(DOOR_PLANK_SEC / TICK_DT) + 2; i++) game.step();
    expect(door.planks).toBe(0);
    expect(p.materials.planks).toBe(2);
  });

  it('zombies at a closed door break it and it ends open', () => {
    const { game, sim, door, p } = world();
    stand(p, door.x, door.y + 20);
    hold(p, true);
    game.step();
    hold(p, false);
    game.step();
    p.x = 5;
    p.y = 5;
    const wasClosed = !door.isOpen;
    expect(wasClosed).toBe(true);
    const ticks = Math.ceil(door.health / (20 * TICK_DT)) + 5;
    for (let i = 0; i < ticks; i++) {
      sim.zombies = [];
      for (const dy of [-12, 12]) addZombie(sim, 'walker', door.x, door.y + dy);
      game.step();
      if (door.isOpen) break;
    }
    expect(door.isOpen).toBe(true);
    expect(door.planks).toBe(0);
    expect(sim.events.some((e) => e.type === 'door_broken')).toBe(true);
    expect(DOOR_SPLINTER_NOISE_RADIUS).toBeGreaterThan(0);
  });

  it('the snapshot lists the shut doors and omits the open ones, then carries the one just closed', () => {
    const { game, sim, door, p } = world();
    stand(p, door.x, door.y + 20);
    game.step();
    // Only doors in range are listed, and an open door is never among them.
    const listed = buildSnapshot(sim).doors ?? [];
    expect(listed.every((view) => !view.open)).toBe(true);
    hold(p, true);
    game.step();
    const doors = buildSnapshot(sim).doors;
    expect(doors?.some((view) => view.open === false && view.planks === 0)).toBe(true);
  });
});
