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
  flightModel: "newtonian", // "newtonian" (full inertia) | "assisted" (lateral grip + auto-brake)
  turnSensitivity: 1.0,     // 0.2 - 2.0 multiplier on rotation accel + max turn rate
  cameraShake: true,        // all camera shake effects (boost rumble, hits, breaches)
  graphicsQuality: "high", // "low" | "medium" | "high" - overall rendering detail
  trailQuality: "high",     // "off" | "low" | "high" - ship engine trail particles
  masterVolume: 0.8,        // 0 - 1, scales everything
  sfxVolume: 1.0,           // 0 - 1, one-shot effects + engine hum
  ambientVolume: 0.5,       // 0 - 1, the deep-space drone
  minimapSize: "medium",    // "small" | "medium" | "large" - radar diameter, see MINIMAP_SIZES
  postFx: true,             // bloom + vignette post-processing (WebGL only)
};

// Radar diameter in pixels per minimapSize setting - shared by MinimapPanel
// (rendering) and SettingsPanel (the picker).
export const MINIMAP_SIZES = { small: 76, medium: 104, large: 140 };

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
  // Isolate each listener: one throwing (e.g. a stale/torn-down subscriber)
  // must never stop the rest from running, or block this function's own
  // return value from reaching the caller - that's exactly what let a
  // single bad InputSystem instance silently break every settings panel.
  listeners.forEach((fn) => {
    try {
      fn(settings);
    } catch (err) {
      console.error("settings listener failed:", err);
    }
  });
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
