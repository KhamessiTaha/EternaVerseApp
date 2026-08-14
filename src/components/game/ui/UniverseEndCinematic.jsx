// src/components/game/ui/UniverseEndCinematic.jsx
//
// How a universe dies.
//
// The bookend to BigBangSimulation: same stack (react-three-fiber + Bloom +
// framer-motion + the ScreenFlash primitives), because the death of a cosmos
// should be told in the same visual language as its birth. Nothing new was
// added to the bundle for this - three.js was already here.
//
// Two layers of stars: a static deep field that never moves, and the LIVING
// field seeded into galaxy discs with bright cores. The dying one needs
// something to die against, and the parallax between them is what gives the
// camera moves any weight at all.
//
// Each end condition then transforms that same field a different way, on its
// own clock, with its own camera: it unravels, cools, goes dark, tears apart,
// collapses, or smears into featureless heat. Timing/curve/camera all live in
// content/universeEnds.js so a death can be re-tuned without touching this.
//
// Two rules this file obeys:
//   * useFrame's delta is in SECONDS and varies with frame rate, so every
//     motion is a pure function of elapsed time, never a per-frame increment.
//     The sequence takes the same time at 30fps and 144Hz.
//   * NOTHING calls setState per frame. Frame values live in refs; React only
//     re-renders on the two beats that matter (epitaph, done). An earlier
//     version drove progress through useState and re-rendered the whole
//     overlay 60x/second.
//
// This is a scene TRANSITION - Phaser isn't rendering behind it - so it has
// the whole frame budget to itself.
import { useRef, useMemo, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Points, PointMaterial } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import { motion } from "framer-motion";
import { FadeToColor } from "../../ui/ScreenFlash";
import { sceneFor } from "../content/universeEnds";
import { deathFor } from "../content/deathScenes";
import { playSfx } from "../audio";

const DEEP_COUNT = 3500;   // the static deep field behind it
const CAM_Z = 26;

/** The deep field: far, dim, and completely static. Pure parallax reference. */
function seedDeepField() {
  const positions = new Float32Array(DEEP_COUNT * 3);
  const colors = new Float32Array(DEEP_COUNT * 3);
  for (let i = 0; i < DEEP_COUNT; i++) {
    const R = 60 + Math.random() * 40;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(Math.random() * 2 - 1);
    positions[i * 3] = R * Math.sin(ph) * Math.cos(th);
    positions[i * 3 + 1] = R * Math.sin(ph) * Math.sin(th);
    positions[i * 3 + 2] = R * Math.cos(ph);
    const v = 0.28 + Math.random() * 0.34;
    colors[i * 3] = v;
    colors[i * 3 + 1] = v;
    colors[i * 3 + 2] = v * 1.12;
  }
  return { positions, colors };
}

/**
 * The clock. Owns elapsed time and drives the field, the camera and the bloom
 * from a single useFrame - and fires each narrative beat exactly once, which
 * is the only time React hears from it.
 *
 * It knows nothing about any particular death: content/deathScenes.js supplies
 * both the field and the way it dies, so adding or re-cutting one never
 * touches this component.
 */
function Sequence({ scene, bloomRef, onEpitaph, onDone }) {
  const fieldRef = useRef();
  const elapsed = useRef(0);
  const firedEpitaph = useRef(false);
  const firedDone = useRef(false);
  const { camera } = useThree();

  const death = useMemo(() => deathFor(scene.motionKind), [scene.motionKind]);
  const field = useMemo(() => death.seed(), [death]);
  const deep = useMemo(() => seedDeepField(), []);
  // Seeded at p=0 so the very first frame is already the death's own image.
  const { initialPositions, initialColors } = useMemo(() => {
    const n = field.n;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    death.step(0, field, pos, col);
    return { initialPositions: pos, initialColors: col };
  }, [death, field]);

  useFrame((_, delta) => {
    const t = (elapsed.current += delta);
    const raw = Math.min(1, t / scene.duration);
    const p = Math.pow(raw, scene.curve); // each death's own rhythm

    const geo = fieldRef.current?.geometry;
    if (geo) {
      death.step(p, field, geo.attributes.position.array, geo.attributes.color.array);
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
      fieldRef.current.rotation.y = t * scene.spin;
    }

    // Camera: dolly along the death's own axis, drift sideways for parallax
    // against the static deep field, and shake proportional to the violence.
    const cam = scene.camera;
    const shake = cam.shake * p * p;
    camera.position.set(
      Math.sin(t * cam.drift) * 3 + (Math.random() - 0.5) * shake,
      Math.cos(t * cam.drift * 0.8) * 1.6 + (Math.random() - 0.5) * shake,
      CAM_Z + cam.dolly * p
    );
    camera.lookAt(0, 0, 0);

    // Bloom answers the moment instead of sitting at a constant.
    if (bloomRef.current) {
      const blowout = scene.motionKind === "crunch" || scene.motionKind === "rip";
      bloomRef.current.intensity = blowout
        ? 1.1 + Math.pow(p, 3) * 5.5   // the end of these two should hurt
        : 1.35 * (1 - p * 0.45);       // the quiet deaths dim as they go
    }

    if (!firedEpitaph.current && raw >= scene.epitaphAt) {
      firedEpitaph.current = true;
      onEpitaph();
    }
    if (!firedDone.current && raw >= 1) {
      firedDone.current = true;
      onDone();
    }
  });

  return (
    <>
      <Points positions={deep.positions} colors={deep.colors} stride={3}>
        <PointMaterial size={0.28} vertexColors sizeAttenuation transparent opacity={0.5} depthWrite={false} />
      </Points>
      <Points ref={fieldRef} positions={initialPositions} colors={initialColors} stride={3}>
        <PointMaterial
          size={death.pointSize}
          vertexColors
          sizeAttenuation
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </Points>
    </>
  );
}

/**
 * The full sequence. Calls `onComplete` once the field has finished dying and
 * the screen has faded to the scene's resolve colour - the caller reveals the
 * summary out of that colour, the same handoff BigBangSimulation uses.
 */
export const UniverseEndCinematic = ({ universe, onComplete }) => {
  const scene = sceneFor(universe?.endCondition);
  const [showEpitaph, setShowEpitaph] = useState(false);
  const [handingOff, setHandingOff] = useState(false);
  const bloomRef = useRef();
  const done = useRef(false);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    setHandingOff(true);
  };

  // The voice of this particular death, started with the visuals.
  useEffect(() => {
    playSfx("universeEnd", scene.motionKind);
  }, [scene.motionKind]);

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

  return (
    <div className="fixed inset-0 z-[90] bg-black overflow-hidden">
      {/* Background comes from the wrapper's bg-black rather than a <color>
          node - one less thing between the field and the bloom pass. */}
      <Canvas camera={{ position: [0, 0, CAM_Z], fov: 60 }} dpr={[1, 1.75]}>
        <Sequence
          scene={scene}
          bloomRef={bloomRef}
          onEpitaph={() => setShowEpitaph(true)}
          onDone={finish}
        />
        <EffectComposer>
          <Bloom ref={bloomRef} intensity={1.35} kernelSize={3} luminanceThreshold={0.2} luminanceSmoothing={0.3} />
        </EffectComposer>
      </Canvas>

      {showEpitaph && (
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
