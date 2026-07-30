// src/components/game/wardenProgress.js
//
// The meta-goal that spans universes. EternaVerse's main goal is The Ascension:
// raise a people to Type III before your universe dies. Completing it earns a
// permanent Warden rank, stored GLOBALLY (the warden is eternal, like the
// Curator's rapport) - so finishing one universe gives you a reason to begin
// the next. This is the long arc that turns "a fun toy" into "a game with a
// point you keep chasing."
const KEY = "eterna:warden";

const RANKS = [
  { min: 0, title: "Untested Warden" },
  { min: 1, title: "Keeper of One" },
  { min: 2, title: "Shepherd of Worlds" },
  { min: 4, title: "Shepherd of Stars" },
  { min: 7, title: "Architect of Ages" },
  { min: 12, title: "The Eternal" },
];

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "null");
    if (s && typeof s.ascensions === "number") return s;
  } catch { /* first run / private mode */ }
  return { ascensions: 0 };
}
function save(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

export function rankFor(ascensions) {
  let rank = RANKS[0];
  for (const r of RANKS) if (ascensions >= r.min) rank = r;
  const next = RANKS.find((r) => r.min > ascensions) || null;
  return { title: rank.title, next: next ? { title: next.title, at: next.min } : null };
}

/** Current warden meta-state (cross-universe). */
export function getWarden() {
  const { ascensions } = load();
  return { ascensions, ...rankFor(ascensions) };
}

/** Record a completed Ascension (a chosen species reached Type III). */
export function recordAscension() {
  const state = load();
  state.ascensions += 1;
  save(state);
  return getWarden();
}
