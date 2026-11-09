import type { GameStyle } from '../../shared/game-style.ts';
import type { Scene } from './music.ts';
import { musicSrc, preferredFormat } from './music-format.ts';
import type { MusicFormat } from './music-format.ts';
import { playlistFor } from './playlists.ts';
import type { Playlist } from './playlists.ts';

/** Fade time constant in seconds; a track is inaudible after about three of these. */
const FADE_TC = 0.4;
const SILENT_AFTER_MS = 1600;

/** The parts of an audio element this class touches, so a spec can stand in for one. */
const firstTurn = (playlist: Playlist): number =>
  playlist.fromTop ? 0 : Math.floor(Math.random() * playlist.files.length);

export type TrackElement = Pick<HTMLAudioElement, 'currentTime' | 'paused' | 'preload' | 'play' | 'pause' | 'addEventListener' | 'src' | 'load'>;

interface Track {
  readonly file: string;
  readonly element: TrackElement;
  readonly gain: GainNode;
  silencing: ReturnType<typeof setTimeout> | null;
  /** Set once an Ogg file failed to load and the MP3 took its place, so a failing MP3 is not retried forever. */
  fellBack: boolean;
}

/**
 * The recorded music. Tracks stream through audio elements, since decoding three
 * minutes of each into memory would cost far more than the files, and pass through
 * the mixer so volume and mute still apply. If one will not load, onAvailable(false)
 * hands the scene back to the generated bed.
 *
 * A track is only fetched when a scene asks for it (an element is made on first use), so a level loads its own
 * take and nothing else: the menu asks for its one track, a town for the one take it plays. The horde's track is
 * asked for a little early by prefetch(), at the horde warning, so it is ready when the horde comes.
 * The file is the Ogg where the browser can play it, the MP3 where it cannot.
 */
export class Soundtrack {
  private readonly tracks = new Map<string, Track>();
  private readonly turns = new Map<Playlist, number>();
  private playlist: Playlist | null = null;
  private scene: Scene = 'menu';
  private level = 1;
  private style: GameStyle = 'arcade';
  private current: Track | null = null;
  /** Set while the Sound Test is playing one track on its own. */
  private auditionEnd: (() => void) | null = null;
  private readonly listening = new AbortController();

  constructor(
    private readonly ctx: AudioContext,
    private readonly out: AudioNode,
    private readonly onAvailable: (available: boolean) => void,
    private readonly makeElement: (src: string) => TrackElement & HTMLMediaElement = (src) => new Audio(src),
    private readonly format: MusicFormat = preferredFormat(),
  ) {}

  setScene(scene: Scene): void {
    this.scene = scene;
    this.retune();
  }

  /** The town being played picks the music between hordes. */
  setLevel(level: number): void {
    this.level = level;
    this.retune();
  }

  /** The run's style, which says what the bunker and level 6 play. */
  setStyle(style: GameStyle): void {
    this.style = style;
    this.retune();
  }

  /** Steps the scene's music aside, so the Sound Test starts quiet and plays only what is chosen. */
  hush(): void {
    this.auditionEnd ??= () => undefined;
    this.fadeOut(this.current);
    this.current = null;
  }

  /** Plays one file by itself, in place of any other. onEnd runs if it plays out. */
  audition(file: string, onEnd: () => void): void {
    this.hush();
    this.auditionEnd = onEnd;
    const track = this.trackFor(file);
    track.element.currentTime = 0;
    this.current = track;
    this.start(track);
  }

  /** Stops what is auditioning and stays quiet. */
  silence(): void {
    if (this.auditionEnd) this.auditionEnd = () => undefined;
    this.hush();
  }

  /** Ends the Sound Test's hold and brings the scene's music back. */
  stopAudition(): void {
    if (!this.auditionEnd) return;
    this.auditionEnd = null;
    this.fadeOut(this.current);
    this.current = null;
    this.playlist = null;
    this.retune();
  }

