import { CHARACTERS } from '../../../shared/characters.ts';
import { isLocalHost } from '../analytics/analytics-config.ts';

/** The value of `?dev=` that opens the HUD test page on a local dev build. */
const HUD_TEST_VALUE = 'hud';

/** The dev HUD page: a dev build served from this machine, asked for with `?dev=hud`. */
export function hudTestOn(search: string, dev: boolean, hostname: string): boolean {
  const isLocalDev = dev && isLocalHost(hostname);
  if (!isLocalDev) return false;
  return new URLSearchParams(search).get('dev') === HUD_TEST_VALUE;
}

/** A survivor picked at random, so every HUD test starts with a different face. */
export function randomSurvivor(): number {
  return Math.floor(Math.random() * CHARACTERS.length);
}
