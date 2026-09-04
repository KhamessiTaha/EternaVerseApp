// src/components/game/world/researchValues.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  OBJECT_CLASSES, MORPH_SUBTYPES, KNOWN_CLASS_COUNT,
  ANOMALY_SCAN_BASE, getClassInfo, axisRatioFor,
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
// --- the Hubble number is drawn, not just stored -------------------------

test("ellipticals are drawn at the flattening their class names", () => {
  // En is DEFINED as n = 10(1 - b/a).
  assert.equal(axisRatioFor("E0"), 1);
  assert.ok(Math.abs(axisRatioFor("E4") - 0.6) < 1e-9);
  assert.ok(Math.abs(axisRatioFor("E7") - 0.3) < 1e-9);
});

test("the classes that pay more look different from the ones that pay less", () => {
  // The bug this closes: E0-E3 pay 6 RP and E4-E7 pay 12-14, but every
  // elliptical was drawn from the same three textures picked by hashing the
  // object id - so the payoff varied while the evidence did not.
  const cheap = ["E0", "E1", "E2", "E3"];
  const dear = ["E4", "E5", "E6", "E7"];
  for (const c of cheap) {
    for (const d of dear) {
      assert.ok(axisRatioFor(c) > axisRatioFor(d), `${c} should look rounder than ${d}`);
      assert.ok(OBJECT_CLASSES[c].research < OBJECT_CLASSES[d].research, `${c} pays less than ${d}`);
    }
  }
});

test("lenticulars are drawn as the flat disks they are", () => {
  assert.ok(axisRatioFor("S0") < 0.5);
});

test("everything else is drawn undistorted", () => {
  for (const id of ["Sa", "Sb", "Sc", "SBa", "SBb", "SBc", "Irr", "nebula", "quasar", "merger"]) {
    assert.equal(axisRatioFor(id), 1, id);
  }
  for (const junk of [null, undefined, "", "E8", "E99", 42]) {
    assert.equal(axisRatioFor(junk), 1, String(junk));
  }
});
