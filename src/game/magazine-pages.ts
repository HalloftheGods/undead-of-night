import type { ArtBook } from '../art/types.ts';
import { buildLevelThumbnail } from '../art/level-thumbnails.ts';
import { TILE_SIZE } from '../../shared/protocol.ts';
import type { WorldMap } from '../../shared/protocol.ts';
import { generateWorldMap } from '../../shared/world-map.ts';
import { HOW_TO_SECTIONS } from './how-to-play.ts';
import type { HowToSection } from './how-to-play.ts';
import { chapterHint } from './magazine-hints.ts';
import type { BlockHint, ChapterHint, HintContext } from './magazine-hints.ts';
import { magazinePhotos } from './magazine-photos.ts';
import type { MagazinePhotos } from './magazine-photos.ts';
import type { ChapterLink, CoverLine, Magazine, MagazineBlock, MagazinePage, MagazineSpread, PageSide } from './magazine-types.ts';

const POSTCARD_SEED = 1986;

/** Builds the issue from the How to Play sections and works out where a reader can turn to. */

export const MAGAZINE_TITLE = 'Out of Town';
export const MAGAZINE_STRAP = 'The Town Survival Bureau\'s official survival manual and travel guide';
export const MAGAZINE_ISSUE = 'Vol. 10: Last Round Edition';
export const MAGAZINE_PRICE = 'Free to anyone still breathing';

const LEVEL_COUNT = 10;
/** The cover and the contents spread come before chapter one. */
const FRONT_PAGES = 3;
/** Where the contents page sits in the page list. */
export const CONTENTS_PAGE = 1;
const FIRST_CHAPTER_FOLIO = 4;

/** Two pages a side on a spread, one at a time on a tall screen. */
export type ReadingMode = 'spread' | 'single';

function chapterPageIndex(chapterIndex: number): number {
  return FRONT_PAGES + chapterIndex * 2;
}

/** Turns a hint's blocks into printed ones, spending the section's points as it goes. */
function resolveBlocks(hints: readonly BlockHint[], section: HowToSection, hint: ChapterHint, number: number, used: Set<number>): MagazineBlock[] {
  const claim = (index: number): string | undefined => {
    const point = section.points[index];
    const unclaimed = point !== undefined && !used.has(index);
    if (!unclaimed) return undefined;
    used.add(index);
    return point;
  };
  const claimAll = (indexes: readonly number[]) => indexes.map(claim).filter((point) => point !== undefined);
  const everyPoint = section.points.map((_, index) => index);
  return hints.map((block): MagazineBlock => {
    switch (block.kind) {
      case 'head':
        return { kind: 'head', number, kicker: hint.kicker, title: section.title, deck: hint.deck };
      case 'article':
        return { ...block, points: claimAll(block.points ?? everyPoint) };
      case 'gallery': {
        const { cardPoints, ...rest } = block;
        const pointFor = (index: number) => (cardPoints ? claim(cardPoints[index]) : undefined);
        return { ...rest, cards: block.cards.map((card, index) => ({ ...card, point: pointFor(index) })) };
      }
      default:
        return block;
    }
  });
}

/** Any point the hint did not place, such as one added to the section later, goes on the end of the first article. */
function withLeftovers(blocks: MagazineBlock[][], section: HowToSection, used: ReadonlySet<number>): MagazineBlock[][] {
  const leftovers = section.points.filter((_, index) => !used.has(index));
  const nothingLeft = leftovers.length === 0;
  if (nothingLeft) return blocks;
  const addedTo = (block: MagazineBlock): block is Extract<MagazineBlock, { kind: 'article' }> => block.kind === 'article';
  const home = blocks.find((page) => page.some(addedTo));
  if (home) {
    const at = home.findIndex(addedTo);
    const found = home[at];
    home[at] = addedTo(found) ? { ...found, points: [...found.points, ...leftovers] } : found;
    return blocks;
  }
  blocks[blocks.length - 1].push({ kind: 'article', style: 'bullets', points: leftovers });
  return blocks;
}

