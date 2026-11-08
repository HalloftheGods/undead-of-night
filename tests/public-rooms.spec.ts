import { describe, expect, it, vi } from 'vitest';
import { matchRoom } from '../src/network/play-api.ts';
import { withoutNames } from '../src/network/strip-names.ts';
import type { MatchRequest } from '../shared/lobby/types.ts';
import type { SnapshotPacket } from '../shared/protocol.ts';

const answer = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status }));
const request: MatchRequest = { protocol: 2, style: 'arcade', difficulty: 'stay_close', character: 0 };

describe('Find a team asks the Lobby', () => {
  it('posts the match request and reads a join or a host', async () => {
    const join = answer(200, { kind: 'join', code: 'BCDFG', card: { code: 'BCDFG' } });
    expect(await matchRoom(request, 'https://api.test', join)).toMatchObject({ ok: true, match: { kind: 'join', code: 'BCDFG' } });
    expect(join).toHaveBeenCalledWith('https://api.test/v1/match', expect.objectContaining({ method: 'POST', body: JSON.stringify(request) }));
    const host = answer(200, { kind: 'host', code: 'KMPRT', hostKey: 'k' });
    expect(await matchRoom(request, 'https://api.test', host)).toEqual({ ok: true, match: { kind: 'host', code: 'KMPRT', hostKey: 'k' } });
  });

  it('turns busy, a refusal or a strange answer into words', async () => {
    for (const fetcher of [answer(200, { kind: 'busy' }), answer(500, {}), answer(200, { kind: 'host', code: 'nope' }), answer(200, { kind: 'join', code: 'AEIOU' })]) {
      expect(await matchRoom(request, 'https://api.test', fetcher)).toEqual({ ok: false, reason: expect.stringMatching(/busy/) });
    }
    expect(await matchRoom(request, 'https://api.test', answer(429, {}))).toEqual({ ok: false, reason: expect.stringMatching(/too many/i) });
  });
});

describe('a public room shows no callsigns', () => {
  it('blanks every name a snapshot carries, game over included', () => {
    const stats = { outcome: 'defeat', difficulty: 'normal', level: 2, wave: 3, durationSec: 60, players: [{ id: 'a', name: 'Rude', skin: 1, kills: 2, score: 9 }] };
    const packet = {
      players: [{ id: 'a', name: 'Rude', skin: 1 }],
      events: [{ type: 'game_over', stats }, { type: 'wave_clear', wave: 1 }],
      gameOver: stats,
    } as unknown as SnapshotPacket;
    const clean = withoutNames(packet);
    expect(clean.players[0]!.name).toBe('');
    expect(clean.gameOver!.players[0]!.name).toBe('');
    expect(clean.events[0]).toMatchObject({ stats: { players: [{ name: '' }] } });
    expect(clean.events[1]).toEqual({ type: 'wave_clear', wave: 1 });
    expect(packet.players[0]!.name).toBe('Rude');
  });
});
