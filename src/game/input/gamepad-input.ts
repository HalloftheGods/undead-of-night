// A gamepad, read once a frame and turned into the keys the keyboard already presses, so the
// packet, the latches and the menus all work the way they do for keys. Twin-stick: the left
// stick walks, the right stick aims. Only pads the browser maps to the Standard Gamepad layout
// count; anything else is noted for the UI and otherwise left alone.

import { DOM_PAD_MENU } from './pad-focus.ts';
import type { PadMenu } from './pad-focus.ts';

/** Standard Gamepad button indexes (w3c.github.io/gamepad, "Remapping"). The bottom face button is 0 on every pad. */
export const PAD = {
  a: 0,
  b: 1,
  x: 2,
  y: 3,
  lb: 4,
  rb: 5,
  lt: 6,
  rt: 7,
  view: 8,
  start: 9,
  l3: 10,
  r3: 11,
  up: 12,
  down: 13,
  left: 14,
  right: 15,
  home: 16,
} as const;

/** Pseudo-keys for what only a pad does. The keyboard never sends them. */
export const PAD_FIRE = 'PadFire';
export const PAD_PREV_WEAPON = 'PadPrevWeapon';
/** The pad's horn button, held as this pseudo-key so a rebound keyboard horn does not matter. */
export const PAD_HORN = 'PadHorn';
const SNEAK_CODE = 'KeyC';

import { loadPadBindings } from '@game/controls-prefs.ts';

export function getActivePadBindings(): ReadonlyMap<number, string> {
  const binds = loadPadBindings();
  const map = new Map<number, string>();
  if (binds.search !== null) map.set(binds.search, 'KeyE');
  if (binds.horn !== null) map.set(binds.horn, PAD_HORN);
  if (binds.heal !== null) map.set(binds.heal, 'KeyH');
  if (binds.reload !== null) map.set(binds.reload, 'KeyR');
  if (binds.bag !== null) map.set(binds.bag, 'KeyX');
  if (binds.sprint !== null) map.set(binds.sprint, 'ShiftLeft');
  if (binds.throw !== null) map.set(binds.throw, 'KeyG');
  if (binds.melee !== null) map.set(binds.melee, 'KeyF');
  if (binds.fire !== null) map.set(binds.fire, PAD_FIRE);
  if (binds.map !== null) map.set(binds.map, 'KeyN');
  if (binds.log !== null) map.set(binds.log, 'KeyL');
  if (binds.spinner !== null) map.set(binds.spinner, 'KeyT');
  if (binds.fountain !== null) map.set(binds.fountain, 'KeyV');
  if (binds.prevWeapon !== null) map.set(binds.prevWeapon, PAD_PREV_WEAPON);
  if (binds.cycleWeapon !== null) map.set(binds.cycleWeapon, 'KeyQ');
  map.set(PAD.start, 'Escape');
  return map;
}

/** In play, each button stands for the key it presses. L3 is sneak toggle. */
export const PLAY_BINDINGS: ReadonlyMap<number, string> = new Map<number, string>([
  [PAD.a, 'KeyE'],
  [PAD.b, 'KeyH'],
  [PAD.x, 'KeyR'],
  [PAD.y, 'KeyX'],
  [PAD.lb, 'ShiftLeft'],
  [PAD.rb, 'KeyG'],
  [PAD.lt, 'KeyF'],
  [PAD.rt, PAD_FIRE],
  [PAD.view, 'KeyN'],
  [PAD.start, 'Escape'],
  [PAD.r3, 'KeyL'],
  [PAD.up, 'KeyT'],
  [PAD.down, 'KeyV'],
  [PAD.left, PAD_PREV_WEAPON],
  [PAD.right, 'KeyQ'],
]);

export type NavDirection = 'up' | 'down' | 'left' | 'right';

const DPAD_NAV: ReadonlyMap<number, NavDirection> = new Map<number, NavDirection>([
  [PAD.up, 'up'],
  [PAD.down, 'down'],
  [PAD.left, 'left'],
  [PAD.right, 'right'],
]);

