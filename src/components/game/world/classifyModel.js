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

// `key` is what the prompt PRINTS; `code` is the Phaser KeyCodes NAME that
// ScanSystem resolves to bind it. They are separate on purpose: this module is
// Phaser-free so the rules stay unit-testable, and passing the printed "1"
// straight to addKey() is exactly the bug that shipped - Phaser looks up
// KeyCodes["1"], which is undefined (the map defines ONE), so it built four
// keys with no keycode and the prompt was decorative.
export const CLASSIFY_BUCKETS = [
  { id: "elliptical", key: "1", code: "ONE", label: "ELL", full: "Elliptical" },
  { id: "spiral", key: "2", code: "TWO", label: "SPIRAL", full: "Spiral" },
  { id: "barred", key: "3", code: "THREE", label: "BARRED", full: "Barred Spiral" },
  { id: "irregular", key: "4", code: "FOUR", label: "IRR", full: "Irregular" },
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

// --- Certification ---------------------------------------------------------
//
// The mechanic retires itself.
//
// Classification fires on the most-repeated action in the game. However good
// the question is, asking it on every galaxy forever turns it into a tax - the
// failure mode isn't that it gets too EASY, it's that it gets TIRING, and
// depth is no cure for frequency. A harder question asked four hundred times
// is still four hundred times.
//
// So: prove you can read a family and the game stops asking you about that
// family, and pays the bonus anyway. Your reward for learning is never being
// asked again while keeping the money - not a harder question, forever.
//
// Certification is knowledge, so it lives on The Self and outlives the
// universe it was earned in.

export const CERTIFY_MIN_CALLS = 12;   // enough to not be luck
export const CERTIFY_ACCURACY = 0.9;   // and you have to be genuinely good

/** A fresh, empty record. Shape: { [bucketId]: { calls, correct } }. */
export const emptyClassifyRecord = () => ({});

/** Have they earned the right to stop being asked about this family? */
export function isCertified(record, bucketId) {
  const r = record?.[bucketId];
  if (!r || !Number.isFinite(r.calls) || r.calls < CERTIFY_MIN_CALLS) return false;
  return (r.correct || 0) / r.calls >= CERTIFY_ACCURACY;
}

/** Every family they've been certified in. */
export function certifiedBuckets(record) {
  return BUCKET_IDS.filter((id) => isCertified(record, id));
}

/**
 * Log one call against the family that was actually CORRECT, not the one the
 * player guessed - certification is "can you recognise an elliptical", so a
 * wrong call has to count against the elliptical's record or a player could
 * certify in a family by never calling it.
 *
 * Pure: returns a new record.
 */
export function recordCall(record, answer, correct) {
  if (!answer || !BUCKET_IDS.includes(answer)) return record || {};
  const base = record || {};
  const prev = base[answer] || { calls: 0, correct: 0 };
  return {
    ...base,
    [answer]: {
      calls: (prev.calls || 0) + 1,
      correct: (prev.correct || 0) + (correct ? 1 : 0),
    },
  };
}

/** How close they are, for the prompt's progress hint. 0..1 */
export function certifyProgress(record, bucketId) {
  const r = record?.[bucketId];
  if (!r || !r.calls) return 0;
  return Math.min(1, r.calls / CERTIFY_MIN_CALLS);
}

// --- Hard specimens --------------------------------------------------------
//
// What keeps the mechanic alive after certification.
//
// Certification retires the easy question, which is right - but on its own it
// means classification eventually stops existing, and a system that simply
// ends is a worse ending than a system that quiets down. Hard specimens are
// the other half: rare objects that are genuinely ambiguous, worth several
// times as much, and asked EVEN of a certified warden.
//
// Today there is exactly one, and it earns the name. A disk galaxy seen from
// its rim is a flat, near-featureless lens that reads as an elliptical -
// mistaking the two is the classic error in real morphology. The tell is the
// DUST LANE the renderer draws through it: the disk's own material, blocking
// its own light. Anyone who knows what that dark seam means gets it right;
// anyone who doesn't gets told, once, and then knows forever.
//
// Fairness is why only UNBARRED spirals are ever drawn edge-on (see
// objectGenerator): you cannot see a bar from the rim, so every edge-on disk
// answers "spiral" and nobody is wrong for a reason the screen never showed.

export const HARD_MULT = 2.4;
export const HARD_STREAK_BONUS = 2;

export const HARD_DIAGNOSTIC =
  "A disk seen edge-on. The dark seam splitting it is a DUST LANE - the galaxy's own material blocking its own light, and something only a disk has. Flat and featureless says elliptical; a lane through the middle says you are looking at a spiral from its rim.";

/** Is this object one of the genuinely ambiguous ones? */
export function isHardSpecimen(discovery) {
  return !!discovery?.edgeOn && !!answerFor(discovery.objectClass);
}

/**
 * Should the prompt be OFFERED for this object?
 *
 * No, once you're certified in the family it belongs to - that is the whole
 * point, and the bonus still pays (see classifyResult).
 *
 * UNLESS it's a hard specimen, which is asked of everyone forever. That is
 * what stops certification from ending the mechanic outright.
 */
export function shouldPrompt(discovery, record) {
  const objectClass = typeof discovery === "string" ? discovery : discovery?.objectClass;
  const answer = answerFor(objectClass);
  if (!answer) return false;
  if (isHardSpecimen(discovery)) return true;
  return !isCertified(record, answer);
}

/**
 * Resolve a call. `guess` may be null (no call was made), which is never
 * punished - it just pays normally and says nothing.
 *
 * `record` is the player's certification history. When they are certified in
 * the family this object belongs to, no call was asked for and the bonus is
 * paid regardless - that is the deal certification makes.
 *
 * Returns { called, correct, answer, mult, streakBonus, diagnostic, certified }.
 */
export function classifyResult(guess, discovery, record = null) {
  const objectClass = typeof discovery === "string" ? discovery : discovery?.objectClass;
  const answer = answerFor(objectClass);
  const none = {
    called: false, correct: false, answer: null, mult: 1, streakBonus: 0,
    diagnostic: null, certified: false, hard: false,
  };
  if (!answer) return none;

  const hard = isHardSpecimen(discovery);
  const mult = hard ? HARD_MULT : CLASSIFY_MULT;
  const streak = hard ? HARD_STREAK_BONUS : CLASSIFY_STREAK_BONUS;

  // Certified: they proved this one already. Pay it and stay out of the way.
  // A hard specimen is never auto-passed - it is asked of everyone, forever.
  if (!hard && isCertified(record, answer)) {
    return {
      called: false,
      correct: true,
      answer,
      mult: CLASSIFY_MULT,
      streakBonus: CLASSIFY_STREAK_BONUS,
      diagnostic: null,
      certified: true,
      hard: false,
    };
  }

  if (!guess) {
    return { ...none, answer, hard };
  }

  const correct = guess === answer;
  return {
    called: true,
    correct,
    answer,
    mult: correct ? mult : 1,
    streakBonus: correct ? streak : 0,
    // Wrong calls teach; right calls don't need to. A missed hard specimen
    // teaches the specific confusion rather than the generic family tell.
    diagnostic: correct ? null : (hard ? HARD_DIAGNOSTIC : DIAGNOSTICS[answer] ?? null),
    certified: false,
    hard,
  };
}
