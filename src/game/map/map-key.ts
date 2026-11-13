// The key beside the map screen, as headed groups of little pictures that match what the map draws.
// A town has places by use, things on their way, supplies left behind and the player's own marks;
// the bunker has its rooms (named on the map itself) and its stations, so it gets its own key.

import type { TransportKind } from '../../network/transport.ts';
import { PLACE_GROUPS, PLACE_LOOK, placeIcon } from './map-buildings.ts';
import { LEFTOVER_KEY } from './map-leftovers.ts';
import { CROSS_ICON, CURSOR_ICON, DROP_ICON, FIREWORKS_BUS_ICON, STATION_ICON, TICK_ICON, VAN_ICON } from './map-markers.ts';
import type { MapIcon } from './map-sprite.ts';

export interface KeyEntry {
  readonly icon: MapIcon;
  readonly label: string;
  /** A colour for the words, when they are a mark the player earned rather than a thing in town. */
  readonly tone?: 'tick' | 'cross';
}

export interface KeyGroup {
  readonly title: string;
  readonly entries: readonly KeyEntry[];
}

export interface MapKey {
  /** The screen's name and heading. */
  readonly title: string;
  readonly groups: readonly KeyGroup[];
  /** Whether the run waits while the map is open: it does for one player, and not for a room. */
  readonly waitNote: (mode: TransportKind) => string;
}

/** The first line of every key: the blinking cursor on the map. */
export const YOU_ARE_HERE: KeyEntry = { icon: CURSOR_ICON, label: 'You are here' };

const PLACES: KeyGroup = {
  title: 'Places',
  entries: [...PLACE_GROUPS.map((group) => ({ icon: placeIcon(group), label: PLACE_LOOK[group].label })), { icon: FIREWORKS_BUS_ICON, label: 'S.O.S. Fireworks bus' }],
};

const COMING: KeyGroup = {
  title: 'On the way',
  entries: [
    { icon: VAN_ICON, label: 'The van, once it comes' },
    { icon: DROP_ICON, label: 'A supply drop' },
  ],
};

const LEFT_BEHIND: KeyGroup = { title: 'Left behind', entries: LEFTOVER_KEY };

const TOWN_MARKS: KeyGroup = {
  title: 'Your marks',
  entries: [
    YOU_ARE_HERE,
    { icon: TICK_ICON, label: 'Been inside', tone: 'tick' },
    { icon: CROSS_ICON, label: 'Cleared and searched', tone: 'cross' },
  ],
};

const waitNoteOf = (place: string) => (_mode: TransportKind) => `The ${place} does not wait.`;

const TOWN_KEY: MapKey = { title: 'Town map', groups: [TOWN_MARKS, PLACES, COMING, LEFT_BEHIND], waitNote: waitNoteOf('town') };
const BUNKER_KEY: MapKey = {
  title: 'Camp map',
  groups: [{ title: 'Your marks', entries: [YOU_ARE_HERE] }, { title: 'Places', entries: [{ icon: STATION_ICON, label: 'Stations' }] }],
  waitNote: waitNoteOf('camp'),
};

export function mapKey(inBunker: boolean): MapKey {
  return inBunker ? BUNKER_KEY : TOWN_KEY;
}
