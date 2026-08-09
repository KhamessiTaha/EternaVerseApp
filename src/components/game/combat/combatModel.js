// src/components/game/combat/combatModel.js
//
// Pure, deterministic math for the combat pillar - the single tuning surface
// (the selfModel/stabilityConfig pattern). No Phaser, no I/O: weapon tables,
// the heat state machine, aim-assist target selection, and rift-siege
// composition all unit-test under node --test. CombatSystem/RiftSpawnSystem
// are the Phaser adapters over this.

// --- Player weapon ---------------------------------------------------------

// Per-hull weapon character (mirrors the HULL_STATS tradeoff philosophy:
// every gun is a feel, not a straight upgrade). damage per bolt, minimum ms
// between shots, heat added per shot, bolt speed px/s.
export const WEAPONS = {
  interceptor: { damage: 4, fireIntervalMs: 260, heatPerShot: 7,  boltSpeed: 620 },
  cutter:      { damage: 4, fireIntervalMs: 240, heatPerShot: 7,  boltSpeed: 620 },
  falcon:      { damage: 3, fireIntervalMs: 150, heatPerShot: 9,  boltSpeed: 700 },
  cruiser:     { damage: 4, fireIntervalMs: 280, heatPerShot: 6,  boltSpeed: 600 },
  bastion:     { damage: 7, fireIntervalMs: 460, heatPerShot: 10, boltSpeed: 540 },
  hauler:      { damage: 5, fireIntervalMs: 380, heatPerShot: 8,  boltSpeed: 560 },
  tachyon:     { damage: 3, fireIntervalMs: 170, heatPerShot: 8,  boltSpeed: 760 },
  vanguard:    { damage: 5, fireIntervalMs: 260, heatPerShot: 6,  boltSpeed: 640 },
};

export const weaponFor = (hullId) => WEAPONS[hullId] ?? WEAPONS.interceptor;

// Heat: every shot adds heat; heat cools continuously; hitting max locks the
// gun until it cools below the unlock threshold (the boost-lockout pattern,
// so the rhythm is already familiar to the player's hands).
export const HEAT_MAX = 100;
export const HEAT_COOL_PER_SEC = 26;
export const HEAT_UNLOCK = 35;

export function applyCooling(state, dtMs) {
  const heat = Math.max(0, state.heat - HEAT_COOL_PER_SEC * (dtMs / 1000));
  const locked = state.locked && heat > HEAT_UNLOCK;
  return { ...state, heat, locked };
}

export function tryFire(state, weapon, nowMs) {
  if (state.locked) return { state, fired: false };
  if (nowMs - state.lastFiredAt < weapon.fireIntervalMs) return { state, fired: false };
  const heat = Math.min(HEAT_MAX, state.heat + weapon.heatPerShot);
  return {
    state: { heat, locked: heat >= HEAT_MAX, lastFiredAt: nowMs },
    fired: true,
  };
}

// Aim assist: the nearest target inside a cone around the nose. Bolts still
// travel in straight lines - assist only picks what the nose direction bends
// toward, so aiming stays a skill, just a forgiving one.
export const ASSIST_RANGE = 900;
export const ASSIST_CONE_RAD = 0.6; // ~34 degrees either side

export function pickTarget(origin, targets, { range = ASSIST_RANGE, coneRad = ASSIST_CONE_RAD } = {}) {
  let best = null;
  let bestD = range;
  for (const t of targets) {
    const dx = t.x - origin.x;
    const dy = t.y - origin.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d >= bestD) continue;
    let off = Math.atan2(dy, dx) - origin.noseAngle;
    while (off > Math.PI) off -= Math.PI * 2;
    while (off < -Math.PI) off += Math.PI * 2;
    if (Math.abs(off) > coneRad) continue;
    bestD = d;
    best = t;
  }
  return best;
}

// --- Rift-spawn ------------------------------------------------------------

// The escort a Critical anomaly fields, by severity. Below 4 the fabric
// hasn't torn far enough to crawl out of.
export function siegeCompositionFor(severity) {
  const sev = Math.floor(severity || 0);
  if (sev < 4) return [];
  if (sev === 4) return ["stinger", "stinger", "tether"];
  return ["stinger", "stinger", "stinger", "tether", "tether"];
}

export const RIFT_STATS = {
  // Fast melee swarm: orbits its anomaly until you get close, then darts in.
  stinger: {
    hp: 10,
    speed: 240,
    turn: 3.4,            // rad/s pursuit steering
    contactDamage: 9,
    radius: 14,
    aggroRange: 950,
    touchCooldownMs: 900, // per-entity, so a graze isn't instant death
    orbitRadius: 220,
    color: 0xe0524a,
  },
  // Anchored artillery: holds its orbit and shells you with dumb-fire bolts.
  tether: {
    hp: 26,
    orbitRadius: 150,
    orbitSpeed: 0.35,     // rad/s around the anomaly
    boltDamage: 8,
    boltSpeed: 210,
    boltLifespanMs: 5200,
    fireIntervalMs: 2600,
    range: 1050,
    radius: 18,
    color: 0x8b7bd8,
  },
};
