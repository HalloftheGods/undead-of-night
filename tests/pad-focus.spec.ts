import { describe, expect, it } from 'vitest';
import { activateFocus, focusDefault, focusTargets, navigateFocus, pickTarget, pressBack } from '../src/game/pad-focus.ts';
import type { FocusTarget, Rect } from '../src/game/pad-focus.ts';

// --- Geometry: no page needed ---------------------------------------------------------------

const box = (left: number, top: number, width = 100, height = 40): Rect => ({ left, top, width, height });
const target = (ref: string, rect: Rect, group: string | null = null): FocusTarget<string> => ({ ref, rect, group });

describe('picking where focus goes', () => {
  // Two columns of two, then a wide button under both.
  const a = target('a', box(0, 0));
  const b = target('b', box(200, 0));
  const c = target('c', box(0, 100));
  const d = target('d', box(200, 100));
  const wide = target('wide', box(0, 200, 300));
  const all = [a, b, c, d, wide];

  it('steps to the nearest control in the pushed direction', () => {
    expect(pickTarget(a, all, 'right')?.ref).toBe('b');
    expect(pickTarget(a, all, 'down')?.ref).toBe('c');
    expect(pickTarget(d, all, 'left')?.ref).toBe('c');
    expect(pickTarget(d, all, 'up')?.ref).toBe('b');
    expect(pickTarget(c, all, 'down')?.ref).toBe('wide');
  });

  it('takes a slightly offset near control over a far aligned one, but not one far to the side', () => {
    const near = target('near', box(30, 50, 100, 40));
    const aligned = target('aligned', box(0, 140));
    expect(pickTarget(a, [a, near, aligned], 'down')?.ref).toBe('near');
    const farAside = target('farAside', box(400, 50));
    expect(pickTarget(a, [a, farAside, aligned], 'down')?.ref).toBe('aligned');
  });

  it('does not count a control on the same row as being below', () => {
    expect(pickTarget(a, [a, b, c], 'down')?.ref).toBe('c');
  });

  it('has nowhere to go when it is the only control', () => {
    expect(pickTarget(a, [a], 'down')).toBeNull();
  });

  it('wraps to the far end of the line when nothing lies ahead', () => {
    const column = [target('one', box(0, 0)), target('two', box(0, 60)), target('three', box(0, 120))];
    expect(pickTarget(column[2], column, 'down')?.ref).toBe('one');
    expect(pickTarget(column[0], column, 'up')?.ref).toBe('three');
  });

  it('wraps inside its own group when it is in one', () => {
    const list = [target('x1', box(0, 0), 'list'), target('x2', box(0, 60), 'list')];
    const outside = target('outside', box(300, 0));
    expect(pickTarget(list[1], [...list, outside], 'down')?.ref).toBe('x1');
  });

  it('can leave a group by a push the group has no more room for', () => {
    const list = [target('x1', box(0, 0), 'list'), target('x2', box(0, 60), 'list')];
    const below = target('below', box(0, 200));
    expect(pickTarget(list[1], [...list, below], 'down')?.ref).toBe('below');
  });
});

// --- The page: a small fake DOM --------------------------------------------------------------

interface Spec {
  readonly tag?: string;
  readonly classes?: readonly string[];
  readonly attrs?: Record<string, string>;
  readonly disabled?: boolean;
  readonly hiddenByCss?: boolean;
  readonly text?: string;
  readonly parent?: FakeEl;
}

/** Just what pad-focus asks of an element. Selectors are matched by a tiny reader of the forms the module uses. */
class FakeEl {
  readonly tag: string;
  readonly classes: readonly string[];
  readonly attrs: Record<string, string>;
  readonly disabled: boolean;
  readonly hiddenByCss: boolean;
  readonly textContent: string;
  readonly parent: FakeEl | null;
  readonly events: string[] = [];
  clicks = 0;
  focusOptions: unknown = null;
  value = '';
  min = '';
  max = '';
  step = '';

  constructor(
    readonly rect: Rect,
    private readonly doc: FakeDoc,
    spec: Spec = {},
  ) {
    this.tag = spec.tag ?? 'button';
    this.classes = spec.classes ?? [];
    this.attrs = spec.attrs ?? {};
    this.disabled = spec.disabled ?? false;
    this.hiddenByCss = spec.hiddenByCss ?? false;
    this.textContent = spec.text ?? '';
    this.parent = spec.parent ?? null;
  }

