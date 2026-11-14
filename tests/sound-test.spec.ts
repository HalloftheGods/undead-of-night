import { describe, expect, it, vi } from 'vitest';
import { FINAL_LEVEL, FIRST_LEVEL } from '../shared/levels.ts';
import { allTracks, LULLS, lockedTracksOf } from '../src/audio/playlists.ts';
import { SFX_NAMES } from '../src/audio/sfx-registry.ts';
import { Soundtrack } from '../src/audio/soundtrack.ts';
import { NO_PROGRESS } from '../src/game/level-progress.ts';
import { isRadioFound, loadSoundUnlock, NO_SOUND_UNLOCK, recordRadioFound } from '../src/game/sound-unlock.ts';
import { findCount, HIDDEN_LABEL, jukeboxEntries, musicEntries, playEntry, sfxEntries, sfxName, trackName } from '../src/game/sound-test.ts';
import type { Previewer } from '../src/game/sound-test.ts';

const ALL_FOUND: ReadonlySet<string> = new Set(LULLS.flatMap((playlist) => playlist.files));

function memoryStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

describe('the Radio unlock', () => {
  it('starts locked, and loads from an old save with nothing in it', () => {
    expect(loadSoundUnlock(memoryStore())).toEqual(NO_SOUND_UNLOCK);
    expect(loadSoundUnlock(memoryStore({ 'outbreak.level-progress': '{"highest":4,"finished":false}' }))).toEqual(NO_SOUND_UNLOCK);
  });

  it('survives a reload once found, and ignores a damaged save', () => {
    const store = memoryStore();
    recordRadioFound(store);
    expect(loadSoundUnlock(store).radio).toBe(true);
    expect(loadSoundUnlock(memoryStore({ 'outbreak.sound-unlock': '{nope' })).radio).toBe(false);
    expect(loadSoundUnlock(null).radio).toBe(false);
  });

  it('keeps the tracks the radios gave up, once each, in the order found', () => {
    const store = memoryStore();
    recordRadioFound(store, 'level-01-sunken-tomb.mp3');
    recordRadioFound(store, 'level-02-the-abattoir.mp3');
    recordRadioFound(store, 'level-01-sunken-tomb.mp3');
    expect(loadSoundUnlock(store).tracks).toEqual(['level-01-sunken-tomb.mp3', 'level-02-the-abattoir.mp3']);
    expect(loadSoundUnlock(memoryStore({ 'outbreak.sound-unlock': '{"tracks":[3,"a.mp3"]}' })).tracks).toEqual(['a.mp3']);
  });

  it('hands out a level\'s finds in order and then nothing', () => {
    const [, first, second] = LULLS[1].files;
    expect(lockedTracksOf(2, new Set())).toEqual(LULLS[1].files.slice(1));
    expect(lockedTracksOf(2, new Set([first]))[0]).toBe(second);
    expect(lockedTracksOf(2, ALL_FOUND)).toEqual([]);
  });

  it('does not touch the level progress it sits next to', () => {
    const store = memoryStore({ 'outbreak.level-progress': '{"highest":4,"finished":false}' });
    recordRadioFound(store);
    expect(store.getItem('outbreak.level-progress')).toBe('{"highest":4,"finished":false}');
  });

  it('is told by anyone\'s pickup of the Radio and nothing else', () => {
    const pickup = (what: string) => ({ type: 'pickup', playerId: 'someone-else', pickup: what, x: 0, y: 0 }) as never;
    expect(isRadioFound(pickup('radio'))).toBe(true);
    expect(isRadioFound(pickup('knife'))).toBe(false);
    expect(isRadioFound({ type: 'wave_clear', wave: 1 })).toBe(false);
  });
});