function chapterSpread(section: HowToSection, chapterIndex: number, context: HintContext, photos: MagazinePhotos): readonly MagazinePage[] {
  const hint = chapterHint(section.id, chapterIndex, context);
  const number = chapterIndex + 1;
  const used = new Set<number>();
  const left = resolveBlocks(hint.left, section, hint, number, used);
  const right = resolveBlocks(hint.right, section, hint, number, used);
  const [leftBlocks, rightBlocks] = withLeftovers([left, right], section, used);
  const folio = FIRST_CHAPTER_FOLIO + chapterIndex * 2;
  const shared = {
    color: hint.color,
    layout: hint.layout,
    runningHead: section.tab,
    backdrop: hint.backdrop ? photos[hint.backdrop] : undefined,
  };
  return [
    { ...shared, id: `${section.id}-left`, folio, side: 'left', blocks: leftBlocks },
    { ...shared, id: `${section.id}-right`, folio: folio + 1, side: 'right', blocks: rightBlocks },
  ];
}

function chapterLinks(sections: readonly HowToSection[], context: HintContext): readonly ChapterLink[] {
  return sections.map((section, index) => {
    const { kicker, color } = chapterHint(section.id, index, context);
    return {
      id: section.id,
      number: index + 1,
      title: section.title,
      kicker,
      color,
      page: FIRST_CHAPTER_FOLIO + index * 2,
      pageIndex: chapterPageIndex(index),
    };
  });
}

function coverLines(sections: readonly HowToSection[], chapters: readonly ChapterLink[], context: HintContext): readonly CoverLine[] {
  const lines: CoverLine[] = [];
  sections.forEach((section, index) => {
    const { coverline } = chapterHint(section.id, index, context);
    const teased = coverline !== undefined;
    if (teased) lines.push({ ...chapters[index], line: coverline });
  });
  return lines;
}

function page(id: string, folio: number | null, side: PageSide, layout: MagazinePage['layout'], blocks: readonly MagazineBlock[]): MagazinePage {
  return { id, folio, side, layout, color: 'tomato', runningHead: 'Contents', blocks };
}

function frontMatter(
  chapters: readonly ChapterLink[],
  lines: readonly CoverLine[],
  art: ArtBook,
  photos: MagazinePhotos,
  map: WorldMap,
): readonly MagazineSpread[] {
  const parkX = Math.round(map.spawn.x / TILE_SIZE);
  const parkY = Math.round(map.spawn.y / TILE_SIZE);
  const parkR = 15;
  const cover = page('cover', null, 'wide', 'cover', [{ kind: 'cover', art: photos.cover, logo: art.ui.logo, lines }]);
  const contents = page('contents', 2, 'left', 'contents', [{ kind: 'contents', chapters }]);
  const letter = page('letter', 3, 'right', 'letter', [
    {
      kind: 'letter',
      title: 'A word from the Bureau',
      paragraphs: [
        'Dear visitor. Thank you for choosing this town. We regret that most of its attractions are now coming towards you.',
        'This manual covers everything you need to leave. The rules in it are all true. The rest is for morale.',
      ],
      signed: 'The Town Survival Bureau, Department of Leaving',
    },
    {
      kind: 'photo',
      sprite: photos.town,
      caption: 'The town from above, before the visitors arrived.',
      tilt: 1.6,
      marks: [
        { kind: 'circle', x: parkX, y: parkY, r: parkR },
        { kind: 'note', x: Math.max(10, parkX - 30), y: Math.max(12, parkY - 22), text: 'you are here' },
      ],
      size: 'normal',
      extra: true,
    },
    { kind: 'tip', text: 'Prev and Next turn the page, and so do the arrow keys. On a touch screen, swipe.' },
  ]);
  return [
    { pages: [cover], firstPage: 0 },
    { pages: [contents, letter], firstPage: 1 },
  ];
}

/** The whole issue. `reached` says which levels may show their picture; the rest print as locked. */
export function buildMagazine(
  art: ArtBook,
  reached: (level: number) => boolean,
  sections: readonly HowToSection[] = HOW_TO_SECTIONS,
  currentMap?: WorldMap,
): Magazine {
  const targetMap = currentMap ?? generateWorldMap(POSTCARD_SEED);
  const photos = magazinePhotos(art, currentMap);
  const itinerary = Array.from({ length: LEVEL_COUNT }, (_, index) => {
    const level = index + 1;
    // A reached level prints the same scene as the Levels page; the rest stay padlocked.
    const sprite = reached(level) ? art.ui.levelScenes[index] : buildLevelThumbnail(level, false);
    return { level, sprite };
  });
  const context: HintContext = { art, photos, itinerary };
  const chapters = chapterLinks(sections, context);
  const front = frontMatter(chapters, coverLines(sections, chapters, context), art, photos, targetMap);
  const bodySpreads = sections.map((section, index) => ({
    pages: chapterSpread(section, index, context, photos),
    firstPage: chapterPageIndex(index),
  }));
  const spreads = [...front, ...bodySpreads];
  return { spreads, pages: spreads.flatMap((spread) => spread.pages), chapters };
}

