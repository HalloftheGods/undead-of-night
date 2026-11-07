import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../shared/protocol.ts';
import { CHAIN_WINDOW_MS, chainWords, CLOSE_CALL_REPEAT_MS, FREEZE_MS, KillJuice } from '../src/game/kill-juice.ts';
import { BOSSES } from '../shared/bosses.ts';
import type { BossId } from '../shared/protocol.ts';

const ME = 'me';

function kill(killerId: string | null, zombieType: 'walker' | 'brute' = 'walker', zombieId = 'z1'): GameEvent {
  return { type: 'zombie_die', zombieId, zombieType, x: 0, y: 0, angle: 0, killerId, points: 10 };
}

const headshot: GameEvent = { type: 'headshot', playerId: ME, zombieId: 'z1', zombieType: 'walker', x: 0, y: 0, angle: 0, points: 20 };
const cleared: GameEvent = { type: 'wave_clear', wave: 1 };

describe('kill juice', () => {
  it('names chains by length, then counts', () => {
    expect(chainWords(1)).toBeNull();
    expect(chainWords(2)).toBe('DOUBLE');
    expect(chainWords(4)).toBe('QUAD');
    expect(chainWords(7)).toBe('MASSACRE x7');
  });

  it('gives a lone kill nothing, and a second kill in the window a DOUBLE', () => {
    const juice = new KillJuice();
    expect(juice.read([kill(ME)], ME, 1, 0)).toBeNull();
    const beat = juice.read([kill(ME)], ME, 1, CHAIN_WINDOW_MS - 1);
    expect(beat?.callout).toEqual({ text: 'DOUBLE', tone: 'chain' });
    expect(beat?.freezeMs).toBe(FREEZE_MS.chain);
  });

  it('starts the chain again after the window', () => {
    const juice = new KillJuice();
    juice.read([kill(ME)], ME, 1, 0);
    expect(juice.read([kill(ME)], ME, 1, CHAIN_WINDOW_MS + 1)).toBeNull();
  });

  it('counts several kills in one snapshot, like a shotgun blast', () => {
    const juice = new KillJuice();
    expect(juice.read([kill(ME), kill(ME, 'walker', 'z2'), kill(ME, 'walker', 'z3')], ME, 1, 0)?.callout?.text).toBe('TRIPLE');
  });

  it('ignores other players\' kills', () => {
    const juice = new KillJuice();
    juice.read([kill('them')], ME, 1, 0);
    expect(juice.read([kill('them')], ME, 1, 10)).toBeNull();
  });

  it('holds the frame for a headshot and longer for a brute', () => {
    const juice = new KillJuice();
    expect(juice.read([headshot], ME, 1, 0)?.freezeMs).toBe(FREEZE_MS.headshot);
    expect(juice.read([kill(ME, 'brute')], ME, 1, 10_000)?.freezeMs).toBe(FREEZE_MS.brute);
  });

  it('calls a close call once in a while, on a kill at low health', () => {
    const juice = new KillJuice();
    expect(juice.read([kill(ME)], ME, 0.1, 0)?.callout).toEqual({ text: 'CLOSE CALL', tone: 'close' });
    expect(juice.read([kill(ME)], ME, 0.1, 5_000)).toBeNull();
    expect(juice.read([kill(ME)], ME, 0.1, CLOSE_CALL_REPEAT_MS + 1)?.callout?.text).toBe('CLOSE CALL');
  });

  it('marks a horde wiped out only when its last zombie fell that tick', () => {
    const juice = new KillJuice();
    expect(juice.read([cleared], ME, 1, 0)).toBeNull();
    const beat = juice.read([kill('them'), cleared], ME, 1, 100);
    expect(beat).toMatchObject({ hordeWiped: true, freezeMs: FREEZE_MS.hordeWiped, callout: null });
    expect(beat!.flash).toBeGreaterThan(0);
  });
});

describe('kill juice on a boss', () => {
  const bossDown: GameEvent = { type: 'boss_down', boss: Object.keys(BOSSES)[0] as BossId, x: 0, y: 0 };

  it('holds the frame longest and flashes, whoever landed the kill', () => {
    const juice = new KillJuice();
    const beat = juice.read([kill('someone-else', 'brute'), bossDown], ME, 1, 0);
    expect(beat?.freezeMs).toBe(FREEZE_MS.boss);
    expect(beat?.flash).toBeGreaterThan(0);
  });

  it('keeps the boss hold when the same snapshot wipes the horde', () => {
    const juice = new KillJuice();
    const beat = juice.read([kill(ME, 'brute'), bossDown, cleared], ME, 1, 0);
    expect(beat?.hordeWiped).toBe(true);
    expect(beat?.freezeMs).toBe(FREEZE_MS.boss);
  });
});
