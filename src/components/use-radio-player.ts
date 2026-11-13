import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { loadFurthestProgress } from "../game/level-progress.ts";
import {
  loadRadioFavorites,
  nextRepeatMode,
  nextTrackManual,
  nextTrackOnEnd,
  prevTrackManual,
  toggleFavoriteTrack,
  type RepeatMode
} from "../game/radio-player.ts";
import { jukeboxEntries } from "../game/sound-test.ts";
import type { MusicEntry } from "../game/sound-test.ts";
import { useGame } from "./use-game.ts";

/**
 * The Radio's tape deck: which track is loaded, whether it plays, where it is, repeat, shuffle and favorites. Shared by
 * the Radio page and its canvas version. It starts the preview player on mount and stops it, with the keys, on unmount.
 */
export function useRadioPlayer() {
  const game = useGame();
  const progress = loadFurthestProgress();
  const tracks = jukeboxEntries(progress);

  const currentIndex = ref(0);
  const isPlaying = ref(false);
  const isPaused = ref(false);
  const currentTime = ref(0);
  const duration = ref(0);
  const repeatMode = ref<RepeatMode>("all");
  const isShuffle = ref(false);
  const shuffleQueue = ref<number[]>([]);
  const favorites = ref<Set<string>>(loadRadioFavorites());

  let isOpen = true;
  let animFrame: number | null = null;

  const currentTrack = computed(() => tracks[currentIndex.value] ?? null);
  const isCurrentFavorite = computed(() => {
    const track = currentTrack.value;
    if (!track) return false;
    return favorites.value.has(track.file);
  });

  function pollAudioStatus(): void {
    if (!isOpen) return;
    const status = game.audio.getPreviewStatus();
    if (status) {
      currentTime.value = status.currentTime;
      if (status.duration > 0) duration.value = status.duration;
      isPaused.value = status.paused;
    }
    animFrame = requestAnimationFrame(pollAudioStatus);
  }

  async function startPlayback(index: number): Promise<void> {
    const isValid = index >= 0 && index < tracks.length;
    if (!isValid) return;

    currentIndex.value = index;
    const entry = tracks[index];
    await game.audio.unlock();

    if (!isOpen) return;

    const started = game.audio.previewTrack(entry.file, () => {
      onTrackFinished(index);
    });

    if (started) {
      isPlaying.value = true;
      isPaused.value = false;
      currentTime.value = 0;
    }
  }

  function onTrackFinished(finishedIndex: number): void {
    const isStillOnTrack = currentIndex.value === finishedIndex;
    if (!isStillOnTrack || !isOpen) return;

    const result = nextTrackOnEnd(
      finishedIndex,
      tracks.length,
      repeatMode.value,
      isShuffle.value,
      shuffleQueue.value
    );

    shuffleQueue.value = [...result.nextQueue];

    if (result.nextIndex !== null) {
      void startPlayback(result.nextIndex);
    } else {
      isPlaying.value = false;
      isPaused.value = false;
      currentTime.value = 0;
    }
  }

  function onPlay(): void {
    if (isPaused.value) {
      game.audio.resumePreview();
      isPaused.value = false;
      return;
    }
    void startPlayback(currentIndex.value);
  }

  function onPause(): void {
    game.audio.pausePreview();
    isPaused.value = true;
  }

  function onStop(): void {
    game.audio.stopPreview();
    isPlaying.value = false;
    isPaused.value = false;
    currentTime.value = 0;
  }

  function onNext(): void {
    const result = nextTrackManual(
      currentIndex.value,
      tracks.length,
      isShuffle.value,
      shuffleQueue.value
    );
    shuffleQueue.value = [...result.nextQueue];
    void startPlayback(result.nextIndex);
  }

  function onPrev(): void {
    const prevIdx = prevTrackManual(currentIndex.value, tracks.length, currentTime.value);
    void startPlayback(prevIdx);
  }

  function onSeek(seconds: number): void {
    game.audio.seekPreview(seconds);
    currentTime.value = seconds;
  }

  function onSelectTrack(entry: MusicEntry): void {
    const idx = tracks.findIndex((t) => t.id === entry.id);
    const found = idx >= 0;
    if (!found) return;

    const isSame = idx === currentIndex.value && isPlaying.value;
    if (isSame) {
      if (isPaused.value) onPlay();
      else onPause();
      return;
    }

    void startPlayback(idx);
  }

  function onToggleRepeat(): void {
    repeatMode.value = nextRepeatMode(repeatMode.value);
  }

  function onToggleShuffle(): void {
    isShuffle.value = !isShuffle.value;
    shuffleQueue.value = [];
  }

  function onToggleFavorite(file: string): void {
    favorites.value = toggleFavoriteTrack(file, favorites.value);
  }

  function onToggleCurrentFavorite(): void {
    const track = currentTrack.value;
    if (!track) return;
    onToggleFavorite(track.file);
  }

  function onKey(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const isInput = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
    if (isInput) return;

    if (event.code === "Space") {
      event.preventDefault();
      if (isPlaying.value && !isPaused.value) onPause();
      else onPlay();
    }
  }

  onMounted(async () => {
    await game.audio.unlock();
    if (isOpen) {
      game.audio.enterPreview();
      pollAudioStatus();
    }
    window.addEventListener("keydown", onKey);
  });

  onBeforeUnmount(() => {
    isOpen = false;
    if (animFrame !== null) cancelAnimationFrame(animFrame);
    window.removeEventListener("keydown", onKey);
    game.audio.stopPreview();
    game.audio.leavePreview();
  });

  return {
    tracks,
    currentTrack,
    isPlaying,
    isPaused,
    currentTime,
    duration,
    repeatMode,
    isShuffle,
    favorites,
    isCurrentFavorite,
    onPlay,
    onPause,
    onStop,
    onNext,
    onPrev,
    onSeek,
    onSelectTrack,
    onToggleRepeat,
    onToggleShuffle,
    onToggleFavorite,
    onToggleCurrentFavorite
  };
}
