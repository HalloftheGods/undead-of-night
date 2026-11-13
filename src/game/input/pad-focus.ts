// Menu focus for a gamepad: the D-pad and left stick move DOM focus between the buttons on screen,
// A clicks the focused one, B clicks Back or Close. It works over whatever is drawn (PixelButton,
// MenuLink, plain buttons), so no screen needs to know a pad exists. The choosing is plain
// geometry (`pickTarget`) and the DOM part is a thin layer over it.
//
// Conventions a screen may opt into, all optional:
//   data-pad-default  the control that takes focus first when nothing has it
//   data-pad-group    controls sharing one value wrap among themselves at the end of a list
//   data-pad-back     the control B clicks, when its label is not Back, Close, Cancel or Done
//   data-pad-gate     a gate (the Press Any Key line) is up: a pad press only answers the gate

import type { NavDirection } from './gamepad-input.ts';

export interface Rect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface FocusTarget<T> {
  readonly ref: T;
  readonly rect: Rect;
  /** `data-pad-group`, or null for a control in no list. */
  readonly group: string | null;
}

/** Sideways drift counts double against distance ahead, so a push keeps to its own row or column. */
const LATERAL_WEIGHT = 2;
/** A control less than this far ahead is on the same line, not in that direction. */
const AHEAD_MIN = 1;

interface Point {
  readonly x: number;
  readonly y: number;
}

