// src/components/game/wardenProgress.js
//
// The cross-universe meta-state, stored GLOBALLY in localStorage (the warden is
// eternal, like the Curator's rapport). Holds both the Ascension rank AND The
// Self: Recollection, the affinity pulls, recovered Memories, and realized
// identities. All identity MATH lives in self/selfModel.js; this is the
// stateful adapter (persist + subscribe).
import * as model from "./self/selfModel.js";
import * as classify from "./world/classifyModel.js";
import { MEMORIES } from "./content/memories.js";
import { AUTHORED_SELVES } from "./content/revelations.js";
import { INSIGHTS } from "./content/insights.js";

// The Self belongs to the ACCOUNT, not the browser.
//
// This used to be one global key, which meant clearing cookies destroyed a
// warden's whole identity AND two accounts on the same browser shared one -
// you could log in and be shown someone else's memories. It is now keyed per
// user (same convention as tutorialGate) and mirrored server-side; this copy
// is a write-through cache and an offline buffer, never the authority.
//
// LEGACY is the old global blob. It has no owner recorded - the original
// design never stored one - so it is claimed exactly once, by the first
// account to log in after this change, and then MARKED rather than deleted.
// Marking keeps it recoverable by hand if that attribution turns out wrong.
const BASE = "eterna:warden";
const LEGACY_KEY = "eterna:warden";
const CLAIMED_KEY = "eterna:warden:migratedTo";

function currentUserId() {
  try {
    const u = JSON.parse(localStorage.getItem("user") || "null");
    return u?.userId || u?._id || u?.id || null;
  } catch {
    return null;
  }
}

function userKey() {
  const id = currentUserId();
  return id ? `${BASE}:${id}` : `${BASE}:local`;
}

/**
 * The one-time claim of the pre-account blob. Returns it only for the account
 * that legitimately gets it, and only once.
 */
function claimLegacy() {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;

    const id = currentUserId();
    if (!id) return null; // signed out - don't attribute it to nobody

    const claimedBy = localStorage.getItem(CLAIMED_KEY);
    if (claimedBy && claimedBy !== id) return null; // not this account's history

    localStorage.setItem(CLAIMED_KEY, id);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

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
  recollection: 0,             // resets each cycle (on a Revelation)
  affinity: model.emptyAffinity(), // resets each cycle
  bandPointer: 0,              // memory-bands consumed THIS cycle
  memoriesRecovered: [],       // cumulative, persists across cycles
  insightsCompleted: [],       // cumulative
  identitiesRealized: [],      // the selves you've been - the collection
  anamnesisSeen: false,        // capstone shown once
  // Classify Before Scan certification, per morphology family:
  // { elliptical: { calls, correct }, ... }. Cumulative and account-wide,
  // because it records something the PLAYER learned, not something a universe
  // did - and once you can read a spiral you can still read one in the next
  // cosmos. See world/classifyModel.js.
  classify: {},
});

const hydrate = (s) => {
  const merged = { ...defaults(), ...s, affinity: { ...model.emptyAffinity(), ...(s.affinity || {}) } };
  // Migrate a pre-cycle save (no bandPointer): don't re-owe already-read memories.
  if (typeof s.bandPointer !== "number") merged.bandPointer = merged.memoriesRecovered.length;
  return merged;
};

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(userKey()) || "null");
    if (s && typeof s.ascensions === "number") return hydrate(s);

    // Nothing for this account yet - this may be the pre-account blob's owner.
    const legacy = claimLegacy();
    if (legacy && typeof legacy.ascensions === "number") {
      const adopted = hydrate(legacy);
      save(adopted);
      return adopted;
    }
  } catch { /* first run / private mode */ }
  return defaults();
}

function save(state) {
  try { localStorage.setItem(userKey(), JSON.stringify(state)); } catch { /* ignore */ }
  // Local write lands FIRST and always - the UI stays instant and offline play
  // keeps working. The server push is a debounced follow-up (see selfSync.js),
  // and local is never cleared on its success.
  dirtyListeners.forEach((fn) => { try { fn(); } catch (e) { console.error("self sync listener failed", e); } });
}

const dirtyListeners = new Set();

/** Notified whenever local Self changes and owes the server a push. */
export function onSelfDirty(fn) {
  dirtyListeners.add(fn);
  return () => dirtyListeners.delete(fn);
}

/** The full local record, for pushing to the server. */
export function exportSelf() {
  return load();
}

/**
 * Adopt the server's canonical record. Called after a GET or a PUT response;
 * the server has already merged, so this is a straight write - and it is the
 * ONLY thing that overwrites local state wholesale.
 */
