import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch, type Ref } from "vue";
import type { BagCommit } from "@shared/bag.ts";
import type { ContainerArt } from "@art/containers.ts";
import type { ContainerKind } from "@shared/containers.ts";
import type { GridItem } from "@shared/grid-inventory.ts";
import { loadKeyBindings } from "@game/controls-prefs.ts";
import { aimsCursor } from "@game/home-screens.ts";
import type { UiState } from "@game/hud-state.ts";
import type { InputManager } from "@game/input-manager.ts";
import { LocalBag, type BagWorking } from "./local-bag.ts";
import { loadAutoCloseEmptyLoot } from "@game/loot-prefs.ts";

/** How often a shut bag checks itself against the host's hash. */
const HEAL_CHECK_MS = 500;

/** The grid inventory opens on I or B. Tab is the map's; neither letter is in `DEFAULT_KEY_BINDINGS`. */
export const INVENTORY_CODES: readonly string[] = ["KeyI", "KeyB"];

/** What the modal lets the window ask of it. */
export interface InventoryPanel {
  escape: () => void;
  rotate: () => void;
  /** Puts back what is being held, so the grids are whole. */
  settle: () => void;
}

type Held = Pick<InputManager, "setEnabled" | "setWalkOnly" | "letGoButtons">;

/** What the grid was opened with: nothing for the pack alone, or the container it searches. */
interface OpenedGrid {
  containerId: number | null;
  title: string;
  items: readonly GridItem[];
  kind?: ContainerKind;
  art?: ContainerArt | null;
}

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
  reboundCodes: readonly string[]
): boolean {
  const isTheKey = INVENTORY_CODES.includes(event.code) && !event.repeat;
  const isBare = !event.ctrlKey && !event.metaKey && !event.altKey;
  const isFree = !isTypingTarget(event.target) && !reboundCodes.includes(event.code);
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
    inLobby: Boolean(ui.lobby && !ui.lobby.launched)
  });
  return aiming && ui.hud !== null && ui.hud.status === "alive";
}

/**
 * The grid inventory over a live run. Opening takes the player's hands off the game (the same
 * `setEnabled` the pause menu uses); closing gives them back only if nothing else has them. Moves in
 * the modal edit a working copy and send nothing; closing sends one commit if anything changed.
 */
export function useInventoryModal(
  ui: Ref<UiState>,
  input: Held,
  panel: Ref<InventoryPanel | null>,
  send: (commit: BagCommit) => void,
  /** True once the survivor has walked clear of the container with this id. */
  walkedAwayFrom: (containerId: number) => boolean = () => false,
  /** Closes the grid the way the Close button does, so the container can be searched again. */
  onAway: () => void = () => hide()
) {
  const isOpen = ref(false);
  const bag = new LocalBag(send);
  const working = shallowRef<BagWorking | null>(null);
  /** Changes on every opening, so the modal rebuilds from what is carried then. */
  const openings = ref(0);
  /** How the grid was last opened, so a live use or drop can rebuild it the same way. */
  let lastOpen: OpenedGrid | null = null;

  function show(): boolean {
    const hud = ui.value.hud;
    const canShow = inventoryReachable(ui.value) && hud !== null;
    if (!canShow) return false;
    bag.sync(hud);
    lastOpen = { containerId: null, title: "Nearby", items: [] };
    working.value = bag.open(hud);
    openings.value += 1;
    input.letGoButtons();
    input.setWalkOnly();
    isOpen.value = true;
    return true;
  }

  function showContainer(
    containerId: number,
    containerTitle: string,
    items: readonly GridItem[] = [],
    containerKind?: ContainerKind,
    containerArt?: ContainerArt | null
  ): boolean {
    const hud = ui.value.hud;
    const canShow = inventoryReachable(ui.value) && hud !== null;
    if (!canShow) return false;
    bag.sync(hud);
    lastOpen = { containerId, title: containerTitle, items, kind: containerKind, art: containerArt };
    working.value = bag.open(hud, containerId, containerTitle, items, containerKind, containerArt);
    openings.value += 1;
    input.letGoButtons();
    input.setWalkOnly();
    isOpen.value = true;
    return true;
  }

  function onTransfer(): void {
    if (
      working.value &&
      working.value.containerId !== null &&
      working.value.containerId !== undefined
    ) {
      if (working.value.container.items.length === 0 && loadAutoCloseEmptyLoot()) {
        hide();
      }
    }
  }

  /**
   * A use or a drop happens at once: the commit goes out now, and the copy is rebuilt from the bag as it now
   * stands, so the item leaves the grid and its effect or its drop shows without waiting for the modal to close.
   */
  function commitLive(): void {
    const before = working.value;
    const hud = ui.value.hud;
    const opened = lastOpen;
    const canRebuild = before !== null && opened !== null && hud !== null;
    if (!canRebuild) return;
    bag.close(before);
    const isFurniture = opened.containerId !== null;
    const containerItems = isFurniture ? before.container.items : [];
    const rebuilt = bag.open(hud, opened.containerId, opened.title, containerItems, opened.kind, opened.art);
    // The host's candy count can lag one snapshot behind, so a candy used or dropped here is taken out of the rebuilt candy bag too.
    const gone = new Set([...before.used, ...before.dropped].map((item) => item.id));
    rebuilt.candyBag.items = rebuilt.candyBag.items.filter((item) => !gone.has(item.id));
    working.value = rebuilt;
    openings.value += 1;
  }

  function onUse(item: GridItem): void {
    if (working.value) {
      working.value.used.push(item);
      commitLive();
    }
  }

  function onDrop(item: GridItem): void {
    if (working.value) {
      working.value.dropped.push(item);
      commitLive();
    }
  }

  function hide(): void {
    if (!isOpen.value) return;
    panel.value?.settle();
    if (working.value) bag.close(working.value);
    isOpen.value = false;
    working.value = null;
    if (inventoryReachable(ui.value)) input.setEnabled(true);
  }

  /** A grid over a searched container shuts itself when the survivor walks away from it. */
  function checkAway(): void {
    const id = working.value?.containerId;
    if (!isOpen.value || id === null || id === undefined) return;
    if (walkedAwayFrom(id)) onAway();
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
    // The feet are free: a walking key goes on to the game's own listener, which is what walks the survivor.
    const binds = loadKeyBindings();
    const isWalkKey = [...binds.moveUp, ...binds.moveDown, ...binds.moveLeft, ...binds.moveRight, ...binds.sprint, ...binds.sneak].includes(event.code);
    if (isWalkKey) return;
    event.stopPropagation();
    if (event.code === "Escape") {
      event.preventDefault();
      panel.value?.escape();
    } else if (INVENTORY_CODES.includes(event.code)) {
      event.preventDefault();
      if (!event.repeat) hide();
    } else if (event.code === "KeyR") {
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
  watch(
    () => ui.value.hud,
    (hud) => {
      if (hud) bag.sync(hud);
      else bag.reset();
    },
    { immediate: true }
  );
  const healTimer = setInterval(() => bag.heal(), HEAL_CHECK_MS);
  const awayTimer = setInterval(checkAway, AWAY_CHECK_MS);

  /** Capture, so the press lands before the game's own listener on the same window. */
  onMounted(() => window.addEventListener("keydown", onKey, true));
  onBeforeUnmount(() => {
    window.removeEventListener("keydown", onKey, true);
    clearInterval(healTimer);
    clearInterval(awayTimer);
    if (isOpen.value) input.setEnabled(true);
  });

  return { isOpen, working, openings, show, showContainer, hide, onTransfer, onUse, onDrop };
}
