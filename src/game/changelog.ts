// What's new, in the players' own words: the book that opens from the version number on the title screen.
//
// To add an update, put a new note at the TOP of CHANGE_NOTES. Nothing else needs to change: the book lays the
// notes out two to a page, newest first, and lists them on its front page.

export type ChangeKind = 'new' | 'better' | 'fixed';

export interface ChangeNote {
  /** Stable and unique, for keys. */
  readonly id: string;
  /** The day it shipped, YYYY-MM-DD. */
  readonly date: string;
  readonly kind: ChangeKind;
  readonly title: string;
  /** One line under the title. */
  readonly deck: string;
  /** What it means in play: two to four short lines. */
  readonly points: readonly string[];
}

export const CHANGE_NOTES: readonly ChangeNote[] = [
  {
    id: 'smooth-hordes',
    date: '2026-11-07',
    kind: 'better',
    title: 'Smoother big hordes',
    deck: 'A full horde runs faster on slower computers and phones.',
    points: [
      'Score pop-ups and bloodstains cost far less to draw.',
      'When frames start to drop, the game trims spare sparks and small flashes of light first.',
      'If that is not enough, the lighting updates every other frame until the fight thins out.',
    ],
  },
  {
    id: 'motion-setting',
    date: '2026-11-07',
    kind: 'new',
    title: 'Choose your motion',
    deck: 'Options has a Motion setting, and a slider for screen shake.',
    points: [
      'System follows your device, as before. Full plays every animation, the van ride too, whatever your device says.',
      'Reduced calms things down: no big flashes, still transitions, and only a nudge of shake.',
      'Screen shake goes from 0 to 100%, so you can keep the motion and lose the wobble.',
    ],
  },
  {
    id: 'readable-pickup-text',
    date: '2026-11-07',
    kind: 'better',
    title: 'Pickup words you can read',
    deck: 'The little words over your head no longer pile on top of each other.',
    points: [
      'Grab several things at once and each word gets its own line, newest at the bottom.',
      'Grab the same thing twice and the numbers add up: two boxes of shells read +8 SHELLS.',
      'Words hold still for a moment once they rise, then fade out instead of blinking away.',
    ],
  },
  {
    id: 'combat-feel',
    date: '2026-11-07',
    kind: 'better',
    title: 'Fights hit harder',
    deck: 'You can hear a brute coming, and a boss going down feels like it.',
    points: [
      'Brutes and bosses stomp as they walk, so you hear a big one before you see it.',
      'Every gun reloads its own way: the pistol slide snaps, the carbine racks, the shotgun loads shell by shell.',
      'When you are badly hurt the red at the edge of the screen beats with your heart, and the world goes muffled.',
      'A boss kill freezes the moment with a flash and the biggest shake in the game. Reduced motion keeps it calm.',
    ],
  },
  {
    id: 'faster-first-load',
    date: '2026-11-07',
    kind: 'better',
    title: 'A faster first load',
    deck: 'The game downloads less before the title screen shows.',
    points: [
      'The books, the jukebox and the ending now load in the background after the title is up.',
      'Online rooms load their code only when you host or join one.',
    ],
  },
  {
    id: 'setup-stepper-thumbs',
    date: '2026-11-07',
    kind: 'better',
    title: 'Setup shows your picks',
    deck: 'Each finished step in the setup stepper shows a little picture of what you chose.',
    points: ['Your style, mode and difficulty sit in the stepper as thumbnails. Tap one to go back and change it.'],
  },
  {
    id: 'sound-color-size-options',
    date: '2026-11-07',
    kind: 'better',
    title: 'Options for your ears and eyes',
    deck: 'Set music and sound effects apart, pick colorblind hit colors and make the UI bigger.',
    points: [
      'Music and Sound effects each get their own slider under Volume.',
      'Hit colors: Colorblind swaps red and green for magenta and blue on health bars, callouts and the HUD.',
      'UI size: Large and Larger make the HUD and menus easier to read on a phone.',
    ],
  },
  {
    id: 'apartment-floors',
    date: '2026-11-07',
    kind: 'new',
    title: 'Apartments go up a floor',
    deck: 'Every apartment block has a second floor now.',
    points: [
      'The stairs are at the east end of the lobby, just inside the front.',
      'Upstairs are two more flats off the same hall, with beds, fridges and lockers to search.',
      'Zombies follow you up, the same as in a house.',
    ],
  },
  {
    id: 'grounded-cacti',
    date: '2026-11-07',
    kind: 'fixed',
    title: 'Cacti touch the ground',
    deck: 'Desert saguaros no longer hover above their own shadows.',
    points: [
      'Each cactus now stands right on its shadow instead of a few pixels above it.',
    ],
  },
  {
    id: 'floors',
    date: '2026-11-07',
    kind: 'new',
    title: 'Upstairs and cellars',
    deck: 'Some houses go up a floor, and some go down one.',
    points: [
      'About half the houses have stairs in the kitchen: up to two bedrooms, or down to a cellar.',
      'Stand on the stairs and press E (or tap Search) to take them.',
      'Zombies on your heels follow you up and down. A shot upstairs is heard around the house below.',
      'Bedrooms hide the most candy. Cellars keep first aid, and the odd knife.',
    ],
  },
  {
    id: 'merchants',
    date: '2026-11-07',
    kind: 'better',
    title: 'The bunker merchants, redrawn',
    deck: 'Mags, Sarge, Doc and Cinder finally look like they belong.',
    points: [
      'All four stallholders are drawn the same way as the survivors: same build, outline and lighting.',
      'Their portraits in How to Play now sit at the survivors’ scale.',
    ],
  },
  {
    id: 'run-log',
    date: '2026-11-07',
    kind: 'new',
    title: 'The run log',
    deck: 'Missed a callout? It’s written down.',
    points: [
      'Every callout, banner, pickup and teammate going down is logged with the run’s clock.',
      'The last few lines sit in the bottom-right corner. Press L or tap them to read the whole log.',
      'Tabs for Fights, Loot, Night and Team. The run keeps going while you read.',
      'Your gun bar has moved to the bottom centre to make room.',
    ],
  },
  {
    id: 'back-doors',
    date: '2026-11-07',
    kind: 'new',
    title: 'Back doors and rooms',
    deck: 'A crowd at the front door is no longer a trap.',
    points: [
      'Houses, apartments, the clinic, police station, garage, warehouse and grocery have a back door.',
      'Houses have a bedroom, and apartments split into two flats off a shared hall.',
      'Every room is still wide enough for the biggest survivor to get through.',
    ],
  },
  {
    id: 'keepsakes',
    date: '2026-11-07',
    kind: 'new',
    title: 'Keepsakes',
    deck: 'Pick one of three, and keep it all run.',
    points: [
      'Reaching towns 3, 5, 7 and 9, you are offered three keepsakes. Pick one with a click, a tap, or J, K, L.',
      'A Rabbit’s Foot for luckier searches, Worn Sneakers for longer sprints, Dog Tags for faster revives, and more.',
      'Each survivor gets their own offer in co-op.',
    ],
  },
  {
    id: 'candy',
    date: '2026-11-07',
    kind: 'new',
    title: 'Halloween candy',
    deck: 'Twelve short boosts hidden around town.',
    points: [
      'Search houses and apartments for candy. Carry two, and press X to eat one.',
      'Sour Skulls reload twice as fast, Ghost Gum makes sprinting silent, Jawbreaker halves the damage you take.',
      'Each lasts 75 seconds. Find a Full-Size Bar and you get a bit of everything.',
    ],
  },
  {
    id: 'furniture',
    date: '2026-11-07',
    kind: 'fixed',
    title: 'Furniture against the walls',
    deck: 'No more gaps that look like a way through.',
    points: [
      'Furniture now stands flush against a building’s side walls.',
      'The narrow gaps that used to trap players are gone, and real aisles open where there is room.',
    ],
  },
  {
    id: 'stamps',
    date: '2026-11-07',
    kind: 'new',
    title: 'Stamps',
    deck: 'Achievements, inked into your Record Book.',
    points: [
      'Seventeen stamps to earn, from First Blood and Headhunter to beating each boss and reaching the last town.',
      'Each one is dated the day you earn it. An empty ring tells you how to get it.',
      'Find them on the last two pages of Records.',
    ],
  },
  {
    id: 'bosses',
    date: '2026-11-07',
    kind: 'new',
    title: 'Boss nights',
    deck: 'Levels 3, 6 and 9 end with something big.',
    points: [
      'The Howler screams for runners. Mother gives birth to walkers. The Butcher charges anyone who gets close.',
      'The last horde does not end until the boss falls. A health bar shows how close you are.',
      'Every boss drops a medkit and a prize.',
    ],
  },
  {
    id: 'night-events',
    date: '2026-11-07',
    kind: 'new',
    title: 'Night events',
    deck: 'Some nights are worse than others.',
    points: [
      'Fog: zombies only spot you up close, and the town turns grey.',
      'Blood moon: hordes twice the size, but every kill is worth double.',
      'Power cut: the lamps go dark, zombies see less and hear more.',
      'The level card tells you what tonight brings.',
    ],
  },
  {
    id: 'sos-discount',
    date: '2026-11-07',
    kind: 'new',
    title: 'S.O.S. Discount',
    deck: 'A new store downtown, with a back room worth checking.',
    points: ['Shows up in two towns out of three.', 'Cheap goods on the shelves, better finds in the stockroom.'],
  },
  {
    id: 'chains',
    date: '2026-11-07',
    kind: 'new',
    title: 'Kill chains pay, and share your Daily',
    deck: 'Fast kills are worth more.',
    points: [
      'Each kill soon after your last is worth more, up to double from the fifth in a row.',
      'The floating score shows the bonus, like +18 x1.5.',
      'Copy result puts your Daily Night score, kills and streak on your clipboard, ready to paste anywhere.',
    ],
  },
  {
    id: 'record-book',
    date: '2026-11-07',
    kind: 'better',
    title: 'Records, as a printed book',
    deck: 'Your bests, written in by hand.',
    points: [
      'Personal bests for Campaign and Arcade, a ledger of your top five runs, and your Daily Night streak.',
      'The last seven nights, each stamped Counted, Missed or Tonight.',
      'Turn pages with Prev and Next, the arrow keys, or a swipe.',
    ],
  },
  {
    id: 'daily-night',
    date: '2026-11-07',
    kind: 'new',
    title: 'Daily Night',
    deck: 'One town a day, the same for everyone.',
    points: [
      'A new item on the title menu. Every player gets the same town, rule and difficulty each day.',
      'Your first run of the day counts. The rest are practice.',
      'Keep a streak going, and see the countdown to the next town.',
    ],
  },
  {
    id: 'supply-drops',
    date: '2026-11-07',
    kind: 'new',
    title: 'Supply drops',
    deck: 'Watch for the red flare.',
    points: [
      'Once a town, after the first horde, a flare goes up and a crate lands on it ten seconds later.',
      'Inside: ammo, a medkit, a round kit and a prize.',
      'The flare is loud and the landing is louder, so you won’t be the only one coming.',
    ],
  },
  {
    id: 'molotovs',
    date: '2026-11-07',
    kind: 'new',
    title: 'Molotovs and flares',
    deck: 'Something to throw.',
    points: [
      'Find fuel in garages, warehouses and diners. Press T to throw a molotov: a pool of fire for five seconds.',
      'Find flares at the police station, in garages and in cars. Press V to throw one and pull zombies away.',
      'Carry two of each. Don’t stand in your own fire.',
    ],
  },
  {
    id: 'kill-feel',
    date: '2026-11-07',
    kind: 'better',
    title: 'Kills that land',
    deck: 'Every big hit feels big.',
    points: [
      'A tiny freeze on headshots, chain kills and dropped brutes.',
      'DOUBLE, TRIPLE, QUAD and MASSACRE callouts for quick kills.',
      'CLOSE CALL when you kill on almost no health, and HORDE WIPED OUT when you clear the lot.',
    ],
  },
  {
    id: 'overrun',
    date: '2026-11-07',
    kind: 'new',
    title: 'The Overrun',
    deck: 'The bunker is no longer safe.',
    points: [
      'From level 2 in Campaign, a clock runs while you are in the bunker. When it runs out, the blast door bursts.',
      'Kill the horde that comes in to earn a reward chest, or run for the van and leave the merchants to it.',
      'How to Play has a new chapter on it.',
    ],
  },
  {
    id: 'online-rooms',
    date: '2026-11-07',
    kind: 'new',
    title: 'Online co-op rooms',
    deck: 'Play with a friend from anywhere.',
    points: [
      'Host a room right in your browser and send a friend the room code or invite link.',
      'No server to set up on your side.',
      'Rooms open to everyone once the online service is switched on.',
    ],
  },
  {
    id: 'setup-stepper',
    date: '2026-11-07',
    kind: 'better',
    title: 'A clearer setup',
    deck: 'Style, Mode, Difficulty, Survivor, in that order.',
    points: [
      'A numbered stepper shows where you are. Tap a finished step to go back to it.',
      'Every step is the same size, so the Back and Next buttons stay put.',
    ],
  },
];

