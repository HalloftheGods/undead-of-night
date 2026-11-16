import { keyBridgePad, setLootPad } from './inventory/loot-pad.ts';
import {
  layoutPageUi,
  pageFocusTargets,
  pageHitAt,
  RADIO_PARTS,
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
  /** A card in a row of cards was pointed at or stepped to, so the page can show what it is on. */
  card?: (id: string, index: number) => void;
  slide: (id: string, value: number) => void;
  /** True while something stands over the page (the Privacy sheet) and the keys are its. */
  inert?: () => boolean;
  /** True while something else has the whole canvas (the Dev bench's editor): the page is not drawn and takes no keys, clicks or wheel. */
  hidden?: () => boolean;
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
  const win: PageWindow = { model: first, hover: null, focus: null, scroll: 0, hidden: () => host.hidden?.() ?? false };
  const away = (): boolean => host.hidden?.() ?? false;
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
    const isRadio = layout().controls.find((each) => each.id === id)?.item.kind === 'radio';
    const clamped = Math.min(1, Math.max(0, value));
    host.slide(id, isRadio ? clamped : Math.round(clamped * 20) / 20);
  }

  function press(hit: PageHit, along: number | null): void {
    const isButtonHit = hit.kind === 'button';
    if (isButtonHit) {
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
    } else if (kind === 'radio') {
      const isDraggedAlongTrack = along !== null;
      const isOnRadioPart = hit.part !== null;
      if (isDraggedAlongTrack) {
        sliding = hit.id;
        slideTo(hit.id, along);
      } else if (isOnRadioPart) {
        const option = RADIO_PARTS[hit.part];
        if (option) {
          host.playUi('click');
          host.choose(hit.id, option);
        }
      }
    } else if (kind === 'album_slider' && hit.part !== null) {
      const item = control.item;
      const isAlbumSlider = item.kind === 'album_slider';
      if (isAlbumSlider) {
        const totalAlbums = item.totalAlbums;
        const tracksCount = item.tracks.length;
        if (hit.part === 0) {
          host.playUi('click');
          host.choose(hit.id, 'prev');
        } else if (hit.part === 1) {
          host.playUi('click');
          host.choose(hit.id, 'next');
        } else if (hit.part >= 2 && hit.part < 2 + totalAlbums) {
          host.playUi('click');
          host.choose(hit.id, `dot:${hit.part - 2}`);
        } else if (hit.part >= 2 + totalAlbums && hit.part < 2 + totalAlbums + tracksCount) {
          const trackIndex = hit.part - (2 + totalAlbums);
          host.playUi('click');
          host.choose(hit.id, `track:${item.tracks[trackIndex].id}`);
        } else if (hit.part >= 2 + totalAlbums + tracksCount) {
          const favIndex = hit.part - (2 + totalAlbums + tracksCount);
          host.playUi('click');
          host.choose(hit.id, `fav:${item.tracks[favIndex].file}`);
        }
      }
    } else if (kind === 'cards' && hit.part !== null) {
      const card = control.item.kind === 'cards' ? control.item.cards[hit.part] : undefined;
      if (!card) return;
      win.cardAt = hit.part;
      host.playUi('click');
      host.choose(hit.id, card.id);
    } else if (kind === 'choice' && hit.part !== null) {
      host.playUi('click');
      host.choose(hit.id, control.item.kind === 'choice' ? control.item.options[hit.part].id : '');
    } else if (kind === 'switch') {
      const isSwitchItem = control.item.kind === 'switch';
      const isSwitchDisabled = isSwitchItem && !control.item.enabled;
      if (isSwitchDisabled) return;
      host.playUi('click');
      host.toggle(hit.id);
    } else if (kind === 'link' || kind === 'bind') {
      const isLinkItem = control.item.kind === 'link';
      const isLinkDisabled = isLinkItem && control.item.disabled;
      if (isLinkDisabled) return;
      host.playUi('click');
      host.press(hit.id);
    }
  }

  function onMouseDown(event: MouseEvent): void {
    const isOffCanvas = event.target !== canvas;
    const isNotPrimaryButton = event.button !== 0;
    const shouldIgnoreMouseDown = isOffCanvas || isNotPrimaryButton || away();
    if (shouldIgnoreMouseDown) return;
    const at = point(event);
    const hit = pageHitAt(layout(), at.x, at.y);
    win.focus = null;
    const isControlHit = hit?.kind === 'control';
    if (hit) press(hit, isControlHit ? hit.along : null);
  }

  function onMove(event: MouseEvent): void {
    const isAway = away();
    if (isAway) {
      win.hover = null;
      return;
    }
    const isOffCanvasAndNotSliding = event.target !== canvas && sliding === null;
    if (isOffCanvasAndNotSliding) {
      win.hover = null;
      return;
    }
    const at = point(event);
    const current = layout();
    const slidingId = sliding;
    const isSliding = slidingId !== null;
    if (isSliding) {
      const track = current.controls.find((each) => each.id === slidingId)?.track;
      if (track) slideTo(slidingId, (at.x - track.x) / (track.w - 1));
      return;
    }
    const hit = pageHitAt(current, at.x, at.y);
    const isHoverUnchanged = JSON.stringify(hit) === JSON.stringify(win.hover);
    if (isHoverUnchanged) return;
    win.hover = hit;
    const controlItem = hit?.kind === 'control' ? current.controls.find((c) => c.id === hit.id)?.item : null;
    const isDisabledLink = controlItem?.kind === 'link' && controlItem.disabled;
    const isCard = controlItem?.kind === 'cards' && hit?.kind === 'control' && hit.part !== null;
    if (isCard) {
      win.cardAt = hit.part ?? 0;
      host.card?.(hit.id, hit.part ?? 0);
    }
    const soundsOff = hit === null || (hit.kind === 'control' && ((hit.part !== null && !isCard) || isDisabledLink));
    if (!soundsOff) host.playUi('hover');
  }

  function onUp(): void {
    sliding = null;
  }

  function onWheel(event: WheelEvent): void {
    const shouldIgnoreWheel = event.target !== canvas || away();
    if (shouldIgnoreWheel) return;
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
    const isFocusOnControl = focus !== null && focus.startsWith('control:');
    if (!isFocusOnControl) return false;
    const control = layout().controls.find((each) => `control:${each.id}` === focus);
    const item = control?.item;
    const isSliderItem = item?.kind === 'slider';
    const isRadioItem = item?.kind === 'radio';
    const isCardsItem = item?.kind === 'cards';
    const isChoiceItem = item?.kind === 'choice';
    if (isSliderItem) {
      slideTo(item.id, stepSlider(item.value, direction));
      return true;
    }
    if (isRadioItem) {
      slideTo(item.id, stepSlider(item.position, direction));
      return true;
    }
    if (isCardsItem) {
      const last = item.cards.length - 1;
      win.cardAt = Math.min(last, Math.max(0, (win.cardAt ?? 0) + direction));
      host.card?.(item.id, win.cardAt);
      return true;
    }
    if (isChoiceItem) {
      const at = item.options.findIndex((option) => option.id === item.value);
      const to = Math.min(item.options.length - 1, Math.max(0, at + direction));
      const isNewOption = to !== at;
      if (isNewOption) {
        host.playUi('click');
        host.choose(item.id, item.options[to].id);
      }
      return true;
    }
    return false;
  }

  function activate(): void {
    const focus = win.focus;
    const hasNoFocus = focus === null;
    if (hasNoFocus) return;
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
    } else if (item?.kind === 'radio') {
      host.playUi('click');
      host.choose(id, 'play');
    } else if (item?.kind === 'cards') {
      const card = item.cards[win.cardAt ?? 0];
      if (!card) return;
      host.playUi('click');
      host.choose(id, card.id);
    } else if (item?.kind === 'link' || item?.kind === 'bind') {
      host.playUi('click');
      host.press(id);
    }
  }

  /** Capture phase, so the pause and confirm keys the game listens for never see what this page takes. */
  function onKeyDown(event: KeyboardEvent): void {
    const hasModifierKey = event.ctrlKey || event.metaKey || event.altKey;
    const shouldIgnoreKey = hasModifierKey || host.inert?.() || away();
    if (shouldIgnoreKey) return;
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
      const isPageAway = away();
      if (isPageAway) return false;
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
