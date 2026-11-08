export interface SplashTimings {
  /** Fade from black to the mark, in ms. */
  readonly fadeIn: number;
  /** Time the mark stays fully lit, in ms. */
  readonly hold: number;
  /** Fade back to black before the title, in ms. */
  readonly fadeOut: number;
}

/** Served from public/, relative so the build works from any folder. */
export const BRAND_MARK = 'brand/hall-of-the-gods.webp';

/** Year of the build, injected by Vite (`define`), so the line never follows the visitor's clock. */
declare const __BUILD_YEAR__: number;

/** The year the studio opened its doors. */
export const STUDIO_FOUNDED = 2006;

/** The dated line games carry on the title screen: one studio line, founding year to build year. */
export function studioLine(buildYear: number): string {
  return `© ${STUDIO_FOUNDED}–${buildYear} Hall of the Gods, Inc.`;
}

export const STUDIO_LINE = studioLine(__BUILD_YEAR__);

/** Add this to the address to go straight to the title. */
const SKIP_QUERY = 'nosplash';

/** With reduced motion there is no fade, only a short hold. */
export function splashTimings(reducedMotion: boolean): SplashTimings {
  return reducedMotion ? { fadeIn: 0, hold: 1000, fadeOut: 0 } : { fadeIn: 400, hold: 1600, fadeOut: 500 };
}

export function shouldShowSplash(search: string): boolean {
  return !new URLSearchParams(search).has(SKIP_QUERY);
}
