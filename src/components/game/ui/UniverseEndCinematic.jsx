// src/components/game/ui/UniverseEndCinematic.jsx
//
// How a universe dies.
//
// The bookend to BigBangSimulation: same stack (react-three-fiber + Bloom +
// framer-motion + the ScreenFlash primitives), because the death of a cosmos
// should be told in the same visual language as its birth. Nothing new was
// added to the bundle for this - three.js was already here.
//
// One particle field, seeded into CLUSTERS rather than a uniform cloud, so
// that "structure" is a thing the player can watch being lost. Each end
// condition then transforms that same field a different way: it unravels,
// cools, goes dark, tears apart, collapses, or smears into featureless heat.
//
// IMPORTANT (learned the hard way in BigBangSimulation): useFrame's delta is
// in SECONDS and varies with frame rate. Every motion here is a pure function
// of elapsed time rather than a per-frame increment, so the sequence takes the
// same 7 seconds on a 30fps laptop and a 144Hz desktop.
//
// This is a scene TRANSITION - Phaser isn't rendering behind it - so it has
// the whole frame budget to itself.
import { useRef, useMemo, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Points, PointMaterial } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import { motion } from "framer-motion";
import { FadeToColor } from "../../ui/ScreenFlash";
import { sceneFor } from "../content/universeEnds";

const COUNT = 12000;
const CLUSTERS = 14;
const DURATION = 7.0;      // seconds of cinematic before the summary resolves
const EPITAPH_AT = 0.32;   // fraction of the way through that the words arrive

/** Seed a clustered field: galaxies, not a uniform fog. */
function seedField() {
  const base = new Float32Array(COUNT * 3);
  const spread = new Float32Array(COUNT * 3); // the uniform cloud we diffuse toward
  const colors = new Float32Array(COUNT * 3);
  const seeds = new Float32Array(COUNT);      // per-point randomness (snuff timing, jitter)

  const centers = [];
  for (let c = 0; c < CLUSTERS; c++) {
    const r = 4 + Math.random() * 14;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    centers.push([
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta) * 0.55, // flatten: a disc reads as structure
      r * Math.cos(phi),
    ]);
  }

  for (let i = 0; i < COUNT; i++) {
    const c = centers[i % CLUSTERS];
    // Gaussian-ish falloff around the cluster centre
    const g = () => (Math.random() + Math.random() + Math.random() - 1.5) * 2.2;
    base[i * 3] = c[0] + g();
    base[i * 3 + 1] = c[1] + g() * 0.6;
    base[i * 3 + 2] = c[2] + g();

    const R = 20;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(Math.random() * 2 - 1);
    const rr = R * Math.cbrt(Math.random());
    spread[i * 3] = rr * Math.sin(ph) * Math.cos(th);
    spread[i * 3 + 1] = rr * Math.sin(ph) * Math.sin(th);
    spread[i * 3 + 2] = rr * Math.cos(ph);

    // Starlight: mostly warm white, some blue giants, some deep red
    const t = Math.random();
    const col = t > 0.86
      ? [0.62, 0.74, 1.0]
      : t > 0.24
        ? [1.0, 0.94, 0.84]
        : [1.0, 0.6, 0.42];
    colors[i * 3] = col[0];
    colors[i * 3 + 1] = col[1];
    colors[i * 3 + 2] = col[2];

    seeds[i] = Math.random();
  }

  return { base, spread, colors, seeds };
}

/**
 * Write the field's state at progress `p` (0..1) into `pos`/`col`.
 * Pure in p - no accumulation - so frame rate can't change the choreography.
 */
function transform(kind, p, i, field, pos, col) {
  const { base, spread, colors, seeds } = field;
  const x = base[i * 3], y = base[i * 3 + 1], z = base[i * 3 + 2];
  const s = seeds[i];
  let r = colors[i * 3], g = colors[i * 3 + 1], b = colors[i * 3 + 2];
  let sx = x, sy = y, sz = z;

  switch (kind) {
    case "unravel": {
      // Structure loses cohesion: growing incoherent jitter, drifting apart,
      // colour bleeding out to grey.
      const j = p * p * 7;
      const w = (n) => Math.sin(n * 12.9898 + p * 9) * 43758.5453;
      const frac = (n) => n - Math.floor(n);
      sx = x * (1 + p * 0.35) + (frac(w(s)) - 0.5) * j;
      sy = y * (1 + p * 0.35) + (frac(w(s + 1.7)) - 0.5) * j;
      sz = z * (1 + p * 0.35) + (frac(w(s + 3.1)) - 0.5) * j;
      const grey = (r + g + b) / 3;
      const k = Math.min(1, p * 1.3);
      r = (r + (grey - r) * k) * (1 - p * 0.85);
      g = (g + (grey - g) * k) * (1 - p * 0.85);
      b = (b + (grey - b) * k) * (1 - p * 0.85);
      break;
    }
    case "cool": {
      // Slow drift apart, light reddening then dimming to nothing.
      const e = 1 + p * 1.5;
      sx = x * e; sy = y * e; sz = z * e;
      const dim = Math.max(0, 1 - p * 1.15);
      r *= dim;
      g *= dim * (1 - p * 0.45);
      b *= dim * (1 - p * 0.15); // blue survives longest: cold, not warm
      break;
    }
    case "snuff": {
      // Lights go out one at a time, on each point's own schedule.
      const e = 1 + p * 0.25;
      sx = x * e; sy = y * e; sz = z * e;
      const deathAt = 0.1 + s * 0.8;
      const k = p < deathAt ? 1 : Math.max(0, 1 - (p - deathAt) * 9);
      r *= k; g *= k; b *= k;
      break;
    }
    case "rip": {
      // Accelerating outward, streaking past the camera, burning as it goes.
      const e = 1 + Math.pow(p, 3) * 16;
      sx = x * e; sy = y * e; sz = z * e;
      const hot = Math.min(1, p * 1.6);
      r = r + (1 - r) * hot;
      g = g + (0.92 - g) * hot;
      b = b + (1 - b) * hot;
      break;
    }
    case "crunch": {
      // Everything falls back to a point, compressing into white.
      const e = Math.pow(Math.max(0, 1 - p), 1.6);
      sx = x * e; sy = y * e; sz = z * e;
      const hot = Math.pow(p, 1.4);
      r = r + (1 - r) * hot;
      g = g + (1 - g) * hot;
      b = b + (1 - b) * hot;
      break;
    }
    case "diffuse":
    default: {
      // Structure smeared away into a featureless, uniform haze.
      const k = Math.min(1, p * 1.1);
      sx = x + (spread[i * 3] - x) * k;
      sy = y + (spread[i * 3 + 1] - y) * k;
      sz = z + (spread[i * 3 + 2] - z) * k;
      const flat = 0.34;
      r = r + (flat - r) * k;
      g = g + (flat * 0.96 - g) * k;
      b = b + (flat * 0.88 - b) * k;
      break;
    }
  }

  pos[i * 3] = sx; pos[i * 3 + 1] = sy; pos[i * 3 + 2] = sz;
  col[i * 3] = r; col[i * 3 + 1] = g; col[i * 3 + 2] = b;
}

