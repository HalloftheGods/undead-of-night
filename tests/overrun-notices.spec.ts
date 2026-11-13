import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { OverrunView } from '../shared/home-protocol.ts';
import { overrunClockLine } from '../src/game/overrun-hud.ts';
import { overrunBanner } from '../src/game/run-notices.ts';

const view = (patch: Partial<OverrunView> = {}): OverrunView => ({ phase: 'counting', left: 300, slowed: false, hostiles: 0, total: 0, ...patch });

describe('overrun banners', () => {
  it('words each warning step, the last one naming how many places the fence gives and that guns are free', () => {
    const steps = [150, 75, 30].map((left, step) => overrunBanner({ type: 'overrun_warning', step, left }));
    expect(steps).toEqual([
      { title: 'SOMETHING IN THE TREES', subtitle: '2:30', tone: 'quiet' },
      { title: "THEY'RE AT THE FENCE", subtitle: '1:15', tone: 'danger' },
      { title: 'THE FENCE IS GIVING', subtitle: 'GUNS FREE', tone: 'danger' },
    ]);
    expect(overrunBanner({ type: 'overrun_warning', step: 2, left: 30, gaps: 1 })?.title).toBe('THE FENCE IS GIVING: 1 PLACE');
    expect(overrunBanner({ type: 'overrun_warning', step: 2, left: 30, gaps: 3 })?.title).toBe('THE FENCE IS GIVING: 3 PLACES');
    expect(overrunBanner({ type: 'overrun_warning', step: 0, left: 150, gaps: 3 })?.title).toBe('SOMETHING IN THE TREES');
  });

  it('counts the gaps and the hostiles at the breach', () => {
    expect(overrunBanner({ type: 'overrun_breach', hostiles: 12 })).toEqual({ title: 'THE FENCE IS DOWN', subtitle: '12 HOSTILES', tone: 'danger' });
    expect(overrunBanner({ type: 'overrun_breach', hostiles: 12, gaps: 1 })?.title).toBe('THE FENCE IS DOWN');
    expect(overrunBanner({ type: 'overrun_breach', hostiles: 12, gaps: 2 })?.title).toBe('THE FENCE IS DOWN IN 2 PLACES');
  });

  it('points a held camp at its chest, and leaves a fallen one to the death summary', () => {
    expect(overrunBanner({ type: 'overrun_end', outcome: 'held' })).toEqual({ title: 'THE CAMP HOLDS', subtitle: 'A CHEST BY THE VAN', tone: 'hope' });
    expect(overrunBanner({ type: 'overrun_end', outcome: 'lost' })).toBeNull();
  });

  it('says nothing for other events', () => {
    expect(overrunBanner({ type: 'wave_clear', wave: 1 })).toBeNull();
  });
});

describe('overrun clock line', () => {
  it('has nothing without an overrun', () => {
    expect(overrunClockLine(null)).toBeNull();
  });

  it('shows the time to the fence giving and the slowed tag', () => {
    expect(overrunClockLine(view({ left: 299.2 }))).toMatchObject({ label: 'FENCE', value: '5:00', slowed: false, urgent: false });
    expect(overrunClockLine(view({ left: 120, slowed: true }))?.slowed).toBe(true);
  });

  it('turns urgent once armed and shows hostiles once breached', () => {
    expect(overrunClockLine(view({ phase: 'armed', left: 20 }))?.urgent).toBe(true);
    expect(overrunClockLine(view({ phase: 'breached', left: 0, hostiles: 7, total: 9, slowed: true }))).toMatchObject({ label: 'HOSTILES', value: '7', slowed: false });
  });

  it('goes quiet when the overrun is settled', () => {
    expect(overrunClockLine(view({ phase: 'held', left: 0 }))).toBeNull();
  });

  it('draws over the station screens and under the pause menu and the van ride', () => {
    const source = (path: string): string => readFileSync(new URL(path, import.meta.url), 'utf8');
    const zOf = (path: string): number => Number(/z-index:\s*(\d+)/.exec(source(path))?.[1] ?? 0);
    expect(zOf('../src/components/OverrunClock.vue')).toBeLessThan(zOf('../src/components/VanTransition.vue'));
    expect(zOf('../src/components/OverrunClock.vue')).toBeLessThanOrEqual(zOf('../src/components/PauseMenu.vue'));
    const app = source('../src/App.vue');
    const at = (tag: string): number => app.indexOf(`<${tag} `);
    for (const station of ['LockerScreen', 'MerchantScreen']) expect(at(station)).toBeLessThan(at('OverrunClock'));
    for (const above of ['PauseMenu', 'VanTransition']) expect(at('OverrunClock')).toBeLessThan(at(above));
  });
});
