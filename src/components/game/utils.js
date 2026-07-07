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