import type { MerchantId } from '../../shared/home-protocol.ts';
import type { ArtBook } from '../art/types.ts';
import { MERCHANTS } from './home/merchant-data.ts';
import type { GalleryCard } from './magazine-types.ts';

/** The game's own pictures for each How to Play section. The captions are the magazine's voice, never new rules. */
type CardList = (art: ArtBook) => readonly GalleryCard[];

const SOUTH = 2;

const zombieFront = (art: ArtBook, type: keyof ArtBook['zombies']) => art.zombies[type].walk[SOUTH].frames[0];

const supplies: CardList = (art) => [
  { id: 'pistol-ammo', title: 'Pistol rounds', sprite: art.ui.pickupIcons.pistol_ammo, scale: 4, tag: 'No. 101', caption: 'For the pistol. Only the pistol.' },
  { id: 'carbine-ammo', title: 'Carbine rounds', sprite: art.ui.pickupIcons.carbine_ammo, scale: 4, tag: 'No. 102', caption: 'Will not fit the pistol. We asked.' },
  { id: 'shells', title: 'Shotgun shells', sprite: art.ui.pickupIcons.shells, scale: 4, tag: 'No. 103', caption: 'Bulky, loud and worth it.' },
  { id: 'medkit', title: 'Medkit', sprite: art.ui.pickupIcons.medkit, scale: 4, tag: 'No. 201', caption: 'Press H. Feel better.' },
  { id: 'bandage', title: 'Bandage', sprite: art.ui.pickupIcons.bandage, scale: 4, tag: 'No. 202', caption: 'For when a medkit feels like showing off.' },
];

const searching: CardList = (art) => [
  { id: 'fridge', title: 'Fridge', sprite: art.containers.fridge.closed, scale: 1.5, tag: 'Kitchen', caption: 'Cold, dark, one careful owner.' },
  { id: 'car', title: 'Car', sprite: art.containers.car.closed, scale: 1.25, tag: 'Street', caption: 'Low mileage. Nobody is coming back for it.' },
  { id: 'locker', title: 'Locker', sprite: art.containers.locker.closed, scale: 1.5, tag: 'Secure', caption: 'Lockable. Not locked.' },
  { id: 'shelf', title: 'Shelf', sprite: art.containers.shelf.closed, scale: 1.5, tag: 'Retail', caption: 'Generous storage, sadly unattended.' },
  { id: 'box', title: 'Box', sprite: art.containers.box.closed, scale: 1.25, tag: 'Bargain', caption: 'Contents unknown. Seller unavailable.' },
  { id: 'drawer', title: 'Drawer', sprite: art.containers.drawer.closed, scale: 1.1, tag: 'Bedroom', caption: 'Sleeps one. Asks no questions.' },
];

const hordes: CardList = (art) => [
  { id: 'walker', title: 'Walker', sprite: zombieFront(art, 'walker'), scale: 3, tag: 'Common', caption: 'The town\'s main residents. They walk.' },
  { id: 'runner', title: 'Runner', sprite: zombieFront(art, 'runner'), scale: 3, tag: 'Brisk', caption: 'As described.' },
  { id: 'bloater', title: 'Bloater', sprite: zombieFront(art, 'bloater'), scale: 2.6, tag: 'Pops', caption: 'Bursts. Admire from a distance.' },
  { id: 'brute', title: 'Brute', sprite: zombieFront(art, 'brute'), scale: 2, tag: 'Large', caption: 'A disappointing thing to shove.' },
  { id: 'screamer', title: 'Screamer', sprite: zombieFront(art, 'screamer'), scale: 3, tag: 'Loud', caption: 'If it sees you, everyone hears about it.' },
];

const survivors: CardList = (art) =>
  ['Night', 'Bear', 'Kat', 'Rex', 'Rich'].map((name, index) => ({
    id: name.toLowerCase(),
    title: name,
    sprite: art.survivors[index].portrait,
    scale: 3.4,
    tag: `Visa ${index + 1}`,
  }));

const noise: CardList = (art) => [
  { id: 'gunshot', title: 'Gunshot', sprite: art.ui.weaponIcons.pistol, scale: 1.6, tag: 'Loud', caption: 'Carries.' },
  { id: 'search', title: 'Searching', sprite: art.containers.box.closed, scale: 0.8, tag: 'Maybe', caption: 'Depends on your luck.' },
  { id: 'shove', title: 'Shove', sprite: art.ui.pickupIcons.knife, scale: 2, tag: 'Silent', caption: 'Rude, but quiet.' },
];

