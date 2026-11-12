// Doors that are shut, boarded or broken in, drawn over the opening each building's own art leaves.
// From the street a front door is drawn on the shell's face and fades with it; from inside, the front
// door is its leaf in the gap of the south wall and a back door stands face on in the north wall.

import type { PlacedDoor } from '../../shared/door-view.ts';
import { DOOR_WIDTH, WALL_THICKNESS } from '../../shared/protocol.ts';
import { BOARD_SPILL, DOOR_LAP, doorDebris, shutDoorFace, shutDoorFromAbove } from '../art/environment/door-art.ts';
import { doorSpecOf } from '../art/environment/shell.ts';
import type { DoorKind, DoorSpec } from '../art/environment/shell.ts';
import type { PixelSprite } from '../art/types.ts';
import { fadedCanvas, spriteCanvas } from './sprite-cache.ts';

const HALF = DOOR_WIDTH / 2 + DOOR_LAP;
const DEBRIS_H = 8;

export class DoorLayer {
  private byBuilding = new Map<string, PlacedDoor[]>();
  private shown: readonly PlacedDoor[] = [];
  private readonly sprites = new Map<string, PixelSprite>();
  /** This frame's doors. The same list as last frame costs nothing. */
  set(doors: readonly PlacedDoor[]): void {
    if (doors === this.shown) return;
    this.shown = doors;
    this.byBuilding = new Map();
    for (const door of doors) this.byBuilding.set(door.buildingId, [...(this.byBuilding.get(door.buildingId) ?? []), door]);
  }

  private sprite(key: string, build: () => PixelSprite): PixelSprite {
    let sprite = this.sprites.get(key);
    if (!sprite) {
      sprite = build();
      this.sprites.set(key, sprite);
    }
    return sprite;
  }

  private face(spec: DoorSpec, door: PlacedDoor): PixelSprite {
    const key = `face:${spec.kind}:${spec.height}:${door.planks}:${door.worn}`;
    return this.sprite(key, () => shutDoorFace(spec, door.planks, door.worn));
  }

  private debris(kind: DoorKind): PixelSprite {
    return this.sprite(`debris:${kind}`, () => doorDebris(kind));
  }

  /** Over an open room's floor and walls: the front door from above, a back door face on. */
  drawInside(ctx: CanvasRenderingContext2D, buildingId: string, shell: PixelSprite, left: number, top: number): void {
    const { kind } = doorSpecOf(shell);
    for (const door of this.byBuilding.get(buildingId) ?? []) {
      const x = Math.round(door.x - HALF - left);
      const isBack = door.facing === 'north';
      if (door.broken) {
        const y = isBack ? door.y + WALL_THICKNESS : door.y - WALL_THICKNESS - DEBRIS_H - 1;
        ctx.drawImage(spriteCanvas(this.debris(isBack ? 'steel' : kind)), x, Math.round(y - top));
      } else if (isBack) {
        const sprite = this.sprite(`above:steel:north:${door.planks}`, () => shutDoorFromAbove('steel', door.planks, 'north'));
        ctx.drawImage(spriteCanvas(sprite), x, Math.round(door.y - top));
      } else {
        const sprite = this.sprite(`above:${kind}:${door.planks}`, () => shutDoorFromAbove(kind, door.planks));
        ctx.drawImage(spriteCanvas(sprite), x, Math.round(door.y - WALL_THICKNESS - BOARD_SPILL - top));
      }
    }
  }

  /** On the shell's front, punched through the same dither as the shell while it fades. */
  drawFront(ctx: CanvasRenderingContext2D, buildingId: string, shell: PixelSprite, left: number, top: number, step: number): void {
    const spec = doorSpecOf(shell);
    for (const door of this.byBuilding.get(buildingId) ?? []) {
      if (door.facing !== 'south') continue;
      const sprite = door.broken ? this.debris(spec.kind) : this.face(spec, door);
      const y = door.broken ? door.y - 3 : door.y - spec.height;
      const canvas = step === 0 ? spriteCanvas(sprite) : fadedCanvas(sprite, step);
      ctx.drawImage(canvas, Math.round(door.x - HALF - left), Math.round(y - top));
    }
  }
}
