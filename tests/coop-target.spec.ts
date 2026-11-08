import { describe, expect, it } from 'vitest';
import { coopTarget } from '../src/network/play-api.ts';

describe('the co-op field', () => {
  it('hosts when blank and joins a room code, upper-cased, when online rooms are on', () => {
    expect(coopTarget('  ', true)).toEqual({ kind: 'host' });
    expect(coopTarget(' bcdfg ', true)).toEqual({ kind: 'join', code: 'BCDFG' });
  });

  it('says what is wrong with a word that is not a code, instead of trying it as a server', () => {
    const target = coopTarget('room123', true);
    expect(target.kind).toBe('bad');
    expect(target.kind === 'bad' && target.reason).toMatch(/letters only.*blank to host/i);
  });

  it('still reads something shaped like an address as a LAN server', () => {
    expect(coopTarget('192.168.1.5:8097', true)).toEqual({ kind: 'lan', address: '192.168.1.5:8097' });
    expect(coopTarget('lan-box:8097', true)).toEqual({ kind: 'lan', address: 'lan-box:8097' });
  });

  it('reads everything as a LAN address in a build without online rooms', () => {
    expect(coopTarget('room123', false)).toEqual({ kind: 'lan', address: 'room123' });
    expect(coopTarget('', false)).toEqual({ kind: 'lan', address: '' });
  });
});
