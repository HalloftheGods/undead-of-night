import { BUNKER_LEVEL } from '../../shared/home-protocol.ts';
import { BASE_NAME, FINAL_LEVEL, levelDef } from '../../shared/levels.ts';
import { BOSS_LEVELS, BOSSES } from '../../shared/bosses.ts';
import { nightEventFor } from '../../shared/night-events.ts';
import { townRule } from '../../shared/town-rules.ts';
import type { HudState, LevelCard } from './hud-state.ts';

/** Hordes this town has seen off, the one on the street not counted. */
function hordesSurvived(hud: Pick<HudState, 'phase' | 'wave'>): number {
  return hud.phase === 'wave' ? hud.wave - 1 : hud.wave;
}

/** Which level this is, for the HUD. */
export function levelLine(level: number): string {
  const home = level === BUNKER_LEVEL;
  if (home) return BASE_NAME;
  const { town, title } = levelDef(level);
  return `${town}: ${title}`;
}

/** What stands between the players and the next town. */
export function levelGoal(hud: Pick<HudState, 'level' | 'phase' | 'wave' | 'exitOpen'>): string {
  const home = hud.level === BUNKER_LEVEL;
  if (home) return 'Gear up, then take the van';
  if (hud.exitOpen) return 'Get to the van';
  return `${hordesSurvived(hud)} of ${levelDef(hud.level).hordes} hordes survived`;
}

/** A sidequest available in this town, or null if none. */
export function levelSidequest(hud: Pick<HudState, 'level' | 'drained'>): string | null {
  const isFlooded = levelDef(hud.level).theme === 'flooded';
  if (!isFlooded) return null;
  return hud.drained ? 'City drained: Sewers unlocked' : 'Sidequest: Drain the city';
}

/** The words for a level's title card. With the town's map seed it also names the night's event, if any. */
export function levelTitle(level: number, mapSeed: number | null = null): Omit<LevelCard, 'key'> {
  const { number, town, title, hordes, theme } = levelDef(level);
  const isLast = number === FINAL_LEVEL;
  const rule = townRule(level);
  const event = mapSeed === null ? null : nightEventFor(mapSeed, level);
  const bossId = BOSS_LEVELS[level];
  const boss = bossId ? BOSSES[bossId] : null;
  const isFlooded = theme === 'flooded';
  return {
    heading: isLast ? `The last town: ${title}` : `Town ${number} of ${FINAL_LEVEL}: ${title}`,
    title: town,
    goal: `Survive ${hordes} hordes, then reach the van`,
    ...(rule ? { rule: `${rule.name}: ${rule.blurb}` } : {}),
    ...(isFlooded ? { sidequest: 'Sidequest: Find the sewage drain to drain the city and unlock the sewers' } : {}),
    ...(event ? { event: `${event.name}. ${event.blurb}` } : {}),
    ...(boss ? { boss: `${boss.name} comes with the last horde. ${boss.blurb}` } : {}),
  };
}
