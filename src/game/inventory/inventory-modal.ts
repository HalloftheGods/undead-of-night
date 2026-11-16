import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from "vue";
import type { ContainerArt } from "@art/containers.ts";
import type { ContainerKind } from "@shared/containers.ts";
import type { GridItem } from "@shared/grid-inventory.ts";
import type { ItemMove } from "@shared/item-move.ts";
import { loadKeyBindings } from "@game/controls-prefs.ts";
import { aimsCursor } from "@game/home-screens.ts";
import type { UiState } from "@game/hud-state.ts";
import type { InputManager } from "@game/input-manager.ts";
import { loadAutoCloseEmptyLoot } from "@game/loot-prefs.ts";
import { FLY_MS, type CellOrigin, type MotionKind } from "./move-motion.ts";
import { useMoveLedger, type ProposedMove } from "./use-move-ledger.ts";
import { beginContainerZoom, endContainerZoom } from "./container-zoom.ts";
import { inventoryHolding, setInventoryHands } from "./inventory-hands.ts";
import { setHeld } from "../held-cursor.ts";

/** The grid inventory opens on I or B. Tab is the map's; neither letter is in `DEFAULT_KEY_BINDINGS`. */
export const INVENTORY_CODES: readonly string[] = ["KeyI", "KeyB"];

/** What the modal lets the window ask of it. */
export interface InventoryPanel {
  escape: () => void;
  rotate: () => void;
  /** Puts back what is being held, so the grids are whole. */
  settle: () => void;
  /** The client point is on this window's own UI, so a click there is the inventory's and never a shot. */
  ownsPoint: (clientX: number, clientY: number) => boolean;
  /** Where an item is drawn now, so a flight back or a puff starts from there. */
  itemOrigin?: (itemId: string) => CellOrigin | null;
}

type Held = Pick<InputManager, "setEnabled" | "setWalkOnly" | "letGoButtons">;

/** How often an open container checks whether the survivor has walked off from it. */
const AWAY_CHECK_MS = 150;

function isTypingTarget(target: EventTarget | null): boolean {
  if (typeof HTMLElement === "undefined" || !(target instanceof HTMLElement)) return false;
  const field = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
  return field || target.isContentEditable;
}

/** True if the press is an inventory key (I or B), bare, on its own, not in a text field and not a key the player rebound. */
export function isInventoryKey(
  event: Pick<KeyboardEvent, "code" | "repeat" | "ctrlKey" | "metaKey" | "altKey" | "target">,
  inventoryCodes: readonly string[],
  reboundCodes: readonly string[]
): boolean {
  const isTheKey = inventoryCodes.includes(event.code) && !event.repeat;
  const isBare = !event.ctrlKey && !event.metaKey && !event.altKey;
  const isFree = !isTypingTarget(event.target) && !reboundCodes.includes(event.code);
  return isTheKey && isBare && isFree;
}

/**
 * What the open grid does with a key: 'escape' and 'close' and 'rotate' are its own, 'ignore' is an inventory key
 * held down (swallowed, so it does not reopen), and null is the game's, so the game stays playable under the grid.
 * R rotates only an item in hand; with the hand empty it is the reload key again.
 */
export function inventoryKeyAction(
  code: string,
  repeat: boolean,
  holding: boolean,
  inventoryCodes: readonly string[]
): "escape" | "close" | "rotate" | "ignore" | null {
  if (code === "Escape") return "escape";
  if (inventoryCodes.includes(code)) return repeat ? "ignore" : "close";
  if (code === "KeyR" && holding) return "rotate";
  return null;
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
    inLobby: Boolean(ui.lobby && !ui.lobby.launched)
  });
  return aiming && ui.hud !== null && ui.hud.status === "alive";
}

/**
 * The grid inventory over a live run. On desktop the game stays live under it: the mouse aims and fires, and
 * the keys and the pad play, except where the window owns the pointer (inventory-hands.ts). On touch, opening
 * takes the hands off the game and leaves the feet free (`setWalkOnly`); closing gives them back only if nothing
 * else has them. Every move in the window is sent as it happens (`onMove`, use-move-ledger.ts); closing sends nothing
 * but the container's `container_view` close.
 */
