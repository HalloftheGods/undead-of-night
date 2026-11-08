/**
 * Which file of a track the browser is given. The playlists name the MP3; every MP3 has an OGG beside it
 * (tools/encode-music.sh), which is smaller. Ogg Vorbis goes first where the browser says it can play it,
 * and the MP3 stays the answer everywhere else, so a browser that cannot decode Ogg still has music.
 */
export type MusicFormat = 'ogg' | 'mp3';

const OGG_TYPE = 'audio/ogg; codecs="vorbis"';

/** The slice of an audio element this reads, so a spec can stand in for one. */
export interface FormatProbe {
  canPlayType(type: string): string;
}

/** "maybe" and "probably" both mean the browser will try; only the empty string means it will not. */
export function canPlayOgg(probe: FormatProbe | null): boolean {
  if (!probe) return false;
  try {
    return probe.canPlayType(OGG_TYPE) !== '';
  } catch {
    // chemx-allow: best-effort a probe that throws is one that cannot play it, and the MP3 serves
    return false;
  }
}

/** The format to ask for first in this browser. Without an audio element to ask (no DOM), the MP3 stays. */
export function preferredFormat(probe: FormatProbe | null = defaultProbe()): MusicFormat {
  return canPlayOgg(probe) ? 'ogg' : 'mp3';
}

function defaultProbe(): FormatProbe | null {
  return typeof Audio === 'undefined' ? null : new Audio();
}

/** The path of a playlist file in a format: 'horde-attack.mp3' in 'ogg' is 'music/horde-attack.ogg'. */
export function musicSrc(file: string, format: MusicFormat): string {
  const stem = file.replace(/\.(mp3|ogg)$/i, '');
  return `music/${stem}.${format}`;
}
