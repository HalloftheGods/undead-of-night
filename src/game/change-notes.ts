// Noise in the Night: the notes the daily newspaper (changelog.ts) lays out.
//
// To add an update, put a new note at the TOP of CHANGE_NOTES. Each ship day becomes an issue numbered like
// the game version (e.g. 2026-11-07 -> Issue 26.11.7). The day's first note leads the issue front page, and the rest
// run as stories inside. Older notes live in change-notes-earlier.ts, and the oldest of all in change-notes-oldest.ts.

import { EARLIER_NOTES } from "./change-notes-earlier.ts";

export type ChangeKind = "new" | "better" | "fixed";

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
    id: "toss-where-you-aim",
    date: "2026-11-15",
    kind: "new",
    title: "Toss it where you aim",
    deck: "Survivors can now throw anything from their bag to wherever they are pointing.",
    points: [
      "A thrown item sails a short way and stops at the first wall, and a faint mark shows where it will land.",
      "If the toss goes wrong, the item comes straight back to the hand that threw it."
    ]
  },
  {
    id: "patch-up-a-teammate",
    date: "2026-11-15",
    kind: "new",
    title: "Patch up a teammate",
    deck: "A survivor can now feed, water or bandage a friend standing right beside them.",
    points: [
      "Food and water take a moment. A bandage or a medkit takes a little longer, and a hit breaks the work off.",
      "The two of you talk it through as it happens, and a friend who is ailing carries their worst trouble over their head."
    ]
  },
  {
    id: "candy-bag-dozen",
    date: "2026-11-15",
    kind: "better",
    title: "A dozen pieces of candy",
    deck: "The candy bag now holds twelve pieces and is always on hand.",
    points: [
      "Candy settles into the bag from the bottom up, and a full bag leaves the rest in the bowl.",
      "Reach in, pick a piece and eat it. Every survivor can do it with whatever is in reach."
    ]
  },
  {
    id: "candy-finds-its-bag",
    date: "2026-11-15",
    kind: "fixed",
    title: "Candy finds its bag",
    deck: "Candy set down in the pack no longer goes missing.",
    points: [
      "It goes into the candy bag instead. If the bag is full, the candy stays in your hand.",
      "Grabbing a whole bowl no longer spills candy into the backpack when the bag is full."
    ]
  },
  {
    id: "floor-ammo-count",
    date: "2026-11-15",
    kind: "fixed",
    title: "Counting the ammo on the floor",
    deck: "Ammo boxes nobody ever set down are no longer counted.",
    points: [
      "Only the boxes actually lying on the floor count toward what a room holds."
    ]
  },
  {
    id: "containers-zoom-out",
    date: "2026-11-14",
    kind: "better",
    title: "Containers lift out of the street",
    deck: "A container you search now rises up from where it stands, so you can see inside.",
    points: [
      "The one you are searching is outlined where it sits, and it settles back into place when you are done.",
      "For anyone who finds motion hard on the eyes, it simply opens."
    ]
  },
  {
    id: "shoot-with-bag-open",
    date: "2026-11-14",
    kind: "better",
    title: "Keep shooting with the bag open",
    deck: "Survivors can dig through their bag and still fight back.",
    points: [
      "Aim, shoot, shove, reload and change guns while you rummage. Only the item in your hand stays put.",
      "Holding something? Reloading turns it over instead. Move and fire as you always did."
    ]
  },
  {
    id: "drop-anything",
    date: "2026-11-14",
    kind: "new",
    title: "Drop anything, and say a word about it",
    deck: "Bottles, fireworks and boxes of rounds can be set down like everything else.",
    points: [
      "Each lies where you left it, looking like itself, and a box of rounds keeps its rounds.",
      "Survivors speak up in their own voice when they pick something up or put it down. The run log keeps every drop and pickup."
    ]
  },
  {
    id: "pickups-fly-into-bag",
    date: "2026-11-14",
    kind: "better",
    title: "Pickups fly into the bag",
    deck: "Whatever you grab lands in your bag at once.",
    points: [
      "A pickup leaps from where it lay into its place in the bag and lands with a flash of light. For gentler eyes, the flash stays and the flight goes."
    ]
  },
  {
    id: "survivors-weigh-in",
    date: "2026-11-14",
    kind: "new",
    title: "Survivors weigh in",
    deck: "Hold an item up to a survivor and they tell you what they think of it.",
    points: [
      "Night broods, Bear wants food, Kat is a cat, Rex roars, and Rich puts it on his tab.",
      "A green glow means they need it, white means they would take it, amber means it would be wasted and grey means they cannot use it."
    ]
  },
  {
    id: "undead-of-night-take-one",
    date: "2026-11-14",
    kind: "better",
    title: "Undead of Night: Take One",
    deck: "The game wears a new subtitle, like the sign on a candy bowl.",
    points: [
      "Take One replaces Last Round on the sign over the town, on the cards survivors share and on the credits."
    ]
  },
  {
    id: "controller-lock-on",
    date: "2026-11-13",
    kind: "new",
    title: "Lock on and close the ring",
    deck: "Survivors with a gamepad can pick out a single zombie and a ring closes on its head.",
    points: [
      "Fire as the ring closes for a headshot, or sooner for a chest shot. Single-pellet guns only.",
      "A run of headshots now pays more on the one that finishes it, up to triple."
    ]
  },
  {
    id: "outdoor-camp",
    date: "2026-11-13",
    kind: "better",
    title: "Home is a camp the horde breaks into",
    deck: "The bunker is now a camp in the woods, inside a scrap fence under a clear night sky.",
    points: [
      "The market, workshop and quarters are three big tents you walk into. Their walls stop shots and sight; the fence does not.",
      "The camp grows with each town you reach. At the last warning the fence sections that will give begin to rattle, and then the horde comes through the gaps."
    ]
  },
  {
    id: "ten-towns-new-names",
    date: "2026-11-13",
    kind: "better",
    title: "Ten towns, ten new names",
    deck: "Every town has a new name, from One Lake City to Tenver.",
    points: [
      "The road runs through One Lake City, Twoport, Three Suns, Fourkatello, Phivenix, Sixinnati, Sevannah, Eightlanta, Nine Vegas and Tenver."
    ]
  },
  {
    id: "ammo-boxes-in-bag",
    date: "2026-11-13",
    kind: "new",
    title: "Spare rounds come in boxes",
    deck: "Spare ammo is now carried in boxes, one for each magazine's worth.",
    points: [
      "A pistol box holds 12, a carbine box 30 and a shotgun box 6, with the last box holding whatever is left.",
      "Load straight from a box in hand. If the bag has no room for another box, the ammo stays on the floor."
    ]
  },
  {
    id: "use-it-now",
    date: "2026-11-13",
    kind: "better",
    title: "Use it now, hear it now",
    deck: "Using or dropping something from the bag happens at once.",
    points: [
      "It leaves your hands straight away, and every supply has its own sound: candy crunches, drinks glug, a medkit heals."
    ]
  },
  {
    id: "cars-turn-like-cars",
    date: "2026-11-12",
    kind: "better",
    title: "Cars that turn like cars",
    deck: "Driving now feels like it does from the driver's seat, and a turning car swings smoothly through every angle.",
    points: [
      "Gas goes forward, the brake slows you and then backs you up. Steer left or right as a driver would, so a car heading toward you turns to your left when you steer right.",
      "A car only steers while it rolls, and backing up swings the nose the other way, just like the real thing.",
      "Between the four straight-on views, cars are seen at every angle, with police and ambulance lights turning along.",
      "Cars are loud. A rolling engine carries farther than a shotgun blast and roars louder the faster you go, so expect company."
    ]
  },
  {
    id: "behind-the-wheel",
    date: "2026-11-12",
    kind: "new",
    title: "Behind the wheel",
    deck: "Cars parked along the streets and in the garages can now be boarded and driven.",
    points: [
      "Climb into the driver's seat of any open car. Linger at the door instead, and you can search the trunk.",
      "Give it gas to roll, hit the brake to stop and back up, and steer left and right.",
      "Once the car has nearly stopped, step out onto the street on the nearest open side."
    ]
  },
  {
    id: "roadkill-and-horns",
    date: "2026-11-12",
    kind: "new",
    title: "Roadkill, horns and crunching metal",
    deck: "Plow through the wandering dead, lean on the horn and listen to the engine.",
    points: [
      "A rolling car crushes walking corpses on impact and shoves stragglers out of its lane.",
      "The horn carries farther than any gun and pulls every zombie in earshot toward your bumper.",
      "Rumbling engines, squealing tires, slamming doors and violent crashes bring the street alive."
    ]
  },
  {
    id: "garage-rollout",
    date: "2026-11-12",
    kind: "better",
    title: "Backing out of the garage",
    deck: "Cars inside the Auto Garages can now back straight out through the bay doors.",
    points: [
      "Roll up the garage door and take the wheel of the sedan inside.",
      "Reverse straight out into the alley without catching on the doorframe or the tool racks."
    ]
  },
  {
    id: "smooth-turns",
    date: "2026-11-12",
    kind: "better",
    title: "Thirty-two angles round the circle",
    deck: "Cars sweep smoothly through every angle as they turn.",
    points: [
      "Sedans, hatchbacks, pickups and police cruisers all swing from their sides to their roofs as they come round.",
      "Headlights and the emergency lights on the roof sweep with the nose of the car."
    ]
  },
  {
    id: "test-drive-mode",
    date: "2026-11-12",
    kind: "new",
    title: "A test drive for the curious",
    deck: "Take any car in town for an open spin before the night begins.",
    points: [
      "The test drive puts you on an empty road with every car unlocked and ready to roll.",
      "A small gauge shows how fast you are going, which way you face, the state of the body and your last crash."
    ]
  },
  {
    id: "grid-bag",
    date: "2026-11-11",
    kind: "new",
    title: "The bag, square by square",
    deck: "Open your bag and every item takes the room it should.",
    points: [
      "Items have sizes: a fountain and a water bottle take two squares, a plank takes four, and long things lie end to end.",
      "Guns are worn at the side of the bag. The pack sets the room: Satchel 5 by 4, Duffel 6 by 5, ALICE 8 by 6.",
      "Shuffle things around as you like. Your arrangement is yours alone."
    ]
  },
  {
    id: "loot-window",
    date: "2026-11-11",
    kind: "better",
    title: "Loot waits in the box",
    deck: "A search no longer spills its finds at your feet.",
    points: [
      "What a container holds stays in it until you take it.",
      "You see the container beside your bag and move across whatever fits.",
      "A firework, fountain or bottle taken from a container is counted once."
    ]
  },
  {
    id: "doors-boards",
    date: "2026-11-11",
    kind: "new",
    title: "Doors that shut and doors that hold",
    deck: "Survivors can now work doors, and the dead know a closed one when they meet it.",
    points: [
      "Close a door behind you, and open a closed one with a tap of the hand.",
      "Linger with planks, nails and a hammer to board it up. Sneak up and linger to pry a board back off.",
      "A closed door stops you, your shots and their eyes. Zombies bash at them, and a breaking door is loud."
    ]
  },
  {
    id: "material-chips",
    date: "2026-11-11",
    kind: "new",
    title: "Building materials, counted",
    deck: "What you carry for building shows beside your items.",
    points: [
      "Planks, nails and curtain sheets show with a count. A hammer or a crowbar shows once you have one.",
      "Carry nothing and nothing shows. The Town Guide now lists planks, nails, hammers, crowbars and curtain sheets, and where to find them."
    ]
  },
  {
    id: "redrawn-icons",
    date: "2026-11-11",
    kind: "better",
    title: "Better pictures",
    deck: "Survival badges, tools and a dumpster have all been redrawn.",
    points: [
      "The badges for hunger, thirst and the rest now match the pickups, and How to Play shows each one.",
      "The knife, hammer, crowbar and plank lie on the diagonal. Long items stretch the full length of their place in the bag.",
      "A dumpster you have searched stands open and empty, its leavings on the ground."
    ]
  },
  {
    id: "left-behind-on-map",
    date: "2026-11-11",
    kind: "better",
    title: "What you left behind, on the map",
    deck: "Items left in searched containers are marked on your town map.",
    points: [
      "Leave something in a container, indoors or out, and it is stamped on the map.",
      "Use the map to find your way back to what did not fit in the bag."
    ]
  },
  {
    id: "small-fixes-nov-11",
    date: "2026-11-11",
    kind: "fixed",
    title: "Small repairs around town",
    deck: "A steadier sign over the town, a tidier jukebox and badges that stay out of the way.",
    points: [
      "The list under the logo no longer shifts just as you reach for it.",
      "The Sound Test and its finds are no longer squeezed by oversized buttons.",
      "On a phone, survival badges sit in the top-left with your items."
    ]
  },
  {
    id: "dumpsters-and-clues",
    date: "2026-11-10",
    kind: "new",
    title: "Dumpsters and map clues",
    deck: "Alley dumpsters can be searched, and empty searches can turn up marked caches.",
    points: [
      "Search outdoor dumpsters for a chance at spare ammo, weapons, medical gear or candy.",
      "An empty search can turn up a scrawled map note, and a glowing ring on your map circles an untouched cache.",
      "Emergency vehicles hold better finds: shotguns or carbines in police cruisers, and medical supplies in ambulances."
    ]
  },
  {
    id: "sewer-tunnels",
    date: "2026-11-10",
    kind: "new",
    title: "Underground in the sewers",
    deck: "Pry open a street manhole and slip into a maze of brick tunnels beneath the town.",
    points: [
      "Climb down through an open manhole into the sewer maze, or back up to the street.",
      "Underground, sludge canals slow your steps and the town above shows only dimly on your map.",
      "The streets above are laid out on a numbered grid, and a street sign tells you where you stand."
    ]
  },
  {
    id: "survival-moodles",
    date: "2026-11-10",
    kind: "new",
    title: "Hunger, thirst and the long night",
    deck: "Survivors now have to manage hunger, thirst, tiredness and pain with food, clean water and medicine.",
    points: [
      "Little badges warn you when hunger, thirst, exhaustion or infection take hold.",
      "Scavenge canned food, can openers, water bottles, disinfectant and antibiotics to stay alive.",
      "Board up windows and doors with wooden planks, nails and a hammer to hold back the dead."
    ]
  },
  {
    id: "salvage-press",
    date: "2026-11-10",
    kind: "new",
    title: "Salvage for the bunker press",
    deck: "Haul scrap metal and parts back from town to feed the workshop press.",
    points: [
      "Search containers in town for scrap metal, electronics and materials to carry home.",
      "You can carry as much salvage as you find, but anything dropped in town stays there.",
      "The workshop press in the bunker turns your salvage into supplies."
    ]
  },
  {
    id: "knife-cooldown",
    date: "2026-11-10",
    kind: "better",
    title: "Sharper knives and quicker stabs",
    deck: "A combat knife now strikes quicker than a bare hand and has a sharper look.",
    points: [
      "Stabs come faster, one swing right after the next.",
      "Reloading now leaves spent magazines on the pavement, like casings.",
      "On a solo run, a survivor can stop the clock to catch their breath."
    ]
  },
  {
    id: "page-turns",
    date: "2026-11-10",
    kind: "better",
    title: "Turning the pages",
    deck: "The books in the bunker now have real pages that turn.",
    points: [
      "What's New, the Town Guide, How to Play and Records all turn like a magazine.",
      "On a wide display they open as a two-page spread. On a phone they read one page at a time.",
      "The jukebox in the bunker now plays the same song for everyone listening."
    ]
  },
  {
    id: "pumpkin-eyes",
    date: "2026-11-09",
    kind: "better",
    title: "Eyes on the step",
    deck: "Jack-o'-lanterns and candy pails burn their eyes only in the dark.",
    points: [
      "Outside the beam of a flashlight, a doorstep pumpkin looks just like a lurking zombie.",
      "A candy bowl keeps its twin glow until it is searched."
    ]
  },
  {
    id: "dry-gun-call",
    date: "2026-11-09",
    kind: "better",
    title: "Click. Now what?",
    deck: "An empty magazine flashes the next move right over your head.",
    points: [
      "Reload! when there are spares for the gun in hand.",
      "Out of rounds for it? You see the name of a gun that still fires, like pistol.",
      "Every gun dry? Shove, or stab if you carry a knife."
    ]
  },
  {
    id: "phone-tab-bar",
    date: "2026-11-09",
    kind: "better",
    title: "A bar for thumbs",
    deck: "On a phone, the actions sit in one bar along the bottom.",
    points: [
      "Pause, pack, search, shove and sprint, each with its picture and its name.",
      "Hold the phone on its side and the bar slims down so you can see more of the street.",
      "The swipe moves are drawn bigger now, and by hand."
    ]
  },
  {
    id: "roaming-merchants",
    date: "2026-11-09",
    kind: "new",
    title: "The merchants leave their desks",
    deck: "Mags, Sarge, Doc and Cinder now walk the bunker, and they fight when the blast door goes.",
    points: [
      "Walk up to a merchant anywhere in the bunker and they stop to trade.",
      "The break-in horde is three to four times a town horde. The merchants shoot back beside you.",
      "A merchant the horde puts down gets back up once it is over."
    ]
  },
  {
    id: "fireballs",
    date: "2026-11-09",
    kind: "new",
    title: "Fireballs",
    deck: "A new candy for the bag, red-hot and cinnamon.",
    points: [
      "While the Fireball burns, every shot is a flame round that sets zombies alight, whatever your gun is fitted with.",
      "Eat more to keep the fire going longer. Fire is loud, so expect company."
    ]
  },
  {
    id: "candy-bag-cards",
    date: "2026-11-09",
    kind: "better",
    title: "Candy on the big cards",
    deck: "The candy bag now looks as grand as the rest of the posters.",
    points: [
      "Every candy you carry is a tall card with its picture big and its name along the bottom.",
      "Each name is lettered like its own wrapper, in its own colours.",
      "Point at one to read what it does, in big plain words, and how long it lasts."
    ]
  },
  {
    id: "level-select-stage",
    date: "2026-11-09",
    kind: "better",
    title: "The towns on tall cards",
    deck: "Ten tall cards, one for every town, now stand out on the night scene.",
    points: [
      "Each card shows the town with its name in big letters. Towns you have not reached stay grey.",
      "Point at a card to see its story line and the threat bars beneath, all on one board."
    ]
  },
  {
    id: "daily-stage",
    date: "2026-11-09",
    kind: "better",
    title: "Nightly Run takes the stage",
    deck: "The Nightly Run now looks like the Arcade and Campaign boards: three big cards on the night scene.",
    points: [
      "Tonight's town and difficulty stand beside your survivor. Point at the survivor to pick from the big cards.",
      "Your run, the streak, the wait for the next town and tonight's kit sit in a few lines under them."
    ]
  },
  {
    id: "big-buildings-upstairs",
    date: "2026-11-09",
    kind: "better",
    title: "Hospitals and schools go upstairs",
    deck: "Both now have a second floor, and rooms laid out like the real thing.",
    points: [
      "The hospital has a corridor with a nurses' station, an operating room, exam rooms, imaging, and reception off the lobby. The patient wards are upstairs.",
      "The school has a long hall of lockers with the gym, classrooms, the office and the cafeteria off it. Upstairs there are more classrooms, a science lab and the library.",
      "The stairs are at the end of the main corridor. Walk onto them to go up, and anything chasing you follows."
    ]
  },
  {
    id: "fireworks-bus",
    date: "2026-11-09",
    kind: "new",
    title: "S.O.S. Fireworks bus",
    deck: "An old city bus in the downtown car park has been turned into a fireworks stand.",
    points: [
      "Search it to fill your hands with fireworks, then come back for more until it sells out.",
      "Look for its sign and its string of bulbs. It is marked on the town map, under Places.",
      "The Town Guide has a page for it."
    ]
  },
  {
    id: "coop-same-town",
    date: "2026-11-09",
    kind: "fixed",
    title: "No more walking through walls with friends",
    deck: "A friend with an older copy of the game once saw a different town.",
    points: [
      "If your copy and your friend's do not match, you are told to start fresh instead of joining.",
      "Before you meet, the game checks that you are both standing in the same town."
    ]
  },
  {
    id: "fountain-fireworks",
    date: "2026-11-09",
    kind: "new",
    title: "Fountains",
    deck: "The road flare is now a fountain firework: a cone that sprays gold sparks straight up.",
    points: [
      "Light one and it sprays and hisses for twenty seconds, pulling every zombie in earshot to it.",
      "Any zombie that reaches it catches fire, so a fountain is a lure and a trap at once.",
      "Cars, garages and the police station hide them. The supply drop still comes down on a red flare."
    ]
  },
  {
    id: "candy-bag",
    date: "2026-11-09",
    kind: "new",
    title: "The candy bag",
    deck: "Trick-or-treat as hard as you shoot: your bag has no bottom now.",
    points: [
      "Carry as much candy as you can find. No bowl is ever left behind.",
      "Open the candy bag from your backpack and pick one to eat.",
      "Every candy has its own picture, its count and what it does.",
      "Eat one that is already working and the boost lasts longer."
    ]
  },
  {
    id: "map-art",
    date: "2026-11-09",
    kind: "better",
    title: "A town map drawn by hand",
    deck: "Unfold the map and the town looks like a town: roofs, signs, trees and parked cars.",
    points: [
      "Every building has a little roof in its colour, with a sign on top: a cross for medicine, a star for the police, a pistol for guns.",
      "The van and the supply drop are drawn as a van and a crate on its parachute.",
      "The key beside the map shows the same pictures, sorted under Your marks, Places, On the way and Left behind."
    ]
  },
  {
    id: "town-names",
    date: "2026-11-09",
    kind: "better",
    title: "Every town has a name",
    deck: "No more Level 1, Level 2. The towns are named for their numbers.",
    points: [
      "The road runs One Lake City, Twoport, Three Suns, Fourkatello, Phivenix and on to Tenver.",
      "The bunker is Zero Point.",
      "The town cards, your records and the road signs all use the names."
    ]
  },
  {
    id: "schools-and-hospitals",
    date: "2026-11-09",
    kind: "new",
    title: "Schools and hospitals",
    deck: "The two biggest buildings in town, and nearly every town has both.",
    points: [
      "The hospital usually stands Downtown: wards along the back, an emergency bay out front, and a medkit there every time. It is the best-guarded building in town.",
      "The school usually sits out in Riverside: classrooms, a library and a long hall of lockers. Most of them are empty, but it hides more candy than any shop.",
      "An ambulance waits outside the hospital, lights going. Both have back doors and stand out on the town map. The Town Guide has a page for each."
    ]
  },
  {
    id: "setup-overlay",
    date: "2026-11-09",
    kind: "better",
    title: "Pick from the big cards",
    deck: "Choosing a Play card now lays its options out as big portrait cards.",
    points: [
      "Each choice is its own tall card with its name along the bottom and its stat bars under it.",
      "Survivors stand as they look in the field and turn when you point at them.",
      "The whole Play board fits in one look, with nothing to hunt for."
    ]
  },
  {
    id: "five-survivors",
    date: "2026-11-09",
    kind: "better",
    title: "Room for all five",
    deck: "A team can now hold five players, one for every survivor.",
    points: [
      "Night, Bear, Kat, Rex and Kai can all be out on the same night.",
      "Nobody plays the same survivor twice. If yours is taken, you are told who is free.",
      "Finding a team only puts you with others where your survivor is still free."
    ]
  },
  ...EARLIER_NOTES
];
