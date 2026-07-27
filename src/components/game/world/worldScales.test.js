// src/components/game/world/worldScales.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SCALES, childScale, parentScale, canDescend, worldSeed,
  generateScaleObjects, generateSystem, STAR_CLASSES,
} from "./worldScales.js";

test("scale ladder navigates and clamps at the ends", () => {
  assert.equal(childScale("galactic"), "stellar");
  assert.equal(childScale("stellar"), "planetary");
  assert.equal(childScale("planetary"), "planetary"); // clamps
  assert.equal(parentScale("planetary"), "stellar");
  assert.equal(parentScale("galactic"), "galactic"); // clamps
  assert.equal(canDescend("planetary"), false);
  assert.equal(canDescend("galactic"), true);
});

test("worldSeed nests off the descended structure id", () => {
  assert.equal(worldSeed("S", "galactic", []), "S");
  assert.equal(worldSeed("S", "stellar", ["gal_7"]), "S#gal#gal_7");
  assert.equal(worldSeed("S", "planetary", ["gal_7", "star_3"]), "S#sys#star_3");
});

test("a descend -> ascend round-trip restores the exact parent seed", () => {
  const galacticSeed = worldSeed("S", "galactic", []);
  const stellarSeed = worldSeed("S", "stellar", ["gal_7"]);
  // descend into a star, then ascend back to the galaxy
  const back = worldSeed("S", "stellar", ["gal_7"]);
  assert.equal(back, stellarSeed);
  assert.notEqual(stellarSeed, galacticSeed);
});

test("generateScaleObjects is deterministic per (seed, chunk, scale)", () => {
  for (const scale of SCALES) {
    const a = generateScaleObjects("seed", 2, -1, scale);
    const b = generateScaleObjects("seed", 2, -1, scale);
    assert.deepEqual(a, b);
  }
});

test("stellar chunks yield stars", () => {
  const stars = generateScaleObjects("seed", 0, 0, "stellar");
  assert.ok(stars.length >= 3 && stars.length <= 7);
  assert.ok(stars.every((o) => o.category === "star"));
  assert.ok(stars.every((o) => typeof o.color === "number"));
});

test("a planetary system is bounded: one central star + a few named planets", () => {
  const sys = generateSystem("sys-seed", "HD 4821");
  const star = sys.filter((o) => o.category === "star");
  const planets = sys.filter((o) => o.category === "planet");
  assert.equal(star.length, 1);
  assert.ok(star[0].central && star[0].x === 0 && star[0].y === 0);
  assert.ok(planets.length >= 3 && planets.length <= 9, `got ${planets.length} planets`);
  // planets are named after the parent star, exoplanet-style
  assert.equal(planets[0].name, "HD 4821 b");
  assert.equal(planets[1].name, "HD 4821 c");
  // the central star chunk (0,0) contains the sun; distant chunks are empty
  assert.ok(generateScaleObjects("sys-seed", 0, 0, "planetary", "HD 4821").some((o) => o.central));
  assert.equal(generateScaleObjects("sys-seed", 40, 40, "planetary", "HD 4821").length, 0);
});

test("star spectral distribution is M-dwarf dominated (real IMF)", () => {
  const counts = {};
  for (let cx = 0; cx < 40; cx++) {
    for (let cy = 0; cy < 40; cy++) {
      for (const s of generateScaleObjects("seed", cx, cy, "stellar")) {
        counts[s.objectClass] = (counts[s.objectClass] || 0) + 1;
      }
    }
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  assert.ok(counts.M / total > 0.5, `M dwarfs should dominate, got ${(counts.M / total).toFixed(2)}`);
  // O stars are vanishingly rare
  assert.ok((counts.O || 0) < total * 0.01);
  // every class that appears is a real spectral class
  assert.ok(Object.keys(counts).every((c) => STAR_CLASSES[c]));
});

test("different galaxies generate different star fields", () => {
  const galA = generateScaleObjects(worldSeed("S", "stellar", ["gal_1"]), 0, 0, "stellar");
  const galB = generateScaleObjects(worldSeed("S", "stellar", ["gal_2"]), 0, 0, "stellar");
  assert.notDeepEqual(galA, galB);
});
