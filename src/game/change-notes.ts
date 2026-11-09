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
      'A full bag leaves the bowl where it is for the next survivor.',
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
  {
    id: 'hud-reorder',
    date: '2026-11-08',
    kind: 'better',
    title: 'A HUD you can read at a glance',
    deck: 'Health, kills and points down the right; the guns dead centre and tappable.',
    points: [
      'Health leads the top-right corner, with the kill count under it behind a zombie head, and points under that.',
      'The gun bar sits in the middle of the foot of the screen at every width, and each slot is a button: tap it to bring that gun up.',
      'The run log moved to the right edge, halfway down, clear of both.',
    ],
  },
  {
    id: 'backpack-ring',
    date: '2026-11-08',
    kind: 'better',
    title: 'The backpack opens on you',
    deck: 'Your own gear, rung around the survivor, following them as you move.',
    points: [
      'The ring shows what you are actually carrying, drawn as the game draws it: the medkit, the gun you would switch to, bottles, fireworks, flares, your candy and the town map.',
      'It opens on the survivor and keeps up with them, and it closes the moment you pick something.',
      'What would do nothing is greyed out: a medkit at full health, a candy already working.',
    ],
  },
  {
    id: 'sprint-button',
    date: '2026-11-08',
    kind: 'new',
    title: 'A Sprint button',
    deck: 'Four pixel buttons in the corner, Sprint under the thumb.',
    points: [
      'Hold Sprint to run, the same as holding Shift on a keyboard.',
      'Search, Shove, Sprint and the backpack sit two by two in the bottom-right corner, in the game\'s own pixel style.',
    ],
  },
  {
    id: 'streak-kit',
    date: '2026-11-08',
    kind: 'new',
    title: 'Streak kit',
    deck: 'Come back night after night and your runs start better armed.',
    points: [
      'Play the Daily Night on days in a row: night 2 starts you with a medkit and spare rounds, then a knife, a shotgun, a Jawbreaker and, by night 7, a carbine.',
      'The Daily Night page shows tonight\'s kit and what tomorrow adds. Each run says its kit on the first title card.',
      'Solo Arcade runs get the kit too. Campaign and co-op start as before. Miss a day and the streak starts again.',
    ],
  },
  {
    id: 'setup-portraits',
    date: '2026-11-08',
    kind: 'better',
    title: 'Taller setup cards',
    deck: 'The three Play cards stand tall now, with stat bars on every option.',
    points: [
      'Mode, Difficulty and Survivor cards share one tall shape, with more night sky over each scene.',
      'Each option shows its bars: players for a mode, ammo and zombie speed, bite and horde for a difficulty, and each survivor\'s stats.',
      'The survivor list shows them as they look in play, turning when you point at one. Point at any option to see it in its card.',
    ],
  },
  {
    id: 'menu-details-switch',
    date: '2026-11-08',
    kind: 'better',
    title: 'A cleaner main menu',
    deck: 'The main menu shows just the names now. The line under each one is a switch in Options.',
    points: [
      'Turn on Menu details under Options to bring back a line saying what each item opens.',
      'On a short screen, like a phone on its side, the lines stay hidden either way so the menu fits.',
    ],
  },
  {
    id: 'menu-sections',
    date: '2026-11-08',
    kind: 'better',
    title: 'Main menu in three parts',
    deck: 'Books, Play and Extras now sit side by side, so the whole menu fits under the logo, even on a phone on its side.',
    points: [
      'Play is in the middle: Daily Night, Arcade, Campaign and Level Select. The menu still opens on Daily Night.',
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
