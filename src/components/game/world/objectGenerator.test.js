// src/components/game/world/objectGenerator.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateChunkObjects } from "./objectGenerator.js";
import { getChunkWeb } from "./densityField.js";
import { OBJECT_CLASSES } from "./researchValues.js";

test("deterministic: same seed+chunk twice gives identical descriptors", () => {
  const a = generateChunkObjects("mySeed", 2, -3);
  const b = generateChunkObjects("mySeed", 2, -3);
  assert.deepEqual(a, b);
});

test("descriptors are well-formed and inside the chunk", () => {
  for (const d of generateChunkObjects("mySeed", 5, 5)) {
    assert.match(d.id, /^obj:5:5:\d+$/);
    assert.match(d.name, /^EVC \d+$/);
    assert.ok(OBJECT_CLASSES[d.objectClass], d.objectClass);
    assert.equal(d.category, OBJECT_CLASSES[d.objectClass].category);
    assert.equal(d.rarity, OBJECT_CLASSES[d.objectClass].rarity);
    assert.equal(d.research, OBJECT_CLASSES[d.objectClass].research);
    assert.ok(d.x >= 5000 && d.x < 6000 && d.y >= 5000 && d.y < 6000);
    assert.ok(d.scale > 0 && d.alpha > 0 && d.alpha <= 1);
  }
});

test("clusters are denser than voids and richer in ellipticals", () => {
  const byClass = { void: [], filament: [], cluster: [] };
  for (let x = -30; x < 30; x++) {
    for (let y = -30; y < 30; y++) {
      byClass[getChunkWeb("dist", x, y).webClass].push([x, y]);
    }
  }
  const stats = (coords) => {
    let n = 0, gal = 0, ell = 0;
    for (const [x, y] of coords.slice(0, 120)) {
      for (const d of generateChunkObjects("dist", x, y)) {
        n++;
        if (d.category === "galaxy") {
          gal++;
          if (OBJECT_CLASSES[d.objectClass].morph === "elliptical") ell++;
        }
      }
    }
    return { perChunk: n / Math.min(coords.length, 120), ellFrac: gal ? ell / gal : 0 };
  };
  const v = stats(byClass.void), c = stats(byClass.cluster);
  assert.ok(c.perChunk > v.perChunk * 3, `cluster ${c.perChunk} vs void ${v.perChunk}`);
  assert.ok(c.ellFrac > v.ellFrac, `morphology-density: ${c.ellFrac} vs ${v.ellFrac}`);
});