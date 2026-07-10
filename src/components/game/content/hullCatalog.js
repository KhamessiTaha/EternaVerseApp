// src/components/game/content/hullCatalog.js
//
// Display-only mirror of the backend's utils/hullCatalog.js. The server is
// the sole authority on unlocks and validation - this supplies label/
// description/tier for rendering, and the palette for the color picker.
import { TIER_STYLE } from './achievements.js';

export const HULL_CATALOG = [
  { id: "interceptor", label: "Interceptor", tier: "starter", requiresAchievement: null,
    description: "Standard-issue survey vessel. Balanced and reliable." },
  { id: "cutter", label: "Cutter", tier: "bronze", requiresAchievement: "first-light",
    description: "Twin-prow forward hull, favored for close anomaly work." },
  { id: "cruiser", label: "Cruiser", tier: "silver", requiresAchievement: "not-alone",
    description: "Extended pod frame built for long first-contact runs." },
  { id: "hauler", label: "Hauler", tier: "gold", requiresAchievement: "taxonomist",
    description: "Reinforced industrial frame, wide cargo-rated stern." },
  { id: "vanguard", label: "Vanguard", tier: "platinum", requiresAchievement: "ascension",
    description: "Swept flagship hull. Worn only by those who witnessed transcendence." },
];

export const COLOR_PALETTE = [
  "#dfa73f", "#4fd1a5", "#8b7bd8", "#e0524a", "#4ec9e0", "#9497ad", "#f5cf7a", "#e0824a",
];

export const HULL_MAP = Object.fromEntries(HULL_CATALOG.map((h) => [h.id, h]));

// Single source of truth for every hull's silhouette: fractional (0-1)
// coordinates, nose toward y=0. TextureFactory scales these onto its
// canvas for the in-game sprite; HangarPanel scales them onto an SVG
// viewBox for the loadout preview - both read the exact same shape.
export const HULL_SHAPES = {
  interceptor: {
    points: [[0.5, 0.10], [0.70, 0.58], [0.60, 0.88], [0.5, 0.76], [0.40, 0.88], [0.30, 0.58]],
    cockpit: [0.5, 0.34, 0.07],
  },
  cutter: {
    points: [
      [0.5, 0.08], [0.59, 0.30], [0.80, 0.24], [0.66, 0.55], [0.64, 0.86], [0.5, 0.74],
      [0.36, 0.86], [0.34, 0.55], [0.20, 0.24], [0.41, 0.30],
    ],
    cockpit: [0.5, 0.32, 0.065],
  },
  cruiser: {
    points: [
      [0.5, 0.09], [0.63, 0.32], [0.84, 0.46], [0.80, 0.58], [0.65, 0.56], [0.63, 0.88],
      [0.5, 0.78], [0.37, 0.88], [0.35, 0.56], [0.20, 0.58], [0.16, 0.46], [0.37, 0.32],
    ],
    cockpit: [0.5, 0.30, 0.075],
  },
  hauler: {
    points: [
      [0.36, 0.10], [0.64, 0.10], [0.74, 0.32], [0.78, 0.82], [0.64, 0.90], [0.36, 0.90],
      [0.22, 0.82], [0.26, 0.32],
    ],
    cockpit: [0.5, 0.28, 0.08],
  },
  vanguard: {
    points: [
      [0.5, 0.06], [0.60, 0.26], [0.92, 0.50], [0.90, 0.62], [0.66, 0.52], [0.68, 0.90],
      [0.56, 0.94], [0.5, 0.80], [0.44, 0.94], [0.32, 0.90], [0.34, 0.52], [0.10, 0.62],
      [0.08, 0.50], [0.40, 0.26],
    ],
    cockpit: [0.5, 0.28, 0.075],
  },
};

export { TIER_STYLE };
