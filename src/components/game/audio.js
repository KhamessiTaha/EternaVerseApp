// src/components/game/audio.js
//
// Procedural Web Audio engine - no audio assets; every sound is synthesized.
// Module singleton in the same style as settings.js: Phaser systems and
// React components import the same instance.
//
// Signal graph: voices -> sfxBus / ambientBus -> master -> destination.
// Bus gains track the settings store live. Browsers keep an AudioContext
// suspended until a user gesture, so everything is created lazily and a
// one-time pointer/key listener resumes it; sounds requested before that
// are simply dropped (never queued).
import { getSettings, onSettingsChange } from "./settings.js";

let ctx = null;
let master = null;
let sfxBus = null;
let ambientBus = null;
let noiseBuffer = null;
let engine = null;   // looping ship-thrust hum, driven by updateEngine()
let ambient = null;  // deep-space drone
let unlockBound = false;

function applyVolumes() {
  if (!ctx) return;
  const s = getSettings();
  master.gain.value = s.masterVolume ?? 0.8;
  sfxBus.gain.value = s.sfxVolume ?? 1;
  ambientBus.gain.value = s.ambientVolume ?? 0.5;
}

function build() {
  if (ctx) return true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;

  ctx = new AC();
  master = ctx.createGain();
  master.connect(ctx.destination);
  sfxBus = ctx.createGain();
  sfxBus.connect(master);
  ambientBus = ctx.createGain();
  ambientBus.connect(master);

  // 1s of shared white noise - looped for the engine hum, one-shot for impacts
  noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  applyVolumes();
  onSettingsChange(applyVolumes);
  return true;
}

