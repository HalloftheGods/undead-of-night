import { existsSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FINAL_LEVEL, LEVELS } from '../shared/levels.ts';
import type { Scene } from '../src/audio/music.ts';
import { LULLS, playlistFor } from '../src/audio/playlists.ts';
import { Soundtrack } from '../src/audio/soundtrack.ts';

const SCENES: readonly Scene[] = ['menu', 'intermission', 'wave', 'gameover', 'victory', 'credits'];

class FakeElement {
  currentTime = 0;
  duration = 180;
  paused = true;
  preload = '';
  refuses = false;
  private readonly listeners = new Map<string, () => void>();

  constructor(readonly src: string) {}

  play(): Promise<void> {
    if (this.refuses) return Promise.reject(new Error('NotAllowedError'));
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

function fakeContext() {
  const node = () => ({ connect: vi.fn(), gain: { value: 0, setTargetAtTime: vi.fn() } });
  return { currentTime: 0, createGain: node, createMediaElementSource: node } as unknown as AudioContext;
}

/** What the browser has found: the takes a Radio has given up. */
function holdFound(tracks: readonly string[]): void {
  const saved = JSON.stringify({ radio: tracks.length > 0, tracks });
  vi.stubGlobal('localStorage', { getItem: () => saved, setItem: () => undefined });
}

describe('the soundtrack', () => {
  let made: FakeElement[];
  let available: boolean[];
  let music: Soundtrack;
  const playing = () => made.filter((element) => !element.paused).map((element) => element.src);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    holdFound(LULLS.flatMap((playlist) => playlist.files));
    made = [];
    available = [];
    music = new Soundtrack(fakeContext(), {} as AudioNode, (on) => available.push(on), ((src: string) => {
      const element = new FakeElement(src);
      made.push(element);
      return element;
    }) as never);
  });

  it('has a file behind every track it names', () => {
    const files = LEVELS.flatMap((level) => SCENES.flatMap((scene) => playlistFor(scene, level.number).files));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) expect(existsSync(`public/music/${file}`), file).toBe(true);
  });

  it('plays the scene, and lets the last one fade before stopping it', () => {
    music.setScene('menu');
    expect(playing()).toEqual(['music/silent-ruins-variation.mp3']);
    music.setScene('intermission');
    expect(playing()).toHaveLength(2);
    vi.runAllTimers();
    expect(playing()).toEqual(['music/silent-ruins.mp3']);
  });

  it('does not restart a track when the scene is set again', () => {
    music.setScene('intermission');
    made[0].currentTime = 40;
    music.setScene('intermission');
    expect(made).toHaveLength(1);
    expect(made[0].currentTime).toBe(40);
  });

  it('takes the lull up where it stopped, but starts each horde from the top on the other take', () => {
    music.setScene('intermission');
    const lull = made[0];
    lull.currentTime = 40;
    music.setScene('wave');
    const firstHorde = made[1];
    firstHorde.currentTime = 30;
    music.setScene('intermission');
    expect(lull.currentTime).toBe(40);
    music.setScene('wave');
    expect(made[2].src).not.toBe(firstHorde.src);
    music.setScene('intermission');
    music.setScene('wave');
    expect(firstHorde.currentTime).toBe(0);
  });

  it('fetches only the menu track up front, then only the one take a town plays', () => {
    music.setScene('menu');
    expect(made.map((element) => element.src)).toEqual(['music/silent-ruins-variation.mp3']);
    music.setLevel(3);
    music.setScene('intermission');
    expect(made.map((element) => element.src)).toEqual(['music/silent-ruins-variation.mp3', 'music/level-03-into-the-breach.mp3']);
  });

  it('fetches the horde track ahead of the horde without playing it, and plays that same file when it comes', () => {
    music.setScene('intermission');
    music.prefetch('wave');
    expect(made).toHaveLength(2);
    expect(made[1]).toMatchObject({ src: 'music/horde-attack.mp3', paused: true, preload: 'auto' });
    music.setScene('wave');
    expect(made).toHaveLength(2);
    expect(made[1].paused).toBe(false);
  });

