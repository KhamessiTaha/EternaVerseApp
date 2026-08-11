// src/components/game/combat/fleetModel.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SHIP_CLASSES, fleetFor, raidFleetFor, shipStance, besiegerOf,
  UNPROVOKED_RANGE, GRUDGE_MS,
} from "./fleetModel.js";

const civ = (type, over = {}) => ({ id: "c1", type, warlikeness: 0.2, ...over });

test("spaceflight is gated by the Kardashev tier", () => {
  assert.deepEqual(fleetFor(civ("Type0")), [], "a Type 0 has not left its world");
  assert.ok(fleetFor(civ("Type1")).length >= 1);
  assert.ok(fleetFor(civ("Type2")).length > fleetFor(civ("Type1")).length);
  assert.ok(fleetFor(civ("Type3")).length > fleetFor(civ("Type2")).length);
  assert.deepEqual(fleetFor(civ("Type3", { extinct: true })), [], "the dead field nothing");
});

test("every hull a fleet can field has complete stats", () => {
  for (const type of ["Type1", "Type2", "Type3"]) {
    for (const cls of fleetFor(civ(type))) {
      const s = SHIP_CLASSES[cls];
      assert.ok(s, `unknown class ${cls}`);
      assert.ok(s.hp > 0 && s.speed > 0 && s.damage > 0 && s.range > 0, cls);
    }
  }
});

test("warlike peoples field an extra hull", () => {
  const calm = fleetFor(civ("Type2", { warlikeness: 0.1 }));
  const fierce = fleetFor(civ("Type2", { warlikeness: 0.9 }));
  assert.equal(fierce.length, calm.length + 1);
});

test("a raid is an expedition, not the whole navy", () => {
  const home = fleetFor(civ("Type3"));
  const raid = raidFleetFor(civ("Type3"));
  assert.ok(raid.length >= 1);
  assert.ok(raid.length < home.length, "a raid leaves the homeworld defended");
  assert.deepEqual(raidFleetFor(civ("Type0")), []);
});

test("stance: raiders always raid", () => {
  const s = shipStance({ isRaider: true, attitude: "friendly", playerDistance: 5000, now: 0 });
  assert.equal(s, "raid");
});

test("stance: a shot-at civilization hunts you until its grudge cools", () => {
  const base = { isRaider: false, attitude: "neutral", playerDistance: 200 };
  assert.equal(shipStance({ ...base, grudgeUntil: GRUDGE_MS, now: 1000 }), "hunt");
  assert.equal(shipStance({ ...base, grudgeUntil: GRUDGE_MS, now: GRUDGE_MS + 1 }), "patrol");
});

test("stance: hostiles open fire on sight, but only within range", () => {
  const base = { isRaider: false, attitude: "hostile", grudgeUntil: 0, now: 1000 };
  assert.equal(shipStance({ ...base, playerDistance: UNPROVOKED_RANGE - 1 }), "hunt");
  assert.equal(shipStance({ ...base, playerDistance: UNPROVOKED_RANGE + 1 }), "patrol");
  // a friendly people at the same distance simply keeps station
  assert.equal(
    shipStance({ ...base, attitude: "friendly", playerDistance: 10 }),
    "patrol"
  );
});

test("besiegerOf reads the war from the defender's side", () => {
  const wars = [{ a: "civ_x", b: "civ_y" }];
  assert.equal(besiegerOf("civ_x", wars), "civ_y");
  assert.equal(besiegerOf("civ_y", wars), "civ_x");
  assert.equal(besiegerOf("civ_z", wars), null);
  assert.equal(besiegerOf("civ_x", []), null);
});
