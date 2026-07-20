// src/components/game/content/hullCatalog.js
//
// Display + gameplay data for ship hulls. The backend's utils/hullCatalog.js
// mirrors ids/requirements and is the sole authority on unlocks; this file
// owns everything the client renders and simulates: silhouettes, thruster
// positions, and flight characteristics.
import { TIER_STYLE } from './achievements.js';

export const HULL_CATALOG = [
  { id: "interceptor", label: "Interceptor", tier: "starter", requiresAchievement: null,
    description: "Standard-issue survey vessel. Balanced and reliable." },
  { id: "cutter", label: "Cutter", tier: "bronze", requiresAchievement: "first-light",
    description: "Twin-prow forward hull, favored for close anomaly work." },
  { id: "falcon", label: "Falcon", tier: "bronze", requiresAchievement: "on-mission",
    description: "Stripped-down racing frame. Fast and twitchy - and made of tinfoil." },
  { id: "cruiser", label: "Cruiser", tier: "silver", requiresAchievement: "not-alone",
    description: "Extended pod frame built for long first-contact runs." },
  { id: "bastion", label: "Bastion", tier: "silver", requiresAchievement: "anomaly-hunter",
    description: "Armored containment barge. Slow, but shrugs off anomaly exposure." },
  { id: "hauler", label: "Hauler", tier: "gold", requiresAchievement: "taxonomist",
    description: "Reinforced industrial frame, wide cargo-rated stern." },
  { id: "tachyon", label: "Tachyon", tier: "platinum", requiresAchievement: "singularity",
    description: "Experimental relativistic needle. Visibly length-contracts as it approaches game-c. Fragile as physics demands." },
  { id: "vanguard", label: "Vanguard", tier: "platinum", requiresAchievement: "ascension",
    description: "Swept flagship hull. Worn only by those who witnessed transcendence." },
];

export const COLOR_PALETTE = [
  "#dfa73f", "#4fd1a5", "#8b7bd8", "#e0524a", "#4ec9e0", "#9497ad", "#f5cf7a", "#e0824a",
];

export const HULL_MAP = Object.fromEntries(HULL_CATALOG.map((h) => [h.id, h]));

// Flight characteristics, multiplicative on top of ship upgrades. Every
// hull is a real tradeoff, not a straight upgrade: the Falcon turns on a
// dime but takes +15% damage; the Bastion tanks anomaly exposure at the
// cost of agility; the Tachyon hits 1.6x top speed but is glass.
// `relativistic` enables the length-contraction visual (UniverseScene).
export const HULL_STATS = {
  interceptor: { thrust: 1.0,  maxSpeed: 1.0,  turn: 1.0,  damageTaken: 1.0 },
  cutter:      { thrust: 1.05, maxSpeed: 1.0,  turn: 1.1,  damageTaken: 1.0 },
  falcon:      { thrust: 1.2,  maxSpeed: 1.08, turn: 1.3,  damageTaken: 1.15 },
  cruiser:     { thrust: 1.0,  maxSpeed: 1.05, turn: 0.95, damageTaken: 0.9 },
  bastion:     { thrust: 0.95, maxSpeed: 0.9,  turn: 0.9,  damageTaken: 0.55 },
  hauler:      { thrust: 0.95, maxSpeed: 0.92, turn: 0.85, damageTaken: 0.65 },
  tachyon:     { thrust: 1.15, maxSpeed: 1.6,  turn: 1.1,  damageTaken: 1.25, relativistic: true },
  vanguard:    { thrust: 1.1,  maxSpeed: 1.1,  turn: 1.05, damageTaken: 0.85 },
};

