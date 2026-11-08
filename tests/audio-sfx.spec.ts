import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../shared/protocol.ts';
import { playEventSound, type SoundCue } from '../src/audio/event-sounds.ts';
import { HEARING_RANGE, spatialize, type Mixer, type PlayOpts } from '../src/audio/mixer.ts';
import { AmbienceBed, ambienceFor, BED_EVERY, type AmbienceName } from '../src/audio/sfx-ambience.ts';
import { SFX, SFX_NAMES, type SfxName } from '../src/audio/sfx-registry.ts';
import { makeVoice, seeded } from '../src/audio/voice-kit.ts';

function deep(): any {
  const kids = new Map<PropertyKey, unknown>();
  return new Proxy(function () { /* callable */ }, {
    get: (_t, k) => {
      if (!kids.has(k)) kids.set(k, deep());
      return kids.get(k);
    },
    set: () => true,
    apply: () => deep(),
  });
}

describe('sfx registry', () => {
  const required = [
    'pistol', 'carbine', 'shotgun', 'dry_click', 'mag_out', 'mag_in', 'pump', 'weapon_switch', 'impact',
    'flesh_hit', 'headshot', 'die_walker', 'die_runner', 'die_bloater', 'die_brute', 'claw', 'groan_walker',
    'shriek_runner', 'gurgle_bloater', 'roar_brute', 'bloater_burst', 'player_hurt', 'player_downed',
    'revive', 'heartbeat', 'pickup_medkit', 'pickup_ammo', 'pickup_weapon', 'wave_start', 'wave_clear',
    'pickup_bandage', 'pickup_pistol_ammo', 'pickup_carbine_ammo', 'pickup_shells', 'melee_swing', 'melee_thud', 'heal',
    'alert_walker', 'alert_runner', 'alert_bloater', 'alert_brute',
    'game_over', 'ui_click', 'ui_hover', 'ui_start', 'ui_pause', 'ui_resume',
  ];

  it('has every required sound with sane limits', () => {
    for (const n of required) expect(SFX_NAMES).toContain(n);
    for (const n of SFX_NAMES) {
      const d = SFX[n];
      expect(d.length).toBeGreaterThan(0);
      expect(d.gain).toBeGreaterThan(0);
      expect(d.voices).toBeGreaterThan(0);
    }
  });

  it('every recipe runs against a context without throwing', () => {
    for (const n of SFX_NAMES) {
      const ctx: any = { sampleRate: 44100, createBuffer: (_c: number, l: number) => ({ getChannelData: () => new Float32Array(l) }) };
      const proxy = new Proxy(ctx, { get: (t, k: string) => (k in t ? t[k] : () => deep()) });
      expect(() => SFX[n].play(makeVoice(proxy, deep(), 0, 1, seeded(1)))).not.toThrow();
    }
  });

  const ADDED: readonly SfxName[] = [
    'die_screamer', 'boss_arrive', 'boss_howl', 'boss_brood', 'boss_charge', 'pickup_part', 'candy_crunch',
    'keepsake', 'crate_land', 'run_victory', 'van_horn',
    'amb_marsh', 'amb_tundra', 'amb_sludge', 'amb_embers', 'amb_forest',
  ];

  /** The latest time any source in a recipe is told to stop, over a few seeds. */
  function lastStop(name: SfxName): number {
    let last = 0;
    const source = () => new Proxy(deep(), { get: (t, k) => (k === 'stop' ? (at: number) => { last = Math.max(last, at); } : t[k]) });
    const ctx: any = {
      sampleRate: 44100,
      createBuffer: (_c: number, l: number) => ({ getChannelData: () => new Float32Array(l) }),
      createOscillator: source,
      createBufferSource: source,
    };
    const proxy = new Proxy(ctx, { get: (t, k: string) => (k in t ? t[k] : () => deep()) });
    for (const seed of [1, 2, 3, 99, 1234]) SFX[name].play(makeVoice(proxy, deep(), 0, 1, seeded(seed)));
    return last;
  }

  it('registers the gap-pass sounds, each finishing inside its declared length', () => {
    for (const n of ADDED) {
      expect(SFX_NAMES).toContain(n);
      const end = lastStop(n);
      expect(end).toBeGreaterThan(0);
      // Sources stop 20 ms after their envelope ends.
      expect(end).toBeLessThanOrEqual(SFX[n].length + 0.05);
    }
  });
});

