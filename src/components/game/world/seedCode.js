// src/components/game/world/seedCode.js
//
// A universe you can hand to someone else.
//
// Mirrors the backend's utils/seedCode.js: that copy actually seeds a
// universe, this one validates what a player types before we spend a round
// trip on it, and formats a code for display.
//
// The property that matters: the code IS the seed. Typing a friend's code
// generates the identical cosmos - no shared table of codes, nothing that can
// drift apart between the two of you.

// No I, O, 0 or 1 - the four characters people get wrong off a screenshot.
export const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_RE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{3}-\d{4}$/;

export const isShareCode = (v) => typeof v === "string" && CODE_RE.test(v);

/**
 * Coerce player input into a canonical code, or null.
 * Forgiving about case, spaces, and a missing or doubled dash - the things
 * people actually get wrong when copying seven characters by hand.
 */
export function normalizeCode(input) {
  if (typeof input !== "string") return null;
  const cleaned = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (cleaned.length !== 7) return null;

  const letters = cleaned.slice(0, 3);
  const digits = cleaned.slice(3);
  if (!/^\d{4}$/.test(digits)) return null;
  if (![...letters].every((c) => ALPHA.includes(c))) return null;

  return `${letters}-${digits}`;
}
