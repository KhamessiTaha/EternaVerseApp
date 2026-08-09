// src/components/game/combat/combatModel.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  WEAPONS, weaponFor, HEAT_MAX, HEAT_UNLOCK,
  applyCooling, tryFire, pickTarget, siegeCompositionFor, RIFT_STATS,
} from "./combatModel.js";

const HULLS = ["interceptor", "cutter", "falcon", "cruiser", "bastion", "hauler", "tachyon", "vanguard"];

test("every hull has a complete weapon table; unknown hulls fall back", () => {
  for (const id of HULLS) {
    const w = weaponFor(id);
    assert.ok(w.damage > 0 && w.fireIntervalMs > 0 && w.heatPerShot > 0 && w.boltSpeed > 0, id);
  }
  assert.deepEqual(weaponFor("nonsense"), WEAPONS.interceptor);
});

test("heat cycle: firing heats, max locks, cooling below the threshold unlocks", () => {
  const w = { ...weaponFor("interceptor"), heatPerShot: 40, fireIntervalMs: 0 };
  let s = { heat: 0, locked: false, lastFiredAt: -Infinity };

  let r = tryFire(s, w, 0);
  assert.ok(r.fired);
  assert.equal(r.state.heat, 40);

  r = tryFire(r.state, w, 1);
  r = tryFire(r.state, w, 2); // 120 -> clamped to max, locked
  assert.equal(r.state.heat, HEAT_MAX);
  assert.ok(r.state.locked);

  r = tryFire(r.state, w, 3); // locked: no shot
  assert.ok(!r.fired);

  // Cool down: stays locked above the unlock threshold, unlocks below it
  let cooled = applyCooling(r.state, 1000);
  if (cooled.heat > HEAT_UNLOCK) assert.ok(cooled.locked);
  cooled = applyCooling(cooled, 60000);
  assert.equal(cooled.heat, 0);
  assert.ok(!cooled.locked);
  assert.ok(tryFire(cooled, w, 100000).fired, "fires again after cooling");
});

test("tryFire respects the fire interval", () => {
  const w = { ...weaponFor("interceptor"), fireIntervalMs: 250 };
  let r = tryFire({ heat: 0, locked: false, lastFiredAt: -Infinity }, w, 1000);
  assert.ok(r.fired);
  assert.ok(!tryFire(r.state, w, 1100).fired, "too soon");
  assert.ok(tryFire(r.state, w, 1251).fired, "interval elapsed");
});

test("pickTarget selects the nearest hostile inside the nose cone", () => {
  const origin = { x: 0, y: 0, noseAngle: 0 }; // nose pointing +x
  const ahead = { id: "a", x: 300, y: 20 };
  const aheadFar = { id: "b", x: 700, y: -30 };
  const behind = { id: "c", x: -200, y: 0 };
  const offCone = { id: "d", x: 50, y: 400 };
  assert.equal(pickTarget(origin, [aheadFar, behind, offCone, ahead], {}).id, "a");
  assert.equal(pickTarget(origin, [behind, offCone], {}), null);
  assert.equal(pickTarget(origin, [{ id: "e", x: 5000, y: 0 }], { range: 900 }), null, "out of range");
});

test("siege composition scales with severity and is empty below 4", () => {
  assert.deepEqual(siegeCompositionFor(1), []);
  assert.deepEqual(siegeCompositionFor(3), []);
  const s4 = siegeCompositionFor(4);
  const s5 = siegeCompositionFor(5);
  assert.equal(s4.filter((k) => k === "stinger").length, 2);
  assert.equal(s4.filter((k) => k === "tether").length, 1);
  assert.equal(s5.length, 5);
  assert.ok(s5.every((k) => RIFT_STATS[k]), "every kind has stats");
});

test("rift stats are complete for both archetypes", () => {
  assert.ok(RIFT_STATS.stinger.hp > 0 && RIFT_STATS.stinger.speed > 0 && RIFT_STATS.stinger.contactDamage > 0);
  assert.ok(RIFT_STATS.tether.hp > RIFT_STATS.stinger.hp, "tether is the tanky one");
  assert.ok(RIFT_STATS.tether.boltDamage > 0 && RIFT_STATS.tether.fireIntervalMs > 0);
});