export function useInventoryModal(
  ui: Ref<UiState>,
  input: Held,
  panel: Ref<InventoryPanel | null>,
  send: (move: ItemMove) => void,
  /** A container's window opened or closed, so the host keeps its contents live. */
  sendView: (id: number, open: boolean) => void,
  /** True once the survivor has walked clear of the container with this id. */
  walkedAwayFrom: (containerId: number) => boolean = () => false,
  /** Closes the grid the way the Close button does, so the container can be searched again. */
  onAway: () => void = () => hide()
) {
  const isOpen = ref(false);
  const moves = useMoveLedger(send, sendView, () => panel.value?.itemOrigin ?? null);
  /** The grids on screen, refilled in place from the ledger; `openings` changes when the window must be rebuilt. */
  const { working, openings } = moves;
  /** The window was opened by a search that is still under way: its grid is empty and being swept. */
  const searchingOpen = ref(false);
  /** This opening took the hands off the game (touch only), so closing must give them back. */
  let tookHands = false;

  /**
   * Registers the window as the one that may own the pointer. A phone has no pointer to share, so there the
   * grid takes the hands as it always has; a desktop keeps playing, so its latches are never wiped.
   */
  function openHands(searching: boolean): void {
    setInventoryHands({ ownsPoint: (x, y) => panel.value?.ownsPoint(x, y) ?? false, sharesPad: () => !searchingOpen.value });
    const takesHands = !searching && ui.value.touch && !tookHands;
    if (!takesHands) return;
    input.letGoButtons();
    input.setWalkOnly();
    tookHands = true;
  }

  let autoCloseTimer: ReturnType<typeof setTimeout> | null = null;

  function cancelAutoClose(): void {
    if (autoCloseTimer !== null) {
      clearTimeout(autoCloseTimer);
      autoCloseTimer = null;
    }
  }

  /**
   * A window opening over one already open (a search that ends under the Nearby window) first puts back what is
   * held. Every move was sent as it was made, so nothing is lost when the grids are rebuilt.
   */
  function settleOpen(): void {
    cancelAutoClose();
    if (!isOpen.value) return;
    panel.value?.settle();
  }

  function show(): boolean {
    const hud = ui.value.hud;
    const canShow = inventoryReachable(ui.value) && hud !== null;
    if (!canShow) return false;
    settleOpen();
    moves.open(hud, { containerId: null, title: "Nearby", items: [] });
    openHands(false);
    endContainerZoom();
    isOpen.value = true;
    return true;
  }

  function showContainer(
    containerId: number,
    containerTitle: string,
    items: readonly GridItem[] = [],
    containerKind?: ContainerKind,
    containerArt?: ContainerArt | null,
    flipped = false,
    /** Opened at the start of a search: the hands stay on the game, so the search key keeps counting. */
    searching = false,
    /** The look it is drawn with: a look with its own grid opens in that grid. */
    look?: string
  ): boolean {
    const hud = ui.value.hud;
    const canShow = inventoryReachable(ui.value) && hud !== null;
    if (!canShow) return false;
    settleOpen();
    moves.open(hud, { containerId, title: containerTitle, items, kind: containerKind, art: containerArt, flipped, look });
    searchingOpen.value = searching;
    openHands(searching);
    beginContainerZoom(containerId);
    isOpen.value = true;
    return true;
  }

  /** A searched container left empty shuts itself, if the player asked for that, once the last item has flown out. */
  function checkEmpty(): void {
    const active = working.value;
    const isFurniture = active && active.containerId !== null && active.containerId !== undefined;
    if (!isFurniture) return;

    if (active.container.items.length === 0 && loadAutoCloseEmptyLoot()) {
      cancelAutoClose();
      autoCloseTimer = setTimeout(() => {
        autoCloseTimer = null;
        if (isOpen.value && working.value?.container.items.length === 0) {
          hide();
        }
      }, FLY_MS);
    } else if (active.container.items.length > 0) {
      cancelAutoClose();
    }
  }

  /** One move from the window, sent as it happens: `land` when set down by hand, `fly` when sent across from `origin`. */
  function onMove(move: ProposedMove, motion: MotionKind, origin: CellOrigin | null = null): void {
    moves.onMove(move, motion, origin);
    checkEmpty();
  }

  function hide(): void {
    cancelAutoClose();
    if (!isOpen.value) return;
    const gave = tookHands;
    tookHands = false;
    setInventoryHands(null);
    setHeld(null);
    searchingOpen.value = false;
    panel.value?.settle();
    isOpen.value = false;
    moves.close();
    endContainerZoom();
    // A desktop close leaves the input alone, so the shot of the frame it closes on is not wiped.
    if (gave && inventoryReachable(ui.value)) input.setEnabled(true);
  }

  /** A grid over a searched container shuts itself when the survivor walks away from it. */
  function checkAway(): void {
    const id = working.value?.containerId;
    if (!isOpen.value || id === null || id === undefined) return;
    if (walkedAwayFrom(id)) onAway();
  }

  /**
   * Opens the grid on I or B. While it is open only Esc, I/B and R with an item in hand are its own: those are
   * swallowed so the game's listener never sees them. Every other key goes on to the game, which stays live.
   */
  function onKey(event: KeyboardEvent): void {
    if (!isOpen.value) {
      const { inventory, ...others } = loadKeyBindings();
      const reboundCodes = Object.values(others).flat();
      if (!isInventoryKey(event, inventory, reboundCodes)) return;
      event.preventDefault();
      event.stopPropagation();
      show();
      return;
    }
    if (isTypingTarget(event.target)) return;
    const action = inventoryKeyAction(event.code, event.repeat, inventoryHolding(), loadKeyBindings().inventory);
    // Mid-search the hands are still on the game: every key, the search key above all, goes straight through,
    // except R on an item in hand, which turns it there too instead of reloading.
    const passes = action === null || (searchingOpen.value && action !== "rotate");
    if (passes) return;
    event.stopPropagation();
    event.preventDefault();
    if (action === "escape") panel.value?.escape();
    else if (action === "close") hide();
    else if (action === "rotate") panel.value?.rotate();
  }

  /** Something else took the screen (pause, a death, a station): the modal goes with it. */
  const shouldClose = computed(() => isOpen.value && !inventoryReachable(ui.value));
  watch(shouldClose, (gone) => {
    if (gone) hide();
  });

  /** Every snapshot settles the move ledger against the host, open or shut, so an open window shows what the host has. */
  watch(
    () => ui.value.hud,
    (hud) => moves.confirm(hud),
    { immediate: true }
  );
  const awayTimer = setInterval(checkAway, AWAY_CHECK_MS);

  /** Capture, so the press lands before the game's own listener on the same window. */
  onMounted(() => window.addEventListener("keydown", onKey, true));
  onBeforeUnmount(() => {
    cancelAutoClose();
    window.removeEventListener("keydown", onKey, true);
    clearInterval(awayTimer);
    setInventoryHands(null);
    setHeld(null);
    if (isOpen.value && tookHands) input.setEnabled(true);
  });

  return { isOpen, working, openings, searchingOpen, show, showContainer, hide, onMove };
}
