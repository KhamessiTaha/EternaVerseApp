// src/components/game/world/classifyModel.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CLASSIFY_BUCKETS, BUCKET_IDS, CLASSIFY_MULT, CLASSIFY_STREAK_BONUS,
  DIAGNOSTICS, answerFor, isClassifiable, bucketForKey, classifyResult,
} from "./classifyModel.js";
import { OBJECT_CLASSES } from "./researchValues.js";

test("every galaxy the generator can place has a correct answer", () => {
  // If a class can be rendered but can't be classified, the prompt would
  // appear on something unanswerable.
  for (const [id, info] of Object.entries(OBJECT_CLASSES)) {
    if (info.category !== "galaxy") continue;
    const answer = answerFor(id);
    assert.ok(answer, `no answer for galaxy class ${id}`);
    assert.ok(BUCKET_IDS.includes(answer), `${id} answers with unknown bucket ${answer}`);
  }
});

test("the Hubble sequence maps onto the four buckets the renderer can show", () => {
  assert.equal(answerFor("E0"), "elliptical");
  assert.equal(answerFor("E7"), "elliptical");
  assert.equal(answerFor("Sa"), "spiral");
  assert.equal(answerFor("Sc"), "spiral");
  assert.equal(answerFor("SBa"), "barred");
  assert.equal(answerFor("SBc"), "barred");
  assert.equal(answerFor("Irr"), "irregular");
});

test("lenticulars answer as elliptical - that is what is drawn on screen", () => {
  // TextureFactory.keyFor maps lenticular onto the elliptical texture, so an
  // S0 and an E are the same picture. Nobody may be wrong for a reason the
  // screen never showed them.
  assert.equal(answerFor("S0"), "elliptical");
  assert.equal(classifyResult("elliptical", "S0").correct, true);
});

test("non-galaxies are never classifiable", () => {
  for (const id of ["nebula", "quasar", "merger", "supernovaChain", "", null, undefined]) {
    assert.equal(answerFor(id), null, String(id));
  }
  assert.equal(isClassifiable({ category: "anomaly", objectClass: "quantumFluctuation" }), false);
  assert.equal(isClassifiable({ category: "phenomenon", objectClass: "quasar" }), false);
  assert.equal(isClassifiable({ category: "galaxy", objectClass: "Sb" }), true);
  assert.equal(isClassifiable(null), false);
});

test("a correct call pays and advances the streak an extra step", () => {
  const r = classifyResult("barred", "SBb");
  assert.equal(r.called, true);
  assert.equal(r.correct, true);
  assert.equal(r.mult, CLASSIFY_MULT);
  assert.equal(r.streakBonus, CLASSIFY_STREAK_BONUS);
  assert.equal(r.diagnostic, null, "a right answer needs no lecture");
});

test("a wrong call is never punished - it teaches instead", () => {
  const r = classifyResult("barred", "E4");
  assert.equal(r.correct, false);
  assert.equal(r.mult, 1, "normal value, never less");
  assert.equal(r.streakBonus, 0);
  assert.equal(r.answer, "elliptical");
  assert.equal(r.diagnostic, DIAGNOSTICS.elliptical);
  assert.match(r.diagnostic, /cluster/i, "the hint must be diagnostic, not historical");
});

test("no call pays normally and says nothing", () => {
  const r = classifyResult(null, "Sb");
  assert.equal(r.called, false);
  assert.equal(r.mult, 1);
  assert.equal(r.streakBonus, 0);
  assert.equal(r.diagnostic, null, "silence - not a scolding for skipping");
});

test("knowledge pays about what a perfect streak pays", () => {
  // The thesis as a number: +50% for knowing vs the streak ceiling of +60%.
  assert.ok(CLASSIFY_MULT >= 1.4 && CLASSIFY_MULT <= 1.6);
});

test("every bucket has a key, a diagnostic, and a unique id", () => {
  assert.equal(CLASSIFY_BUCKETS.length, 4);
  const keys = CLASSIFY_BUCKETS.map((b) => b.key);
  assert.equal(new Set(keys).size, 4, "keys must be unambiguous");
  for (const b of CLASSIFY_BUCKETS) {
    assert.ok(DIAGNOSTICS[b.id], `${b.id} has no diagnostic to teach with`);
    assert.equal(bucketForKey(b.key), b.id);
  }
  assert.equal(bucketForKey("9"), null);
  assert.equal(bucketForKey(null), null);
});
