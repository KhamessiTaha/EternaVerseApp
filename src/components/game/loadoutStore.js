// src/components/game/loadoutStore.js
//
// Module-level ship loadout, same singleton pattern as settings.js. The
// running Phaser scene POLLS this each frame and re-applies when it
// changes - no React->Phaser method calls, no stale scene refs, immune to
// HMR keeping an old scene class alive. Seeded from the server by
// PhaserGame on mount; updated by HangarPanel on save.

let loadout = { hull: "interceptor", shipColor: "#dfa73f" };

export const getLoadoutLocal = () => loadout;

export function setLoadoutLocal(hull, shipColor) {
  loadout = { hull, shipColor };
}
