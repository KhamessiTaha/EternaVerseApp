// src/components/game/situations/situationModel.js
//
// The rhythm of SITUATIONS: the large beat.
//
// The win condition sits ~400 simulation steps away and civilizations don't
// appear until ~130, against browser sessions of 20-40 minutes. Missions
// papered over that gap with metric counters - "Contain 5 anomalies" is a
// chore you complete by accident, not an event you remember.
//
// A Situation is the opposite of a counter. It is TIMED, LOCATED, and
// INTERRUPTIBLE, it has a stated payoff, and it happens TO you rather than
// being ticked off. One every 15-20 minutes of play, so a session that never
// reaches Ascension still contains three or four things worth telling someone
// about.
//
// Deliberately built from what already exists:
//   cascade   a much larger, deadlined SurgeSystem event
//   distress  an existing siege promoted into a headline with a countdown
//   windfall  a CosmicEventSystem object with a claim window
//
// Nothing here spawns anything - it decides WHAT and WHEN. SituationDirector
// does the staging, so all the scheduling rules stay pure and testable.

// Pacing. The first lands early because a new player shouldn't wait 15 minutes
// to learn that this game has events in it; after that it settles into cadence.
export const FIRST_SITUATION_MS = 7 * 60 * 1000;
export const INTERVAL_MS = [15 * 60 * 1000, 20 * 60 * 1000];

// After one ends, never start another immediately - the quiet between them is
// what makes them read as events rather than as a difficulty setting.
export const MIN_GAP_MS = 4 * 60 * 1000;

// A situation the player never engaged with shouldn't have been offered.
// Repeats of the same kind are pushed down so the rhythm stays varied.
export const REPEAT_WEIGHT_PENALTY = 0.25;

/**
 * The catalog.
 *
 * `eligible(ctx)` decides whether the world can support this situation right
 * now. Returning false is normal and expected - a distress call needs a siege
 * to actually exist, and inventing one client-side would be a lie.
 *
 * `durationMs` is the deadline the player is shown and judged against.
 */
export const SITUATIONS = [
  {
    id: "cascade",
    kind: "cascade",
    title: "CASCADE FAILURE",
    // The brief: what you must do, in one line, on the banner.
    brief: (n) => `Contain ${n} tears before the fabric gives`,
    payoff: "Stability restored · research bonus",
    weight: 1.0,
    durationMs: 4 * 60 * 1000,
    // Scales with how bad things already are - a fraying universe cascades
    // harder, which is the honest read of the mechanic.
    tearsFor: (stability) => 6 + Math.round((1 - clamp01(stability)) * 4), // 6..10
    eligible: (ctx) =>
      ctx.scale === "galactic" && !ctx.surgeActive && !ctx.minigameActive,
  },
  {
    id: "distress",
    kind: "distress",
    title: "DISTRESS CALL",
    brief: (name) => `${name} is under siege — break it before the world dies`,
    payoff: "A people saved · research · they remember",
    // Weighted highest because it's the best content in the game and the one
    // most likely to be missed entirely.
    weight: 1.6,
    durationMs: 6 * 60 * 1000,
    // Promotes a siege that ALREADY exists rather than staging one: a client
    // cannot invent a war, and a fake distress call is worse than none.
    eligible: (ctx) => ctx.besiegedCount > 0,
  },
  {
    id: "windfall",
    kind: "windfall",
    title: "ANOMALOUS SIGNATURE",
    brief: () => "Reach it and claim the reading before it decays",
    payoff: "Substantial research",
    // The breather. Lowest stakes, lowest weight - it exists so the rhythm
    // isn't relentlessly a crisis.
    weight: 0.7,
    durationMs: 3 * 60 * 1000,
    eligible: (ctx) => ctx.scale === "galactic" && !ctx.eventActive,
  },
];

// `|| 0` not `?? 0`: Number() returns NaN, never nullish, so a nullish
// coalesce would let NaN straight through into tearsFor().
const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));

export const situationById = (id) => SITUATIONS.find((s) => s.id === id) || null;

/** When the next situation should fire, given now and what came before. */
export function scheduleNext(now, { isFirst = false, rng = Math.random } = {}) {
  if (isFirst) return now + FIRST_SITUATION_MS;
  const [lo, hi] = INTERVAL_MS;
  return now + lo + rng() * (hi - lo);
}

/**
 * Choose a situation for the current world state, or null if none fit.
 *
 * Returning null is a normal outcome - the director simply tries again shortly
 * rather than forcing something the world can't support.
 */
export function pickSituation(ctx, { rng = Math.random, lastId = null } = {}) {
  const pool = SITUATIONS.filter((s) => {
    try {
      return s.eligible(ctx);
    } catch {
      return false; // a malformed ctx must never wedge the rhythm
    }
  });
  if (pool.length === 0) return null;

  const weights = pool.map((s) => (s.id === lastId ? s.weight * REPEAT_WEIGHT_PENALTY : s.weight));
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return null;

  let roll = rng() * total;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

/**
 * Progress of a running situation, for the banner.
 * `remainingMs` is what the player sees counting down.
 */
export function situationProgress(active, now) {
  if (!active) return null;
  const elapsed = now - active.startedAt;
  const remainingMs = Math.max(0, active.durationMs - elapsed);
  return {
    id: active.id,
    kind: active.kind,
    title: active.title,
    brief: active.brief,
    payoff: active.payoff,
    remainingMs,
    // 1 -> 0 as the deadline approaches, for a bar.
    fraction: active.durationMs > 0 ? remainingMs / active.durationMs : 0,
    expired: remainingMs <= 0,
    x: active.x,
    y: active.y,
    // {done,total} when the situation is countable, else null. "Contain 6
    // tears" with no running count is a demand you cannot tell you are
    // meeting - which is most of what made these read as background noise.
    progress: active.progress?.() ?? null,
  };
}

const ARROWS = ["→", "↘", "↓", "↙", "←", "↖", "↑", "↗"];

/**
 * Which way, and how far.
 *
 * A situation already knows where it is - staging returns x/y - but the player
 * was only ever told WHAT and HOW LONG. A deadline you can't walk toward is
 * noise: it demands something without handing you a way to act on it. This is
 * the handle.
 *
 * Pure, so the compass can be tested without a scene.
 */
export function bearingTo(from, to) {
  if (!from || !to || !Number.isFinite(to.x) || !Number.isFinite(to.y)) return null;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  // Screen space: +y is down, so this reads the same way the world looks.
  const idx = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
  return { distance, arrow: ARROWS[((idx % 8) + 8) % 8] };
}

/** Distance as something readable at a glance: "820", "1.4k", "12k". */
export function formatDistance(d) {
  if (!Number.isFinite(d) || d < 0) return "";
  if (d < 1000) return `${Math.round(d)}`;
  if (d < 10000) return `${(d / 1000).toFixed(1)}k`;
  return `${Math.round(d / 1000)}k`;
}

/** mm:ss for the banner clock. */
export function formatClock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
