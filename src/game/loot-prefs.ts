const AUTO_CLOSE_EMPTY_KEY = 'outbreak_autoclose_empty_loot';

export function loadAutoCloseEmptyLoot(): boolean {
  if (typeof localStorage === 'undefined') return true;
  try {
    const raw = localStorage.getItem(AUTO_CLOSE_EMPTY_KEY);
    return raw === null ? true : raw === 'true';
  } catch {
    return true;
  }
}

export function saveAutoCloseEmptyLoot(enabled: boolean): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(AUTO_CLOSE_EMPTY_KEY, String(enabled));
  } catch {
    // Ignore storage quota or access errors.
  }
}