describe('the Sound Test lists', () => {
  it('names tracks from their files', () => {
    expect(trackName('level-02-metro-tunnels.mp3')).toBe('Metro Tunnels');
    expect(trackName('level-03-into-the-breach.mp3')).toBe('Into the Breach');
    expect(trackName('end-credits-surviving-the-night.mp3')).toBe('Surviving the Night');
    expect(sfxName('dry_click')).toBe('Dry Click');
  });

  it('holds every track the playlists name, and every sound in the table', () => {
    const files = musicEntries(NO_PROGRESS).map((entry) => entry.file);
    expect(files).toEqual(allTracks().map((track) => track.file));
    expect(files).toEqual(expect.arrayContaining(LULLS.flatMap((playlist) => playlist.files)));
    expect(sfxEntries().map((entry) => entry.sfx)).toEqual(SFX_NAMES);
  });

  it('shows only level 1\'s tracks by name at the start, the rest as ???', () => {
    const entries = musicEntries(NO_PROGRESS);
    const named = entries.filter((entry) => entry.unlocked).map((entry) => entry.where);
    expect(named).toEqual(expect.arrayContaining(['TITLE', 'HORDE', 'ONE LAKE CITY']));
    expect(named).not.toContain('TWOPORT');
    expect(named).not.toContain('VICTORY');
    for (const entry of entries.filter((each) => !each.unlocked)) expect(entry.label).toBe(HIDDEN_LABEL);
  });

  it('opens a level\'s tracks once it is reached', () => {
    const entries = musicEntries({ highest: 3, finished: false }, 'arcade', new Set(LULLS[2].files));
    expect(entries.filter((entry) => entry.where === 'THREE SUNS').every((entry) => entry.unlocked)).toBe(true);
    expect(entries.filter((entry) => entry.where === 'FOURKATELLO').some((entry) => entry.unlocked)).toBe(false);
  });

  it('opens victory and credits only on finishing the game, and then everything', () => {
    const early = musicEntries({ highest: FINAL_LEVEL, finished: false });
    expect(early.filter((entry) => entry.where === 'VICTORY' || entry.where === 'CREDITS').some((entry) => entry.unlocked)).toBe(false);
    const done = musicEntries({ highest: FINAL_LEVEL, finished: true }, 'arcade', ALL_FOUND);
    expect(done.every((entry) => entry.unlocked && entry.label === entry.name)).toBe(true);
    expect(FIRST_LEVEL).toBe(1);
  });

  it('keeps a level\'s finds as ??? until a Radio gives them up, and counts what is missing', () => {
    const progress = { highest: FINAL_LEVEL, finished: true };
    const none = musicEntries(progress, 'arcade', new Set());
    const finds = none.filter((entry) => entry.find);
    expect(finds.length).toBe(LULLS.reduce((sum, playlist) => sum + playlist.files.length - 1, 0));
    for (const entry of finds) expect(entry.label).toBe(HIDDEN_LABEL);
    expect(none.filter((entry) => entry.where === 'THREE SUNS' && !entry.find).every((entry) => entry.unlocked)).toBe(true);
    expect(findCount(none)).toEqual({ found: 0, total: finds.length });
    const one = musicEntries(progress, 'arcade', new Set([LULLS[2].files[1]]));
    expect(findCount(one)).toEqual({ found: 1, total: finds.length });
    expect(one.find((entry) => entry.file === LULLS[2].files[1])?.label).toBe('Factory Raid');
  });

  it('lets the bunker jukebox play only what has been heard or found', () => {
    const progress = { highest: 3, finished: false };
    const found = new Set([LULLS[2].files[1]]);
    const entries = jukeboxEntries(progress, found);
    expect(entries.every((entry) => entry.unlocked)).toBe(true);
    expect(entries.map((entry) => entry.file)).toContain(LULLS[2].files[1]);
    expect(entries.map((entry) => entry.file)).not.toContain(LULLS[2].files[2]);
    expect(entries.map((entry) => entry.file)).not.toContain(LULLS[3].files[0]);
  });

  it('opens every sound effect without a Radio', () => {
    expect(sfxEntries().every((entry) => entry.unlocked)).toBe(true);
  });
});

