import type { ArtBook } from '../art/types.ts';
import {
  focusTargets,
  layoutSetupUi,
  neighbour,
  setupHitAt,
  tabFrom,
  type Direction,
  type FocusId,
  type SetupHit,
  type SetupLayout,
  type SetupModel,
} from '../engine/setup-ui.ts';
import { chosenOption, stepFocus } from './setup-picks.ts';
import type { PickKey, SetupPick } from './setup-picks.ts';
import { createSpinner, FRONT_FACING } from './survivor-spin.ts';
import { setSetupWindow, type SetupWindow } from './setup-view.ts';

export type SetupAction = 'start' | 'resume' | 'back' | 'levels';

/** What the screen hands back to the page: the same choices and presses the Vue setup makes. */
export interface CanvasSetupHost {
  readonly art: ArtBook | null;
  playUi: (sound: 'hover' | 'click') => void;
  reducedMotion: () => boolean;
  choose: (key: PickKey, id: string) => void;
  setCallsign: (text: string) => void;
  act: (action: SetupAction) => void;
}

export interface CanvasSetup {
  /** The page's state moved on (a pick, the callsign, an error): show it. */
  update: (model: SetupModel) => void;
  dispose: () => void;
}

const CALLSIGN_MAX = 12;
const LIST_MOVES = ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
const ARROWS: Readonly<Record<string, Direction>> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };

/**
 * The Campaign and Arcade setup drawn on the game canvas (engine/setup-ui.ts). It answers the pointer and the keys itself,
 * the way the page does: a click on a pick opens its list, pointing at an option previews it (a survivor turns), Esc closes
 * the list and then leaves. Typing goes through a real hidden input so IME, paste and phone keyboards behave.
 */
