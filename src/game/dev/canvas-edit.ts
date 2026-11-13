import { ref } from 'vue';

/**
 * True while the Dev bench's canvas editor has the game canvas to itself: the title menu hides so the editor
 * is drawn and clicked on the game, full window, instead of on a second canvas over the page.
 */
export const canvasEditing = ref(false);