describe('playing from the Sound Test', () => {
  const audio = () => ({ previewTrack: vi.fn(() => true), previewSfx: vi.fn(() => true) }) satisfies Previewer;

  it('plays a track by its file and a sound by its key', () => {
    const player = audio();
    const track = musicEntries(NO_PROGRESS).find((entry) => entry.unlocked);
    const sound = sfxEntries()[0];
    expect(playEntry(track!, player, () => undefined)).toBe(true);
    expect(playEntry(sound, player, () => undefined)).toBe(true);
    expect(player.previewTrack).toHaveBeenCalledWith(track!.file, expect.any(Function));
    expect(player.previewSfx).toHaveBeenCalledWith(sound.sfx, expect.any(Function));
  });

  it('will not play a locked track', () => {
    const player = audio();
    const locked = musicEntries(NO_PROGRESS).find((entry) => !entry.unlocked)!;
    expect(playEntry(locked, player, () => undefined)).toBe(false);
    expect(player.previewTrack).not.toHaveBeenCalled();
  });
});

class FakeElement {
  currentTime = 0;
  paused = true;
  preload = '';
  private readonly listeners = new Map<string, () => void>();

  constructor(readonly src: string) {}

  play(): Promise<void> {
    this.paused = false;
    return Promise.resolve();
  }

  pause(): void {
    this.paused = true;
  }

  addEventListener(type: string, listener: () => void): void {
    this.listeners.set(type, listener);
  }

  fire(type: string): void {
    this.listeners.get(type)?.();
  }
}

describe('auditioning a track', () => {
  const make = () => {
    vi.useFakeTimers();
    const made: FakeElement[] = [];
    const node = () => ({ connect: vi.fn(), gain: { value: 0, setTargetAtTime: vi.fn() } });
    const ctx = { currentTime: 0, createGain: node, createMediaElementSource: node } as unknown as AudioContext;
    const music = new Soundtrack(ctx, {} as AudioNode, () => undefined, ((src: string) => {
      const element = new FakeElement(src);
      made.push(element);
      return element;
    }) as never);
    const playing = () => made.filter((element) => !element.paused).map((element) => element.src);
    return { music, made, playing };
  };

  it('steps the title music aside, plays one track, and brings the title back when it ends', () => {
    const { music, playing } = make();
    music.setScene('menu');
    expect(playing()).toEqual(['music/silent-ruins-variation.mp3']);
    music.hush();
    vi.runAllTimers();
    expect(playing()).toEqual([]);
    music.audition('horde-attack.mp3', () => undefined);
    expect(playing()).toEqual(['music/horde-attack.mp3']);
    music.stopAudition();
    vi.runAllTimers();
    expect(playing()).toEqual(['music/silent-ruins-variation.mp3']);
  });

  it('plays one thing at a time, and Stop leaves it quiet', () => {
    const { music, playing } = make();
    music.setScene('menu');
    music.hush();
    music.audition('horde-attack.mp3', () => undefined);
    music.audition('victory-dark-salvation.mp3', () => undefined);
    vi.runAllTimers();
    expect(playing()).toEqual(['music/victory-dark-salvation.mp3']);
    music.silence();
    vi.runAllTimers();
    expect(playing()).toEqual([]);
  });

  it('reports a track that plays out, and holds off the scene\'s changes while it is up', () => {
    const { music, made, playing } = make();
    const ended = vi.fn();
    music.setScene('menu');
    music.hush();
    music.audition('horde-attack.mp3', ended);
    music.setScene('wave');
    music.setLevel(5);
    vi.runAllTimers();
    expect(playing()).toEqual(['music/horde-attack.mp3']);
    made.find((element) => element.src === 'music/horde-attack.mp3')?.fire('ended');
    expect(ended).toHaveBeenCalledTimes(1);
    vi.runAllTimers();
    expect(playing()).toEqual([]);
  });
});
