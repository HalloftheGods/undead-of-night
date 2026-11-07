// Per-IP limits (spec: Privacy and child safety). Pure: the Lobby holds one limiter in memory and passes the clock.
// Keys are an HMAC of the IP with a salt that changes every UTC day and is never written down.

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

export type LimitedAction = 'create' | 'match' | 'lookup' | 'connect' | 'turn';

interface Window {
  readonly limit: number;
  readonly ms: number;
}

export const LIMITS: Readonly<Record<LimitedAction, readonly Window[]>> = {
  create: [{ limit: 6, ms: HOUR_MS }],
  match: [{ limit: 30, ms: MINUTE_MS }],
  lookup: [
    { limit: 20, ms: MINUTE_MS },
    { limit: 100, ms: HOUR_MS },
  ],
  connect: [{ limit: 10, ms: MINUTE_MS }],
  turn: [{ limit: 6, ms: HOUR_MS }],
};

/** Rooms one IP may have open at once. */
export const MAX_LIVE_ROOMS_PER_IP = 2;
/** A missed code lookup costs this much, so guessing codes runs out twice as fast. */
export const LOOKUP_MISS_COST = 2;

const longest = (action: LimitedAction): number => Math.max(...LIMITS[action].map((each) => each.ms));

export class RateLimiter {
  /** `${action} ${key}` to the times of each hit, oldest first. */
  private readonly hits = new Map<string, number[]>();

  /** Spends `cost` hits if every window has room for them, and says whether it did. */
  take(key: string, action: LimitedAction, now: number, cost = 1): boolean {
    const slot = `${action} ${key}`;
    const times = this.pruned(slot, action, now);
    const fits = LIMITS[action].every((each) => times.filter((at) => at > now - each.ms).length + cost <= each.limit);
    if (fits) this.hits.set(slot, [...times, ...Array<number>(cost).fill(now)]);
    return fits;
  }

  /** Spends hits whether or not they fit: a miss is charged after the answer is known. */
  charge(key: string, action: LimitedAction, now: number, cost = 1): void {
    const slot = `${action} ${key}`;
    this.hits.set(slot, [...this.pruned(slot, action, now), ...Array<number>(cost).fill(now)]);
  }

  /** Drops every key with nothing left in its longest window. */
  sweep(now: number): void {
    for (const slot of [...this.hits.keys()]) {
      const action = slot.slice(0, slot.indexOf(' ')) as LimitedAction;
      const isSlotIdle = this.pruned(slot, action, now).length === 0;
      if (isSlotIdle) this.hits.delete(slot);
    }
  }

  clear(): void {
    this.hits.clear();
  }

  get size(): number {
    return this.hits.size;
  }

  private pruned(slot: string, action: LimitedAction, now: number): number[] {
    const since = now - longest(action);
    const times = (this.hits.get(slot) ?? []).filter((at) => at > since);
    if (times.length) this.hits.set(slot, times);
    else this.hits.delete(slot);
    return times;
  }
}

/** The UTC day a salt belongs to. */
export const saltDay = (now: number): number => Math.floor(now / (24 * HOUR_MS));

/** Hex HMAC-SHA-256 of the IP, cut to 32 characters: enough to tell IPs apart, useless without the salt. */
export async function ipKey(salt: CryptoKey, ip: string): Promise<string> {
  const mac = await crypto.subtle.sign('HMAC', salt, new TextEncoder().encode(ip));
  return [...new Uint8Array(mac)]
    .slice(0, 16)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function newSalt(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'HMAC', hash: 'SHA-256' }, false, ['sign']) as Promise<CryptoKey>;
}
