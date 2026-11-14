import { groundEffect } from './ground.ts';
import { levelDef } from './levels.ts';
import type { LevelTheme } from './levels.ts';
import type { EntityId, WorldMap } from './protocol.ts';
import { buildingAt } from './world-query.ts';

/** What a town's weather does to play, on top of how it looks. */
export interface TownRule {
  readonly name: string;
  readonly blurb: string;
}

export const TOWN_RULES: Readonly<Partial<Record<LevelTheme, TownRule>>> = {
  flooded: { name: 'Floodwater', blurb: 'Wading outdoors slows you down. Sewers are flooded until drained.' },
  blackout: { name: 'Blackout', blurb: 'Zombies see less in the dark, but they hear further.' },
  snow: { name: 'Fresh snow', blurb: 'Zombies sniff along your footprints. Sneak, or duck indoors, to lose them.' },
};

/** Walking speed outdoors in a flooded town. */
export const FLOOD_SPEED_SCALE = 0.8;
/** In a blackout zombies spot survivors from this share of the usual range, and hear this much further. */
export const BLACKOUT_SIGHT_SCALE = 0.7;
export const BLACKOUT_HEARING_SCALE = 1.3;
/** A footprint goes down every so many ticks while walking in snow, and fills in after this long. */
export const TRACK_EVERY_TICKS = 9;
export const TRACK_LIFE_SEC = 20;
/** A roamer this close to a footprint picks up the trail. */
export const TRACK_SNIFF_RADIUS = 18;
/** Footprints kept at once, oldest dropped first. */
export const TRACK_LIMIT = 240;
/** A tracker looks this far ahead for the next print; past it, the trail has gone cold. */
export const TRACK_FOLLOW_REACH = 64;
/** Close enough to a print to have reached it and look for the next. */
export const TRACK_ARRIVE_PX = 6;
/** Following its nose is slower than chasing what it can see. */
export const TRACKER_SPEED_SCALE = 0.8;
/** Seconds a tracker casts about where the prints ran out before it gives up. */
export const TRACK_SEARCH_SEC = 5;
/** Seconds after giving up before it will take up a trail again. */
export const TRACK_REST_SEC = 8;

export interface Footprint {
  readonly x: number;
  readonly y: number;
  readonly by: EntityId;
  /** Which way the walker was heading, for drawing the print. */
  readonly angle?: number;
  left: number;
}

/** A snow trail a zombie is following print by print. */
export interface ZombieTrail {
  /** Whose prints these are. */
  readonly by: EntityId;
  /** The print it is walking to, and how long that print has left before the snow fills it. */
  x: number;
  y: number;
  left: number;
  /** Set once the prints have run out and it is casting about for them. */
  searching?: boolean;
}

export const themeOf = (level: number): LevelTheme => levelDef(level).theme;

export function townRule(level: number): TownRule | null {
  return TOWN_RULES[themeOf(level)] ?? null;
}

/** Shared with the client, so prediction wades at the sim's pace. */
export function groundSpeedScale(level: number, map: WorldMap, x: number, y: number, drained = false): number {
  const wading = !drained && themeOf(level) === 'flooded' && buildingAt(map, x, y) === null;
  const town = wading ? FLOOD_SPEED_SCALE : 1;
  return Math.min(town, groundEffect(map, x, y).speed);
}

export function sightScale(level: number): number {
  return themeOf(level) === 'blackout' ? BLACKOUT_SIGHT_SCALE : 1;
}

export function hearingScale(level: number): number {
  return themeOf(level) === 'blackout' ? BLACKOUT_HEARING_SCALE : 1;
}
