import { existsSync, readdirSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { canPlayOgg, musicSrc, preferredFormat } from '../src/audio/music-format.ts';
import type { MusicFormat } from '../src/audio/music-format.ts';
import { LULLS, allTracks, playlistFor } from '../src/audio/playlists.ts';
import { Soundtrack } from '../src/audio/soundtrack.ts';
import { isShellFile } from '../tools/vite-pwa.ts';

const probe = (answer: string) => ({ canPlayType: vi.fn(() => answer) });

class FakeElement {
  currentTime = 0;
  paused = true;
  preload = '';
  loads = 0;
  private readonly listeners = new Map<string, () => void>();

  constructor(public src: string) {}

  play(): Promise<void> {
    this.paused = false;
    return Promise.resolve();
  }

  pause(): void {
    this.paused = true;
  }

  load(): void {
    this.loads++;
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

describe('choosing the music format', () => {
  it('prefers Ogg when the browser says it can play it, even only maybe', () => {
    expect(preferredFormat(probe('probably'))).toBe('ogg');
    expect(preferredFormat(probe('maybe'))).toBe('ogg');
  });

  it('asks for Vorbis in an Ogg container', () => {
    const asked = probe('maybe');
    canPlayOgg(asked);
    expect(asked.canPlayType).toHaveBeenCalledWith('audio/ogg; codecs="vorbis"');
  });

  it('stays on the MP3 when the browser cannot play Ogg, cannot be asked, or throws', () => {
    expect(preferredFormat(probe(''))).toBe('mp3');
    expect(preferredFormat(null)).toBe('mp3');
    expect(preferredFormat({ canPlayType: () => { throw new Error('no'); } })).toBe('mp3');
  });

  it('names the file of a playlist entry in either format', () => {
    expect(musicSrc('horde-attack.mp3', 'ogg')).toBe('music/horde-attack.ogg');
    expect(musicSrc('horde-attack.mp3', 'mp3')).toBe('music/horde-attack.mp3');
    expect(musicSrc('horde-attack.ogg', 'mp3')).toBe('music/horde-attack.mp3');
  });
});

describe('the files behind the playlists', () => {
  it('has an Ogg beside every MP3 it names, so the preferred format never 404s', () => {
    const files = allTracks('arcade').map((track) => track.file);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(existsSync(`public/${musicSrc(file, 'ogg')}`), `${file} ogg`).toBe(true);
      expect(existsSync(`public/${musicSrc(file, 'mp3')}`), `${file} mp3`).toBe(true);
    }
  });

  it('has no Ogg that no MP3 fallback backs', () => {
    const ogg = readdirSync('public/music').filter((name) => name.endsWith('.ogg'));
    expect(ogg.length).toBeGreaterThan(0);
    for (const name of ogg) expect(existsSync(`public/music/${name.replace(/\.ogg$/, '.mp3')}`), name).toBe(true);
  });
});

describe('the soundtrack format', () => {
  let made: FakeElement[];
  let available: boolean[];

  const soundtrack = (format?: MusicFormat) =>
    new Soundtrack(fakeContext(), {} as AudioNode, (on) => available.push(on), ((src: string) => {
      const element = new FakeElement(src);
      made.push(element);
      return element;
    }) as never, format);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => undefined });
    made = [];
    available = [];
  });

  it('asks for the Ogg files when Ogg is the format', () => {
    const music = soundtrack('ogg');
    music.setScene('menu');
    expect(made.map((element) => element.src)).toEqual(['music/silent-ruins-variation.ogg']);
  });

  it('asks for the MP3 files when the browser cannot play Ogg', () => {
    const music = soundtrack('mp3');
    music.setScene('menu');
    expect(made.map((element) => element.src)).toEqual(['music/silent-ruins-variation.mp3']);
  });

  it('loads only the playing level\'s music, never the rest of the library', () => {
    const music = soundtrack('ogg');
    music.setLevel(3);
    music.setScene('intermission');
    music.setScene('wave');
    // The soundtrack opens on the menu, so its track is requested too; nothing outside these playlists may be.
    const allowed = new Set([
      ...playlistFor('menu', 3).files,
      ...LULLS[2].files,
      ...playlistFor('wave', 3).files,
    ].map((file) => musicSrc(file, 'ogg')));
    const asked = made.map((element) => element.src);
    for (const src of asked) expect(allowed.has(src), src).toBe(true);
    expect(asked.length).toBeLessThan(allTracks().length / 10);
  });

  it('falls back to that track\'s MP3 once when its Ogg fails, and keeps the music available', () => {
    const music = soundtrack('ogg');
    music.setScene('menu');
    const [element] = made;
    element.fire('error');
    expect(element.src).toBe('music/silent-ruins-variation.mp3');
    expect(element.loads).toBe(1);
    expect(element.paused).toBe(false);
    expect(available).toEqual([]);
    element.fire('error');
    expect(available).toEqual([false]);
    expect(element.loads).toBe(1);
  });

  it('does not try another format when the MP3 itself fails', () => {
    const music = soundtrack('mp3');
    music.setScene('menu');
    made[0].fire('error');
    expect(made[0].src).toBe('music/silent-ruins-variation.mp3');
    expect(made[0].loads).toBe(0);
    expect(available).toEqual([false]);
  });

  it('keeps the same playlists whatever the format, so saved finds still match', () => {
    expect(playlistFor('menu', 1).files).toEqual(['silent-ruins-variation.mp3']);
  });
});

describe('the service worker precache', () => {
  it('leaves music of either format out of the shell', () => {
    expect(isShellFile('music/escalation.ogg')).toBe(false);
    expect(isShellFile('music/escalation.mp3')).toBe(false);
    expect(isShellFile('assets/index.js')).toBe(true);
  });
});
