// src/components/game/world/worldScales.js
//
// The ladder of cosmic scales (Cosmic Scales feature). Pure and deterministic
// like objectGenerator - no Phaser - so it unit-tests under node --test and
// stays the single source of truth for what each scale contains and how its
// world is seeded. Descending into a structure just re-seeds the same infinite
// chunk engine off that structure's id.
import seedrandom from "seedrandom";
import { CHUNK_SIZE } from "../constants.js";
import { generateChunkObjects } from "./objectGenerator.js";

export const SCALES = ["galactic", "stellar", "planetary"];

export const childScale = (s) => SCALES[Math.min(SCALES.length - 1, SCALES.indexOf(s) + 1)];
export const parentScale = (s) => SCALES[Math.max(0, SCALES.indexOf(s) - 1)];
export const canDescend = (s) => SCALES.indexOf(s) < SCALES.length - 1;

// The object category you descend INTO at each scale (galaxies -> stars -> —).
export const DESCEND_CATEGORY = { galactic: "galaxy", stellar: "star" };

// Human label for the breadcrumb / prompts.
export const SCALE_LABEL = { galactic: "Intergalactic", stellar: "Interstellar", planetary: "Interplanetary" };

// Stars by spectral class: real colors and a Sun-relative size band, weighted
// to the real initial mass function (M dwarfs dominate; O stars vanishingly rare).
export const STAR_CLASSES = {
  O: { category: "star", label: "O-type · Blue Giant", rarity: "exceptional", research: 40, color: 0x9bb0ff, size: [1.0, 1.5], weight: 0.0004 },
  B: { category: "star", label: "B-type · Blue-White", rarity: "rare", research: 26, color: 0xaabfff, size: [0.75, 1.15], weight: 0.006 },
  A: { category: "star", label: "A-type · White", rarity: "uncommon", research: 16, color: 0xd6e0ff, size: [0.6, 0.85], weight: 0.02 },
  F: { category: "star", label: "F-type · Yellow-White", rarity: "uncommon", research: 12, color: 0xf6f4ff, size: [0.5, 0.72], weight: 0.03 },
  G: { category: "star", label: "G-type · Sun-like", rarity: "common", research: 10, color: 0xffe6b0, size: [0.46, 0.66], weight: 0.076 },
  K: { category: "star", label: "K-type · Orange Dwarf", rarity: "common", research: 8, color: 0xffb46b, size: [0.4, 0.58], weight: 0.12 },
  M: { category: "star", label: "M-type · Red Dwarf", rarity: "common", research: 6, color: 0xff6f5b, size: [0.3, 0.48], weight: 0.76 },
};

// Planets by broad type, weighted so common rocky/barren worlds dominate and
// habitable terran worlds are a genuine find.
export const PLANET_CLASSES = {
  terran: { category: "planet", label: "Terran World", rarity: "rare", research: 20, color: 0x4fae6a, weight: 0.06 },
  ocean: { category: "planet", label: "Ocean World", rarity: "uncommon", research: 14, color: 0x2f7bd5, weight: 0.10 },
  desert: { category: "planet", label: "Desert World", rarity: "common", research: 8, color: 0xc9a24b, weight: 0.16 },
  rocky: { category: "planet", label: "Rocky World", rarity: "common", research: 6, color: 0x9a7b5a, weight: 0.22 },
  barren: { category: "planet", label: "Barren World", rarity: "common", research: 5, color: 0x8a8a8a, weight: 0.16 },
  ice: { category: "planet", label: "Ice World", rarity: "common", research: 7, color: 0xbfe6f0, weight: 0.12 },
  gas: { category: "planet", label: "Gas Giant", rarity: "uncommon", research: 12, color: 0xd8a86a, weight: 0.12 },
  lava: { category: "planet", label: "Molten World", rarity: "uncommon", research: 11, color: 0xd0492b, weight: 0.06 },
};

/**
 * The chunk seed for a scale, derived from the structure you descended into.
 * `path` is the id-chain of descended structures; only the last one matters.
 */
export function worldSeed(universeSeed, scale, path = []) {
  if (scale === "galactic") return `${universeSeed}`;
  const last = path[path.length - 1] ?? "root";
  return scale === "stellar" ? `${universeSeed}#gal#${last}` : `${universeSeed}#sys#${last}`;
}

const intIn = (rng, min, max) => min + Math.floor(rng() * (max - min + 1));

const pickWeighted = (rng, table) => {
  const total = Object.values(table).reduce((s, c) => s + c.weight, 0);
  let roll = rng() * total;
  for (const [id, c] of Object.entries(table)) {
    roll -= c.weight;
    if (roll <= 0) return id;
  }
  return Object.keys(table)[0];
};

const nameFor = (seed, id, category) => {
  const r = seedrandom(`${seed}#name#${id}`);
  const n = 100 + Math.floor(r() * 9900);
  if (category === "star") return `HD ${n}`;
  if (category === "planet") return `Kepler-${n}${String.fromCharCode(98 + Math.floor(r() * 6))}`;
  return `EVC ${n}`;
};

function placeFrom(objects, seed, cx, cy, scale, table, count) {
  const rng = seedrandom(`${seed}#${scale}#${cx}:${cy}`);
  for (let k = 0; k < count(rng); k++) {
    const classId = pickWeighted(rng, table);
    const info = table[classId];
    const id = `${scale[0]}:${cx}:${cy}:${k}`;
    const visual = info.size
      ? info.size[0] + rng() * (info.size[1] - info.size[0])
      : 0.4 + rng() * 0.45;
    objects.push({
      id,
      name: nameFor(seed, id, info.category),
      category: info.category,
      objectClass: classId,
      rarity: info.rarity,
      research: info.research,
      color: info.color,
      x: cx * CHUNK_SIZE + rng() * CHUNK_SIZE,
      y: cy * CHUNK_SIZE + rng() * CHUNK_SIZE,
      scale: visual,
      rotation: rng() * Math.PI * 2,
      alpha: 1,
    });
  }
  return objects;
}

/**
 * Objects in a chunk at a given scale. galactic delegates to the existing
 * galaxy generator; stellar and planetary use the class tables above. Returns
 * the same descriptor shape ChunkSystem.renderObject already consumes (plus a
 * `color` field the star/planet textures use).
 */
export function generateScaleObjects(seed, chunkX, chunkY, scale) {
  if (scale === "galactic") return generateChunkObjects(seed, chunkX, chunkY);
  if (scale === "stellar") {
    return placeFrom([], seed, chunkX, chunkY, scale, STAR_CLASSES, (rng) => intIn(rng, 3, 7));
  }
  if (scale === "planetary") {
    return placeFrom([], seed, chunkX, chunkY, scale, PLANET_CLASSES, (rng) => intIn(rng, 2, 5));
  }
  return [];
}

export const getScaleClassInfo = (objectClass) =>
  STAR_CLASSES[objectClass] ?? PLANET_CLASSES[objectClass] ?? null;
