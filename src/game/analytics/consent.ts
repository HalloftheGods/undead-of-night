/**
 * Whether analytics is on for this browser. It is on unless the player turned it off or the browser sent
 * Global Privacy Control. The choice is kept per browser, apart from the other saves; 'unset' counts as on.
 */
import { shallowRef } from 'vue';
import type { ShallowRef } from 'vue';
import { CONSENT_KEY } from './analytics-config.ts';

export type ConsentStatus = 'unset' | 'granted' | 'denied';

type Store = Pick<Storage, 'getItem' | 'setItem'>;

function browserStore(): Store | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** The Global Privacy Control signal: the browser is already telling every site no. */
export function browserOptsOut(nav: object | undefined = globalThis.navigator): boolean {
  return (nav as { globalPrivacyControl?: boolean } | undefined)?.globalPrivacyControl === true;
}

export function loadConsent(store: Store | null = browserStore()): ConsentStatus {
  try {
    const saved = store?.getItem(CONSENT_KEY);
    return saved === 'granted' || saved === 'denied' ? saved : 'unset';
  } catch {
    return 'unset';
  }
}

function saveConsent(status: ConsentStatus, store: Store | null): void {
  try {
    store?.setItem(CONSENT_KEY, status);
  } catch {
    // chemx-allow: best-effort a choice that does not persist only means the default applies again next visit
  }
}

export interface ConsentOptions {
  readonly store?: Store | null;
  readonly optedOut?: boolean;
  /** Where the browser announces a change made in another tab: the window by default. */
  readonly events?: Pick<EventTarget, 'addEventListener'> | null;
}

export interface Consent {
  readonly status: ShallowRef<ConsentStatus>;
  /** The browser said no for the player, so analytics stays off and the toggle is disabled. */
  readonly optedOut: boolean;
  /** True unless the player turned it off, and never under a browser opt-out. */
  allowed(): boolean;
  grant(): void;
  deny(): void;
  /** Hears every change after it is made. */
  subscribe(listener: (status: ConsentStatus) => void): void;
}

export function createConsent(options: ConsentOptions = {}): Consent {
  const store = options.store === undefined ? browserStore() : options.store;
  const optedOut = options.optedOut ?? browserOptsOut();
  const status = shallowRef<ConsentStatus>(optedOut ? 'denied' : loadConsent(store));
  const listeners: ((status: ConsentStatus) => void)[] = [];

  function apply(next: ConsentStatus): void {
    status.value = next;
    for (const listener of listeners) listener(next);
  }

  function answer(next: ConsentStatus): void {
    if (optedOut) return;
    saveConsent(next, store);
    apply(next);
  }

  // A choice made in another tab applies here at once: a null key means the whole store was cleared.
  const events = options.events === undefined ? globalThis : options.events;
  events?.addEventListener?.('storage', (event) => {
    const { key } = event as StorageEvent;
    const mine = key === null || key === CONSENT_KEY;
    const next = loadConsent(store);
    const shouldApplyChoice = !optedOut && mine && next !== status.value;
    if (shouldApplyChoice) apply(next);
  });

  return {
    status,
    optedOut,
    allowed: () => status.value !== 'denied' && !optedOut,
    grant: () => answer('granted'),
    deny: () => answer('denied'),
    subscribe: (listener) => void listeners.push(listener),
  };
}

export const consent: Consent = createConsent();
