// The older What's New notes, newest first, carried on after the newest ones in change-notes.ts.
// New notes go at the top of CHANGE_NOTES there, not here.

import type { ChangeNote } from "./change-notes.ts";
import { OLDEST_NOTES } from "./change-notes-oldest.ts";

export const EARLIER_NOTES: readonly ChangeNote[] = [
  {
    id: "more-cars",
    date: "2026-11-08",
    kind: "new",
    title: "Police cars, ambulances and more",
    deck: "The streets fill up with hatchbacks and pickups in a dozen colours.",
    points: [
      "Police cars and ambulances sit with their lights still flashing red and blue.",
      "A cruiser waits outside the police station, an ambulance outside the clinic.",
      "Search a police car for ammo, an ambulance for medkits."
    ]
  },
  {
    id: "halloween-night",
    date: "2026-11-08",
    kind: "new",
    title: "It is Halloween night",
    deck: "The town got ready for trick-or-treaters before the dead came.",
    points: [
      "Houses and apartments wear string lights, carved pumpkins and cobwebs.",
      "Every home has a candy bowl by its front door: search it for a candy."
    ]
  },
  {
    id: "setup-titles",
    date: "2026-11-08",
    kind: "better",
    title: "Names in lights",
    deck: "Your picks on the Play board now carry their names like a film title.",
    points: [
      "Each card's name stands big over the bottom of its picture.",
      "Your survivor's name runs biggest, glowing amber, and changes as you point at others."
    ]
  },
  {
    id: "bear-and-kai",
    date: "2026-11-08",
    kind: "better",
    title: "Bandus is Bear, Sol is Kai",
    deck: "Two more survivors have new names.",
    points: [
      "Bear still reloads faster, and Kai still finds more.",
      "Costumes, quests and records carry over as they were."
    ]
  },
  {
    id: "setup-stage",
    date: "2026-11-08",
    kind: "better",
    title: "Play takes the stage",
    deck: "The Play board has stepped out of its box: the three cards are as big as the room allows.",
    points: [
      "Mode, Difficulty and Survivor stand big on the night scene.",
      "Your callsign and the buttons to go back or start sit centred under them."
    ]
  },
  {
    id: "house-stairs-corner",
    date: "2026-11-08",
    kind: "better",
    title: "Stairs you just walk onto",
    deck: "Step on the stairs to go up or down. Nothing else to do.",
    points: [
      "A house's stairs stand in its back corner now, out of the way.",
      "A house with stairs is one open room, with no bedroom wall.",
      "You stay put on the stairs you come out on until you step off."
    ]
  },
  {
    id: "queen-is-kat",
    date: "2026-11-08",
    kind: "better",
    title: "Queen is now Kat",
    deck: "The survivor in the tabby cat hood has a new name.",
    points: [
      "Same quick feet: Kat still runs 12% faster.",
      "Costumes, quests and records carry over as they were."
    ]
  },
  {
    id: "backpack-desktop",
    date: "2026-11-08",
    kind: "new",
    title: "The backpack, close at hand",
    deck: "Call up your gear on yourself, spin through it and use what you land on.",
    points: [
      "Open the ring of gear around your survivor, and close it again when you are done. Step away from it and it closes too.",
      "While it is open, you spin round the ring instead of cycling your guns, then use whatever you land on.",
      "You cannot shoot while it is up, but you can still walk: the ring comes with you."
    ]
  },
  {
    id: "hud-reorder",
    date: "2026-11-08",
    kind: "better",
    title: "A view you can read at a glance",
    deck: "Health, kills and points down the right, and the guns dead centre.",
    points: [
      "Health leads the top-right corner, with the kill count beneath it behind a zombie head, and points under that.",
      "The gun bar sits in the middle at the foot of your view, and each gun is one touch away.",
      "The run log moved to the right edge, halfway down, clear of both."
    ]
  },
  {
    id: "backpack-ring",
    date: "2026-11-08",
    kind: "better",
    title: "The backpack opens on you",
    deck: "Your own gear, rung around the survivor, following them as you move.",
    points: [
      "The ring shows what you are actually carrying: the medkit, the gun you would switch to, bottles, fireworks, flares, your candy and the town map.",
      "It opens on the survivor and keeps up with them, and it closes the moment you pick something.",
      "What would do nothing is greyed out: a medkit at full health, a candy already working."
    ]
  },
  {
    id: "sprint-button",
    date: "2026-11-08",
    kind: "new",
    title: "A Sprint button",
    deck: "Four buttons in the corner, with Sprint right under the thumb.",
    points: [
      "Hold Sprint to run, the same as breaking into a dash.",
      "Search, Shove, Sprint and the backpack sit two by two in the bottom-right corner."
    ]
  },
  {
    id: "streak-kit",
    date: "2026-11-08",
    kind: "new",
    title: "Streak kit",
    deck: "Come back night after night and your runs start better armed.",
    points: [
      "Play the Nightly Run on days in a row: night 2 starts you with a medkit and spare rounds, then a knife, a shotgun, a Jawbreaker and, by night 7, a carbine.",
      "The Nightly Run board shows tonight's kit and what tomorrow adds. Each run names its kit on the first title card.",
      "Solo Arcade runs get the kit too. Campaign and team games start as before. Miss a day and the streak starts again."
    ]
  },
  {
    id: "setup-portraits",
    date: "2026-11-08",
    kind: "better",
    title: "Taller setup cards",
    deck: "The three Play cards stand tall now, with stat bars on every option.",
    points: [
      "Mode, Difficulty and Survivor cards share one tall shape, with more night sky over each scene.",
      "Each option shows its bars: players for a mode, ammo and zombie speed, bite and horde for a difficulty, and each survivor's strengths.",
      "Survivors appear as they look in the field, turning when you point at one. Point at any option to see it in its card."
    ]
  },
  {
    id: "menu-details-switch",
    date: "2026-11-08",
    kind: "better",
    title: "A cleaner board",
    deck: "The board shows just the names now. The line under each one can be switched back on in Options.",
    points: [
      "Turn on the details in Options to bring back a line saying what each item opens.",
      "On a small display, like a phone on its side, the lines stay hidden either way so everything fits."
    ]
  },
  {
    id: "menu-sections",
    date: "2026-11-08",
    kind: "better",
    title: "The board in three parts",
    deck: "Books, Play and Extras now sit side by side, so everything fits under the logo, even on a phone on its side.",
    points: [
      "Play is in the middle: Nightly Run, Arcade, Campaign and Level Select. The board still opens on Nightly Run.",
      "Books holds How to Play, the Town Guide and Records. Extras holds the Sound Test and Options.",
      "Move up and down within a part, and sideways to hop to the next one."
    ]
  },
  {
    id: "diner-knives",
    date: "2026-11-08",
    kind: "better",
    title: "Knives in the kitchen",
    deck: "Diners now turn up a knife far more often, as a kitchen should.",
    points: [
      "About half the fridges in a diner keep a knife when nothing else is in them.",
      "The Town Guide lists knives as Often at the Diner, and Where to Look now has a line for knives."
    ]
  },
  {
    id: "fireworks-spinners",
    date: "2026-11-08",
    kind: "new",
    title: "Fireworks",
    deck: "Fuel is gone. Garages, warehouses and diners hide fireworks now, and you can light one.",
    points: [
      "A lit firework lands where you aim as a ground spinner, a flower of coloured sparks whirling on the street for a few moments.",
      "The sparks set alight any zombie that walks through, and you too if you stand in them. The whistle and crackle draw a crowd.",
      "No bottle needed any more. Popping Eyeballs throw the sparks half as far again, and the Pocket Lighter keeps them spinning longer."
    ]
  },
  {
    id: "team-on-map",
    date: "2026-11-08",
    kind: "new",
    title: "Find your team on the map",
    deck: "Every teammate shows on the map with a flashing marker in their own colour and their name.",
    points: [
      "Each survivor has a team colour, so no two players look alike.",
      "Private games show callsigns. Public games show survivor names, as always.",
      "A downed teammate is marked DOWN beside their name, so you know who to run to. For gentler eyes, the markers hold still."
    ]
  },
  {
    id: "town-guide",
    date: "2026-11-08",
    kind: "new",
    title: "Town Guide",
    deck: "A new book on the shelf: what every kind of building holds, and where to look for it.",
    points: [
      "A page for each place, from the Pharmacy to Cars & Streets, with what turns up there stamped Always, Often, Sometimes or Rare.",
      "Where to Look lists the best places for medkits, each kind of ammo, flares, fuel, candy, gun parts and more.",
      "It reads off the same lists the town is stocked from, so it stays true as they change."
    ]
  },
  {
    id: "one-screen-setup",
    date: "2026-11-08",
    kind: "better",
    title: "Setup in one glance",
    deck: "Mode, difficulty and survivor now sit side by side, each showing its picture.",
    points: [
      "Pick a picture to open its list, then choose what you want. No more Next, Next, Next.",
      "Callsign and the team fields are on the same board, with Start at the bottom."
    ]
  },
  {
    id: "option-switches",
    date: "2026-11-08",
    kind: "better",
    title: "Flip switches",
    deck: "Analytics and haptic feedback in Options are now little switches instead of boxed buttons.",
    points: [
      "The knob snaps right and the track goes red when a setting is on.",
      "Anyone listening rather than looking hears them called switches, and they flip with a touch."
    ]
  },
  {
    id: "candy-timer",
    date: "2026-11-08",
    kind: "new",
    title: "Candy timer overhead",
    deck: "While a candy works, its boost and the time left float over your head.",
    points: [
      "A word for what it boosts (SPEED, ARMOR, RELOAD...) and a bar that drains for the whole boost.",
      "It blinks near the end, so you know it is about to wear off.",
      "In a team you see your friends' candy too. Pickup notes float clear of it."
    ]
  },
  {
    id: "left-behind-marks",
    date: "2026-11-08",
    kind: "new",
    title: "Left behind",
    deck: "The map marks every building you walked out of with supplies still lying inside.",
    points: [
      "A small mark per kind sits at the building's foot: a red cross for medical, yellow rounds for ammo, a grey gun, a violet diamond for Other Loot.",
      "Floors upstairs and in the cellar count toward their house. The mark goes once it is empty.",
      "In a team the whole crew shares the marks, wherever each of you is."
    ]
  },
  {
    id: "mode-order",
    date: "2026-11-08",
    kind: "better",
    title: "Nightly Run up top",
    deck: "The board now reads How to Play, Nightly Run, Arcade, then Campaign.",
    points: [
      "How to Play sits on top. The board still opens pointed at Nightly Run, so starting it begins the day's night.",
      "The Play board lists Arcade before Campaign to match."
    ]
  },
  {
    id: "press-any-key",
    date: "2026-11-08",
    kind: "new",
    title: "Step up to the sign",
    deck: "The town waits for you: the logo, the night behind it, and one blinking line.",
    points: [
      "Any touch, click or button brings up the board of choices.",
      "It asks once a visit. Back from a run, you land right on the board.",
      "Invite links skip it and go straight to the team. For gentler eyes, the blinking line holds still."
    ]
  },
  {
    id: "touch-icons-items",
    date: "2026-11-08",
    kind: "better",
    title: "Phone buttons with pictures",
    deck: "The phone bar shows pictures, and bottles, molotovs, flares and candy finally have buttons.",
    points: [
      "Pause, map, next weapon, heal, search, reload and shove each wear a picture instead of a word.",
      "Carry a bottle, fuel, a flare or candy and a button for it appears just over the bar, with how many you have.",
      "Throws go where you are facing: the way you walk, or where your finger last aimed."
    ]
  },
  {
    id: "find-a-team",
    date: "2026-11-08",
    kind: "new",
    title: "Find a team",
    deck: "Play with strangers, or open a private game for friends.",
    points: [
      "Under Multiplayer, Find a team drops you into an open game near your difficulty, or starts one.",
      "Open games show survivor names only, never callsigns.",
      "Opening a game for friends gives you a code and an invite link while you wait."
    ]
  },
  {
    id: "smooth-hordes",
    date: "2026-11-07",
    kind: "better",
    title: "Smoother big hordes",
    deck: "A full horde runs easier on slower computers and phones.",
    points: [
      "Score pop-ups and bloodstains cost far less to draw.",
      "When things start to stutter, the game trims spare sparks and small flashes of light first.",
      "If that is not enough, the lighting eases off until the fight thins out."
    ]
  },
  {
    id: "motion-setting",
    date: "2026-11-07",
    kind: "new",
    title: "Choose your motion",
    deck: "Options has a Motion setting, and a dial for how much the view shakes.",
    points: [
      "System follows your device, as before. Full plays every animation, the van ride too, whatever your device says.",
      "Reduced calms things down: no big flashes, still scene changes, and only a nudge of shake.",
      "Shake goes from none to full, so you can keep the motion and lose the wobble."
    ]
  },
  {
    id: "readable-pickup-text",
    date: "2026-11-07",
    kind: "better",
    title: "Pickup words you can read",
    deck: "The little words over your head no longer pile on top of each other.",
    points: [
      "Grab several things at once and each word gets its own line, newest at the bottom.",
      "Grab the same thing twice and the numbers add up: two boxes of shells read +8 SHELLS.",
      "Words hold still for a moment once they rise, then fade out instead of blinking away."
    ]
  },
  {
    id: "combat-feel",
    date: "2026-11-07",
    kind: "better",
    title: "Fights hit harder",
    deck: "You can hear a brute coming, and a boss going down feels like it.",
    points: [
      "Brutes and bosses stomp as they walk, so you hear a big one before you see it.",
      "Every gun reloads its own way: the pistol slide snaps, the carbine racks, the shotgun loads shell by shell.",
      "When you are badly hurt the red at the edge of your sight beats with your heart, and the world goes muffled.",
      "A boss kill freezes the moment with a flash and the biggest shake in the game. For gentler eyes, it stays calm."
    ]
  },
  {
    id: "faster-first-load",
    date: "2026-11-07",
    kind: "better",
    title: "A faster start",
    deck: "The game gets to the sign over the town sooner.",
    points: [
      "The books, the jukebox and the ending arrive quietly in the background once the sign is up.",
      "Team games are only prepared when you start or join one."
    ]
  },
  {
    id: "setup-stepper-thumbs",
    date: "2026-11-07",
    kind: "better",
    title: "Setup shows your picks",
    deck: "Each choice you finish shows a little picture of what you chose.",
    points: [
      "Your style, mode and difficulty sit in a row as small pictures. Pick one to go back and change it."
    ]
  },
  {
    id: "sound-color-size-options",
    date: "2026-11-07",
    kind: "better",
    title: "Options for your ears and eyes",
    deck: "Set music and sound effects apart, pick colorblind hit colours and make the lettering bigger.",
    points: [
      "Music and Sound effects each get their own dial under Volume.",
      "Hit colours: Colorblind swaps red and green for magenta and blue on health bars and callouts.",
      "Large and Larger make the lettering easier to read on a phone."
    ]
  },
  {
    id: "apartment-floors",
    date: "2026-11-07",
    kind: "new",
    title: "Apartments go up a floor",
    deck: "Every apartment block has a second floor now.",
    points: [
      "The stairs are at the east end of the lobby, just inside the front.",
      "Upstairs are two more flats off the same hall, with beds, fridges and lockers to search.",
      "Zombies follow you up, the same as in a house."
    ]
  },
  {
    id: "grounded-cacti",
    date: "2026-11-07",
    kind: "fixed",
    title: "Cacti touch the ground",
    deck: "Desert saguaros no longer hover above their own shadows.",
    points: ["Each cactus now stands right on its shadow instead of floating just above it."]
  },
  {
    id: "floors",
    date: "2026-11-07",
    kind: "new",
    title: "Upstairs and cellars",
    deck: "Some houses go up a floor, and some go down one.",
    points: [
      "About half the houses have stairs in the kitchen: up to two bedrooms, or down to a cellar.",
      "Stand on the stairs and use them to go up or down.",
      "Zombies on your heels follow you up and down. A shot upstairs is heard around the house below.",
      "Bedrooms hide the most candy. Cellars keep first aid, and the odd knife."
    ]
  },
  {
    id: "merchants",
    date: "2026-11-07",
    kind: "better",
    title: "The bunker merchants, redrawn",
    deck: "Mags, Sarge, Doc and Cinder finally look like they belong.",
    points: [
      "All four stallholders are drawn the same way as the survivors: same build, outline and lighting.",
      "Their portraits in How to Play now stand as tall as the survivors’."
    ]
  },
  {
    id: "run-log",
    date: "2026-11-07",
    kind: "new",
    title: "The run log",
    deck: "Missed a callout? It’s written down.",
    points: [
      "Every callout, banner, pickup and teammate going down is logged with the run’s clock.",
      "The last few lines sit in the bottom-right corner. Open it to read the whole log.",
      "Tabs for Fights, Loot, Night and Team. The night goes on while you read.",
      "Your gun bar has moved to the bottom centre to make room."
    ]
  },
  ...OLDEST_NOTES
];
