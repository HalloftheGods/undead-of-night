import type { CandyId, KeepsakeId } from '../../shared/protocol.ts';
import { WEAPON_ORDER } from '../../shared/protocol.ts';
import type { ClientInputPacket, Stance, WeaponId } from '../../shared/protocol.ts';
import { GamepadInput, PAD_FIRE, PAD_PREV_WEAPON } from './gamepad-input.ts';
import type { NavDirection, PadConnection } from './gamepad-input.ts';
import type { SwipeDirection } from './swipe-gesture.ts';
import { TouchInput } from './touch-input.ts';
import { loadKeyBindings } from './controls-prefs.ts';

/** One notch of the wheel per this long, so a trackpad's flurry of events is one step. */
export const WHEEL_COOLDOWN_MS = 110;

const DEFAULT_WEAPON_KEYS: Readonly<Record<string, WeaponId>> = {
  Digit1: 'pistol',
  Digit2: 'carbine',
  Digit3: 'shotgun',
};

const LEFT_BUTTON = 0;
/** Nothing in play used the middle button, so it opens the backpack. */
const MIDDLE_BUTTON = 1;
const RIGHT_BUTTON = 2;
const LEFT_BUTTON_BIT = 1;
const RIGHT_BUTTON_BIT = 2;

function isGameCode(code: string): boolean {
  const binds = loadKeyBindings();
  return Object.values(binds).some((codes) => codes.includes(code)) || code === 'Space';
}

/** The last hand on the game, for button prompts and for who steers the flashlight. */
export type InputDevice = 'keyboard' | 'touch' | 'gamepad';

/** The platform for leaderboard tracking. Maps InputDevice to Platform. */
export type { Platform } from '../../shared/home-protocol.ts';
import type { Platform } from '../../shared/home-protocol.ts';

/** Converts an InputDevice to a Platform for leaderboard tracking. */
export function toPlatform(device: InputDevice): Platform {
  return device === 'keyboard' ? 'desktop' : device;
}

export interface InputCallbacks {
  /** First key or click, the moment browsers allow audio to start. */
  onGesture(): void;
  onPause(): void;
  onMute(): void;
  /** Enter, when no button has focus to answer it. */
  onConfirm(): void;
  /** Tab or N. True if the game took the key, so Tab does not also move focus. */
  onMap(): boolean;
  /** X: the candy bag. True if the game took the key. */
  onBag?(): boolean;
  /** A middle-click: the backpack ring. True if the game took it. */
  onBackpack?(): boolean;
  /** The map is open or could open, so a Tab held down must stay away from the browser. */
  mapUsable(): boolean;
  /** The first touch of the page. */
  onTouchSeen?(): void;
  /** L: the run's full log. True if the game took the key. */
  onLog?(): boolean;
  /** The hand on the game changed: keys and mouse, a finger, or a gamepad. */
  onDeviceChange?(device: InputDevice): void;
  /** The D-pad or left stick behind a menu: move focus that way. */
  onNavigate?(direction: NavDirection): void;
  /** A gamepad came or went. */
  onGamepadConnection?(change: PadConnection): void;
  /** Touch aim assist: returns adjusted coordinates if snapping to a target. */
  aimAssist?(x: number, y: number): { x: number; y: number } | null;
}

interface OwnedWeapons {
  readonly owned: readonly WeaponId[];
  readonly weapon: WeaponId;
}

/** The next weapon the player owns, stepping through WEAPON_ORDER and wrapping. */
export function cycleWeapon(state: OwnedWeapons, step: number): WeaponId | null {
  const owned = WEAPON_ORDER.filter((weapon) => state.owned.includes(weapon));
  const hasNoOtherGun = owned.length < 2 || step === 0;
  if (hasNoOtherGun) return null;
  const current = Math.max(0, owned.indexOf(state.weapon));
  return owned[(current + step + owned.length * 8) % owned.length];
}

