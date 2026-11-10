// The words over a bunker station you can open, in the bitmap font's capitals.

import type { StationId } from '../../shared/home-protocol.ts';

export const STATION_LABEL: Record<StationId, string> & { forge?: string } = {
  bench: 'WORKBENCH',
  candy_shop: 'CANDY SHOP',
  forge: 'FORGE',
  locker: 'LOCKER',
  level_map: 'LEVEL MAP',
  jukebox: 'JUKEBOX',
  gunsmith: 'GUNSMITH',
  quartermaster: 'QUARTERMASTER',
  medic: 'MEDIC',
  powder: 'POWDER',
  chest: 'CHEST',
  press: 'PRESS',
};

/** What to show over a head: the key to hold, or the word a finger can press. */
export function stationPrompt(station: StationId, touch: boolean, payFrom?: string): string {
  const verb = touch ? 'OPEN' : 'HOLD E';
  return payFrom === undefined ? `${verb}: ${STATION_LABEL[station]}` : `${verb}: ${payFrom.toUpperCase()} HAS YOUR PAY`;
}
