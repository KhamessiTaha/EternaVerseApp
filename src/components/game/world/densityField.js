// src/components/game/world/densityField.js
//
// Large-scale-structure field: smooth seeded value noise over chunk
// coordinates, thresholded into void / filament / cluster. One noise cell
// spans WEB_CELL_CHUNKS chunks so structure is larger than a screen.
// Thresholds are tuned empirically for roughly 35/45/20 space share
// (interpolated uniform noise concentrates toward 0.5, so these are not
// direct percentiles).
import seedrandom from "seedrandom";

export const WEB_CELL_CHUNKS = 4;

const VOID_MAX = 0.42;
const CLUSTER_MIN = 0.60;

const lattice = (seed, gx, gy) => seedrandom(`${seed}#web#${gx}:${gy}`)();
const smooth = (t) => t * t * (3 - 2 * t);

export function getChunkWeb(seed, chunkX, chunkY) {
  const fx = chunkX / WEB_CELL_CHUNKS;
  const fy = chunkY / WEB_CELL_CHUNKS;
  const gx = Math.floor(fx);
  const gy = Math.floor(fy);
  const tx = smooth(fx - gx);
  const ty = smooth(fy - gy);

  const v00 = lattice(seed, gx, gy);
  const v10 = lattice(seed, gx + 1, gy);
  const v01 = lattice(seed, gx, gy + 1);
  const v11 = lattice(seed, gx + 1, gy + 1);

  const density = (v00 * (1 - tx) + v10 * tx) * (1 - ty)
                + (v01 * (1 - tx) + v11 * tx) * ty;

  const webClass = density < VOID_MAX ? "void" : density < CLUSTER_MIN ? "filament" : "cluster";
  return { density, webClass };
}
