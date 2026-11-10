import type { ArtBook } from '../art/types.ts';
import { crosshairCards, getSectionVisuals } from './how-to-play-visuals.ts';
import type { MagazinePhotos } from './magazine-photos.ts';
import type {
  ArticleStyle,
  ChapterLayout,
  GalleryCard,
  GalleryStyle,
  ItineraryStop,
  MagazineBlock,
  MagazineColor,
  PhotoMark,
  PhotoSize,
} from './magazine-types.ts';

/**
 * How each How to Play section is laid out, and the magazine's dry asides. The rules themselves stay in
 * how-to-play.ts: a hint only says which point goes where, and a point it forgets is printed anyway.
 */

/** An article names the section's points by position. The real words come in when the page is built. */
export interface ArticleHint {
  readonly kind: 'article';
  readonly heading?: string;
  readonly style: ArticleStyle;
  /** Omit for all of them. */
  readonly points?: readonly number[];
}

/** Marks where the chapter's headline goes. */
export interface HeadHint {
  readonly kind: 'head';
}

/** A gallery whose cards may each carry one of the section's points. */
export interface GalleryHint {
  readonly kind: 'gallery';
  readonly style: GalleryStyle;
  readonly title?: string;
  readonly cards: readonly GalleryCard[];
  readonly cardPoints?: readonly number[];
}

export type BlockHint = ArticleHint | HeadHint | GalleryHint | Exclude<MagazineBlock, { kind: 'head' | 'article' | 'gallery' }>;

export interface ChapterHint {
  readonly layout: ChapterLayout;
  readonly color: MagazineColor;
  readonly kicker: string;
  readonly deck: string;
  /** Teases the chapter on the cover. */
  readonly coverline?: string;
  /** A picture run across the whole spread. */
  readonly backdrop?: 'vanPanorama';
  readonly left: readonly BlockHint[];
  readonly right: readonly BlockHint[];
}

export interface HintContext {
  readonly art: ArtBook;
  readonly photos: MagazinePhotos;
  readonly itinerary: readonly ItineraryStop[];
}

const head: HeadHint = { kind: 'head' };
const article = (style: ArticleStyle, points?: readonly number[], heading?: string): ArticleHint => ({ kind: 'article', style, points, heading });
const tip = (text: string): BlockHint => ({ kind: 'tip', text });
const sticky = (text: string, tilt: number): BlockHint => ({ kind: 'sticky', text, tilt, extra: true });
const stamp = (text: string, tilt: number): BlockHint => ({ kind: 'stamp', text, tilt, extra: true });
const gallery = (style: GalleryStyle, cards: readonly GalleryCard[], title?: string, cardPoints?: readonly number[]): GalleryHint => ({
  kind: 'gallery',
  style,
  cards,
  title,
  cardPoints,
});

type PhotoBlock = Extract<MagazineBlock, { kind: 'photo' }>;

function photo(
  sprite: MagazinePhotos[keyof MagazinePhotos],
  caption: string,
  tilt: number,
  size: PhotoSize = 'normal',
  marks: readonly PhotoMark[] = [],
): PhotoBlock {
  return { kind: 'photo', sprite, caption, tilt, size, marks };
}

/** A photo the page can do without when it runs out of room. */
const aside = (block: PhotoBlock): PhotoBlock => ({ ...block, extra: true });

type HintMaker = (context: HintContext) => ChapterHint;

const goal: HintMaker = ({ photos, itinerary }) => ({
  layout: 'feature',
  color: 'tomato',
  kicker: 'Getting started',
  deck: 'A short holiday in ten towns, ending in a van.',
  coverline: 'Ten towns, one van: your itinerary',
  left: [
    sticky('Do not unpack.', 4),
    photo(photos.vanRoad, 'Fig. 1: The escape van, seen from the correct direction.', -2.5, 'hero', [
      { kind: 'arrow', x1: 70, y1: 34, x2: 96, y2: 56 },
      { kind: 'note', x: 34, y: 18, text: 'this is the one you want' },
      { kind: 'circle', x: 62, y: 92, r: 15 },
    ]),
  ],
  right: [
    head,
    article('numbered'),
    { kind: 'itinerary', title: 'Your itinerary', stops: itinerary },
    tip('Everything else in this manual is a way of reaching the van.'),
  ],
});

