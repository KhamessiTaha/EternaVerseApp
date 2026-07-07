import { Canvas, useFrame } from "@react-three/fiber";
import { useRef, useState, useMemo, useEffect } from "react";
import { Points, PointMaterial, Text, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { motion } from "framer-motion";
import { FlashCut, FadeToColor } from "./ui/ScreenFlash";
import { getCosmicPhaseLabel } from "./game/ui/statusHelpers";

const BigBangSimulation = ({ universe, onSkip, onComplete }) => {
  const [stage, setStage] = useState("quantum-fluctuations");
  const [paused, setPaused] = useState(false);
  const [autoPlay, setAutoPlay] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [resetAnimation, setResetAnimation] = useState(0);
  const [timeScale, setTimeScale] = useState(1);
  const [showContinue, setShowContinue] = useState(false);
  const [flashKey, setFlashKey] = useState(0);
  const [isHandingOff, setIsHandingOff] = useState(false);
  const isFirstStage = useRef(true);

  const composition = useMemo(() => {
    const c = universe?.constants || {};
    const darkEnergy = c.darkEnergyDensity ?? 0.69;
    const darkMatter = c.darkMatterDensity ?? 0.26;
    const matter = c.matterDensity ?? 0.05;
    const total = darkEnergy + darkMatter + matter || 1;
    return {
      darkEnergy: ((darkEnergy / total) * 100).toFixed(0),
      darkMatter: ((darkMatter / total) * 100).toFixed(0),
      matter: ((matter / total) * 100).toFixed(0),
    };
  }, [universe]);

  useEffect(() => {
    if (autoPlay) {
      const timer = setTimeout(() => {
        setStage("inflation");
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [autoPlay]);

  // Flash-cut on every stage change (a beat marking each cosmic epoch),
  // skipping the very first mount since there's no "transition" yet.
  useEffect(() => {
    if (isFirstStage.current) {
      isFirstStage.current = false;
      return;
    }
    setFlashKey((k) => k + 1);
  }, [stage]);

  useEffect(() => {
    if (stage !== "cmb-formation") return;
    const timer = setTimeout(() => setShowContinue(true), 3000);
    return () => clearTimeout(timer);
  }, [stage]);

  const handleEnterUniverse = () => setIsHandingOff(true);

  useEffect(() => {
    let timer;
    if (!autoPlay || paused) return;

    const stageTiming = {
      "quantum-fluctuations": 4000,
      "inflation": 3000,
      "reheating": 4000,
      "particle-formation": 5000,
      "nucleosynthesis": 5000,
      "cmb-formation": 5000,
    };

    const nextStage = {
      "quantum-fluctuations": "inflation",
      "inflation": "reheating",
      "reheating": "particle-formation",
      "particle-formation": "nucleosynthesis",
      "nucleosynthesis": "cmb-formation",
      "cmb-formation": null,
    };

    if (stage in stageTiming && stageTiming[stage] !== null) {
      timer = setTimeout(() => setStage(nextStage[stage]), stageTiming[stage]);
    }

    return () => clearTimeout(timer);
  }, [stage, paused, autoPlay]);

  const stageMapping = {
    "quantum-fluctuations": "Quantum Fluctuations (10⁻⁴³ s)",
    "inflation": "Cosmic Inflation (10⁻³⁶ to 10⁻³² s)",
    "reheating": "Reheating (10⁻³² to 10⁻¹² s)",
    "particle-formation": "Particle Formation (10⁻¹² to 10⁻⁶ s)",
    "nucleosynthesis": "Nucleosynthesis (1s to 3 minutes)",
    "cmb-formation": "CMB Formation (380,000 years)",
  };

  const stageInfo = {
    "quantum-fluctuations": "Quantum fluctuations represent tiny variations in energy that appear and disappear due to the Heisenberg uncertainty principle, setting the stage for the birth of our universe.",
    "inflation": "During cosmic inflation, the universe expanded exponentially, doubling in size every 10⁻³⁴ seconds. This rapid expansion smoothed out irregularities but preserved quantum fluctuations that would later form galaxies.",
    "reheating": "As inflation ended, the energy that drove it was converted into a hot, dense plasma of particles and radiation, reheating the universe to extreme temperatures.",
    "particle-formation": "As the universe cooled, quarks combined to form protons and neutrons. Electrons, photons, and neutrinos also emerged during this era.",
    "nucleosynthesis": "Within the first three minutes after the Big Bang, protons and neutrons fused to form the nuclei of light elements: primarily hydrogen (75%) and helium (25%), with trace amounts of lithium.",
    "cmb-formation": "After nucleosynthesis, the universe continued to expand and cool. Around 380,000 years after the Big Bang, it became cool enough for electrons to combine with nuclei, forming neutral atoms. This allowed photons to travel freely, creating the Cosmic Microwave Background (CMB).",
  };

  const handleStageChange = (newStage) => {
    setStage(newStage);
    setResetAnimation((prev) => prev + 1);
  };

  const togglePause = () => {
    setPaused(!paused);
  };

  const toggleAutoPlay = () => {
    setAutoPlay(!autoPlay);
  };

  const toggleInfo = () => {
    setShowInfo(!showInfo);
  };

  return (
    <div className="w-full h-full bg-void relative overflow-hidden">
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-void-raised/85 backdrop-blur-sm border-b border-line px-5 py-3.5 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-accent">
              {universe?.name || "Universe"} · Genesis
            </div>
            <h2 className="font-mono text-sm text-ink mt-0.5">{stageMapping[stage]}</h2>
          </div>
          <button
            onClick={toggleInfo}
            className="px-3 py-1.5 border border-line-bright text-ink-dim hover:text-ink hover:border-accent font-mono text-xs transition-colors"
          >
            {showInfo ? "Hide Info" : "Show Info"}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={togglePause}
            className="px-3 py-1.5 border border-line-bright text-ink-dim hover:text-ink hover:border-accent font-mono text-xs transition-colors"
          >
            {paused ? "Resume" : "Pause"}
          </button>
          <button
            onClick={toggleAutoPlay}
            className="px-3 py-1.5 border border-line-bright text-ink-dim hover:text-ink hover:border-accent font-mono text-xs transition-colors"
          >
            {autoPlay ? "Manual Control" : "Auto Play"}
          </button>
          {onSkip && (
            <button
              onClick={onSkip}
              disabled={isHandingOff}
              className="px-3 py-1.5 bg-accent text-void hover:bg-accent/90 font-mono text-xs font-semibold transition-colors disabled:opacity-50"
            >
              Skip Intro
            </button>
          )}
        </div>
      </div>

      {/* Left Sidebar - Stage Navigation */}
      {!autoPlay && (
        <div className="absolute top-16 left-0 z-10 bg-void-raised/85 backdrop-blur-sm border-r border-t border-b border-line p-4">
          <h3 className="font-mono text-[10px] uppercase tracking-wider text-ink-faint mb-3">Stage Navigation</h3>
          <div className="flex flex-col gap-1.5">
            {Object.keys(stageMapping).map((key) => (
              <button
                key={key}
                onClick={() => handleStageChange(key)}
                className={`px-3 py-1.5 text-left font-mono text-xs border transition-colors ${
                  stage === key
                    ? "border-accent text-accent"
                    : "border-line text-ink-dim hover:text-ink hover:border-line-bright"
                }`}
              >
                {key.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ")}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Right Sidebar - Composition and Elemental Abundance */}
      <div className="absolute top-16 right-0 z-10 bg-void-raised/85 backdrop-blur-sm border-l border-t border-b border-line p-4 min-w-[220px]">
        <h3 className="font-mono text-[10px] uppercase tracking-wider text-accent mb-2.5">Composition</h3>
        <div className="font-mono text-xs text-ink-dim space-y-1">
          <div className="flex justify-between"><span>Dark Energy</span><span className="text-ink tabular-nums">{composition.darkEnergy}%</span></div>
          <div className="flex justify-between"><span>Dark Matter</span><span className="text-ink tabular-nums">{composition.darkMatter}%</span></div>
          <div className="flex justify-between"><span>Ordinary Matter</span><span className="text-ink tabular-nums">{composition.matter}%</span></div>
        </div>
        {stage === "nucleosynthesis" && (
          <>
            <h3 className="font-mono text-[10px] uppercase tracking-wider text-accent mt-4 mb-2.5">Elemental Abundance</h3>
            <div className="font-mono text-xs text-ink-dim space-y-1">
              <div className="flex justify-between"><span>Hydrogen</span><span className="text-ink tabular-nums">75%</span></div>
              <div className="flex justify-between"><span>Helium</span><span className="text-ink tabular-nums">25%</span></div>
              <div className="flex justify-between"><span>Lithium</span><span className="text-ink tabular-nums">Trace</span></div>
            </div>
          </>
        )}
        {universe?.seed && (
          <div className="mt-4 pt-3 border-t border-line font-mono text-[10px] text-ink-faint">
            SEED · {universe.seed}
          </div>
        )}
      </div>

      {/* Continue CTA - appears once the CMB has formed. Previews the actual
          cosmicPhase the universe will be in on arrival (same label source
          as the in-game HUD) so the cut from cinematic to gameplay reads as
          one continuous timeline instead of two disconnected systems. */}
      {showContinue && onComplete && !isHandingOff && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-3"
        >
          <div className="text-center">
            <div className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">Next Epoch</div>
            <div className="font-mono text-sm text-accent mt-0.5">
              {getCosmicPhaseLabel(universe?.currentState?.cosmicPhase || "dark_ages")}
            </div>
          </div>
          <button
            onClick={handleEnterUniverse}
            className="px-8 py-3 bg-accent text-void font-mono text-sm font-semibold tracking-wide hover:bg-accent/90 transition-colors shadow-lg"
          >
            Enter Universe
          </button>
        </motion.div>
      )}

      {/* Stage-transition beat */}
      {flashKey > 0 && <FlashCut key={flashKey} />}

      {/* Scene handoff into gameplay - covers the screen, then fires onComplete */}
      {isHandingOff && <FadeToColor color="#ffffff" duration={0.7} onComplete={onComplete} />}

      {/* Current Stage Info */}
      {showInfo && (
        <div className="absolute bottom-4 left-4 z-10 bg-void-raised/85 backdrop-blur-sm border border-line p-4 max-w-md">
          <p className="text-sm text-ink-dim leading-relaxed">{stageInfo[stage]}</p>
        </div>
      )}

      {/* Camera Controls Info */}
      <div className="absolute bottom-4 right-4 z-10 bg-void-raised/85 backdrop-blur-sm border border-line px-3 py-2 font-mono text-[10px] text-ink-faint leading-relaxed">
        <p>Mouse drag: Rotate view</p>
        <p>Scroll: Zoom in/out</p>
        <p>Right-click drag: Pan</p>
      </div>

      {/* Canvas for Simulation */}
      <Canvas camera={{ position: [0, 0, 22], fov: 60 }}>
        <color attach="background" args={["#000000"]} />
        <ambientLight intensity={0.1} />
        <pointLight
          position={[0, 0, 0]}
          intensity={5}
          color={stage === "reheating" ? "#ffcc00" : "#ffaa44"}
          distance={200}
        />
        <Universe
          stage={stage}
          paused={paused}
          resetAnimation={resetAnimation}
          timeScale={timeScale}
        />
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={5}
          maxDistance={500}
          autoRotate={!paused}
          autoRotateSpeed={0.35}
        />
        <EffectComposer>
          <Bloom
            intensity={1.5}
            kernelSize={3}
            luminanceThreshold={0.25}
            luminanceSmoothing={0.25}
          />
        </EffectComposer>
      </Canvas>
    </div>
  );
};

const Universe = ({ stage, paused, resetAnimation, timeScale }) => {
  const [timeElapsed, setTimeElapsed] = useState(0);

  useFrame((_, delta) => {
    if (!paused) {
      setTimeElapsed((prev) => prev + delta * timeScale);
    }
  });

  const quantumRef = useRef();
  const inflationRef = useRef();
  const particlesRef = useRef();

  // R3F's useFrame delta is in seconds (not ms, unlike Phaser). None of the
  // particle-system updates below were scaled by it - every stochastic
  // spawn/fade chance and every per-frame position/color increment ran once
  // per RENDERED FRAME regardless of how much time that frame actually took.
  // With tens of thousands of particles being walked on the CPU every frame,
  // any frame-time variance directly showed up as visible speed hitching.
  // Normalizing against a 60fps reference makes the animation's perceived
  // speed consistent regardless of frame rate/hitches.
  const REF_DELTA = 1 / 60;
  const rate = (perFrameValue, delta) => perFrameValue * (delta / REF_DELTA);
  const growth = (perFrameFactor, delta) => Math.pow(perFrameFactor, delta / REF_DELTA);

  const temperatureToColor = (temperature) => {
    const t = (temperature - 2.7) / 0.1;
    const r = Math.min(1, Math.max(0, 1 - Math.abs(t - 0.5)));
    const g = Math.min(1, Math.max(0, 1 - Math.abs(t)));
    const b = Math.min(1, Math.max(0, 1 - Math.abs(t + 0.5)));
    return new THREE.Color(r, g, b);
  };

  const cmbCount = 50000;
  const cmbData = useMemo(() => {
    const positions = new Float32Array(cmbCount * 3);
    const colors = new Float32Array(cmbCount * 3);
    const sizes = new Float32Array(cmbCount);

    for (let i = 0; i < cmbCount; i++) {
      const r = Math.random() * 28;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      const temperature = 2.725 + (Math.random() - 0.5) * 0.01;
      const color = temperatureToColor(temperature);

      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      sizes[i] = 0.02 + Math.random() * 0.01;
    }

    return { positions, colors, sizes };
  }, []);

  const quantumCount = 700;
  const quantumData = useMemo(() => {
    const positions = new Float32Array(quantumCount * 3);
    const sizes = new Float32Array(quantumCount);
    const colors = new Float32Array(quantumCount * 3);

    for (let i = 0; i < quantumCount; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;

      sizes[i] = 0.1;

      colors[i * 3] = 0.6 + Math.random() * 0.2;
      colors[i * 3 + 1] = 0.7 + Math.random() * 0.2;
      colors[i * 3 + 2] = 0.9 + Math.random() * 0.1;
    }

    return { positions, sizes, colors };
  }, []);

  const inflationCount = 10000;
  const inflationData = useMemo(() => {
    const positions = new Float32Array(inflationCount * 3);
    const colors = new Float32Array(inflationCount * 3);
    const sizes = new Float32Array(inflationCount);

    for (let i = 0; i < inflationCount; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;

      colors[i * 3] = 0.7 + Math.random() * 0.2;
      colors[i * 3 + 1] = 0.7 + Math.random() * 0.2;
      colors[i * 3 + 2] = 0.8 + Math.random() * 0.2;

      sizes[i] = 0.03 + Math.random() * 0.03;
    }

    return { positions, colors, sizes };
  }, []);

  const particleCount = 20000;
  const particleData = useMemo(() => {
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const velocities = new Float32Array(particleCount * 3);
    const types = new Uint8Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;

      velocities[i * 3] = (Math.random() - 0.5) * 0.001;
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.001;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.001;

      colors[i * 3] = 0.7 + Math.random() * 0.2;
      colors[i * 3 + 1] = 0.7 + Math.random() * 0.2;
      colors[i * 3 + 2] = 0.8 + Math.random() * 0.2;

      sizes[i] = Math.random() * 0.05 + 0.01;

      const typeRoll = Math.random();
      if (typeRoll < 0.75) {
        types[i] = 0; // hydrogen
      } else if (typeRoll < 0.99) {
        types[i] = 1; // helium
      } else {
        types[i] = 2; // lithium
      }
    }

    return { positions, colors, sizes, velocities, types };
  }, []);

  const particleTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext("2d");

    const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
    gradient.addColorStop(0.2, "rgba(240, 240, 255, 0.9)");
    gradient.addColorStop(0.5, "rgba(160, 180, 255, 0.5)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);

    return new THREE.CanvasTexture(canvas);
  }, []);

  const backgroundStarCount = 2500;
  const backgroundStars = useMemo(() => {
    const positions = new Float32Array(backgroundStarCount * 3);
    const colors = new Float32Array(backgroundStarCount * 3);

    for (let i = 0; i < backgroundStarCount; i++) {
      // Distributed in a shell well beyond the active simulation volume, so
      // it always reads as distant backdrop rather than part of the action.
      const r = 60 + Math.random() * 140;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      const warmth = Math.random();
      colors[i * 3] = 0.7 + warmth * 0.3;
      colors[i * 3 + 1] = 0.75 + warmth * 0.25;
      colors[i * 3 + 2] = 0.85 + warmth * 0.15;
    }

    return { positions, colors };
  }, []);

  useFrame((_, delta) => {
    if (paused) return;

    if (stage === "quantum-fluctuations" && quantumRef.current) {
      const positions = quantumRef.current.geometry.attributes.position.array;
      const colors = quantumRef.current.geometry.attributes.color.array;
      const sizes = quantumRef.current.geometry.attributes.size.array;

      const spawnChance = rate(0.1, delta);
      const fadeChance = rate(0.15, delta);

      for (let i = 0; i < quantumCount; i++) {
        const idx = i * 3;

        if (Math.random() < spawnChance) {
          const r = Math.random() * 2;
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos((Math.random() * 2) - 1);

          positions[idx] = r * Math.sin(phi) * Math.cos(theta) * 0.5;
          positions[idx + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.5;
          positions[idx + 2] = r * Math.cos(phi) * 0.5;

          colors[idx] = 0.6 + Math.random() * 0.3;
          colors[idx + 1] = 0.7 + Math.random() * 0.3;
          colors[idx + 2] = 0.9 + Math.random() * 0.1;

          sizes[i] = 0.05 + Math.random() * 0.1;
        } else if (Math.random() < fadeChance) {
          positions[idx] = 0;
          positions[idx + 1] = 0;
          positions[idx + 2] = 0;
          sizes[i] = 0;
        }
      }

      quantumRef.current.geometry.attributes.position.needsUpdate = true;
      quantumRef.current.geometry.attributes.color.needsUpdate = true;
      quantumRef.current.geometry.attributes.size.needsUpdate = true;
    }
  });

  useFrame((_, delta) => {
    if (paused) return;

    if ((stage === "inflation" || stage === "reheating") && inflationRef.current) {
      const positions = inflationRef.current.geometry.attributes.position.array;
      const sizes = inflationRef.current.geometry.attributes.size.array;
      const colors = inflationRef.current.geometry.attributes.color.array;

      const expansionRate = stage === "inflation" ? 1.3 : 1.05;
      const frameExpansion = growth(expansionRate, delta);
      const spawnChance = rate(0.4, delta);
      const colorStep = rate(0.01, delta);
      const sizeStep = rate(0.001, delta);

      for (let i = 0; i < inflationCount; i++) {
        const idx = i * 3;
        const x = positions[idx];
        const y = positions[idx + 1];
        const z = positions[idx + 2];

        if (stage === "inflation") {
          if (x === 0 && y === 0 && z === 0 && Math.random() < spawnChance) {
            const r = 0.1;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos((Math.random() * 2) - 1);

            positions[idx] = r * Math.sin(phi) * Math.cos(theta);
            positions[idx + 1] = r * Math.sin(phi) * Math.sin(theta);
            positions[idx + 2] = r * Math.cos(phi);
          } else if (x !== 0 || y !== 0 || z !== 0) {
            positions[idx] *= frameExpansion;
            positions[idx + 1] *= frameExpansion;
            positions[idx + 2] *= frameExpansion;
          }
        } else if (stage === "reheating") {
          if (x !== 0 || y !== 0 || z !== 0) {
            positions[idx] *= frameExpansion;
            positions[idx + 1] *= frameExpansion;
            positions[idx + 2] *= frameExpansion;

            colors[idx] = Math.min(1.0, colors[idx] + colorStep);
            colors[idx + 1] = Math.min(1.0, colors[idx + 1] + colorStep);

            sizes[i] = Math.min(0.15, sizes[i] + sizeStep);
          }
        }
      }

      inflationRef.current.geometry.attributes.position.needsUpdate = true;
      inflationRef.current.geometry.attributes.color.needsUpdate = true;
      inflationRef.current.geometry.attributes.size.needsUpdate = true;
    }
  });

  useFrame((_, delta) => {
    if (paused) return;

    if (
      (stage === "particle-formation" || stage === "nucleosynthesis" || stage === "cmb-formation") &&
      particlesRef.current
    ) {
      const positions = particlesRef.current.geometry.attributes.position.array;
      const colors = particlesRef.current.geometry.attributes.color.array;
      const sizes = particlesRef.current.geometry.attributes.size.array;

      const expansionRate =
        stage === "particle-formation" ? 1.01 : stage === "nucleosynthesis" ? 1.005 : 1.0001;
      const frameExpansion = growth(expansionRate, delta);
      const deltaRatio = delta / REF_DELTA;
      const spawnChance = rate(0.2, delta);
      const mergeChance = rate(0.0001, delta);
      const formationColorStep = rate(0.001, delta);
      const formationColorStepSlow = rate(0.0005, delta);

      for (let i = 0; i < particleCount; i++) {
        const idx = i * 3;
        const x = positions[idx];
        const y = positions[idx + 1];
        const z = positions[idx + 2];
        const particleType = particleData.types[i];

        if ((x === 0 && y === 0 && z === 0) && Math.random() < spawnChance) {
          const r = Math.pow(Math.random(), 0.5) * 5;
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos((Math.random() * 2) - 1);

          const perturbation =
            Math.sin(theta * 5) * Math.cos(phi * 3) * 0.1 +
            Math.sin(theta * 7) * Math.sin(phi * 4) * 0.05;

          positions[idx] = (r + perturbation) * Math.sin(phi) * Math.cos(theta);
          positions[idx + 1] = (r + perturbation) * Math.sin(phi) * Math.sin(theta);
          positions[idx + 2] = (r + perturbation) * Math.cos(phi);

          const speed = 0.001 * (1 + Math.random() * 0.2);
          const tangentialFactor = 0.1 * Math.random();

          const radialVx = positions[idx] * speed;
          const radialVy = positions[idx + 1] * speed;
          const radialVz = positions[idx + 2] * speed;

          const upX = 0;
          const upY = 1;
          const upZ = 0;

          const tangentialVx = (radialVy * upZ - radialVz * upY) * tangentialFactor;
          const tangentialVy = (radialVz * upX - radialVx * upZ) * tangentialFactor;
          const tangentialVz = (radialVx * upY - radialVy * upX) * tangentialFactor;

          particleData.velocities[idx] = radialVx + tangentialVx;
          particleData.velocities[idx + 1] = radialVy + tangentialVy;
          particleData.velocities[idx + 2] = radialVz + tangentialVz;
        } else if (x !== 0 || y !== 0 || z !== 0) {
          positions[idx] *= frameExpansion;
          positions[idx + 1] *= frameExpansion;
          positions[idx + 2] *= frameExpansion;

          positions[idx] += particleData.velocities[idx] * deltaRatio;
          positions[idx + 1] += particleData.velocities[idx + 1] * deltaRatio;
          positions[idx + 2] += particleData.velocities[idx + 2] * deltaRatio;

          if (stage === "particle-formation") {
            colors[idx] = Math.min(0.95, colors[idx] + formationColorStep);
            colors[idx + 1] = Math.min(0.95, colors[idx + 1] + formationColorStepSlow);
            colors[idx + 2] = Math.max(0.7, colors[idx + 2] - formationColorStepSlow);
          } else if (stage === "nucleosynthesis") {
            if (particleType === 0) {
              colors[idx] = 0.6 + Math.random() * 0.1;
              colors[idx + 1] = 0.7 + Math.random() * 0.1;
              colors[idx + 2] = 0.9 + Math.random() * 0.1;
            } else if (particleType === 1) {
              colors[idx] = 0.8 + Math.random() * 0.1;
              colors[idx + 1] = 0.8 + Math.random() * 0.1;
              colors[idx + 2] = 0.6 + Math.random() * 0.1;
            } else {
              colors[idx] = 0.9 + Math.random() * 0.1;
              colors[idx + 1] = 0.3 + Math.random() * 0.2;
              colors[idx + 2] = 0.1 + Math.random() * 0.1;
              sizes[i] = 0.08 + Math.random() * 0.04;
            }

            if (Math.random() < mergeChance) {
              for (let j = 0; j < 10; j++) {
                if (i + j < particleCount) {
                  const targetIdx = (i + j) * 3;
                  if (positions[targetIdx] !== 0) {
                    const dist = Math.sqrt(
                      positions[targetIdx] * positions[targetIdx] +
                      positions[targetIdx + 1] * positions[targetIdx + 1] +
                      positions[targetIdx + 2] * positions[targetIdx + 2]
                    );

                    const centerX = positions[idx];
                    const centerY = positions[idx + 1];
                    const centerZ = positions[idx + 2];

                    particleData.velocities[targetIdx] += (centerX - positions[targetIdx]) * 0.00005;
                    particleData.velocities[targetIdx + 1] += (centerY - positions[targetIdx + 1]) * 0.00005;
                    particleData.velocities[targetIdx + 2] += (centerZ - positions[targetIdx + 2]) * 0.00005;
                  }
                }
              }
            }
          } else if (stage === "cmb-formation") {
            const temperature = 2.725 + (Math.random() - 0.5) * 0.01;
            const color = temperatureToColor(temperature);
            colors[idx] = color.r;
            colors[idx + 1] = color.g;
            colors[idx + 2] = color.b;
          }
        }
      }

      particlesRef.current.geometry.attributes.position.needsUpdate = true;
      particlesRef.current.geometry.attributes.color.needsUpdate = true;
      particlesRef.current.geometry.attributes.size.needsUpdate = true;
    }
  });

  return (
    <group>
      {/* Distant static starfield - always present so the void never reads as
          flat empty black, and gives visual continuity across stage cuts */}
      <Points positions={backgroundStars.positions} colors={backgroundStars.colors}>
        <PointMaterial
          size={0.7}
          sizeAttenuation={true}
          vertexColors
          transparent
          opacity={0.5}
          alphaMap={particleTexture}
          depthWrite={false}
        />
      </Points>

      {/* Quantum fluctuations */}
      {stage === "quantum-fluctuations" && (
        <Points ref={quantumRef} positions={quantumData.positions} sizes={quantumData.sizes} colors={quantumData.colors}>
          <PointMaterial
            size={0.65}
            sizeAttenuation={true}
            vertexColors
            transparent
            opacity={0.85}
            alphaMap={particleTexture}
            depthWrite={false}
          />
        </Points>
      )}

      {/* Inflation particles */}
      {(stage === "inflation" || stage === "reheating") && (
        <Points ref={inflationRef} positions={inflationData.positions} colors={inflationData.colors} sizes={inflationData.sizes}>
          <PointMaterial
            size={0.5}
            sizeAttenuation={true}
            vertexColors
            transparent
            alphaMap={particleTexture}
            depthWrite={false}
          />
        </Points>
      )}

      {/* Particle formation and nucleosynthesis */}
      {(stage === "particle-formation" || stage === "nucleosynthesis" || stage === "cmb-formation") && (
        <Points ref={particlesRef} positions={particleData.positions} colors={particleData.colors} sizes={particleData.sizes}>
          <PointMaterial
            size={0.38}
            sizeAttenuation={true}
            vertexColors
            transparent
            alphaMap={particleTexture}
            depthWrite={false}
          />
        </Points>
      )}
    </group>
  );
};

export default BigBangSimulation;