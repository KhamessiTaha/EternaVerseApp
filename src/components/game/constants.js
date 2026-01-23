export const CHUNK_SIZE = 1000;
export const UNIVERSE_SIZE = 100000;
export const MINIMAP_SIZE = 150;
export const ANOMALIES_PER_CHUNK = 2;
export const ANOMALY_SPAWN_CHANCE = 0.3;
export const CHUNK_UNLOAD_RADIUS = 3;

export const ANOMALY_TYPE_MAP = {
  blackHoleMerger: { color: 0x9900ff, label: "BLACK HOLE", baseRadius: 15 },
  darkEnergySurge: { color: 0x0066ff, label: "DARK ENERGY", baseRadius: 12 },
  supernovaChain: { color: 0xff6600, label: "SUPERNOVA", baseRadius: 18 },
  quantumFluctuation: { color: 0x00ff99, label: "QUANTUM", baseRadius: 10 },
  galacticCollision: { color: 0xff3366, label: "GALACTIC", baseRadius: 16 },
  cosmicVoid: { color: 0x6600ff, label: "COSMIC VOID", baseRadius: 14 },
  magneticReversal: { color: 0xffcc00, label: "MAGNETIC", baseRadius: 13 },
  darkMatterClump: { color: 0xff0066, label: "DARK MATTER", baseRadius: 14 },
  cosmicString: { color: 0xff0066, label: "COSMIC STRING", baseRadius: 14 },
  quantumTunneling: { color: 0x00ff99, label: "QUANTUM", baseRadius: 10 },
};

export const ANOMALY_TYPES = Object.entries(ANOMALY_TYPE_MAP).map(([type, config]) => ({
  type,
  ...config
}));