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

// Tie/priority order when reading the strongest pull.
const SELF_ORDER = ["observer", "gardener", "wanderer", "unmaker"];

export const emptyAffinity = () => ({ observer: 0, gardener: 0, wanderer: 0, unmaker: 0 });

// Apply one axis event. comprehension -> observer (+wanderer if hidden);
// mastery -> gardener; neglect -> unmaker. All raise recollection.
export function applyAxis(state, kind, weight, tags = {}) {
  const affinity = { ...state.affinity };
  if (kind === "comprehension") {
    affinity.observer += weight;
    if (tags.hidden) affinity.wanderer += weight;
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
// actually reveal (available = the authored selves).
export function resolveSelf(affinity, recollection, available) {
  if (recollection < SUMMIT) return null;
  return leadingSelf(affinity, available);
}