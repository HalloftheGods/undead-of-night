import type { KeepsakeId } from '../../shared/protocol.ts';
import { WEAPON_ORDER } from '../../shared/protocol.ts';
import type { ClientInputPacket, Stance, WeaponId } from '../../shared/protocol.ts';
import { TouchInput } from './touch-input.ts';

const WHEEL_COOLDOWN_MS = 110;

const UP = ['KeyW', 'ArrowUp'];
const DOWN = ['KeyS', 'ArrowDown'];
const LEFT = ['KeyA', 'ArrowLeft'];
const RIGHT = ['KeyD', 'ArrowRight'];
const MOVE_CODES = [...UP, ...DOWN, ...LEFT, ...RIGHT];

const WEAPON_KEYS: Readonly<Record<string, WeaponId>> = {
  Digit1: 'pistol',
  Digit2: 'carbine',
  Digit3: 'shotgun',
};

const SHOVE_CODE = 'KeyF';
const HEAL_CODE = 'KeyH';
const SEARCH_CODE = 'KeyE';
const THROW_CODE = 'KeyG';
const MOLOTOV_CODE = 'KeyT';
const FLARE_CODE = 'KeyV';
const EAT_CODE = 'KeyX';
const SNEAK_CODES = ['KeyC'];
const SPRINT_CODES = ['ShiftLeft', 'ShiftRight'];
const MAP_CODES: ReadonlySet<string> = new Set(['Tab', 'KeyN']);
const LOG_CODE = 'KeyL';
const LEFT_BUTTON = 0;
const RIGHT_BUTTON = 2;
const LEFT_BUTTON_BIT = 1;
const RIGHT_BUTTON_BIT = 2;

const GAME_CODES: ReadonlySet<string> = new Set([
  ...MOVE_CODES,
  'KeyR',
  'KeyQ',
  'Space',
  SHOVE_CODE,
  HEAL_CODE,
  SEARCH_CODE,
  THROW_CODE,
  MOLOTOV_CODE,
  FLARE_CODE,
  EAT_CODE,
  ...SNEAK_CODES,
  ...SPRINT_CODES,
  ...Object.keys(WEAPON_KEYS),
]);

export interface InputCallbacks {
  /** First key or click, the moment browsers allow audio to start. */
  onGesture(): void;
  onPause(): void;
  onMute(): void;
  /** Enter, when no button has focus to answer it. */
  onConfirm(): void;
  /** Tab or N. True if the game took the key, so Tab does not also move focus. */
  onMap(): boolean;
  /** The map is open or could open, so a Tab held down must stay away from the browser. */
  mapUsable(): boolean;
  /** The first touch of the page. */
  onTouchSeen?(): void;
  /** L: the run's full log. True if the game took the key. */
  onLog?(): boolean;
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
 * Keyboard and mouse. One-shot requests latch until sampled. Held state follows
 * the player's hands even while a menu is up, and only counts while enabled, so
 * a key held through a menu takes effect again the moment it closes.
 */
export class InputManager {
  pointerClientX = 0;
  pointerClientY = 0;
  readonly touch: TouchInput;

  private readonly callbacks: InputCallbacks;
  private readonly held = new Set<string>();
  private enabled = false;
  private firing = false;
  private shoving = false;
  private fireLatch = false;
  private shoveLatch = false;
  private healLatch = false;
  private throwLatch = false;
  private molotovLatch = false;
  private flareLatch = false;
  private eatLatch = false;
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
      onGesture: () => this.callbacks.onGesture(),
      onSeen: () => this.callbacks.onTouchSeen?.(),
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
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('contextmenu', this.onContextMenu);
    window.removeEventListener('blur', this.clearHeld);
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

  /** The keepsake card the player chose, sent with the next input. */
  pickKeepsake(id: KeepsakeId): void {
    this.keepsakeLatch = id;
  }

  private clearLatches(): void {
    this.fireLatch = false;
    this.shoveLatch = false;
    this.healLatch = false;
    this.throwLatch = false;
    this.molotovLatch = false;
    this.flareLatch = false;
    this.eatLatch = false;
    this.keepsakeLatch = null;
    this.reloadLatch = false;
    this.weaponLatch = null;
    this.cycleLatch = 0;
    this.touch.clearLatch();
  }

  private isHeld(codes: readonly string[]): boolean {
    return this.enabled && codes.some((code) => this.held.has(code));
  }

  get dirX(): number {
    return Math.sign(Number(this.isHeld(RIGHT)) - Number(this.isHeld(LEFT)) + this.touch.dirX);
  }

  /** Sneak wins over sprint, as it does in the sim. */
  get stance(): Stance {
    if (this.isHeld(SNEAK_CODES)) return 'sneak';
    return this.isHeld(SPRINT_CODES) ? 'sprint' : 'walk';
  }

