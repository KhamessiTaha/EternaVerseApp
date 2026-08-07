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