// src/components/game/tutorialGate.js
//
// The guided opening (First Light anomaly + Genesis Directive checklist) is a
// TUTORIAL - it should run once for a new player, not on every new universe.
// This gates it per ACCOUNT (keyed by the signed-in user id, falling back to a
// browser-global key), so a returning warden's fresh universes skip the hand-
// holding. A "Replay Tutorial" menu action resets it.
const base = "eterna:tutorial";

function userKey() {
  try {
    const u = JSON.parse(localStorage.getItem("user") || "null");
    const id = u?.userId || u?._id || u?.id;
    return id ? `${base}:${id}` : `${base}:local`;
  } catch {
    return `${base}:local`;
  }
}

export function isTutorialDone() {
  try {
    return localStorage.getItem(userKey()) === "done";
  } catch {
    return false;
  }
}

export function markTutorialDone() {
  try {
    localStorage.setItem(userKey(), "done");
  } catch {
    /* private mode - tutorial just won't be remembered as complete */
  }
}

export function resetTutorial() {
  try {
    localStorage.removeItem(userKey());
  } catch {
    /* ignore */
  }
}
