import { describe, expect, it } from 'vitest';
import { layoutPageUi, pageFocusTargets, pageHitAt, scrollToShow, stepPageFocus, stepSlider, type PageModel } from '../src/engine/page-ui.ts';

const long = 'A long line of words that has to wrap onto several lines inside the panel so the page is taller than the view. '.repeat(14);

const model: PageModel = {
  heading: 'Options',
  panels: [
    {
      heading: 'Gameplay',
      items: [
        { kind: 'switch', id: 'loot', label: 'Auto-close', on: true, enabled: true },
        { kind: 'choice', id: 'size', label: 'UI size', options: [{ id: 'a', label: 'Small' }, { id: 'b', label: 'Big' }], value: 'a' },
        { kind: 'slider', id: 'shake', label: 'Shake', value: 0.5, readout: '50%' },
        { kind: 'text', text: long, tone: 'dim' },
      ],
    },
    { heading: 'Privacy', items: [{ kind: 'stat', label: 'Nights', value: '3' }, { kind: 'link', id: 'privacy', label: 'Privacy' }] },
  ],
  buttons: [{ id: 'back', label: 'Back', enabled: true, primary: false }],
};

const W = 427;
const H = 240;

describe('page kit layout', () => {
  const layout = layoutPageUi(model, W, H, 0);

  it('stacks the panels in a column and keeps Back inside the view', () => {
    expect(layout.panels).toHaveLength(2);
    expect(layout.panels[1].box.y).toBeGreaterThan(layout.panels[0].box.y + layout.panels[0].box.h - 1);
    const back = layout.buttons[0];
    expect(back.y + back.h).toBeLessThanOrEqual(H);
    expect(back.x + back.w).toBeLessThanOrEqual(W);
  });

  it('wraps text and scrolls when the content is taller than the area', () => {
    expect(layout.lines.length).toBeGreaterThan(3);
    expect(layout.scrollMax).toBeGreaterThan(0);
    const scrolled = layoutPageUi(model, W, H, layout.scrollMax);
    expect(scrolled.panels[0].box.y).toBe(layout.panels[0].box.y - layout.scrollMax);
    expect(layoutPageUi(model, W, H, 9999).scrollMax).toBe(layout.scrollMax);
  });

  it('answers a switch, a choice button, a slider and Back; a scrolled-off row does not answer', () => {
    const loot = layout.controls.find((control) => control.id === 'loot')!;
    expect(pageHitAt(layout, loot.box.x + loot.box.w - 3, loot.box.y + 3)).toEqual({ kind: 'control', id: 'loot', part: null, along: null });
    const size = layout.controls.find((control) => control.id === 'size')!;
    const big = size.parts[1];
    expect(pageHitAt(layout, big.x + 2, big.y + 2)).toEqual({ kind: 'control', id: 'size', part: 1, along: null });
    const shake = layout.controls.find((control) => control.id === 'shake')!.track!;
    const hit = pageHitAt(layout, shake.x + shake.w / 2, shake.y + 1);
    expect(hit).toMatchObject({ kind: 'control', id: 'shake', part: null });
    expect((hit as { along: number }).along).toBeGreaterThan(0.4);
    const back = layout.buttons[0];
    expect(pageHitAt(layout, back.x + 2, back.y + 2)).toEqual({ kind: 'button', id: 'back' });
    const privacy = layout.controls.find((control) => control.id === 'privacy')!;
    expect(layout.area.y + layout.area.h).toBeLessThan(privacy.box.y);
    expect(pageHitAt(layout, privacy.box.x + 4, privacy.box.y + 3)).toBeNull();
  });

  it('tabs through the controls then Back, and wraps', () => {
    const targets = pageFocusTargets(layout);
    expect(targets.map((target) => target.id)).toEqual(['control:loot', 'control:size', 'control:shake', 'control:privacy', 'button:back']);
    expect(stepPageFocus(targets, null, 1)).toBe('control:loot');
    expect(stepPageFocus(targets, null, -1)).toBe('button:back');
    expect(stepPageFocus(targets, 'button:back', 1)).toBe('control:loot');
    expect(stepPageFocus(targets, 'control:loot', -1)).toBe('button:back');
  });

  it('scrolls only as far as a hidden control needs', () => {
    const privacy = layout.controls.find((control) => control.id === 'privacy')!;
    const to = scrollToShow(layout, 0, privacy.box);
    expect(to).toBeGreaterThan(0);
    const after = layoutPageUi(model, W, H, to);
    const moved = after.controls.find((control) => control.id === 'privacy')!;
    expect(moved.box.y + moved.box.h).toBeLessThanOrEqual(after.area.y + after.area.h);
    expect(scrollToShow(after, to, moved.box)).toBe(to);
  });

  it('steps a slider by 5% and stops at the ends', () => {
    expect(stepSlider(0.5, 1)).toBe(0.55);
    expect(stepSlider(1, 1)).toBe(1);
    expect(stepSlider(0, -1)).toBe(0);
  });

  it('answers a binding row and focuses it like any control', () => {
    const binds: PageModel = {
      heading: 'Controls',
      panels: [{ heading: 'Movement', items: [{ kind: 'bind', id: 'sneak', label: 'Sneak', value: 'Space', listening: false }] }],
      buttons: [{ id: 'back', label: 'Back', enabled: true, primary: false }],
    };
    const placed = layoutPageUi(binds, W, H, 0);
    const row = placed.controls[0];
    expect(pageHitAt(placed, row.box.x + row.box.w - 4, row.box.y + 3)).toEqual({ kind: 'control', id: 'sneak', part: null, along: null });
    expect(pageFocusTargets(placed).map((target) => target.id)).toEqual(['control:sneak', 'button:back']);
  });
});
