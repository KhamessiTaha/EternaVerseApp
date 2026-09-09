// src/components/game/combat/combatModel.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  WEAPONS, weaponFor, HEAT_MAX, HEAT_UNLOCK,
  applyCooling, tryFire, pickTarget, siegeCompositionFor, RIFT_STATS,
  FIRE_MODE_IDS, DEFAULT_FIRE_MODE, fireModeFor, nextFireMode, weaponInMode,
} from "./combatModel.js";
import { applyDamage } from "./fleetModel.js";

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

// --- fire modes: the counterplay -----------------------------------------
// The enemy has four roles; the player had one answer. These assert that the
// two modes are genuinely different tools and that SWITCHING beats committing.

test("both modes are complete, and one key cycles between them", () => {
  for (const id of FIRE_MODE_IDS) {
    const m = fireModeFor(id);
    assert.ok(m.label && m.tell, id);
    assert.ok(m.vsShield > 0 && m.vsHull > 0, id);
    assert.ok(m.damageMul > 0 && m.fireIntervalMul > 0 && m.heatMul > 0, id);
  }
  assert.equal(nextFireMode("lance"), "pulse");
  assert.equal(nextFireMode("pulse"), "lance");
  assert.equal(nextFireMode("nonsense"), FIRE_MODE_IDS[0], "junk never wedges the toggle");
  assert.equal(fireModeFor("nonsense").id, DEFAULT_FIRE_MODE);
});

test("the modes are actually opposites, not two flavours of the same gun", () => {
  const lance = fireModeFor("lance");
  const pulse = fireModeFor("pulse");
  assert.ok(pulse.vsShield > lance.vsShield * 2, "pulse must own shields");
  assert.ok(lance.vsHull > pulse.vsHull * 2, "lance must own hull");
});

test("every hull keeps its character in both modes", () => {
  // Modes are multipliers, so a bastion's heavy slow shot stays heavy and slow.
  for (const id of HULLS) {
    const base = weaponFor(id);
    for (const mode of FIRE_MODE_IDS) {
      const w = weaponInMode(base, mode);
      assert.ok(w.damage > 0 && w.fireIntervalMs > 0 && w.heatPerShot > 0 && w.boltSpeed > 0, `${id}/${mode}`);
      assert.ok(w.profile.vsShield > 0 && w.profile.vsHull > 0, `${id}/${mode}`);
    }
  }
  const heavy = weaponInMode(weaponFor("bastion"), "lance");
  const light = weaponInMode(weaponFor("falcon"), "lance");
  assert.ok(heavy.damage > light.damage, "bastion still hits harder than falcon");
  assert.ok(heavy.fireIntervalMs > light.fireIntervalMs, "and still fires slower");
});

test("a shot is never worth more than its damage budget", () => {
  // The conversion back out of shield-units is what stops PULSE from being a
  // strictly better gun that also happens to shred hull.
  const unshielded = { hp: 100, shields: 0 };
  const lance = weaponInMode(weaponFor("cruiser"), "lance");
  const pulse = weaponInMode(weaponFor("cruiser"), "pulse");
  const byLance = 100 - applyDamage(unshielded, lance.damage, lance.profile).hp;
  const byPulse = 100 - applyDamage(unshielded, pulse.damage, pulse.profile).hp;
  assert.ok(byLance > byPulse * 2, "against bare hull, lance must dominate");
});

test("omitting the profile damages exactly as before", () => {
  // Ships shooting each other, hazards, and every existing caller.
  assert.deepEqual(applyDamage({ hp: 30, shields: 10 }, 12), { hp: 28, shields: 0 });
  assert.deepEqual(applyDamage({ hp: 30, shields: 10 }, 4), { hp: 30, shields: 6 });
});

test("SWITCHING beats committing to either mode - the whole design claim", () => {
  // A guardian: 34 hull behind 26 shields, the ship the code says "must be
  // pressured, not plinked". Count shots for three strategies.
  const guardian = () => ({ hp: 34, shields: 26 });
  const lance = weaponInMode(weaponFor("cruiser"), "lance");
  const pulse = weaponInMode(weaponFor("cruiser"), "pulse");

  const shotsToKill = (plan) => {
    let s = guardian();
    for (let i = 1; i <= 200; i++) {
      const w = plan(s);
      s = applyDamage(s, w.damage, w.profile);
      if (s.hp <= 0) return i;
    }
    return Infinity;
  };

  const lanceOnly = shotsToKill(() => lance);
  const pulseOnly = shotsToKill(() => pulse);
  // Strip the screen, then switch to kill.
  const switching = shotsToKill((s) => (s.shields > 0 ? pulse : lance));

  assert.ok(switching < lanceOnly, `switching (${switching}) must beat lance-only (${lanceOnly})`);
  assert.ok(switching < pulseOnly, `switching (${switching}) must beat pulse-only (${pulseOnly})`);
});

test("against an unshielded interceptor, committing to LANCE is correct", () => {
  // Switching must not be a universal answer, or it stops being a decision.
  const lance = weaponInMode(weaponFor("cruiser"), "lance");
  const pulse = weaponInMode(weaponFor("cruiser"), "pulse");
  const shots = (w) => {
    let s = { hp: 14, shields: 0 };
    for (let i = 1; i <= 200; i++) {
      s = applyDamage(s, w.damage, w.profile);
      if (s.hp <= 0) return i;
    }
    return Infinity;
  };
  assert.ok(shots(lance) < shots(pulse), "lance kills a bare hull faster");
});
