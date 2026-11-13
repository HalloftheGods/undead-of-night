/** How hard a run is. Chosen on the title screen; in co-op the first player into the room sets it. */
export type DifficultyId = "night_light" | "stay_close" | "lights_out" | "undead_tired";

export interface DifficultyDef {
  readonly id: DifficultyId;
  readonly label: string;
  /** One line for the picker. */
  readonly blurb: string;
  /** Multiplies the rounds in every ammo pickup and the ammo a town holds. */
  readonly ammo: number;
  /** Multiplies every zombie's speed. */
  readonly zombieSpeed: number;
  /** Multiplies every zombie's bite. */
  readonly zombieDamage: number;
  /** Multiplies how many zombies a horde brings. */
  readonly hordeSize: number;
  /** Multiplies the lull between hordes. */
  readonly lull: number;
}

/** In picker order, easiest first. Lights Out is the balance the game was tuned on. */
export const DIFFICULTIES: readonly DifficultyDef[] = [
  {
    id: "night_light",
    label: "Lights On",
    blurb: "Plenty of ammo, slow weak zombies, small hordes.",
    ammo: 2,
    zombieSpeed: 0.85,
    zombieDamage: 0.75,
    hordeSize: 0.75,
    lull: 1.3
  },
  {
    id: "stay_close",
    label: "Be Quiet",
    blurb: "More ammo, slightly slower zombies, smaller hordes.",
    ammo: 1.5,
    zombieSpeed: 0.93,
    zombieDamage: 1,
    hordeSize: 0.9,
    lull: 1
  },
  {
    id: "lights_out",
    label: "Lights Out",
    blurb: "The game as it was built.",
    ammo: 1,
    zombieSpeed: 1,
    zombieDamage: 1,
    hordeSize: 1,
    lull: 1
  },
  {
    id: "undead_tired",
    label: "Let's Go!",
    blurb: "Scarce ammo, fast hard-hitting zombies, big hordes.",
    ammo: 0.6,
    zombieSpeed: 1.12,
    zombieDamage: 1.3,
    hordeSize: 1.25,
    lull: 0.8
  }
];

/** What a new player starts on. */
export const DEFAULT_DIFFICULTY: DifficultyId = "stay_close";
/** What a simulation runs on when nothing says otherwise. */
export const BASELINE_DIFFICULTY: DifficultyId = "lights_out";

export const isDifficultyId = (value: unknown): value is DifficultyId =>
  DIFFICULTIES.some((each) => each.id === value);

export function difficultyDef(id: DifficultyId): DifficultyDef {
  return (
    DIFFICULTIES.find((each) => each.id === id) ??
    (DIFFICULTIES.find((each) => each.id === BASELINE_DIFFICULTY) as DifficultyDef)
  );
}

/** Rounds in a pickup, at least one. */
export const scaleRounds = (rounds: number, id: DifficultyId): number =>
  Math.max(1, Math.round(rounds * difficultyDef(id).ammo));

export const scaleHordeSize = (total: number, id: DifficultyId): number =>
  Math.max(1, Math.round(total * difficultyDef(id).hordeSize));

export const lullSeconds = (base: number, id: DifficultyId): number =>
  Math.round(base * difficultyDef(id).lull);
