/** The words the setup page shows for a level picked on the Levels page. The decisions live in level-progress.ts. */
import { LEVELS, townName } from '../../shared/levels.ts';

/** The theme names the level cards show. */
export const THEME_NAMES: Readonly<Record<string, string>> = {
  night: 'Night',
  'industrial-dusk': 'Dusk',
  flooded: 'Flooded',
  contaminated: 'Toxic',
  blackout: 'Blackout',
  emergency: 'Emergency',
  snow: 'Blizzard',
  infested: 'Infested',
  burning: 'Inferno',
};

export const COOP_LEVEL_NOTE = `Co-op always starts in ${townName(1)}. Your chosen town applies to solo only.`;

/** Said on the Levels page when it was opened from Play's Level card: the pick is kept, and Play starts the run. */
export const LEVEL_SETTING_NOTE = 'Pick the town Arcade starts at. Play then starts the run from there.';

/** Campaign's version: the van drives to this town by default, and the garage map can still change it. */
export const CAMPAIGN_SETTING_NOTE = 'Pick the town your van drives to by default. You can still change it at the garage map.';

/** The setup page's line for a chosen level, or null for none or an unknown level. */
export function startAtLabel(level: number | null): string | null {
  const found = level === null ? undefined : LEVELS.find((entry) => entry.number === level);
  return found ? `Start in ${found.town}: ${found.title}` : null;
}
