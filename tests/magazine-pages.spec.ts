import { describe, expect, it } from 'vitest';
import { buildArtBook } from '../src/art/index.ts';
import { HOW_TO_SECTIONS } from '../src/game/how-to-play.ts';
import type { HowToSection } from '../src/game/how-to-play.ts';
import { swipeStep, turnKeyStep } from '../src/game/magazine-controller.ts';
import { chooseFit, FIT_STEPS, fitSinglePage, fitSpread } from '../src/game/magazine-fit.ts';
import { buildMagazine, CONTENTS_PAGE, openBook, pageLabel, planTurn, spreadIndexOf, splitLead, steppedPage } from '../src/game/magazine-pages.ts';
import type { Magazine, MagazineBlock, MagazinePage } from '../src/game/magazine-types.ts';

const art = buildArtBook();
const everywhere = () => true;
const magazine = buildMagazine(art, everywhere);
const FRONT_SPREADS = 2;

function pointsOn(page: MagazinePage): string[] {
  const printed = (block: MagazineBlock): readonly string[] => {
    const article = block.kind === 'article' ? block.points : [];
    const cards = block.kind === 'gallery' ? block.cards.flatMap((card) => (card.point ? [card.point] : [])) : [];
    return [...article, ...cards];
  };
  return page.blocks.flatMap(printed);
}

const pagesOf = (issue: Magazine, sectionId: string) => issue.pages.filter((page) => page.id.startsWith(`${sectionId}-`));
const pointsOf = (issue: Magazine, sectionId: string) => pagesOf(issue, sectionId).flatMap(pointsOn);

describe('magazine pages', () => {
  it('opens on a cover and a contents spread, then a spread per section', () => {
    expect(magazine.spreads[0].pages.map((page) => page.layout)).toEqual(['cover']);
    expect(magazine.spreads[1].pages.map((page) => page.layout)).toEqual(['contents', 'letter']);
    expect(magazine.spreads).toHaveLength(FRONT_SPREADS + HOW_TO_SECTIONS.length);
    expect(magazine.pages[CONTENTS_PAGE].layout).toBe('contents');
  });

  it('prints every point of every section exactly once, word for word', () => {
    for (const section of HOW_TO_SECTIONS) {
      expect(pointsOf(magazine, section.id).sort()).toEqual([...section.points].sort());
    }
  });

  it('puts a headline on every chapter', () => {
    for (const section of HOW_TO_SECTIONS) {
      const heads = pagesOf(magazine, section.id).flatMap((page) => page.blocks.filter((block) => block.kind === 'head'));
      expect(heads).toHaveLength(1);
    }
  });

  it('does not lay two chapters in a row out the same way', () => {
    const layouts = magazine.spreads.slice(FRONT_SPREADS).map((spread) => spread.pages[0].layout);
    layouts.slice(1).forEach((layout, index) => expect(layout).not.toBe(layouts[index]));
    // Twenty-one chapters share thirteen layouts, so one can return, but never next door, and every layout is still printed.
    expect(new Set(layouts).size).toBe(13);
  });

  it('numbers pages in order with the left page even', () => {
    const numbered = magazine.pages.flatMap((page) => (page.folio ? [page] : []));
    numbered.forEach((page, index) => {
      expect(page.folio).toBe(index + 2);
      expect(page.side).toBe(page.folio! % 2 === 0 ? 'left' : 'right');
    });
  });

  it('links each chapter to the page it opens on', () => {
    magazine.chapters.forEach((chapter) => {
      const page = magazine.pages[chapter.pageIndex];
      expect(page.id).toBe(`${chapter.id}-left`);
      expect(page.folio).toBe(chapter.page);
    });
  });

  it('prints unreached levels locked on the itinerary', () => {
    const early = buildMagazine(art, (level) => level === 1);
    const itinerary = early.pages.flatMap((page) => page.blocks).find((block) => block.kind === 'itinerary');
    const reached = magazine.pages.flatMap((page) => page.blocks).find((block) => block.kind === 'itinerary');
    const stops = itinerary?.kind === 'itinerary' ? itinerary.stops : [];
    const open = reached?.kind === 'itinerary' ? reached.stops : [];
    expect(stops).toHaveLength(10);
    expect(stops[0].sprite).toBe(open[0].sprite);
    expect(stops[1].sprite).not.toBe(open[1].sprite);
  });
});

