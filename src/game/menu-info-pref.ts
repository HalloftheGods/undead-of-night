/** Whether the main menu shows the one line under each item. Off by default: the labels say enough. */
import { browserStore, readJson, writeJson, type Store } from './storage.ts';

export const DEFAULT_MENU_INFO = false;

const MENU_INFO_KEY = 'outbreak.menuInfo';

/** The saved switch, or off for anything missing or unreadable. */
export function loadMenuInfo(store: Store | null = browserStore()): boolean {
  const saved = readJson(store, MENU_INFO_KEY);
  return typeof saved === 'boolean' ? saved : DEFAULT_MENU_INFO;
}

export function saveMenuInfo(on: boolean, store: Store | null = browserStore()): void {
  writeJson(store, MENU_INFO_KEY, on);
}
