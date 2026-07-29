// src/components/game/world/cosmicProfile.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { cosmicProfile, NEUTRAL_PROFILE } from "./cosmicProfile.js";

test("an empty young universe renders sparse, not full", () => {
  const dark = cosmicProfile({ cosmicPhase: "dark_ages", galaxyCount: 0, starCount: 0 });
  assert.ok(dark.galaxyDensity < 0.15, "near-empty galaxy density in the dark ages");
  assert.ok(dark.starIgnition < 0.2, "stars are barely lit");
  // Hybrid floor: never *fully* empty, so the region stays explorable.
  assert.ok(dark.galaxyDensity > 0, "a floor keeps it explorable");
});

test("density ramps with the real counts the HUD shows", () => {
  const forming = cosmicProfile({ cosmicPhase: "galaxy_formation", galaxyCount: 1e6, starCount: 1e10 });
  const peak = cosmicProfile({ cosmicPhase: "stellar_peak", galaxyCount: 2e11, starCount: 1e21 });
  assert.ok(peak.galaxyDensity > forming.galaxyDensity, "more galaxies -> denser field");
  assert.equal(peak.galaxyDensity, 1, "a mature universe saturates to a full field");
});

test("stability becomes physical turbulence", () => {
  const calm = cosmicProfile({ stabilityIndex: 1 });
  const failing = cosmicProfile({ stabilityIndex: 0.2 });
  assert.equal(calm.turbulence, 1, "a stable cosmos barely ripples");
  assert.ok(failing.turbulence > calm.turbulence * 2, "a failing cosmos frays and spawns more");
});

test("metallicity gates rocky/metal-rich matter", () => {
  const young = cosmicProfile({ metallicity: 0.02 });
  const enriched = cosmicProfile({ metallicity: 0.5 });
  assert.ok(young.metalRich < 0.1, "the young universe is metal-poor");
  assert.equal(enriched.metalRich, 1, "an enriched universe is metal-rich");
});

test("NEUTRAL_PROFILE is a true full field (legacy behavior preserved)", () => {
  assert.equal(NEUTRAL_PROFILE.galaxyDensity, 1);
  assert.equal(NEUTRAL_PROFILE.starDensity, 1);
  assert.equal(NEUTRAL_PROFILE.turbulence, 1);
  assert.equal(NEUTRAL_PROFILE.dim, 1);
});

test("an unknown/missing phase falls back safely to a full field", () => {
  const bogus = cosmicProfile({ cosmicPhase: "not_a_phase", galaxyCount: 2e11 });
  assert.equal(bogus.phaseKey, "stellar_peak");
  assert.equal(bogus.galaxyDensity, 1);
});
