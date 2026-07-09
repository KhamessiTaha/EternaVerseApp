// src/components/game/settings.js
//
// Client-side game settings: device/player preferences (input layout,
// sensitivity, effect toggles) - deliberately NOT universe state, so they
// live in localStorage rather than on the server, and apply across all of
// the player's universes on this device.
//
// Phaser systems read via getSettings() (a module-variable lookup, safe to
// call per-frame); React reads the same and writes through updateSettings().

const STORAGE_KEY = "eternaverse:settings";

export const DEFAULT_SETTINGS = {
  keyboardLayout: "azerty", // "azerty" (ZQSD, the original bindings) | "qwerty" (WASD)
  turnSensitivity: 1.0,     // 0.5 - 2.0 multiplier on rotation accel + max turn rate
  cameraShake: true,        // all camera shake effects (boost rumble, hits, breaches)
  trailQuality: "high",     // "off" | "low" | "high" - ship engine trail particles
  masterVolume: 0.8,        // 0 - 1, scales everything
  sfxVolume: 1.0,           // 0 - 1, one-shot effects + engine hum
  ambientVolume: 0.5,       // 0 - 1, the deep-space drone
};

function load() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(STORAGE_KEY)) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

let settings = load();
const listeners = new Set();

export const getSettings = () => settings;

export function updateSettings(patch) {
  settings = { ...settings, ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage unavailable (private mode etc.) - settings still apply for this session
  }
  listeners.forEach((fn) => fn(settings));
  return settings;
}

export function resetSettings() {
  return updateSettings({ ...DEFAULT_SETTINGS });
}

// Subscribe to changes (returns an unsubscribe function). Used by systems
// that need to react to a change rather than poll, e.g. rebinding keys.
export function onSettingsChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
