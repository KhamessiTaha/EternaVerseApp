// src/components/game/content/upgradeCatalog.js
//
// Ship upgrade catalog - mirror of the backend's utils/upgradeCatalog.js
// (the server is the authority on cost and validation; this copy drives the
// Outfitting UI and applies the client-side stat effects). If they diverge,
// that's a balance bug to fix, not an API contract to enforce.

export const UPGRADE_TRACKS = {
  thrusters: {
    label: "Ion Thrusters",
    costs: [40, 90, 180],
    effect: "+15% thrust · +8% top speed per mark",
    flavor: "Gridded ion engines with progressively denser exhaust apertures.",
  },
  boostReactor: {
    label: "Boost Reactor",
    costs: [40, 90, 180],
    effect: "+30% boost recharge per mark",
    flavor: "An auxiliary fusion loop dedicated to the afterburner capacitors.",
  },
  scanner: {
    label: "Scanner Array",
    costs: [50, 110, 220],
    effect: "+25% scan range · −15% scan time per mark",
    flavor: "Wide-baseline interferometry for deep-field survey work.",
  },
  containment: {
    label: "Containment Rig",
    costs: [60, 140, 280],
    effect: "+8% anomaly resolution reward per mark",
    flavor: "Field emitters tuned to squeeze more stability out of every containment.",
  },
};

import { doctrineModifiers } from "./doctrineCatalog.js";

// Derived stat multipliers for the Phaser systems and reward math. Levels
// default to 0 (stock ship) when upgrades are absent. A doctrine (build
// identity) then multiplies the whole set - a Voidrunner's thrust stacks on
// top of Ion Thruster marks, a Warden's slowness cuts into them. Cheap enough
// to call per-frame.
export const getShipModifiers = (upgrades, doctrine) => {
  const lvl = (track) => upgrades?.[track] || 0;
  const d = doctrineModifiers(doctrine);
  return {
    thrust: (1 + lvl("thrusters") * 0.15) * d.thrust,
    maxSpeed: (1 + lvl("thrusters") * 0.08) * d.maxSpeed,
    boostRecharge: (1 + lvl("boostReactor") * 0.3) * d.boostRecharge,
    scanRange: (1 + lvl("scanner") * 0.25) * d.scanRange,
    scanDuration: Math.pow(0.85, lvl("scanner")) * d.scanDuration,
    containment: (1 + lvl("containment") * 0.08) * d.containment,
  };
};
