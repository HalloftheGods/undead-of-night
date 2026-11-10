import { describe, expect, it } from 'vitest';
import {
  CANDY_ENTRIES,
  candyMagazineLeaves,
  candySpreadIndex,
} from '../src/game/candy-magazine-data.ts';
import { TITLE_MENU } from '../src/game/title-menu.ts';
import { CANDY_ORDER } from '../shared/candy.ts';

describe('Candy Magazine Data and Structure', () => {
  it('defines detailed magazine data for all twenty-nine candies', () => {
    expect(CANDY_ORDER).toHaveLength(29);
    for (const id of CANDY_ORDER) {
      const entry = CANDY_ENTRIES[id];
      expect(entry).toBeDefined();
      expect(entry.id).toBe(id);
      expect(entry.name.length).toBeGreaterThan(0);
      expect(entry.stat.length).toBeGreaterThan(0);
      expect(entry.burst.length).toBeGreaterThan(0);
      expect(entry.caption.length).toBeGreaterThan(0);
      expect(entry.boostDescription.length).toBeGreaterThan(0);
      expect(entry.tacticalAdvice.length).toBeGreaterThan(0);
      expect(entry.foundIn.length).toBeGreaterThan(0);
      expect(entry.durationSec).toBeGreaterThan(0);

      // Nutrition facts
      expect(entry.nutrition).toBeDefined();
      expect(entry.nutrition.servingSize.length).toBeGreaterThan(0);
      expect(entry.nutrition.calories).toBeGreaterThan(0);
      expect(entry.nutrition.facts.length).toBeGreaterThan(0);
      expect(entry.nutrition.ingredients.length).toBeGreaterThan(0);

      // Review and stamp
      expect(entry.review.stars).toBeGreaterThanOrEqual(4);
      expect(entry.review.quote.length).toBeGreaterThan(0);
      expect(entry.review.author.length).toBeGreaterThan(0);
      expect(entry.stamp.text.length).toBeGreaterThan(0);
    }
  });

  it('generates sixty ordered leaves for the printed book', () => {
    const leaves = candyMagazineLeaves();
    // 1 cover + 1 contents + (29 candies * 2 leaves: 1 art + 1 detail) = 60 leaves
    expect(leaves).toHaveLength(60);

    expect(leaves[0].kind).toBe('cover');
    expect(leaves[1].kind).toBe('contents');

    // Each candy follows in pair: art leaf, then detail leaf
    for (let index = 0; index < CANDY_ORDER.length; index += 1) {
      const candyId = CANDY_ORDER[index];
      const artLeaf = leaves[2 + index * 2];
      const detailLeaf = leaves[3 + index * 2];

      expect(artLeaf.kind).toBe('art');
      expect(detailLeaf.kind).toBe('detail');

      if (artLeaf.kind === 'art' && detailLeaf.kind === 'detail') {
        expect(artLeaf.candy.id).toBe(candyId);
        expect(detailLeaf.candy.id).toBe(candyId);
      }
    }
  });

  it('calculates the target spread index accurately for each candy', () => {
    expect(candySpreadIndex('sour_skulls')).toBe(2);
    expect(candySpreadIndex('fang_taffy')).toBe(4);
    expect(candySpreadIndex('full_size_bar')).toBe(26);
  });

  it('includes Candy Magazine in the Books section of TITLE_MENU', () => {
    const booksItems = TITLE_MENU.filter((item) => item.group === 'books');
    const candyItem = booksItems.find((item) => item.page === 'candy');

    expect(candyItem).toBeDefined();
    expect(candyItem?.label).toBe('Candy Magazine');
    expect(candyItem?.line).toBe('Nutrition, brands and special effects.');
  });
});

describe('useCandyMagazinePages Controller', () => {
  it('opens on single-page centered retro cover and flips through contents into spreads', async () => {
    const { useCandyMagazinePages } = await import(
      '../src/components/candy-magazine/use-candy-magazine-pages.ts'
    );
    const leaves = candyMagazineLeaves();
    let turned = 0;
    let closed = 0;
    const pages = useCandyMagazinePages(
      leaves,
      () => {
        turned += 1;
      },
      () => {
        closed += 1;
      },
    );

    // Initial state: closed cover
    expect(pages.view.at.value).toBe(0);
    expect(pages.view.isCover.value).toBe(true);
    expect(pages.view.isSolo.value).toBe(true);
    expect(pages.view.open.value.solo?.id).toBe('candy-cover');
    expect(pages.view.open.value.left).toBeNull();
    expect(pages.view.open.value.right).toBeNull();
    expect(pages.view.label.value).toBe('Cover');
    expect(pages.view.atStart.value).toBe(true);
    expect(pages.view.atEnd.value).toBe(false);

    // Flip forward to Contents
    pages.flipPages(1);
    expect(pages.view.at.value).toBe(1);
    expect(pages.view.isCover.value).toBe(false);
    expect(pages.view.isSolo.value).toBe(true);
    expect(pages.view.open.value.solo?.id).toBe('candy-contents');
    expect(pages.view.label.value).toBe('Contents');
    expect(pages.view.atStart.value).toBe(false);

    // Flip forward into first candy spread
    pages.flipPages(1);
    expect(pages.view.at.value).toBe(2);
    expect(pages.view.isCover.value).toBe(false);
    expect(pages.view.isSolo.value).toBe(false);
    expect(pages.view.open.value.left?.id).toBe('candy-art-sour_skulls');
    expect(pages.view.open.value.right?.id).toBe('candy-detail-sour_skulls');
    expect(pages.view.label.value).toBe('Pages 3-4 of 60');

    // Flip backward back to Contents
    pages.flipPages(-1);
    expect(pages.view.at.value).toBe(1);
    expect(pages.view.label.value).toBe('Contents');

    // Flip backward back to Cover
    pages.flipPages(-1);
    expect(pages.view.at.value).toBe(0);
    expect(pages.view.label.value).toBe('Cover');

    // Jump directly to Jawbreaker spread via goTo
    const jawbreakerIndex = candySpreadIndex('jawbreaker');
    pages.goTo(jawbreakerIndex);
    expect(pages.view.at.value).toBe(jawbreakerIndex);
    expect(pages.view.open.value.left?.id).toBe('candy-art-jawbreaker');
    expect(pages.view.open.value.right?.id).toBe('candy-detail-jawbreaker');
    expect(pages.view.label.value).toBe(`Pages ${jawbreakerIndex + 1}-${jawbreakerIndex + 2} of 60`);
  });
});
