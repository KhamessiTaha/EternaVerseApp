// src/components/game/world/classifyModel.js
//
// Classify Before Scan: the one place where knowing real astronomy pays.
//
// The game's science had been living in read-only Codex text while the
// minigames were physics-themed reflex tests, which meant a player who
// genuinely understands galaxy morphology had no mechanical advantage over one
// who mashes buttons. This is the fix: before a galaxy's scan channel
// completes, call its Hubble class from the rendered shape. Right pays; wrong
// pays normally and tells you how to recognise it next time.
//
// Pure and Phaser-free so the rules are unit-testable and the tuning lives in
// one file. ScanSystem renders it; classifyPrompt.js draws it.
//
// FOUR buckets, not five. `lenticular` is deliberately NOT offered as an
// answer: TextureFactory.keyFor maps it onto the elliptical texture
// (`family === "lenticular" ? "elliptical"`), so an S0 and an E are the same
// picture on screen. Asking players to tell them apart would be asking them to
// guess, and one unearnable bucket makes players distrust the other four.
// Lenticulars still generate and still appear in the Codex - they just resolve
// as "elliptical" here, so nobody is ever wrong for a reason the screen never
// showed them. Give S0 its own texture and it can become a fifth answer.

export const CLASSIFY_BUCKETS = [
  { id: "elliptical", key: "1", label: "ELL", full: "Elliptical" },
  { id: "spiral", key: "2", label: "SPIRAL", full: "Spiral" },
  { id: "barred", key: "3", label: "BARRED", full: "Barred Spiral" },
  { id: "irregular", key: "4", label: "IRR", full: "Irregular" },
];

export const BUCKET_IDS = CLASSIFY_BUCKETS.map((b) => b.id);

// A correct call is worth about what a perfect survey streak is worth (+60%).
// That parity is the whole thesis stated as a number: knowledge should pay
// like flow does, not like a footnote.
export const CLASSIFY_MULT = 1.5;

// A correct call also advances the streak an extra step, so understanding
// literally makes you faster - the streak speedup is what shortens the channel.
export const CLASSIFY_STREAK_BONUS = 1;

/**
 * How you actually TELL them apart, one line each. This is the half of the
 * Hubble principle that's a strategy guide rather than a trophy; the Codex
 * entry keeps the history. Shown on a wrong call, for the RIGHT answer.
 */
export const DIAGNOSTICS = {
  elliptical:
    "Smooth, featureless, no disk. Ellipticals are merger aftermath — ordered rotation scrambled into random orbits, gas long spent. They crowd into clusters.",
  spiral:
    "Arms wind straight out of a round core. A settled disk, still turning gas into stars. Most common out in the open field.",
  barred:
    "The arms don't start at the core — they start at the ENDS of a straight bar cutting through it. Look for the bar first.",
  irregular:
    "No symmetry, no core, no arms. Either young and still assembling, or something recently tore through it.",
};

/**
 * The correct bucket for a rendered object class. Lenticulars fold into
 * elliptical because that is genuinely what the player is looking at.
 * Returns null for anything that isn't a classifiable galaxy.
 */
export function answerFor(objectClass) {
  if (typeof objectClass !== "string") return null;
  if (/^E[0-7]$/.test(objectClass)) return "elliptical";
  if (objectClass === "S0") return "elliptical"; // drawn as an elliptical
  if (/^SB[abc]$/.test(objectClass)) return "barred";
  if (/^S[abc]$/.test(objectClass)) return "spiral";
  if (objectClass === "Irr") return "irregular";
  return null; // nebula, quasar, merger, anomalies - not classifiable
}

/** Can this scan candidate be classified? Galaxies only. */
export function isClassifiable(discovery) {
  return !!discovery && discovery.category === "galaxy" && !!answerFor(discovery.objectClass);
}

/** The bucket a number key selects, or null if it isn't one of ours. */
export function bucketForKey(key) {
  return CLASSIFY_BUCKETS.find((b) => b.key === String(key))?.id ?? null;
}

/**
 * Resolve a call. `guess` may be null (no call was made), which is never
 * punished - it just pays normally and says nothing.
 *
 * Returns { called, correct, answer, mult, streakBonus, diagnostic }.
 */
export function classifyResult(guess, objectClass) {
  const answer = answerFor(objectClass);
  if (!answer) return { called: false, correct: false, answer: null, mult: 1, streakBonus: 0, diagnostic: null };

  if (!guess) {
    return { called: false, correct: false, answer, mult: 1, streakBonus: 0, diagnostic: null };
  }

  const correct = guess === answer;
  return {
    called: true,
    correct,
    answer,
    mult: correct ? CLASSIFY_MULT : 1,
    streakBonus: correct ? CLASSIFY_STREAK_BONUS : 0,
    // Wrong calls teach; right calls don't need to.
    diagnostic: correct ? null : DIAGNOSTICS[answer] ?? null,
  };
}
