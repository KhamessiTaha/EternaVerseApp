// src/components/game/world/objectGenerator.js
//
// Pure, deterministic chunk-content generator. No Phaser: returns plain
// descriptors so it can be unit-tested with node --test and, if server-side
// world verification is ever needed, ported to the backend unchanged.
import seedrandom from "seedrandom";
import { CHUNK_SIZE } from "../constants.js";
import { getChunkWeb } from "./densityField.js";
import { OBJECT_CLASSES, MORPH_SUBTYPES } from "./researchValues.js";

// Galaxy counts / hero odds per web class. Morphology-density relation:
// ellipticals dominate clusters, spirals dominate the field (real astronomy).
const PROFILE = {
  void:     { galaxies: [0, 2],  nebulae: [0, 1], quasar: 0.003, merger: 0,
              morphWeights: { elliptical: 0.10, lenticular: 0.05, spiral: 0.35, barred: 0.25, irregular: 0.25 } },
  filament: { galaxies: [4, 8],  nebulae: [1, 3], quasar: 0.010, merger: 0.015,
              morphWeights: { elliptical: 0.18, lenticular: 0.08, spiral: 0.34, barred: 0.30, irregular: 0.10 } },
  cluster:  { galaxies: [12, 18], nebulae: [2, 4], quasar: 0.040, merger: 0.050,
              morphWeights: { elliptical: 0.50, lenticular: 0.12, spiral: 0.14, barred: 0.14, irregular: 0.10 } },
};

const intIn = (rng, [min, max]) => min + Math.floor(rng() * (max - min + 1));

const pickMorph = (rng, weights) => {
  let roll = rng();
  for (const [morph, w] of Object.entries(weights)) {
    roll -= w;
    if (roll <= 0) return morph;
  }
  return "spiral";
};

const catalogName = (seed, id) =>
  `EVC ${100 + Math.floor(seedrandom(`${seed}#name#${id}`)() * 9900)}`;

export function generateChunkObjects(seed, chunkX, chunkY) {
  const { webClass } = getChunkWeb(seed, chunkX, chunkY);
  const profile = PROFILE[webClass];
  const rng = seedrandom(`${seed}#obj#${chunkX}:${chunkY}`);
  const objects = [];
  let index = 0;

  const place = (objectClass, scale, alpha) => {
    const info = OBJECT_CLASSES[objectClass];
    const id = `obj:${chunkX}:${chunkY}:${index++}`;
    objects.push({
      id,
      name: catalogName(seed, id),
      category: info.category,
      objectClass,
      rarity: info.rarity,
      research: info.research,
      x: chunkX * CHUNK_SIZE + rng() * CHUNK_SIZE,
      y: chunkY * CHUNK_SIZE + rng() * CHUNK_SIZE,
      scale,
      rotation: rng() * Math.PI * 2,
      alpha,
      webClass,
    });
  };

  const galaxyCount = intIn(rng, profile.galaxies);
  for (let i = 0; i < galaxyCount; i++) {
    const morph = pickMorph(rng, profile.morphWeights);
    const subtypes = MORPH_SUBTYPES[morph];
    place(subtypes[Math.floor(rng() * subtypes.length)], 0.35 + rng() * 0.5, 0.8 + rng() * 0.2);
  }

  const nebulaCount = intIn(rng, profile.nebulae);
  for (let i = 0; i < nebulaCount; i++) {
    place("nebula", 0.5 + rng() * 0.7, 0.35 + rng() * 0.25);
  }

  if (rng() < profile.quasar) place("quasar", 0.8 + rng() * 0.3, 1);
  if (rng() < profile.merger) place("merger", 0.7 + rng() * 0.3, 0.9);

  return objects;
}