const controls: HintMaker = ({ photos }) => ({
  layout: 'keys',
  color: 'sky',
  kicker: 'Getting around',
  deck: 'Local customs for your hands.',
  left: [
    head,
    { kind: 'keyboard', caption: 'Fig. 2: The keyboard, as found in the wild.' },
    article('keys', [0, 1, 2, 3, 4, 5, 6], 'At a desk'),
  ],
  right: [
    article('plain', [7, 8, 9], 'On a phone or tablet'),
    sticky('Left thumb walks. Everything else shoots.', -3),
    aside(
      photo(photos.aiming, 'Fig. 3: Polite conversation with a local.', 1.5, 'normal', [
        { kind: 'arrow', x1: 96, y1: 26, x2: 118, y2: 46 },
        { kind: 'note', x: 52, y: 12, text: 'red means head' },
      ]),
    ),
    {
      kind: 'sidebar',
      title: 'Useful phrases',
      extra: true,
      lines: [
        ['Hold E', 'Excuse me while I go through your things.'],
        ['F', 'Please step back.'],
        ['H', 'I would like to see a doctor.'],
        ['Tab', 'Could you show me on the map?'],
        ['M', 'Quiet, please.'],
        ['Esc', 'May we stop for a moment?'],
      ],
    },
  ],
});

const noise: HintMaker = ({ art, photos }) => ({
  layout: 'rings',
  color: 'violet',
  kicker: 'Local etiquette',
  deck: 'The town is a lot quieter than you are.',
  coverline: 'Why your neighbours keep coming over',
  left: [
    head,
    article('bullets'),
    aside(
      photo(photos.quiet, 'Fig. 4: Letting them wander past. Note the excellent posture.', -1.4, 'normal', [
        { kind: 'arrow', x1: 124, y1: 86, x2: 92, y2: 80 },
        { kind: 'note', x: 112, y: 86, text: 'not moving' },
      ]),
    ),
    tip('If the street is empty, leave it that way.'),
  ],
  right: [
    photo(photos.gunshot, 'Fig. 5: A survivor introduces themselves to the neighbourhood.', 1.8, 'hero', [
      { kind: 'circle', x: 88, y: 84, r: 22 },
      { kind: 'circle', x: 88, y: 84, r: 44 },
      { kind: 'arrow', x1: 30, y1: 82, x2: 58, y2: 84 },
      { kind: 'arrow', x1: 146, y1: 108, x2: 116, y2: 96 },
      { kind: 'note', x: 112, y: 26, text: 'everyone heard that' },
    ]),
    gallery('meter', getSectionVisuals('noise', art), 'The Bureau loudness chart'),
  ],
});

const supplies: HintMaker = ({ art, photos }) => ({
  layout: 'catalog',
  color: 'mustard',
  kicker: 'Shopping',
  deck: 'Nothing here refills. The Bureau has checked.',
  left: [head, gallery('catalog', getSectionVisuals('supplies', art), 'The winter catalogue'), stamp('Finite', -9)],
  right: [
    article('bullets'),
    gallery('pair', crosshairCards(art), 'Spot the difference'),
    aside(photo(photos.stockroom, 'Fig. 6: Late-night shopping. Every purchase final.', 1.3, 'normal', [{ kind: 'circle', x: 118, y: 72, r: 15 }])),
    tip('All orders are fulfilled by a drawer in somebody else\'s house.'),
  ],
});