export const CHANGELOG_TITLE = "What's New";

export const KIND_LABELS: Readonly<Record<ChangeKind, string>> = { new: 'New', better: 'Better', fixed: 'Fixed' };

export type LeafColor = 'tomato' | 'teal' | 'violet' | 'mustard' | 'pink' | 'sky' | 'lime';

const COLORS: readonly LeafColor[] = ['tomato', 'teal', 'violet', 'mustard', 'pink', 'sky', 'lime'];

/** How many notes share a page. */
export const NOTES_PER_LEAF = 2;

export type ChangeLeaf =
  | { readonly kind: 'front'; readonly id: string; readonly head: string; readonly color: LeafColor }
  | { readonly kind: 'notes'; readonly id: string; readonly head: string; readonly color: LeafColor; readonly notes: readonly ChangeNote[] };

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "7 Nov 2026" from "2026-11-07". */
export function noteDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return `${day} ${MONTH_NAMES[month - 1]} ${year}`;
}

/** The front page, then the notes two to a page, newest first. */
export function changeLeaves(notes: readonly ChangeNote[] = CHANGE_NOTES): readonly ChangeLeaf[] {
  const pages: ChangeLeaf[] = [{ kind: 'front', id: 'front', head: 'Contents', color: 'tomato' }];
  for (let at = 0; at < notes.length; at += NOTES_PER_LEAF) {
    const here = notes.slice(at, at + NOTES_PER_LEAF);
    const color = COLORS[pages.length % COLORS.length];
    pages.push({ kind: 'notes', id: `notes-${here[0].id}`, head: noteDate(here[0].date), color, notes: here });
  }
  return pages;
}

/** The page each note is on, for the front page's contents. Page 1 is the front page. */
export function notePage(id: string, notes: readonly ChangeNote[] = CHANGE_NOTES): number {
  const at = notes.findIndex((note) => note.id === id);
  return at < 0 ? 1 : 2 + Math.floor(at / NOTES_PER_LEAF);
}
