// src/components/game/world/researchValues.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  OBJECT_CLASSES, MORPH_SUBTYPES, KNOWN_CLASS_COUNT,
  ANOMALY_SCAN_BASE, getClassInfo,
} from "./researchValues.js";

test("catalog contains the full Hubble sequence plus nebula and phenomena", () => {
  const ids = Object.keys(OBJECT_CLASSES);
  for (const id of ["E0","E1","E2","E3","E4","E5","E6","E7","S0","Sa","Sb","Sc","SBa","SBb","SBc","Irr","nebula","quasar","merger"]) {
    assert.ok(ids.includes(id), `missing class ${id}`);
  }
  assert.equal(ids.length, 19);
});

test("every class entry is fully populated", () => {
  for (const [id, info] of Object.entries(OBJECT_CLASSES)) {
    assert.ok(["galaxy","nebula","phenomenon"].includes(info.category), id);
    assert.ok(typeof info.label === "string" && info.label.length > 0, id);
    assert.ok(["common","uncommon","rare","exceptional"].includes(info.rarity), id);
    assert.ok(Number.isFinite(info.research) && info.research > 0, id);
  }
});

test("morph subtype lists cover exactly the galaxy classes", () => {
  const listed = Object.values(MORPH_SUBTYPES).flat().sort();
  const galaxies = Object.entries(OBJECT_CLASSES)
    .filter(([, v]) => v.category === "galaxy").map(([k]) => k).sort();
  assert.deepEqual(listed, galaxies);
});

test("KNOWN_CLASS_COUNT includes anomaly types", () => {
  // 19 object classes + 10 anomaly types from ANOMALY_TYPE_MAP
  assert.equal(KNOWN_CLASS_COUNT, 29);
});

test("getClassInfo returns entry or null", () => {
  assert.equal(getClassInfo("SBb").morph, "barred");
  assert.equal(getClassInfo("nope"), null);
  assert.equal(ANOMALY_SCAN_BASE, 15);
});