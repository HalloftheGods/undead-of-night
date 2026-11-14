import { describe, expect, it } from 'vitest';
import {
  DragSlotGestureState,
  isTactileUpgrade,
  SlideRailGestureState,
  toTactileKind,
  TwistGestureState,
} from '../src/game/workbench-gesture.ts';

describe('workbench tactile gestures', () => {
  it('correctly identifies tactile upgrade candidates', () => {
    expect(isTactileUpgrade('suppressor')).toBe(true);
    expect(toTactileKind('suppressor')).toBe('suppressor');

    expect(isTactileUpgrade('magazine')).toBe(true);
    expect(toTactileKind('magazine')).toBe('magazine');

    expect(isTactileUpgrade('fireRate')).toBe(true);
    expect(toTactileKind('fireRate')).toBe('grip');

    expect(isTactileUpgrade('damage')).toBe(false);
    expect(toTactileKind('damage')).toBeNull();

    expect(isTactileUpgrade('reload')).toBe(false);
    expect(toTactileKind('reload')).toBeNull();
  });

  describe('TwistGestureState', () => {
    it('accumulates clockwise rotation and locks after 2 full turns', () => {
      const twist = new TwistGestureState();
      const cx = 100;
      const cy = 100;

      expect(twist.progress).toBe(0);
      expect(twist.isLocked).toBe(false);

      // Start at (150, 100) -> angle 0 rad
      twist.start(150, 100, cx, cy);

      // Move clockwise to (100, 150) -> angle +PI/2 rad
      const step1 = twist.update(100, 150, cx, cy);
      expect(step1.progress).toBeCloseTo(0.125, 2);
      expect(step1.ratcheted).toBe(true);
      expect(step1.locked).toBe(false);

      // Move counter-clockwise back to (150, 100) -> should not add progress
      const counterStep = twist.update(150, 100, cx, cy);
      expect(counterStep.progress).toBeCloseTo(0.125, 2);
      expect(counterStep.ratcheted).toBe(false);

      // Move clockwise another 1.75 turns to complete 2 full turns (4 * PI)
      const steps = 30;
      const totalSweep = Math.PI * 4;
      for (let i = 1; i <= steps; i++) {
        const currentAngle = (i / steps) * totalSweep;
        const x = cx + Math.cos(currentAngle) * 50;
        const y = cy + Math.sin(currentAngle) * 50;
        twist.update(x, y, cx, cy);
      }

      expect(twist.progress).toBe(1);
      expect(twist.isLocked).toBe(true);

      twist.reset();
      expect(twist.progress).toBe(0);
      expect(twist.isLocked).toBe(false);
    });
  });

  describe('DragSlotGestureState', () => {
    it('tracks upward drag and snaps locked past 85% threshold', () => {
      const drag = new DragSlotGestureState();

      expect(drag.progress).toBe(0);
      expect(drag.isLocked).toBe(false);

      // Start at y = 200
      drag.start(200);

      // Drag downwards (y = 220) -> downward drag is clamped to 0
      const down = drag.update(220);
      expect(down.progress).toBe(0);
      expect(down.locked).toBe(false);

      // Drag upwards 40px (y = 160) -> 40 / 80 = 50%
      const half = drag.update(160);
      expect(half.progress).toBeCloseTo(0.5, 2);
      expect(half.locked).toBe(false);

      // Drag upwards 70px (y = 130) -> 70 / 80 = 87.5% -> exceeds 85% latch threshold
      const snap = drag.update(130);
      expect(snap.progress).toBe(1);
      expect(snap.locked).toBe(true);
      expect(snap.ratcheted).toBe(true);

      drag.reset();
      expect(drag.progress).toBe(0);
      expect(drag.isLocked).toBe(false);
    });
  });

  describe('SlideRailGestureState', () => {
    it('tracks horizontal rail slide with ratchet teeth and locks at detent', () => {
      const slide = new SlideRailGestureState();

      expect(slide.progress).toBe(0);
      expect(slide.isLocked).toBe(false);

      // Start at x = 50
      slide.start(50);

      // Slide right 20px (x = 70) -> passes 18px ratchet notch
      const step1 = slide.update(70);
      expect(step1.progress).toBeCloseTo(20 / 90, 2);
      expect(step1.ratcheted).toBe(true);
      expect(step1.locked).toBe(false);

      // Slide right 80px (x = 130) -> 80 / 90 = 88.8% -> exceeds 85% latch threshold
      const snap = slide.update(130);
      expect(snap.progress).toBe(1);
      expect(snap.locked).toBe(true);
      expect(snap.ratcheted).toBe(true);

      slide.reset();
      expect(slide.progress).toBe(0);
      expect(slide.isLocked).toBe(false);
    });
  });
});
