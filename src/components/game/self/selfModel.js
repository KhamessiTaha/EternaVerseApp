// src/components/game/self/selfModel.js
//
// Pure, deterministic math for The Self (see the narrative spec). No Phaser,
// no I/O, no randomness - so it unit-tests under node --test and stays the
// single tuning surface. wardenProgress.js is the stateful adapter over this.

// --- Tunables (balance here) ---------------------------------------------
export const RECOLLECTION_BANDS = [8, 20, 38, 62, 92, 130];
export const SUMMIT = RECOLLECTION_BANDS[RECOLLECTION_BANDS.length - 1];

const NEUTRAL_SEED_COUNT = 2; // first memories stay neutral to seed the mystery

// Comprehension per Codex discovery, by rarity.
const DISCOVERY_COMPREHENSION = { common: 1, uncommon: 2, rare: 4, exceptional: 8 };
export const comprehensionForDiscovery = (rarity) => DISCOVERY_COMPREHENSION[rarity] ?? 1;

// Mastery weights.
export const MASTERY_ASCENSION = 50; // the headline act
export const MASTERY_RESOLVE = 2;    // an anomaly contained

// The Eternal is the rare convergence: high in BOTH the understanding side
// (observer + wanderer) AND the mastery side (gardener). Each side must clear
// this gate for the synthesis to resolve instead of a single leading self.
export const ETERNAL_GATE = 40;

// Completing an Insight (connecting a chain of related memories) grants a
// burst of Recollection - understanding the connections advances the self.
export const INSIGHT_BONUS = 6;

// Neglect weights (the pull toward The Unmaker).
export const NEGLECT_STABILITY = 15; // letting the universe tear into crisis
export const NEGLECT_CIV = 10;       // a people you'd met, left to die
const CRITICAL_THRESHOLD = 0.15;     // mirrors the backend stability crisis band

// Tie/priority order when reading the strongest pull.
const SELF_ORDER = ["observer", "gardener", "wanderer", "unmaker"];

export const emptyAffinity = () => ({ observer: 0, gardener: 0, wanderer: 0, unmaker: 0 });

// Apply one axis event. comprehension -> observer (+wanderer if hidden);
// mastery -> gardener; neglect -> unmaker. All raise recollection.
export function applyAxis(state, kind, weight, tags = {}) {
  const affinity = { ...state.affinity };
  if (kind === "comprehension") {
    // Broad cataloging is the Observer's; hunting the deep and rare (the
    // "hidden" tag) is the Wanderer's. Both count as understanding.
    if (tags.hidden) affinity.wanderer += weight;
    else affinity.observer += weight;
  } else if (kind === "mastery") {
    affinity.gardener += weight;
  } else if (kind === "neglect") {
    affinity.unmaker += weight;
  }
  return { recollection: state.recollection + weight, affinity };
}

export const bandsPassed = (recollection) =>
  RECOLLECTION_BANDS.filter((b) => recollection >= b).length;

export function leadingSelf(affinity, available = SELF_ORDER) {
  let best = available[0];
  for (const id of SELF_ORDER) {
    if (!available.includes(id)) continue;
    if (affinity[id] > (affinity[best] ?? -Infinity)) best = id;
  }
  return best;
}

// Deterministic: seed neutral first, then the leading self's pool, then
// neutral, then anything unrevealed. Null when the pool is exhausted.
export function pickMemory(pool, affinity, recoveredIds) {
  const unrevealed = pool.filter((m) => !recoveredIds.includes(m.id));
  if (unrevealed.length === 0) return null;

  const firstOf = (self) => unrevealed.find((m) => m.self === self) || null;

  if (recoveredIds.length < NEUTRAL_SEED_COUNT) {
    const neutral = firstOf("neutral");
    if (neutral) return neutral;
  }
  const lead = firstOf(leadingSelf(affinity));
  if (lead) return lead;
  const neutral = firstOf("neutral");
  if (neutral) return neutral;
  return unrevealed[0];
}

// The realized self - only at/after the summit, and only one the game can
// actually reveal (available = the authored selves). The Eternal wins when
// BOTH sides clear the gate; otherwise the strongest single pull (excluding
// eternal, which has no affinity bucket of its own).
export function resolveSelf(affinity, recollection, available) {
  if (recollection < SUMMIT) return null;
  const understanding = affinity.observer + affinity.wanderer;
  const mastery = affinity.gardener;
  if (available.includes("eternal") && understanding >= ETERNAL_GATE && mastery >= ETERNAL_GATE) {
    return "eternal";
  }
  return leadingSelf(affinity, available.filter((s) => s !== "eternal"));
}

// Which insight chains are fully recovered (every memory in the chain in hand).
// Pure - the caller supplies the insight list to avoid a content dependency.
export function insightsCompleted(recoveredIds, insights) {
  const have = new Set(recoveredIds);
  return insights
    .filter((ins) => ins.memoryIds.every((id) => have.has(id)))
    .map((ins) => ins.id);
}

// Neglect scored from one universe-state transition: stability tearing INTO
// crisis, and any civilization you had met going newly extinct. Pure so it
// unit-tests; GameplayPage feeds it prev/next universe each refresh.
export function neglectDelta(prev, next) {
  if (!prev || !next) return 0;
  let weight = 0;

  const prevStab = prev.currentState?.stabilityIndex ?? 1;
  const nextStab = next.currentState?.stabilityIndex ?? 1;
  if (prevStab >= CRITICAL_THRESHOLD && nextStab < CRITICAL_THRESHOLD) weight += NEGLECT_STABILITY;

  const wasExtinct = new Set((prev.civilizations || []).filter((c) => c.extinct).map((c) => c.id));
  for (const c of next.civilizations || []) {
    const met = c.observed || (c.relationship || 0) !== 0;
    if (c.extinct && met && !wasExtinct.has(c.id)) weight += NEGLECT_CIV;
  }
  return weight;
}