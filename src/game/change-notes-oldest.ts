// The oldest What's New notes, newest first, carried on after change-notes-earlier.ts.
// New notes go at the top of CHANGE_NOTES in change-notes.ts, not here.

import type { ChangeNote } from "./change-notes.ts";

export const OLDEST_NOTES: readonly ChangeNote[] = [
  {
    id: "back-doors",
    date: "2026-11-07",
    kind: "new",
    title: "Back doors and rooms",
    deck: "A crowd at the front door is no longer a trap.",
    points: [
      "Houses, apartments, the clinic, police station, garage, warehouse and grocery have a back door.",
      "Houses have a bedroom, and apartments split into two flats off a shared hall.",
      "Every room is still wide enough for the biggest survivor to get through."
    ]
  },
  {
    id: "keepsakes",
    date: "2026-11-07",
    kind: "new",
    title: "Keepsakes",
    deck: "Pick one of three, and keep it all run.",
    points: [
      "Reaching towns 3, 5, 7 and 9, you are offered three keepsakes. Choose one and it is yours.",
      "A Rabbit’s Foot for luckier searches, Worn Sneakers for longer sprints, Dog Tags for faster revives, and more.",
      "Each survivor gets their own offer in a team."
    ]
  },
  {
    id: "candy",
    date: "2026-11-07",
    kind: "new",
    title: "Halloween candy",
    deck: "Twelve short boosts hidden around town.",
    points: [
      "Search houses and apartments for candy. Carry two, and eat one when you need it.",
      "Sour Skulls reload twice as fast, Ghost Gum makes sprinting silent, Jawbreaker halves the damage you take.",
      "Each lasts a minute and a quarter. Find a Full-Size Bar and you get a bit of everything."
    ]
  },
  {
    id: "furniture",
    date: "2026-11-07",
    kind: "fixed",
    title: "Furniture against the walls",
    deck: "No more gaps that look like a way through.",
    points: [
      "Furniture now stands flush against a building’s side walls.",
      "The narrow gaps that used to trap survivors are gone, and real aisles open where there is room."
    ]
  },
  {
    id: "stamps",
    date: "2026-11-07",
    kind: "new",
    title: "Stamps",
    deck: "Achievements, inked into your Record Book.",
    points: [
      "Seventeen stamps to earn, from First Blood and Headhunter to beating each boss and reaching the last town.",
      "Each one is dated the day you earn it. An empty ring tells you how to get it.",
      "Find them on the last two pages of Records."
    ]
  },
  {
    id: "bosses",
    date: "2026-11-07",
    kind: "new",
    title: "Boss nights",
    deck: "The third, sixth and ninth towns end with something big.",
    points: [
      "The Howler screams for runners. Mother gives birth to walkers. The Butcher charges anyone who gets close.",
      "The last horde does not end until the boss falls. A health bar shows how close you are.",
      "Every boss drops a medkit and a prize."
    ]
  },
  {
    id: "night-events",
    date: "2026-11-07",
    kind: "new",
    title: "Night events",
    deck: "Some nights are worse than others.",
    points: [
      "Fog: zombies only spot you up close, and the town turns grey.",
      "Blood moon: hordes twice the size, but every kill is worth double.",
      "Power cut: the lamps go dark, zombies see less and hear more.",
      "The town card tells you what tonight brings."
    ]
  },
  {
    id: "sos-discount",
    date: "2026-11-07",
    kind: "new",
    title: "S.O.S. Discount",
    deck: "A new store downtown, with a back room worth checking.",
    points: [
      "Shows up in two towns out of three.",
      "Cheap goods on the shelves, better finds in the stockroom."
    ]
  },
  {
    id: "chains",
    date: "2026-11-07",
    kind: "new",
    title: "Kill chains pay, and share your Daily",
    deck: "Fast kills are worth more.",
    points: [
      "Each kill soon after your last is worth more, up to double from the fifth in a row.",
      "The floating score shows the bonus, like +18 x1.5.",
      "Copy your result and your Nightly Run score, kills and streak are ready to paste anywhere."
    ]
  },
  {
    id: "record-book",
    date: "2026-11-07",
    kind: "better",
    title: "Records, as a printed book",
    deck: "Your bests, written in by hand.",
    points: [
      "Personal bests for Campaign and Arcade, a ledger of your top five runs, and your Nightly Run streak.",
      "The last seven nights, each stamped Counted, Missed or Tonight.",
      "Turn the pages forward and back, or give them a swipe."
    ]
  },
  {
    id: "daily-night",
    date: "2026-11-07",
    kind: "new",
    title: "Nightly Run",
    deck: "One town a day, the same for everyone.",
    points: [
      "A new item on the board. Every player gets the same town, rule and difficulty each day.",
      "Your first run of the day counts. The rest are practice.",
      "Keep a streak going, and see how long until the next town."
    ]
  },
  {
    id: "supply-drops",
    date: "2026-11-07",
    kind: "new",
    title: "Supply drops",
    deck: "Watch for the red flare.",
    points: [
      "Once a town, after the first horde, a flare goes up and a crate lands on it moments later.",
      "Inside: ammo, a medkit, a round kit and a prize.",
      "The flare is loud and the landing is louder, so you won’t be the only one coming."
    ]
  },
  {
    id: "molotovs",
    date: "2026-11-07",
    kind: "new",
    title: "Molotovs and flares",
    deck: "Something to throw.",
    points: [
      "Find fuel in garages, warehouses and diners. Throw a molotov for a pool of fire that burns a few moments.",
      "Find flares at the police station, in garages and in cars. Throw one to pull zombies away.",
      "Carry two of each. Don’t stand in your own fire."
    ]
  },
  {
    id: "kill-feel",
    date: "2026-11-07",
    kind: "better",
    title: "Kills that land",
    deck: "Every big hit feels big.",
    points: [
      "A tiny freeze on headshots, chain kills and dropped brutes.",
      "DOUBLE, TRIPLE, QUAD and MASSACRE callouts for quick kills.",
      "CLOSE CALL when you kill on almost no health, and HORDE WIPED OUT when you clear the lot."
    ]
  },
  {
    id: "overrun",
    date: "2026-11-07",
    kind: "new",
    title: "The Overrun",
    deck: "The bunker is no longer safe.",
    points: [
      "From the second town in Campaign, a clock runs while you are in the bunker. When it runs out, the blast door bursts.",
      "Kill the horde that comes in to earn a reward chest, or run for the van and leave the merchants to it.",
      "How to Play has a new chapter on it."
    ]
  },
  {
    id: "online-rooms",
    date: "2026-11-07",
    kind: "new",
    title: "Team games from anywhere",
    deck: "Play with a friend from anywhere.",
    points: [
      "Start a game of your own and send a friend the code or invite link.",
      "Nothing to set up on your side.",
      "Open to everyone once the online service is switched on."
    ]
  },
  {
    id: "setup-stepper",
    date: "2026-11-07",
    kind: "better",
    title: "A clearer setup",
    deck: "Style, Mode, Difficulty, Survivor, in that order.",
    points: [
      "Numbered steps show where you are. Pick a finished step to go back to it.",
      "Every step is the same size, so the buttons stay put."
    ]
  }
];