/** A slider is an input too, but nothing is typed into it. */
function isTyping(target: EventTarget | null): boolean {
  const isSlider = target instanceof HTMLInputElement && target.type === 'range';
  if (isSlider) return false;
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}

/** With Ctrl, Cmd or Alt down a key is the browser's shortcut, not the game's. */
function isShortcut(event: KeyboardEvent): boolean {
  return event.ctrlKey || event.metaKey || event.altKey;
}

/**
 * Keyboard, mouse, touch and gamepad. One-shot requests latch until sampled. Held state follows
 * the player's hands even while a menu is up, and only counts while enabled, so a key held
 * through a menu takes effect again the moment it closes.
 */
export class InputManager {
  pointerClientX = 0;
  pointerClientY = 0;
  readonly touch: TouchInput;
  readonly gamepad: GamepadInput;
  /** The last hand on the game. */
  lastDevice: InputDevice = 'keyboard';

  private readonly callbacks: InputCallbacks;
  private readonly held = new Set<string>();
  private enabled = false;
  private firing = false;
  private shoving = false;
  private fireLatch = false;
  private shoveLatch = false;
  private healLatch = false;
  private throwLatch = false;
  private spinnerLatch = false;
  private fountainLatch = false;
  /** The candy picked out of the bag, sent with the next input. */
  private eatLatch: CandyId | null = null;
  private keepsakeLatch: KeepsakeId | null = null;
  private reloadLatch = false;
  private weaponLatch: WeaponId | null = null;
  private cycleLatch = 0;
  private lastWheelAt = 0;

  constructor(callbacks: InputCallbacks) {
    this.callbacks = callbacks;
    this.pointerClientX = window.innerWidth / 2;
    this.pointerClientY = window.innerHeight / 2;
    this.touch = new TouchInput({
      live: () => this.enabled,
      aimAt: (x, y) => {
        this.pointerClientX = x;
        this.pointerClientY = y;
      },
      onGesture: () => {
        this.use('touch');
        this.callbacks.onGesture();
      },
      onSeen: () => this.callbacks.onTouchSeen?.(),
      onSwipe: (direction) => this.handleSwipe(direction),
      aimAssist: (x, y) => this.callbacks.aimAssist?.(x, y) ?? null,
    });
    this.lastDevice = this.touch.used ? 'touch' : 'keyboard';
    // A pad press is not a user activation, so it does not count as the gesture that lets audio start.
    this.gamepad = new GamepadInput({
      live: () => this.enabled,
      inCharge: () => this.lastDevice === 'gamepad',
      press: (code) => this.gamepadPress(code),
      confirm: () => this.gamepadConfirm(),
      back: () => this.callbacks.onPause(),
      navigate: (direction) => this.callbacks.onNavigate?.(direction),
      onActive: () => this.use('gamepad'),
      onConnection: (change) => this.callbacks.onGamepadConnection?.(change),
    });
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('blur', this.clearHeld);
  }

  dispose(): void {
    this.touch.dispose();
    this.gamepad.dispose();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('contextmenu', this.onContextMenu);
    window.removeEventListener('blur', this.clearHeld);
  }

  /** Once a frame, menus included, so Start and the D-pad answer there too. */
  pollGamepad(): void {
    this.gamepad.poll();
  }