function centreOf(rect: Rect): Point {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/** How far `to` lies along the pushed direction, and how far off to the side. */
function offsets(from: Point, to: Point, direction: NavDirection): { along: number; across: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (direction === 'right') return { along: dx, across: Math.abs(dy) };
  if (direction === 'left') return { along: -dx, across: Math.abs(dy) };
  if (direction === 'down') return { along: dy, across: Math.abs(dx) };
  return { along: -dy, across: Math.abs(dx) };
}

/**
 * The control to move to from `from`: the nearest centre in the pushed direction, sideways drift
 * weighted double. With nothing ahead it wraps to the far end of the line (inside the group, when
 * `from` is in one). Null when there is nowhere else to go.
 */
export function pickTarget<T>(from: FocusTarget<T>, targets: readonly FocusTarget<T>[], direction: NavDirection): FocusTarget<T> | null {
  const others = targets.filter((target) => target.ref !== from.ref);
  const origin = centreOf(from.rect);
  let best: FocusTarget<T> | null = null;
  let bestScore = Infinity;
  for (const target of others) {
    const { along, across } = offsets(origin, centreOf(target.rect), direction);
    if (along < AHEAD_MIN) continue;
    const score = along + LATERAL_WEIGHT * across;
    if (score < bestScore) {
      best = target;
      bestScore = score;
    }
  }
  if (best) return best;
  const pool = from.group === null ? others : others.filter((target) => target.group === from.group);
  let far: FocusTarget<T> | null = null;
  let farScore = -Infinity;
  for (const target of pool) {
    const { along, across } = offsets(origin, centreOf(target.rect), direction);
    const score = -along - LATERAL_WEIGHT * across;
    if (score > farScore) {
      far = target;
      farScore = score;
    }
  }
  return far;
}

// --- The DOM layer -----------------------------------------------------------------------

/** What a pad can land on. Text fields count: a pad has no keyboard to be stranded in one with. */
export const PAD_FOCUSABLE = 'button, a[href], summary, select, textarea, input:not([type="hidden"]), [role="button"], [tabindex="0"]';
const DISABLED = ':disabled, [aria-disabled="true"]';
/** Where focus lands first when nothing has it, best first. The title menu marks its row with aria-current. */
const DEFAULT_FIRST: readonly string[] = ['[data-pad-default]', '[aria-current="true"]', '.is-selected', '.is-primary'];
const BACK_LABEL = /^[<‹«]?\s*(back|close|cancel|done)\s*$/i;
const NAV_STEP: Readonly<Record<NavDirection, number>> = { left: -1, right: 1, up: 0, down: 0 };

/** Where the pad meets the screen. The default one reads the page; a test passes its own. */
export interface PadMenu {
  /** Moves focus, or nudges a slider. True if it did something. */
  navigate(direction: NavDirection): boolean;
  /** A: clicks the focused control. True if there was one to click. */
  activate(): boolean;
  /** B: clicks the screen's Back or Close. True if there was one. */
  back(): boolean;
  /** Start: clicks the screen's main button, or opens the title row in hand. True if there was one. */
  start(): boolean;
}

function hasDom(doc: Document | undefined): doc is Document {
  return doc !== undefined && typeof doc.querySelectorAll === 'function' && doc.documentElement !== undefined;
}

function visibleRect(el: HTMLElement, doc: Document): Rect | null {
  // tabindex="-1" does not rule a control out: the shelves, tab strips and rosters keep every tile but the chosen one at -1, and a pad has no arrow keys to walk them.
  const isOff = el.matches(DISABLED) || el.closest('[inert]') !== null;
  if (isOff) return null;
  const isHidden = typeof el.checkVisibility === 'function' && !el.checkVisibility({ checkVisibilityCSS: true });
  if (isHidden) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  const view = doc.documentElement;
  const left = Math.max(rect.left, 0);
  const right = Math.min(rect.left + rect.width, view.clientWidth);
  const top = Math.max(rect.top, 0);
  const bottom = Math.min(rect.top + rect.height, view.clientHeight);
  const isOffScreen = right <= left || bottom <= top;
  if (isOffScreen) return null;
  // Whatever is on top at the middle of the visible part must be this control (or hold it): a menu over a menu hides the one below.
  const hit = doc.elementFromPoint((left + right) / 2, (top + bottom) / 2);
  const isCovered = hit !== null && !el.contains(hit) && !hit.contains(el);
  return isCovered ? null : rect;
}

/** Every control a pad could land on right now, in page order. */
export function focusTargets(doc: Document): FocusTarget<HTMLElement>[] {
  const found: FocusTarget<HTMLElement>[] = [];
  for (const node of Array.from(doc.querySelectorAll<HTMLElement>(PAD_FOCUSABLE))) {
    const rect = visibleRect(node, doc);
    if (rect) found.push({ ref: node, rect, group: node.closest('[data-pad-group]')?.getAttribute('data-pad-group') ?? null });
  }
  return found;
}

function focusVisibly(el: HTMLElement): void {
  // focusVisible makes the browser draw the keyboard ring, which a script-moved focus would otherwise skip.
  const options: FocusOptions & { focusVisible?: boolean } = { focusVisible: true };
  el.focus(options);
}

function isRange(el: Element | null): el is HTMLInputElement {
  return el !== null && el.matches('input[type="range"]');
}

/** One step of a slider, as the arrow key would. Fires input and change, which v-model listens to. */
function stepRange(slider: HTMLInputElement, sign: number): void {
  const min = Number(slider.min === '' ? 0 : slider.min);
  const max = Number(slider.max === '' ? 100 : slider.max);
  // An unset step is 1, as the browser reads it; step="any" has no size, so a twentieth of the range.
  const rawStep = slider.step === '' ? 1 : Number(slider.step);
  const step = Number.isFinite(rawStep) && rawStep > 0 ? rawStep : (max - min) / 20;
  const value = Number(slider.value);
  const next = Math.min(max, Math.max(min, value + sign * step));
  const rounded = Number(next.toFixed(6));
  if (rounded === value) return;
  slider.value = String(rounded);
  slider.dispatchEvent(new Event('input', { bubbles: true }));
  slider.dispatchEvent(new Event('change', { bubbles: true }));
}

/** The control to take focus first: the best marker present wins, else the first control on the page. */
function defaultTarget(targets: readonly FocusTarget<HTMLElement>[]): FocusTarget<HTMLElement> | null {
  for (const marker of DEFAULT_FIRST) {
    const marked = targets.find((target) => target.ref.matches(marker));
    if (marked) return marked;
  }
  return targets[0] ?? null;
}

/** True while a gate (Press Any Key) is on screen: the D-pad must not wander off to the footer links behind it. */
function gateUp(doc: Document): boolean {
  return doc.querySelector('[data-pad-gate]') !== null;
}

/** Moves focus one step. Nothing focused yet: takes the screen's default control instead. */
export function navigateFocus(direction: NavDirection, doc: Document | undefined = globalThis.document): boolean {
  if (!hasDom(doc)) return false;
  const active = doc.activeElement;
  const sign = NAV_STEP[direction];
  if (isRange(active) && sign !== 0) {
    stepRange(active, sign);
    return true;
  }
  if (gateUp(doc)) return false;
  const targets = focusTargets(doc);
  const from = targets.find((target) => target.ref === active) ?? null;
  const next = from ? pickTarget(from, targets, direction) : defaultTarget(targets);
  if (!next) return false;
  focusVisibly(next.ref);
  return true;
}

/** Clicks the focused control, if it is one a pad should click. */
export function activateFocus(doc: Document | undefined = globalThis.document): boolean {
  if (!hasDom(doc)) return false;
  const active = doc.activeElement as HTMLElement | null;
  const isControl = active !== null && active.matches('button, a[href], summary, [role="button"], input[type="checkbox"], input[type="radio"]');
  if (!isControl || active.matches(DISABLED)) return false;
  active.click();
  return true;
}

/** The label a control shows: its aria-label, else its text. */
function labelOf(el: HTMLElement): string {
  return (el.getAttribute('aria-label') ?? el.textContent ?? '').trim();
}

/** Clicks the screen's Back or Close: a `data-pad-back` control first, else one labelled Back, Close, Cancel or Done. */
export function pressBack(doc: Document | undefined = globalThis.document): boolean {
  if (!hasDom(doc)) return false;
  const targets = focusTargets(doc);
  const marked = targets.find((target) => target.ref.matches('[data-pad-back]'));
  const labelled = targets.find((target) => BACK_LABEL.test(labelOf(target.ref)));
  const button = marked ?? labelled;
  if (!button) return false;
  button.ref.click();
  return true;
}

/**
 * Start: a `data-pad-start` control, else the screen's primary button (Start Run, Play), else the title menu's
 * highlighted row, so Start on 1-5 Player opens that list. Null-safe: a screen with none leaves Start to pause.
 */
export function pressStart(doc: Document | undefined = globalThis.document): boolean {
  if (!hasDom(doc)) return false;
  const targets = focusTargets(doc);
  const pick = (selector: string) => targets.find((target) => target.ref.matches(selector));
  const button =
    pick('[data-pad-start]') ??
    pick('.px-button.is-primary') ??
    pick('.px-menu-item[aria-current="true"]') ??
    pick('.px-menu-item.is-primary');
  if (!button) return false;
  button.ref.click();
  return true;
}

/** The pad's hands on the page. */
export const DOM_PAD_MENU: PadMenu = {
  navigate: (direction) => navigateFocus(direction),
  activate: () => activateFocus(),
  back: () => pressBack(),
  start: () => pressStart(),
};

/** Puts focus on the screen's default control, for a screen that opens with the pad in charge. True if it did. */
export function focusDefault(doc: Document | undefined = globalThis.document): boolean {
  if (!hasDom(doc)) return false;
  const target = defaultTarget(focusTargets(doc));
  if (!target) return false;
  focusVisibly(target.ref);
  return true;
}