function DyingField({ motionKind, onProgress }) {
  const ref = useRef();
  const elapsed = useRef(0);
  const field = useMemo(() => seedField(), []);
  // drei's <Points> builds the geometry from these; we then mutate the
  // geometry's own arrays in place each frame.
  const initialPositions = useMemo(() => new Float32Array(field.base), [field]);
  const initialColors = useMemo(() => new Float32Array(field.colors), [field]);

  useFrame((_, delta) => {
    elapsed.current += delta;
    const p = Math.min(1, elapsed.current / DURATION);

    const geo = ref.current?.geometry;
    if (geo) {
      const pos = geo.attributes.position.array;
      const col = geo.attributes.color.array;
      for (let i = 0; i < COUNT; i++) transform(motionKind, p, i, field, pos, col);
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
      // A slow roll, so even the quiet deaths aren't a still image.
      ref.current.rotation.y = elapsed.current * 0.05;
    }
    onProgress(p);
  });

  return (
    <Points ref={ref} positions={initialPositions} colors={initialColors} stride={3}>
      <PointMaterial
        size={0.13}
        vertexColors
        sizeAttenuation
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </Points>
  );
}

/**
 * The full sequence. Calls `onComplete` once the field has finished dying and
 * the screen has faded to the scene's resolve colour - the caller reveals the
 * summary out of that colour, the same handoff BigBangSimulation uses.
 */
export const UniverseEndCinematic = ({ universe, onComplete }) => {
  const scene = sceneFor(universe?.endCondition);
  const [progress, setProgress] = useState(0);
  const [handingOff, setHandingOff] = useState(false);
  const done = useRef(false);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    setHandingOff(true);
  };

  // Skippable by anything - nobody should be trapped in a death animation.
  // Armed after a short grace period so a click already in flight when the
  // universe ended (the player was, after all, mid-game) doesn't skip it
  // before the first frame is even visible.
  useEffect(() => {
    let armed = false;
    const arm = setTimeout(() => { armed = true; }, 800);
    const skip = () => { if (armed) finish(); };
    window.addEventListener("keydown", skip);
    window.addEventListener("pointerdown", skip);
    return () => {
      clearTimeout(arm);
      window.removeEventListener("keydown", skip);
      window.removeEventListener("pointerdown", skip);
    };
  }, []);

  useEffect(() => {
    if (progress >= 1) finish();
  }, [progress]);

  return (
    <div className="fixed inset-0 z-[90] bg-black overflow-hidden">
      {/* Background comes from the wrapper's bg-black rather than a <color>
          node - one less thing between the field and the bloom pass. */}
      <Canvas camera={{ position: [0, 0, 26], fov: 60 }} dpr={[1, 1.75]}>
        <DyingField motionKind={scene.motionKind} onProgress={setProgress} />
        <EffectComposer>
          <Bloom intensity={1.35} kernelSize={3} luminanceThreshold={0.2} luminanceSmoothing={0.3} />
        </EffectComposer>
      </Canvas>

      {progress > EPITAPH_AT && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-6">
          <motion.div
            className="text-center max-w-xl"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.6, ease: "easeOut" }}
          >
            <div className="font-mono text-[10px] uppercase tracking-[0.42em] text-critical/80 mb-4">
              {universe?.name || "Universe"}
            </div>
            <h1 className="font-sans text-4xl md:text-5xl text-ink font-light tracking-wide mb-5">
              {scene.title}
            </h1>
            <p className="font-sans text-[15px] leading-relaxed text-ink-dim/90 italic">
              {scene.line}
            </p>
          </motion.div>
        </div>
      )}

      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 font-mono text-[10px] uppercase tracking-[0.3em] text-ink-faint pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.55 }}
        transition={{ delay: 1.8, duration: 1 }}
      >
        Press any key to skip
      </motion.div>

      {handingOff && (
        <FadeToColor color={scene.resolveTo} duration={0.85} onComplete={onComplete} />
      )}
    </div>
  );
};

export default UniverseEndCinematic;
