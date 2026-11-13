import { keyBridgePad, setLootPad } from './inventory/loot-pad.ts';
import {
  layoutPageUi,
  pageFocusTargets,
  pageHitAt,
  SCROLL_STEP,
  scrollToShow,
  stepPageFocus,
  stepSlider,
  type PageHit,
  type PageLayout,
  type PageModel,
} from '../engine/page-ui.ts';
import { setPageWindow, type PageWindow } from './page-view.ts';

/** What the page hands the kit to run: the sounds, and what a press, a choice or a slide does. */
export interface CanvasPageHost {
  playUi: (sound: 'hover' | 'click') => void;
  /** A footer button or a link row. */
  press: (id: string) => void;
  /** A switch row flipped. */
  toggle: (id: string) => void;
  choose: (id: string, option: string) => void;
  slide: (id: string, value: number) => void;
  /** True while something stands over the page (the Privacy sheet) and the keys are its. */
  inert?: () => boolean;
}

export interface CanvasPage {
  update: (model: PageModel) => void;
  dispose: () => void;
}

const ACTIVATE = ['Enter', 'NumpadEnter', 'Space'];

/**
 * A title page drawn on the game canvas with the page kit: the pointer, the wheel and the keys do what the Vue
 * page's controls do. Up/Down/Tab move between controls and scroll the focused one into view, Left/Right change a
 * choice or a slider, Enter and Space press, Esc is Back.
 */
export function createCanvasPage(canvas: HTMLCanvasElement, host: CanvasPageHost, first: PageModel): CanvasPage {
  const win: PageWindow = { model: first, hover: null, focus: null, scroll: 0 };
  let sliding: string | null = null;

  function layout(): PageLayout {
    return layoutPageUi(win.model, canvas.width, canvas.height, win.scroll);
  }

  function point(event: MouseEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) * canvas.width) / rect.width, y: ((event.clientY - rect.top) * canvas.height) / rect.height };
  }

  function clampScroll(value: number): number {
    return Math.min(layout().scrollMax, Math.max(0, value));
  }

  function slideTo(id: string, value: number): void {
    host.slide(id, Math.min(1, Math.max(0, Math.round(value * 20) / 20)));
  }

  function press(hit: PageHit, along: number | null): void {
    if (hit.kind === 'button') {
      host.playUi('click');
      host.press(hit.id);
      return;
    }
    const control = layout().controls.find((each) => each.id === hit.id);
    if (!control) return;
    const kind = control.item.kind;
    if (kind === 'slider' && along !== null) {
      sliding = hit.id;
      slideTo(hit.id, along);
    } else if (kind === 'choice' && hit.part !== null) {
      host.playUi('click');
      host.choose(hit.id, control.item.kind === 'choice' ? control.item.options[hit.part].id : '');
    } else if (kind === 'switch') {
      if (control.item.kind === 'switch' && !control.item.enabled) return;
      host.playUi('click');
      host.toggle(hit.id);
    } else if (kind === 'link' || kind === 'bind') {
      host.playUi('click');
      host.press(hit.id);
    }
  }

  function onMouseDown(event: MouseEvent): void {
    if (event.target !== canvas || event.button !== 0) return;
    const at = point(event);
    const hit = pageHitAt(layout(), at.x, at.y);
    win.focus = null;
    if (hit) press(hit, hit.kind === 'control' ? hit.along : null);
  }

  function onMove(event: MouseEvent): void {
    if (event.target !== canvas && sliding === null) {
      win.hover = null;
      return;
    }
    const at = point(event);
    const current = layout();
    if (sliding !== null) {
      const track = current.controls.find((each) => each.id === sliding)?.track;
      if (track) slideTo(sliding, (at.x - track.x) / (track.w - 1));
      return;
    }
    const hit = pageHitAt(current, at.x, at.y);
    if (JSON.stringify(hit) === JSON.stringify(win.hover)) return;
    win.hover = hit;
    const soundsOff = hit === null || (hit.kind === 'control' && hit.part !== null);
    if (!soundsOff) host.playUi('hover');
  }

  function onUp(): void {
    sliding = null;
  }

  function onWheel(event: WheelEvent): void {
    if (event.target !== canvas) return;
    event.preventDefault();
    win.scroll = clampScroll(win.scroll + Math.sign(event.deltaY) * SCROLL_STEP);
  }

  function focusStep(step: 1 | -1): void {
    const targets = pageFocusTargets(layout());
    const next = stepPageFocus(targets, win.focus, step);
    win.focus = next;
    const target = targets.find((each) => each.id === next);
    if (target) win.scroll = clampScroll(scrollToShow(layout(), win.scroll, target.box));
  }

  function adjust(direction: 1 | -1): boolean {
    const focus = win.focus;
    if (focus === null || !focus.startsWith('control:')) return false;
    const control = layout().controls.find((each) => `control:${each.id}` === focus);
    const item = control?.item;
    if (item?.kind === 'slider') {
      slideTo(item.id, stepSlider(item.value, direction));
      return true;
    }
    if (item?.kind === 'choice') {
      const at = item.options.findIndex((option) => option.id === item.value);
      const to = Math.min(item.options.length - 1, Math.max(0, at + direction));
      if (to !== at) {
        host.playUi('click');
        host.choose(item.id, item.options[to].id);
      }
      return true;
    }
    return false;
  }

  function activate(): void {
    const focus = win.focus;
    if (focus === null) return;
    const id = focus.slice(focus.indexOf(':') + 1);
    if (focus.startsWith('button:')) {
      host.playUi('click');
      host.press(id);
      return;
    }
    const item = layout().controls.find((each) => each.id === id)?.item;
    if (item?.kind === 'switch' && item.enabled) {
      host.playUi('click');
      host.toggle(id);
    } else if (item?.kind === 'link' || item?.kind === 'bind') {
      host.playUi('click');
      host.press(id);
    }
  }

  /** Capture phase, so the pause and confirm keys the game listens for never see what this page takes. */
  function onKeyDown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey || host.inert?.()) return;
    let handled = true;
    if (event.code === 'Escape') {
      if (!event.repeat) host.press('back');
    } else if (event.code === 'Tab') focusStep(event.shiftKey ? -1 : 1);
    else if (event.code === 'ArrowDown') focusStep(1);
    else if (event.code === 'ArrowUp') focusStep(-1);
    else if (event.code === 'ArrowLeft') handled = adjust(-1);
    else if (event.code === 'ArrowRight') handled = adjust(1);
    else if (event.code === 'PageDown') win.scroll = clampScroll(win.scroll + SCROLL_STEP * 4);
    else if (event.code === 'PageUp') win.scroll = clampScroll(win.scroll - SCROLL_STEP * 4);
    else if (ACTIVATE.includes(event.code) && win.focus !== null) {
      if (!event.repeat) activate();
    } else handled = false;
    if (!handled) return;
    event.preventDefault();
    event.stopPropagation();
  }

  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  window.addEventListener('wheel', onWheel, { passive: false });
  setPageWindow(win);
  setLootPad(
    keyBridgePad(() => {
      const main = win.model.buttons.find((button) => button.primary && button.enabled);
      if (!main) return false;
      host.playUi('click');
      host.press(main.id);
      return true;
    }),
  );

  return {
    update(model) {
      win.model = model;
      win.scroll = clampScroll(win.scroll);
    },
    dispose() {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('wheel', onWheel);
      setPageWindow(null);
      setLootPad(null);
    },
  };
}
