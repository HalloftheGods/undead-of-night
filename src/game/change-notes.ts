// What's new, in the players' own words: the notes the changelog book (changelog.ts) lays out.
//
// To add an update, put a new note at the TOP of CHANGE_NOTES. Nothing else needs to change: the book lays the
// notes out two to a page, newest first, and lists them on its front page. Older notes live in change-notes-earlier.ts.

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
    id: 'menu-sections',
    date: '2026-11-08',
    kind: 'better',
    title: 'Main menu in three parts',
    deck: 'Books, Play and Extras now sit side by side, so the whole menu fits under the logo, even on a phone on its side.',
    points: [
      'Play is in the middle: Daily Night, Arcade, Campaign and Levels. The menu still opens on Daily Night.',
      'Books holds How to Play, the Town Guide and Records; Extras holds the Sound Test and Options.',
      'Up and down move within a part; left and right (or A and D) hop to the next one.',
    ],
  },
  {
    id: 'diner-knives',
    date: '2026-11-08',
    kind: 'better',
    title: 'Knives in the kitchen',
    deck: 'Diners now turn up a knife far more often, as a kitchen should.',
    points: [
      'About half the fridges in a diner keep a knife when nothing else is in them.',
      'The Town Guide lists knives as Often at the Diner, and Where to Look now has a line for knives.',
    ],
  },
  {
    id: 'fireworks-spinners',
    date: '2026-11-08',
    kind: 'new',
    title: 'Fireworks',
    deck: 'Fuel is gone. Garages, warehouses and diners hide fireworks now, and T lights one.',
    points: [
      'A lit firework lands where you aim as a ground spinner, a flower of colored sparks whirling on the street for five seconds.',
      'The sparks set alight any zombie that walks through, and you too if you stand in them. The whistle and crackle draw a crowd.',
      'No bottle needed any more. Popping Eyeballs throw the sparks half as far again; the Pocket Lighter keeps them spinning longer.',
    ],
  },
  {
    id: 'team-on-map',
    date: '2026-11-08',
    kind: 'new',
    title: 'Find your team on the map',
    deck: 'In co-op, every teammate shows on the map with a flashing locator in their own colour and their name.',
    points: [
      'Each survivor has a team colour, so no two players look alike. The team chips in the corner wear it too.',
      'Private rooms show callsigns. Public games show survivor names, as always.',
      'A downed teammate says DOWN beside their name, so you know who to run to. With Motion set to Reduced, the locators hold still.',
    ],
  },
  {
    id: 'town-guide',
    date: '2026-11-08',
    kind: 'new',
    title: 'Town Guide',
    deck: 'A new book on the main menu: what every kind of building holds, and where to look for it.',
    points: [
      'A page per place, from the Pharmacy to Cars & Streets, with what turns up there stamped Always, Often, Sometimes or Rare.',
      'Where to Look lists the best places for medkits, each kind of ammo, flares, fuel, candy, gun parts and more.',
      'It reads off the same loot tables the town is stocked from, so it stays true as they change.',
    ],
  },
  {
    id: 'one-screen-setup',
    date: '2026-11-08',
    kind: 'better',
    title: 'Setup on one screen',
    deck: 'Mode, difficulty and survivor now sit side by side, each showing its picture.',
    points: [
      'Tap a picture to open its list, then tap what you want. No more Next, Next, Next.',
      'Callsign and the co-op fields are on the same screen, with Start at the bottom.',
    ],
  },
  {
    id: 'option-switches',
    date: '2026-11-08',
    kind: 'better',
    title: 'Flip switches',
    deck: 'Analytics and haptic feedback on Options are now pixel switches instead of boxed buttons.',
    points: [
      'The knob snaps right and the track goes red when a setting is on.',
      'Screen readers hear them as switches, and Space or Enter flips them.',
    ],
  },
  {
    id: 'candy-timer',
    date: '2026-11-08',
    kind: 'new',
    title: 'Candy timer overhead',
    deck: 'While a candy works, its boost and the seconds left float over your head.',
    points: [
      'A word for what it boosts (SPEED, ARMOR, RELOAD...) and a bar that drains for the whole boost.',
      'It blinks in the last five seconds, so you know it is about to wear off.',
      'In co-op you see your team\'s candy too. Pickup notes float clear of it.',
    ],
  },
  {
    id: 'left-behind-marks',
    date: '2026-11-08',
    kind: 'new',
    title: 'Left behind',
    deck: 'The map marks every building you walked out of with supplies still lying inside.',
    points: [
      'A small mark per kind sits at the building\'s foot: a red cross for medical, yellow rounds for ammo, a grey gun, a violet diamond for parts and finds.',
      'Floors upstairs and in the cellar count toward their house. The mark goes once it is empty.',
      'In co-op the whole team shares the marks, wherever each of you is.',
    ],
  },
  {
    id: 'mode-order',
    date: '2026-11-08',
    kind: 'better',
    title: 'Daily Night up top',
    deck: 'The main menu now reads How to Play, Daily Night, Arcade, then Campaign.',
    points: [
      'How to Play sits on top. The menu still opens pointed at Daily Night, so Enter starts the day\'s night.',
      'The Play setup lists Arcade before Campaign to match.',
    ],
  },
  {
    id: 'press-any-key',
    date: '2026-11-08',
    kind: 'new',
    title: 'Press any key',
    deck: 'The title waits for you: the logo, the night behind it, and one blinking line.',
    points: [
      'Any key, a click, a tap or a gamepad button brings up the main menu.',
      'It asks once a visit. Back from a run, you land right on the menu.',
      'Co-op invite links skip it and go straight to the team. With Motion set to Reduced, the line holds still.',
    ],
  },
  {
    id: 'touch-icons-items',
    date: '2026-11-08',
    kind: 'better',
    title: 'Phone buttons with pictures',
    deck: 'The touch bar shows icons, and bottles, molotovs, flares and candy finally have buttons.',
    points: [
      'Pause, map, next weapon, heal, search, reload and shove each wear a picture instead of a word.',
      'Carry a bottle, fuel, a flare or candy and a button for it appears just over the bar, with how many you have.',
      'Throws go where you are facing: the way you walk, or where your finger last aimed.',
    ],
  },
  {
    id: 'find-a-team',
    date: '2026-11-08',
    kind: 'new',
    title: 'Find a team',
    deck: 'Play online with strangers, or host a private game for friends.',
    points: [
      'Under Multiplayer, Find a team drops you into an open public game near your difficulty, or opens one.',
      'Public games show survivor names only, never callsigns.',
      'Host for friends gives you a room code and an invite link on screen while you wait.',
    ],
  },
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
  ...EARLIER_NOTES,
];
