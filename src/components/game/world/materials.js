// src/components/game/world/materials.js
//
// What the universe has actually made, and when.
//
// The core rule: you cannot harvest gold in a young cosmos, because the cosmos
// hasn't forged any yet. Every gate below reads state the simulation ALREADY
// tracks - metallicity, stellar generations, black holes - so this adds no new
// physics. It only makes the physics that was always running finally legible
// minute-to-minute.
//
// That's the fix for a real problem: cosmic age currently affects almost
// nothing the player feels. Under this, the age of your universe IS your tech
// tree.
//
// Same design bet as the gravity minigame and Classify Before Scan: real
// knowledge plays better. A player who knows where gold comes from knows to
// hunt neutron-star mergers.
//
// Pure and Phaser-free. MIRRORED by the backend's utils/materials.js, which is
// authoritative - unlike the classify bonus (unverifiable without regenerating
// the world), these gates ARE checkable server-side, because the server owns
// currentState. This copy drives display and prediction only.

/** Where a harvest can come from. */
export const SOURCES = {
  nebula: "nebula",
  star: "star",
  supernova: "supernova",
  merger: "merger",       // neutron-star merger / kilonova - the r-process
  quasar: "quasar",
};

/**
 * `gate(cs)` answers "has the universe made this yet?" from currentState.
 * `sources` is where it can be harvested once it exists.
 *
 * Ordered roughly by when a universe can produce them, which is also the
 * order they should read in a UI.
 */
export const MATERIALS = {
  hydrogen: {
    label: "Hydrogen", symbol: "H", tier: 0,
    forgedBy: "Big Bang nucleosynthesis",
    tell: "The first element. Three quarters of all ordinary matter, made in the first minutes and never made in quantity again.",
    sources: [SOURCES.nebula],
    gate: () => true,
  },
  helium: {
    label: "Helium", symbol: "He", tier: 0,
    forgedBy: "Big Bang nucleosynthesis",
    tell: "Forged alongside hydrogen before the universe was four minutes old. Almost all of it is still that original helium.",
    sources: [SOURCES.nebula, SOURCES.star],
    gate: () => true,
  },
  carbon: {
    label: "Carbon", symbol: "C", tier: 1,
    forgedBy: "stellar fusion (triple-alpha)",
    tell: "Three helium nuclei, fused in the core of a star. Every carbon atom in you was made this way.",
    sources: [SOURCES.star, SOURCES.nebula],
    gate: (cs) => num(cs?.stellarGenerations) >= 1,
  },
  oxygen: {
    label: "Oxygen", symbol: "O", tier: 1,
    forgedBy: "stellar fusion",
    tell: "Burned out of carbon in massive stars, then scattered when they died. It took a generation of stars to exist at all.",
    sources: [SOURCES.star, SOURCES.nebula],
    gate: (cs) => num(cs?.stellarGenerations) >= 1,
  },
  iron: {
    label: "Iron", symbol: "Fe", tier: 2,
    forgedBy: "core collapse of massive stars",
    tell: "Where fusion stops paying. A star that reaches iron has run out of ways to hold itself up, and collapses within a day.",
    sources: [SOURCES.supernova],
    gate: (cs) => num(cs?.stellarGenerations) >= 2,
  },
  gold: {
    label: "Gold", symbol: "Au", tier: 3,
    forgedBy: "r-process, neutron-star merger",
    tell: "Not made in stars. Made when two neutron stars collide - one of the rarest events a universe can stage.",
    sources: [SOURCES.merger],
    gate: (cs) => num(cs?.metallicity) >= 0.3,
  },
  platinum: {
    label: "Platinum", symbol: "Pt", tier: 3,
    forgedBy: "r-process, neutron-star merger",
    tell: "Same violent origin as gold, and just as impossible to find anywhere else.",
    sources: [SOURCES.merger],
    gate: (cs) => num(cs?.metallicity) >= 0.4,
  },
  uranium: {
    label: "Uranium", symbol: "U", tier: 4,
    forgedBy: "r-process, rare capture",
    tell: "Heavier than anything a star can build. Only a merger's neutron flux gets this far up the table, and only sometimes.",
    sources: [SOURCES.merger],
    gate: (cs) => num(cs?.metallicity) >= 0.6,
  },
  degenerate: {
    label: "Degenerate Matter", symbol: "◈", tier: 5,
    forgedBy: "neutron-star interiors",
    tell: "Matter crushed past atoms, held up only by the refusal of neutrons to share a state. A teaspoon outweighs a mountain.",
    sources: [SOURCES.merger],
    gate: (cs) => num(cs?.stellarGenerations) >= 5,
  },
  hawking: {
    label: "Hawking Quanta", symbol: "☼", tier: 5,
    forgedBy: "black-hole evaporation",
    tell: "Radiation leaking from an event horizon. The only thing that ever comes back out.",
    sources: [SOURCES.quasar],
    gate: (cs) => num(cs?.blackHoleCount) > 0,
  },
};

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export const MATERIAL_IDS = Object.keys(MATERIALS);

export const materialById = (id) => MATERIALS[id] || null;

/** Has this universe forged this yet? */
export function isAvailable(id, currentState) {
  const m = MATERIALS[id];
  if (!m) return false;
  try {
    return !!m.gate(currentState);
  } catch {
    return false;
  }
}

/** Everything this universe can currently produce, in table order. */
export function availableMaterials(currentState) {
  return MATERIAL_IDS.filter((id) => isAvailable(id, currentState));
}

/** What a given source could yield right now - the basis of a harvest. */
export function harvestableFrom(source, currentState) {
  return MATERIAL_IDS.filter(
    (id) => MATERIALS[id].sources.includes(source) && isAvailable(id, currentState)
  );
}

/**
 * Resolve one harvest.
 *
 * `grade` is the existing minigame/scan multiplier (gradeTiers), so skill pays
 * here the way it pays everywhere else. Returns { id, amount } or null when
 * the universe has nothing of that kind to give yet - which is a normal, and
 * deliberately legible, outcome.
 */
export function rollHarvest(source, currentState, { rng = Math.random, grade = 1 } = {}) {
  const pool = harvestableFrom(source, currentState);
  if (pool.length === 0) return null;

  // Rarer materials are rarer within their own source: weight by inverse tier
  // so a merger gives gold often and uranium seldom.
  const weights = pool.map((id) => 1 / (1 + MATERIALS[id].tier));
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  let picked = pool[pool.length - 1];
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i];
    if (roll <= 0) { picked = pool[i]; break; }
  }

  const base = BASE_YIELD[MATERIALS[picked].tier] ?? 1;
  return { id: picked, amount: Math.max(1, Math.round(base * Math.max(0.2, grade))) };
}

// Common things come in quantity, exotic things one at a time.
const BASE_YIELD = { 0: 4, 1: 3, 2: 2, 3: 1, 4: 1, 5: 1 };

/**
 * Why a source gave nothing - so the game can TEACH instead of just refusing.
 * This is the line that turns a locked material into a reason to keep playing.
 */
export function explainEmpty(source, currentState) {
  // Name the nearest thing still LOCKED, not just the first in the table -
  // otherwise a source that's partly unlocked explains a material the player
  // can already collect.
  const locked = MATERIAL_IDS.filter(
    (id) => MATERIALS[id].sources.includes(source) && !isAvailable(id, currentState)
  );
  if (locked.length === 0) return "Nothing here to take.";
  const next = locked[0];
  return `This universe has not forged ${MATERIALS[next].label} yet. ${MATERIALS[next].forgedBy} — give it time.`;
}
