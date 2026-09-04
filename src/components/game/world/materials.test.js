// src/components/game/world/materials.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MATERIALS, MATERIAL_IDS, SOURCES, materialById, isAvailable,
  availableMaterials, harvestableFrom, rollHarvest, explainEmpty,
} from "./materials.js";

// A universe at a given point in its life.
const cs = (over = {}) => ({
  age: 0, metallicity: 0, stellarGenerations: 0, blackHoleCount: 0, starCount: 0,
  ...over,
});

const youngCosmos = cs();
const matureCosmos = cs({ metallicity: 0.7, stellarGenerations: 6, blackHoleCount: 1e17 });

// The state a real universe is actually IN at the end of a 400-step run, on the
// HARDEST difficulty - measured by stepping the live PhysicsEngine, not guessed.
// Advanced ages slowest per step, so it is the worst case for every gate.
//
// This fixture exists because gates were being written against the 0-1 range
// they appeared to have rather than the range a universe reaches. Enrichment
// saturates near 60% of solar and stops; uranium's old 0.6 gate sat above that
// ceiling and opened on step 748, 1110, or never. Everything must be
// obtainable inside a run, on every difficulty, or it is not a rare material -
// it is a missing one.
const endOfHardestRun = cs({
  metallicity: 0.483,
  stellarGenerations: 10,
  blackHoleCount: 8.3e16,
});

test("every material declares where it came from and how to recognise it", () => {
  for (const id of MATERIAL_IDS) {
    const m = MATERIALS[id];
    assert.ok(m.label && m.symbol, id);
    assert.ok(m.forgedBy && m.forgedBy.length > 0, `${id} has no origin`);
    assert.ok(m.tell && m.tell.length > 20, `${id} teaches nothing`);
    assert.ok(Array.isArray(m.sources) && m.sources.length > 0, `${id} is unobtainable`);
    assert.ok(Number.isInteger(m.tier), id);
    assert.equal(materialById(id), m);
  }
  assert.equal(materialById("unobtanium"), null);
});

// --- the core rule -------------------------------------------------------

test("a young universe has only what the Big Bang made", () => {
  const got = availableMaterials(youngCosmos);
  assert.deepEqual(got, ["hydrogen", "helium"]);
});

test("you cannot harvest gold before neutron stars have merged", () => {
  // The rule the whole design rests on.
  assert.equal(isAvailable("gold", youngCosmos), false);
  assert.equal(isAvailable("gold", cs({ metallicity: 0.29 })), false);
  assert.equal(isAvailable("gold", cs({ metallicity: 0.3 })), true);
});

test("carbon and oxygen wait for the first generation of stars to die", () => {
  assert.equal(isAvailable("carbon", cs({ stellarGenerations: 0.9 })), false);
  assert.equal(isAvailable("carbon", cs({ stellarGenerations: 1 })), true);
  assert.equal(isAvailable("oxygen", cs({ stellarGenerations: 1 })), true);
});

test("the heaviest elements need the richest universes", () => {
  // Uranium is above gold on the table AND above it in the gate.
  assert.ok(MATERIALS.uranium.tier > MATERIALS.gold.tier);
  assert.equal(isAvailable("uranium", cs({ metallicity: 0.4 })), false);
  assert.equal(isAvailable("uranium", cs({ metallicity: 0.45 })), true);
});

test("Hawking quanta need a universe its black holes have taken over", () => {
  // NOT `> 0`: a universe is seeded with 5e3 black holes at genesis, so the
  // old gate handed out a tier-5 material on step 1.
  assert.equal(isAvailable("hawking", cs({ blackHoleCount: 5e3 })), false);
  assert.equal(isAvailable("hawking", cs({ blackHoleCount: 5e16 })), true);
});

test("degenerate matter is not gated on a counter that saturates instantly", () => {
  // stellarGenerations is clamped at 10 and reaches the clamp by step 25 on
  // every difficulty, so `>= 5` opened the rarest material in the game on
  // step 3. A gate that a brand-new universe passes is not a gate.
  assert.equal(isAvailable("degenerate", cs({ stellarGenerations: 10 })), false);
  assert.equal(isAvailable("degenerate", cs({ blackHoleCount: 3e16 })), true);
});