const difficulty: CardList = (art) =>
  ['Mild', 'Fair', 'Stormy', 'Do not travel'].map((tag, index) => {
    const friendly = index < 2;
    return { id: `outlook-${index}`, title: tag, sprite: friendly ? art.ui.heart : art.ui.skull, scale: 3 };
  });

const rounds: CardList = (art) => [
  { id: 'incendiary', title: 'Flame rounds', sprite: art.ui.pickupIcons.incendiary_kit, scale: 3, tag: 'Hot', caption: 'Loud, bright and very sorry.' },
  { id: 'acid', title: 'Acid rounds', sprite: art.ui.pickupIcons.acid_kit, scale: 3, tag: 'Sour', caption: 'Brutes take it personally.' },
  { id: 'piercing', title: 'Piercing rounds', sprite: art.ui.pickupIcons.piercing_kit, scale: 3, tag: 'Sharp', caption: 'Two for the price of one.' },
  { id: 'tranq', title: 'Tranq rounds', sprite: art.ui.pickupIcons.tranq_kit, scale: 3, tag: 'Calm', caption: 'Slower, if not quite sorry.' },
];

const styles: CardList = (art) => [
  { id: 'campaign', title: 'Campaign', sprite: art.ui.style.campaign, scale: 2.2, tag: 'Option A' },
  { id: 'arcade', title: 'Arcade', sprite: art.ui.style.arcade, scale: 2.2, tag: 'Option B' },
];

const bunker: CardList = (art) => [
  { id: 'locker', title: 'Locker', sprite: art.ui.stations.locker, scale: 1.4, tag: 'Quarters', caption: 'Your things, laid out neatly.' },
  { id: 'forge', title: 'Forge', sprite: art.ui.stations.forge, scale: 1.4, tag: 'Workshop', caption: 'Hot. Please do not lean.' },
  { id: 'bench', title: 'Bench', sprite: art.ui.stations.bench, scale: 1.4, tag: 'Workshop', caption: 'Some assembly required.' },
  { id: 'jukebox', title: 'Jukebox', sprite: art.ui.stations.jukebox, scale: 1.4, tag: 'Quarters', caption: 'Plays whatever you have heard.' },
];

const treasure: CardList = (art) => [
  { id: 'silver', title: 'Silver', sprite: art.ui.silverIcon, scale: 4, tag: 'No. 301', caption: 'Forge-made. One hundred make a gold.' },
  { id: 'jewel-small', title: 'Small jewel', sprite: art.ui.pickupIcons.jewel_small, scale: 4, tag: 'No. 302', caption: 'Forty silver, once smelted.' },
  { id: 'jewel-large', title: 'Large jewel', sprite: art.ui.pickupIcons.jewel_large, scale: 4, tag: 'No. 303', caption: 'Two hundred. Lift with your knees.' },
];

const MERCHANT_ORDER: readonly MerchantId[] = ['gunsmith', 'quartermaster', 'medic', 'powder'];

const MERCHANT_CAPTIONS: Readonly<Record<MerchantId, string>> = {
  gunsmith: 'Everything here has been fired once.',
  quartermaster: 'Counts rounds. Twice.',
  medic: 'Prefers you in one piece.',
  powder: 'Loud, bright and not sorry.',
};

const merchants: CardList = (art) =>
  MERCHANT_ORDER.map((id) => ({
    id,
    title: MERCHANTS[id].name,
    sprite: art.merchants[id].portrait,
    scale: 3.4,
    tag: MERCHANTS[id].role,
    caption: MERCHANT_CAPTIONS[id],
  }));

/** The HUD's own ailment badges, so the page shows what to look for in the corner of the screen. */
const MOODLE_CARDS = [
  { id: 'hunger', title: 'Hunger', caption: 'Eat canned food.' },
  { id: 'thirst', title: 'Thirst', caption: 'Drink bottled water.' },
  { id: 'bleeding', title: 'Bleeding', caption: 'Bandages or a medkit close the wound.' },
  { id: 'infection', title: 'Infection', caption: 'Disinfectant early, antibiotics later.' },
  { id: 'fatigue', title: 'Fatigue', caption: 'Stop sprinting and catch your breath.' },
] as const;

const moodleCards: CardList = (art) => {
  const moodles = art.ui.moodles;
  if (!moodles) return [];
  return MOODLE_CARDS.map(({ id, title, caption }) => ({ id: `moodle-${id}`, title, sprite: moodles[id], scale: 3, tag: 'HUD badge', caption }));
};

