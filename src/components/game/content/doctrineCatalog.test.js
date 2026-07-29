// src/components/game/content/doctrineCatalog.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { getShipModifiers } from "./upgradeCatalog.js";
import { doctrineModifiers } from "./doctrineCatalog.js";

test("doctrine multipliers stack on top of upgrade levels", () => {
  const upgrades = { thrusters: 2, scanner: 1, containment: 1 };
  const stock = getShipModifiers(upgrades, null);
  const runner = getShipModifiers(upgrades, "voidrunner");
  // Voidrunner boosts thrust on top of the two thruster marks.
  assert.ok(runner.thrust > stock.thrust, "voidrunner is faster than stock at same upgrades");
  // ...and penalizes containment below the same upgrade baseline.
  assert.ok(runner.containment < stock.containment, "voidrunner is worse at containment");
});

test("null/none doctrine leaves upgrade math unchanged", () => {
  const upgrades = { thrusters: 1, boostReactor: 1, scanner: 2, containment: 3 };
  const a = getShipModifiers(upgrades, null);
  const b = getShipModifiers(upgrades, "none");
  assert.deepEqual(a, b);
  // And equals the raw upgrade-only formula for thrust.
  assert.equal(a.thrust, 1 + 1 * 0.15);
});

test("warden's containment reward beats stock at equal upgrades", () => {
  const upgrades = { containment: 1 };
  const warden = getShipModifiers(upgrades, "warden");
  const stock = getShipModifiers(upgrades, null);
  assert.ok(warden.containment > stock.containment);
  assert.equal(doctrineModifiers("warden").containment, 1.6);
});
