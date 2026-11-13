import type { TouchMarks } from '@engine/scene.ts';
import type { TouchInput } from './touch-input.ts';
import { STICK_TRAVEL } from './touch-stick.ts';

/** Client pixels from the crosshair to clear of a fingertip. */
const FINGERTIP_PX = 26;

interface ClientToBuffer {
  toBufferX(clientX: number): number;
  toBufferY(clientY: number): number;
}

/** The fingers' marks for this frame, or null when a mouse is the one playing. */
export function touchMarks(touch: TouchInput, view: ClientToBuffer, ms: number): TouchMarks | null {
  if (!touch.used) return null;
  const across = (clientPx: number): number => view.toBufferX(clientPx) - view.toBufferX(0);
  const spot = touch.aimSpot(ms);
  const { stick } = touch;
  return {
    aim: spot && { x: view.toBufferX(spot.x), y: view.toBufferY(spot.y) },
    stick: stick && {
      baseX: view.toBufferX(stick.baseX),
      baseY: view.toBufferY(stick.baseY),
      knobX: view.toBufferX(stick.x),
      knobY: view.toBufferY(stick.y),
      reach: across(STICK_TRAVEL),
    },
    fingertip: across(FINGERTIP_PX),
  };
}
