// src/components/game/world/researchValues.js
//
// Canonical object-class catalog for the cosmic web: category, morphology,
// display label, rarity tier, and research-point value per class.
//
// Mirrors the backend's utils/researchValues.js the same way the minigame
// GRADE_TIERS mirror the backend PERFORMANCE_TIERS: the server is the
// authority on awarded points; this copy only drives generation and display.
// If they diverge, that's a balance bug to fix, not an API contract.
import { ANOMALY_TYPE_MAP } from "../constants.js";

const gal = (morph, label, rarity, research) => ({ category: "galaxy", morph, label, rarity, research });

export const OBJECT_CLASSES = {
  E0: gal("elliptical", "Elliptical (E0)", "common", 6),
  E1: gal("elliptical", "Elliptical (E1)", "common", 6),
  E2: gal("elliptical", "Elliptical (E2)", "common", 6),
  E3: gal("elliptical", "Elliptical (E3)", "common", 6),
  E4: gal("elliptical", "Elliptical (E4)", "uncommon", 12),
  E5: gal("elliptical", "Elliptical (E5)", "uncommon", 12),
  E6: gal("elliptical", "Elliptical (E6)", "uncommon", 14),
  E7: gal("elliptical", "Elliptical (E7)", "uncommon", 14),
  S0: gal("lenticular", "Lenticular (S0)", "uncommon", 12),
  Sa: gal("spiral", "Spiral (Sa)", "common", 8),
  Sb: gal("spiral", "Spiral (Sb)", "common", 6),
  Sc: gal("spiral", "Spiral (Sc)", "common", 6),
  SBa: gal("barred", "Barred Spiral (SBa)", "uncommon", 10),
  SBb: gal("barred", "Barred Spiral (SBb)", "common", 8),
  SBc: gal("barred", "Barred Spiral (SBc)", "common", 8),
  Irr: gal("irregular", "Irregular (Irr)", "common", 7),
  nebula: { category: "nebula", morph: "nebula", label: "Emission Nebula", rarity: "common", research: 8 },
  quasar: { category: "phenomenon", morph: "quasar", label: "Quasar (AGN)", rarity: "exceptional", research: 50 },
  merger: { category: "phenomenon", morph: "merger", label: "Galaxy Merger", rarity: "rare", research: 40 },
};

export const MORPH_SUBTYPES = Object.entries(OBJECT_CLASSES).reduce((acc, [id, info]) => {
  if (info.category !== "galaxy") return acc;
  (acc[info.morph] = acc[info.morph] || []).push(id);
  return acc;
}, {});

export const ANOMALY_SCAN_BASE = 15;

// Codex completion denominator: every scannable class, anomaly types included.
export const KNOWN_CLASS_COUNT =
  Object.keys(OBJECT_CLASSES).length + Object.keys(ANOMALY_TYPE_MAP).length;

export const getClassInfo = (objectClass) => OBJECT_CLASSES[objectClass] ?? null;