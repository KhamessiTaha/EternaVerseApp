// src/components/game/content/curatorEmotions.js
//
// The Curator's emotional range. Each emotion is a full "pose" for the Eye -
// not just a colour, but how wide the lids sit, how the brow tilts, how far the
// pupil dilates, how fast it pulses and darts, whether it sparkles (wonder) or
// wells up (grief) - plus the pitch/timbre of its voice and how fast it speaks.
// The overlay reads these; narrator.js picks the id (deriveMood). Keep the ids
// in sync with narrator.js's inference.
//
// Lid values: 0 = fully open, 1 = fully shut (fraction of the eye covered).
// brow: degrees; POSITIVE tilts the inner ends DOWN (furrow: concern/anger),
// NEGATIVE lifts them (surprise/wonder). Times are in seconds.

export const EMOTIONS = {
  // Baseline: calm, ancient, faintly amused. The default voice.
  dry: {
    color: "#57c7d4", label: "The Curator",
    pupil: 1.0, lidTop: 0.14, lidBottom: 0.06, brow: 0, browShow: false,
    pulse: 2.4, pulseAmp: 0.08, blink: 6.5, drift: 7, shimmer: null,
    typeSpeed: 26, blip: { freq: 430, type: "triangle" },
  },
  // Dry wit landing - a relaxed, smiling squint (bottom lid up).
  amused: {
    color: "#f0c674", label: "The Curator",
    pupil: 1.05, lidTop: 0.12, lidBottom: 0.40, brow: -4, browShow: true,
    pulse: 2.2, pulseAmp: 0.09, blink: 5, drift: 6, shimmer: null,
    typeSpeed: 24, blip: { freq: 520, type: "triangle" },
  },
  // Leaning in - wide, dilated, darting, brow raised.
  curious: {
    color: "#5fd0c0", label: "The Curator",
    pupil: 1.32, lidTop: 0.0, lidBottom: 0.0, brow: -8, browShow: true,
    pulse: 2.0, pulseAmp: 0.10, blink: 4.5, drift: 3.2, shimmer: null,
    typeSpeed: 24, blip: { freq: 500, type: "triangle" },
  },
  // Alarm - wide, furrowed, fast pulse, rapid darting, sharp square voice.
  warning: {
    color: "#e0524a", label: "The Curator · alert",
    pupil: 1.22, lidTop: 0.0, lidBottom: 0.0, brow: 12, browShow: true,
    pulse: 0.8, pulseAmp: 0.15, blink: 3, drift: 1.9, shimmer: null,
    typeSpeed: 18, blip: { freq: 610, type: "square" },
  },
  // Sombre - heavy half-closed lid, downcast, slow, a welling tear.
  grim: {
    color: "#9a8fb0", label: "The Curator",
    pupil: 0.8, lidTop: 0.5, lidBottom: 0.12, brow: 7, browShow: true,
    pulse: 3.4, pulseAmp: 0.06, blink: 8, drift: 10, shimmer: "tear",
    typeSpeed: 34, blip: { freq: 240, type: "sawtooth" },
  },
  // Wonder - wide open, hugely dilated, transfixed, sparkling.
  awe: {
    color: "#f5cf7a", label: "The Curator",
    pupil: 1.5, lidTop: 0.0, lidBottom: 0.0, brow: -10, browShow: true,
    pulse: 2.8, pulseAmp: 0.13, blink: 9, drift: 12, shimmer: "sparkle",
    typeSpeed: 30, blip: { freq: 620, type: "triangle" },
  },
  // Irritation - narrowed glare (both lids in), hard furrow, low square voice.
  annoyed: {
    color: "#e0913a", label: "The Curator",
    pupil: 0.72, lidTop: 0.42, lidBottom: 0.28, brow: 14, browShow: true,
    pulse: 1.2, pulseAmp: 0.10, blink: 5, drift: 3.5, shimmer: null,
    typeSpeed: 22, blip: { freq: 300, type: "square" },
  },
  // Warmth / approval - soft, gentle smile-squint, brow eased.
  warm: {
    color: "#b6d46a", label: "The Curator",
    pupil: 1.1, lidTop: 0.16, lidBottom: 0.34, brow: -3, browShow: true,
    pulse: 2.4, pulseAmp: 0.09, blink: 6, drift: 6.5, shimmer: null,
    typeSpeed: 26, blip: { freq: 540, type: "triangle" },
  },
};

export const emotionOf = (id) => EMOTIONS[id] || EMOTIONS.dry;