describe('sections the magazine has not met', () => {
  const extra: HowToSection = { id: 'weather', tab: 'Weather', title: 'The weather', points: ['One new rule.', 'Another new rule.'] };
  const issue = buildMagazine(art, everywhere, [...HOW_TO_SECTIONS, extra]);

  it('gets its own spread and a contents link with no hint written', () => {
    expect(issue.spreads).toHaveLength(magazine.spreads.length + 1);
    expect(issue.chapters.at(-1)?.title).toBe('The weather');
    expect(pointsOf(issue, 'weather')).toEqual(extra.points);
    expect(pagesOf(issue, 'weather').map((page) => page.layout)).toEqual(['column', 'column']);
  });

  it('prints a point added to a known section after its hint was written', () => {
    const survivors = HOW_TO_SECTIONS.find((section) => section.id === 'survivors')!;
    const grown = { ...survivors, points: [...survivors.points, 'Someone new: does something.'] };
    const sections = HOW_TO_SECTIONS.map((section) => (section.id === 'survivors' ? grown : section));
    expect(pointsOf(buildMagazine(art, everywhere, sections), 'survivors').sort()).toEqual([...grown.points].sort());
  });
});

describe('turning pages', () => {
  const lastPage = magazine.pages.length - 1;

  it('finds the spread a page sits on', () => {
    expect(spreadIndexOf(magazine, 0)).toBe(0);
    expect(spreadIndexOf(magazine, 1)).toBe(1);
    expect(spreadIndexOf(magazine, 2)).toBe(1);
    expect(spreadIndexOf(magazine, 3)).toBe(2);
    expect(spreadIndexOf(magazine, lastPage)).toBe(magazine.spreads.length - 1);
  });

  it('moves a spread at a time on a wide screen and stops at the ends', () => {
    expect(steppedPage(magazine, 0, 1, 'spread')).toBe(1);
    expect(steppedPage(magazine, 2, 1, 'spread')).toBe(3);
    expect(steppedPage(magazine, 3, -1, 'spread')).toBe(1);
    expect(steppedPage(magazine, 0, -1, 'spread')).toBe(0);
    expect(steppedPage(magazine, lastPage, 1, 'spread')).toBe(magazine.spreads.at(-1)?.firstPage);
  });

  it('moves a page at a time on a tall screen and stops at the ends', () => {
    expect(steppedPage(magazine, 3, 1, 'single')).toBe(4);
    expect(steppedPage(magazine, 0, -1, 'single')).toBe(0);
    expect(steppedPage(magazine, lastPage, 1, 'single')).toBe(lastPage);
  });

  it('opens two pages on a spread and one on the cover or a tall screen', () => {
    const spread = openBook(magazine, 4, 'spread');
    expect(spread.left?.folio).toBe(4);
    expect(spread.right?.folio).toBe(5);
    expect(openBook(magazine, 0, 'spread').solo?.id).toBe('cover');
    expect(openBook(magazine, 4, 'single').solo?.folio).toBe(5);
  });

  it('turns the right page forward, with the next left page on its back', () => {
    const from = openBook(magazine, 3, 'spread');
    const to = openBook(magazine, 5, 'spread');
    const turn = planTurn(from, to, true);
    expect(turn?.leaf).toBe('right');
    expect(turn?.front).toBe(from.right);
    expect(turn?.back).toBe(to.left);
    expect(turn?.under.left).toBe(from.left);
    expect(turn?.under.right).toBe(to.right);
  });

  it('turns the left page back, with the earlier right page on its back', () => {
    const from = openBook(magazine, 5, 'spread');
    const to = openBook(magazine, 3, 'spread');
    const turn = planTurn(from, to, false);
    expect(turn?.leaf).toBe('left');
    expect(turn?.front).toBe(from.left);
    expect(turn?.back).toBe(to.right);
  });

  it('swings a whole page off the cover and on a tall screen', () => {
    const cover = openBook(magazine, 0, 'spread');
    const contents = openBook(magazine, 1, 'spread');
    expect(planTurn(cover, contents, true)?.leaf).toBe('whole');
    expect(planTurn(cover, contents, true)?.front.id).toBe('cover');
    expect(planTurn(contents, cover, false)?.front.id).toBe('cover');
    const one = openBook(magazine, 4, 'single');
    const two = openBook(magazine, 5, 'single');
    expect(planTurn(one, two, true)?.under.solo).toBe(two.solo);
    expect(planTurn(two, one, false)?.under.solo).toBe(two.solo);
  });

  it('says where the reader is', () => {
    const last = magazine.pages[lastPage].folio;
    expect(pageLabel(openBook(magazine, 0, 'spread'), magazine)).toBe('Cover');
    expect(pageLabel(openBook(magazine, 3, 'spread'), magazine)).toBe(`Pages 4-5 of ${last}`);
    expect(pageLabel(openBook(magazine, 3, 'single'), magazine)).toBe(`Page 4 of ${last}`);
  });

  it('takes the arrow and page keys, and leaves the rest alone', () => {
    expect(turnKeyStep('ArrowRight')).toBe(1);
    expect(turnKeyStep('PageDown')).toBe(1);
    expect(turnKeyStep('ArrowLeft')).toBe(-1);
    expect(turnKeyStep('PageUp')).toBe(-1);
    expect(turnKeyStep('KeyW')).toBe(0);
  });

  it('turns on a sideways swipe only', () => {
    expect(swipeStep(-80, 4)).toBe(1);
    expect(swipeStep(80, 4)).toBe(-1);
    expect(swipeStep(-10, 0)).toBe(0);
    expect(swipeStep(-60, 90)).toBe(0);
  });
});

