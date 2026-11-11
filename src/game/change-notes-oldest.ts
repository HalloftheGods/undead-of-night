// The oldest What's New notes, newest first, carried on after change-notes-earlier.ts.
// New notes go at the top of CHANGE_NOTES in change-notes.ts, not here.

import type { ChangeNote } from './change-notes.ts';

export const OLDEST_NOTES: readonly ChangeNote[] = [
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
