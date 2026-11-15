import type { KeepsakeId } from '../../shared/protocol.ts';

/** A keepsake card as the canvas drew it, in client pixels, with the key that takes it. */
export interface KeepsakeBox {
  readonly id: KeepsakeId;
  readonly code: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Set each frame by the renderer while a keepsake offer is on the canvas; empty otherwise. */
let boxes: readonly KeepsakeBox[] = [];

export function setKeepsakeBoxes(next: readonly KeepsakeBox[]): void {
  boxes = next;
}

/** The keepsake whose card is under this client point, if an offer is up. */
export function keepsakeAt(clientX: number, clientY: number): KeepsakeId | null {
  const hit = boxes.find((box) => clientX >= box.x && clientX <= box.x + box.w && clientY >= box.y && clientY <= box.y + box.h);
  return hit ? hit.id : null;
}

/** The keepsake a key takes while an offer is up, or null. */
export function keepsakeForCode(code: string): KeepsakeId | null {
  const hit = boxes.find((box) => box.code === code);
  return hit ? hit.id : null;
}
