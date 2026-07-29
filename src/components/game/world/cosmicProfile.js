// src/components/game/world/cosmicProfile.js
//
// The bridge between the two universes. The backend owns an authoritative
// aggregate state (cosmic phase, galaxy/star counts, metallicity, stability);
// the frontend owns an infinite procedural render. Historically the render
// read NONE of that, so a brand-new universe reporting "0 galaxies" still drew
// a full galaxy field. This maps currentState -> generation parameters so what
// you fly through is always a faithful instance of the universe's real state.
//
// Determinism is preserved: the world SEED still fixes *where* everything sits
// and its base attributes; this fixes *how much* exists, *of what kind*, and in
// *what mood*. Same (seed, phase) always renders the same; advancing a phase
// visibly repopulates the sky - you watch the universe evolve.

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const PHASE_ORDER = [
  "dark_ages", "reionization", "galaxy_formation", "stellar_peak",
  "gradual_decline", "twilight_era", "degenerate_era",
];

// Per-era character that ISN'T a raw count: how lit the era is (dims proto
// structure when low), gas/nebula prominence, AGN (quasar) activity, an overall
// brightness/mood factor, an era tint, and a floor that guarantees the region
// is always explorable (the Hybrid choice - never a barren first session).
const PHASE_PROFILE = {
  dark_ages:        { ignition: 0.05, nebula: 1.7, quasar: 0.3, dim: 0.55, floor: 0.06, tint: 0x3a3f7a },
  reionization:     { ignition: 0.25, nebula: 1.8, quasar: 1.7, dim: 0.65, floor: 0.16, tint: 0x4a5da0 },
  galaxy_formation: { ignition: 0.55, nebula: 1.4, quasar: 2.2, dim: 0.82, floor: 0.28, tint: 0x6a6fc0 },
  stellar_peak:     { ignition: 1.00, nebula: 1.0, quasar: 1.0, dim: 1.00, floor: 0.45, tint: 0xffffff },
  gradual_decline:  { ignition: 0.85, nebula: 0.8, quasar: 0.5, dim: 0.90, floor: 0.38, tint: 0xf2d6a4 },
  twilight_era:     { ignition: 0.55, nebula: 0.6, quasar: 0.2, dim: 0.70, floor: 0.26, tint: 0xe6a878 },
  degenerate_era:   { ignition: 0.30, nebula: 0.4, quasar: 0.05, dim: 0.48, floor: 0.14, tint: 0xd88a66 },
};

// Map a raw aggregate count to a 0..1 local-density signal via a log ramp:
// [loExp, hiExp] are powers of ten. 0 -> 0 (the render honors an empty sky),
// rising through the ramp -> sparse -> full. The magnitudes never match 1:1
// (you fly past dozens, not 1e11) - the point is qualitative agreement, which
// the "estimated / representative region" HUD label makes honest.
function countRamp(count, loExp, hiExp) {
  if (!count || count <= 0) return 0;
  const e = Math.log10(count);
  return clamp((e - loExp) / (hiExp - loExp), 0, 1);
}

/**
 * Derive generation parameters from the backend's currentState. Safe with a
 * missing/partial state - defaults to a stellar-peak "full field" so anything
 * that forgets to pass state renders exactly as the game did before.
 */
export function cosmicProfile(currentState = {}) {
  const phaseKey = PHASE_PROFILE[currentState.cosmicPhase] ? currentState.cosmicPhase : "stellar_peak";
  const p = PHASE_PROFILE[phaseKey];

  // Local structural density tied to the very numbers the HUD shows.
  const galaxyDensity = Math.max(countRamp(currentState.galaxyCount, 3, 11), p.floor);
  const starDensity = Math.max(countRamp(currentState.starCount, 6, 22), p.floor);

  // Metallicity gates rocky/metal-rich matter (real chemistry): near 0 in the
  // young universe, enriched by stellar generations. Normalized against ~0.5.
  const metalRich = clamp((currentState.metallicity ?? 0.4) / 0.5, 0, 1);

  // Stability made physical: a calm universe barely ripples; a failing one
  // frays, and ambient turbulence multiplies around the player.
  const stability = clamp(currentState.stabilityIndex ?? 1, 0, 1);
  const turbulence = clamp(1 + (1 - stability) * 3.5, 0.35, 4.5);

  return {
    phaseKey,
    phaseIndex: PHASE_ORDER.indexOf(phaseKey),
    galaxyDensity,
    starDensity,
    nebulaDensity: p.nebula,
    quasarBoost: p.quasar,
    starIgnition: p.ignition,
    metalRich,
    dim: p.dim,
    tint: p.tint,
    turbulence,
  };
}

// The neutral "full field" profile - what generators fall back to when handed
// no state (legacy call sites, unit tests). Densities are a literal 1.0 so the
// output is byte-for-byte the pre-Coherent-Cosmos behavior. A real universe at
// stellar peak (galaxyCount ~1e11) ramps to the same 1.0 naturally.
export const NEUTRAL_PROFILE = {
  phaseKey: "stellar_peak",
  phaseIndex: PHASE_ORDER.indexOf("stellar_peak"),
  galaxyDensity: 1,
  starDensity: 1,
  nebulaDensity: 1,
  quasarBoost: 1,
  starIgnition: 1,
  metalRich: 1,
  dim: 1,
  tint: 0xffffff,
  turbulence: 1,
};

export { PHASE_ORDER };
