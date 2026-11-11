// Noise in the Night: the notes the daily newspaper (changelog.ts) lays out.
//
// To add an update, put a new note at the TOP of CHANGE_NOTES. Each ship day becomes an issue numbered like
// the game version (e.g. 2026-11-07 -> Issue 26.11.7). The day's first note leads the issue front page, and the rest
// run as stories inside. Older notes live in change-notes-earlier.ts, and the oldest of all in change-notes-oldest.ts.

import { EARLIER_NOTES } from './change-notes-earlier.ts';

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
    id: 'grid-bag',
    date: '2026-11-11',
    kind: 'new',
    title: 'The bag, cell by cell',
    deck: 'Press I to open a grid bag where every item takes the room it should.',
    points: [
      'Items have sizes: a fountain and a water bottle take two cells, a plank takes four, and long things lie end to end.',
      'Guns are worn in the gear slots beside the grid. The pack sets the grid: Satchel 5 by 4, Duffel 6 by 5, ALICE 8 by 6.',
      'Shuffle things around as you like. Moves are yours alone and count when you close the bag.',
    ],
  },
  {
    id: 'loot-window',
    date: '2026-11-11',
    kind: 'better',
    title: 'Loot waits in the box',
    deck: 'A search no longer spills its finds at your feet.',
    points: [
      'What a container holds stays in it until you take it.',
      'The loot window shows the container beside your bag. Move across what fits.',
      'Taking a firework, fountain or bottle from a container counts it once.',
    ],
  },
  {
    id: 'doors-boards',
    date: '2026-11-11',
    kind: 'new',
    title: 'Doors that shut and doors that hold',
    deck: 'The search key now works doors, and the dead know a closed one when they meet it.',
    points: [
      'Press E at a door to close it. Tap E to open a closed one.',
      'Hold E to board it with planks, nails and a hammer. Sneak and hold E to pry a board back off.',
      'Closed doors stop you, your shots and their eyes. Zombies bash them, and a breaking door is loud.',
    ],
  },
  {
    id: 'material-chips',
    date: '2026-11-11',
    kind: 'new',
    title: 'Materials on the HUD',
    deck: 'What you carry for building shows as chips under your items.',
    points: [
      'Planks, nails and curtain sheets show with a count. A hammer or a crowbar shows once you have one.',
      'Nothing carried, no chips. The Town Guide now lists planks, nails, hammers, crowbars and curtain sheets, and where to find them.',
    ],
  },
  {
    id: 'redrawn-icons',
    date: '2026-11-11',
    kind: 'better',
    title: 'Better pictures',
    deck: 'Survival badges, tools and a dumpster all redrawn.',
    points: [
      'The moodle badges are redrawn in the style of the pickup icons, and How to Play now shows each one.',
      'The knife, hammer, crowbar and plank sit on the diagonal. Long items are drawn the full length of their slots in the bag.',
      'A dumpster you have searched stands open and empty, its leavings on the ground.',
    ],
  },
  {
    id: 'left-behind-on-map',
    date: '2026-11-11',
    kind: 'better',
    title: 'What you left behind, on the map',
    deck: 'Items left in searched containers show on your town map.',
    points: [
      'Leave something in a container, indoors or out, and it is stamped on the map.',
      'Use the map to find your way back to what did not fit in the bag.',
    ],
  },
  {
    id: 'small-fixes-nov-11',
    date: '2026-11-11',
    kind: 'fixed',
    title: 'Small fixes',
    deck: 'A steadier title menu, a tidier Sound Test and badges that stay out of the way.',
    points: [
      'The title menu no longer shifts under your first click.',
      'The Sound Test deck, its finds note and its tabs are no longer squeezed by full-width buttons.',
      'On a phone, survival badges sit in the top-left column with your items.',
    ],
  },
  {
    id: 'dumpsters-and-clues',
    date: '2026-11-10',
    kind: 'new',
    title: 'Dumpsters and map clues',
    deck: 'Alley dumpsters can be searched, and empty searches can turn up marked caches.',
    points: [
      'Search outdoor dumpsters for a chance at spare ammo, weapons, medical gear or candy.',
      'Empty searches can turn up a scrawled map note, circling untouched caches with a glowing ring on your map.',
      'Emergency vehicles hold better finds: shotguns or carbines in police cruisers, and medical supplies in ambulances.',
    ],
  },
  {
    id: 'sewer-tunnels',
    date: '2026-11-10',
    kind: 'new',
    title: 'Underground in the sewers',
    deck: 'Pry open street manholes to slip into a maze of brick tunnels beneath the town.',
    points: [
      'Press E at open manholes to climb down into the sewer maze, or back up to the street.',
      'Underground, sludge canals slow your steps and the surface town shows dim on your map.',
      'Streets above are laid on a numbered grid, with a street sign at the top of your screen.',
    ],
  },
  {
    id: 'survival-moodles',
    date: '2026-11-10',
    kind: 'new',
    title: 'Survival needs and moodles',
    deck: 'Manage hunger, thirst, fatigue and pain with food, clean water and medicine.',
    points: [
      'Moodle chips on your screen warn when hunger, thirst, exhaustion or infection take hold.',
      'Scavenge canned food, can openers, water bottles, disinfectant and antibiotics to stay alive.',
      'Barricade windows and doors with wooden planks, nails and a hammer to hold back the dead.',
    ],
  },
  {
    id: 'salvage-press',
    date: '2026-11-10',
    kind: 'new',
    title: 'Salvage for the bunker press',
    deck: 'Haul scrap metal and parts back from town to feed the workshop press.',
    points: [
      'Search containers in town for scrap metal, electronics and materials to carry home.',
      'You can carry as much salvage as you find, but dropping in town leaves it behind.',
      'The workshop press in the bunker turns your collected salvage into supplies.',
    ],
  },
  {
    id: 'knife-cooldown',
    date: '2026-11-10',
    kind: 'better',
    title: 'Sharper knives and faster stabs',
    deck: 'Combat knives strike quicker than bare hands and wear redrawn art.',
    points: [
      'The knife cooldown is shorter now, letting you stab faster between swings.',
      'Reloading now leaves dropped magazines on the pavement like spent casings.',
      'Press P at any time during a solo run to pause without reaching for Escape.',
    ],
  },
  {
    id: 'page-turns',
    date: '2026-11-10',
    kind: 'better',
    title: 'Turning the page',
    deck: 'Books now turn with animated 3D pages across desktop and mobile screens.',
    points: [
      'What\'s New, the Town Guide, How to Play and Records flip smoothly with magazine page turns.',
      'Desktop screens show a wide two-page spread, while phones read one page at a time.',
      'The jukebox in the bunker now synchronizes its current song for everyone in the room.',
    ],
  },
  {
    id: 'pumpkin-eyes',
    date: '2026-11-09',
    kind: 'better',
    title: 'Eyes on the Step',
    deck: 'Jack-o\'-lanterns and candy pails only burn their eyes in the dark.',
    points: [
      'Outside the flashlight beam, doorstep pumpkins look just like lurking zombies.',
      'Candy bowls keep their twin eye glow until searched.',
    ],
  },
  {
    id: 'dry-gun-call',
    date: '2026-11-09',
    kind: 'better',
    title: 'Click. Now What?',
    deck: 'An empty magazine flashes what to press right over your head.',
    points: [
      'R: RELOAD! when there are spares for the gun in hand.',
      'Out of rounds for it? The key and name of a gun that still fires, like 1: PISTOL.',
      'Every gun dry? F: SHOVE, or F: STAB with a knife.',
    ],
  },
  {
    id: 'phone-tab-bar',
    date: '2026-11-09',
    kind: 'better',
    title: 'A Bar for Thumbs',
    deck: 'On a phone, the actions sit in one bar along the bottom.',
    points: [
      'Pause, Pack, Search, Shove and Sprint, each with its picture and its name.',
      'Lying on its side, the bar slims down so the street keeps its height.',
      'The swipe moves now show beside the pause card, bigger and drawn by hand.',
    ],
  },
  {
    id: 'roaming-merchants',
    date: '2026-11-09',
    kind: 'new',
    title: 'The merchants leave their desks',
    deck: 'Mags, Sarge, Doc and Cinder now walk the bunker, and they fight when the blast door goes.',
    points: [
      'Walk up to a merchant anywhere in the bunker and they stop to trade.',
      'The break-in horde is three to four times a town horde. The merchants shoot back beside you.',
      'A merchant the horde puts down gets back up once it is over.',
    ],
  },
  {
    id: 'fireballs',
    date: '2026-11-09',
    kind: 'new',
    title: 'Fireballs',
    deck: 'A new candy in the bag, red-hot and cinnamon.',
    points: [
      'While Fireballs work, every shot is a flame round and sets zombies alight, whatever your gun is fitted with.',
      'Eat more to keep the fire going longer. Fire is loud, so expect company.',
    ],
  },
  {
    id: 'candy-bag-cards',
    date: '2026-11-09',
    kind: 'better',
    title: 'Candy on the big cards',
    deck: 'The candy bag now looks like the Play page and Level Select.',
    points: [
      'Every candy you carry is a tall card with its picture big and its name along the bottom.',
      'Each name is lettered like its own wrapper, in its own colours.',
      'Point at one to read what it does, in big plain words, and how long it lasts.',
    ],
  },
  {
    id: 'level-select-stage',
    date: '2026-11-09',
    kind: 'better',
    title: 'Level Select gets the big cards',
    deck: 'Level Select now matches the Play screens: ten tall level cards out on the night scene.',
    points: [
      'Each card shows the town art with its level name in big letters. Locked levels stay grey.',
      'Point at a card to see its story line and threat bars underneath, and the page fits on one screen.',
    ],
  },
  {
    id: 'daily-stage',
    date: '2026-11-09',
    kind: 'better',
    title: 'Daily Night takes the stage',
    deck: 'The Daily Night page now looks like Arcade and Campaign: three big cards on the night scene.',
    points: [
      'Tonight\'s town and difficulty stand beside your survivor. Click the survivor to pick from the big cards.',
      'Your run, the streak, the new-town timer and tonight\'s kit sit in a few lines under them, and the page fits on one screen.',
    ],
  },
  {
    id: 'big-buildings-upstairs',
    date: '2026-11-09',
    kind: 'better',
    title: 'Hospitals and schools go upstairs',
    deck: 'Both now have a second floor, and rooms laid out like the real thing.',
    points: [
      'The hospital has a corridor with a nurses\' station, an operating room, exam rooms, imaging, and reception off the lobby. The patient wards are upstairs.',
      'The school has a long hall of lockers with the gym, classrooms, the office and the cafeteria off it. Upstairs there are more classrooms, a science lab and the library.',
      'The stairs are at the end of the main corridor. Walk onto them to go up, and anything chasing you follows.',
    ],
  },
  {
    id: 'fireworks-bus',
    date: '2026-11-09',
    kind: 'new',
    title: 'S.O.S. Fireworks bus',
    deck: 'An old city bus in the downtown car park has been turned into a fireworks stand.',
    points: [
      'Search it to fill your hands with fireworks, then come back for more until it sells out.',
      'Look for its sign and its string of bulbs. It is drawn on the town map, under Places in the key.',
      'The Town Guide has a page for it.',
    ],
  },
  {
    id: 'coop-same-town',
    date: '2026-11-09',
    kind: 'fixed',
    title: 'No more walking through walls in co-op',
    deck: 'A friend on an older copy of the game saw a different town.',
    points: [
      'If you and the host are on different versions, you are told to reload instead of joining.',
      'Joining checks that you built the same town as the host.',
    ],
  },
  {
    id: 'fountain-fireworks',
    date: '2026-11-09',
    kind: 'new',
    title: 'Fountains',
    deck: 'The road flare is now a fountain firework: a cone that sprays gold sparks straight up.',
    points: [
      'Press V to light one. It sprays and hisses for twenty seconds, pulling every zombie in earshot to it.',
      'Any zombie that reaches it catches fire, so a fountain is a lure and a trap at once.',
      'Cars, garages and the police station hide them. The supply drop still comes down on a red flare.',
    ],
  },
  {
    id: 'candy-bag',
    date: '2026-11-09',
    kind: 'new',
    title: 'The candy bag',
    deck: 'Trick-or-treat as hard as you shoot: your bag has no bottom now.',
    points: [
      'Carry as much candy as you can find. No bowl is ever left behind.',
      'Press X, or tap the candy in your backpack, to open your candy bag and pick one to eat.',
      'Every candy has its own picture, its count and what it does.',
      'Eat one that is already working and its time stacks: the boost lasts longer.',
    ],
  },
  {
    id: 'map-art',
    date: '2026-11-09',
    kind: 'better',
    title: 'A town map drawn in pixel art',
    deck: 'Press Tab and the town looks like a town: roofs, signs, trees and parked cars.',
    points: [
      'Every building has a little roof in its colour, with a sign on top: a cross for medicine, a star for the police, a pistol for guns.',
      'The van and the supply drop are drawn as a van and a crate on its parachute.',
      'The key beside the map shows the same pictures, sorted under Your marks, Places, On the way and Left behind.',
    ],
  },
  {
    id: 'town-names',
    date: '2026-11-09',
    kind: 'better',
    title: 'Every town has a name',
    deck: 'No more Level 1, Level 2. The towns are named for their numbers.',
    points: [
      'The run goes Once Home, Two Lake City, Threetropolis, Four Corners, Fiville and on to Tenacity.',
      'The bunker is Zero Point.',
      'The HUD, the town cards, Continue, the Levels page and your records all use the names.',
    ],
  },
  {
    id: 'schools-and-hospitals',
    date: '2026-11-09',
    kind: 'new',
    title: 'Schools and hospitals',
    deck: 'The two biggest buildings in town, and nearly every town has both.',
    points: [
      'The hospital usually stands Downtown: wards along the back, an emergency bay out front, and a medkit there every time. It is the best-guarded building in town.',
      'The school usually sits out in Riverside: classrooms, a library and a long hall of lockers. Most of them are empty, but it hides more candy than any shop.',
      'An ambulance waits outside the hospital, lights going. Both have back doors and look different on the Tab map. The Town Guide has a page for each.',
    ],
  },
  {
    id: 'setup-overlay',
    date: '2026-11-09',
    kind: 'better',
    title: 'Pick from the big cards',
    deck: 'Clicking a Play card now lays its choices across the screen as big portrait cards.',
    points: [
      'Each choice is its own tall card with its name along the bottom and its stat bars under it.',
      'Survivors stand as they look in play and turn when you point at them.',
      'The Play page fits on one screen, with nothing to scroll.',
    ],
  },
  {
    id: 'five-survivors',
    date: '2026-11-09',
    kind: 'better',
    title: 'Room for all five',
    deck: 'A co-op room now holds five players, one for every survivor.',
    points: [
      'Night, Bear, Kat, Rex and Kai can all be out on the same night.',
      'Nobody plays the same survivor twice. Joining with a code tells you who is free if yours is taken.',
      'Find a team only puts you in rooms where your survivor is still free.',
    ],
  },
  {
    id: 'more-cars',
    date: '2026-11-08',
    kind: 'new',
    title: 'Police cars, ambulances and more',
    deck: 'The streets fill up with hatchbacks and pickups in a dozen colours.',
    points: [
      'Police cars and ambulances sit with their lights still flashing red and blue.',
      'A cruiser waits outside the police station, an ambulance outside the clinic.',
      'Search a police car for ammo, an ambulance for medkits.',
    ],
  },
  {
    id: 'halloween-night',
    date: '2026-11-08',
    kind: 'new',
    title: 'It is Halloween night',
    deck: 'The town got ready for trick-or-treaters before the dead came.',
    points: [
      'Houses and apartments wear string lights, carved pumpkins and cobwebs.',
      'Every home has a candy bowl by its front door: search it for a candy.',
    ],
  },
  {
    id: 'setup-titles',
    date: '2026-11-08',
    kind: 'better',
    title: 'Names in lights',
    deck: 'Your picks on the Play page now carry their names like a film title.',
    points: [
      'Each card\'s name stands big over the bottom of its picture.',
      'Your survivor\'s name runs biggest, glowing amber, and changes as you point at others.',
    ],
  },
  {
    id: 'bear-and-kai',
    date: '2026-11-08',
    kind: 'better',
    title: 'Bandus is Bear, Sol is Kai',
    deck: 'Two more survivors have new names.',
    points: [
      'Bear still reloads faster, and Kai still finds more.',
      'Costumes, quests and records carry over as they were.',
    ],
  },
  {
    id: 'setup-stage',
    date: '2026-11-08',
    kind: 'better',
    title: 'Play setup takes the stage',
    deck: 'The Play page has stepped out of its box: the three cards fill the screen.',
    points: [
      'Mode, Difficulty and Survivor stand big on the night scene, as large as the screen allows.',
      'Your callsign and the Back and Start buttons sit centred under them.',
    ],
  },
  {
    id: 'house-stairs-corner',
    date: '2026-11-08',
    kind: 'better',
    title: 'Stairs you just walk onto',
    deck: 'Step on the stairs to go up or down. No key to press.',
    points: [
      'A house\'s stairs stand in its back corner now, out of the way through.',
      'A house with stairs is one open room, with no bedroom wall.',
      'You stay put on the stairs you come out on until you step off.',
    ],
  },
  {
    id: 'queen-is-kat',
    date: '2026-11-08',
    kind: 'better',
    title: 'Queen is now Kat',
    deck: 'The survivor in the tabby cat hood has a new name.',
    points: [
      'Same quick feet: Kat still runs 12% faster.',
      'Costumes, quests and records carry over as they were.',
    ],
  },
  {
    id: 'backpack-desktop',
    date: '2026-11-08',
    kind: 'new',
    title: 'The backpack on a desktop',
    deck: 'Middle-click to open it on yourself, scroll to walk it, click to use.',
    points: [
      'Middle-click opens the ring on your survivor and middle-clicking again closes it. Esc or a click outside closes it too, without opening the pause menu.',
      'While it is open the scroll wheel steps round the ring instead of cycling your guns. Enter uses whatever it lands on, or just click a slot.',
      'You cannot shoot while it is up, but you can still walk: the ring comes with you.',
    ],
  },
  ...EARLIER_NOTES,
];
