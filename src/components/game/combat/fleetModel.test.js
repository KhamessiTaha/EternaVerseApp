// src/components/game/combat/fleetModel.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SHIP_ROLES, homeFleetFor, raidWaveFor, shipStance, besiegerOf,
  pickShipTarget, applyDamage, UNPROVOKED_RANGE, GRUDGE_MS, MAX_WAVES,
} from "./fleetModel.js";

const civ = (type, over = {}) => ({ id: "c1", type, warlikeness: 0.2, ...over });

test("spaceflight is gated by the Kardashev tier", () => {
  assert.deepEqual(homeFleetFor(civ("Type0")), [], "a Type 0 has not left its world");
  assert.ok(homeFleetFor(civ("Type1")).length >= 1);
  assert.ok(homeFleetFor(civ("Type3")).length > homeFleetFor(civ("Type2")).length);
  assert.deepEqual(homeFleetFor(civ("Type3", { extinct: true })), []);
});

test("every role a fleet can field has complete stats", () => {
  const used = new Set([
    ...homeFleetFor(civ("Type1")), ...homeFleetFor(civ("Type2")), ...homeFleetFor(civ("Type3")),
    ...raidWaveFor(civ("Type2"), 0), ...raidWaveFor(civ("Type3"), MAX_WAVES),
  ]);
  for (const role of used) {
    const s = SHIP_ROLES[role];
    assert.ok(s, `unknown role ${role}`);
    assert.ok(s.hp > 0 && s.speed > 0 && s.radius > 0, role);
  }
});

test("only star-faring powers can project force at another world", () => {
  assert.deepEqual(raidWaveFor(civ("Type0"), 0), []);
  assert.deepEqual(raidWaveFor(civ("Type1"), 0), [], "a planet-bound people cannot raid");
  assert.ok(raidWaveFor(civ("Type2"), 0).length > 0);
});

test("every raid carries a bomber - the reason the player must care", () => {
  for (const type of ["Type2", "Type3"]) {
    for (let w = 0; w <= MAX_WAVES; w++) {
      assert.ok(
        raidWaveFor(civ(type), w).includes("bomber"),
        `${type} wave ${w} has no bomber`
      );
    }
  }
});

test("waves escalate - clearing one does not end the war", () => {
  const first = raidWaveFor(civ("Type2"), 0);
  const later = raidWaveFor(civ("Type2"), 4);
  assert.ok(later.length > first.length, "reinforcements grow");
});

test("stance: raiders raid, the besieged defend, the shot-at hunt", () => {
  const base = { attitude: "neutral", grudgeUntil: 0, playerDistance: 300, now: 1000 };
  assert.equal(shipStance({ ...base, isRaider: true }), "raid");
  assert.equal(shipStance({ ...base, isRaider: false, underSiege: true }), "defend");
  assert.equal(shipStance({ ...base, grudgeUntil: GRUDGE_MS }), "hunt");
  assert.equal(shipStance({ ...base }), "patrol");
});

test("stance: hostiles open fire on sight, but only within range", () => {
  const base = { isRaider: false, attitude: "hostile", grudgeUntil: 0, now: 1000 };
  assert.equal(shipStance({ ...base, playerDistance: UNPROVOKED_RANGE - 1 }), "hunt");
  assert.equal(shipStance({ ...base, playerDistance: UNPROVOKED_RANGE + 1 }), "patrol");
});

test("a bomber cannot be distracted - it always runs for the world", () => {
  const target = pickShipTarget("bomber", {
    candidates: [{ kind: "player", x: 0, y: 0, distance: 5 }],
    worldPos: { x: 900, y: 900 },
    playerThreat: true,
  });
  assert.equal(target.kind, "world");
  assert.equal(target.x, 900);
  // With no world to burn it has nothing to do
  assert.equal(pickShipTarget("bomber", { candidates: [], worldPos: null }), null);
});

test("interceptors go for the player when the player is a threat", () => {
  const candidates = [
    { kind: "ship", x: 10, y: 0, distance: 10 },
    { kind: "player", x: 500, y: 0, distance: 500 },
  ];
  assert.equal(pickShipTarget("interceptor", { candidates, playerThreat: true }).kind, "player");
  // Not a threat: it joins the ship fight instead of chasing a bystander
  assert.equal(pickShipTarget("interceptor", { candidates, playerThreat: false }).kind, "ship");
});

test("guardians engage whatever is nearest", () => {
  const candidates = [
    { kind: "ship", x: 0, y: 0, distance: 400 },
    { kind: "player", x: 0, y: 0, distance: 90 },
  ];
  assert.equal(pickShipTarget("guardian", { candidates, playerThreat: true }).kind, "player");
  assert.equal(pickShipTarget("guardian", { candidates: [], playerThreat: true }), null);
});

test("shields soak damage before hull", () => {
  assert.deepEqual(applyDamage({ hp: 30, shields: 12 }, 5), { hp: 30, shields: 7 });
  assert.deepEqual(applyDamage({ hp: 30, shields: 12 }, 12), { hp: 30, shields: 0 });
  assert.deepEqual(applyDamage({ hp: 30, shields: 4 }, 10), { hp: 24, shields: 0 });
  assert.deepEqual(applyDamage({ hp: 30, shields: 0 }, 7), { hp: 23, shields: 0 });
});

test("besiegerOf reads the war from the defender's side", () => {
  const wars = [{ a: "civ_x", b: "civ_y" }];
  assert.equal(besiegerOf("civ_x", wars), "civ_y");
  assert.equal(besiegerOf("civ_y", wars), "civ_x");
  assert.equal(besiegerOf("civ_z", wars), null);
});