  getBoundingClientRect(): Rect {
    return this.rect;
  }

  getAttribute(name: string): string | null {
    return this.attrs[name] ?? null;
  }

  checkVisibility(): boolean {
    return !this.hiddenByCss;
  }

  contains(other: FakeEl | null): boolean {
    for (let at = other; at !== null; at = at.parent) if (at === this) return true;
    return false;
  }

  closest(selector: string): FakeEl | null {
    if (this.matches(selector)) return this;
    return this.parent?.closest(selector) ?? null;
  }

  matches(selector: string): boolean {
    return selector.split(',').some((part) => this.matchesOne(part.trim()));
  }

  private matchesOne(selector: string): boolean {
    const tag = /^[a-z]+/.exec(selector)?.[0];
    if (tag !== undefined && tag !== this.tag) return false;
    const rest = selector.slice(tag?.length ?? 0);
    for (const part of rest.matchAll(/\.([\w-]+)|\[([\w-]+)(?:="([^"]*)")?\]|:(disabled)/g)) {
      const [, cls, attr, expected, pseudo] = part;
      if (cls !== undefined && !this.classes.includes(cls)) return false;
      if (attr !== undefined) {
        const actual = this.attrs[attr];
        if (actual === undefined || (expected !== undefined && actual !== expected)) return false;
      }
      if (pseudo !== undefined && !this.disabled) return false;
    }
    return true;
  }

  focus(options?: unknown): void {
    this.focusOptions = options ?? null;
    this.doc.activeElement = this;
  }

  click(): void {
    this.clicks += 1;
  }

  dispatchEvent(event: Event): boolean {
    this.events.push(event.type);
    return true;
  }
}

class FakeDoc {
  readonly all: FakeEl[] = [];
  readonly page = new FakeEl(box(0, 0, 800, 600), this, { tag: 'main' });
  activeElement: FakeEl | null = null;
  gate = false;
  readonly documentElement = { clientWidth: 800, clientHeight: 600 };

  add(rect: Rect, spec: Spec = {}): FakeEl {
    const el = new FakeEl(rect, this, spec);
    this.all.push(el);
    return el;
  }

  querySelectorAll(): FakeEl[] {
    return this.all.filter((el) => el.tag !== 'div');
  }

  querySelector(selector: string): object | null {
    return selector === '[data-pad-gate]' && this.gate ? {} : null;
  }

  /** The last element added whose box holds the point: what is drawn on top. */
  elementFromPoint(x: number, y: number): FakeEl {
    for (let index = this.all.length - 1; index >= 0; index -= 1) {
      const { rect } = this.all[index];
      const isInside = x >= rect.left && x <= rect.left + rect.width && y >= rect.top && y <= rect.top + rect.height;
      if (isInside) return this.all[index];
    }
    return this.page;
  }