  /** Off while any menu is up; nothing typed or clicked there reaches the game. */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.touch.letGo();
    this.clearLatches();
  }

  /** Lets go of everything, as if the player had taken their hands off. */
  readonly clearHeld = (): void => {
    this.held.clear();
    this.firing = false;
    this.shoving = false;
    this.touch.letGo();
    this.clearLatches();
  };

  /**
   * Lets go of the mouse buttons and leaves the keys alone: the backpack ring can open over a
   * held trigger, and the survivor must keep walking while it is up.
   */
  letGoButtons(): void {
    this.firing = false;
    this.shoving = false;
    this.fireLatch = false;
    this.shoveLatch = false;
  }

  /** The candy the player picked out of the bag, sent with the next input. */
  pickCandy(id: CandyId): void {
    this.eatLatch = id;
  }

  /** The keepsake card the player chose, sent with the next input. */
  pickKeepsake(id: KeepsakeId): void {
    this.keepsakeLatch = id;
  }

  private clearLatches(): void {
    this.fireLatch = false;
    this.shoveLatch = false;
    this.healLatch = false;
    this.throwLatch = false;
    this.spinnerLatch = false;
    this.fountainLatch = false;
    this.eatLatch = null;
    this.keepsakeLatch = null;
    this.reloadLatch = false;
    this.weaponLatch = null;
    this.cycleLatch = 0;
    this.touch.clearLatch();
  }

  private use(device: InputDevice): void {
    if (this.lastDevice === device) return;
    this.lastDevice = device;
    this.callbacks.onDeviceChange?.(device);
  }

  /** Routes a swipe gesture to the appropriate action. */
  private handleSwipe(direction: SwipeDirection): void {
    switch (direction) {
      case 'up':
        this.reloadLatch = true;
        break;
      case 'down':
        this.callbacks.onPause();
        break;
      case 'left':
        this.cycleLatch -= 1;
        break;
      case 'right':
        this.cycleLatch += 1;
        break;
    }
  }

  private isHeld(codes: readonly string[]): boolean {
    return this.enabled && codes.some((code) => this.held.has(code) || this.gamepad.holds(code));
  }

  get dirX(): number {
    const binds = loadKeyBindings();
    return Math.sign(Number(this.isHeld(binds.moveRight)) - Number(this.isHeld(binds.moveLeft)) + this.touch.dirX + this.gamepad.dirX);
  }

  /** Sneak wins over sprint, as it does in the sim. */
  get stance(): Stance {
    const binds = loadKeyBindings();
    if (this.isHeld(binds.sneak)) return 'sneak';
    return this.isHeld(binds.sprint) ? 'sprint' : 'walk';
  }

  get dirY(): number {
    const binds = loadKeyBindings();
    return Math.sign(Number(this.isHeld(binds.moveDown)) - Number(this.isHeld(binds.moveUp)) + this.touch.dirY + this.gamepad.dirY);
  }

  /**
   * A touch or pad press that opens a screen rather than reaching the sim: the pause menu, the map,
   * the candy bag and, off a pad, the log. True if it was one.
   */
  private pressPanel(code: string, withLog: boolean): boolean {
    const binds = loadKeyBindings();
    const isMap = binds.map.includes(code) || code === 'Tab';
    const isBag = binds.bag.includes(code);
    const isLog = withLog && (binds.log.includes(code) || code === 'KeyL');
    if (code === 'Escape') {
      this.callbacks.onPause();
      return true;
    }
    if (isBag) {
      this.callbacks.onBag?.();
      return true;
    }
    if (isMap) {
      this.callbacks.onMap();
      return true;
    }
    if (isLog) {
      this.callbacks.onLog?.();
      return true;
    }
    return false;
  }

  /** A touch button goes down as the key it stands for. */
  padDown(code: string): void {
    const tookPanel = this.pressPanel(code, false);
    if (tookPanel) return;
    this.held.add(code);
    const isLive = this.enabled;
    if (isLive) this.latch(code);
  }

  padUp(code: string): void {
    this.held.delete(code);
  }

  /** Builds the packet for this tick and spends the latches. */
  sample(seq: number, angle: number, weapons: OwnedWeapons | null): ClientInputPacket {
    const cycled = weapons ? cycleWeapon(weapons, this.cycleLatch) : null;
    const binds = loadKeyBindings();
    const packet: ClientInputPacket = {
      seq,
      up: this.isHeld(binds.moveUp) || this.touch.dirY < 0 || this.gamepad.dirY < 0,
      down: this.isHeld(binds.moveDown) || this.touch.dirY > 0 || this.gamepad.dirY > 0,
      left: this.isHeld(binds.moveLeft) || this.touch.dirX < 0 || this.gamepad.dirX < 0,
      right: this.isHeld(binds.moveRight) || this.touch.dirX > 0 || this.gamepad.dirX > 0,
      angle,
      ...(this.touch.used ? { touch: true } : {}),
      shoot: this.fireLatch || (this.enabled && this.firing) || this.touch.shooting || this.isHeld([PAD_FIRE]),
      reload: this.reloadLatch,
      weapon: this.weaponLatch ?? cycled,
      melee: this.shoveLatch || (this.enabled && this.shoving) || this.isHeld(binds.melee),
      heal: this.healLatch,
      ...(this.throwLatch ? { throw: true } : {}),
      ...(this.spinnerLatch ? { spinner: true } : {}),
      ...(this.fountainLatch ? { fountain: true } : {}),
      ...(this.eatLatch ? { eat: this.eatLatch } : {}),
      ...(this.keepsakeLatch ? { keepsake: this.keepsakeLatch } : {}),
      search: this.isHeld(binds.search),
      ...(this.stance === 'sneak' ? { sneak: true } : {}),
      ...(this.stance === 'sprint' ? { sprint: true } : {}),
    };
    this.clearLatches();
    return packet;
  }

  /** A pad button in play, as the key it stands for. Start, View and R3 reach the panels whatever is up. */
  private gamepadPress(code: string): void {
    const tookPanel = this.pressPanel(code, true);
    const isLive = !tookPanel && this.enabled;
    if (isLive) this.latch(code);
  }

  /** A behind a menu: the focused button answers it, as it answers Enter, else the screen's own confirm. */
  private gamepadConfirm(): void {
    const focused = typeof document === 'undefined' ? null : document.activeElement;
    if (focused instanceof HTMLButtonElement) focused.click();
    else this.callbacks.onConfirm();
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    this.use('keyboard');
    const isHandled = isShortcut(event) || this.menuKey(event);
    if (isHandled) return;
    if (isTyping(event.target)) return;
    this.callbacks.onGesture();
    const tookPanelKey = this.panelKey(event);
    if (!tookPanelKey) this.gameKey(event);
  };

  /** Escape and Enter, which work even while typing. True if the key was one of them. */
  private menuKey(event: KeyboardEvent): boolean {
    const isPause = event.code === 'Escape';
    if (isPause) {
      event.preventDefault();
      if (!event.repeat) this.callbacks.onPause();
      return true;
    }
    const isEnter = event.code === 'Enter' || event.code === 'NumpadEnter';
    if (isEnter) {
      this.callbacks.onGesture();
      // A focused button already answers Enter with a click.
      const isUnclaimedPress = !event.repeat && !(event.target instanceof HTMLButtonElement);
      if (isUnclaimedPress) this.callbacks.onConfirm();
    }
    return isEnter;
  }

  /** Mute, the log, the map and the candy bag. True if the key was one of them. */
  private panelKey(event: KeyboardEvent): boolean {
    const { code, repeat } = event;
    const binds = loadKeyBindings();
    const isMute = code === 'KeyM';
    const isLog = binds.log.includes(code);
    const isMap = binds.map.includes(code);
    const isBag = binds.bag.includes(code);
    const shouldMute = isMute && !repeat;
    if (shouldMute) this.callbacks.onMute();
    let taken = false;
    if (isLog) taken = !repeat && (this.callbacks.onLog?.() ?? false);
    if (isMap) taken = repeat ? this.callbacks.mapUsable() : this.callbacks.onMap();
    if (isBag) taken = !repeat && (this.callbacks.onBag?.() ?? false);
    if (taken) event.preventDefault();
    return isMute || isLog || isMap || isBag;
  }

  /** A movement or action key: held for movement, latched for one-shot actions while input is on. */
  private gameKey(event: KeyboardEvent): void {
    if (!isGameCode(event.code)) return;
    this.held.add(event.code);
    if (!this.enabled) return;
    event.preventDefault();
    if (!event.repeat) this.latch(event.code);
  }

  private latch(code: string): void {
    const binds = loadKeyBindings();
    const isReload = binds.reload.includes(code);
    if (isReload) this.reloadLatch = true;
    const isCycle = binds.cycleWeapon.includes(code);
    if (isCycle) this.cycleLatch += 1;
    const isCycleBack = binds.prevWeapon.includes(code) || code === PAD_PREV_WEAPON;
    if (isCycleBack) this.cycleLatch -= 1;
    this.fireLatch ||= code === PAD_FIRE;
    this.shoveLatch ||= binds.melee.includes(code);
    this.healLatch ||= binds.heal.includes(code);
    this.throwLatch ||= binds.throw.includes(code);
    this.spinnerLatch ||= binds.spinner.includes(code);
    this.fountainLatch ||= binds.fountain.includes(code);
    if (binds.weapon1.includes(code)) this.weaponLatch = 'pistol';
    else if (binds.weapon2.includes(code)) this.weaponLatch = 'carbine';
    else if (binds.weapon3.includes(code)) this.weaponLatch = 'shotgun';
    else {
      const defaultWeapon = DEFAULT_WEAPON_KEYS[code];
      if (defaultWeapon) this.weaponLatch = defaultWeapon;
    }
  }

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.held.delete(event.code);
  };

  private readonly onMouseMove = (event: MouseEvent): void => {
    this.touch.mouseMoved();
    if (!this.touch.used) this.use('keyboard');
    this.pointerClientX = event.clientX;
    this.pointerClientY = event.clientY;
    // A native drag or menu can swallow the release; this is the first honest word on the buttons.
    this.firing &&= (event.buttons & LEFT_BUTTON_BIT) !== 0;
    this.shoving &&= (event.buttons & RIGHT_BUTTON_BIT) !== 0;
  };

  private readonly onMouseDown = (event: MouseEvent): void => {
    this.use('keyboard');
    this.callbacks.onGesture();
    this.pointerClientX = event.clientX;
    this.pointerClientY = event.clientY;
    const pressedLeft = event.button === LEFT_BUTTON;
    const pressedRight = event.button === RIGHT_BUTTON;
    // A press on a menu belongs to the menu, which may never hand back its release.
    if (!this.enabled) return;
    const pressedMiddle = event.button === MIDDLE_BUTTON;
    if (pressedMiddle) {
      // Whether the ring takes it or not: a middle press left alone scrolls the page.
      event.preventDefault();
      this.callbacks.onBackpack?.();
      return;
    }
    this.firing ||= pressedLeft;
    this.shoving ||= pressedRight;
    this.fireLatch ||= pressedLeft;
    this.shoveLatch ||= pressedRight;
  };

  private readonly onMouseUp = (event: MouseEvent): void => {
    this.firing &&= event.button !== LEFT_BUTTON;
    this.shoving &&= event.button !== RIGHT_BUTTON;
  };

  private readonly onWheel = (event: WheelEvent): void => {
    if (!this.enabled) return;
    event.preventDefault();
    const now = performance.now();
    const isWheelIgnored = now - this.lastWheelAt < WHEEL_COOLDOWN_MS || event.deltaY === 0;
    if (isWheelIgnored) return;
    this.lastWheelAt = now;
    this.cycleLatch += Math.sign(event.deltaY);
  };

  /** Menus included: a right-click shove can land just after input turns off. */
  private readonly onContextMenu = (event: MouseEvent): void => {
    if (!isTyping(event.target)) event.preventDefault();
    // The native menu takes every release from here, with no blur to say so.
    else this.clearHeld();
  };
}