describe('page fit', () => {
  it('takes the first size that fits', () => {
    expect(chooseFit((step) => step.scale <= 0.9)).toEqual({ scale: 0.9, tight: false });
    expect(chooseFit(() => true)).toEqual({ scale: 1, tight: false });
  });

  it('keeps shrinking until the last step when nothing fits', () => {
    expect(chooseFit(() => false)).toBe(FIT_STEPS.at(-1));
  });

  it('synchronizes spread fit across facing pages so both pages share the same scale', () => {
    const leftStyles = new Map<string, string>();
    const rightStyles = new Map<string, string>();

    const leftPage = {
      querySelectorAll: () => [],
      style: {
        setProperty: (prop: string, val: string) => leftStyles.set(prop, val),
        getPropertyValue: (prop: string) => leftStyles.get(prop) ?? '',
      },
      classList: { toggle: () => {} },
    } as unknown as HTMLElement;

    const rightPage = {
      querySelectorAll: () => [],
      style: {
        setProperty: (prop: string, val: string) => rightStyles.set(prop, val),
        getPropertyValue: (prop: string) => rightStyles.get(prop) ?? '',
      },
      classList: { toggle: () => {} },
    } as unknown as HTMLElement;

    const container = {
      querySelectorAll: () => [leftPage, rightPage],
    } as unknown as HTMLElement;

    fitSpread(container);
    expect(leftPage.style.getPropertyValue('--fit')).toBe('1');
    expect(rightPage.style.getPropertyValue('--fit')).toBe('1');
  });
});

describe('controls lines', () => {
  it('splits a key from what it does, keeping the words', () => {
    expect(splitLead('R: reload.')).toEqual({ lead: 'R', rest: ': reload.' });
    expect(splitLead('Tab or N: town map.')).toEqual({ lead: 'Tab or N', rest: ': town map.' });
  });

  it('leaves a line with no key alone', () => {
    expect(splitLead('The buttons along the edge do the rest.')).toEqual({ lead: '', rest: 'The buttons along the edge do the rest.' });
  });
});
