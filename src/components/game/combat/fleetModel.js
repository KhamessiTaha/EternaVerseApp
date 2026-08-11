// src/components/game/combat/fleetModel.js
//
// Civilization fleets: who can field ships, what those ships DO, and what
// happens to a world when nobody stops the bombers.
//
// Pure and Phaser-free (the combatModel/selfModel pattern) so every rule is
// unit-testable and all tuning lives in one place. CivFleetSystem renders it.
//
// The design intent: a siege must be a BATTLE, not a checklist. Defenders and
// raiders fight each other whether or not the player shows up, the attacker
// reinforces in waves, and if the bombers get through, the civilization is
// really destroyed. The player is a heavy thumb on the scale - not the only
// thing in the sky.
//
// Roles exist so the fight poses a question instead of a target list:
//   bombers ignore you completely and run for the world (the actual threat)
//   guardians screen them and must be broken through or flanked
//   interceptors harass YOU, so chasing the bombers always costs something

export const SHIP_ROLES = {
  // Fast harasser. Weak alone, lethal in a pack. Hunts the player.
  interceptor: {
    hp: 14, shields: 0, speed: 235, turn: 3.2, radius: 11,
    damage: 5, fireIntervalMs: 1500, range: 560, boltSpeed: 320,
    targets: "player",
  },
  // The threat. Unarmed against ships, ignores the player entirely, and burns
  // a world if it reaches orbit.
  bomber: {
    hp: 30, shields: 12, speed: 132, turn: 1.3, radius: 16,
    damage: 0, fireIntervalMs: 0, range: 0, boltSpeed: 0,
    targets: "world",
    bombardRange: 110,
    bombardIntervalMs: 5200,
  },
  // Escort. Shielded, screens the bombers, engages whatever comes closest.
  guardian: {
    hp: 34, shields: 26, speed: 152, turn: 1.8, radius: 15,
    damage: 9, fireIntervalMs: 2000, range: 760, boltSpeed: 300,
    targets: "nearest",
  },
  // The line warship a home fleet is built from.
  cruiser: {
    hp: 26, shields: 12, speed: 168, turn: 2.0, radius: 14,
    damage: 8, fireIntervalMs: 1900, range: 780, boltSpeed: 300,
    targets: "nearest",
  },
};

// Shields soak damage first and regenerate out of combat - so a guardian must
// be pressured, not plinked.
export const SHIELD_REGEN_PER_SEC = 3.2;
export const SHIELD_REGEN_DELAY_MS = 4000;

export const PATROL_RADIUS = { Type1: 190, Type2: 300, Type3: 460 };
export const GRUDGE_MS = 45000;
export const UNPROVOKED_RANGE = 900;

// Reinforcement cadence: a war doesn't end because you cleared one wave.
// WAVE_REGROUP_MS is the shorter pause after a wave is WIPED OUT - long enough
// for a win to land, short enough that the siege still feels relentless.
export const WAVE_INTERVAL_MS = 24000;
export const WAVE_REGROUP_MS = 7000;
export const MAX_WAVES = 6;

// What one completed bombardment run costs the world below.
export const BOMBARD_POP_LOSS = 0.14;   // fraction of population per run
export const BOMBARD_STABILITY_LOSS = 0.06;

/**
 * The home-defence fleet a civilization keeps. Spaceflight is gated by the
 * Kardashev tier: a Type 0 has not left its world and fields nothing at all.
 */
export function homeFleetFor(civ) {
  if (!civ || civ.extinct) return [];
  const extra = (civ.warlikeness ?? 0) > 0.6 ? 1 : 0;
  switch (civ.type) {
    case "Type1":
      return Array(1 + extra).fill("interceptor");
    case "Type2":
      return [...Array(2 + extra).fill("cruiser"), "interceptor"];
    case "Type3":
      return [...Array(2 + extra).fill("cruiser"), "guardian", "interceptor", "interceptor"];
    default:
      return []; // Type 0: planet-bound
  }
}

/**
 * The strike package a civilization throws at an enemy world, escalating with
 * each wave it has to send. Always contains at least one bomber - the reason
 * the player has to care.
 */
export function raidWaveFor(civ, wave = 0) {
  if (!civ || civ.extinct) return [];
  if (civ.type === "Type0" || civ.type === "Type1") return []; // can't project force
  const w = Math.max(0, Math.min(MAX_WAVES, wave));
  const bombers = civ.type === "Type3" ? 2 : 1;
  const escorts = 1 + Math.floor(w / 2) + (civ.type === "Type3" ? 1 : 0);
  const harassers = 1 + Math.floor(w / 2);
  return [
    ...Array(bombers).fill("bomber"),
    ...Array(escorts).fill("guardian"),
    ...Array(harassers).fill("interceptor"),
  ];
}

/**
 * What a ship should be doing right now.
 *   "raid"   - a besieger pressing its attack
 *   "hunt"   - hostile toward the player specifically
 *   "defend" - a home fleet with enemies in its sky
 *   "patrol" - nothing to do but hold station
 */
export function shipStance({ isRaider, underSiege, attitude, grudgeUntil, playerDistance, now }) {
  if (isRaider) return "raid";
  if (underSiege) return "defend";
  const provoked = now < (grudgeUntil ?? 0);
  if (provoked) return "hunt";
  if (attitude === "hostile" && playerDistance <= UNPROVOKED_RANGE) return "hunt";
  return "patrol";
}

/**
 * Who this ship shoots at, given what's in reach. Pure so the tactical rules
 * are testable without a scene.
 *
 * `candidates` are { kind: "ship"|"player", x, y, ref }. `worldPos` is the
 * besieged world. Returns a candidate, a world target, or null.
 */
export function pickShipTarget(role, { candidates = [], worldPos = null, playerThreat = false } = {}) {
  const spec = SHIP_ROLES[role];
  if (!spec) return null;

  // Bombers have exactly one job and cannot be distracted from it.
  if (spec.targets === "world") {
    return worldPos ? { kind: "world", x: worldPos.x, y: worldPos.y } : null;
  }

  // Interceptors go for the player when the player is a legitimate threat,
  // and otherwise join the ship fight.
  if (spec.targets === "player" && playerThreat) {
    const player = candidates.find((c) => c.kind === "player");
    if (player) return player;
  }

  const ships = candidates.filter((c) => c.kind === "ship");
  const pool = playerThreat ? candidates : ships;
  if (pool.length === 0) return null;

  // Nearest by the distance the caller measured for us.
  return pool.reduce((a, b) => ((a.distance ?? Infinity) <= (b.distance ?? Infinity) ? a : b));
}

/** Which civilization is besieging this one, if any. */
export function besiegerOf(civId, activeWars = []) {
  const war = (activeWars || []).find((w) => w.a === civId || w.b === civId);
  if (!war) return null;
  return war.a === civId ? war.b : war.a;
}

/** Damage applied to a ship, shields first. Returns the new {hp, shields}. */
export function applyDamage({ hp, shields }, damage) {
  const absorbed = Math.min(shields, damage);
  return { hp: hp - (damage - absorbed), shields: shields - absorbed };
}
