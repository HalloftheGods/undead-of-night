export interface SplashTimings {
  /** Fade from black to the mark, in ms. */
  readonly fadeIn: number;
  /** Time the mark stays fully lit, in ms. */
  readonly hold: number;
  /** Fade back to black before the title, in ms. */
  readonly fadeOut: number;
}

export interface SplashCard {
  readonly id: string;
  readonly image: string;
  readonly kicker?: string;
  readonly title?: string;
  readonly ariaLabel: string;
  readonly bg?: string;
  readonly hold?: number;
}

/** Served from public/, relative so the build works from any folder. */
export const BRAND_MARK = "brand/hall-of-the-gods.webp";

/** The sequence of studio and platform cards shown on game boot. */
export const SPLASH_CARDS: readonly SplashCard[] = [
  {
    id: "hall-of-the-gods",
    image: BRAND_MARK,
    // kicker: "Presented by",
    kicker: "Produced by",
    title: "Hall of the Gods",
    ariaLabel: "Hall of the Gods",
    bg: "#000000",
    hold: 400
  },
  {
    id: "majora-d",
    kicker: "Press any key to start the music. (M to mute)",
    image: "brand/majora-d-music-optimize.gif",
    ariaLabel: "Music Producer and Artist: Majora D.",
    bg: "#110a25",
    hold: 1600
  },
  {
    id: "chem-x",
    image: "brand/chemx.gif",
    kicker: "https://chemicalx.xophz.com",
    ariaLabel: "Built by Chemical X",
    bg: "#060a0f",
    hold: 1600
  },
  {
    id: "for-the-xp",
    image: "brand/forthexp-powered.gif",
    kicker: "https://www.forthexp.com",
    ariaLabel: "Leveled UP For The XP!",
    bg: "#03060a",
    hold: 1400
  }
];

/** Year of the build, injected by Vite (`define`), so the line never follows the visitor's clock. */
declare const __BUILD_YEAR__: number;

/** The year the studio opened its doors. */
export const STUDIO_FOUNDED = 2006;

/** The dated line games carry on the title screen: one studio line, founding year to build year. */
export function studioLine(buildYear: number): string {
  return `© ${STUDIO_FOUNDED}–${buildYear} Hall of the Gods`;
}

export const STUDIO_LINE = studioLine(__BUILD_YEAR__);

/** Add this to the address to go straight to the title. */
const SKIP_QUERY = "nosplash";

/** With reduced motion there is no fade, only a short hold. */
export function splashTimings(reducedMotion: boolean): SplashTimings {
  return reducedMotion
    ? { fadeIn: 0, hold: 1000, fadeOut: 0 }
    : { fadeIn: 400, hold: 1600, fadeOut: 500 };
}

export function shouldShowSplash(search: string): boolean {
  return !new URLSearchParams(search).has(SKIP_QUERY);
}
