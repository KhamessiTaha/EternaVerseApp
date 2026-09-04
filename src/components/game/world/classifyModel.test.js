// src/components/game/world/classifyModel.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CLASSIFY_BUCKETS, BUCKET_IDS, CLASSIFY_MULT, CLASSIFY_STREAK_BONUS,
  DIAGNOSTICS, answerFor, isClassifiable, bucketForKey, classifyResult,
  CERTIFY_MIN_CALLS, CERTIFY_ACCURACY, isCertified, certifiedBuckets,
  recordCall, shouldPrompt, certifyProgress,
} from "./classifyModel.js";
import { OBJECT_CLASSES } from "./researchValues.js";

test("every bucket is bindable by Phaser, not just printable", () => {
  // The shipped bug: `key` ("1") was passed straight to addKey(), which
  // resolves KeyCodes["1"] - undefined - so all four keys had no keycode and
  // the prompt could not be answered at all. `code` must be the spelled-out
  // KeyCodes NAME, never the digit.
  const SPELLED = { 1: "ONE", 2: "TWO", 3: "THREE", 4: "FOUR" };
  for (const b of CLASSIFY_BUCKETS) {
    assert.match(b.key, /^\d$/, `${b.id} should print a single digit`);
    assert.equal(b.code, SPELLED[b.key], `${b.id} must bind the KeyCodes name`);
  }
});

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

// --- certification: the mechanic retires itself --------------------------
// The failure mode was never "too easy", it was "too often". Depth is no cure
// for frequency, so mastery has to REMOVE the prompt, not escalate it.

const rec = (calls, correct) => ({ elliptical: { calls, correct } });

test("certification needs a real sample, not a lucky streak", () => {
  assert.equal(isCertified(rec(CERTIFY_MIN_CALLS - 1, CERTIFY_MIN_CALLS - 1), "elliptical"), false);
  assert.equal(isCertified(rec(CERTIFY_MIN_CALLS, CERTIFY_MIN_CALLS), "elliptical"), true);
});

test("certification needs accuracy, not just volume", () => {
  assert.equal(isCertified(rec(100, 50), "elliptical"), false);
  assert.equal(isCertified(rec(100, 89), "elliptical"), false);
  assert.equal(isCertified(rec(100, 90), "elliptical"), true);
});

test("an empty or missing record certifies nothing", () => {
  for (const r of [null, undefined, {}, { elliptical: null }]) {
    assert.equal(isCertified(r, "elliptical"), false);
    assert.deepEqual(certifiedBuckets(r), []);
  }
});

test("a certified family is never asked about again", () => {
  const certified = rec(20, 20);
  assert.equal(shouldPrompt("E4", certified), false);
  assert.equal(shouldPrompt("S0", certified), false, "S0 answers as elliptical");
  // ...but the families they haven't proved still are.
  assert.equal(shouldPrompt("Sb", certified), true);
  assert.equal(shouldPrompt("Irr", certified), true);
});

test("a certified family still PAYS - that is the whole deal", () => {
  // Going quiet must not cost the player the bonus they earned, or
  // certification would read as a punishment for getting good.
  const r = classifyResult(null, "E4", rec(20, 20));
  assert.equal(r.certified, true);
  assert.equal(r.called, false, "nothing was asked");
  assert.equal(r.mult, CLASSIFY_MULT, "and it still pays full");
  assert.equal(r.streakBonus, CLASSIFY_STREAK_BONUS);
  assert.equal(r.diagnostic, null);
});

test("an uncertified family behaves exactly as before", () => {
  const none = {};
  assert.equal(classifyResult(null, "Sb", none).mult, 1);
  assert.equal(classifyResult("spiral", "Sb", none).mult, CLASSIFY_MULT);
  assert.equal(classifyResult("barred", "Sb", none).mult, 1);
  assert.ok(classifyResult("barred", "Sb", none).diagnostic, "a wrong call still teaches");
});

test("a wrong call counts against the family that was CORRECT", () => {
  // Otherwise a player could certify in spirals by never calling spiral -
  // logging against the guess would let them dodge their own mistakes.
  const after = recordCall({}, "spiral", false);
  assert.deepEqual(after.spiral, { calls: 1, correct: 0 });
  assert.equal(after.barred, undefined);
});

test("recording is pure and accumulates", () => {
  const first = recordCall({}, "spiral", true);
  const second = recordCall(first, "spiral", false);
  assert.deepEqual(first.spiral, { calls: 1, correct: 1 }, "the original was not mutated");
  assert.deepEqual(second.spiral, { calls: 2, correct: 1 });
});

test("recording ignores a family that is not one of ours", () => {
  assert.deepEqual(recordCall({}, "lenticular", true), {});
  assert.deepEqual(recordCall({}, null, true), {});
});

test("twelve perfect calls certify, and the thirteenth is silent", () => {
  // The whole arc, end to end.
  let r = {};
  for (let i = 0; i < CERTIFY_MIN_CALLS; i++) {
    assert.equal(shouldPrompt("E2", r), true, `still asking at call ${i}`);
    r = recordCall(r, "elliptical", true);
  }
  assert.equal(shouldPrompt("E2", r), false, "it should have gone quiet");
  assert.deepEqual(certifiedBuckets(r), ["elliptical"]);
});
