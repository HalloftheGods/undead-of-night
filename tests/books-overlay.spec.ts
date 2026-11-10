import { describe, expect, it } from 'vitest';
import { BOOK_CARD_H, BOOK_CARD_W, buildBookCovers } from '../src/art/book-covers.ts';
import { BOOKS_CATALOG } from '../src/game/books-data.ts';
import { closeBook, closePage, openBook, openPage, TITLE_HOME } from '../src/game/title-nav.ts';

describe('books catalog', () => {
  it('defines the four canonical books in order', () => {
    expect(BOOKS_CATALOG.map((b) => b.id)).toEqual(['howto', 'candy', 'guide', 'records']);
    expect(BOOKS_CATALOG.map((b) => b.number)).toEqual(['01', '02', '03', '04']);
  });

  it('provides non-empty titles, subtitles, tags and descriptions', () => {
    for (const book of BOOKS_CATALOG) {
      expect(book.title.length).toBeGreaterThan(0);
      expect(book.subtitle.length).toBeGreaterThan(0);
      expect(book.tag.length).toBeGreaterThan(0);
      expect(book.description.length).toBeGreaterThan(0);
      expect(book.pagesCount.length).toBeGreaterThan(0);
    }
  });
});

describe('book cover art generation', () => {
  it('generates 56x72 pixel sprites for all four books', () => {
    const covers = buildBookCovers();
    expect(Object.keys(covers)).toEqual(['howto', 'candy', 'guide', 'records']);

    for (const [id, sprite] of Object.entries(covers)) {
      expect(sprite.w).toBe(BOOK_CARD_W);
      expect(sprite.h).toBe(BOOK_CARD_H);
      expect(sprite.rgba.length).toBe(BOOK_CARD_W * BOOK_CARD_H * 4);
      // Verify sprite has non-empty pixel data
      const hasOpaquePixels = sprite.rgba.some((byte, idx) => idx % 4 === 3 && byte > 0);
      expect(hasOpaquePixels).toBe(true);
    }
  });
});

describe('books library navigation', () => {
  it('sets fromBooks when opening a book from the library', () => {
    const atBooks = openPage(TITLE_HOME, 'books');
    expect(atBooks.page).toBe('books');
    expect(atBooks.fromBooks).toBe(false);

    const atCandy = openBook(atBooks, 'candy');
    expect(atCandy.page).toBe('candy');
    expect(atCandy.fromBooks).toBe(true);

    const closed = closeBook(atCandy);
    expect(closed.page).toBe('books');
    expect(closed.fromBooks).toBe(false);

    const atTitle = closePage(closed);
    expect(atTitle.page).toBeNull();
    expect(atTitle.fromBooks).toBe(false);
  });

  it('closes directly to title when a book was opened without fromBooks', () => {
    const direct = openPage(TITLE_HOME, 'candy');
    expect(direct.fromBooks).toBe(false);

    const closed = closeBook(direct);
    expect(closed.page).toBeNull();
  });
});