  get asDocument(): Document {
    return this as unknown as Document;
  }
}

/** Three stacked buttons, the first of them the screen's primary. */
function column(): { doc: FakeDoc; play: FakeEl; options: FakeEl; quit: FakeEl } {
  const doc = new FakeDoc();
  const play = doc.add(box(100, 100), { classes: ['is-primary'], text: 'Play' });
  const options = doc.add(box(100, 160), { text: 'Options' });
  const quit = doc.add(box(100, 220), { text: 'Quit' });
  return { doc, play, options, quit };
}

describe('moving focus on a page', () => {
  it('lands on the screen default when nothing has focus, asking for the visible focus ring', () => {
    const { doc, play } = column();
    expect(navigateFocus('down', doc.asDocument)).toBe(true);
    expect(doc.activeElement).toBe(play);
    expect(play.focusOptions).toMatchObject({ focusVisible: true });
  });

  it('prefers data-pad-default, then the marked title row, then the primary button', () => {
    const { doc, options } = column();
    options.attrs['data-pad-default'] = '';
    navigateFocus('down', doc.asDocument);
    expect(doc.activeElement).toBe(options);

    const marked = column();
    marked.quit.attrs['aria-current'] = 'true';
    focusDefault(marked.doc.asDocument);
    expect(marked.doc.activeElement).toBe(marked.quit);
  });

  it('steps down and up the column, and wraps at the ends', () => {
    const { doc, play, options, quit } = column();
    play.focus();
    navigateFocus('down', doc.asDocument);
    expect(doc.activeElement).toBe(options);
    navigateFocus('down', doc.asDocument);
    expect(doc.activeElement).toBe(quit);
    navigateFocus('down', doc.asDocument);
    expect(doc.activeElement).toBe(play);
    navigateFocus('up', doc.asDocument);
    expect(doc.activeElement).toBe(quit);
  });

  it('moves along a row with left and right', () => {
    const doc = new FakeDoc();
    const left = doc.add(box(100, 300));
    const right = doc.add(box(300, 300));
    left.focus();
    navigateFocus('right', doc.asDocument);
    expect(doc.activeElement).toBe(right);
    navigateFocus('left', doc.asDocument);
    expect(doc.activeElement).toBe(left);
  });

  it('reaches every tile of a roving-tabindex list, not only the one with tabindex 0', () => {
    const doc = new FakeDoc();
    const first = doc.add(box(0, 0), { attrs: { role: 'radio', tabindex: '0' } });
    const second = doc.add(box(120, 0), { attrs: { role: 'radio', tabindex: '-1' } });
    const third = doc.add(box(240, 0), { attrs: { role: 'radio', tabindex: '-1' } });
    first.focus();
    navigateFocus('right', doc.asDocument);
    expect(doc.activeElement).toBe(second);
    navigateFocus('right', doc.asDocument);
    expect(doc.activeElement).toBe(third);
    expect(activateFocus(doc.asDocument)).toBe(true);
    expect(third.clicks).toBe(1);
  });

  it('skips what cannot be used: disabled, hidden, flat, inert or off screen', () => {
    const { doc, play, quit } = column();
    doc.add(box(100, 190), { disabled: true });
    doc.add(box(100, 195), { hiddenByCss: true });
    doc.add(box(100, 196, 0, 0));
    const dead = doc.add(box(100, 198), { attrs: { inert: '' } });
    doc.add(box(100, 900));
    expect(dead.matches('[inert]')).toBe(true);
    const refs = focusTargets(doc.asDocument).map((entry) => entry.ref);
    expect(refs).toHaveLength(3);
    expect(refs).toContain(play);
    expect(refs).toContain(quit);
  });

  it('does not reach a control hidden under an overlay', () => {
    const { doc, play, options, quit } = column();
    const overlay = doc.add(box(0, 0, 800, 600), { tag: 'div' });
    const pause = doc.add(box(300, 250), { text: 'Resume', parent: overlay });
    const refs = focusTargets(doc.asDocument).map((entry) => entry.ref);
    expect(refs).toEqual([pause]);
    expect(refs).not.toContain(play);
    expect(refs).not.toContain(options);
    expect(refs).not.toContain(quit);
  });

  it('still reaches a control that is only partly on screen', () => {
    const doc = new FakeDoc();
    const edge = doc.add(box(700, 560, 200, 100));
    expect(focusTargets(doc.asDocument).map((entry) => entry.ref)).toEqual([edge]);
  });

  it('nudges a slider with left and right instead of moving focus, and moves off it with up and down', () => {
    const doc = new FakeDoc();
    const above = doc.add(box(100, 100));
    const slider = doc.add(box(100, 160, 200, 20), { tag: 'input', attrs: { type: 'range' } });
    slider.value = '50';
    slider.min = '0';
    slider.max = '100';
    slider.step = '10';
    slider.focus();
    expect(navigateFocus('right', doc.asDocument)).toBe(true);
    expect(slider.value).toBe('60');
    expect(slider.events).toEqual(['input', 'change']);
    navigateFocus('left', doc.asDocument);
    navigateFocus('left', doc.asDocument);
    expect(slider.value).toBe('40');
    expect(doc.activeElement).toBe(slider);
    navigateFocus('up', doc.asDocument);
    expect(doc.activeElement).toBe(above);
  });

  it('stops a slider at its ends and says nothing changed', () => {
    const doc = new FakeDoc();
    const slider = doc.add(box(100, 160, 200, 20), { tag: 'input', attrs: { type: 'range' } });
    slider.value = '100';
    slider.max = '100';
    slider.step = '10';
    slider.focus();
    navigateFocus('right', doc.asDocument);
    expect(slider.value).toBe('100');
    expect(slider.events).toEqual([]);
  });

  it('takes a tenth-sized step on a slider with step any, without float dust', () => {
    const doc = new FakeDoc();
    const slider = doc.add(box(100, 160, 200, 20), { tag: 'input', attrs: { type: 'range' } });
    slider.value = '0.1';
    slider.min = '0';
    slider.max = '1';
    slider.step = 'any';
    slider.focus();
    navigateFocus('right', doc.asDocument);
    expect(slider.value).toBe('0.15');
  });

  it('takes a step of 1 on a slider with no step set', () => {
    const doc = new FakeDoc();
    const slider = doc.add(box(100, 160, 200, 20), { tag: 'input', attrs: { type: 'range' } });
    slider.value = '5';
    slider.min = '0';
    slider.max = '10';
    slider.focus();
    navigateFocus('right', doc.asDocument);
    expect(slider.value).toBe('6');
  });

  it('leaves focus alone while a gate such as Press Any Key is up', () => {
    const { doc } = column();
    doc.gate = true;
    expect(navigateFocus('down', doc.asDocument)).toBe(false);
    expect(doc.activeElement).toBeNull();
  });

  it('does nothing on a page with nothing to focus, or with no page at all', () => {
    expect(navigateFocus('down', new FakeDoc().asDocument)).toBe(false);
    expect(navigateFocus('down', {} as Document)).toBe(false);
    expect(activateFocus({} as Document)).toBe(false);
    expect(pressBack({} as Document)).toBe(false);
    expect(focusDefault({} as Document)).toBe(false);
  });
});

describe('A and B on a page', () => {
  it('A clicks the focused button, and only that one', () => {
    const { doc, play, options } = column();
    options.focus();
    expect(activateFocus(doc.asDocument)).toBe(true);
    expect([play.clicks, options.clicks]).toEqual([0, 1]);
  });

  it('A clicks a role=button and a checkbox, and leaves a focused text field and a disabled button alone', () => {
    const doc = new FakeDoc();
    const card = doc.add(box(0, 0), { tag: 'div', attrs: { role: 'button' } });
    const check = doc.add(box(0, 60), { tag: 'input', attrs: { type: 'checkbox' } });
    const field = doc.add(box(0, 120), { tag: 'input', attrs: { type: 'text' } });
    const off = doc.add(box(0, 180), { disabled: true });
    for (const el of [card, check]) {
      el.focus();
      expect(activateFocus(doc.asDocument)).toBe(true);
      expect(el.clicks).toBe(1);
    }
    for (const el of [field, off]) {
      el.focus();
      expect(activateFocus(doc.asDocument)).toBe(false);
      expect(el.clicks).toBe(0);
    }
  });

  it('A with nothing focused clicks nothing, so the screen confirm can answer', () => {
    const { doc } = column();
    expect(activateFocus(doc.asDocument)).toBe(false);
  });

  it('B clicks Back or Close, whatever the case or the arrow in front of it', () => {
    for (const label of ['Back', 'close', '‹ Back', '< Back', 'Cancel', 'Done']) {
      const { doc } = column();
      const back = doc.add(box(500, 100), { text: ` ${label} ` });
      expect(pressBack(doc.asDocument)).toBe(true);
      expect(back.clicks).toBe(1);
    }
  });

  it('B reads aria-label when a control has no words', () => {
    const doc = new FakeDoc();
    const icon = doc.add(box(0, 0), { attrs: { 'aria-label': 'Close' } });
    expect(pressBack(doc.asDocument)).toBe(true);
    expect(icon.clicks).toBe(1);
  });

  it('B prefers a control marked data-pad-back over one that is merely labelled', () => {
    const doc = new FakeDoc();
    const labelled = doc.add(box(0, 0), { text: 'Back' });
    const marked = doc.add(box(0, 60), { text: 'Leave', attrs: { 'data-pad-back': '' } });
    expect(pressBack(doc.asDocument)).toBe(true);
    expect([labelled.clicks, marked.clicks]).toEqual([0, 1]);
  });

  it('B does not click words that only start with Back, and falls through when no Back shows', () => {
    const doc = new FakeDoc();
    const other = doc.add(box(0, 0), { text: 'Back to menu' });
    const another = doc.add(box(0, 60), { text: 'Closed' });
    expect(pressBack(doc.asDocument)).toBe(false);
    expect(other.clicks + another.clicks).toBe(0);
  });

  it('B ignores a Back that sits under an overlay', () => {
    const doc = new FakeDoc();
    const back = doc.add(box(10, 10), { text: 'Back' });
    doc.add(box(0, 0, 800, 600), { tag: 'div' });
    expect(pressBack(doc.asDocument)).toBe(false);
    expect(back.clicks).toBe(0);
  });
});