function ensureUnlockListeners() {
  if (unlockBound) return;
  unlockBound = true;
  const unlock = () => {
    if (!build()) return;
    ctx.resume();
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
}

function ready() {
  ensureUnlockListeners();
  if (!build()) return false;
  if (ctx.state === "suspended") ctx.resume();
  return ctx.state === "running";
}

// ---------------------------------------------------------------- synthesis

function tone({ freq = 440, end = null, type = "sine", dur = 0.12, vol = 0.2, at = 0, attack = 0.005 }) {
  const t0 = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (end) osc.frequency.exponentialRampToValueAtTime(Math.max(1, end), t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(sfxBus);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function burst({ dur = 0.2, vol = 0.25, filter = 800, at = 0 }) {
  const t0 = ctx.currentTime + at;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = filter;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f);
  f.connect(g);
  g.connect(sfxBus);
  src.start(t0);
  src.stop(t0 + dur + 0.05);
}

function notes(freqs, { spacing = 0.09, dur = 0.14, type = "triangle", vol = 0.18 } = {}) {
  freqs.forEach((f, i) => tone({ freq: f, dur, type, vol, at: i * spacing }));
}

// Discovery jingles grow with rarity - a common find is a two-note blip,
// an exceptional one is a proper five-note fanfare.
const DISCOVERY_ARPEGGIOS = {
  common: [523.25, 783.99],
  uncommon: [523.25, 659.25, 880],
  rare: [587.33, 739.99, 987.77, 1174.66],
  exceptional: [523.25, 659.25, 783.99, 1046.5, 1318.51],
};

const SFX = {
  uiOpen: () => tone({ freq: 520, end: 760, dur: 0.09, vol: 0.12 }),
  uiClose: () => tone({ freq: 760, end: 520, dur: 0.09, vol: 0.1 }),
  uiClick: () => tone({ freq: 900, type: "square", dur: 0.03, vol: 0.07 }),
  uiDenied: () => tone({ freq: 220, end: 150, type: "square", dur: 0.16, vol: 0.12 }),
  alert: () => tone({ freq: 620, end: 500, dur: 0.13, vol: 0.13 }),
  scanStart: () => tone({ freq: 600, end: 1250, dur: 0.28, vol: 0.1 }),
  scanCancel: () => tone({ freq: 900, end: 380, dur: 0.14, vol: 0.1 }),
  scanComplete: () => notes([880, 1318.51], { spacing: 0.09, vol: 0.14 }),
  discovery: (rarity) => notes(DISCOVERY_ARPEGGIOS[rarity] ?? DISCOVERY_ARPEGGIOS.common, { spacing: 0.11, vol: 0.16 }),
  minigameHit: () => tone({ freq: 660 + Math.random() * 90, type: "triangle", dur: 0.07, vol: 0.16 }),
  minigameMiss: () => tone({ freq: 170, end: 90, type: "sawtooth", dur: 0.2, vol: 0.16 }),
  minigameWin: () => notes([523.25, 659.25, 783.99, 1046.5], { spacing: 0.1, vol: 0.18 }),
  minigameLose: () => notes([392, 311.13, 233.08], { spacing: 0.13, type: "sawtooth", vol: 0.12 }),
  explosion: () => {
    burst({ dur: 0.5, vol: 0.28, filter: 420 });
    tone({ freq: 60, end: 34, dur: 0.5, vol: 0.3 });
  },
  install: () => {
    tone({ freq: 440, type: "square", dur: 0.07, vol: 0.14 });
    tone({ freq: 659.25, dur: 0.16, vol: 0.16, at: 0.09 });
  },
  boostDepleted: () => tone({ freq: 240, end: 130, type: "square", dur: 0.22, vol: 0.12 }),
  salvage: () => {
    tone({ freq: 1050 + Math.random() * 150, type: "triangle", dur: 0.05, vol: 0.09 });
    tone({ freq: 1568, type: "triangle", dur: 0.07, vol: 0.07, at: 0.05 });
  },
};

/** Fire a named one-shot effect. Safe to call unconditionally. */
export function playSfx(name, arg) {
  if (!ready()) return;
  try {
    SFX[name]?.(arg);
  } catch {
    // Never let audio break gameplay
  }
}

// ------------------------------------------------------------------- engine

/**
 * Velocity-reactive ship hum: looped noise through a lowpass filter whose
 * cutoff and level track throttle (0-1). Call every frame; smoothing is
 * handled here via setTargetAtTime.
 */
export function updateEngine(throttle, boosting) {
  if (!ready()) return;

  if (!engine) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 140;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(filter);
    filter.connect(g);
    g.connect(sfxBus);
    src.start();
    engine = { src, filter, g };
  }

  const t = ctx.currentTime;
  const level = Math.min(1, Math.max(0, throttle));
  engine.g.gain.setTargetAtTime(level * (boosting ? 0.09 : 0.05), t, 0.12);
  engine.filter.frequency.setTargetAtTime(140 + level * (boosting ? 900 : 420), t, 0.15);
}

export function stopEngine() {
  if (!engine) return;
  try {
    engine.src.stop();
  } catch {
    // already stopped
  }
  engine = null;
}

// ------------------------------------------------------------------ ambient

/**
 * Deep-space drone: two low sines a detuned fifth apart with a very slow
 * swell. Started when gameplay begins; if the context is still locked it
 * fades in on the first user gesture.
 */
export function startAmbient() {
  ensureUnlockListeners();
  if (!build() || ambient) return;

  const g = ctx.createGain();
  g.gain.value = 0.05;
  g.connect(ambientBus);

  const o1 = ctx.createOscillator();
  o1.type = "sine";
  o1.frequency.value = 52;
  const o2 = ctx.createOscillator();
  o2.type = "sine";
  o2.frequency.value = 78.3;
  o2.detune.value = 6;
  const g2 = ctx.createGain();
  g2.gain.value = 0.5;

  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.05;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.02;
  lfo.connect(lfoGain);
  lfoGain.connect(g.gain);

  o1.connect(g);
  o2.connect(g2);
  g2.connect(g);
  o1.start();
  o2.start();
  lfo.start();

  ambient = { o1, o2, lfo, g };
}

export function stopAmbient() {
  if (!ambient) return;
  const a = ambient;
  ambient = null;
  a.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.3);
  setTimeout(() => {
    try {
      a.o1.stop();
      a.o2.stop();
      a.lfo.stop();
    } catch {
      // already stopped
    }
  }, 1200);
}
