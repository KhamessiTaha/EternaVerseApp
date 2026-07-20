import { CHUNK_SIZE } from './constants';

export const getChunkCoords = (x, y) => ({
  chunkX: Math.floor(x / CHUNK_SIZE),
  chunkY: Math.floor(y / CHUNK_SIZE),
});

export const getChunkKey = (x, y) => `${x}:${y}`;

export const formatNumber = (num) => {
  if (!num) return '0';
  if (num < 1e3) return Math.floor(num).toLocaleString();
  if (num < 1e6) return (num / 1e3).toFixed(1) + 'K';
  if (num < 1e9) return (num / 1e6).toFixed(1) + 'M';
  if (num < 1e12) return (num / 1e9).toFixed(2) + 'B';
  return num.toExponential(1);
};

// Movement/tween tuning constants below were authored against a 60fps frame,
// i.e. ~16.667ms per update() call. These helpers rescale a "per-frame" rate
// by actual elapsed time (Phaser's update(time, delta) delta, in ms) so
// movement feels the same regardless of the player's actual frame rate.
const REF_FRAME_MS = 1000 / 60;

// For values that accumulate linearly per frame (acceleration, resource drain/recharge).
export const scaleByDelta = (perFrameValue, delta) => perFrameValue * (delta / REF_FRAME_MS);

// For values that decay multiplicatively per frame (e.g. velocity *= 0.9 each frame).
export const decayByDelta = (currentValue, perFrameDecayFactor, delta) =>
  currentValue * Math.pow(perFrameDecayFactor, delta / REF_FRAME_MS);

// For Phaser.Math.Linear(current, target, t) calls where t was tuned per-frame.
export const lerpFactorByDelta = (perFrameLerpFactor, delta) =>
  1 - Math.pow(1 - perFrameLerpFactor, delta / REF_FRAME_MS);

// Minigame performance grading - single source of truth for accuracy -> grade
// -> reward-multiplier, shared by MiniGameScene (display) and GameplayPage
// (what actually gets sent to the backend / applied to procedural anomalies)
// so a grade always means the same reward regardless of where it's computed.
export const GRADE_TIERS = [
  { min: 95, grade: 'S', stabilityMultiplier: 1.3 },
  { min: 85, grade: 'A', stabilityMultiplier: 1.15 },
  { min: 70, grade: 'B', stabilityMultiplier: 1.0 },
  { min: 50, grade: 'C', stabilityMultiplier: 0.85 },
  { min: 0, grade: 'F', stabilityMultiplier: 0 },
];

export const getGradeForAccuracy = (accuracy) =>
  GRADE_TIERS.find((t) => accuracy >= t.min) || GRADE_TIERS[GRADE_TIERS.length - 1];

// How a civ regards the player - mirrors the backend's contactSystem
// civAttitude exactly (the server is authoritative; this renders beacons,
// missiles, and panel copy). Keep the two in sync.
export const civAttitude = (civ) => {
  const r = civ.relationship || 0;
  if ((civ.type === "Type0" || civ.type === "Type1") && r >= 0.45) return "worship";
  if (r >= 0.25) return "friendly";
  if (r <= -0.35 || ((civ.warlikeness ?? 0) > 0.75 && r < 0)) return "hostile";
  if (r <= -0.15 || (civ.warlikeness ?? 0) > 0.6) return "wary";
  return "neutral";
};

// Deterministic civilization display designation (e.g. "KX-482") - mirrors
// the backend's utils/contactSystem.js civDesignation so Chronicle entries
// and the First Contact panel agree on names.
export const civDesignation = (id) => {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h = Math.abs(h);
  const letters = String.fromCharCode(65 + (h % 26)) + String.fromCharCode(65 + (Math.floor(h / 26) % 26));
  return `${letters}-${100 + (h % 900)}`;
};