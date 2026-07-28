// src/components/game/firstSession.js
//
// The Genesis Directive: a single, ordered arc that inducts a brand-new
// warden into the game's core loop - take the helm, scan, DESCEND a cosmic
// scale, make first contact, choose a people to shepherd. It exists because
// EternaVerse is deliberately deep; the loop is not (move -> scan -> descend
// -> contact -> champion), and a new player needs to be shown that spine once,
// in order, before the depth is legible.
//
// Module singleton, same pattern as narrator/settings: Phaser systems post the
// motion beats (move, descend) via markBeat(); React derives the state beats
// (scan, contact, champion) from the universe via syncUniverse(). The overlay
// (GenesisDirective.jsx) renders whatever is current. Completion is persisted
// per-universe in localStorage so the arc never returns - and veterans opening
// an already-progressed universe are quietly opted out, never tutorialized.

export const GENESIS_BEATS = [
  {
    id: 'move',
    label: 'Take the helm',
    hint: 'W / A · D',
    instruction: 'Thrust and turn. You are a vessel the size of a thought, adrift between galaxies.',
  },
  {
    id: 'scan',
    label: 'Catalog first light',
    hint: 'V',
    instruction: 'Drift up to a galaxy and scan it. Every object you name becomes research - and a Codex entry.',
  },
  {
    id: 'descend',
    label: 'Descend a scale',
    hint: 'approach · descend',
    instruction: 'A galaxy is not a dot. Enter one to fold down into its stars - then a star, into its worlds.',
  },
  {
    id: 'contact',
    label: 'Make first contact',
    hint: 'G',
    instruction: 'Somewhere below, a civilization is watching the sky. Hail it. They will never forget the day you spoke.',
  },
  {
    id: 'champion',
    label: 'Choose your people',
    hint: '★',
    instruction: 'Champion one species and their whole story becomes yours to shepherd - from first fire to the stars.',
  },
];

const STORAGE_PREFIX = 'eterna:genesis:';
const storageKey = (uid) => `${STORAGE_PREFIX}${uid}`;

const readDone = (uid) => {
  try {
    return localStorage.getItem(storageKey(uid)) === 'done';
  } catch {
    return false;
  }
};
const writeDone = (uid) => {
  try {
    localStorage.setItem(storageKey(uid), 'done');
  } catch {
    /* private mode / quota - the arc simply won't be remembered as complete */
  }
};

let listeners = new Set();
const state = {
  active: false, // arc is running for the current universe
  universeId: null,
  done: new Set(), // completed beat ids
  finished: false, // every beat complete (drives the closing flourish)
};

const emit = () => {
  const snapshot = {
    active: state.active,
    finished: state.finished,
    done: new Set(state.done),
  };
  listeners.forEach((fn) => fn(snapshot));
};

export function onGenesis(fn) {
  listeners.add(fn);
  fn({ active: state.active, finished: state.finished, done: new Set(state.done) });
  return () => listeners.delete(fn);
}

/** The current beat: first one not yet completed, or null when finished. */
export function currentBeat() {
  return GENESIS_BEATS.find((b) => !state.done.has(b.id)) || null;
}

// A universe is "fresh" - a genuine first session - only if the player has
// done none of the things the arc teaches. Anyone past that point (a returning
// warden) is opted out silently so we never tutorialize a veteran.
function isFresh(universe) {
  if (!universe) return false;
  const noScans = (universe.discoveries || []).length === 0;
  const noChosen = !universe.chosenCivId;
  const noContact = !(universe.civilizations || []).some((c) => c.observed || (c.relationship || 0) !== 0);
  const noIntervention = (universe.metrics?.playerInterventions || 0) === 0;
  return noScans && noChosen && noContact && noIntervention;
}

/**
 * Decide, on universe load, whether the arc should run. Idempotent per id.
 * Returns true if the arc is (or became) active - the caller may narrate the
 * Curator's induction line on a true-transition.
 */
export function considerStart(universe) {
  const uid = universe?._id || universe?.id;
  if (!uid) return false;

  // Same universe already evaluated - nothing changes here.
  if (state.universeId === uid) return state.active;

  state.universeId = uid;
  state.done = new Set();
  state.finished = false;

  if (readDone(uid) || !isFresh(universe)) {
    // Veteran or already-completed: opt out permanently and stay silent.
    writeDone(uid);
    state.active = false;
    emit();
    return false;
  }

  state.active = true;
  emit();
  return true;
}

/** Mark a beat complete (from Phaser: 'move', 'descend'). No-op once done. */
export function markBeat(id) {
  if (!state.active || state.done.has(id)) return;
  if (!GENESIS_BEATS.some((b) => b.id === id)) return;
  state.done.add(id);
  if (state.done.size === GENESIS_BEATS.length) state.finished = true;
  emit();
}

/** Derive the state beats from the live universe (called on every refresh). */
export function syncUniverse(universe) {
  if (!state.active || !universe) return;
  if ((universe.discoveries || []).length > 0) markBeat('scan');
  if ((universe.civilizations || []).some((c) => c.observed || (c.relationship || 0) !== 0)) {
    markBeat('contact');
  }
  if (universe.chosenCivId) markBeat('contact'); // championing implies contact
  if (universe.chosenCivId) markBeat('champion');
}

/** Dismiss the arc for good - completion flourish finished, or player skipped. */
export function dismissGenesis() {
  if (state.universeId) writeDone(state.universeId);
  state.active = false;
  emit();
}