/** A stick inside this reach is resting. Measured on the circle, so a diagonal is not cut short. */
export const STICK_DEADZONE = 0.2;
/** An analog trigger counts as down past this, whatever the browser says `pressed` means. */
const TRIGGER_DOWN = 0.3;
/** How far the left stick goes, past the dead zone, before it moves menu focus. */
const NAV_PUSH = 0.5;
/** Held in a menu, a direction repeats after this long, then every NAV_REPEAT_MS. */
export const NAV_REPEAT_DELAY_MS = 400;
export const NAV_REPEAT_MS = 120;
/** Half of an eighth of a turn: the movement packet has eight directions, as the touch stick does. */
const SECTOR_EDGE = Math.sin(Math.PI / 8);

export interface StickVector {
  readonly x: number;
  readonly y: number;
}

export interface PadConnection {
  readonly connected: boolean;
  readonly id: string;
  /** Mapped to the Standard Gamepad layout, so the game can read it. */
  readonly standard: boolean;
}

export interface GamepadHost {
  /** Play is on: nothing is up over the game. */
  live(): boolean;
  /** The pad was the last hand on the game, so it steers the flashlight instead of the pointer. */
  inCharge(): boolean;
  /** A button went down in play: the key it stands for. */
  press(code: string): void;
  /** A, behind a menu. */
  confirm(): void;
  /** B, behind a menu. */
  back(): void;
  /** The D-pad or left stick, behind a menu. */
  navigate(direction: NavDirection): void | boolean;
  /** The pad did something this frame. */
  onActive(): void;
  onConnection?(change: PadConnection): void;
}

/** The stick past a round dead zone, rescaled so the edge of the zone is 0 and full tilt is 1. Null while resting. */
export function radialDeadzone(x: number, y: number, deadzone = STICK_DEADZONE): StickVector | null {
  const reach = Math.hypot(x, y);
  const isResting = reach <= deadzone;
  if (isResting) return null;
  const scaled = Math.min(1, (reach - deadzone) / (1 - deadzone));
  return { x: (x / reach) * scaled, y: (y / reach) * scaled };
}

/** The direction to walk: each axis -1, 0 or 1. */
export function eightWay(stick: StickVector | null): StickVector {
  const reach = stick ? Math.hypot(stick.x, stick.y) : 0;
  if (!stick || reach === 0) return { x: 0, y: 0 };
  const across = stick.x / reach;
  const down = stick.y / reach;
  return {
    x: Math.abs(across) > SECTOR_EDGE ? Math.sign(across) : 0,
    y: Math.abs(down) > SECTOR_EDGE ? Math.sign(down) : 0,
  };
}

function navOf(stick: StickVector | null): NavDirection | null {
  const isNudge = !stick || Math.hypot(stick.x, stick.y) < NAV_PUSH;
  if (isNudge) return null;
  if (Math.abs(stick.x) > Math.abs(stick.y)) return stick.x > 0 ? 'right' : 'left';
  return stick.y > 0 ? 'down' : 'up';
}

function isDown(button: GamepadButton | undefined): boolean {
  if (!button) return false;
  return button.pressed || button.value > TRIGGER_DOWN;
}

function leftStick(pad: Gamepad): StickVector | null {
  return radialDeadzone(pad.axes[0] ?? 0, pad.axes[1] ?? 0);
}

function rightStick(pad: Gamepad): StickVector | null {
  return radialDeadzone(pad.axes[2] ?? 0, pad.axes[3] ?? 0);
}

function isBusy(pad: Gamepad): boolean {
  return pad.buttons.some(isDown) || leftStick(pad) !== null || rightStick(pad) !== null;
}

/** Connected pads. Empty where there is no Gamepad API, or a permissions policy blocks it (getGamepads throws). */
export function readPads(): Gamepad[] {
  try {
    const list = globalThis.navigator?.getGamepads?.() ?? [];
    return Array.from(list).filter((pad): pad is Gamepad => pad !== null && pad.connected);
  } catch {
    return [];
  }
}

export interface GamepadOptions {
  /** Milliseconds, for the menu repeat. Defaults to the page clock. */
  readonly now?: () => number;
  /** What moves focus and clicks behind a menu. Defaults to the page's own buttons (pad-focus.ts). */
  readonly menu?: PadMenu;
}

function pageClock(): number {
  return globalThis.performance?.now() ?? Date.now();
}