// Single source of truth for every hull's geometry: fractional (0-1)
// coordinates, nose toward y=0. TextureFactory scales these onto its canvas
// for the in-game sprite; HangarPanel scales them onto an SVG viewBox for
// the preview. `thrusters` are the engine-trail emit points (stern side),
// consumed by PlayerObject.updateTrail - per hull, so trails always come
// out of the actual engines instead of the old PNG's hardcoded offsets.
export const HULL_SHAPES = {
  interceptor: {
    points: [[0.5, 0.10], [0.70, 0.58], [0.60, 0.88], [0.5, 0.76], [0.40, 0.88], [0.30, 0.58]],
    cockpit: [0.5, 0.34, 0.07],
    thrusters: [[0.42, 0.84], [0.58, 0.84]],
  },
  cutter: {
    points: [
      [0.5, 0.08], [0.59, 0.30], [0.80, 0.24], [0.66, 0.55], [0.64, 0.86], [0.5, 0.74],
      [0.36, 0.86], [0.34, 0.55], [0.20, 0.24], [0.41, 0.30],
    ],
    cockpit: [0.5, 0.32, 0.065],
    thrusters: [[0.40, 0.82], [0.60, 0.82]],
  },
  falcon: {
    points: [
      [0.5, 0.04], [0.56, 0.30], [0.68, 0.44], [0.58, 0.50], [0.60, 0.90], [0.5, 0.80],
      [0.40, 0.90], [0.42, 0.50], [0.32, 0.44], [0.44, 0.30],
    ],
    cockpit: [0.5, 0.30, 0.055],
    thrusters: [[0.5, 0.88]],
  },
  cruiser: {
    points: [
      [0.5, 0.09], [0.63, 0.32], [0.84, 0.46], [0.80, 0.58], [0.65, 0.56], [0.63, 0.88],
      [0.5, 0.78], [0.37, 0.88], [0.35, 0.56], [0.20, 0.58], [0.16, 0.46], [0.37, 0.32],
    ],
    cockpit: [0.5, 0.30, 0.075],
    thrusters: [[0.41, 0.84], [0.59, 0.84]],
  },
  bastion: {
    points: [
      [0.38, 0.08], [0.62, 0.08], [0.80, 0.28], [0.84, 0.60], [0.72, 0.92],
      [0.28, 0.92], [0.16, 0.60], [0.20, 0.28],
    ],
    cockpit: [0.5, 0.26, 0.085],
    thrusters: [[0.38, 0.90], [0.62, 0.90]],
  },
  hauler: {
    points: [
      [0.36, 0.10], [0.64, 0.10], [0.74, 0.32], [0.78, 0.82], [0.64, 0.90], [0.36, 0.90],
      [0.22, 0.82], [0.26, 0.32],
    ],
    cockpit: [0.5, 0.28, 0.08],
    thrusters: [[0.36, 0.88], [0.5, 0.90], [0.64, 0.88]],
  },
  tachyon: {
    // Needle body with thin outrigger nacelles - reads as a relativistic
    // probe. Concave polygon: body -> right nacelle -> stern -> left nacelle.
    points: [
      [0.5, 0.02], [0.55, 0.34], [0.55, 0.60], [0.78, 0.52], [0.82, 0.58], [0.62, 0.72],
      [0.58, 0.94], [0.5, 0.84], [0.42, 0.94], [0.38, 0.72], [0.18, 0.58], [0.22, 0.52],
      [0.45, 0.60], [0.45, 0.34],
    ],
    cockpit: [0.5, 0.26, 0.05],
    thrusters: [[0.30, 0.80], [0.70, 0.80], [0.5, 0.92]],
  },
  vanguard: {
    points: [
      [0.5, 0.06], [0.60, 0.26], [0.92, 0.50], [0.90, 0.62], [0.66, 0.52], [0.68, 0.90],
      [0.56, 0.94], [0.5, 0.80], [0.44, 0.94], [0.32, 0.90], [0.34, 0.52], [0.10, 0.62],
      [0.08, 0.50], [0.40, 0.26],
    ],
    cockpit: [0.5, 0.28, 0.075],
    thrusters: [[0.38, 0.88], [0.5, 0.82], [0.62, 0.88]],
  },
};

export { TIER_STYLE };
