// src/components/game/content/artifacts.js
//
// The only things in this game the player MAKES.
//
// Every other verb here is custodial - tend, contain, shepherd, defend,
// witness - and all of them resolve and vanish. Nothing the player did left an
// object in the world. Artifacts are the fix: matter, spent, to put something
// permanent in a specific place.
//
// They are also the answer to "the universe dies and everything goes with it".
// A chronicle is a RECORD of what happened; an artifact is a THING you made,
// and it's named in every universe you play afterwards.
//
// Mirrored by the backend's utils/artifacts.js, which is authoritative on
// cost and placement. This copy drives display and the affordability preview.

export const ARTIFACTS = {
  beacon: {
    id: "beacon",
    label: "Beacon",
    blurb: "A fixed light. It will still be burning here when everything else has moved on.",
    // Common matter: this is the one you can build early and often.
    cost: { iron: 6, carbon: 4 },
    color: 0x4ec9e0,
    // What the Curator says as you plant it.
    line: "Planted. It does nothing, warden - no bonus, no yield. It is simply a place that is now marked, forever, because you decided it should be. That is what building is.",
  },
  monument: {
    id: "monument",
    label: "Monument",
    blurb: "Raised where something happened. Carries a line of the record with it.",
    // Gold gates this behind the r-process: a monument should be expensive in
    // a way the universe itself has to earn.
    cost: { iron: 12, gold: 2 },
    color: 0xdfa73f,
    line: "A monument, in a universe that will not last. I find that neither absurd nor sad, warden — I find it the single most human thing you have done out here.",
  },
  vault: {
    id: "vault",
    label: "Seed Vault",
    blurb: "Given to a people. It outlives them, and says who they were.",
    // Life's elements, plus the power to keep it running.
    cost: { carbon: 10, oxygen: 8, uranium: 1 },
    color: 0x4fd1a5,
    line: "You have given them something that survives their own extinction. Whatever happens to them now, they were HERE, and there is an object that says so.",
  },
};

export const ARTIFACT_IDS = Object.keys(ARTIFACTS);

export const artifactById = (id) => ARTIFACTS[id] || null;

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** { ok } or { ok: false, missing: { id: shortfall } }. */
export function canBuild(materials, id) {
  const a = ARTIFACTS[id];
  if (!a) return { ok: false, missing: {} };
  const have = materials || {};
  const missing = {};
  for (const [mat, need] of Object.entries(a.cost)) {
    const short = need - num(have[mat]);
    if (short > 0) missing[mat] = short;
  }
  return Object.keys(missing).length ? { ok: false, missing } : { ok: true };
}