const LEAD_MAX = 16;

/** Splits a controls line at its key, "R: reload." into "R" and ": reload.", to print the key as a keycap. */
export function splitLead(point: string): { readonly lead: string; readonly rest: string } {
  const at = point.indexOf(':');
  const keyed = at > 0 && at <= LEAD_MAX;
  return keyed ? { lead: point.slice(0, at), rest: point.slice(at) } : { lead: '', rest: point };
}

/** The spread a page sits on. */
export function spreadIndexOf(magazine: Magazine, pageIndex: number): number {
  const { spreads } = magazine;
  const after = spreads.findIndex((spread) => spread.firstPage > pageIndex);
  return after === -1 ? spreads.length - 1 : after - 1;
}

/** Where a turn lands: a page or a whole spread along, and no further than the covers. */
export function steppedPage(magazine: Magazine, pageIndex: number, by: number, mode: ReadingMode): number {
  const onePage = mode === 'single';
  const lastPage = magazine.pages.length - 1;
  const lastSpread = magazine.spreads.length - 1;
  const spreadTarget = Math.max(0, Math.min(lastSpread, spreadIndexOf(magazine, pageIndex) + by));
  return onePage ? Math.max(0, Math.min(lastPage, pageIndex + by)) : magazine.spreads[spreadTarget].firstPage;
}

/** What sits open in front of the reader. A wide page or a single page takes the whole book. */
export interface OpenBook {
  readonly left: MagazinePage | null;
  readonly right: MagazinePage | null;
  readonly solo: MagazinePage | null;
}

export function openBook(magazine: Magazine, pageIndex: number, mode: ReadingMode): OpenBook {
  const spread = magazine.spreads[spreadIndexOf(magazine, pageIndex)];
  const [first, second] = spread.pages;
  const onePage = mode === 'single';
  const solo = onePage ? magazine.pages[pageIndex] : first;
  const pair = !onePage && second !== undefined;
  return pair ? { left: first, right: second, solo: null } : { left: null, right: null, solo };
}

/**
 * One visible page turn. `under` is what shows beneath the moving leaf. A leaf on the left or right swings across the
 * gutter with a page on each face. A whole-book leaf swings away or back on the left edge, with one face.
 */
export interface PageTurn {
  readonly direction: 'forward' | 'back';
  readonly leaf: 'left' | 'right' | 'whole';
  readonly under: OpenBook;
  readonly front: MagazinePage;
  readonly back: MagazinePage | null;
}

export function planTurn(from: OpenBook, to: OpenBook, forward: boolean): PageTurn | null {
  const direction = forward ? 'forward' : 'back';
  const { left: fromLeft, right: fromRight } = from;
  const { left: toLeft, right: toRight } = to;
  const acrossGutter = fromLeft && fromRight && toLeft && toRight;
  if (acrossGutter) {
    return forward
      ? { direction, leaf: 'right', under: { left: fromLeft, right: toRight, solo: null }, front: fromRight, back: toLeft }
      : { direction, leaf: 'left', under: { left: toLeft, right: fromRight, solo: null }, front: fromLeft, back: toRight };
  }
  const swinging = forward ? from : to;
  const face = swinging.solo ?? swinging.right ?? swinging.left;
  const under = forward ? to : from;
  return face ? { direction, leaf: 'whole', under, front: face, back: null } : null;
}

/** "Pages 4-5 of 29", for the reader and for a screen reader. */
export function pageLabel(book: OpenBook, magazine: Magazine): string {
  const last = magazine.pages[magazine.pages.length - 1].folio;
  const folios = [book.solo, book.left, book.right].flatMap((each) => (each?.folio ? [each.folio] : []));
  const noun = folios.length > 1 ? 'Pages' : 'Page';
  return folios.length === 0 ? 'Cover' : `${noun} ${folios.join('-')} of ${last}`;
}
