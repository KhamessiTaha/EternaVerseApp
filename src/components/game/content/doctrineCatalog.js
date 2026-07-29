// src/components/game/content/doctrineCatalog.js
//
// Doctrines: the build-identity layer (mirror of the backend's
// utils/doctrineCatalog.js). The four upgrade tracks are linear fine-tuning; a
// doctrine is a single mutually-exclusive commitment with real TRADEOFFS - the
// same philosophy as the hull roster. The server owns the reward-affecting
// field (containment); this copy drives the Outfitting UI and applies the
// movement/scan multipliers client-side. Keep the effects in sync with the
// backend - divergence is a balance bug, not an API break.

export const DOCTRINES = {
  surveyor: {
    label: "Deep-Field Surveyor",
    tagline: "See everything, contain nothing.",
    effects: { scanRange: 1.5, scanDuration: 0.7, maxSpeed: 1.1, containment: 0.7 },
    boons: ["+50% scan range", "−30% scan time", "+10% top speed"],
    banes: ["−30% anomaly-containment reward"],
  },
  warden: {
    label: "Containment Warden",
    tagline: "The wall the universe breaks against.",
    effects: { containment: 1.6, thrust: 0.85, maxSpeed: 0.8, boostRecharge: 0.9 },
    boons: ["+60% anomaly-containment reward"],
    banes: ["−20% top speed", "−15% thrust", "−10% boost recharge"],
  },
  voidrunner: {
    label: "Voidrunner",
    tagline: "Outrun the collapse; leave the mopping to others.",
    effects: { thrust: 1.35, maxSpeed: 1.3, boostRecharge: 1.4, containment: 0.75, scanRange: 0.85 },
    boons: ["+35% thrust", "+30% top speed", "+40% boost recharge"],
    banes: ["−25% containment reward", "−15% scan range"],
  },
};

// Ordered list for UI, "none" (stock) first so it reads as the neutral default.
export const DOCTRINE_CHOICES = [
  { id: "none", label: "Stock Configuration", tagline: "No specialization. A balanced generalist.", boons: [], banes: [] },
  { id: "surveyor", ...DOCTRINES.surveyor },
  { id: "warden", ...DOCTRINES.warden },
  { id: "voidrunner", ...DOCTRINES.voidrunner },
];

const FIELDS = ["thrust", "maxSpeed", "boostRecharge", "scanRange", "scanDuration", "containment"];

/** Full multiplier set for a doctrine id (defaults to all-1.0 / "none"). */
export const doctrineModifiers = (doctrine) => {
  const base = Object.fromEntries(FIELDS.map((f) => [f, 1]));
  const effects = DOCTRINES[doctrine]?.effects;
  return effects ? { ...base, ...effects } : base;
};
