// src/components/game/content/selfContent.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { MEMORIES } from "./memories.js";
import { REVELATIONS, AUTHORED_SELVES } from "./revelations.js";
import { INSIGHTS } from "./insights.js";
import { pickMemory, emptyAffinity } from "../self/selfModel.js";

const SELVES = ["neutral", "observer", "gardener", "wanderer", "unmaker", "eternal"];

test("every memory is well-formed and tagged with a known self", () => {
  const ids = new Set();
  for (const m of MEMORIES) {
    assert.ok(m.id && !ids.has(m.id), `unique id: ${m.id}`);
    ids.add(m.id);
    assert.ok(SELVES.includes(m.self), m.self);
    assert.ok(typeof m.text === "string" && m.text.length > 0, m.id);
    assert.ok(typeof m.science === "string" && m.science.length > 0, m.id);
  }
  assert.ok(MEMORIES.filter((m) => m.self === "neutral").length >= 2, "enough neutral seeds");
  // every authored self has at least one memory that leans toward it
  for (const self of ["observer", "gardener", "wanderer", "unmaker", "eternal"]) {
    assert.ok(MEMORIES.some((m) => m.self === self), `a memory for ${self}`);
  }
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

test("every insight chain references only real memories and is well-formed", () => {
  const memIds = new Set(MEMORIES.map((m) => m.id));
  const insIds = new Set();
  for (const ins of INSIGHTS) {
    assert.ok(ins.id && !insIds.has(ins.id), `unique insight id: ${ins.id}`);
    insIds.add(ins.id);
    assert.ok(typeof ins.title === "string" && ins.title.length > 0, ins.id);
    assert.ok(typeof ins.text === "string" && ins.text.length > 0, ins.id);
    assert.ok(Array.isArray(ins.memoryIds) && ins.memoryIds.length >= 2, ins.id);
    for (const mid of ins.memoryIds) {
      assert.ok(memIds.has(mid), `insight ${ins.id} references real memory ${mid}`);
    }
  }
});

test("all five selves are authored", () => {
  assert.deepEqual(AUTHORED_SELVES.sort(), ["eternal", "gardener", "observer", "unmaker", "wanderer"]);
  for (const id of AUTHORED_SELVES) {
    assert.ok(REVELATIONS[id].title);
    assert.ok(Array.isArray(REVELATIONS[id].lines) && REVELATIONS[id].lines.length >= 2);
  }
});