import { describe, expect, it } from 'vitest';
import { EngineLoop, engineTarget } from '../src/audio/engine-sound.ts';
import type { VehicleView } from '../shared/protocol.ts';

const car = (over: Partial<VehicleView>): VehicleView =>
  ({ id: 1, body: 'sedan', x: 0, y: 0, heading: 0, speed: 0, facing: 'e', seats: [null, null], ...over }) as VehicleView;

describe('engine target', () => {
  it('is silent when no car is occupied', () => {
    expect(engineTarget([car({ speed: 200 })], 0, 0)).toBeNull();
    expect(engineTarget(undefined, 0, 0)).toBeNull();
  });

  it('follows the nearest occupied car, higher and louder with speed', () => {
    const slow = engineTarget([car({ speed: 20, seats: ['a', null] })], 0, 0);
    const fast = engineTarget([car({ speed: 200, seats: ['a', null] })], 0, 0);
    expect(slow && fast && fast.pitch > slow.pitch && fast.level > slow.level).toBe(true);
    const near = car({ id: 1, x: 10, speed: 50, seats: ['a', null] });
    const far = car({ id: 2, x: 200, speed: 220, seats: ['b', null] });
    expect(engineTarget([far, near], 0, 0)).toEqual(engineTarget([near], 0, 0));
  });

  it('reversing sounds like going forward', () => {
    const back = engineTarget([car({ speed: -60, seats: ['a', null] })], 0, 0);
    const fwd = engineTarget([car({ speed: 60, seats: ['a', null] })], 0, 0);
    expect(back).toEqual(fwd);
  });
});

/** A context that records every parameter write. */
function recordingContext() {
  const writes: Array<{ param: string; method: string; value: number }> = [];
  const param = (name: string) => ({
    set value(v: number) { writes.push({ param: name, method: 'value', value: v }); },
    setTargetAtTime: (v: number) => writes.push({ param: name, method: 'target', value: v }),
    setValueAtTime: (v: number) => writes.push({ param: name, method: 'at', value: v }),
  });
  const node = (): any => ({ connect: () => undefined, disconnect: () => undefined, start: () => undefined, stop: () => undefined, gain: param('gain'), frequency: param('freq'), type: '' });
  let made = 0;
  const ctx: any = { currentTime: 0, createOscillator: () => { made++; return node(); }, createGain: node, createBiquadFilter: node };
  return { ctx, writes, made: () => made };
}

describe('engine loop', () => {
  it('makes no nodes while silent, and fades in by ramp rather than a jump', () => {
    const { ctx, writes, made } = recordingContext();
    const loop = new EngineLoop(ctx, { connect: () => undefined } as never);
    loop.set(null);
    expect(made()).toBe(0);
    loop.set({ pitch: 80, level: 0.4 });
    expect(made()).toBeGreaterThan(0);
    const gainWrites = writes.filter((w) => w.param === 'gain');
    expect(gainWrites.some((w) => w.method === 'target' && w.value === 0.4)).toBe(true);
  });

  it('fades to zero when the car empties', () => {
    const { ctx, writes } = recordingContext();
    const loop = new EngineLoop(ctx, { connect: () => undefined } as never);
    loop.set({ pitch: 80, level: 0.4 });
    loop.set(null);
    const last = writes.filter((w) => w.param === 'gain' && w.method === 'target').at(-1);
    expect(last?.value).toBe(0);
    loop.dispose();
  });
});
