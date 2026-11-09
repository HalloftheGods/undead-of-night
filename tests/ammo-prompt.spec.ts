import { describe, expect, it } from 'vitest';
import type { WeaponId } from '../shared/protocol.ts';
import { ammoPrompt } from '../src/engine/ammo-prompt.ts';

type Rounds = Partial<Record<WeaponId, number>>;

function shooter(over: { weapon?: WeaponId; ammo?: number; owned?: WeaponId[]; bag?: Rounds; mags?: Rounds; knife?: boolean; reload?: number; status?: 'alive' | 'downed' | 'dead' } = {}) {
  const zero = { pistol: 0, carbine: 0, shotgun: 0 };
  return {
    status: over.status ?? 'alive',
    weapon: over.weapon ?? 'carbine',
    ammo: over.ammo ?? 0,
    owned: over.owned ?? ['pistol', 'carbine'],
    ammoBag: { ...zero, ...over.bag },
    mags: { ...zero, ...over.mags },
    knife: over.knife ?? false,
    reload: over.reload ?? 0,
  } as const;
}

const keys = { touch: false, atHome: false, time: 0 };

describe('the dry-gun call over the head', () => {
  it('says nothing while the gun still fires', () => {
    expect(ammoPrompt(shooter({ ammo: 3, mags: { carbine: 3 } }), keys)).toBeNull();
  });

  it('calls a reload when the magazine is out and spares are in the bag', () => {
    expect(ammoPrompt(shooter({ bag: { carbine: 20 } }), keys)?.text).toBe('R: RELOAD!');
  });

  it('goes quiet once the reload is under way', () => {
    expect(ammoPrompt(shooter({ bag: { carbine: 20 }, reload: 0.3 }), keys)).toBeNull();
  });

  it('names the key and gun to swap to when the one in hand has nothing left', () => {
    expect(ammoPrompt(shooter({ bag: { pistol: 12 } }), keys)?.text).toBe('1: PISTOL');
    expect(ammoPrompt(shooter({ weapon: 'pistol', owned: ['pistol', 'shotgun'], mags: { shotgun: 2 } }), keys)?.text).toBe('3: SHOTGUN');
  });

  it('skips guns not carried', () => {
    expect(ammoPrompt(shooter({ owned: ['carbine'], bag: { pistol: 12 } }), keys)?.text).toBe('F: SHOVE');
  });

  it('falls back to the shove, or the stab with a knife, when every gun is empty', () => {
    expect(ammoPrompt(shooter(), keys)?.text).toBe('F: SHOVE');
    expect(ammoPrompt(shooter({ knife: true }), keys)?.text).toBe('F: STAB');
  });

  it('drops the key for fingers', () => {
    expect(ammoPrompt(shooter({ bag: { carbine: 5 } }), { ...keys, touch: true })?.text).toBe('RELOAD!');
    expect(ammoPrompt(shooter({ bag: { pistol: 5 } }), { ...keys, touch: true })?.text).toBe('PISTOL');
  });

  it('stays quiet at home and when not on their feet', () => {
    expect(ammoPrompt(shooter({ bag: { carbine: 5 } }), { ...keys, atHome: true })).toBeNull();
    expect(ammoPrompt(shooter({ bag: { carbine: 5 }, status: 'downed' }), keys)).toBeNull();
  });

  it('flashes, lit more than dark', () => {
    const lit = Array.from({ length: 100 }, (_, i) => ammoPrompt(shooter({ bag: { carbine: 5 } }), { ...keys, time: i / 100 })!.lit);
    const share = lit.filter(Boolean).length / lit.length;
    expect(share).toBeGreaterThan(0.5);
    expect(share).toBeLessThan(1);
  });
});
