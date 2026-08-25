// src/components/game/bestScores.js
//
// Personal bests, per minigame per severity.
//
// A severity-5 Cascade Reaction and a severity-1 one are different problems -
// grading them against one number would mean your "best" is really just a
// record of the easiest one you ever played. Keyed by both so the record is
// something you can actually chase.
//
// Device-local (localStorage), same lifetime and same reasoning as
// wardenProgress: it's a personal record, not a scoreboard, and nothing else
// in the game reads it.

const KEY = "ev:minigameBests";

const read = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}") || {};
  } catch {
    return {}; // private mode, corrupt payload - a lost record is survivable
  }
};

const write = (all) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Non-fatal: the player just doesn't get a "NEW BEST" next time.
  }
};

/** Stable key for one (minigame, severity) pair. */
export const bestKey = (sceneKey, severity) =>
  `${sceneKey || "unknown"}:${Math.max(1, Math.min(5, Math.floor(Number(severity) || 1)))}`;

/** The stored best accuracy for this pair, or null if never played. */
export function getBest(sceneKey, severity) {
  const v = read()[bestKey(sceneKey, severity)];
  return typeof v === "number" ? v : null;
}

/**
 * Record an attempt. Returns { best, isNew, previous }.
 *
 * `isNew` is false on the very first play: a first attempt has nothing to beat,
 * and shouting NEW BEST at someone's first go devalues the badge everywhere
 * else. It's still stored, so the second attempt can earn it honestly.
 */
export function recordBest(sceneKey, severity, accuracy) {
  const acc = Math.max(0, Math.min(100, Number(accuracy) || 0));
  const all = read();
  const key = bestKey(sceneKey, severity);
  const previous = typeof all[key] === "number" ? all[key] : null;

  if (previous === null) {
    all[key] = acc;
    write(all);
    return { best: acc, isNew: false, previous: null };
  }

  if (acc > previous) {
    all[key] = acc;
    write(all);
    return { best: acc, isNew: true, previous };
  }

  return { best: previous, isNew: false, previous };
}

/** Wipe every record (settings / testing). */
export function resetBests() {
  write({});
}
