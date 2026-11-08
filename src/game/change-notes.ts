// What's new, in the players' own words: the notes the changelog book (changelog.ts) lays out.
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
    id: 'setup-portraits',
    date: '2026-11-08',
    kind: 'better',
    title: 'Taller setup cards',
    deck: 'The three Play cards stand tall now, and your survivor turns on theirs.',
    points: [
      'Mode, Difficulty and Survivor cards share one tall shape, with more night sky over each scene.',
      'Point at an option to see it in its card before you pick it.',
      'The lists show just names and pictures, and open without covering Start.',
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
