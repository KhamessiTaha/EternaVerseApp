// src/components/game/world/civPlacement.locator.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { nextHopToCiv, homeGalaxyId, homeStarId, civHost } from "./civPlacement.js";

const SEED = "locator-seed";
const G = { scale: "galactic", path: [] };

test("a Type III civ is already here at the galactic scale", () => {
  const hop = nextHopToCiv(SEED, { id: "c-t3", type: "Type3" }, G);
  assert.equal(hop.mode, "here");
});

test("a Type I civ is reached by descending into its home galaxy", () => {
  const civ = { id: "c-t1", type: "Type1" };
  const hop = nextHopToCiv(SEED, civ, G);
  assert.equal(hop.mode, "descend");
  assert.equal(hop.structureId, homeGalaxyId(SEED, civ.id));
  assert.equal(hop.category, "galaxy");
});

test("inside its home galaxy, a Type I civ is here", () => {
  const civ = { id: "c-t1b", type: "Type1" };
  const gal = homeGalaxyId(SEED, civ.id);
  const hop = nextHopToCiv(SEED, civ, { scale: "stellar", path: [gal] });
  assert.equal(hop.mode, "here");
});

test("inside the WRONG galaxy, the locator says ascend", () => {
  const civ = { id: "c-t1c", type: "Type1" };
  const hop = nextHopToCiv(SEED, civ, { scale: "stellar", path: ["obj:99:99:0"] });
  assert.equal(hop.mode, "ascend");
  assert.equal(hop.reason, "branch");
});

test("a Type 0 civ routes galaxy -> star -> arrive", () => {
  const civ = { id: "c-t0", type: "Type0" };
  const [gal, star] = civHost(SEED, civ);

  const atGalactic = nextHopToCiv(SEED, civ, { scale: "galactic", path: [] });
  assert.equal(atGalactic.mode, "descend");
  assert.equal(atGalactic.structureId, gal);

  const inGalaxy = nextHopToCiv(SEED, civ, { scale: "stellar", path: [gal] });
  assert.equal(inGalaxy.mode, "descend");
  assert.equal(inGalaxy.structureId, star);
  assert.equal(inGalaxy.category, "star");

  const atSystem = nextHopToCiv(SEED, civ, { scale: "planetary", path: [gal, star] });
  assert.equal(atSystem.mode, "here");
});

test("an extinct target reports gone", () => {
  const hop = nextHopToCiv(SEED, { id: "c-dead", type: "Type1", extinct: true }, G);
  assert.equal(hop.mode, "gone");
});
