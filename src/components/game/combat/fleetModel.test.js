// src/components/game/combat/fleetModel.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SHIP_ROLES, homeFleetFor, raidWaveFor, shipStance, besiegerOf,
  civUnderSiege, besiegedWorlds, salvageFor,
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

test("the ship you most need to kill is the one worth killing", () => {
  // Salvage tracks hull cost, so the bomber - the actual threat - also pays
  // best. A player chasing the reward is a player defending the world.
  assert.ok(salvageFor("bomber", 0) > salvageFor("interceptor", 0.99));
  assert.ok(salvageFor("guardian", 0) >= salvageFor("interceptor", 0.99));
  for (const role of ["interceptor", "cruiser", "guardian", "bomber"]) {
    const [lo, hi] = [salvageFor(role, 0), salvageFor(role, 0.999)];
    assert.ok(lo >= 1 && hi >= lo, role);
  }
  assert.equal(salvageFor("nonsense"), 0, "an unknown hull drops nothing");
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

// A distress call the player can't act on is worse than none - so "under
// siege" has to mean someone is genuinely coming, not just a line in a treaty.
test("a war on paper is not a siege", () => {
  const victim = { id: "civ_x", type: "Type2" };
  const wars = [{ a: "civ_x", b: "civ_y" }];

  const planetBound = [victim, { id: "civ_y", type: "Type1" }];
  assert.equal(civUnderSiege(victim, wars, planetBound), null, "Type I cannot reach them");

  const dead = [victim, { id: "civ_y", type: "Type3", extinct: true }];
  assert.equal(civUnderSiege(victim, wars, dead), null, "a dead enemy sends nobody");

  const real = [victim, { id: "civ_y", type: "Type2" }];
  assert.equal(civUnderSiege(victim, wars, real), "civ_y");
});

test("a world already lost raises no distress call", () => {
  const victim = { id: "civ_x", type: "Type2", extinct: true };
  const civs = [victim, { id: "civ_y", type: "Type2" }];
  assert.equal(civUnderSiege(victim, [{ a: "civ_x", b: "civ_y" }], civs), null);
});

// The client half of the contract in the backend's openingSiege.js: it stages
// a Type II attacker against a Type I defender precisely so this comes out as
// one distress call. If either tier changes, this breaks - which is the point.
test("the scripted opening siege has exactly one victim", () => {
  const defender = { id: "civ_d", type: "Type1" };
  const attacker = { id: "civ_a", type: "Type2" };
  const civs = [defender, attacker];
  const wars = [{ id: "w", a: "civ_d", b: "civ_a", scripted: true }];

  assert.equal(civUnderSiege(defender, wars, civs), "civ_a");
  assert.equal(civUnderSiege(attacker, wars, civs), null,
    "a Type I raises no raid wave, so the aggressor is never flagged back");
  assert.deepEqual(besiegedWorlds(civs, wars).map((f) => f.civ.id), ["civ_d"]);
});

test("besiegedWorlds is the distress feed - every world worth flying to", () => {
  const civs = [
    { id: "civ_a", type: "Type2" },   // besieged by civ_b
    { id: "civ_b", type: "Type2" },   // the attacker - also 'at war', not besieged
    { id: "civ_c", type: "Type1" },   // besieged by a Type 0: not really
    { id: "civ_d", type: "Type0" },
    { id: "civ_e", type: "Type3" },   // at peace
  ];
  const wars = [{ a: "civ_a", b: "civ_b" }, { a: "civ_c", b: "civ_d" }];

  const feed = besiegedWorlds(civs, wars);
  const ids = feed.map((f) => f.civ.id).sort();
  // Both sides of a real war read as besieged - each has the other's fleet
  // inbound - but the Type 0 "attack" produces nothing to fly to.
  assert.deepEqual(ids, ["civ_a", "civ_b"]);
  assert.equal(feed.find((f) => f.civ.id === "civ_a").attackerId, "civ_b");
});
