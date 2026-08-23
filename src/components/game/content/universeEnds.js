// src/components/game/content/universeEnds.js
//
// How each way of dying is named, described, and staged.
//
// Deliberately free of three.js and React: the cinematic, the epitaph card and
// GameplayPage all need this, and only ONE of them should be paying for a 1MB
// rendering library. Keeping the data here is what lets the cinematic stay
// lazily loaded.
//
// The keys mirror endConditions.js on the server. A condition with no entry
// falls back rather than throwing - the server can add one before the client
// has art for it.

// Each death gets its own RHYTHM, not just its own motion. A big rip is short
// and violent; a heat death has to outstay its welcome slightly or it isn't a
// heat death. `curve` reshapes normalised time before the motion reads it:
//   > 1  starts slow and accelerates (something building)
//   < 1  starts fast and lingers (something petering out)
// `epitaphAt` is a fraction of the run, chosen per death so the words land on
// that death's turn rather than at a fixed clock time.
// `spin` is how fast the whole field turns - a lattice needs barely any (you
// have to be able to read it), a galaxy wants some, a dead one wants none.
//
// A NOTE ON `curve`, learned the hard way: extreme values create dead air at
// one end or the other. At curve 2.4, half the runtime has produced only 19%
// of the motion - the player watches nothing, then a rush. Below 1 it's the
// mirror: everything happens up front and the tail is empty. Both read as
// "this is broken", not "this is slow". Keep it inside roughly 0.85-1.6 and
// put the drama in the death's own phases instead, where it can be seen.
//
// What each death actually LOOKS like - its field and its motion - lives in
// content/deathScenes.js, keyed by `motionKind`.
//
// PRERENDERED FILMS. Set `video` on a death and it plays that instead of the
// procedural version (ui/UniverseEnding.jsx makes the choice per death, so the
// six can land one at a time). Files go in public/cinematics/ and are served
// as static assets - never bundled, and only the death that actually happens
// is ever downloaded.
//
//   video           absolute path from the site root, e.g. "/cinematics/x.mp4"
//   videoPoster     optional still shown while the first frame decodes
//   videoHasTitles  true if the film renders its own title/epitaph, which
//                   suppresses the text overlay
//   videoHasAudio   true if the film carries its own score - this UNMUTES it
//                   and you should then drop the synth cue for that death from
//                   audio.js, because two scores at once is worse than either
//
// `duration` must match the film's real length: it drives the failsafe that
// stops a stalled video from stranding the player.
export const END_SCENES = {
  "instability-collapse": {
    title: "Unravelled",
    line: "You could not hold it together. The structure you were keeping came apart, and the cosmos forgot how to be a cosmos.",
    motionKind: "unravel",
    resolveTo: "#0a0a0f",
    spin: 0.03,        // barely turns: you have to be able to read the lattice
    duration: 7.6,
    curve: 1.35,       // holds, then lets go - but never stops moving
    epitaphAt: 0.34,
    camera: { dolly: 7, shake: 0.5, drift: 0.12 },
  },
  "heat-death": {
    title: "Heat Death",
    line: "Everything that could happen, happened. What's left is warm, even, and permanently uneventful.",
    motionKind: "cool",
    resolveTo: "#04060c",
    spin: 0.018,       // nearly still - nothing is happening any more
    duration: 8.6,
    curve: 0.88,       // front-loaded, but the tail still has something in it
    epitaphAt: 0.3,
    camera: { dolly: 24, shake: 0, drift: 0.05 },   // pulls away into isolation
  },
  "stellar-death": {
    title: "The Dark Era",
    line: "The last star burned out. Nothing here will ever cast a shadow again.",
    motionKind: "snuff",
    resolveTo: "#050505",
    spin: 0.06,        // a galaxy still turning while its stars go out
    duration: 8.2,
    curve: 1.0,        // steady, indifferent
    epitaphAt: 0.38,
    camera: { dolly: 5, shake: 0, drift: 0.07 },
  },
  "big-rip": {
    title: "Torn Apart",
    line: "Expansion won. Galaxies, then stars, then atoms — pulled past the point where anything could hold on to anything else.",
    motionKind: "rip",
    resolveTo: "#f2eaff",
    spin: 0.045,
    duration: 6.0,
    curve: 1.55,       // the runaway - the steepest any of these should get
    epitaphAt: 0.26,
    camera: { dolly: -19, shake: 0.9, drift: 0.16 }, // driven INTO the tear
  },
  "big-crunch": {
    title: "Collapse",
    line: "It fell back into itself. Everything you built is inside a point again, exactly where it started.",
    motionKind: "crunch",
    resolveTo: "#ffffff",
    spin: 0.05,
    duration: 6.6,
    curve: 1.45,        // gravity: slow fall, hard landing
    epitaphAt: 0.3,
    camera: { dolly: -13, shake: 0.6, drift: 0.1 },  // falls in with everything
  },
  "maximum-entropy": {
    title: "Maximum Entropy",
    line: "No gradients. No difference between here and there. Nothing left that could be used to make anything happen.",
    motionKind: "diffuse",
    resolveTo: "#0b0a08",
    spin: 0.014,       // the stillest of all: nothing will ever change again
    duration: 8.0,
    curve: 0.9,        // smears out early, then settles the rest of the way
    epitaphAt: 0.34,
    camera: { dolly: 11, shake: 0, drift: 0.04 },
  },
};

const FALLBACK = {
  title: "Ended",
  line: "The universe you were keeping is over.",
  motionKind: "cool",
  resolveTo: "#05050a",
  spin: 0.02,
  duration: 7.5,
  curve: 1.0,
  epitaphAt: 0.32,
  camera: { dolly: 10, shake: 0, drift: 0.06 },
};

export const sceneFor = (endCondition) => END_SCENES[endCondition] || FALLBACK;

// An ended universe is a permanent state the player may reopen many times. The
// cinematic is a moment, not a screensaver - it plays once per universe.
const seenKey = (universeId) => `ev:end-seen:${universeId}`;

export function hasSeenEnding(universeId) {
  try {
    return localStorage.getItem(seenKey(universeId)) === "1";
  } catch {
    return false; // private mode / storage disabled: just play it
  }
}

export function markEndingSeen(universeId) {
  try {
    localStorage.setItem(seenKey(universeId), "1");
  } catch {
    // Non-fatal - worst case they see a 7-second cinematic twice.
  }
}
