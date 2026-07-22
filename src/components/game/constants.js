export const CHUNK_SIZE = 1000;
export const UNIVERSE_SIZE = 100000;
export const MINIMAP_SIZE = 96;
export const ANOMALIES_PER_CHUNK = 2;
export const ANOMALY_SPAWN_CHANCE = 0.3;
export const CHUNK_UNLOAD_RADIUS = 3;

export const SCAN_RANGE = 350;          // world units
export const SCAN_DURATION_MS = 1200;   // channel time
export const SCAN_CANCEL_RANGE = SCAN_RANGE * 1.15; // leave range -> cancel

// Mirrors utils/stabilityConfig.js (server is authoritative). Used only to
// decide when to show the CRITICAL overlay; the backend owns real behavior.
export const STABILITY_CRITICAL_THRESHOLD = 0.15;
export const STABILITY_CLEAR_THRESHOLD = 0.25;

// Muted jewel-tone palette (false-color-instrument feel, not arcade neon) -
// each type gets a distinct hue so they stay distinguishable at a glance.
// `category` mirrors the backend's AnomalySchema category enum and drives
// which minigame a given anomaly launches (see InputSystem.mapAnomalyToGame).
export const ANOMALY_TYPE_MAP = {
  blackHoleMerger: { color: 0x8b7bd8, label: "BLACK HOLE", baseRadius: 15, category: "gravitational" },
  darkEnergySurge: { color: 0x5b8dd9, label: "DARK ENERGY", baseRadius: 12, category: "cosmological" },
  supernovaChain: { color: 0xe0824a, label: "SUPERNOVA", baseRadius: 18, category: "stellar" },
  quantumFluctuation: { color: 0x4fd1a5, label: "QUANTUM", baseRadius: 10, category: "quantum" },
  galacticCollision: { color: 0xe0524a, label: "GALACTIC", baseRadius: 16, category: "structural" },
  cosmicVoid: { color: 0x6d6ad4, label: "COSMIC VOID", baseRadius: 14, category: "structural" },
  magneticReversal: { color: 0x4ec9e0, label: "MAGNETIC", baseRadius: 13, category: "electromagnetic" },
  darkMatterClump: { color: 0xc77dd8, label: "DARK MATTER", baseRadius: 14, category: "gravitational" },
  cosmicString: { color: 0xd4a544, label: "COSMIC STRING", baseRadius: 14, category: "structural" },
  quantumTunneling: { color: 0x3fd0c9, label: "QUANTUM TUNNEL", baseRadius: 10, category: "quantum" },
};

export const ANOMALY_TYPES = Object.entries(ANOMALY_TYPE_MAP).map(([type, config]) => ({
  type,
  ...config
}));