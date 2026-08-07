// src/components/game/wardenProgress.js
//
// The cross-universe meta-state, stored GLOBALLY in localStorage (the warden is
// eternal, like the Curator's rapport). Holds both the Ascension rank AND The
// Self: Recollection, the affinity pulls, recovered Memories, and realized
// identities. All identity MATH lives in self/selfModel.js; this is the
// stateful adapter (persist + subscribe).
import * as model from "./self/selfModel.js";
import { MEMORIES } from "./content/memories.js";
import { AUTHORED_SELVES } from "./content/revelations.js";

const KEY = "eterna:warden";

const RANKS = [
  { min: 0, title: "Untested Warden" },
  { min: 1, title: "Keeper of One" },
  { min: 2, title: "Shepherd of Worlds" },
  { min: 4, title: "Shepherd of Stars" },
  { min: 7, title: "Architect of Ages" },
  { min: 12, title: "The Undying" }, // renamed from "The Eternal" - that name now belongs to a Self
];

const defaults = () => ({
  ascensions: 0,
  recollection: 0,
  affinity: model.emptyAffinity(),
  memoriesRecovered: [],
  identitiesRealized: [],
});

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "null");
    if (s && typeof s.ascensions === "number") {
      return { ...defaults(), ...s, affinity: { ...model.emptyAffinity(), ...(s.affinity || {}) } };
    }
  } catch { /* first run / private mode */ }
  return defaults();
}
function save(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

const listeners = new Set();
function emitSelf() {
  const snap = getSelf();
  listeners.forEach((fn) => { try { fn(snap); } catch (e) { console.error("self listener failed", e); } });
}

export function rankFor(ascensions) {
  let rank = RANKS[0];
  for (const r of RANKS) if (ascensions >= r.min) rank = r;
  const next = RANKS.find((r) => r.min > ascensions) || null;
  return { title: rank.title, next: next ? { title: next.title, at: next.min } : null };
}

/** Current warden meta-state (rank / Ascension). Unchanged API. */
export function getWarden() {
  const { ascensions } = load();
  return { ascensions, ...rankFor(ascensions) };
}

/** Record a completed Ascension (a chosen species reached Type III). */
export function recordAscension() {
  const state = load();
  state.ascensions += 1;
  save(state);
  return getWarden();
}

/** The Self snapshot for the UI. */
export function getSelf() {
  const s = load();
  return {
    recollection: s.recollection,
    affinity: s.affinity,
    memoriesRecovered: s.memoriesRecovered,
    realized: s.identitiesRealized,
    leading: model.leadingSelf(s.affinity, AUTHORED_SELVES),
  };
}

/**
 * Feed one axis event into The Self. Persists, recovers any Memories the new
 * Recollection has earned, and - at the summit - realizes a Self. Returns what
 * to surface: { recoveredMemories, revelation }.
 */
export function recordAxis(kind, weight, tags = {}) {
  const s = load();
  const next = model.applyAxis({ recollection: s.recollection, affinity: s.affinity }, kind, weight, tags);
  s.recollection = next.recollection;
  s.affinity = next.affinity;

  const recoveredMemories = [];
  let owed = model.bandsPassed(s.recollection) - s.memoriesRecovered.length;
  while (owed-- > 0) {
    const m = model.pickMemory(MEMORIES, s.affinity, s.memoriesRecovered);
    if (!m) break;
    s.memoriesRecovered.push(m.id);
    recoveredMemories.push(m);
  }

  let revelation = null;
  const realized = model.resolveSelf(s.affinity, s.recollection, AUTHORED_SELVES);
  if (realized && !s.identitiesRealized.includes(realized)) {
    s.identitiesRealized.push(realized);
    revelation = realized;
  }

  save(s);
  emitSelf();
  return { recoveredMemories, revelation };
}

/** Subscribe to Self changes (fires immediately with the current snapshot). */
export function onSelfProgress(fn) {
  listeners.add(fn);
  fn(getSelf());
  return () => listeners.delete(fn);
}