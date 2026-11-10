// How a run is played. "Mode" already means solo or multiplayer, so this is the style:
// Campaign plays from the bunker, in trips, and Arcade is ten levels in a row.

export const GAME_STYLES = ['campaign', 'arcade', 'daily'] as const;
export type GameStyle = (typeof GAME_STYLES)[number];

/** A first-time player starts at home. */
export const DEFAULT_STYLE: GameStyle = 'campaign';

/** What a client from before there were styles is playing. */
export const STYLELESS_CLIENT: GameStyle = 'arcade';

export const isGameStyle = (value: unknown): value is GameStyle => GAME_STYLES.includes(value as GameStyle);

/** A Campaign run is played from the bunker, which is what the simulation calls home. */
export const playsFromHome = (style: GameStyle): boolean => style === 'campaign';
