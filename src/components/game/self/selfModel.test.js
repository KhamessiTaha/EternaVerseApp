// src/components/game/self/selfModel.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  RECOLLECTION_BANDS, SUMMIT, comprehensionForDiscovery, MASTERY_ASCENSION,
  emptyAffinity, applyAxis, bandsPassed, leadingSelf, pickMemory, resolveSelf,
  ETERNAL_GATE, neglectDelta,
} from "./selfModel.js";

const s0 = () => ({ recollection: 0, affinity: emptyAffinity() });

test("comprehension raises recollection and the observer pull", () => {
  const s = applyAxis(s0(), "comprehension", comprehensionForDiscovery("rare"));
  assert.equal(s.recollection, 4);
  assert.equal(s.affinity.observer, 4);
  assert.equal(s.affinity.gardener, 0);
});

test("mastery raises recollection and the gardener pull", () => {
  const s = applyAxis(s0(), "mastery", MASTERY_ASCENSION);
  assert.equal(s.recollection, MASTERY_ASCENSION);
  assert.equal(s.affinity.gardener, MASTERY_ASCENSION);
});

test("comprehension tagged hidden also feeds the wanderer", () => {
  const s = applyAxis(s0(), "comprehension", 5, { hidden: true });
  assert.equal(s.affinity.observer, 5);
  assert.equal(s.affinity.wanderer, 5);
});

test("bandsPassed counts thresholds at or below recollection", () => {
  assert.equal(bandsPassed(0), 0);
  assert.equal(bandsPassed(RECOLLECTION_BANDS[0]), 1);
  assert.equal(bandsPassed(SUMMIT), RECOLLECTION_BANDS.length);
});

test("leadingSelf is the strongest pull, stable on ties", () => {
  assert.equal(leadingSelf({ observer: 5, gardener: 2, wanderer: 0, unmaker: 0 }), "observer");
  assert.equal(leadingSelf({ observer: 3, gardener: 3, wanderer: 0, unmaker: 0 }), "observer");
  assert.equal(leadingSelf({ observer: 1, gardener: 9, wanderer: 0, unmaker: 0 }), "gardener");
});

test("pickMemory seeds neutral first, then follows the leading pull", () => {
  const pool = [
    { id: "n1", self: "neutral" }, { id: "n2", self: "neutral" },
    { id: "o1", self: "observer" }, { id: "g1", self: "gardener" },
  ];
  const gard = { observer: 0, gardener: 50, wanderer: 0, unmaker: 0 };
  assert.equal(pickMemory(pool, gard, []).id, "n1");            // first is neutral
  assert.equal(pickMemory(pool, gard, ["n1", "n2"]).id, "g1");  // past seed -> leading
  assert.equal(pickMemory(pool, gard, ["n1", "n2", "g1"]).id, "o1"); // no gardener left -> any
  assert.equal(pickMemory(pool, gard, ["n1", "n2", "o1", "g1"]), null);
});

test("resolveSelf only fires at the summit and only to an available self", () => {
  const observerish = { observer: 80, gardener: 5, wanderer: 0, unmaker: 0 };
  assert.equal(resolveSelf(observerish, SUMMIT - 1, ["observer", "gardener"]), null);
  assert.equal(resolveSelf(observerish, SUMMIT, ["observer", "gardener"]), "observer");
  // unmaker leads but isn't authored in v1 -> falls to the strongest AVAILABLE self
  const dark = { observer: 2, gardener: 6, wanderer: 0, unmaker: 90 };
  assert.equal(resolveSelf(dark, SUMMIT, ["observer", "gardener"]), "gardener");
});

const ALL = ["observer", "gardener", "wanderer", "unmaker", "eternal"];

test("resolveSelf: the Unmaker is reachable once authored", () => {
  const dark = { observer: 2, gardener: 6, wanderer: 0, unmaker: 90 };
  assert.equal(resolveSelf(dark, SUMMIT, ALL), "unmaker");
});

test("resolveSelf: high in BOTH axes resolves to The Eternal", () => {
  const balanced = {
    observer: ETERNAL_GATE + 5, gardener: ETERNAL_GATE + 5, wanderer: 0, unmaker: 0,
  };
  assert.equal(resolveSelf(balanced, SUMMIT, ALL), "eternal");
  // one axis short of the gate -> the leader instead, not eternal
  const lopsided = { observer: 100, gardener: ETERNAL_GATE - 5, wanderer: 0, unmaker: 0 };
  assert.equal(resolveSelf(lopsided, SUMMIT, ALL), "observer");
});

test("resolveSelf: wanderer counts toward the understanding side of the Eternal gate", () => {
  const explorerAscendant = {
    observer: 5, wanderer: ETERNAL_GATE, gardener: ETERNAL_GATE + 5, unmaker: 0,
  };
  assert.equal(resolveSelf(explorerAscendant, SUMMIT, ALL), "eternal");
});

test("neglectDelta scores stability tearing and met civs left to die", () => {
  const uni = (stab, civs) => ({ currentState: { stabilityIndex: stab }, civilizations: civs });
  // stability crossing INTO critical
  assert.ok(neglectDelta(uni(0.3, []), uni(0.1, [])) > 0);
  // still critical, no fresh crossing -> no stability neglect
  assert.equal(neglectDelta(uni(0.1, []), uni(0.08, [])), 0);
  // a civ you'd MET goes newly extinct
  const met = { id: "c1", observed: true, extinct: false };
  const metDead = { id: "c1", observed: true, extinct: true };
  assert.ok(neglectDelta(uni(0.5, [met]), uni(0.5, [metDead])) > 0);
  // a civ you never met dying is not on your conscience
  const stranger = { id: "c2", observed: false, relationship: 0, extinct: false };
  const strangerDead = { id: "c2", observed: false, relationship: 0, extinct: true };
  assert.equal(neglectDelta(uni(0.5, [stranger]), uni(0.5, [strangerDead])), 0);
});