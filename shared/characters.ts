// The playable survivors, in the order of the art: a player's `skin` is an index into
// this table. Each one is better at one thing, and only a little.

/** One look a survivor can wear. src/art/survivors/costumes/ draws it under the same id. */
export interface CostumeLabel {
  /** Unique within the survivor. Saved unlocks will name it, so it never changes once shipped. */
  readonly id: string;
  /** What the bunker locker will call it. */
  readonly name: string;
}

export interface Character {
  readonly id: string;
  readonly name: string;
  /** The title screen's line about what this survivor does better. */
  readonly trait: string;
  /** Share of the normal distance a zombie can spot this survivor from. */
  readonly sightRange: number;
  /** Share of the normal reload time. */
  readonly reloadTime: number;
  /** Share of the normal walking speed. */
  readonly moveSpeed: number;
  /** Share of the normal shove knockback. */
  readonly shoveForce: number;
  /** Share of the normal chance that this survivor's kill drops something. */
  readonly dropOdds: number;
  /** Chance this survivor turns something up in a container with nothing put away in it. */
  readonly searchLuck: number;
  /** Share of the normal radius of the noises this survivor makes: shots, sprinting and a search that clatters. */
  readonly noise: number;
  /** Share of the normal chance that searching a container clatters. */
  readonly clatterChance: number;
  /**
   * The looks this survivor has, default first, in the order the art draws them. Only the
   * default is worn for now: nothing in the player, the protocol or a save names a costume yet.
   */
  readonly costumes: readonly CostumeLabel[];
}

const PLAIN = { sightRange: 1, reloadTime: 1, moveSpeed: 1, shoveForce: 1, dropOdds: 1, searchLuck: 0, noise: 1, clatterChance: 1 } as const;

const NIGHT_LOOKS: readonly CostumeLabel[] = [
  { id: 'starfield', name: 'Starfield' },
  { id: 'aurora', name: 'Aurora' },
  { id: 'nebula', name: 'Nebula' },
];
const BANDUS_LOOKS: readonly CostumeLabel[] = [
  { id: 'grizzly', name: 'Grizzly' },
  { id: 'polar', name: 'Polar Bear' },
  { id: 'honey', name: 'Honey Bear' },
  { id: 'recruit', name: 'Recruit' },
];
const SATORI_LOOKS: readonly CostumeLabel[] = [
  { id: 'tabby', name: 'Tabby' },
  { id: 'black', name: 'Black Cat' },
  { id: 'siamese', name: 'Siamese' },
  { id: 'grey', name: 'Grey Tabby' },
];
const REX_LOOKS: readonly CostumeLabel[] = [
  { id: 'green', name: 'Green Dino' },
  { id: 'purple', name: 'Purple Dino' },
  { id: 'red', name: 'Red Dino' },
  { id: 'triceratops', name: 'Triceratops' },
];
const SOL_LOOKS: readonly CostumeLabel[] = [
  { id: 'kid', name: 'Kid' },
  { id: 'plumber', name: 'Plumber' },
  { id: 'adventurer', name: 'Adventurer' },
  { id: 'caped', name: 'Caped Hero' },
];

export const CHARACTERS: readonly Character[] = [
  { ...PLAIN, id: 'night', name: 'Night', trait: 'Moves quieter', sightRange: 0.75, noise: 0.75, clatterChance: 0.5, costumes: NIGHT_LOOKS },
  { ...PLAIN, id: 'bandus', name: 'Bear', trait: 'Reloads faster', reloadTime: 0.75, costumes: BANDUS_LOOKS },
  { ...PLAIN, id: 'satori', name: 'Kat', trait: 'Runs faster', moveSpeed: 1.12, costumes: SATORI_LOOKS },
  { ...PLAIN, id: 'rex', name: 'Rex', trait: 'Shoves harder', shoveForce: 1.5, costumes: REX_LOOKS },
  { ...PLAIN, id: 'sol', name: 'Kai', trait: 'Loots more', dropOdds: 2, searchLuck: 0.15, costumes: SOL_LOOKS },
];

export function characterOf(skin: number): Character {
  return CHARACTERS[skin] ?? CHARACTERS[0];
}

/** The survivor's looks, default first; the first survivor's for a skin the table does not know. */
export function costumesOf(skin: number): readonly CostumeLabel[] {
  return characterOf(skin).costumes;
}

/** Where a costume id sits in the survivor's list, or -1 when that survivor has no such look. */
export function costumeIndexOf(skin: number, id: string): number {
  return costumesOf(skin).findIndex((costume) => costume.id === id);
}

export function isCharacterIndex(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < CHARACTERS.length;
}

/** The survivor asked for if nobody has them, otherwise the next one along that is free. */
export function freeCharacter(taken: ReadonlySet<number>, wanted = 0): number {
  for (let step = 0; step < CHARACTERS.length; step++) {
    const skin = (wanted + step) % CHARACTERS.length;
    if (!taken.has(skin)) return skin;
  }
  return wanted;
}
