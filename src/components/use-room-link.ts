// Copying a room's invite link, shared by the room card in town and the pause menu.
import { ref, onBeforeUnmount, type Ref } from 'vue';
import { buildRoomLink } from '../game/invite-link.ts';

export const COPY_LABELS = { idle: 'Copy invite link', done: 'Link copied', failed: 'Copy failed' } as const;
export type CopyState = keyof typeof COPY_LABELS;

/** The label goes back to "Copy invite link" after this long. */
const RESET_MS = 2000;

export function useRoomLink(room: () => string | null): { copied: Ref<CopyState>; copy: () => Promise<void> } {
  const copied = ref<CopyState>('idle');
  let timer: ReturnType<typeof setTimeout> | undefined;
  onBeforeUnmount(() => clearTimeout(timer));

  async function copy(): Promise<void> {
    const code = room();
    const link = code ? buildRoomLink(window.location.href, code) : null;
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      copied.value = 'done';
    } catch {
      copied.value = 'failed';
    }
    clearTimeout(timer);
    timer = setTimeout(() => (copied.value = 'idle'), RESET_MS);
  }

  return { copied, copy };
}
