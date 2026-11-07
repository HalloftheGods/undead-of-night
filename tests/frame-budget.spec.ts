import { describe, expect, it } from 'vitest';
import { FrameBudget } from '../src/engine/frame-budget.ts';

const run = (budget: FrameBudget, dt: number, seconds: number): void => {
  for (let t = 0; t < seconds; t += dt) budget.update(dt);
};

describe('FrameBudget', () => {
  it('keeps full detail while frames come at 60 fps', () => {
    const budget = new FrameBudget();
    run(budget, 1 / 60, 10);
    expect(budget.level).toBe(0);
    expect(budget.share).toBe(1);
  });

  it('sheds a step at a time while frames keep running long, and stops at the last step', () => {
    const budget = new FrameBudget();
    run(budget, 1 / 30, 0.7);
    expect(budget.level).toBe(1);
    expect(budget.share).toBe(0.5);
    run(budget, 1 / 30, 10);
    expect(budget.level).toBe(2);
    expect(budget.share).toBe(0.25);
  });

  it('rides out a single hitch', () => {
    const budget = new FrameBudget();
    run(budget, 1 / 60, 2);
    budget.update(0.05);
    run(budget, 1 / 60, 2);
    expect(budget.level).toBe(0);
  });

  it('gives detail back once the frames have had room to spare for a while', () => {
    const budget = new FrameBudget();
    run(budget, 1 / 30, 3);
    expect(budget.level).toBe(2);
    run(budget, 1 / 60, 4);
    expect(budget.level).toBe(1);
    run(budget, 1 / 60, 4);
    expect(budget.level).toBe(0);
  });

  it('ignores held frames, which pass no time', () => {
    const budget = new FrameBudget();
    for (let i = 0; i < 1000; i += 1) budget.update(0);
    expect(budget.level).toBe(0);
  });
});
