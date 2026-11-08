// Sharing a room's invite link, for the room card in town and the pause menu. A phone opens its own share
// sheet (messages, chat apps); anything else copies the link.
import { computed, onBeforeUnmount, ref, type ComputedRef, type Ref } from 'vue';
import { buildRoomLink } from '../game/invite-link.ts';

export const COPY_LABELS = { idle: 'Copy invite link', done: 'Link copied', failed: 'Copy failed', share: 'Share invite link' } as const;
export type CopyState = 'idle' | 'done' | 'failed';

/** A phone with a share sheet shares; a desktop copies, since its share sheet is rarely where friends are. */
function sharesNatively(): boolean {
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  return canShare && (globalThis.matchMedia?.('(pointer: coarse)').matches ?? false);
}

/** The label goes back to "Copy invite link" after this long. */
const RESET_MS = 2000;

export function useRoomLink(room: () => string | null): { copied: Ref<CopyState>; label: ComputedRef<string>; copy: () => Promise<void> } {
  const copied = ref<CopyState>('idle');
  const shares = sharesNatively();
  const label = computed(() => (copied.value === 'idle' && shares ? COPY_LABELS.share : COPY_LABELS[copied.value]));
  let timer: ReturnType<typeof setTimeout> | undefined;
  onBeforeUnmount(() => clearTimeout(timer));

  async function copy(): Promise<void> {
    const code = room();
    const link = code ? buildRoomLink(window.location.href, code) : null;
    if (!link) return;
    if (shares) {
      try {
        await navigator.share({ title: 'Undead of Night', text: `Join my game of Undead of Night. Room ${code}.`, url: link });
        return;
      } catch (error) {
        // Closing the sheet is not a failure; anything else falls back to copying.
        if ((error as DOMException)?.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(link);
      copied.value = 'done';
    } catch {
      copied.value = 'failed';
    }
    clearTimeout(timer);
    timer = setTimeout(() => (copied.value = 'idle'), RESET_MS);
  }

  return { copied, label, copy };
}