  it('prefetches the take a lull will pick at random, so what loads is what plays', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.6);
    music.setScene('menu');
    music.prefetch('intermission');
    const fetched = made[1].src;
    music.setScene('intermission');
    expect(made).toHaveLength(2);
    expect(playing()).toContain(fetched);
  });

  it('prefetches nothing for the scene already playing, or while the Sound Test holds the music', () => {
    music.setScene('wave');
    music.prefetch('wave');
    expect(made).toHaveLength(1);
    music.hush();
    music.prefetch('intermission');
    expect(made).toHaveLength(1);
  });

  it('falls silent for game over', () => {
    music.setScene('wave');
    music.setScene('gameover');
    vi.runAllTimers();
    expect(playing()).toEqual([]);
  });

  it('survives a fade cut short by coming straight back', () => {
    music.setScene('intermission');
    music.setScene('wave');
    music.setScene('intermission');
    vi.runAllTimers();
    expect(playing()).toEqual(['music/level-01-abandoned-streets.mp3']);
  });

  it('moves on when a track ends, and ignores the end of one it has left', () => {
    music.setScene('wave');
    const first = made[0];
    first.fire('ended');
    expect(made[1].paused).toBe(false);
    first.fire('ended');
    expect(made).toHaveLength(2);
  });

  it('tries again after a browser refused to start before a gesture', async () => {
    music = new Soundtrack(fakeContext(), {} as AudioNode, () => undefined, ((src: string) => {
      const element = new FakeElement(src);
      element.refuses = true;
      made.push(element);
      return element;
    }) as never);
    music.setScene('menu');
    await Promise.resolve();
    expect(playing()).toEqual([]);
    made[0].refuses = false;
    music.retry();
    expect(playing()).toHaveLength(1);
  });

  it('says when it can carry the music, and when a file failed', () => {
    music.setScene('menu');
    made[0].fire('playing');
    made[0].fire('error');
    expect(available).toEqual([true, false]);
  });

  it('gives every level its own lull, in turn where it has multiple takes', () => {
    expect(LULLS).toHaveLength(FINAL_LEVEL);
    expect(playlistFor('intermission', 2).files).toEqual(['escalation.mp3', 'escalation-hard.mp3', 'level-02-metro-tunnels.mp3', 'level-02-the-abattoir.mp3', 'level-02-catacombs-of-anubis.mp3']);
    expect(playlistFor('intermission', 10).files).toEqual(['level-10-final-stand.mp3', 'level-10-final-evacuation.mp3', 'level-10-point-zero.mp3', 'level-10-point-zero-point-one.mp3', 'level-10-awakening-of-the-curse.mp3']);
    expect(playlistFor('intermission', 99)).toBe(playlistFor('intermission', FINAL_LEVEL));
    music.setLevel(7);
    music.setScene('intermission');
    music.setScene('wave');
    music.setScene('intermission');
    vi.runAllTimers();
    expect(playing()).toEqual(['music/level-07-quarantine-breach-alt.mp3']);
  });

  it('changes the lull when the town changes, but leaves a horde alone', () => {
    music.setScene('intermission');
    music.setLevel(3);
    vi.runAllTimers();
    expect(playing()).toEqual(['music/level-03-into-the-breach.mp3']);
    music.setScene('wave');
    music.setLevel(4);
    vi.runAllTimers();
    expect(playing()).toHaveLength(1);
    expect(playing()[0]).toContain('horde-attack');
  });

  it('starts a level on a random take and then plays the rest of its takes in turn', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    music.setLevel(3);
    music.setScene('intermission');
    vi.runAllTimers();
    const takes = playlistFor('intermission', 3).files;
    expect(takes.length).toBeGreaterThan(2);
    expect(playing()).toEqual([`music/${takes[takes.length - 1]}`]);
    made.find((element) => !element.paused)?.fire('ended');
    expect(playing()).toContain(`music/${takes[0]}`);
  });

  it('plays only a level\'s own take until a Radio gives up the others', () => {
    holdFound([]);
    for (const level of LEVELS) {
      const [own] = LULLS[level.number - 1].files;
      expect(playlistFor('intermission', level.number).files, `level ${level.number}`).toEqual([own]);
    }
    const second = LULLS[2].files[1];
    holdFound([second]);
    expect(playlistFor('intermission', 3).files).toEqual([LULLS[2].files[0], second]);
    expect(playlistFor('intermission', 3)).toBe(playlistFor('intermission', 3));
  });

  it('keeps every level on its own music', () => {
    for (const level of LEVELS) {
      const files = playlistFor('intermission', level.number).files;
      const tag = `level-${String(level.number).padStart(2, '0')}`;
      expect(files.filter((file) => file.includes(tag)).length, tag).toBeGreaterThanOrEqual(2);
    }
  });

  it('plays the victory theme and then the credits', () => {
    music.setScene('victory');
    expect(playing()).toEqual(['music/victory-dark-salvation.mp3']);
    music.setScene('credits');
    vi.runAllTimers();
    expect(playing()).toEqual(['music/end-credits-surviving-the-night.mp3']);
  });

  it('stops everything on dispose', () => {
    music.setScene('menu');
    music.dispose();
    expect(playing()).toEqual([]);
  });

  it('plays a Radio find in place of the scene, then hands the scene back when it ends', () => {
    music.setScene('intermission');
    music.playFound('level-01-sunken-tomb.mp3');
    vi.runAllTimers();
    expect(playing()).toEqual(['music/level-01-sunken-tomb.mp3']);
    music.setScene('intermission');
    expect(playing()).toEqual(['music/level-01-sunken-tomb.mp3']);
    made.find((element) => element.src.includes('sunken-tomb'))?.fire('ended');
    vi.runAllTimers();
    expect(playing()).toEqual(['music/level-01-abandoned-streets.mp3']);
  });

  it('lets a Radio find go when the scene changes', () => {
    music.setScene('intermission');
    music.playFound('level-01-sunken-tomb.mp3');
    music.setScene('wave');
    vi.runAllTimers();
    expect(playing().includes('music/level-01-sunken-tomb.mp3')).toBe(false);
    expect(playing()).toHaveLength(1);
  });
});
