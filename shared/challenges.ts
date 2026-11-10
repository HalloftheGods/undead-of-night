export type ChallengeId = 'winter_lockdown' | 'endless_stand' | 'one_shot' | 'fog_bound';

export interface ChallengeDef {
  readonly id: ChallengeId;
  readonly title: string;
  readonly kicker: string;
  readonly description: string;
  readonly startLevel: number;
  readonly forcedBiome?: string;
  readonly forcedWeather?: string;
  readonly playerHealthScale: number;
  readonly zombieDamageScale: number;
  readonly ammoDropScale: number;
  readonly nightEvent?: string;
}

export const CHALLENGES: readonly ChallengeDef[] = [
  {
    id: 'winter_lockdown',
    title: 'Winter Lockdown',
    kicker: 'FREEZING BLIZZARD',
    description: 'Sub-zero temperatures and snow drifts. Footsteps leave tracks roamers follow.',
    startLevel: 8,
    forcedBiome: 'tundra',
    forcedWeather: 'snow',
    playerHealthScale: 1.0,
    zombieDamageScale: 1.1,
    ammoDropScale: 0.9,
  },
  {
    id: 'endless_stand',
    title: 'The Last Stand',
    kicker: 'INFINITE WAVES',
    description: 'No rescue van is coming. Survive consecutive escalating waves inside a fortified district.',
    startLevel: 1,
    playerHealthScale: 1.25,
    zombieDamageScale: 1.0,
    ammoDropScale: 1.5,
  },
  {
    id: 'one_shot',
    title: 'One Scratch',
    kicker: 'LETHAL HARDCORE',
    description: 'One single bite or scratch is fatal. Pinpoint headshots and absolute stealth required.',
    startLevel: 3,
    playerHealthScale: 0.1,
    zombieDamageScale: 10.0,
    ammoDropScale: 1.2,
  },
  {
    id: 'fog_bound',
    title: 'Blighted Fog',
    kicker: 'ZERO VISIBILITY',
    description: 'Dense supernatural fog blankets the town. Senses are blinded and every gunshot echoes.',
    startLevel: 5,
    forcedWeather: 'fog',
    nightEvent: 'fog',
    playerHealthScale: 1.0,
    zombieDamageScale: 1.2,
    ammoDropScale: 1.0,
  },
];

export function challengeDef(id: ChallengeId): ChallengeDef {
  return CHALLENGES.find((each) => each.id === id) ?? CHALLENGES[0];
}

export function isChallengeId(value: unknown): value is ChallengeId {
  return CHALLENGES.some((each) => each.id === value);
}
