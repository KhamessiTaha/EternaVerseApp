// src/components/game/situations/situationModel.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SITUATIONS, situationById, pickSituation, scheduleNext, situationProgress,
  formatClock, formatDistance, bearingTo,
  FIRST_SITUATION_MS, INTERVAL_MS, REPEAT_WEIGHT_PENALTY,
} from "./situationModel.js";

const ctx = (over = {}) => ({
  scale: "galactic",
  stability: 0.8,
  besiegedCount: 0,
  surgeActive: false,
  eventActive: false,
  minigameActive: false,
  ...over,
});

test("every situation is timed, located-capable, and states its payoff", () => {
  // A situation that isn't any of those is a counter wearing a costume.
  for (const s of SITUATIONS) {
    assert.ok(s.durationMs > 0, `${s.id} has no deadline`);
    assert.ok(typeof s.brief === "function", `${s.id} has no brief`);
    assert.ok(s.payoff && s.payoff.length > 0, `${s.id} promises nothing`);
    assert.ok(s.weight > 0, s.id);
    assert.equal(situationById(s.id), s);
  }
});

test("the first one lands early, then it settles into cadence", () => {
  // A new player shouldn't wait 15 minutes to learn the game has events.
  assert.equal(scheduleNext(0, { isFirst: true }), FIRST_SITUATION_MS);
  assert.ok(FIRST_SITUATION_MS < INTERVAL_MS[0]);

  const next = scheduleNext(0, { rng: () => 0.5 });
  assert.ok(next >= INTERVAL_MS[0] && next <= INTERVAL_MS[1]);
});

test("a distress call is only offered when a siege actually exists", () => {
  // A client cannot invent a war, and a fake distress call is worse than none.
  const none = pickSituation(ctx({ besiegedCount: 0 }), { rng: () => 0.99 });
  assert.notEqual(none?.id, "distress");

  // With one available it must be reachable - it's the best content we have.
  let sawDistress = false;
  for (let i = 0; i < 60; i++) {
    const s = pickSituation(ctx({ besiegedCount: 1 }), { rng: () => i / 60 });
    if (s?.id === "distress") sawDistress = true;
  }
  assert.ok(sawDistress, "a live siege must be promotable");
});

test("nothing fires at the wrong cosmic scale", () => {
  // Surges and cosmic events are galactic-scale only; promoting one inside a
  // star system would point the player at empty space.
  const inSystem = ctx({ scale: "planetary", besiegedCount: 0 });
  for (let i = 0; i < 40; i++) {
    assert.equal(pickSituation(inSystem, { rng: () => i / 40 }), null);
  }
});

test("a distress call still works at any scale - the world is elsewhere", () => {
  const inSystem = ctx({ scale: "planetary", besiegedCount: 2 });
  assert.equal(pickSituation(inSystem, { rng: () => 0.5 })?.id, "distress");
});

test("nothing is offered on top of something already running", () => {
  const busy = ctx({ surgeActive: true, eventActive: true, besiegedCount: 0 });
  assert.equal(pickSituation(busy, { rng: () => 0.5 }), null);
});

test("repeats are pushed down so the rhythm stays varied", () => {
  assert.ok(REPEAT_WEIGHT_PENALTY < 1);
  const count = { cascade: 0, windfall: 0 };
  for (let i = 0; i < 200; i++) {
    const s = pickSituation(ctx(), { rng: () => (i + 0.5) / 200, lastId: "cascade" });
    if (s) count[s.id] = (count[s.id] || 0) + 1;
  }
  assert.ok(count.windfall > count.cascade,
    `a repeat should be rarer than a change (cascade ${count.cascade}, windfall ${count.windfall})`);
});

test("a cascade gets worse when the universe is already fraying", () => {
  const cascade = situationById("cascade");
  const calm = cascade.tearsFor(1.0);
  const dire = cascade.tearsFor(0.0);
  assert.ok(dire > calm);
  assert.ok(calm >= 6 && dire <= 10);
});

test("a junk stability reading never produces a NaN tear count", () => {
  const cascade = situationById("cascade");
  for (const bad of [undefined, null, NaN, "nonsense"]) {
    const n = cascade.tearsFor(bad);
    assert.ok(Number.isFinite(n), `tearsFor(${String(bad)}) was ${n}`);
    assert.ok(n >= 6 && n <= 10);
  }
});

test("a malformed context never wedges the rhythm", () => {
  // eligible() throwing must not take the director down with it.
  assert.doesNotThrow(() => pickSituation(null, { rng: () => 0.5 }));
  assert.doesNotThrow(() => pickSituation({}, { rng: () => 0.5 }));
});

test("progress counts down and reports expiry", () => {
  const active = {
    id: "cascade", kind: "cascade", title: "CASCADE FAILURE",
    brief: "Contain 6 tears", payoff: "Stability", startedAt: 1000,
    durationMs: 60000, x: 5, y: 7,
  };
  const mid = situationProgress(active, 1000 + 30000);
  assert.equal(mid.remainingMs, 30000);
  assert.ok(Math.abs(mid.fraction - 0.5) < 1e-9);
  assert.equal(mid.expired, false);
  assert.equal(mid.x, 5);

  const done = situationProgress(active, 1000 + 90000);
  assert.equal(done.remainingMs, 0);
  assert.equal(done.expired, true);

  assert.equal(situationProgress(null, 0), null);
});

test("the clock reads as a clock", () => {
  assert.equal(formatClock(0), "0:00");
  assert.equal(formatClock(9000), "0:09");
  assert.equal(formatClock(65000), "1:05");
  assert.equal(formatClock(-500), "0:00");
});

// --- the compass ---------------------------------------------------------
// A situation always knew where it was; nothing ever showed the player. A
// deadline you cannot walk toward is noise, not an event.

test("the arrow points the way the world actually looks", () => {
  const here = { x: 0, y: 0 };
  assert.equal(bearingTo(here, { x: 100, y: 0 }).arrow, "\u2192");
  assert.equal(bearingTo(here, { x: -100, y: 0 }).arrow, "\u2190");
  assert.equal(bearingTo(here, { x: 0, y: 100 }).arrow, "\u2193"); // +y is DOWN on screen
  assert.equal(bearingTo(here, { x: 0, y: -100 }).arrow, "\u2191");
  assert.equal(bearingTo(here, { x: 100, y: 100 }).arrow, "\u2198");
  assert.equal(bearingTo(here, { x: -100, y: -100 }).arrow, "\u2196");
});

test("distance is measured, not guessed", () => {
  assert.equal(Math.round(bearingTo({ x: 0, y: 0 }, { x: 300, y: 400 }).distance), 500);
});

test("a situation with no position yields no compass instead of a wrong one", () => {
  assert.equal(bearingTo({ x: 0, y: 0 }, null), null);
  assert.equal(bearingTo(null, { x: 1, y: 1 }), null);
  assert.equal(bearingTo({ x: 0, y: 0 }, { x: undefined, y: 2 }), null);
});

test("distance reads at a glance", () => {
  assert.equal(formatDistance(820), "820");
  assert.equal(formatDistance(1400), "1.4k");
  assert.equal(formatDistance(12400), "12k");
  assert.equal(formatDistance(NaN), "");
});
