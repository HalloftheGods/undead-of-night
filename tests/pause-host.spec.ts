import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GameSimulation } from '../shared/simulation.ts';

const source = (path: string): string => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('pause menu hosting', () => {
  it('prepares local player token and sets workbench mode to timed on promotion', () => {
    const sim = new GameSimulation({ seed: 12345, workbench: 'hold' });
    sim.addPlayer('local', 'SURVIVOR');
    expect(sim.playerCount).toBe(1);

    const bound = sim.bindLocalPlayerToken('tab-token-123');
    expect(bound).toBe(true);

    const player = sim.playerWithToken('tab-token-123');
    expect(player).toBe('local');
  });

  it('includes the multiplayer switch button and note in PauseMenu.vue', () => {
    const pause = source('../src/components/PauseMenu.vue');
    expect(pause).toContain('v-else-if="canHost"');
    expect(pause).toContain('Switch to multiplayer');
    expect(pause).toContain('Start hosting so friends can join with a code.');
    expect(pause).toContain('game.hostCurrentRun()');
    expect(pause).toContain('.pause-host');
  });

  it('exposes hostCurrentRun and isDaily on GameController', () => {
    const controller = source('../src/game/game-controller.ts');
    expect(controller).toContain('hostCurrentRun(): void');
    expect(controller).toContain('this.session.hostCurrentRun()');
    expect(controller).toContain('get isDaily(): boolean');
  });

  it('implements hostCurrentRun on RunSession with fallback preservation', () => {
    const runSession = source('../src/game/run-session.ts');
    expect(runSession).toContain('async hostCurrentRun(): Promise<void>');
    expect(runSession).toContain('this.fallbackSoloSession = localSession');
    expect(runSession).toContain('rooms.hostRoom(style, events, { public: false, existingSim: sim })');
  });
});
