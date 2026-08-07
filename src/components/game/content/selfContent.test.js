// src/components/game/content/selfContent.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { MEMORIES } from "./memories.js";
import { REVELATIONS, AUTHORED_SELVES } from "./revelations.js";
import { pickMemory, emptyAffinity } from "../self/selfModel.js";

test("every memory is well-formed and tagged with a known self", () => {
  const ids = new Set();
  for (const m of MEMORIES) {
    assert.ok(m.id && !ids.has(m.id), `unique id: ${m.id}`);
    ids.add(m.id);
    assert.ok(["observer", "gardener", "neutral"].includes(m.self), m.self);
    assert.ok(typeof m.text === "string" && m.text.length > 0, m.id);
    assert.ok(typeof m.science === "string" && m.science.length > 0, m.id);
  }
  assert.ok(MEMORIES.filter((m) => m.self === "neutral").length >= 2, "enough neutral seeds");
  assert.ok(MEMORIES.some((m) => m.self === "observer"));
  assert.ok(MEMORIES.some((m) => m.self === "gardener"));
});

test("the pool can be fully drawn without a null before exhaustion", () => {
  const recovered = [];
  const affinity = { ...emptyAffinity(), observer: 30, gardener: 30 };
  for (let i = 0; i < MEMORIES.length; i++) {
    const m = pickMemory(MEMORIES, affinity, recovered);
    assert.ok(m, `draw ${i} not null`);
    recovered.push(m.id);
  }
  assert.equal(pickMemory(MEMORIES, affinity, recovered), null);
});

test("both v1 revelations are authored", () => {
  assert.deepEqual(AUTHORED_SELVES.sort(), ["gardener", "observer"]);
  for (const id of AUTHORED_SELVES) {
    assert.ok(REVELATIONS[id].title);
    assert.ok(Array.isArray(REVELATIONS[id].lines) && REVELATIONS[id].lines.length >= 2);
  }
});