const survival: HintMaker = ({ art, photos }) => ({
  layout: 'catalog',
  color: 'lime',
  kicker: 'Field biology',
  deck: 'Keeping the meat on your bones.',
  coverline: 'Survival needs: food, water and staying alive',
  left: [
    head,
    gallery('catalog', getSectionVisuals('survival', art), 'Field rations & medicine'),
    sticky('Wash dirty cuts immediately.', -2),
  ],
  right: [
    article('bullets'),
    aside(photo(photos.stockroom, 'Fig. 6b: Pantry inspection. Check expiry dates.', 1.1, 'normal', [])),
    tip('Standing still lets fatigue recover twice as fast as walking.'),
  ],
});

const searching: HintMaker = ({ art, photos }) => ({
  layout: 'classifieds',
  color: 'teal',
  kicker: 'Property',
  deck: 'Charming furniture, previously owned.',
  coverline: 'Is your fridge hiding something?',
  left: [
    head,
    article('numbered'),
    photo(photos.searching, 'Fig. 7: A viewing in progress.', -1.6, 'normal', [
      { kind: 'arrow', x1: 92, y1: 84, x2: 64, y2: 82 },
      { kind: 'note', x: 96, y: 76, text: 'yours now' },
    ]),
  ],
  right: [gallery('classifieds', getSectionVisuals('searching', art), 'For searching')],
});

const melee: HintMaker = ({ art }) => ({
  layout: 'hero',
  color: 'pink',
  kicker: 'Cutlery corner',
  deck: 'One careful review of one sharp object.',
  left: [{ kind: 'hero', sprite: art.ui.pickupIcons.knife, burst: 'Just as quiet!', caption: 'Shown actual size.' }],
  right: [
    head,
    { kind: 'review', stars: 5, quote: 'Quiet, loyal and never needs reloading. Would stab again.' },
    article('plain'),
    {
      kind: 'sidebar',
      title: 'Product details',
      extra: true,
      lines: [
        ['Noise', 'None whatsoever.'],
        ['Ammo', 'Not applicable.'],
        ['Where sold', 'Diners, homes, garages, drawers.'],
        ['Returns', 'On death only.'],
      ],
    },
    sticky('You lose it if you die. So, you know, don\'t.', -2.5),
  ],
});

const hordes: HintMaker = ({ art, photos }) => ({
  layout: 'wildlife',
  color: 'lime',
  kicker: 'Local wildlife',
  deck: 'Best viewed from a long way off.',
  coverline: 'Local wildlife: a spotter\'s guide',
  left: [gallery('spotter', getSectionVisuals('hordes', art), 'Spotter\'s checklist')],
  right: [
    head,
    article('bullets'),
    sticky('Siren = stop shopping.', 3),
    aside(photo(photos.town, 'Fig. 8: A typical neighbourhood. Roads are where the Bureau left them.', 1.4, 'normal', [])),
  ],
});

const van: HintMaker = () => ({
  layout: 'panorama',
  color: 'tomato',
  kicker: 'Departures',
  deck: 'Your ride out. No tickets, no seatbelts, no refunds.',
  backdrop: 'vanPanorama',
  left: [head, sticky('Two seconds. Count them out loud.', -3)],
  right: [article('numbered'), tip('The van stops zombies and bullets. It also stops you. Go around.')],
});

const workbench: HintMaker = ({ art, photos }) => ({
  layout: 'diagram',
  color: 'teal',
  kicker: 'Home improvement',
  deck: 'Some assembly required.',
  left: [
    head,
    article('numbered'),
    aside(photo(photos.workshop, 'Fig. 9: Rex, voiding the warranty.', -2, 'small', [{ kind: 'circle', x: 52, y: 32, r: 26 }])),
  ],
  right: [
    {
      kind: 'diagram',
      gun: art.ui.weaponIcons.carbine,
      caption: 'Fig. 10: Exploded view. The gun, not you.',
      parts: [
        { id: 'barrel', title: 'Barrel', sprite: art.ui.pickupIcons.barrel },
        { id: 'grip', title: 'Grip', sprite: art.ui.pickupIcons.grip },
        { id: 'magazine', title: 'Magazine', sprite: art.ui.pickupIcons.magazine },
        { id: 'suppressor', title: 'Suppressor', sprite: art.ui.pickupIcons.suppressor },
      ],
    },
    stamp('Warranty void', 7),
    tip('Choose before you fit. Slots run out sooner than enthusiasm.'),
  ],
});

