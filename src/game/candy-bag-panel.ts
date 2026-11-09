// The candy bag over the run: X, or the candy in the backpack ring, opens it and the survivor picks
// which candy to eat. Like the town map it holds a solo run still, and in co-op, where nothing can
// pause, it is drawn over a town that carries on while the survivor stands still.

import type { CandyId } from '../../shared/protocol.ts';
import type { GameTransport } from '../network/transport.ts';
import type { UiState } from './hud-state.ts';
import type { InputManager } from './input-manager.ts';

export interface CandyBagHost {
  readonly ui: () => UiState;
  readonly publish: (patch: Partial<UiState>) => void;
  /** On a run, not behind the pause menu or a station: where the map could open too. */
  readonly canOpen: () => boolean;
  /** Holds or lets go of the run, as any menu over it does. */
  readonly holdRun: (held: boolean) => void;
  readonly closeBackpack: () => void;
  readonly input: InputManager;
  /** Sends one input now, carrying the candy picked. */
  readonly sendNow: () => void;
  readonly transport: () => GameTransport | null;
}

export class CandyBagPanel {
  constructor(private readonly host: CandyBagHost) {}

  /** True if the key did something. Going from the map to the bag swaps one for the other: the run is held already. */
  toggle(): boolean {
    const { bagOpen, mapOpen } = this.host.ui();
    if (bagOpen) {
      this.close();
      return true;
    }
    if (!this.host.canOpen()) return false;
    if (!mapOpen) this.host.holdRun(true);
    this.host.closeBackpack();
    this.host.publish({ bagOpen: true, mapOpen: false });
    return true;
  }

  close(): void {
    const isShut = !this.host.ui().bagOpen;
    if (isShut) return;
    this.host.holdRun(false);
    this.host.publish({ bagOpen: false });
  }

  /**
   * One candy out of the bag, eaten at once. A solo run is held behind the bag, so it is stepped
   * one tick to eat it: the bag then shows the count and the boost's time as they really are.
   */
  eat(id: CandyId): void {
    const { bagOpen, hud } = this.host.ui();
    const canEat = bagOpen && hud !== null && hud.status === 'alive' && hud.bag.some((stack) => stack.id === id);
    if (!canEat) return;
    this.host.input.pickCandy(id);
    this.host.sendNow();
    this.host.transport()?.stepHeld?.();
  }
}