export function adoptSelf(serverSelf) {
  if (!serverSelf || typeof serverSelf.ascensions !== "number") return getSelf();
  save(hydrate(serverSelf));
  emitSelf();
  return getSelf();
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

/**
 * The player's morphology-reading record, account-wide.
 * Shape: { [bucketId]: { calls, correct } }.
 */
export function getClassifyRecord() {
  return load().classify || {};
}

/**
 * Log one classification against the family that was actually correct.
 * Returns the families newly certified by THIS call, so the caller can say so
 * once rather than every scan afterwards.
 */
export function recordClassifyCall(answer, correct) {
  const state = load();
  const before = classify.certifiedBuckets(state.classify || {});
  state.classify = classify.recordCall(state.classify || {}, answer, correct);
  save(state);
  const after = classify.certifiedBuckets(state.classify);
  return after.filter((id) => !before.includes(id));
}

/**
 * Wipe the morphology record (dev/testing). Certification is account-wide and
 * permanent by design, so re-testing the learn -> certify arc otherwise needs
 * a fresh account.
 */
export function resetClassifyRecord() {
  const state = load();
  state.classify = {};
  save(state);
}

/** Certify every family at once (dev/testing). */
export function certifyAllClassify() {
  const state = load();
  const done = { calls: classify.CERTIFY_MIN_CALLS, correct: classify.CERTIFY_MIN_CALLS };
  state.classify = Object.fromEntries(classify.BUCKET_IDS.map((id) => [id, { ...done }]));
  save(state);
}

/** Certification state for the dev panel / Codex: which families are done. */
export function getClassifyStatus() {
  const record = load().classify || {};
  return classify.BUCKET_IDS.map((id) => ({
    id,
    calls: record[id]?.calls || 0,
    correct: record[id]?.correct || 0,
    certified: classify.isCertified(record, id),
  }));
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
    insights: s.insightsCompleted,
    realized: s.identitiesRealized,
    leading: model.leadingSelf(s.affinity, AUTHORED_SELVES),
    complete: s.identitiesRealized.length >= AUTHORED_SELVES.length,
  };
}

// Recover any Memories the current Recollection owes this cycle. Mutates s
// (memoriesRecovered, bandPointer); returns the newly recovered Memory objects.
function recoverOwed(s) {
  const out = [];
  let owed = model.bandsPassed(s.recollection) - s.bandPointer;
  while (owed-- > 0) {
    const m = model.pickMemory(MEMORIES, s.affinity, s.memoriesRecovered);
    s.bandPointer += 1; // count the band even if the pool is dry (no infinite loop)
    if (!m) continue;
    s.memoriesRecovered.push(m.id);
    out.push(m);
  }
  return out;
}

/**
 * Feed one axis event into The Self. Persists; recovers owed Memories; completes
 * any Insight chains (a Recollection burst); and - at the summit - realizes a
 * Self, which begins a new cycle (the climb resets, the collection does not).
 * Returns what to surface: { recoveredMemories, newInsights, revelation, anamnesisComplete }.
 */
export function recordAxis(kind, weight, tags = {}) {
  const s = load();
  const next = model.applyAxis({ recollection: s.recollection, affinity: s.affinity }, kind, weight, tags);
  s.recollection = next.recollection;
  s.affinity = next.affinity;

  const recoveredMemories = recoverOwed(s);

  // Insights: newly-completed chains grant a Recollection burst, which may
  // itself owe another Memory.
  const newInsights = [];
  for (const id of model.insightsCompleted(s.memoriesRecovered, INSIGHTS)) {
    if (s.insightsCompleted.includes(id)) continue;
    s.insightsCompleted.push(id);
    s.recollection += model.INSIGHT_BONUS;
    newInsights.push(INSIGHTS.find((i) => i.id === id));
  }
  if (newInsights.length) recoveredMemories.push(...recoverOwed(s));

  // Realize a Self at the summit, then begin a new cycle.
  let revelation = null;
  const realized = model.resolveSelf(s.affinity, s.recollection, AUTHORED_SELVES);
  if (realized && !s.identitiesRealized.includes(realized)) {
    s.identitiesRealized.push(realized);
    revelation = realized;
    s.recollection = 0;
    s.affinity = model.emptyAffinity();
    s.bandPointer = 0;
  }

  let anamnesisComplete = false;
  if (s.identitiesRealized.length >= AUTHORED_SELVES.length && !s.anamnesisSeen) {
    s.anamnesisSeen = true;
    anamnesisComplete = true;
  }

  save(s);
  emitSelf();
  return { recoveredMemories, newInsights, revelation, anamnesisComplete };
}

/** Subscribe to Self changes (fires immediately with the current snapshot). */
export function onSelfProgress(fn) {
  listeners.add(fn);
  fn(getSelf());
  return () => listeners.delete(fn);
}