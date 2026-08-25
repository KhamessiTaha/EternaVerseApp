// src/components/game/content/recipes.js
//
// What a module is made OF. Mirrors the backend's utils/recipes.js the same
// way upgradeCatalog mirrors its server copy: that one decides what is
// actually spent, this one drives display and the "can I afford it yet"
// preview in the Outfitting panel.
//
// RP researches the design; matter builds the thing. Mk 1 needs no matter, so
// the early game is unchanged - but the top of every track is gated on what
// the universe has actually forged. You cannot max your ship until the cosmos
// has made the atoms.

export const RECIPES = {
  thrusters: [
    null,
    { iron: 4 },
    { iron: 8, degenerate: 1 },
  ],
  boostReactor: [
    null,
    { carbon: 4, oxygen: 2 },
    { iron: 6, hawking: 1 },
  ],
  scanner: [
    null,
    { carbon: 5 },
    // Gold and platinum because that is genuinely what precision optics are
    // coated with - JWST's mirrors are gold for the same reason.
    { gold: 2, platinum: 1 },
  ],
  containment: [
    null,
    { iron: 5, oxygen: 3 },
    { uranium: 2, degenerate: 1 },
  ],
};

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** What the next level of this track needs in matter, or null. */
export const requirementFor = (track, level) => RECIPES[track]?.[level] ?? null;

/** { ok } or { ok: false, missing: { id: shortfall } } - for the preview. */
export function canAfford(materials, requirement) {
  if (!requirement) return { ok: true };
  const have = materials || {};
  const missing = {};
  for (const [id, need] of Object.entries(requirement)) {
    const short = need - num(have[id]);
    if (short > 0) missing[id] = short;
  }
  return Object.keys(missing).length ? { ok: false, missing } : { ok: true };
}
