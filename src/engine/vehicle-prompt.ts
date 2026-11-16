// The words over a survivor who can get into a car or out of one.

import type { VehicleHint } from './scene.ts';

/** What the search key does at a car: DRIVE (with a hold to search its boot when it has one) or EXIT. Touch has no key to name. */
export function vehiclePrompt(hint: VehicleHint, touch: boolean, hold = 'E'): string {
  const keyed = touch ? '' : `${hold}: `;
  if (hint.kind === 'exit') return `${keyed}EXIT`;
  const boot = hint.boot ? ' / HOLD: SEARCH' : '';
  return `${keyed}DRIVE${boot}`;
}

export interface DrivingActionPrompt {
  readonly key?: string;
  readonly label: string;
}

export interface DrivingPrompts {
  readonly gas: DrivingActionPrompt;
  readonly brakeOrReverse: DrivingActionPrompt;
  readonly turnLeft: DrivingActionPrompt;
  readonly turnRight: DrivingActionPrompt;
  readonly exit?: DrivingActionPrompt;
}

export interface DrivingPromptOptions {
  readonly touch: boolean;
  readonly speed: number;
  readonly canExit: boolean;
  readonly holdKey?: string;
  readonly upKey?: string;
  readonly downKey?: string;
  readonly leftKey?: string;
  readonly rightKey?: string;
}

/**
 * Commands around a driven vehicle: gas forward, brake or reverse behind,
 * turn left and turn right aligned to the car's flanks, and exit when slow or stopped.
 * Separates the key from label so the renderer stacks them to prevent horizontal clashes.
 */
export function drivingPrompts(options: DrivingPromptOptions): DrivingPrompts {
  const {
    touch,
    speed,
    canExit,
    holdKey = 'E',
    upKey = 'UP/W',
    downKey = 'DOWN/S',
    leftKey = 'LEFT/A',
    rightKey = 'RIGHT/D',
  } = options;
  const isReverse = speed <= 0;
  const gas: DrivingActionPrompt = touch ? { label: 'GAS' } : { key: upKey, label: 'GAS' };
  const brakeOrReverse: DrivingActionPrompt = touch
    ? { label: isReverse ? 'REVERSE' : 'BREAK' }
    : { key: downKey, label: isReverse ? 'REVERSE' : 'BREAK' };
  const turnLeft: DrivingActionPrompt = touch
    ? { label: 'TURN LEFT' }
    : { key: leftKey, label: 'TURN LEFT' };
  const turnRight: DrivingActionPrompt = touch
    ? { label: 'TURN RIGHT' }
    : { key: rightKey, label: 'TURN RIGHT' };
  const exitPrompt: DrivingActionPrompt = touch ? { label: 'EXIT' } : { key: holdKey, label: 'EXIT' };
  const exit: DrivingActionPrompt | undefined = canExit ? exitPrompt : undefined;

  return { gas, brakeOrReverse, turnLeft, turnRight, exit };
}