const survivors: HintMaker = ({ art }) => {
  const cards = getSectionVisuals('survivors', art);
  return {
    layout: 'roster',
    color: 'violet',
    kicker: 'Who\'s who',
    deck: 'Five people who stayed for the sights.',
    coverline: 'Five people who missed the last bus',
    left: [head, gallery('passport', cards.slice(0, 2), undefined, [0, 1])],
    right: [gallery('passport', cards.slice(2), undefined, [2, 3, 4]), sticky('All five have read this manual. Results vary.', 2.5)],
  };
};

const difficulty: HintMaker = ({ art, photos }) => ({
  layout: 'forecast',
  color: 'sky',
  kicker: 'Tonight\'s forecast',
  deck: 'Four outlooks. None of them sunny.',
  left: [
    head,
    photo(photos.crowd, 'Fig. 11: A big horde, from a safe distance. Fig. 12, from closer, was not recovered.', -1.5, 'hero', [
      { kind: 'circle', x: 150, y: 84, r: 30 },
      { kind: 'note', x: 96, y: 18, text: 'bring a coat' },
    ]),
  ],
  right: [gallery('forecast', getSectionVisuals('difficulty', art), 'The outlook', [0, 1, 2, 3]), tip('If in doubt, check the weather before you check the fridge.')],
});

const coop: HintMaker = ({ photos }) => ({
  layout: 'postcard',
  color: 'pink',
  kicker: 'Travelling together',
  deck: 'Everything is better shared. Especially zombies.',
  left: [head, photo(photos.squad, 'Greetings from town! Wish you were here. No, really. We need the help.', -3, 'hero', [])],
  right: [
    stamp('Air mail', 8),
    article('numbered', undefined, 'Dear friend,'),
    sticky('When it goes wrong, blame whoever fired first.', -2.5),
    aside(photo(photos.town, 'Fig. 13: The one town you will all be sharing.', 1.2, 'small', [])),
  ],
});

const styles: HintMaker = ({ art, photos }) => ({
  layout: 'column',
  color: 'sky',
  kicker: 'Two ways to travel',
  deck: 'Pick a package. Both end at the van.',
  coverline: 'Campaign or Arcade: choose your holiday',
  left: [
    gallery('pair', getSectionVisuals('styles', art), 'Pick one'),
    sticky('Your choice is remembered. The Bureau remembers everything.', -2),
    aside(photo(photos.town, 'The town you will be visiting either way.', 1.4, 'normal', [])),
  ],
  right: [head, article('bullets'), tip('Each package keeps its own save. Changing your mind costs nothing.')],
});

const bunker: HintMaker = ({ art, photos }) => ({
  layout: 'classifieds',
  color: 'mustard',
  kicker: 'Accommodation',
  deck: 'Underground, windowless and entirely yours.',
  left: [
    head,
    article('bullets'),
    aside(photo(photos.workshop, 'The workshop, tidied for the inspection.', 1.6, 'small', [{ kind: 'circle', x: 52, y: 32, r: 26 }])),
  ],
  right: [gallery('classifieds', getSectionVisuals('bunker', art), 'Amenities'), tip('Nothing in the bunker bites. The Bureau checked twice.')],
});

const trips: HintMaker = ({ photos }) => ({
  layout: 'postcard',
  color: 'teal',
  kicker: 'Day trips',
  deck: 'Out in the morning, home by dark, mostly.',
  left: [head, photo(photos.vanRoad, 'The van, leaving on time. It will not wait for you.', -2, 'hero', [{ kind: 'note', x: 34, y: 18, text: 'bring it home' }])],
  right: [article('numbered'), sticky('Keep the van in sight.', 2.5)],
});

