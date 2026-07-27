// src/components/game/world/civPlacement.js
//
// Where a civilization lives in the nested cosmos (Cosmic Scales Phase 2).
// A civ's SCALE is a pure function of its Kardashev type, and its HOME
// structures (galaxy, star) are derived deterministically from its id - so
// placement needs no server world-gen: the client, which already generates the
// world, computes it. When the backend promotes a civ's type across a scale
// boundary, this automatically shows it one scale up. That IS the ascension.
import { generateScaleObjects, worldSeed } from "./worldScales.js";

const hashStr = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
};

// Type -> the scale a civ occupies. As it climbs the Kardashev ladder it
// climbs the cosmic ladder: a planet-bound Type 0, a system-holding Type I/II,
// a galaxy-spanning Type III.
export function civScale(type) {
  if (type === "Type3") return "galactic";
  if (type === "Type0") return "planetary";
  return "stellar";
}

const _galCache = new Map();
const _starCache = new Map();

// A stable home galaxy id for a civ: pick a chunk near origin from the civ id,
// generate it, and choose one of its galaxies. Falls back outward through a
// deterministic sequence if the chosen chunk is an empty void.
export function homeGalaxyId(seed, civId) {
  const key = `${seed}:${civId}`;
  if (_galCache.has(key)) return _galCache.get(key);
  const R = 8;
  let result = null;
  for (let attempt = 0; attempt < 16; attempt++) {
    const cx = (hashStr(`${civId}#gx${attempt}`) % (R * 2 + 1)) - R;
    const cy = (hashStr(`${civId}#gy${attempt}`) % (R * 2 + 1)) - R;
    const galaxies = generateScaleObjects(seed, cx, cy, "galactic").filter((o) => o.category === "galaxy");
    if (galaxies.length) {
      result = galaxies[hashStr(`${civId}#gpick`) % galaxies.length].id;
      break;
    }
  }
  _galCache.set(key, result);
  return result;
}

// A stable home star id within the civ's home galaxy.
export function homeStarId(seed, civId, galaxyId) {
  if (!galaxyId) return null;
  const key = `${seed}:${civId}:${galaxyId}`;
  if (_starCache.has(key)) return _starCache.get(key);
  const stellarSeed = worldSeed(seed, "stellar", [galaxyId]);
  const cx = (hashStr(`${civId}#sx`) % 7) - 3;
  const cy = (hashStr(`${civId}#sy`) % 7) - 3;
  const stars = generateScaleObjects(stellarSeed, cx, cy, "stellar");
  const result = stars.length ? stars[hashStr(`${civId}#spick`) % stars.length].id : null;
  _starCache.set(key, result);
  return result;
}

// The descent path (host) the civ currently occupies, from its type.
export function civHost(seed, civ) {
  const scale = civScale(civ.type);
  if (scale === "galactic") return [];
  const gal = homeGalaxyId(seed, civ.id);
  if (!gal) return [];
  if (scale === "stellar") return [gal];
  const star = homeStarId(seed, civ.id, gal);
  return star ? [gal, star] : [gal];
}

// A stable beacon position within the civ's current scale (world coords).
export function civLocation(civ) {
  return {
    x: (hashStr(`${civ.id}#lx`) % 8000) - 4000,
    y: (hashStr(`${civ.id}#ly`) % 8000) - 4000,
  };
}

const pathEq = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

// Is this civ present at the player's current scale + descent path?
export function civVisibleAt(seed, civ, world) {
  if (civ.extinct) return false;
  if (civScale(civ.type) !== world.scale) return false;
  return pathEq(civHost(seed, civ), world.path);
}

// A civ is in distress if it's dying or actively begging for rescue - the
// trigger for a distress signal the player can follow down the scales.
export function civInDistress(civ) {
  if (!civ || civ.extinct) return false;
  if (civ.petition && civ.petition.kind === "crisis") return true;
  return (civ.resourceDepletion ?? 0) > 0.7 || (civ.stability ?? 0.5) < 0.28;
}

// Which structure id (at the CURRENT scale) does this civ live inside? Used to
// mark descendable structures that contain a civ, so descent is purposeful.
// galactic view -> the civ's home galaxy; stellar view (inside gal) -> its star.
export function civHostStructureAt(seed, civ, world) {
  const scale = civScale(civ.type);
  // Only civs that live DEEPER than the current scale are "inside" something here.
  if (world.scale === "galactic" && scale !== "galactic") {
    return homeGalaxyId(seed, civ.id);
  }
  if (world.scale === "stellar" && scale === "planetary") {
    const gal = homeGalaxyId(seed, civ.id);
    // must be in the galaxy we're currently inside
    if (gal !== world.path[0]) return null;
    return homeStarId(seed, civ.id, gal);
  }
  return null;
}
