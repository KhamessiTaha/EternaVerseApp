// src/components/game/wardenProgress.test.js
import { test } from "node:test";
import assert from "node:assert/strict";

// localStorage shim (node has none) - must exist before importing the module.
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};

const fresh = async () => {
  mem.clear();
  return import(`./wardenProgress.js?bust=${Math.random()}`); // defeat module cache
};

test("recordAxis accumulates recollection and recovers memories across bands", async () => {
  const wp = await fresh();
  // 8 comprehension crosses band 0 (>=8) -> 1 memory owed
  const recovered = wp.recordAxis("comprehension", 8).recoveredMemories;
  assert.equal(recovered.length, 1);
  assert.equal(wp.getSelf().recollection, 8);
  assert.equal(wp.getSelf().memoriesRecovered.length, 1);
});

test("a knowledge-heavy climb to the summit realizes The Observer", async () => {
  const wp = await fresh();
  let revelation = null;
  for (let i = 0; i < 40; i++) {
    const r = wp.recordAxis("comprehension", 4); // rare-tier scans
    if (r.revelation) revelation = r.revelation;
  }
  assert.equal(revelation, "observer");
  assert.ok(wp.getSelf().realized.includes("observer"));
});

test("a mastery-heavy climb realizes The Gardener instead", async () => {
  const wp = await fresh();
  let revelation = null;
  for (let i = 0; i < 4; i++) {
    const r = wp.recordAxis("mastery", 50); // ascensions
    if (r.revelation) revelation = r.revelation;
  }
  assert.equal(revelation, "gardener");
});

test("onSelfProgress fires with a live snapshot", async () => {
  const wp = await fresh();
  let seen = null;
  const off = wp.onSelfProgress((s) => { seen = s; });
  assert.ok(seen && seen.recollection === 0);
  wp.recordAxis("mastery", 50);
  assert.equal(seen.recollection, 50);
  off();
});

test("existing recordAscension still advances warden rank", async () => {
  const wp = await fresh();
  const w = wp.recordAscension();
  assert.equal(w.ascensions, 1);
});

test("recovering an observer chain completes its Insight", async () => {
  const wp = await fresh();
  for (let i = 0; i < 40; i++) wp.recordAxis("comprehension", 4);
  assert.ok(wp.getSelf().insights.includes("participatory"),
    "the three observer memories complete The Participatory Universe");
});

test("realizing a self resets the climb but keeps who you've been", async () => {
  const wp = await fresh();
  let res;
  for (let i = 0; i < 200; i++) { res = wp.recordAxis("comprehension", 4); if (res.revelation) break; }
  assert.equal(res.revelation, "observer");
  const s = wp.getSelf();
  assert.ok(s.realized.includes("observer"));
  assert.equal(s.recollection, 0, "the climb resets for the next cycle");
  assert.ok(s.memoriesRecovered.length > 0, "memories persist across the reset");
});

test("living all five cycles completes the Anamnesis exactly once", async () => {
  const wp = await fresh();
  // Pump one axis until a Self realizes, then stop - so each cycle resolves
  // cleanly to its pole without overshoot residue bleeding into the next.
  const untilRevelation = (kind, weight, tags = {}) => {
    for (let i = 0; i < 200; i++) {
      const r = wp.recordAxis(kind, weight, tags);
      if (r.revelation) return r;
    }
    throw new Error(`no revelation for ${kind} ${JSON.stringify(tags)}`);
  };

  assert.equal(untilRevelation("comprehension", 4).revelation, "observer");
  assert.equal(untilRevelation("mastery", 50).revelation, "gardener");
  assert.equal(untilRevelation("comprehension", 4, { hidden: true }).revelation, "wanderer");
  assert.equal(untilRevelation("neglect", 15).revelation, "unmaker");
  assert.deepEqual([...wp.getSelf().realized].sort(), ["gardener", "observer", "unmaker", "wanderer"]);

  // The Eternal: high in BOTH axes within one cycle. Understanding first (its
  // pole is already realized, so no reset), then mastery until the gate trips.
  for (let i = 0; i < 40; i++) wp.recordAxis("comprehension", 4);
  let res;
  for (let i = 0; i < 40; i++) { res = wp.recordAxis("mastery", 4); if (res.revelation) break; }
  assert.equal(res.revelation, "eternal");
  assert.equal(res.anamnesisComplete, true);
  assert.equal(wp.getSelf().complete, true);
  assert.equal(wp.getSelf().realized.length, 5);

  // Capstone fires only once.
  assert.equal(wp.recordAxis("comprehension", 4).anamnesisComplete, false);
});