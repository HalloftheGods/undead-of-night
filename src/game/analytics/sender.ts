/**
 * The one place that talks to Google. The Google script is injected here, at runtime, and only once the
 * player has said yes: until then, and after a no, this file makes no request of any kind. Every call is
 * wrapped so a blocked or failing script is silent, and nothing waits on it, so play is never affected.
 */
import { GOOGLE_TAG_URL, isLocalHost, MEASUREMENT_ID } from './analytics-config.ts';
import { allowedParams } from './catalog.ts';
import type { EventParams } from './catalog.ts';
import type { Consent, ConsentStatus } from './consent.ts';
import { clearAnalyticsCookies } from './cookies.ts';

/** The slice of the page the sender touches, so a test can stand in for the browser. */
export interface SenderPage {
  readonly hostname: string;
  readonly href: string;
  readonly cookies: { cookie: string };
  /** Where gtag and the opt-out flag live. */
  readonly globals: Record<string, unknown>;
  addScript(src: string): void;
}

export interface SenderOptions {
  readonly consent: Consent;
  readonly page: SenderPage | null;
  /** A dev build: nothing is sent, and what would be sent is logged instead. */
  readonly dev: boolean;
  readonly log?: (message: string, detail: unknown) => void;
}

export interface Sender {
  track(name: string, raw?: Readonly<Record<string, unknown>>): void;
}

/** Google must never be told which server a player is on: invite links carry it in the query. */
export function pageLocationOf(href: string): string {
  try {
    const url = new URL(href);
    return `${url.origin}${url.pathname}`;
  } catch {
    return '';
  }
}

const disableFlag = (id: string): string => `ga-disable-${id}`;

export function createSender(options: SenderOptions): Sender {
  const { consent, dev } = options;
  const hasNoPage = options.page === null;
  if (hasNoPage) return { track: () => undefined };
  const page: SenderPage = options.page;
  const log = options.log ?? ((message: string, detail: unknown) => console.debug(message, detail));
  const isBlockedHere = dev || isLocalHost(page.hostname);
  let loaded = false;

  function load(target: SenderPage): void {
    if (loaded) return;
    loaded = true;
    const layer: unknown[] = Array.isArray(target.globals.dataLayer) ? (target.globals.dataLayer as unknown[]) : [];
    target.globals.dataLayer = layer;
    // Google's snippet pushes the arguments object itself, so this must be a plain function.
    function gtag(..._args: unknown[]): void {
      // eslint-disable-next-line prefer-rest-params
      layer.push(arguments);
    }
    target.globals.gtag = gtag;
    gtag('js', new Date());
    gtag('config', MEASUREMENT_ID, {
      send_page_view: false,
      page_location: pageLocationOf(target.href),
      page_referrer: '',
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
    target.addScript(`${GOOGLE_TAG_URL}?id=${MEASUREMENT_ID}`);
  }

  function stop(target: SenderPage): void {
    target.globals[disableFlag(MEASUREMENT_ID)] = true;
    clearAnalyticsCookies(target.cookies, target.hostname, MEASUREMENT_ID);
  }

  function resume(target: SenderPage): void {
    target.globals[disableFlag(MEASUREMENT_ID)] = false;
    load(target);
  }

  function onConsent(status: ConsentStatus): void {
    try {
      if (isBlockedHere) return;
      const isYes = status !== 'denied';
      const turnsOn = isYes ? resume : stop;
      turnsOn(page);
    } catch {
      // chemx-allow: best-effort analytics must never reach play
    }
  }

  consent.subscribe(onConsent);
  // Analytics is on unless the player or their browser said no: the script loads with the page.
  if (consent.allowed()) onConsent('granted');

  function track(name: string, raw: Readonly<Record<string, unknown>> = {}): void {
    try {
      const params: EventParams | null = consent.allowed() ? allowedParams(name, raw) : null;
      const isUntracked = params === null;
      if (isUntracked) return;
      if (dev) log(`[analytics] would send ${name}`, params);
      if (isBlockedHere) return;
      load(page);
      const gtag = page.globals.gtag as ((...args: unknown[]) => void) | undefined;
      gtag?.('event', name, params);
    } catch {
      // chemx-allow: best-effort analytics must never reach play
    }
  }

  return { track };
}
