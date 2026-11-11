import { describe, expect, it } from 'vitest';
import { buildArtBook } from '../src/art/index.ts';
import { HOW_TO_SECTIONS } from '../src/game/how-to-play.ts';
import { crosshairCards, getSectionVisuals } from '../src/game/how-to-play-visuals.ts';

describe('how-to-play visuals', () => {
  it('gives every section real sprites from the art book', () => {
    const art = buildArtBook();
    for (const section of HOW_TO_SECTIONS) {
      const cards = getSectionVisuals(section.id, art);
      expect(cards.length).toBeGreaterThan(0);
      for (const card of cards) {
        expect(card.id).toBeTruthy();
        expect(card.title).toBeTruthy();
        expect(card.sprite.rgba.length).toBe(card.sprite.w * card.sprite.h * 4);
      }
    }
  });

  it('has How to Play pages for the bag and for doors, with their own pictures', () => {
    const art = buildArtBook();
    for (const id of ['bag', 'doors']) {
      expect(HOW_TO_SECTIONS.some((section) => section.id === id)).toBe(true);
    }
    expect(getSectionVisuals('doors', art).map((card) => card.id)).toEqual(['plank', 'nails', 'hammer', 'crowbar', 'curtain']);
    expect(getSectionVisuals('bag', art).length).toBeGreaterThan(0);
  });

  it('has no pictures for a section it has not met', () => {
    expect(getSectionVisuals('not-a-section', buildArtBook())).toEqual([]);
  });

  it('shows the plain crosshair and the one over a head', () => {
    const art = buildArtBook();
    expect(crosshairCards(art).map((card) => card.sprite)).toEqual([art.ui.crosshair, art.ui.crosshairHead]);
  });
});
