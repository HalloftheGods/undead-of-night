import { TICK_DT } from '../../shared/constants.ts';
import type { Point } from '../../shared/flow-field.ts';
import type { GameTransport } from '../network/transport.ts';
import type { ClientWorld } from './client-world.ts';
import type { InputManager } from './input-manager.ts';

const MAX_INPUTS_PER_FRAME = 2;

/** Numbers the player's inputs and hands them to the sim at its rate, however fast this display runs. */
export class InputSender {
  private readonly input: InputManager;
  private clock = 0;
  private seq = 0;
  /** The crosshair in the drawn world, while there is one. */
  aimPoint: Point | null = null;

  constructor(input: InputManager) {
    this.input = input;
  }

  reset(): void {
    this.clock = 0;
    this.aimPoint = null;
  }

  send(transport: GameTransport, world: ClientWorld, aim: number, dirX: number, dirY: number, dt: number): void {
    this.clock += dt;
    let budget = MAX_INPUTS_PER_FRAME;
    while (this.clock >= TICK_DT && budget > 0) {
      this.clock -= TICK_DT;
      budget -= 1;
      this.seq += 1;
      const point = this.aimPoint;
      const aimFields = point ? { aimX: point.x, aimY: point.y } : {};
      transport.sendInput({ ...this.input.sample(this.seq, aim, world.localPlayer), ...aimFields });
      world.recordInput(this.seq, dirX, dirY);
    }
    const fellBehind = this.clock >= TICK_DT;
    if (fellBehind) this.clock = 0;
  }

  /** For when the keys have just been let go, so a teammate does not keep running. */
  sendNeutral(transport: GameTransport, world: ClientWorld): void {
    this.seq += 1;
    const angle = world.localPlayer?.angle ?? 0;
    transport.sendInput(this.input.sample(this.seq, angle, null));
    world.recordInput(this.seq, 0, 0);
  }
}
