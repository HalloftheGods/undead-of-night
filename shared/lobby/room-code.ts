/**
 * Room codes for private rooms: short, spoken-aloud strings. The alphabet has no vowels (so no
 * words by accident) and no look-alikes (no I, L, O, digits), which leaves 16 letters.
 * Runtime-agnostic: only crypto.getRandomValues, so it runs in the browser, Node and a Worker.
 */

export const ROOM_CODE_ALPHABET = 'BCDFGHJKMNPRTVWX';
export const ROOM_CODE_LENGTH = 5;

/** Letter runs no code may contain. Vowel-free codes rarely spell anything, but these can still read badly. */
const BLOCKED_RUNS = ['FCK', 'CNT', 'DCK', 'KKK', 'NGR', 'FGT', 'WTF', 'BCH', 'HNJ', 'TTS'];

export type RoomCodeCheck = { ok: true; code: string } | { ok: false; reason: string };

export function isBlockedRoomCode(code: string): boolean {
  return BLOCKED_RUNS.some((run) => code.includes(run));
}

/** A fresh random code. Uniform: values past the last whole multiple of the alphabet are redrawn. */
export function generateRoomCode(length: number = ROOM_CODE_LENGTH): string {
  const size = ROOM_CODE_ALPHABET.length;
  const limit = 256 - (256 % size);
  for (;;) {
    let code = '';
    while (code.length < length) {
      for (const byte of crypto.getRandomValues(new Uint8Array(length * 2))) {
        const isUsableByte = byte < limit && code.length < length;
        if (isUsableByte) code += ROOM_CODE_ALPHABET[byte % size];
      }
    }
    if (!isBlockedRoomCode(code)) return code;
  }
}

/** Uppercases and trims typed input, then checks it. Digits, I, L and O get the 'letters only' message. */
export function normalizeRoomCode(raw: unknown, length: number = ROOM_CODE_LENGTH): RoomCodeCheck {
  const isNotText = typeof raw !== 'string';
  if (isNotText) return { ok: false, reason: 'Enter a room code.' };
  const code = raw.trim().toUpperCase();
  if (!code) return { ok: false, reason: 'Enter a room code.' };
  const hasNonLetters = /[^A-Z]|[ILO]/.test(code);
  if (hasNonLetters) return { ok: false, reason: 'Room codes are letters only.' };
  if ([...code].some((letter) => !ROOM_CODE_ALPHABET.includes(letter))) {
    return { ok: false, reason: 'That is not a room code.' };
  }
  const isWrongLength = code.length !== length;
  if (isWrongLength) return { ok: false, reason: `Room codes are ${length} letters.` };
  if (isBlockedRoomCode(code)) return { ok: false, reason: 'That is not a room code.' };
  return { ok: true, code };
}
