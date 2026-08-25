// src/components/game/selfSync.js
//
// Keeps the warden's identity on the ACCOUNT instead of the browser.
//
// The Self, the Curator's rapport, and personal bests all lived in
// localStorage, so clearing cookies destroyed them and a second device knew
// nothing about the first. They're server-backed now. This module is the seam:
// it collects the three local stores into one payload, pushes it, and adopts
// whatever canonical record comes back.
//
// Three rules, in priority order:
//
//   1. LOCAL WRITES LAND FIRST, ALWAYS. Every store still writes to
//      localStorage synchronously, so the UI is instant and the game is fully
//      playable offline. The network is a follow-up, never a gate.
//
//   2. THE SERVER MERGES, IT NEVER OVERWRITES. Two devices can each hold
//      progress the other has never seen. See backend utils/selfSync.js.
//
//   3. LOCAL IS NEVER CLEARED. Not on success, not on adopt, not ever. If
//      every assumption here is wrong, the player's progress is still on disk.
import { exportSelf, adoptSelf, onSelfDirty } from "./wardenProgress.js";
import { exportBests, importBests } from "./bestScores.js";
import { exportRapport, importRapport } from "./narrator.js";
import { getSelf as fetchSelf, putSelf } from "../../api/userApi";

// Long enough that a burst of scans is one request, short enough that closing
// the tab rarely outruns it. Same shape as GameplayPage's strike buffer.
const PUSH_DEBOUNCE_MS = 4000;

let timer = null;
let dirty = false;
let started = false;

/** The three local stores as one payload. */
function collect() {
  const self = exportSelf();
  const { rapport, asked } = exportRapport();
  return { ...self, rapport, asked, bests: exportBests() };
}

/** Spread a canonical server record back across the three stores. */
function adopt(server) {
  if (!server) return;
  adoptSelf(server);
  importRapport({ rapport: server.rapport, asked: server.asked });
  importBests(server.bests);
}

async function push() {
  timer = null;
  if (!dirty) return;
  dirty = false;
  try {
    const merged = await putSelf(collect());
    // Adopting the merge is what makes a second device converge rather than
    // fight - it may hand back progress this device never had.
    adopt(merged);
  } catch {
    // Offline or the server is unhappy. Local already holds the truth, so
    // just stay dirty and try again on the next change or the next flush.
    dirty = true;
  }
}

function schedulePush() {
  dirty = true;
  if (timer) return;
  timer = setTimeout(push, PUSH_DEBOUNCE_MS);
}

/**
 * Pull the account's record and start syncing. Safe to call more than once.
 *
 * The first pull is also the migration: whatever this browser holds - possibly
 * including the pre-account global blob that wardenProgress claims on load -
 * gets pushed up and merged, so a player who has been playing locally for
 * weeks keeps every memory of it.
 */
export async function startSelfSync() {
  if (started) return;
  started = true;

  try {
    const server = await fetchSelf();
    if (server) adopt(server);
  } catch {
    // No network on boot: play from cache. The first local change schedules a
    // push, which will carry everything up once the connection returns.
  }

  // Seed one push so a device with purely local history reaches the account
  // even if the player never touches anything this session.
  schedulePush();
  onSelfDirty(schedulePush);

  // Best effort on the way out - a debounce is a window for losing the last
  // few seconds of progress, and this closes most of it.
  if (typeof window !== "undefined") {
    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flushSelfSync();
    });
    window.addEventListener("pagehide", flushSelfSync);
  }
}

/** Push now rather than on the timer (tab hidden, leaving a universe). */
export function flushSelfSync() {
  if (timer) { clearTimeout(timer); timer = null; }
  return push();
}

/** Test seam: forget that sync was started. */
export function _resetSelfSync() {
  if (timer) clearTimeout(timer);
  timer = null;
  dirty = false;
  started = false;
}
