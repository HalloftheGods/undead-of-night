import { JOIN_TOKEN_MAX_LENGTH } from '../../shared/constants.ts';

const TOKEN_KEY = 'outbreak.token';
const TOKEN_BYTES = 16;

/** Where a token goes when the tab's storage is refused: it lasts as long as the page. */
let pageToken: string | null = null;

/** Not randomUUID: that only exists on https, and a LAN server is plain http. */
function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

const usable = (token: string | null): token is string =>
  token !== null && token.length > 0 && token.length <= JOIN_TOKEN_MAX_LENGTH;

/**
 * Names this tab to the server so a refresh picks up the same run. sessionStorage is what
 * gives that shape: it survives a refresh and is not shared with the next tab.
 */
export function tabToken(): string {
  try {
    const kept = sessionStorage.getItem(TOKEN_KEY);
    const isUsable = usable(kept);
    if (isUsable) return kept;
    const token = newToken();
    sessionStorage.setItem(TOKEN_KEY, token);
    return token;
  } catch {
    pageToken ??= newToken();
    return pageToken;
  }
}
