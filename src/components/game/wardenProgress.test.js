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

// --- account keying and the one-time legacy claim -------------------------
//
// These cover the migration that can lose real player progress: the old
// global "eterna:warden" blob has no owner recorded, so it must be claimed
// exactly once, by exactly one account, and never deleted.

const signIn = (id) => mem.set("user", JSON.stringify({ userId: id }));

test("progress is stored per account, not per browser", async () => {
  // The bug this fixes: two accounts on one browser shared one identity, so
  // logging in as someone else showed you THEIR memories.
  const wp = await fresh();
  signIn("userA");
  wp.recordAscension();
  wp.recordAscension();
  assert.equal(wp.getWarden().ascensions, 2);

  signIn("userB");
  assert.equal(wp.getWarden().ascensions, 0, "a different account starts clean");

  signIn("userA");
  assert.equal(wp.getWarden().ascensions, 2, "and the first account is untouched");
});

test("the pre-account blob is adopted by the first account that logs in", async () => {
  const wp = await fresh();
  mem.set("eterna:warden", JSON.stringify({
    ascensions: 5, recollection: 40, bandPointer: 2,
    memoriesRecovered: ["m1", "m2"], insightsCompleted: [],
    identitiesRealized: ["observer"], anamnesisSeen: false,
    affinity: { observer: 40, gardener: 0, wanderer: 0, unmaker: 0 },
  }));

  signIn("userA");
  assert.equal(wp.getWarden().ascensions, 5, "weeks of local play must carry over");
  assert.deepEqual(wp.getSelf().realized, ["observer"]);
});

test("a second account cannot claim the same legacy blob", async () => {
  const wp = await fresh();
  mem.set("eterna:warden", JSON.stringify({ ascensions: 5, affinity: {} }));

  signIn("userA");
  assert.equal(wp.getWarden().ascensions, 5);

  signIn("userB");
  assert.equal(wp.getWarden().ascensions, 0, "it belongs to whoever claimed it");
});

test("the legacy blob is marked, never deleted", async () => {
  // If the attribution turns out wrong, the data must still be recoverable.
  const wp = await fresh();
  mem.set("eterna:warden", JSON.stringify({ ascensions: 3, affinity: {} }));
  signIn("userA");
  wp.getWarden();

  assert.ok(mem.get("eterna:warden"), "the original blob is still on disk");
  assert.equal(mem.get("eterna:warden:migratedTo"), "userA");
});

test("adopting the server's record replaces local wholesale", async () => {
  const wp = await fresh();
  signIn("userA");
  wp.recordAscension();

  wp.adoptSelf({
    ascensions: 11, recollection: 62, bandPointer: 3,
    memoriesRecovered: ["m1", "m2", "m3"], insightsCompleted: ["i1"],
    identitiesRealized: ["gardener", "wanderer"], anamnesisSeen: false,
    affinity: { observer: 0, gardener: 62, wanderer: 0, unmaker: 0 },
  });

  assert.equal(wp.getWarden().ascensions, 11);
  assert.deepEqual(wp.getSelf().realized, ["gardener", "wanderer"]);
  assert.equal(wp.getSelf().memoriesRecovered.length, 3);
});

test("a junk server payload is ignored rather than wiping local", async () => {
  const wp = await fresh();
  signIn("userA");
  wp.recordAscension();
  for (const junk of [null, undefined, {}, { ascensions: "nope" }]) {
    wp.adoptSelf(junk);
    assert.equal(wp.getWarden().ascensions, 1, `junk ${JSON.stringify(junk)} erased progress`);
  }
});

test("exportSelf hands the sync layer the complete record", async () => {
  const wp = await fresh();
  signIn("userA");
  wp.recordAxis("comprehension", 8);
  const out = wp.exportSelf();
  assert.equal(typeof out.ascensions, "number");
  assert.ok(Array.isArray(out.memoriesRecovered));
  assert.ok(Array.isArray(out.identitiesRealized));
  assert.equal(typeof out.bandPointer, "number");
});

test("a local write notifies the sync layer that a push is owed", async () => {
  const wp = await fresh();
  signIn("userA");
  let fired = 0;
  const off = wp.onSelfDirty(() => { fired += 1; });
  wp.recordAscension();
  assert.ok(fired > 0, "the server would never hear about this ascension");
  off();
  wp.recordAscension();
  assert.equal(fired, 1, "unsubscribing works");
});