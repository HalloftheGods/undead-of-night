import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch, type Ref } from 'vue';
import type { BagCommit } from '../../shared/bag.ts';
import { loadKeyBindings } from './controls-prefs.ts';
import { aimsCursor } from './home-screens.ts';
import type { UiState } from './hud-state.ts';
import type { InputManager } from './input-manager.ts';
import { LocalBag, type BagWorking } from './local-bag.ts';

/** How often a shut bag checks itself against the host's hash. */
const HEAL_CHECK_MS = 500;

/** The grid inventory opens on I. Tab is the map's, so I is the free key (`DEFAULT_KEY_BINDINGS`). */
export const INVENTORY_CODE = 'KeyI';

/** What the modal lets the window ask of it. */
export interface InventoryPanel {
  escape: () => void;
  rotate: () => void;
  /** Puts back what is being held, so the grids are whole. */
  settle: () => void;
}

type Held = Pick<InputManager, 'setEnabled' | 'letGoButtons'>;

function isTypingTarget(target: EventTarget | null): boolean {
  if (typeof HTMLElement === 'undefined' || !(target instanceof HTMLElement)) return false;
  const field = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
  return field || target.isContentEditable;
}

/** True if the press is the inventory key, bare, on its own and not in a text field or a rebound key. */
export function isInventoryKey(event: Pick<KeyboardEvent, 'code' | 'repeat' | 'ctrlKey' | 'metaKey' | 'altKey' | 'target'>, reboundCodes: readonly string[]): boolean {
  const isTheKey = event.code === INVENTORY_CODE && !event.repeat;
  const isBare = !event.ctrlKey && !event.metaKey && !event.altKey;
  const isFree = !isTypingTarget(event.target) && !reboundCodes.includes(INVENTORY_CODE);
  return isTheKey && isBare && isFree;
}

/** The keys are the game's and the survivor is on their feet: the same test the crosshair uses. */
export function inventoryReachable(ui: UiState): boolean {
  const aiming = aimsCursor({
    screen: ui.screen,
    paused: ui.paused,
    mapOpen: ui.mapOpen || ui.bagOpen,
    bench: Boolean(ui.hud?.bench),
    home: ui.home,
    backpackOpen: ui.backpackOpen,
    inLobby: Boolean(ui.lobby && !ui.lobby.launched),
  });
  return aiming && ui.hud !== null && ui.hud.status === 'alive';
}

/**
 * The grid inventory over a live run. Opening takes the player's hands off the game (the same
 * `setEnabled` the pause menu uses); closing gives them back only if nothing else has them. Moves in
 * the modal edit a working copy and send nothing; closing sends one commit if anything changed.
 */
export function useInventoryModal(ui: Ref<UiState>, input: Held, panel: Ref<InventoryPanel | null>, send: (commit: BagCommit) => void) {
  const isOpen = ref(false);
  const bag = new LocalBag(send);
  const working = shallowRef<BagWorking | null>(null);
  /** Changes on every opening, so the modal rebuilds from what is carried then. */
  const openings = ref(0);

  function show(): boolean {
    const hud = ui.value.hud;
    const canShow = inventoryReachable(ui.value) && hud !== null;
    if (!canShow) return false;
    bag.sync(hud);
    working.value = bag.open(hud);
    openings.value += 1;
    input.letGoButtons();
    input.setEnabled(false);
    isOpen.value = true;
    return true;
  }

  function hide(): void {
    if (!isOpen.value) return;
    panel.value?.settle();
    if (working.value) bag.close(working.value);
    isOpen.value = false;
    working.value = null;
    if (inventoryReachable(ui.value)) input.setEnabled(true);
  }

  /** Swallows the press so the game's own key listener never sees it, and answers the few the modal knows. */
  function onKey(event: KeyboardEvent): void {
    if (!isOpen.value) {
      const reboundCodes = Object.values(loadKeyBindings()).flat();
      if (!isInventoryKey(event, reboundCodes)) return;
      event.preventDefault();
      event.stopPropagation();
      show();
      return;
    }
    if (isTypingTarget(event.target)) return;
    event.stopPropagation();
    if (event.code === 'Escape') {
      event.preventDefault();
      panel.value?.escape();
    } else if (event.code === INVENTORY_CODE) {
      event.preventDefault();
      if (!event.repeat) hide();
    } else if (event.code === 'KeyR') {
      event.preventDefault();
      panel.value?.rotate();
    }
  }

  /** Something else took the screen (pause, a death, a station): the modal goes with it. */
  const shouldClose = computed(() => isOpen.value && !inventoryReachable(ui.value));
  watch(shouldClose, (gone) => {
    if (gone) hide();
  });

  /** What is carried drives the local bag with every snapshot, as it drives the host's. */
  watch(() => ui.value.hud, (hud) => {
    if (hud) bag.sync(hud);
    else bag.reset();
  }, { immediate: true });
  const healTimer = setInterval(() => bag.heal(), HEAL_CHECK_MS);

  /** Capture, so the press lands before the game's own listener on the same window. */
  onMounted(() => window.addEventListener('keydown', onKey, true));
  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKey, true);
    clearInterval(healTimer);
    if (isOpen.value) input.setEnabled(true);
  });

  return { isOpen, working, openings, show, hide };
}
