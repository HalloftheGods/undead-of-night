import { computed, ref } from 'vue';
import { ACTION_METADATA, loadKeyBindings, loadPadBindings, resetKeyBindings, resetPadBindings, saveKeyBindings, savePadBindings } from '../game/controls-prefs.ts';
import type { GameAction } from '../game/controls-prefs.ts';
import { readPads } from '../game/gamepad-input.ts';
import { padFamily, padLabel } from '../game/pad-glyphs.ts';

export type DeviceTab = 'keys' | 'pad';

export interface Listening {
  readonly action: GameAction;
  readonly tab: DeviceTab;
}

const STICK_ACTIONS: readonly GameAction[] = ['moveUp', 'moveDown', 'moveLeft', 'moveRight'];

/** What a controller button is called, in the glyphs of the pad that is plugged in; the move actions are the stick. */
export function padBindingLabel(action: GameAction, button: number | null | undefined): string {
  if (button === null || button === undefined) return STICK_ACTIONS.includes(action) ? 'Left Stick' : 'None';
  const family = padFamily(readPads()[0]?.id ?? null);
  return padLabel(family, button);
}

/**
 * Remapping the keyboard and the controller, shared by the Controls page and its canvas version: which device is
 * showing, which action is listening for its next key or button, and saving what it hears. The key listener is on
 * the window in capture, so the key is heard before anything else; `attach` and `detach` bracket the page.
 */
export function useRemapping() {
  const tab = ref<DeviceTab>('keys');
  const keyBinds = ref(loadKeyBindings());
  const padBinds = ref(loadPadBindings());
  const listening = ref<Listening | null>(null);
  const lastPadButtons = new Map<number, boolean>();
  let pollHandle: number | null = null;

  const prompt = computed(() => {
    if (!listening.value) return '';
    const name = ACTION_METADATA.find((each) => each.id === listening.value?.action)?.label ?? '';
    return listening.value.tab === 'keys' ? `Press a new key for "${name}" (or Escape to cancel)...` : `Press a controller button for "${name}"...`;
  });

  function cancel(): void {
    listening.value = null;
  }

  function start(action: GameAction): void {
    listening.value = { action, tab: tab.value };
  }

  function switchTab(next: DeviceTab): void {
    cancel();
    tab.value = next;
  }

  function reset(): void {
    cancel();
    if (tab.value === 'keys') keyBinds.value = resetKeyBindings();
    else padBinds.value = resetPadBindings();
  }

  function onKeyDown(event: KeyboardEvent): void {
    const heard = listening.value;
    if (!heard || heard.tab !== 'keys') return;
    event.preventDefault();
    event.stopPropagation();
    if (event.code === 'Escape') {
      cancel();
      return;
    }
    const current = { ...keyBinds.value };
    // A key belongs to one action: taking it from another leaves that one unbound.
    for (const [other, codes] of Object.entries(current)) {
      if (other !== heard.action && codes.includes(event.code)) current[other as GameAction] = codes.filter((code) => code !== event.code);
    }
    current[heard.action] = [event.code];
    keyBinds.value = current;
    saveKeyBindings(current);
    cancel();
  }

  function bindPadButton(action: GameAction, index: number): void {
    const current = { ...padBinds.value };
    for (const [other, bound] of Object.entries(current)) {
      if (other !== action && bound === index) current[other as GameAction] = null;
    }
    current[action] = index;
    padBinds.value = current;
    savePadBindings(current);
    cancel();
  }

  function poll(): void {
    const heard = listening.value;
    const pad = heard?.tab === 'pad' ? readPads()[0] : undefined;
    if (heard && pad) {
      for (let index = 0; index < pad.buttons.length; index += 1) {
        const isPressed = pad.buttons[index]?.pressed ?? false;
        const wasPressed = lastPadButtons.get(index) ?? false;
        lastPadButtons.set(index, isPressed);
        if (isPressed && !wasPressed) {
          bindPadButton(heard.action, index);
          break;
        }
      }
    } else {
      lastPadButtons.clear();
    }
    pollHandle = requestAnimationFrame(poll);
  }

  function attach(): void {
    window.addEventListener('keydown', onKeyDown, true);
    pollHandle = requestAnimationFrame(poll);
  }

  function detach(): void {
    window.removeEventListener('keydown', onKeyDown, true);
    if (pollHandle !== null) cancelAnimationFrame(pollHandle);
  }

  return { tab, keyBinds, padBinds, listening, prompt, start, cancel, switchTab, reset, attach, detach };
}