/**
 * One pad in charge at a time: the last one touched. Held buttons are re-read every frame, so a
 * pad that goes away lets go of everything at once. A button pressed behind a menu is spent there,
 * and does not count in play until it comes back up.
 *
 * Behind a menu the D-pad and left stick step focus (and repeat while held), A clicks the focused
 * control or else asks the host to confirm, B clicks the screen's Back or Close or else asks the
 * host to go back. The host may answer `navigate` with true to say it moved focus itself.
 */
export class GamepadInput {
  /** The pad in charge, for button prompts, or null with none. */
  id: string | null = null;
  /** A connected pad the browser could not map to the standard layout, so the UI can say why it does nothing. */
  unsupportedId: string | null = null;

  private readonly host: GamepadHost;
  private readonly menu: PadMenu;
  private readonly now: () => number;
  private held = new Set<string>();
  private readonly lastDown = new Map<number, readonly boolean[]>();
  private readonly spent = new Set<number>();
  private activeIndex: number | null = null;
  private move: StickVector | null = null;
  private aim: StickVector | null = null;
  private sneaking = false;
  private navDirection: NavDirection | null = null;
  private navNextAt = Infinity;

  // TODO(rumble): out of scope for the first slice. Gamepad.vibrationActuator is optional and
  // Chrome/Edge-only (playEffect('dual-rumble', { duration, strongMagnitude, weakMagnitude })).
  // Hook it to kill-juice and damage taken, behind the screen-shake preference in motion.ts.

  constructor(host: GamepadHost, options: GamepadOptions = {}) {
    this.host = host;
    this.menu = options.menu ?? DOM_PAD_MENU;
    this.now = options.now ?? pageClock;
    window.addEventListener('gamepadconnected', this.onConnected);
    window.addEventListener('gamepaddisconnected', this.onDisconnected);
  }

  dispose(): void {
    window.removeEventListener('gamepadconnected', this.onConnected);
    window.removeEventListener('gamepaddisconnected', this.onDisconnected);
  }

  get dirX(): number {
    return this.host.live() ? eightWay(this.move).x : 0;
  }

  get dirY(): number {
    return this.host.live() ? eightWay(this.move).y : 0;
  }

  /** The key this pad is holding down right now. */
  holds(code: string): boolean {
    return this.held.has(code);
  }

  /**
   * The angle to face, or null to leave it to the pointer or a finger. The right stick aims; with
   * it resting, the flashlight goes where the player walks, and stays put when they stop.
   */
  look(current: number): number | null {
    if (!this.host.inCharge()) return null;
    // TODO(aim-assist): out of scope for the first slice. Bend `aim` toward the nearest zombie in a narrow cone here.
    const steer = this.aim ?? this.move;
    return steer ? Math.atan2(steer.y, steer.x) : current;
  }

  /** Once a frame: read the pad in charge, fire its presses, and settle what it holds. */
  poll(): void {
    const pads = readPads();
    const standard = pads.filter((pad) => pad.mapping === 'standard');
    this.unsupportedId = pads.find((pad) => pad.mapping !== 'standard')?.id ?? null;
    this.forgetGone(standard);
    const pad = this.choose(standard);
    for (const other of standard) if (other !== pad) this.lastDown.set(other.index, other.buttons.map(isDown));
    if (pad) this.read(pad);
    else this.letGo();
  }

  private forgetGone(pads: readonly Gamepad[]): void {
    const present = new Set(pads.map((pad) => pad.index));
    for (const index of [...this.lastDown.keys()]) if (!present.has(index)) this.lastDown.delete(index);
    const activeGone = this.activeIndex !== null && !present.has(this.activeIndex);
    if (activeGone) this.letGo();
  }

  /** The pad in charge keeps it while busy; an idle one gives way to any pad that is being used. */
  private choose(pads: readonly Gamepad[]): Gamepad | null {
    const current = pads.find((pad) => pad.index === this.activeIndex) ?? null;
    const keepsIt = current !== null && isBusy(current);
    if (keepsIt) return current;
    const busy = pads.find(isBusy);
    if (!busy) return current;
    if (busy.index !== this.activeIndex) this.takeOver(busy);
    return busy;
  }

  private takeOver(pad: Gamepad): void {
    this.letGo();
    this.activeIndex = pad.index;
  }

  /** Hands off: nothing held, nothing pushed, no sneak left switched on. */
  private letGo(): void {
    this.activeIndex = null;
    this.id = null;
    this.held = new Set();
    this.spent.clear();
    this.move = null;
    this.aim = null;
    this.sneaking = false;
    this.navDirection = null;
    this.navNextAt = Infinity;
  }

