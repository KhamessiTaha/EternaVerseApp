// src/components/game/world/densityField.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { getChunkWeb } from "./densityField.js";

test("deterministic for same seed and coordinates", () => {
  const a = getChunkWeb("alpha", 3, -7);
  const b = getChunkWeb("alpha", 3, -7);
  assert.deepEqual(a, b);
});

test("different seeds give different fields", () => {
  let differs = 0;
  for (let x = 0; x < 20; x++) {
    if (getChunkWeb("alpha", x, 0).density !== getChunkWeb("beta", x, 0).density) differs++;
  }
  assert.ok(differs > 10);
});

test("density in [0,1] and class matches thresholds; all three classes occur", () => {
  const seen = new Set();
  for (let x = -20; x < 20; x++) {
    for (let y = -20; y < 20; y++) {
      const { density, webClass } = getChunkWeb("gamma", x, y);
      assert.ok(density >= 0 && density <= 1);
      assert.ok(["void", "filament", "cluster"].includes(webClass));
      seen.add(webClass);
    }
  }
  assert.equal(seen.size, 3, "expected voids, filaments and clusters in a 40x40 region");
});