  private retune(): void {
    if (this.auditionEnd) return;
    const playlist = playlistFor(this.scene, this.level, this.style);
    const unchanged = playlist === this.playlist;
    if (unchanged) return;
    this.playlist = playlist;
    this.fadeOut(this.current);
    this.current = null;
    this.playNext();
  }

  /** Browsers refuse to start audio before a gesture, so each gesture tries again. */
  retry(): void {
    const stalled = this.current?.element.paused;
    if (stalled) this.start(this.current as Track);
  }

  /** Starts fetching the track a scene will open with, without playing it: the horde's, ahead of the horde. */
  prefetch(scene: Scene): void {
    if (this.auditionEnd) return;
    const playlist = playlistFor(scene, this.level, this.style);
    const nothingToFetch = playlist.files.length === 0 || playlist === this.playlist;
    if (nothingToFetch) return;
    this.trackFor(this.upcoming(playlist));
  }

  dispose(): void {
    this.listening.abort();
    for (const track of this.tracks.values()) {
      if (track.silencing) clearTimeout(track.silencing);
      track.element.pause();
    }
    this.tracks.clear();
    this.current = null;
    this.auditionEnd = null;
    this.playlist = null;
  }

  private playNext(): void {
    const playlist = this.playlist;
    const nothingToPlay = !playlist || playlist.files.length === 0;
    if (nothingToPlay) return;
    const track = this.trackFor(this.upcoming(playlist));
    this.turns.set(playlist, (this.turns.get(playlist) ?? 0) + 1);
    if (playlist.fromTop) track.element.currentTime = 0;
    this.current = track;
    this.start(track);
  }

  /** The file a playlist plays next. A level's first is a random one of its takes, chosen once; the rest follow in turn. */
  private upcoming(playlist: Playlist): string {
    const turn = this.turns.get(playlist) ?? firstTurn(playlist);
    this.turns.set(playlist, turn);
    return playlist.files[turn % playlist.files.length];
  }

  private trackFor(file: string): Track {
    const known = this.tracks.get(file);
    if (known) return known;
    const element = this.makeElement(musicSrc(file, this.format));
    element.preload = 'auto';
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    this.ctx.createMediaElementSource(element).connect(gain);
    gain.connect(this.out);
    const track: Track = { file, element, gain, silencing: null, fellBack: false };
    const { signal } = this.listening;
    element.addEventListener('playing', () => this.onAvailable(true), { signal });
    element.addEventListener('error', () => this.onFailed(track), { signal });
    element.addEventListener('ended', () => this.onEnded(track), { signal });
    this.tracks.set(file, track);
    return track;
  }

  /** An Ogg that will not load (a browser that said yes and cannot, or a missing file) gets its MP3 once. */
  private onFailed(track: Track): void {
    const canFallBack = this.format === 'ogg' && !track.fellBack;
    if (!canFallBack) return this.onAvailable(false);
    track.fellBack = true;
    track.element.src = musicSrc(track.file, 'mp3');
    track.element.load();
    const wanted = track === this.current;
    if (wanted) this.start(track);
  }

  private onEnded(track: Track): void {
    const stillOurs = track === this.current;
    if (!stillOurs) return;
    const playedOut = this.auditionEnd;
    if (playedOut) {
      this.silence();
      playedOut();
      return;
    }
    track.element.currentTime = 0;
    this.playNext();
  }

  private start(track: Track): void {
    if (track.silencing) clearTimeout(track.silencing);
    track.silencing = null;
    track.gain.gain.setTargetAtTime(1, this.ctx.currentTime, FADE_TC);
    // A refusal before the first gesture is not a failure: retry() covers it.
    void track.element.play().catch(() => undefined);
  }

  private fadeOut(track: Track | null): void {
    if (!track) return;
    track.gain.gain.setTargetAtTime(0, this.ctx.currentTime, FADE_TC);
    track.silencing = setTimeout(() => track.element.pause(), SILENT_AFTER_MS);
  }
}