  private read(pad: Gamepad): void {
    const down = pad.buttons.map(isDown);
    const before = this.lastDown.get(pad.index) ?? [];
    this.lastDown.set(pad.index, down);
    this.id = pad.id;
    this.move = leftStick(pad);
    this.aim = rightStick(pad);
    const pressed = down.map((isNow, index) => isNow && !before[index]);
    down.forEach((isNow, index) => {
      if (!isNow) this.spent.delete(index);
    });
    const isActive = pressed.some(Boolean) || this.move !== null || this.aim !== null;
    if (isActive) this.host.onActive();
    const live = this.host.live();
    pressed.forEach((isPressed, index) => {
      if (!isPressed) return;
      if (live) this.playPress(index);
      else this.menuPress(index);
    });
    this.navStep(live, down);
    this.held = this.heldCodes(down);
  }

  private playPress(index: number): void {
    const isSneakToggle = index === PAD.l3;
    if (isSneakToggle) {
      this.sneaking = !this.sneaking;
      return;
    }
    const bindings = getActivePadBindings();
    const sprintBtn = loadPadBindings().sprint;
    if (sprintBtn !== null && index === sprintBtn) this.sneaking = false;
    const code = bindings.get(index);
    if (code) this.host.press(code);
  }

  private menuPress(index: number): void {
    this.spent.add(index);
    if (index === PAD.start) this.host.press('Escape');
    else if (index === PAD.view) this.host.press('KeyN');
    else if (index === PAD.a) this.confirm();
    else if (index === PAD.b) this.back();
    // The D-pad is spent above and moves focus in navStep, so a held one repeats.
  }

  /** A: the focused control takes it; with none focused, the screen's own confirm. */
  private confirm(): void {
    if (this.menu.activate()) return;
    this.host.confirm();
  }

  /** B: the screen's Back or Close takes it; with none showing, the host's back (the pause path). */
  private back(): void {
    if (this.menu.back()) return;
    this.host.back();
  }

  /** The D-pad (first of up, down, left, right held), else the left stick pushed past halfway. */
  private navTarget(down: readonly boolean[]): NavDirection | null {
    for (const [index, direction] of DPAD_NAV) if (down[index]) return direction;
    return navOf(this.move);
  }

  /**
   * One step per push, then a repeat after NAV_REPEAT_DELAY_MS and every NAV_REPEAT_MS while held.
   * A direction already held when a menu opens waits to be let go: it moved the survivor, not focus.
   */
  private navStep(live: boolean, down: readonly boolean[]): void {
    const direction = this.navTarget(down);
    if (direction === null) {
      this.navDirection = null;
      this.navNextAt = Infinity;
      return;
    }
    if (live) {
      this.navDirection = direction;
      this.navNextAt = Infinity;
      return;
    }
    const at = this.now();
    const isNewPush = direction !== this.navDirection;
    const isRepeat = !isNewPush && at >= this.navNextAt;
    if (!isNewPush && !isRepeat) return;
    this.navDirection = direction;
    this.navNextAt = at + (isNewPush ? NAV_REPEAT_DELAY_MS : NAV_REPEAT_MS);
    const moved = this.host.navigate(direction);
    if (moved !== true) this.menu.navigate(direction);
  }

  private heldCodes(down: readonly boolean[]): Set<string> {
    const held = new Set<string>();
    const bindings = getActivePadBindings();
    for (const [index, code] of bindings) {
      const counts = down[index] && !this.spent.has(index);
      if (counts) held.add(code);
    }
    if (this.sneaking) held.add(SNEAK_CODE);
    return held;
  }

  private readonly onConnected = (event: GamepadEvent): void => {
    const { id, mapping } = event.gamepad;
    this.host.onConnection?.({ connected: true, id, standard: mapping === 'standard' });
  };

  /** Some browsers drop the pad from getGamepads a frame late; this lets go at once. */
  private readonly onDisconnected = (event: GamepadEvent): void => {
    const { id, index, mapping } = event.gamepad;
    this.lastDown.delete(index);
    if (index === this.activeIndex) this.letGo();
    this.host.onConnection?.({ connected: false, id, standard: mapping === 'standard' });
  };
}
