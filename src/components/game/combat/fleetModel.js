// src/components/game/combat/fleetModel.js
//
// Civilization fleets: who can field ships, how many, and what they do.
//
// Pure and Phaser-free (the combatModel/selfModel pattern) so the composition
// and stance rules unit-test under node --test, and every tunable lives in one
// place. CivFleetSystem is the Phaser adapter over this.
//
// The Kardashev ladder gates spaceflight, which makes a civilization's tier a
// COMBAT fact and not just a visual: a Type 0 has no vessels at all (it has not
// left its world), a Type I fields token system craft, and only a Type II - the
// rung where a people finally leave the cradle world - keeps a real fleet.

export const SHIP_CLASSES = {
  // Light system craft: fast, fragile, barely armed.
  skiff: {
    hp: 12, speed: 195, turn: 2.8, radius: 11,
    damage: 5, fireIntervalMs: 2200, range: 620, boltSpeed: 260,
  },
  // The workhorse warship of a star-faring people.
  cruiser: {
    hp: 26, speed: 165, turn: 2.1, radius: 14,
    damage: 8, fireIntervalMs: 1900, range: 780, boltSpeed: 300,
  },
  // Galactic-power capital ship.
  dreadnought: {
    hp: 44, speed: 138, turn: 1.6, radius: 18,
    damage: 12, fireIntervalMs: 1700, range: 900, boltSpeed: 330,
  },
};

// Patrol geometry, per tier - a bigger power holds a wider perimeter.
export const PATROL_RADIUS = { Type1: 190, Type2: 300, Type3: 460 };

// How long a civilization stays furious after you shoot at it.
export const GRUDGE_MS = 45000;
// A hostile civ opens fire on sight inside this range even unprovoked.
export const UNPROVOKED_RANGE = 900;

/**
 * The home-defence fleet a civilization keeps. Warlike peoples field one extra
 * hull. Type 0 has none - it cannot reach orbit.
 */
export function fleetFor(civ) {
  if (!civ || civ.extinct) return [];
  const extra = (civ.warlikeness ?? 0) > 0.6 ? 1 : 0;
  switch (civ.type) {
    case "Type1":
      return Array(1 + extra).fill("skiff");
    case "Type2":
      return [...Array(2 + extra).fill("cruiser"), "skiff"];
    case "Type3":
      return [...Array(3 + extra).fill("dreadnought"), "cruiser", "cruiser"];
    default:
      return []; // Type 0: planet-bound
  }
}

/**
 * The strike force a civilization sends AT an enemy while at war. Smaller than
 * a home fleet - it's an expedition, not a migration - and it's what the player
 * can destroy to save the world being besieged.
 */
export function raidFleetFor(civ) {
  const home = fleetFor(civ);
  if (home.length === 0) return [];
  return home.slice(0, Math.max(1, Math.ceil(home.length / 2)));
}

/**
 * What a ship should be doing right now. Kept pure so the rules are testable
 * and the system stays a renderer.
 *
 *   "raid"        - a besieger: hunt the defenders of the world it came to burn
 *   "hunt"        - hostile toward the player: close and fire
 *   "patrol"      - hold station around home
 */
export function shipStance({ isRaider, attitude, grudgeUntil, playerDistance, now }) {
  if (isRaider) return "raid";
  const provoked = now < (grudgeUntil ?? 0);
  if (provoked) return "hunt";
  if (attitude === "hostile" && playerDistance <= UNPROVOKED_RANGE) return "hunt";
  return "patrol";
}

/**
 * Which civilization is besieging this one, if any. Reading the war from the
 * defender's side is what lets the world show a siege the player can break.
 */
export function besiegerOf(civId, activeWars = []) {
  const war = activeWars.find((w) => w.a === civId || w.b === civId);
  if (!war) return null;
  return war.a === civId ? war.b : war.a;
}