const treasure: HintMaker = ({ art }) => ({
  layout: 'catalog',
  color: 'pink',
  kicker: 'Souvenirs',
  deck: 'Small, shiny and worth carrying home.',
  left: [head, gallery('catalog', getSectionVisuals('treasure', art), 'The souvenir shop')],
  right: [article('bullets'), tip('A souvenir you drop on the way back is only a story.'), sticky('Not yours until the van says so.', -2.5)],
});

const forge: HintMaker = ({ art }) => ({
  layout: 'hero',
  color: 'violet',
  kicker: 'Craft corner',
  deck: 'Turn a pocketful of jewels into something spendable.',
  left: [{ kind: 'hero', sprite: art.ui.pickupIcons.jewel_large, burst: 'Three seconds a jewel!', caption: 'A large jewel, shown actual size.' }],
  right: [
    head,
    { kind: 'review', stars: 4, quote: 'Does exactly what it says, as long as you stand there. Would wait again.' },
    article('plain'),
    sticky('Please do not lean on the forge.', -2.5),
  ],
});

const merchants: HintMaker = ({ art, photos }) => ({
  layout: 'wildlife',
  color: 'mustard',
  kicker: 'Meet the neighbours',
  deck: 'Four stalls, four opinions about your budget.',
  left: [gallery('spotter', getSectionVisuals('merchants', art), 'Stallholders, as listed')],
  right: [
    head,
    article('bullets'),
    sticky('Haggling is not offered.', 3),
    aside(photo(photos.stockroom, 'The stock. There is not much of it.', 1.4, 'normal', [])),
  ],
});

const dying: HintMaker = ({ photos }) => ({
  layout: 'column',
  color: 'tomato',
  kicker: 'Small print',
  deck: 'A setback, not the end of the holiday.',
  left: [head, article('numbered'), tip('Nobody is ever stuck without a gun. The van will not allow it.')],
  right: [stamp('Not final', -8), photo(photos.crowd, 'A trip, shortly before it was cut short.', 1.2, 'normal', [{ kind: 'circle', x: 150, y: 84, r: 30 }])],
});

const overrun: HintMaker = ({ art, photos }) => ({
  layout: 'forecast',
  color: 'violet',
  kicker: 'Notice to residents',
  deck: 'The door holds. For a while.',
  coverline: 'How long can you stay home?',
  left: [
    head,
    photo(photos.crowd, 'Fig. 14: Visitors, arriving without an appointment.', -1.5, 'hero', [{ kind: 'note', x: 96, y: 18, text: 'shop faster' }]),
  ],
  right: [article('numbered'), gallery('spotter', getSectionVisuals('overrun', art), 'Fixtures'), tip('Hold the bunker and the chest pays. Run and the stalls pay instead.'), stamp('Do not open', 6)],
});

const HINTS: Readonly<Record<string, HintMaker>> = {
  goal,
  styles,
  bunker,
  trips,
  treasure,
  forge,
  merchants,
  dying,
  overrun,
  controls,
  noise,
  supplies,
  survival,
  searching,
  melee,
  hordes,
  van,
  workbench,
  survivors,
  difficulty,
  coop,
};

const SPARE_COLORS: readonly MagazineColor[] = ['teal', 'tomato', 'mustard', 'violet', 'pink', 'sky', 'lime'];

/** A section with no hint of its own still gets a proper spread, printed from its own words. */
function defaultHint({ photos }: HintContext, chapterIndex: number): ChapterHint {
  return {
    layout: 'column',
    color: SPARE_COLORS[chapterIndex % SPARE_COLORS.length],
    kicker: 'Stop press',
    deck: 'News reached the Bureau just as this issue went to print.',
    left: [
      photo(photos.town, 'Fig. X: The town, carrying on regardless.', -2, 'hero', []),
      sticky('New! Read twice.', 3),
    ],
    right: [head, article('bullets'), tip('The Bureau will update this advice if it survives.')],
  };
}

/** The layout hint for a section, or the default for one the magazine has not met. */
export function chapterHint(sectionId: string, chapterIndex: number, context: HintContext): ChapterHint {
  return HINTS[sectionId]?.(context) ?? defaultHint(context, chapterIndex);
}
