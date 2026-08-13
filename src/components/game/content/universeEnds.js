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

export const END_SCENES = {
  "instability-collapse": {
    title: "Unravelled",
    line: "You could not hold it together. The structure you were keeping came apart, and the cosmos forgot how to be a cosmos.",
    motionKind: "unravel",
    resolveTo: "#0a0a0f",
  },
  "heat-death": {
    title: "Heat Death",
    line: "Everything that could happen, happened. What's left is warm, even, and permanently uneventful.",
    motionKind: "cool",
    resolveTo: "#04060c",
  },
  "stellar-death": {
    title: "The Dark Era",
    line: "The last star burned out. Nothing here will ever cast a shadow again.",
    motionKind: "snuff",
    resolveTo: "#050505",
  },
  "big-rip": {
    title: "Torn Apart",
    line: "Expansion won. Galaxies, then stars, then atoms — pulled past the point where anything could hold on to anything else.",
    motionKind: "rip",
    resolveTo: "#f2eaff",
  },
  "big-crunch": {
    title: "Collapse",
    line: "It fell back into itself. Everything you built is inside a point again, exactly where it started.",
    motionKind: "crunch",
    resolveTo: "#ffffff",
  },
  "maximum-entropy": {
    title: "Maximum Entropy",
    line: "No gradients. No difference between here and there. Nothing left that could be used to make anything happen.",
    motionKind: "diffuse",
    resolveTo: "#0b0a08",
  },
};

const FALLBACK = {
  title: "Ended",
  line: "The universe you were keeping is over.",
  motionKind: "cool",
  resolveTo: "#05050a",
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
