// src/components/game/world/civPlacement.js
//
// Where a civilization lives in the nested cosmos (Cosmic Scales Phase 2).
// A civ's SCALE is a pure function of its Kardashev type, and its HOME
// structures (galaxy, star) are derived deterministically from its id - so
// placement needs no server world-gen: the client, which already generates the
// world, computes it. When the backend promotes a civ's type across a scale
// boundary, this automatically shows it one scale up. That IS the ascension.
import { generateScaleObjects, generateSystem, worldSeed, SCALES, DESCEND_CATEGORY } from "./worldScales.js";
import { CHUNK_SIZE } from "../constants.js";

const hashStr = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
};

// Type -> the scale a civ occupies. The Kardashev ladder is an ENERGY ladder,
// and each rung names the largest thing a civilization can power itself from:
//
//   Type 0  - a fraction of its homeworld's energy  -> planetary
//   Type I  - ALL of its homeworld's energy         -> planetary (still!)
//   Type II - all of its star's energy (Dyson)      -> stellar
//   Type III- all of its galaxy's energy            -> galactic
//
// Type I was previously placed at the stellar scale, which is a rung early:
// a Type I is still bound to one planet - mastering a world is precisely what
// it has NOT yet outgrown. Leaving the cradle world is the Type II step.
export function civScale(type) {
  if (type === "Type3") return "galactic";
  if (type === "Type2") return "stellar";
  return "planetary"; // Type0 and Type1 are both planet-bound
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

// A stable home galaxy for a civ.
//
// The search STARTS at the civ's server-assigned location when it has one -
// that position is placed a few chunks from the player (physicsEngine spawns
// civs near the last known player position, and the dev console spawns them
// closer still), so "a civilization appeared nearby" stays true after the home
// is resolved. Without a location we fall back to a deterministic ring of
// chunks around the origin.
//
// Either way the result is a pure function of the civ, so a people's homeworld
// never moves once chosen.
export function homeGalaxyId(seed, civOrId, cp) {
  const civId = typeof civOrId === "string" ? civOrId : civOrId?.id;
  const loc = typeof civOrId === "string" ? null : civOrId?.location;

  // Chunk the civ was seeded into, if the server gave it a position.
  const homeCx = typeof loc?.x === "number" ? Math.floor(loc.x / CHUNK_SIZE) : null;
  const homeCy = typeof loc?.y === "number" ? Math.floor(loc.y / CHUNK_SIZE) : null;

  // The seeding chunk is part of the identity of the result, so it belongs in
  // the cache key - otherwise a civ whose location arrives later (or differs)
  // keeps whatever home was resolved first.
  const key = `${seed}:${civId}:${homeCx},${homeCy}:${cpTag(cp)}`;
  if (_galCache.has(key)) return _galCache.get(key);

  const R = 8;
  let result = null;
  for (let attempt = 0; attempt < 16; attempt++) {
    let cx;
    let cy;
    if (homeCx !== null) {
      // Spiral outward from the civ's own chunk: attempt 0 is exactly where the
      // server put them, later attempts widen only if that chunk is empty void.
      const ring = Math.floor(attempt / 4);
      cx = homeCx + ((hashStr(`${civId}#nx${attempt}`) % (ring * 2 + 1)) - ring);
      cy = homeCy + ((hashStr(`${civId}#ny${attempt}`) % (ring * 2 + 1)) - ring);
    } else {
      cx = (hashStr(`${civId}#gx${attempt}`) % (R * 2 + 1)) - R;
      cy = (hashStr(`${civId}#gy${attempt}`) % (R * 2 + 1)) - R;
    }
    const galaxies = generateScaleObjects(seed, cx, cy, "galactic", undefined, cp)
      .filter((o) => o.category === "galaxy");
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
  const gal = homeGalaxyId(seed, civ, cp);
  if (!gal) return [];
  if (scale === "stellar") return [gal];
  const star = homeStarId(seed, civ.id, gal, cp);
  return star ? [gal, star] : [gal];
}

// Object ids encode the chunk that generated them ("obj:cx:cy:i", "s:cx:cy:k"),
// so any object can be re-derived deterministically without a world scan.
function chunkOfId(id) {
  const parts = String(id ?? "").split(":");
  if (parts.length < 4) return null;
  const cx = Number(parts[1]);
  const cy = Number(parts[2]);
  return Number.isFinite(cx) && Number.isFinite(cy) ? { cx, cy } : null;
}

function findInChunk(worldScaleSeed, scale, id, cp) {
  const chunk = chunkOfId(id);
  if (!chunk) return null;
  const objects = generateScaleObjects(worldScaleSeed, chunk.cx, chunk.cy, scale, undefined, cp);
  return objects.find((o) => o.id === id) || null;
}

const _anchorCache = new Map();

/**
 * THE object a civilization physically inhabits at its own scale - the planet,
 * star, or galaxy it lives on. Returns the full descriptor (position, class,
 * scale, colour) so the beacon can be drawn ONTO its world.
 *
 * Civ beacons used to sit at a hash of the civ id - a point in empty space with
 * no relationship to anything the player could see. You could follow the
 * host-structure marker down into the right system and still find the
 * civilization floating in the void beside its own sun.
 */
export function civAnchorObject(seed, civ, cp) {
  const key = `${seed}:${civ.id}:${civ.type}:${cpTag(cp)}`;
  if (_anchorCache.has(key)) return _anchorCache.get(key);

  const scale = civScale(civ.type);
  let anchor = null;

  if (scale === "galactic") {
    // A Type III IS its galaxy.
    anchor = findInChunk(seed, "galactic", homeGalaxyId(seed, civ, cp), cp);
  } else if (scale === "stellar") {
    // A Type II encloses its star.
    const gal = homeGalaxyId(seed, civ, cp);
    const star = homeStarId(seed, civ.id, gal, cp);
    if (gal && star) {
      anchor = findInChunk(worldSeed(seed, "stellar", [gal]), "stellar", star, cp);
    }
  } else {
    // Type 0 / I live on a WORLD: pick a planet from their home system.
    const gal = homeGalaxyId(seed, civ, cp);
    const star = homeStarId(seed, civ.id, gal, cp);
    if (gal && star) {
      const planets = generateSystem(worldSeed(seed, "planetary", [gal, star]))
        .filter((o) => o.category === "planet");
      if (planets.length) {
        anchor = planets[hashStr(`${civ.id}#world`) % planets.length];
      }
    }
  }

  _anchorCache.set(key, anchor);
  return anchor;
}

// The civ's beacon position: the exact centre of the world it inhabits.
// Falls back to a stable id-hash only if its home couldn't be generated, so a
// civ is never invisible.
export function civLocation(civ, seed, cp) {
  if (seed) {
    const anchor = civAnchorObject(seed, civ, cp);
    if (anchor) return { x: anchor.x, y: anchor.y };
  }
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
    return homeGalaxyId(seed, civ, cp);
  }
  if (world.scale === "stellar" && scale === "planetary") {
    const gal = homeGalaxyId(seed, civ, cp);
    // must be in the galaxy we're currently inside
    if (gal !== world.path[0]) return null;
    return homeStarId(seed, civ.id, gal, cp);
  }
  return null;
}
