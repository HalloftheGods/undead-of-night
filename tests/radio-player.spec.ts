import { describe, expect, it } from 'vitest';
import {
  formatTrackTime,
  loadRadioFavorites,
  nextRepeatMode,
  nextTrackManual,
  nextTrackOnEnd,
  prevTrackManual,
  saveRadioFavorites,
  shuffleIndices,
  toggleFavoriteTrack,
} from '../src/game/radio-player.ts';

describe('radio player', () => {
  describe('formatTrackTime', () => {
    it('formats 0 seconds as 00:00', () => {
      expect(formatTrackTime(0)).toBe('00:00');
    });

    it('formats invalid numbers as 00:00', () => {
      expect(formatTrackTime(-5)).toBe('00:00');
      expect(formatTrackTime(NaN)).toBe('00:00');
      expect(formatTrackTime(Infinity)).toBe('00:00');
    });

    it('formats minutes and seconds with zero padding', () => {
      expect(formatTrackTime(5)).toBe('00:05');
      expect(formatTrackTime(65)).toBe('01:05');
      expect(formatTrackTime(195)).toBe('03:15');
    });
  });

  describe('nextRepeatMode', () => {
    it('cycles from off to all to one to off', () => {
      expect(nextRepeatMode('off')).toBe('all');
      expect(nextRepeatMode('all')).toBe('one');
      expect(nextRepeatMode('one')).toBe('off');
    });
  });

  describe('favorites storage', () => {
    it('loads empty set when storage has nothing', () => {
      const store = { getItem: () => null, setItem: () => undefined };
      expect(loadRadioFavorites(store)).toEqual(new Set());
    });

    it('loads saved favorites', () => {
      const saved = JSON.stringify(['level-01-streets.mp3', 'horde.mp3']);
      const store = { getItem: () => saved, setItem: () => undefined };
      expect(loadRadioFavorites(store)).toEqual(new Set(['level-01-streets.mp3', 'horde.mp3']));
    });

    it('toggles favorites adding and removing', () => {
      let held = '';
      const store = {
        getItem: () => held,
        setItem: (_k: string, val: string) => {
          held = val;
        },
      };

      const set1 = toggleFavoriteTrack('track-a.mp3', new Set(), store);
      expect(set1.has('track-a.mp3')).toBe(true);

      const set2 = toggleFavoriteTrack('track-a.mp3', set1, store);
      expect(set2.has('track-a.mp3')).toBe(false);
    });
  });

  describe('shuffleIndices', () => {
    it('returns an array containing all indices 0..length-1', () => {
      const result = shuffleIndices(5);
      expect(result).toHaveLength(5);
      expect(new Set(result)).toEqual(new Set([0, 1, 2, 3, 4]));
    });
  });

  describe('nextTrackOnEnd', () => {
    it('returns null on empty list', () => {
      const res = nextTrackOnEnd(0, 0, 'all', false, []);
      expect(res.nextIndex).toBeNull();
    });

    it('repeats same track if repeat mode is one', () => {
      const res = nextTrackOnEnd(2, 5, 'one', false, []);
      expect(res.nextIndex).toBe(2);
    });

    it('advances sequentially in standard mode', () => {
      const res = nextTrackOnEnd(2, 5, 'off', false, []);
      expect(res.nextIndex).toBe(3);
    });

    it('stops at end if repeat is off', () => {
      const res = nextTrackOnEnd(4, 5, 'off', false, []);
      expect(res.nextIndex).toBeNull();
    });

    it('loops to 0 at end if repeat is all', () => {
      const res = nextTrackOnEnd(4, 5, 'all', false, []);
      expect(res.nextIndex).toBe(0);
    });

    it('picks from shuffle queue when shuffle is on', () => {
      const res = nextTrackOnEnd(0, 5, 'all', true, [3, 2, 4]);
      expect(res.nextIndex).toBe(3);
      expect(res.nextQueue).toEqual([2, 4]);
    });
  });

  describe('nextTrackManual and prevTrackManual', () => {
    it('manual next wraps to 0 at end', () => {
      const res = nextTrackManual(4, 5, false, []);
      expect(res.nextIndex).toBe(0);
    });

    it('manual prev restarts track if currentTime > 3', () => {
      const res = prevTrackManual(2, 5, 4.5);
      expect(res).toBe(2);
    });

    it('manual prev goes to previous track if currentTime <= 3', () => {
      const res = prevTrackManual(2, 5, 1.2);
      expect(res).toBe(1);
    });

    it('manual prev wraps from 0 to last track', () => {
      const res = prevTrackManual(0, 5, 1.0);
      expect(res).toBe(4);
    });
  });
});