export function createCanvasSetup(canvas: HTMLCanvasElement, host: CanvasSetupHost, first: SetupModel): CanvasSetup {
  const win: SetupWindow = { model: first, art: host.art, hover: null, focus: null, previewed: null, facing: FRONT_FACING, editing: false };
  let source = first;
  let open: PickKey | null = null;
  let optionFocus = 0;
  const spinner = createSpinner((facing) => {
    win.facing = facing;
  });

  const input = document.createElement('input');
  input.type = 'text';
  input.maxLength = CALLSIGN_MAX;
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.setAttribute('aria-label', 'Callsign');
  input.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;border:0;padding:0;pointer-events:none;';
  document.body.append(input);

  function show(): void {
    win.model = { ...source, open };
  }

  function layout(): SetupLayout {
    return layoutSetupUi(win.model, canvas.width, canvas.height);
  }

  function openPick(): SetupPick | null {
    return open === null ? null : (source.picks.find((pick) => pick.key === open) ?? null);
  }

  function bufferPoint(event: MouseEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) * canvas.width) / rect.width, y: ((event.clientY - rect.top) * canvas.height) / rect.height };
  }

  function spin(): void {
    if (host.reducedMotion()) spinner.stop();
    else spinner.start();
  }

  function preview(id: string | null, byPointer: boolean): void {
    if (id === null) {
      win.previewed = null;
      spinner.stop();
      return;
    }
    if (byPointer) host.playUi('hover');
    win.previewed = id;
    spin();
  }

  function openList(key: PickKey, byKeyboard: boolean): void {
    const pick = source.picks.find((each) => each.key === key);
    if (!pick) return;
    open = key;
    optionFocus = pick.chosen;
    show();
    // The page puts the keyboard on the chosen option, which previews it.
    preview(chosenOption(pick).id, false);
    if (byKeyboard) win.focus = null;
  }

  function closeList(refocus: boolean): void {
    const was = open;
    open = null;
    preview(null, false);
    show();
    if (refocus && was !== null) win.focus = `card:${was}`;
  }

  function endEditing(): void {
    if (document.activeElement === input) input.blur();
    win.editing = false;
  }

  function beginEditing(): void {
    input.value = source.callsign;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    win.editing = true;
  }

  function chooseOption(index: number): void {
    const pick = openPick();
    const option = pick?.options[index];
    if (!pick || !option) return;
    host.playUi('click');
    host.choose(pick.key, option.id);
    closeList(true);
  }

  function press(action: SetupAction, silent = false): void {
    if (!silent) host.playUi('click');
    host.act(action);
  }

  function activate(id: FocusId): void {
    if (id === 'callsign') {
      beginEditing();
      return;
    }
    if (id.startsWith('card:')) {
      const key = id.slice('card:'.length);
      if (key === 'level') {
        press('levels');
        return;
      }
      host.playUi('click');
      if (open === key) closeList(true);
      else openList(key as PickKey, true);
      return;
    }
    const button = layout().buttons.find((each) => `button:${each.id}` === id);
    if (!button?.enabled) return;
    press(button.id, button.id === 'start');
  }

  function onClick(event: MouseEvent): void {
    if (event.target !== canvas) return;
    const hit = setupHitAt(layout(), bufferPoint(event).x, bufferPoint(event).y);
    endEditing();
    win.focus = null;
    if (!hit) return;
    if (hit.kind === 'backdrop') closeList(false);
    else if (hit.kind === 'option') chooseOption(hit.index);
    else if (hit.kind === 'card') activate(`card:${hit.key}`);
    else if (hit.kind === 'callsign') beginEditing();
    else activate(`button:${hit.id}`);
  }

  function sameHit(a: SetupHit | null, b: SetupHit | null): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  function onMove(event: MouseEvent): void {
    if (event.target !== canvas) {
      win.hover = null;
      return;
    }
    const point = bufferPoint(event);
    const hit = setupHitAt(layout(), point.x, point.y);
    if (sameHit(hit, win.hover)) return;
    win.hover = hit;
    const pickable = hit?.kind === 'card' || hit?.kind === 'button';
    if (pickable) host.playUi('hover');
    if (hit?.kind === 'option') preview(openPick()?.options[hit.index]?.id ?? null, true);
    else if (open !== null) preview(null, false);
  }

  function stepList(key: string): boolean {
    const pick = openPick();
    if (!pick) return false;
    if (!LIST_MOVES.includes(key)) return false;
    const to = stepFocus(optionFocus, pick.options.length, key);
    optionFocus = to;
    preview(pick.options[to].id, false);
    return true;
  }

  function moveFocus(key: string): void {
    const targets = focusTargets(layout());
    const from = win.focus ?? targets[0]?.id ?? null;
    if (from === null) return;
    const dir = ARROWS[key];
    const to = win.focus === null ? from : dir ? neighbour(targets, from, dir) : null;
    if (to) win.focus = to;
  }

  function listKey(event: KeyboardEvent): boolean {
    if (event.code === 'Escape') {
      closeList(true);
      return true;
    }
    if (event.code === 'Enter' || event.code === 'NumpadEnter' || event.code === 'Space') {
      if (!event.repeat) chooseOption(optionFocus);
      return true;
    }
    if (event.code === 'Tab') return true;
    return stepList(event.key);
  }

  function pageKey(event: KeyboardEvent): boolean {
    if (event.code === 'Escape') {
      if (!event.repeat) press('back');
      return true;
    }
    if (event.code === 'Tab') {
      win.focus = tabFrom(focusTargets(layout()), win.focus, event.shiftKey ? -1 : 1);
      return true;
    }
    if (event.key in ARROWS) {
      moveFocus(event.key);
      return true;
    }
    const activating = event.code === 'Enter' || event.code === 'NumpadEnter' || event.code === 'Space';
    if (activating && win.focus !== null) {
      if (!event.repeat) activate(win.focus);
      return true;
    }
    return false;
  }

  function typingKey(event: KeyboardEvent): boolean {
    if (event.code === 'Escape') {
      endEditing();
      if (!event.repeat) press('back');
      return true;
    }
    const finishing = event.code === 'Enter' || event.code === 'NumpadEnter';
    if (finishing) {
      endEditing();
      win.focus = 'callsign';
      return true;
    }
    if (event.code === 'Tab') {
      endEditing();
      win.focus = tabFrom(focusTargets(layout()), 'callsign', event.shiftKey ? -1 : 1);
      return true;
    }
    return false;
  }

  /** Capture phase, so the pause and confirm keys the game listens for never see what this screen takes. */
  function onKeyDown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const typing = document.activeElement === input;
    const handled = typing ? typingKey(event) : open !== null ? listKey(event) : pageKey(event);
    if (!handled) return;
    event.preventDefault();
    event.stopPropagation();
  }

  function onInput(): void {
    host.setCallsign(input.value);
  }

  function onBlur(): void {
    win.editing = false;
  }

  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('click', onClick);
  input.addEventListener('input', onInput);
  input.addEventListener('blur', onBlur);
  show();
  setSetupWindow(win);

  return {
    update(model) {
      source = model;
      if (open !== null && !model.picks.some((pick) => pick.key === open)) open = null;
      show();
    },
    dispose() {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('click', onClick);
      input.removeEventListener('input', onInput);
      input.removeEventListener('blur', onBlur);
      spinner.stop();
      input.remove();
      setSetupWindow(null);
    },
  };
}