test("every material is obtainable inside a run, on the hardest difficulty", () => {
  // The guard for the whole class of bug: a gate written against a range the
  // universe never reaches. If this fails, something is decorative.
  const missing = MATERIAL_IDS.filter((id) => !isAvailable(id, endOfHardestRun));
  assert.deepEqual(missing, [], `unreachable in a real run: ${missing.join(", ")}`);
});

test("a mature universe eventually offers everything", () => {
  assert.deepEqual(availableMaterials(matureCosmos).sort(), MATERIAL_IDS.slice().sort());
});

test("gates never throw on a malformed or missing state", () => {
  for (const junk of [null, undefined, {}, { metallicity: "nonsense" }]) {
    assert.doesNotThrow(() => availableMaterials(junk));
    assert.deepEqual(availableMaterials(junk), ["hydrogen", "helium"]);
  }
});

// --- sources -------------------------------------------------------------

test("the heavy elements come ONLY from a neutron-star merger", () => {
  // This is what makes the kilonova worth hunting - there is no other way.
  for (const id of ["gold", "platinum", "uranium"]) {
    assert.deepEqual(MATERIALS[id].sources, [SOURCES.merger], id);
  }
  const fromSupernova = harvestableFrom(SOURCES.supernova, matureCosmos);
  assert.ok(!fromSupernova.includes("gold"), "a supernova must never yield gold");
});

test("iron comes from a supernova and nowhere else", () => {
  assert.deepEqual(MATERIALS.iron.sources, [SOURCES.supernova]);
});

test("a source offers only what the era has unlocked", () => {
  assert.deepEqual(harvestableFrom(SOURCES.merger, youngCosmos), []);
  assert.ok(harvestableFrom(SOURCES.merger, matureCosmos).includes("gold"));
  assert.ok(harvestableFrom(SOURCES.nebula, youngCosmos).includes("hydrogen"));
});

// --- harvesting ----------------------------------------------------------

test("a harvest only ever yields something the universe has made", () => {
  for (let i = 0; i < 200; i++) {
    const got = rollHarvest(SOURCES.nebula, youngCosmos, { rng: () => i / 200 });
    assert.ok(got, "a nebula always has hydrogen");
    assert.ok(["hydrogen", "helium"].includes(got.id), `young cosmos yielded ${got.id}`);
    assert.ok(got.amount >= 1);
  }
});

test("an empty source returns null rather than pretending", () => {
  assert.equal(rollHarvest(SOURCES.merger, youngCosmos), null);
  assert.equal(rollHarvest("nonsense", matureCosmos), null);
});

test("common materials come in quantity, exotic ones one at a time", () => {
  const h = rollHarvest(SOURCES.nebula, youngCosmos, { rng: () => 0 });
  assert.ok(h.amount >= 3, "hydrogen should be plentiful");

  // Force the rarest pick in a mature merger.
  const rare = rollHarvest(SOURCES.merger, matureCosmos, { rng: () => 0.999 });
  assert.ok(rare.amount <= 2, `exotic yield was ${rare.amount}`);
});

test("skill pays here the way it pays everywhere else", () => {
  const poor = rollHarvest(SOURCES.nebula, youngCosmos, { rng: () => 0, grade: 1 });
  const great = rollHarvest(SOURCES.nebula, youngCosmos, { rng: () => 0, grade: 2.6 });
  assert.ok(great.amount > poor.amount);
});

test("rarer materials are rarer within their own source", () => {
  const counts = {};
  for (let i = 0; i < 400; i++) {
    const got = rollHarvest(SOURCES.merger, matureCosmos, { rng: () => (i + 0.5) / 400 });
    counts[got.id] = (counts[got.id] || 0) + 1;
  }
  assert.ok((counts.gold || 0) > (counts.uranium || 0),
    `gold ${counts.gold} should outnumber uranium ${counts.uranium}`);
});

// --- teaching ------------------------------------------------------------

test("an empty source explains itself instead of just refusing", () => {
  // A locked material has to become a reason to keep playing, not a wall.
  const why = explainEmpty(SOURCES.merger, youngCosmos);
  assert.match(why, /Gold/);
  assert.match(why, /r-process|neutron/i, "it must say WHERE it comes from");
});