  get dirY(): number {
    return Math.sign(Number(this.isHeld(DOWN)) - Number(this.isHeld(UP)) + this.touch.dirY);
  }

  /** A touch button goes down as the key it stands for. */
  padDown(code: string): void {
    const isEscape = code === 'Escape';
    if (isEscape) {
      this.callbacks.onPause();
      return;
    }
    if (MAP_CODES.has(code)) {
      this.callbacks.onMap();
      return;
    }
    this.held.add(code);
    if (this.enabled) this.latch(code);
  }

  padUp(code: string): void {
    this.held.delete(code);
  }

  /** Builds the packet for this tick and spends the latches. */
  sample(seq: number, angle: number, weapons: OwnedWeapons | null): ClientInputPacket {
    const cycled = weapons ? cycleWeapon(weapons, this.cycleLatch) : null;
    const packet: ClientInputPacket = {
      seq,
      up: this.isHeld(UP) || this.touch.dirY < 0,
      down: this.isHeld(DOWN) || this.touch.dirY > 0,
      left: this.isHeld(LEFT) || this.touch.dirX < 0,
      right: this.isHeld(RIGHT) || this.touch.dirX > 0,
      angle,
      ...(this.touch.used ? { touch: true } : {}),
      shoot: this.fireLatch || (this.enabled && this.firing) || this.touch.shooting,
      reload: this.reloadLatch,
      weapon: this.weaponLatch ?? cycled,
      melee: this.shoveLatch || (this.enabled && this.shoving) || this.isHeld([SHOVE_CODE]),
      heal: this.healLatch,
      ...(this.throwLatch ? { throw: true } : {}),
      ...(this.molotovLatch ? { molotov: true } : {}),
      ...(this.flareLatch ? { flare: true } : {}),
      ...(this.eatLatch ? { eat: true } : {}),
      ...(this.keepsakeLatch ? { keepsake: this.keepsakeLatch } : {}),
      search: this.isHeld([SEARCH_CODE]),
      ...(this.stance === 'sneak' ? { sneak: true } : {}),
      ...(this.stance === 'sprint' ? { sprint: true } : {}),
    };
    this.clearLatches();
    return packet;
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
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

  /** Mute, the log and the map. True if the key was one of them. */
  private panelKey(event: KeyboardEvent): boolean {
    const { code, repeat } = event;
    const isMute = code === 'KeyM';
    const isLog = code === LOG_CODE;
    const isMap = MAP_CODES.has(code);
    const shouldMute = isMute && !repeat;
    if (shouldMute) this.callbacks.onMute();
    let taken = false;
    if (isLog) taken = !repeat && (this.callbacks.onLog?.() ?? false);
    if (isMap) taken = repeat ? this.callbacks.mapUsable() : this.callbacks.onMap();
    if (taken) event.preventDefault();
    return isMute || isLog || isMap;
  }

  /** A movement or action key: held for movement, latched for one-shot actions while input is on. */
  private gameKey(event: KeyboardEvent): void {
    if (!GAME_CODES.has(event.code)) return;
    this.held.add(event.code);
    if (!this.enabled) return;
    event.preventDefault();
    if (!event.repeat) this.latch(event.code);
  }

  private latch(code: string): void {
    const isReload = code === 'KeyR';
    if (isReload) this.reloadLatch = true;
    const isCycle = code === 'KeyQ';
    if (isCycle) this.cycleLatch += 1;
    this.shoveLatch ||= code === SHOVE_CODE;
    this.healLatch ||= code === HEAL_CODE;
    this.throwLatch ||= code === THROW_CODE;
    this.molotovLatch ||= code === MOLOTOV_CODE;
    this.flareLatch ||= code === FLARE_CODE;
    this.eatLatch ||= code === EAT_CODE;
    const weapon = WEAPON_KEYS[code];
    if (weapon) this.weaponLatch = weapon;
  }

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.held.delete(event.code);
  };

  private readonly onMouseMove = (event: MouseEvent): void => {
    this.touch.mouseMoved();
    this.pointerClientX = event.clientX;
    this.pointerClientY = event.clientY;
    // A native drag or menu can swallow the release; this is the first honest word on the buttons.
    this.firing &&= (event.buttons & LEFT_BUTTON_BIT) !== 0;
    this.shoving &&= (event.buttons & RIGHT_BUTTON_BIT) !== 0;
  };

  private readonly onMouseDown = (event: MouseEvent): void => {
    this.callbacks.onGesture();
    this.pointerClientX = event.clientX;
    this.pointerClientY = event.clientY;
    const pressedLeft = event.button === LEFT_BUTTON;
    const pressedRight = event.button === RIGHT_BUTTON;
    // A press on a menu belongs to the menu, which may never hand back its release.
    if (!this.enabled) return;
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
