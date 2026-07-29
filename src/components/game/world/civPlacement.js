// src/components/game/world/civPlacement.js
//
// Where a civilization lives in the nested cosmos (Cosmic Scales Phase 2).
// A civ's SCALE is a pure function of its Kardashev type, and its HOME
// structures (galaxy, star) are derived deterministically from its id - so
// placement needs no server world-gen: the client, which already generates the
// world, computes it. When the backend promotes a civ's type across a scale
// boundary, this automatically shows it one scale up. That IS the ascension.
import { generateScaleObjects, worldSeed, SCALES, DESCEND_CATEGORY } from "./worldScales.js";

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

// IMPORTANT (Coherent Cosmos): a civ's home MUST be chosen from the same world
// the player actually sees. The render's density is phase-driven (cosmicProfile),
// so these generators take the SAME `cp` - otherwise a home galaxy/star gets
// picked that exists only in the full-density math and renders as empty space,
// and the waypoint points at nothingness. `cp` is folded into the cache key so a
// phase change can't hand back a stale home from a different density.
const cpTag = (cp) => cp?.phaseKey ?? "neutral";

// A stable home galaxy id for a civ: pick a chunk near origin from the civ id,
// generate it, and choose one of its galaxies. Falls back outward through a
// deterministic sequence if the chosen chunk is an empty void.
export function homeGalaxyId(seed, civId, cp) {
  const key = `${seed}:${civId}:${cpTag(cp)}`;
  if (_galCache.has(key)) return _galCache.get(key);
  const R = 8;
  let result = null;
  for (let attempt = 0; attempt < 16; attempt++) {
    const cx = (hashStr(`${civId}#gx${attempt}`) % (R * 2 + 1)) - R;
    const cy = (hashStr(`${civId}#gy${attempt}`) % (R * 2 + 1)) - R;
    const galaxies = generateScaleObjects(seed, cx, cy, "galactic", undefined, cp).filter((o) => o.category === "galaxy");
    if (galaxies.length) {
      result = galaxies[hashStr(`${civId}#gpick`) % galaxies.length].id;
      break;
    }
  }
  _galCache.set(key, result);
  return result;
}

// A stable home star id within the civ's home galaxy.
export function homeStarId(seed, civId, galaxyId, cp) {
  if (!galaxyId) return null;
  const key = `${seed}:${civId}:${galaxyId}:${cpTag(cp)}`;
  if (_starCache.has(key)) return _starCache.get(key);
  const stellarSeed = worldSeed(seed, "stellar", [galaxyId]);
  let result = null;
  // Scan outward from the id-derived chunk: reduced star density (young/dying
  // eras) can leave the first chunk empty, so don't give up on the first miss.
  for (let attempt = 0; attempt < 12 && !result; attempt++) {
    const cx = (hashStr(`${civId}#sx${attempt}`) % 7) - 3;
    const cy = (hashStr(`${civId}#sy${attempt}`) % 7) - 3;
    const stars = generateScaleObjects(stellarSeed, cx, cy, "stellar", undefined, cp);
    if (stars.length) result = stars[hashStr(`${civId}#spick`) % stars.length].id;
  }
  _starCache.set(key, result);
  return result;
}

// The descent path (host) the civ currently occupies, from its type.
export function civHost(seed, civ, cp) {
  const scale = civScale(civ.type);
  if (scale === "galactic") return [];
  const gal = homeGalaxyId(seed, civ.id, cp);
  if (!gal) return [];
  if (scale === "stellar") return [gal];
  const star = homeStarId(seed, civ.id, gal, cp);
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
export function civVisibleAt(seed, civ, world, cp) {
  if (civ.extinct) return false;
  if (civScale(civ.type) !== world.scale) return false;
  return pathEq(civHost(seed, civ, cp), world.path);
}

// A civ is in distress if it's dying or actively begging for rescue - the
// trigger for a distress signal the player can follow down the scales.
export function civInDistress(civ) {
  if (!civ || civ.extinct) return false;
  if (civ.petition && civ.petition.kind === "crisis") return true;
  return (civ.resourceDepletion ?? 0) > 0.7 || (civ.stability ?? 0.5) < 0.28;
}

// The single next move to reach a civ from wherever the player currently is.
// This is what powers the Locator's waypoint: it collapses the whole nested
// journey (fly to galaxy -> descend -> fly to star -> descend -> arrive) into
// one instruction at a time.
//   { mode: "here" }                      civ is at this scale + path
//   { mode: "descend", structureId, category }  head to this structure, enter it
//   { mode: "ascend", reason }            you're on the wrong branch / too deep
export function nextHopToCiv(seed, civ, world, cp) {
  if (!civ || civ.extinct) return { mode: "gone" };
  const targetScale = civScale(civ.type);
  const host = civHost(seed, civ, cp); // structure ids from galactic down to the civ's parent
  const curIdx = SCALES.indexOf(world.scale);
  const tgtIdx = SCALES.indexOf(targetScale);
  const depth = world.path.length;

  // If our descent path diverges from the civ's home path, we're inside the
  // wrong structure - back out until the prefix matches again.
  for (let i = 0; i < Math.min(depth, host.length); i++) {
    if (world.path[i] !== host[i]) return { mode: "ascend", reason: "branch" };
  }
  if (curIdx > tgtIdx || depth > host.length) return { mode: "ascend", reason: "toodeep" };
  if (curIdx === tgtIdx) return { mode: "here" };

  const structureId = host[depth];
  if (!structureId) return { mode: "ascend", reason: "nohost" };
  return { mode: "descend", structureId, category: DESCEND_CATEGORY[world.scale] };
}

// Which structure id (at the CURRENT scale) does this civ live inside? Used to
// mark descendable structures that contain a civ, so descent is purposeful.
// galactic view -> the civ's home galaxy; stellar view (inside gal) -> its star.
export function civHostStructureAt(seed, civ, world, cp) {
  const scale = civScale(civ.type);
  // Only civs that live DEEPER than the current scale are "inside" something here.
  if (world.scale === "galactic" && scale !== "galactic") {
    return homeGalaxyId(seed, civ.id, cp);
  }
  if (world.scale === "stellar" && scale === "planetary") {
    const gal = homeGalaxyId(seed, civ.id, cp);
    // must be in the galaxy we're currently inside
    if (gal !== world.path[0]) return null;
    return homeStarId(seed, civ.id, gal, cp);
  }
  return null;
}
