import { browserStore, readJson, writeJson } from './storage.ts';

/** Standard Gamepad button indexes to avoid circular imports. */
export const PAD_BUTTONS = {
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

export type GameAction =
  | 'moveUp'
  | 'moveDown'
  | 'moveLeft'
  | 'moveRight'
  | 'sprint'
  | 'sneak'
  | 'search'
  | 'horn'
  | 'reload'
  | 'heal'
  | 'melee'
  | 'prevWeapon'
  | 'cycleWeapon'
  | 'weapon1'
  | 'weapon2'
  | 'weapon3'
  | 'throw'
  | 'spinner'
  | 'fountain'
  | 'bag'
  | 'map'
  | 'log'
  | 'fire';

export interface ActionMetadata {
  readonly id: GameAction;
  readonly label: string;
  readonly category: 'movement' | 'combat' | 'items' | 'interface';
  readonly rebindableKeys: boolean;
  readonly rebindablePad: boolean;
}

export const ACTION_METADATA: readonly ActionMetadata[] = [
  { id: 'moveUp', label: 'Move Up', category: 'movement', rebindableKeys: true, rebindablePad: false },
  { id: 'moveDown', label: 'Move Down', category: 'movement', rebindableKeys: true, rebindablePad: false },
  { id: 'moveLeft', label: 'Move Left', category: 'movement', rebindableKeys: true, rebindablePad: false },
  { id: 'moveRight', label: 'Move Right', category: 'movement', rebindableKeys: true, rebindablePad: false },
  { id: 'sprint', label: 'Sprint', category: 'movement', rebindableKeys: true, rebindablePad: true },
  { id: 'sneak', label: 'Sneak', category: 'movement', rebindableKeys: true, rebindablePad: true },
  { id: 'fire', label: 'Fire / Attack', category: 'combat', rebindableKeys: false, rebindablePad: true },
  { id: 'melee', label: 'Shove & Stab', category: 'combat', rebindableKeys: true, rebindablePad: true },
  { id: 'reload', label: 'Reload', category: 'combat', rebindableKeys: true, rebindablePad: true },
  { id: 'search', label: 'Search / Interact', category: 'items', rebindableKeys: true, rebindablePad: true },
  { id: 'horn', label: 'Horn (driving)', category: 'items', rebindableKeys: true, rebindablePad: true },
  { id: 'heal', label: 'Use Medkit', category: 'items', rebindableKeys: true, rebindablePad: true },
  { id: 'throw', label: 'Throw Item', category: 'items', rebindableKeys: true, rebindablePad: true },
  { id: 'spinner', label: 'Spinner', category: 'items', rebindableKeys: true, rebindablePad: true },
  { id: 'fountain', label: 'Fountain', category: 'items', rebindableKeys: true, rebindablePad: true },
  { id: 'bag', label: 'Candy Bag', category: 'items', rebindableKeys: true, rebindablePad: true },
  { id: 'prevWeapon', label: 'Previous Weapon', category: 'combat', rebindableKeys: true, rebindablePad: true },
  { id: 'cycleWeapon', label: 'Next Weapon', category: 'combat', rebindableKeys: true, rebindablePad: true },
  { id: 'weapon1', label: 'Weapon 1 (Pistol)', category: 'combat', rebindableKeys: true, rebindablePad: false },
  { id: 'weapon2', label: 'Weapon 2 (Carbine)', category: 'combat', rebindableKeys: true, rebindablePad: false },
  { id: 'weapon3', label: 'Weapon 3 (Shotgun)', category: 'combat', rebindableKeys: true, rebindablePad: false },
  { id: 'map', label: 'Map', category: 'interface', rebindableKeys: true, rebindablePad: true },
  { id: 'log', label: 'Log', category: 'interface', rebindableKeys: true, rebindablePad: true },
];

export type KeyBindings = Record<GameAction, readonly string[]>;
export type PadBindings = Record<GameAction, number | null>;

export const DEFAULT_KEY_BINDINGS: KeyBindings = {
  moveUp: ['KeyW', 'ArrowUp'],
  moveDown: ['KeyS', 'ArrowDown'],
  moveLeft: ['KeyA', 'ArrowLeft'],
  moveRight: ['KeyD', 'ArrowRight'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  sneak: ['Space'],
  fire: ['MouseLeft'],
  melee: ['KeyF'],
  reload: ['KeyR'],
  search: ['KeyE'],
  horn: ['KeyZ'],
  heal: ['KeyH'],
  throw: ['KeyG'],
  spinner: ['KeyT'],
  fountain: ['KeyV'],
  bag: ['KeyX'],
  prevWeapon: [],
  cycleWeapon: ['KeyQ'],
  weapon1: ['Digit1'],
  weapon2: ['Digit2'],
  weapon3: ['Digit3'],
  map: ['Tab', 'KeyN'],
  log: ['KeyL'],
};

export const DEFAULT_PAD_BINDINGS: PadBindings = {
  moveUp: null,
  moveDown: null,
  moveLeft: null,
  moveRight: null,
  sprint: PAD_BUTTONS.l3,
  sneak: PAD_BUTTONS.lb,
  fire: PAD_BUTTONS.rt,
  melee: PAD_BUTTONS.lt,
  reload: PAD_BUTTONS.y,
  search: PAD_BUTTONS.a,
  horn: PAD_BUTTONS.home,
  heal: PAD_BUTTONS.b,
  throw: PAD_BUTTONS.rb,
  spinner: PAD_BUTTONS.up,
  fountain: PAD_BUTTONS.down,
  bag: PAD_BUTTONS.r3,
  prevWeapon: PAD_BUTTONS.left,
  cycleWeapon: PAD_BUTTONS.right,
  weapon1: null,
  weapon2: null,
  weapon3: null,
  map: PAD_BUTTONS.x,
  log: PAD_BUTTONS.view,
};

const KEYS_STORAGE_KEY = 'outbreak.controls.keys';
const PAD_STORAGE_KEY = 'outbreak.controls.pad';

type ControlsListener = () => void;
const listeners = new Set<ControlsListener>();

export function subscribeControls(listener: ControlsListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyControlsChanged(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function loadKeyBindings(): KeyBindings {
  const store = browserStore();
  const raw = readJson(store, KEYS_STORAGE_KEY);
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_KEY_BINDINGS };
  const loaded = { ...DEFAULT_KEY_BINDINGS };
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (key in loaded && Array.isArray(val) && val.every((item) => typeof item === 'string')) {
      (loaded as Record<string, readonly string[]>)[key] = val;
    }
  }
  return loaded;
}

export function saveKeyBindings(bindings: KeyBindings): void {
  const store = browserStore();
  writeJson(store, KEYS_STORAGE_KEY, bindings);
  notifyControlsChanged();
}

export function loadPadBindings(): PadBindings {
  const store = browserStore();
  const raw = readJson(store, PAD_STORAGE_KEY);
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_PAD_BINDINGS };
  const loaded = { ...DEFAULT_PAD_BINDINGS };
  for (const [action, val] of Object.entries(raw as Record<string, unknown>)) {
    if (action in loaded && (typeof val === 'number' || val === null)) {
      (loaded as Record<string, number | null>)[action] = val;
    }
  }
  return loaded;
}

export function savePadBindings(bindings: PadBindings): void {
  const store = browserStore();
  writeJson(store, PAD_STORAGE_KEY, bindings);
  notifyControlsChanged();
}

export function resetKeyBindings(): KeyBindings {
  saveKeyBindings(DEFAULT_KEY_BINDINGS);
  return { ...DEFAULT_KEY_BINDINGS };
}

export function resetPadBindings(): PadBindings {
  savePadBindings(DEFAULT_PAD_BINDINGS);
  return { ...DEFAULT_PAD_BINDINGS };
}

/** Formats a keyboard key code into readable shorthand. */
export function formatKeyCode(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code === 'ShiftLeft' || code === 'ShiftRight') return 'Shift';
  if (code === 'ControlLeft' || code === 'ControlRight') return 'Ctrl';
  if (code === 'AltLeft' || code === 'AltRight') return 'Alt';
  if (code === 'Space') return 'Space';
  if (code === 'MouseLeft') return 'Left Click';
  if (code === 'MouseRight') return 'Right Click';
  return code;
}
