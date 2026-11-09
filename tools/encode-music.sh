#!/bin/sh
# Re-encodes every public/music/*.mp3 to a sibling .ogg (Vorbis, quality 2 (about 96 kbps)).
# Repeatable: a track is skipped when its .ogg is newer than its .mp3. FORCE=1 redoes all.
# The MP3s stay: the loader falls back to them where a browser cannot play Ogg.
# Usage: sh tools/encode-music.sh [music-dir]   (default public/music; run from the app root)
set -eu

QUALITY="${QUALITY:-2}"
JOBS="${JOBS:-$(nproc 2>/dev/null || echo 2)}"

encode_one() {
  mp3="$1"
  ogg="${mp3%.mp3}.ogg"
  if [ "${FORCE:-0}" != "1" ] && [ -f "$ogg" ] && [ "$ogg" -nt "$mp3" ]; then
    echo "skip   $ogg"
    return 0
  fi
  # -vn drops cover art. No filters: nothing is trimmed or padded, so the track starts and ends where the MP3 does.
  # Written to a temp name first, so an interrupted run never leaves a half file that looks finished.
  tmp="${ogg}.part"
  if ffmpeg -nostdin -hide_banner -loglevel error -y -i "$mp3" -vn -map_metadata 0 -c:a libvorbis -q:a "$QUALITY" -f ogg "$tmp"; then
    mv "$tmp" "$ogg"
    echo "encode $ogg"
  else
    rm -f "$tmp"
    echo "FAILED $mp3" >&2
    return 1
  fi
}

# Worker mode: xargs re-invokes this script with --one <file>.
if [ "${1:-}" = "--one" ]; then
  encode_one "$2"
  exit $?
fi

DIR="${1:-public/music}"
command -v ffmpeg >/dev/null 2>&1 || { echo "ffmpeg not found" >&2; exit 1; }
ffmpeg -hide_banner -encoders 2>/dev/null | grep -q libvorbis || { echo "ffmpeg has no libvorbis" >&2; exit 1; }

export QUALITY FORCE
find "$DIR" -maxdepth 1 -name '*.mp3' | sort | xargs -P "$JOBS" -I{} sh "$0" --one {}
echo "done: $(find "$DIR" -maxdepth 1 -name '*.ogg' | wc -l) ogg, $(du -ch "$DIR"/*.ogg | tail -1 | cut -f1) total"