const survival: CardList = (art) => [
  { id: 'canned-food', title: 'Canned food', sprite: art.ui.pickupIcons.canned_food, scale: 3, tag: 'Rations', caption: 'Restores hunger and vitality.' },
  { id: 'water-bottle', title: 'Bottled water', sprite: art.ui.pickupIcons.water_bottle, scale: 3, tag: 'Clean', caption: 'Quenches thirst and recharges stamina.' },
  { id: 'disinfectant', title: 'Disinfectant', sprite: art.ui.pickupIcons.disinfectant, scale: 3, tag: 'First aid', caption: 'Sterilizes dirty cuts and scratches.' },
  { id: 'antibiotics', title: 'Antibiotics', sprite: art.ui.pickupIcons.antibiotics, scale: 3, tag: 'Medicine', caption: 'Arrests zombie zoonosis.' },
  ...moodleCards(art),
];

const bag: CardList = (art) => [
  { id: 'plank', title: 'Plank', sprite: art.ui.pickupIcons.plank, scale: 3, tag: 'Four cells', caption: 'Drawn end to end across its slots.' },
  { id: 'water-bottle', title: 'Bottled water', sprite: art.ui.pickupIcons.water_bottle, scale: 3, tag: 'Two cells' },
  { id: 'fountain', title: 'Fountain', sprite: art.ui.fountain, scale: 3, tag: 'Two cells' },
];

const doors: CardList = (art) => [
  { id: 'plank', title: 'Plank', sprite: art.ui.pickupIcons.plank, scale: 3, tag: 'Board', caption: 'One board for each hold of E.' },
  { id: 'nails', title: 'Nails', sprite: art.ui.pickupIcons.nails, scale: 3, tag: 'Fasten' },
  { id: 'hammer', title: 'Hammer', sprite: art.ui.pickupIcons.hammer_tool, scale: 3, tag: 'Tool' },
  { id: 'crowbar', title: 'Crowbar', sprite: art.ui.pickupIcons.crowbar, scale: 3, tag: 'Pry', caption: 'Sneak and hold E.' },
  { id: 'curtain', title: 'Curtain sheet', sprite: art.ui.pickupIcons.sheet_curtain, scale: 3, tag: 'Cover' },
];

const SECTION_CARDS: Readonly<Record<string, CardList>> = {
  supplies,
  survival,
  searching,
  bag,
  doors,
  hordes,
  survivors,
  noise,
  difficulty,
  goal: (art) => [{ id: 'van', title: 'Escape van', sprite: art.environment.escapeVan, scale: 1 }],
  styles,
  bunker,
  trips: (art) => [{ id: 'van', title: 'Escape van', sprite: art.environment.escapeVan, scale: 1 }],
  treasure,
  forge: (art) => [{ id: 'forge', title: 'Forge', sprite: art.ui.stations.forge, scale: 1.6 }],
  merchants,
  dying: (art) => [{ id: 'skull', title: 'Skull', sprite: art.ui.skull, scale: 3 }],
  overrun: (art) => [
    { id: 'fence', title: 'Scrap fence', sprite: art.environment.props.camp_fence_h, scale: 1.4, caption: 'Rated for a while.' },
    { id: 'chest', title: 'Reward chest', sprite: art.environment.props.chest, scale: 2, caption: 'For those who stayed.' },
  ],
  controls: (art) => [{ id: 'crosshair', title: 'Crosshair', sprite: art.ui.crosshair, scale: 2 }],
  melee: (art) => [{ id: 'knife', title: 'Knife', sprite: art.ui.pickupIcons.knife, scale: 2 }],
  van: (art) => [{ id: 'van', title: 'Escape van', sprite: art.environment.escapeVan, scale: 1 }],
  workbench: (art) => [{ id: 'toolkit', title: 'Toolkit', sprite: art.ui.pickupIcons.toolkit, scale: 2 }],
  rounds,
  coop: (art) => [{ id: 'team', title: 'Night', sprite: art.survivors[0].portrait, scale: 1 }],
};

/** The pictures for a section. A section with none of its own yet returns an empty list. */
export function getSectionVisuals(sectionId: string, art: ArtBook): readonly GalleryCard[] {
  return SECTION_CARDS[sectionId]?.(art) ?? [];
}

/** The crosshair and the crosshair over a head, side by side. */
export const crosshairCards: CardList = (art) => [
  { id: 'crosshair', title: 'Not a head', sprite: art.ui.crosshair, scale: 3.5 },
  { id: 'crosshair-head', title: 'A head', sprite: art.ui.crosshairHead, scale: 3.5 },
];