describe('event sounds', () => {
  const LOCAL = 'p1';

  /** The sounds an event plays, with where they play. */
  function soundsOf(e: GameEvent): Array<[SfxName, PlayOpts | undefined]> {
    const played: Array<[SfxName, PlayOpts | undefined]> = [];
    const mixer = { play: (name: SfxName, o?: PlayOpts) => { played.push([name, o]); } } as unknown as Mixer;
    const cue: SoundCue = {
      mixer,
      at: (x, y, playerId) => ({ x, y, local: playerId === LOCAL }),
      playAmbient: () => undefined,
      claimAlert: () => true,
      reloadStart: () => undefined,
      reloadEnd: () => undefined,
      dropShells: () => undefined,
    };
    playEventSound(e, cue);
    return played;
  }
  const names = (e: GameEvent): SfxName[] => soundsOf(e).map(([n]) => n);
  const ev = (e: Record<string, unknown>): GameEvent => e as unknown as GameEvent;

  it('gives the screamer a death of its own', () => {
    expect(names(ev({ type: 'zombie_die', zombieId: 'z', zombieType: 'screamer', x: 0, y: 0, angle: 0, killerId: LOCAL, points: 1 }))).toEqual(['die_screamer']);
  });

  it('announces a boss to everyone and gives each trick its own call where the boss stands', () => {
    const [arrive] = soundsOf(ev({ type: 'boss_arrive', boss: 'howler', x: 900, y: 900 }));
    expect(arrive).toEqual(['boss_arrive', { local: true }]);
    expect(names(ev({ type: 'boss_trick', boss: 'howler', x: 1, y: 2 }))).toEqual(['boss_howl']);
    expect(names(ev({ type: 'boss_trick', boss: 'mother', x: 1, y: 2 }))).toEqual(['boss_brood']);
    const [charge] = soundsOf(ev({ type: 'boss_trick', boss: 'butcher', x: 1, y: 2 }));
    expect(charge).toEqual(['boss_charge', { x: 1, y: 2 }]);
  });

  it('honks when the van arrives, for everyone', () => {
    expect(soundsOf(ev({ type: 'exit_open', level: 2, x: 5, y: 5 }))).toEqual([['van_horn', { local: true }]]);
  });

  it('plays a keepsake only for the player who took it', () => {
    expect(names(ev({ type: 'keepsake_taken', playerId: LOCAL, keepsake: 'any' }))).toEqual(['keepsake']);
    expect(names(ev({ type: 'keepsake_taken', playerId: 'p2', keepsake: 'any' }))).toEqual([]);
  });

  it('ends a won run on a victory, not the defeat', () => {
    const over = (outcome: string) => ev({ type: 'game_over', stats: { outcome, difficulty: 'lights_out', level: 10, wave: 3, durationSec: 1, players: [] } });
    expect(names(over('victory'))).toEqual(['run_victory']);
    expect(names(over('defeat'))).toEqual(['game_over']);
  });

  it('lands a supply crate with a thump of its own', () => {
    expect(names(ev({ type: 'drop_landed', x: 0, y: 0 }))).toEqual(['crate_land']);
  });

  it('bags a gun part without the whole-gun flourish', () => {
    expect(names(ev({ type: 'pickup', playerId: LOCAL, pickup: 'suppressor', x: 0, y: 0 }))).toEqual(['pickup_part']);
    expect(names(ev({ type: 'pickup', playerId: LOCAL, pickup: 'shotgun', x: 0, y: 0 }))).toEqual(['pickup_weapon']);
  });

  it('crunches a candy before it heals or saves', () => {
    expect(names(ev({ type: 'candy_eaten', playerId: LOCAL, candy: 'any', x: 0, y: 0 }))).toEqual(['candy_crunch', 'heal']);
    const saved = soundsOf(ev({ type: 'candy_eaten', playerId: LOCAL, candy: 'any', x: 0, y: 0, saved: true }));
    expect(saved.map(([n]) => n)).toEqual(['candy_crunch', 'revive']);
    expect(saved[1][1]?.delay).toBeGreaterThan(0);
  });
});

describe('biome ambience', () => {
  it('lays a bed under the towns that look different, and only registered ones', () => {
    expect(ambienceFor(1)).toBeNull();
    expect(ambienceFor(4)).toBe('amb_marsh');
    expect(ambienceFor(8)).toBe('amb_tundra');
    expect(ambienceFor(10)).toBe('amb_embers');
    for (let level = 1; level <= 10; level += 1) {
      const bed = ambienceFor(level);
      if (bed) expect(SFX_NAMES).toContain(bed);
    }
  });

  it('overlaps its layers so the bed never gaps', () => {
    for (const bed of ['amb_marsh', 'amb_tundra', 'amb_sludge', 'amb_embers', 'amb_forest'] as const) {
      expect(BED_EVERY).toBeLessThan(SFX[bed].length - 1);
    }
  });

  it('starts a layer at once, the next one on its clock, and changes with the town', () => {
    const played: AmbienceName[] = [];
    const play = (n: AmbienceName) => { played.push(n); };
    const bed = new AmbienceBed();
    bed.tick(0.016, 'amb_marsh', play);
    expect(played).toEqual(['amb_marsh']);
    for (let i = 0; i < 46; i += 1) bed.tick(0.1, 'amb_marsh', play);
    expect(played).toHaveLength(1);
    for (let i = 0; i < 2; i += 1) bed.tick(0.1, 'amb_marsh', play);
    expect(played).toHaveLength(2);
    bed.tick(0.016, 'amb_tundra', play);
    expect(played.at(-1)).toBe('amb_tundra');
    bed.tick(0.016, null, play);
    bed.tick(30, null, play);
    expect(played).toHaveLength(3);
  });

  it('starts one layer after a long stall, never a burst', () => {
    const played: AmbienceName[] = [];
    const bed = new AmbienceBed();
    bed.tick(0.016, 'amb_sludge', (n) => played.push(n));
    bed.tick(60, 'amb_sludge', (n) => played.push(n));
    expect(played).toHaveLength(2);
    bed.tick(0.016, 'amb_sludge', (n) => played.push(n));
    expect(played).toHaveLength(2);
  });
});

describe('spatialize', () => {
  it('culls beyond hearing range', () => {
    expect(spatialize(0, 0, HEARING_RANGE, 0)).toBeNull();
    expect(spatialize(0, 0, 0, HEARING_RANGE + 50)).toBeNull();
  });

  it('is loudest up close and fades with distance', () => {
    const near = spatialize(0, 0, 10, 0)!;
    const far = spatialize(0, 0, 300, 0)!;
    expect(near.gain).toBeGreaterThan(far.gain);
    expect(near.gain).toBeLessThanOrEqual(1);
  });

  it('pans toward the side of the source', () => {
    expect(spatialize(0, 0, -100, 0)!.pan).toBeLessThan(0);
    expect(spatialize(0, 0, 100, 0)!.pan).toBeGreaterThan(0);
    expect(spatialize(0, 0, 0, 100)!.pan).toBe(0);
  });
});
