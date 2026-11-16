import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SnapshotHandler } from '../src/game/snapshot-handler.ts';
import { TOSS_MS } from '../src/engine/toss-arc.ts';
import type { GameEvent } from '../shared/protocol.ts';

describe('SnapshotHandler delayed bottle smash', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('delays audio and visual fx for far thrown bottle smash until toss completes', () => {
    const audioEvents: GameEvent[] = [];
    const rendererEvents: GameEvent[] = [];

    const mockAudio = {
      handleEvent: (e: GameEvent) => audioEvents.push(e),
      setScene: () => {},
    };
    const mockRenderer = {
      handleEvent: (e: GameEvent) => rendererEvents.push(e),
    };
    const mockHost = {
      audio: mockAudio,
      renderer: mockRenderer,
      runHud: { callout: () => {}, townView: { markOpened: () => {} } },
      state: { world: null, runResult: null, testDrive: false },
    };

    const handler = new SnapshotHandler(mockHost as any, () => {});
    const smashEvent: GameEvent = {
      type: 'bottle_smash',
      playerId: 'p1',
      x: 100,
      y: 100,
      fromX: 10,
      fromY: 10,
    };
    const mockWorld = {
      localId: 'p1',
      predictor: { x: 10, y: 10 },
      localVehicleId: null,
    };

    handler.onGameEvent(smashEvent, mockWorld as any, 1000, null, null);

    expect(audioEvents).toHaveLength(0);
    expect(rendererEvents).toHaveLength(0);

    vi.advanceTimersByTime(TOSS_MS - 1);
    expect(audioEvents).toHaveLength(0);
    expect(rendererEvents).toHaveLength(0);

    vi.advanceTimersByTime(2);
    expect(audioEvents).toEqual([smashEvent]);
    expect(rendererEvents).toEqual([smashEvent]);
  });
});
