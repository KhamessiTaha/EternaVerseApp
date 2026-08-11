// src/components/game/world/civPlacement.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  civScale, homeGalaxyId, homeStarId, civHost, civVisibleAt, civHostStructureAt,
} from "./civPlacement.js";

const SEED = "cosmos";

// The Kardashev ladder is an ENERGY ladder: a Type I harnesses ALL of its
// HOMEWORLD's energy - it is still planet-bound. Leaving the cradle world for
// the star system is the Type II step. (Type I was previously placed at the
// stellar scale, one rung too early.)
test("scale is derived from Kardashev type (planetary -> galactic)", () => {
  assert.equal(civScale("Type0"), "planetary");
  assert.equal(civScale("Type1"), "planetary"); // still bound to its world
  assert.equal(civScale("Type2"), "stellar");   // encloses its star
  assert.equal(civScale("Type3"), "galactic");
});

test("a civ spawned near the player makes its home near the player", () => {
  // The server places new civilizations a few chunks from the player, so the
  // resolved home galaxy must be near that position - otherwise "a civilization
  // appeared nearby" is a lie and the dev spawn lands you nowhere.
  const far = { id: "civ_far", type: "Type2", location: { x: 40000, y: -25000 } };
  const near = { id: "civ_near", type: "Type2", location: { x: 500, y: 500 } };

  const farGal = homeGalaxyId(SEED, far);
  const nearGal = homeGalaxyId(SEED, near);
  assert.ok(farGal && nearGal, "both resolve a home");

  // Chunk coordinates are encoded in the object id ("obj:cx:cy:i").
  const chunkOf = (id) => id.split(":").slice(1, 3).map(Number);
  const [fx, fy] = chunkOf(farGal);
  assert.ok(Math.abs(fx - 40) <= 4 && Math.abs(fy + 25) <= 4,
    `home ${farGal} should sit near chunk (40,-25)`);

  const [nx, ny] = chunkOf(nearGal);
  assert.ok(Math.abs(nx) <= 4 && Math.abs(ny) <= 4,
    `home ${nearGal} should sit near chunk (0,0)`);
});

test("home galaxy/star are stable and real for a civ id", () => {
  const gal = homeGalaxyId(SEED, "civ_abc");
  assert.ok(typeof gal === "string" && gal.length > 0);
  assert.equal(homeGalaxyId(SEED, "civ_abc"), gal); // stable
  const star = homeStarId(SEED, "civ_abc", gal);
  assert.ok(typeof star === "string" && star.startsWith("s:")); // a stellar-scale id
  assert.equal(homeStarId(SEED, "civ_abc", gal), star); // stable
});

test("host path lengthens with descent depth of the scale", () => {
  const t3 = civHost(SEED, { id: "civ_1", type: "Type3" });
  const t2 = civHost(SEED, { id: "civ_1", type: "Type2" });
  const t1 = civHost(SEED, { id: "civ_1", type: "Type1" });
  const t0 = civHost(SEED, { id: "civ_1", type: "Type0" });
  assert.equal(t3.length, 0);   // galactic - no descent
  assert.equal(t2.length, 1);   // inside a galaxy
  assert.equal(t1.length, 2);   // planet-bound: inside a galaxy's star
  assert.equal(t0.length, 2);   // likewise
  assert.equal(t2[0], t0[0]);   // same home galaxy across types
});

test("ascension: same civ shows at a higher scale when its type rises", () => {
  const civ = { id: "civ_rise", type: "Type0" };
  const planetary = { scale: "planetary", path: civHost(SEED, civ) };
  assert.equal(civVisibleAt(SEED, civ, planetary), true);

  // Type I is still planet-bound - mastering its world is exactly what it has
  // NOT yet outgrown, so it stays in the same system.
  const typeOne = { id: "civ_rise", type: "Type1" };
  assert.equal(civVisibleAt(SEED, typeOne, planetary), true);

  // Type II encloses its star: it leaves the cradle world and is now met at
  // the stellar scale of its galaxy, NOT at the old planetary system.
  const risen = { id: "civ_rise", type: "Type2" };
  assert.equal(civVisibleAt(SEED, risen, planetary), false);
  const stellar = { scale: "stellar", path: civHost(SEED, risen) };
  assert.equal(civVisibleAt(SEED, risen, stellar), true);
});

test("a civ is only visible in its own galaxy/system, not another", () => {
  const civ = { id: "civ_home", type: "Type2" }; // stellar-scale dweller
  const home = { scale: "stellar", path: civHost(SEED, civ) };
  assert.equal(civVisibleAt(SEED, civ, home), true);
  const elsewhere = { scale: "stellar", path: ["obj:99:99:0"] };
  assert.equal(civVisibleAt(SEED, civ, elsewhere), false);
  assert.equal(civVisibleAt(SEED, { ...civ, extinct: true }, home), false);
});

test("host-structure marker points at the galaxy/star that contains a civ", () => {
  const civ = { id: "civ_mark", type: "Type0" };
  const gal = homeGalaxyId(SEED, civ.id);
  // at galactic scale, the marker is the civ's home galaxy
  assert.equal(civHostStructureAt(SEED, civ, { scale: "galactic", path: [] }), gal);
  // inside that galaxy, the marker is the civ's home star
  const star = homeStarId(SEED, civ.id, gal);
  assert.equal(civHostStructureAt(SEED, civ, { scale: "stellar", path: [gal] }), star);
  // inside a DIFFERENT galaxy, no marker
  assert.equal(civHostStructureAt(SEED, civ, { scale: "stellar", path: ["obj:1:1:0"] }), null);
});
