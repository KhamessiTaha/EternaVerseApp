// src/components/game/bestScores.test.js
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
  return import(`./bestScores.js?bust=${Math.random()}`);
};

test("a first attempt is stored but does not claim NEW BEST", async () => {
  const bs = await fresh();
  const r = bs.recordBest("CascadeReactionScene", 3, 72);
  assert.equal(r.isNew, false, "nothing was beaten - the badge would be hollow");
  assert.equal(r.previous, null);
  assert.equal(bs.getBest("CascadeReactionScene", 3), 72);
});

test("beating your own record earns the badge", async () => {
  const bs = await fresh();
  bs.recordBest("CascadeReactionScene", 3, 72);
  const r = bs.recordBest("CascadeReactionScene", 3, 91);
  assert.equal(r.isNew, true);
  assert.equal(r.previous, 72);
  assert.equal(r.best, 91);
});

test("a worse run leaves the record alone", async () => {
  const bs = await fresh();
  bs.recordBest("CascadeReactionScene", 3, 91);
  const r = bs.recordBest("CascadeReactionScene", 3, 60);
  assert.equal(r.isNew, false);
  assert.equal(r.best, 91);
  assert.equal(bs.getBest("CascadeReactionScene", 3), 91);
});

test("severities are graded separately - they are different problems", async () => {
  const bs = await fresh();
  bs.recordBest("GravityWellScene", 1, 98);
  // A severity-5 attempt must not be measured against the severity-1 record,
  // or "best" just means "the easiest one you ever played".
  const r = bs.recordBest("GravityWellScene", 5, 64);
  assert.equal(r.isNew, false);
  assert.equal(r.previous, null);
  assert.equal(bs.getBest("GravityWellScene", 1), 98);
  assert.equal(bs.getBest("GravityWellScene", 5), 64);
});

test("minigames are graded separately from each other", async () => {
  const bs = await fresh();
  bs.recordBest("GravityWellScene", 2, 95);
  assert.equal(bs.getBest("PolarityBalanceScene", 2), null);
});

test("never played reads as null, not zero", async () => {
  const bs = await fresh();
  assert.equal(bs.getBest("WaveformCollapseScene", 4), null);
});

test("accuracy is clamped and junk does not corrupt the store", async () => {
  const bs = await fresh();
  assert.equal(bs.recordBest("X", 2, 900).best, 100);
  assert.equal(bs.recordBest("Y", 2, -20).best, 0);
  assert.equal(bs.recordBest("Z", 2, "nonsense").best, 0);
});

test("severity is clamped into range so a bad key can't fragment records", async () => {
  const bs = await fresh();
  bs.recordBest("X", 99, 80);
  assert.equal(bs.getBest("X", 5), 80, "severity 99 folds onto the 5 bucket");
  assert.equal(bs.bestKey("X", 0), bs.bestKey("X", 1));
});

test("a corrupt payload degrades to empty rather than throwing", async () => {
  const bs = await fresh();
  mem.set("ev:minigameBests", "{not json");
  assert.equal(bs.getBest("X", 1), null);
  // ...and writing over it recovers.
  assert.equal(bs.recordBest("X", 1, 50).best, 50);
});

test("reset wipes every record", async () => {
  const bs = await fresh();
  bs.recordBest("X", 1, 80);
  bs.resetBests();
  assert.equal(bs.getBest("X", 1), null);
});
