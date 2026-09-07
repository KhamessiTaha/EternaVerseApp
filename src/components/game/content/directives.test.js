// src/components/game/content/directives.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DIRECTIVES, DIRECTIVE_IDS, directiveById,
  satisfiedBy, currentDirective, directiveProgress,
} from "./directives.js";

const ctx = (over = {}) => ({
  universe: {
    metrics: {}, materials: {}, upgrades: {},
    civilizations: [], artifacts: [], legacies: [],
    ...(over.universe || {}),
  },
  certified: over.certified || [],
});

test("every beat is an event with a name, a how, and a why", () => {
  // A beat missing any of these is a counter wearing a costume.
  for (const d of DIRECTIVES) {
    assert.ok(d.id && d.label, "no name");
    assert.ok(d.hint && d.hint.length > 0, `${d.id} never says HOW`);
    assert.ok(d.instruction && d.instruction.length > 40, `${d.id} has no fiction`);
    assert.ok(d.reward && d.reward.length > 0, `${d.id} promises nothing`);
    assert.equal(typeof d.done, "function", `${d.id} cannot be completed`);
    assert.equal(directiveById(d.id), d);
  }
});

test("beat ids are unique", () => {
  assert.equal(new Set(DIRECTIVE_IDS).size, DIRECTIVE_IDS.length);
});

test("a brand-new warden in a brand-new cosmos has done nothing", () => {
  assert.deepEqual(satisfiedBy(ctx()), []);
  assert.equal(currentDirective([]).id, DIRECTIVES[0].id);
});

test("each beat is satisfied by the thing it actually names", () => {
  const cases = {
    contain: ctx({ universe: { metrics: { anomaliesResolved: 1 } } }),
    read: ctx({ certified: ["spiral"] }),
    iron: ctx({ universe: { materials: { iron: 1 } } }),
    forge: ctx({ universe: { upgrades: { scanner: 2 } } }),
    answer: ctx({ universe: { civilizations: [{ rescues: 1 }] } }),
    raise: ctx({ universe: { artifacts: [{ kind: "beacon" }] } }),
    gold: ctx({ universe: { materials: { gold: 1 } } }),
    ascend: ctx({ universe: { legacies: [{ civId: "c1" }] } }),
  };
  for (const [id, c] of Object.entries(cases)) {
    assert.deepEqual(satisfiedBy(c), [id], `${id} was not satisfied alone`);
  }
  // Every beat is covered by this test.
  assert.deepEqual(Object.keys(cases).sort(), [...DIRECTIVE_IDS].sort());
});

test("a Mk1 upgrade is NOT forging - that beat wants matter spent", () => {
  assert.deepEqual(satisfiedBy(ctx({ universe: { upgrades: { scanner: 1 } } })), []);
});

test("nothing blocks: beats complete out of order and stay complete", () => {
  // Raising a monument before answering a distress call must leave the player
  // further along, never stuck behind a siege that hasn't happened yet.
  const done = satisfiedBy(ctx({ universe: { artifacts: [{}] } }));
  assert.deepEqual(done, ["raise"]);
  // The displayed beat is still the first UNfinished one, in authored order.
  assert.equal(currentDirective(done).id, "contain");
});

test("the arc ends, and says so", () => {
  const all = [...DIRECTIVE_IDS];
  assert.equal(currentDirective(all), null);
  assert.deepEqual(directiveProgress(all), { done: all.length, total: all.length, complete: true });
  assert.equal(directiveProgress([]).complete, false);
});

test("progress ignores ids that aren't part of the arc", () => {
  assert.equal(directiveProgress(["contain", "not-a-beat"]).done, 1);
});

test("a malformed universe never throws and never falsely completes", () => {
  // This runs on every sync; it must not be able to take the session down.
  for (const junk of [null, undefined, {}, { universe: null }, { universe: { materials: "no" } }]) {
    assert.doesNotThrow(() => satisfiedBy(junk));
    assert.deepEqual(satisfiedBy(junk), []);
  }
});

test("a beat is never satisfied by a zero or a negative", () => {
  assert.deepEqual(satisfiedBy(ctx({ universe: { materials: { iron: 0, gold: -3 } } })), []);
  assert.deepEqual(satisfiedBy(ctx({ universe: { metrics: { anomaliesResolved: 0 } } })), []);
});
