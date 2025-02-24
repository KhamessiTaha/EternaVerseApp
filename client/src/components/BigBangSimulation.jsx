import { Canvas, useFrame } from "@react-three/fiber";
import { useRef, useState, useMemo, useEffect } from "react";
import { Points, PointMaterial, Text, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

const BigBangSimulation = () => {
  const [stage, setStage] = useState("pre-bigbang");
  const [paused, setPaused] = useState(false);
  const [autoPlay, setAutoPlay] = useState(true);
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    // Start the simulation after a brief pause to show empty space
    if (autoPlay) {
      const timer = setTimeout(() => {
        setStage("quantum-fluctuations");
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [autoPlay]);

  // Progress through stages of the universe's evolution
  useEffect(() => {
    let timer;
    if (!autoPlay || paused) return;
    
    const stageTiming = {
      "quantum-fluctuations": 4000,
      "inflation": 3000,
      "reheating": 4000,
      "particle-formation": 5000,
      "nucleosynthesis": null // End stage
    };
    
    const nextStage = {
      "quantum-fluctuations": "inflation",
      "inflation": "reheating",
      "reheating": "particle-formation",
      "particle-formation": "nucleosynthesis",
      "nucleosynthesis": null
    };
    
    if (stage in stageTiming && stageTiming[stage] !== null) {
      timer = setTimeout(() => setStage(nextStage[stage]), stageTiming[stage]);
    }
    
    return () => clearTimeout(timer);
  }, [stage, paused, autoPlay]);

  const stageMapping = {
    "pre-bigbang": "Pre-Big Bang (Empty Spacetime)",
    "quantum-fluctuations": "Quantum Fluctuations (10⁻⁴³ s)",
    "inflation": "Cosmic Inflation (10⁻³⁶ to 10⁻³² s)",
    "reheating": "Reheating (10⁻³² to 10⁻¹² s)",
    "particle-formation": "Particle Formation (10⁻¹² to 10⁻⁶ s)",
    "nucleosynthesis": "Nucleosynthesis (1s to 3 minutes)"
  };

  const stageInfo = {
    "pre-bigbang": "Before the Big Bang, spacetime exists in a quantum vacuum state. No matter or energy as we understand it exists yet.",
    "quantum-fluctuations": "Quantum fluctuations represent tiny variations in energy that appear and disappear due to the Heisenberg uncertainty principle, setting the stage for the birth of our universe.",
    "inflation": "During cosmic inflation, the universe expanded exponentially, doubling in size every 10⁻³⁴ seconds. This rapid expansion smoothed out irregularities but preserved quantum fluctuations that would later form galaxies.",
    "reheating": "As inflation ended, the energy that drove it was converted into a hot, dense plasma of particles and radiation, reheating the universe to extreme temperatures.",
    "particle-formation": "As the universe cooled, quarks combined to form protons and neutrons. Electrons, photons, and neutrinos also emerged during this era.",
    "nucleosynthesis": "Within the first three minutes after the Big Bang, protons and neutrons fused to form the nuclei of light elements: primarily hydrogen (75%) and helium (25%), with trace amounts of lithium."
  };

  const handleStageChange = (newStage) => {
    setStage(newStage);
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
    <div className="w-full h-screen bg-black relative">
      {/* Timeline navigation */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-10 bg-black bg-opacity-70 p-4 rounded-lg flex flex-col items-center">
        <div className="flex space-x-2 mb-4">
          <button 
            onClick={togglePause} 
            className="px-3 py-1 rounded bg-indigo-700 hover:bg-indigo-600 text-white text-sm">
            {paused ? "Resume" : "Pause"}
          </button>
          <button 
            onClick={toggleAutoPlay} 
            className="px-3 py-1 rounded bg-indigo-700 hover:bg-indigo-600 text-white text-sm">
            {autoPlay ? "Manual Control" : "Auto Play"}
          </button>
          <button 
            onClick={toggleInfo} 
            className="px-3 py-1 rounded bg-indigo-700 hover:bg-indigo-600 text-white text-sm">
            {showInfo ? "Hide Info" : "Show Info"}
          </button>
        </div>
        <div className="flex justify-between w-full space-x-2">
          {Object.keys(stageMapping).map((key) => (
            <button
              key={key}
              onClick={() => handleStageChange(key)}
              className={`px-2 py-1 text-xs rounded-full ${stage === key ? 'bg-indigo-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
            >
              {key.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Current stage and info */}
      <div className="absolute top-4 left-4 text-white z-10 p-2 rounded">
        <div className="bg-black bg-opacity-70 p-4 rounded-lg">
          <h2 className="text-xl font-bold mb-1">{stageMapping[stage]}</h2>
          {showInfo && (
            <p className="text-sm max-w-md">{stageInfo[stage]}</p>
          )}
        </div>
      </div>

      {/* Camera controls info */}
      <div className="absolute top-4 right-4 text-white z-10 bg-black bg-opacity-70 p-2 rounded text-xs">
        <p>Mouse drag: Rotate view</p>
        <p>Scroll: Zoom in/out</p>
        <p>Right-click drag: Pan</p>
      </div>

      <Canvas camera={{ position: [0, 0, 35], fov: 60 }}>
        <color attach="background" args={["#000000"]} />
        {stage !== "pre-bigbang" && (
          <>
            <ambientLight intensity={0.1} />
            <pointLight 
              position={[0, 0, 0]} 
              intensity={3} 
              color={stage === "reheating" ? "#ffffff" : "#ffaa44"} 
              distance={100}
            />
            <Universe stage={stage} paused={paused} />
            <OrbitControls 
              enablePan={true}
              enableZoom={true}
              enableRotate={true}
              minDistance={5}
              maxDistance={100}
            />
          </>
        )}
        {stage === "pre-bigbang" && (
          <>
            <Text
              position={[0, 0, 0]}
              color="white"
              fontSize={1.5}
              material-toneMapped={false}
              anchorX="center"
              anchorY="middle"
            >
              Pre-Big Bang
            </Text>
            <OrbitControls 
              enablePan={true}
              enableZoom={true}
              enableRotate={true}
            />
          </>
        )}
      </Canvas>
    </div>
  );
};

const Universe = ({ stage, paused }) => {
  // Store time elapsed inside the Canvas component
  const [timeElapsed, setTimeElapsed] = useState(0);
  
  // Update simulation time only when not paused
  useFrame((_, delta) => {
    if (!paused) {
      setTimeElapsed(prev => prev + delta);
    }
  });
  
  // Different particle systems for different phases
  const quantumRef = useRef();
  const inflationRef = useRef();
  const particlesRef = useRef();
  
  // Quantum fluctuation particles (very few, subtle)
  const quantumCount = 200;
  const quantumData = useMemo(() => {
    const positions = new Float32Array(quantumCount * 3);
    const sizes = new Float32Array(quantumCount);
    const colors = new Float32Array(quantumCount * 3);
    
    for (let i = 0; i < quantumCount; i++) {
      // All positions initialized to zero (will be updated in animation)
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;
      
      sizes[i] = 0.1;
      
      // Light blue color with slight variation
      colors[i * 3] = 0.6 + Math.random() * 0.2;     // Red
      colors[i * 3 + 1] = 0.7 + Math.random() * 0.2; // Green
      colors[i * 3 + 2] = 0.9 + Math.random() * 0.1; // Blue
    }
    
    return { positions, sizes, colors };
  }, []);
  
  // Inflation particles (rapidly expanding)
  const inflationCount = 10000;
  const inflationData = useMemo(() => {
    const positions = new Float32Array(inflationCount * 3);
    const colors = new Float32Array(inflationCount * 3);
    const sizes = new Float32Array(inflationCount);
    
    for (let i = 0; i < inflationCount; i++) {
      // All starting at center point
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;
      
      // High energy blue-white
      colors[i * 3] = 0.7 + Math.random() * 0.2;     // Red
      colors[i * 3 + 1] = 0.7 + Math.random() * 0.2; // Green
      colors[i * 3 + 2] = 0.8 + Math.random() * 0.2; // Blue
      
      sizes[i] = 0.03 + Math.random() * 0.03;
    }
    
    return { positions, colors, sizes };
  }, []);
  
  // Main particle system (matter formation)
  const particleCount = 30000;
  const particleData = useMemo(() => {
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const velocities = new Float32Array(particleCount * 3);
    const types = new Uint8Array(particleCount); // 0=hydrogen, 1=helium, 2=electrons, etc.
    
    for (let i = 0; i < particleCount; i++) {
      // All starting at origin point for now
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;
      
      // Initial velocities (will be proper expanded in inflation)
      velocities[i * 3] = (Math.random() - 0.5) * 0.001;
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.001;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.001;
      
      // Initial high-energy state (blue/white)
      colors[i * 3] = 0.7 + Math.random() * 0.2;     // Red
      colors[i * 3 + 1] = 0.7 + Math.random() * 0.2; // Green
      colors[i * 3 + 2] = 0.8 + Math.random() * 0.2; // Blue
      
      // Varied particle sizes
      sizes[i] = Math.random() * 0.05 + 0.01;
      
      // Assign particle types with proper distribution
      // 75% hydrogen, 24% helium, 1% heavier elements for nucleosynthesis
      const typeRoll = Math.random();
      if (typeRoll < 0.75) {
        types[i] = 0; // hydrogen
      } else if (typeRoll < 0.99) {
        types[i] = 1; // helium
      } else {
        types[i] = 2; // heavier elements
      }
    }
    
    return { positions, colors, sizes, velocities, types };
  }, []);
  
  // Custom texture creation for particles
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
  
  // Animate quantum fluctuations - tiny, ephemeral particle/antiparticle pairs
  useFrame((_, delta) => {
    if (paused) return;
    
    if (stage === "quantum-fluctuations" && quantumRef.current) {
      const positions = quantumRef.current.geometry.attributes.position.array;
      const colors = quantumRef.current.geometry.attributes.color.array;
      const sizes = quantumRef.current.geometry.attributes.size.array;
      
      for (let i = 0; i < quantumCount; i++) {
        const idx = i * 3;
        
        // Quantum fluctuation simulation: particles appear and disappear randomly
        // Heisenberg uncertainty principle visualization
        if (Math.random() < 0.1) {
          // New random position near center (very small radius)
          const r = Math.random() * 2;
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos((Math.random() * 2) - 1);
          
          positions[idx] = r * Math.sin(phi) * Math.cos(theta) * 0.5;
          positions[idx + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.5;
          positions[idx + 2] = r * Math.cos(phi) * 0.5;
          
          // Change color slightly to show energy fluctuation
          colors[idx] = 0.6 + Math.random() * 0.3;     // Red
          colors[idx + 1] = 0.7 + Math.random() * 0.3; // Green
          colors[idx + 2] = 0.9 + Math.random() * 0.1; // Blue
          
          // Vary size slightly
          sizes[i] = 0.05 + Math.random() * 0.1;
        } else if (Math.random() < 0.15) {
          // Some particles disappear (reset to origin)
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
  
  // Animate inflation - exponential expansion
  useFrame((_, delta) => {
    if (paused) return;
    
    if ((stage === "inflation" || stage === "reheating") && inflationRef.current) {
      const positions = inflationRef.current.geometry.attributes.position.array;
      const sizes = inflationRef.current.geometry.attributes.size.array;
      const colors = inflationRef.current.geometry.attributes.color.array;
      
      // Early inflation is *extremely* rapid
      const expansionRate = stage === "inflation" ? 1.3 : 1.05;
      
      for (let i = 0; i < inflationCount; i++) {
        const idx = i * 3;
        const x = positions[idx];
        const y = positions[idx + 1];
        const z = positions[idx + 2];
        
        if (stage === "inflation") {
          // If at origin, initialize with random direction
          if (x === 0 && y === 0 && z === 0 && Math.random() < 0.4) {
            const r = 0.1;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos((Math.random() * 2) - 1);
            
            positions[idx] = r * Math.sin(phi) * Math.cos(theta);
            positions[idx + 1] = r * Math.sin(phi) * Math.sin(theta);
            positions[idx + 2] = r * Math.cos(phi);
          } 
          // Otherwise expand rapidly
          else if (x !== 0 || y !== 0 || z !== 0) {
            positions[idx] *= expansionRate;
            positions[idx + 1] *= expansionRate;
            positions[idx + 2] *= expansionRate;
          }
        } 
        // Reheating phase - slower expansion, particles start to interact
        else if (stage === "reheating") {
          if (x !== 0 || y !== 0 || z !== 0) {
            positions[idx] *= expansionRate;
            positions[idx + 1] *= expansionRate;
            positions[idx + 2] *= expansionRate;
            
            // Color shift toward hotter as energy is released
            colors[idx] = Math.min(1.0, colors[idx] + 0.01);     // Red
            colors[idx + 1] = Math.min(1.0, colors[idx + 1] + 0.01); // Green
            
            // Particles brighten during reheating
            sizes[i] = Math.min(0.15, sizes[i] + 0.001);
          }
        }
      }
      
      inflationRef.current.geometry.attributes.position.needsUpdate = true;
      inflationRef.current.geometry.attributes.color.needsUpdate = true;
      inflationRef.current.geometry.attributes.size.needsUpdate = true;
    }
  });
  
  // Animate particle formation and nucleosynthesis
  useFrame((_, delta) => {
    if (paused) return;
    
    if ((stage === "particle-formation" || stage === "nucleosynthesis") && particlesRef.current) {
      const positions = particlesRef.current.geometry.attributes.position.array;
      const colors = particlesRef.current.geometry.attributes.color.array;
      const sizes = particlesRef.current.geometry.attributes.size.array;
      
      // Different expansion characteristics
      const expansionRate = stage === "particle-formation" ? 1.02 : 1.008;
      
      for (let i = 0; i < particleCount; i++) {
        const idx = i * 3;
        const x = positions[idx];
        const y = positions[idx + 1];
        const z = positions[idx + 2];
        const particleType = particleData.types[i];
        
        // If at origin, initialize with proper distribution
        if ((x === 0 && y === 0 && z === 0) && Math.random() < 0.2) {
          // Calculate distribution based on physics of early universe
          // Slightly non-uniform distribution to simulate quantum fluctuations
          const r = Math.pow(Math.random(), 0.5) * 5;
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos((Math.random() * 2) - 1);
          
          // Add density variations - these become the seeds of future cosmic structure
          const perturbation = (
            Math.sin(theta * 5) * Math.cos(phi * 3) * 0.1 + 
            Math.sin(theta * 7) * Math.sin(phi * 4) * 0.05
          );
          
          positions[idx] = (r + perturbation) * Math.sin(phi) * Math.cos(theta);
          positions[idx + 1] = (r + perturbation) * Math.sin(phi) * Math.sin(theta);
          positions[idx + 2] = (r + perturbation) * Math.cos(phi);
          
          // Initial velocity in radial direction with slight tangential component
          const speed = 0.002 * (1 + Math.random() * 0.2);
          const tangentialFactor = 0.2 * Math.random();
          
          // Radial component
          const radialVx = positions[idx] * speed;
          const radialVy = positions[idx + 1] * speed;
          const radialVz = positions[idx + 2] * speed;
          
          // Tangential component (cross product with arbitrary up vector)
          const upX = 0;
          const upY = 1;
          const upZ = 0;
          
          const tangentialVx = (radialVy * upZ - radialVz * upY) * tangentialFactor;
          const tangentialVy = (radialVz * upX - radialVx * upZ) * tangentialFactor;
          const tangentialVz = (radialVx * upY - radialVy * upX) * tangentialFactor;
          
          particleData.velocities[idx] = radialVx + tangentialVx;
          particleData.velocities[idx + 1] = radialVy + tangentialVy;
          particleData.velocities[idx + 2] = radialVz + tangentialVz;
        } 
        // Otherwise apply expansion and evolution
        else if (x !== 0 || y !== 0 || z !== 0) {
          // Apply Hubble-like expansion
          positions[idx] *= expansionRate;
          positions[idx + 1] *= expansionRate;
          positions[idx + 2] *= expansionRate;
          
          // Add velocity contribution for realistic motion
          positions[idx] += particleData.velocities[idx];
          positions[idx + 1] += particleData.velocities[idx + 1];
          positions[idx + 2] += particleData.velocities[idx + 2];
          
          // Color evolution - universe cooling as it expands
          if (stage === "particle-formation") {
            // During particle formation, colors shift from blue-white to yellow-white
            // as universe cools from quark epoch to hadron epoch
            colors[idx] = Math.min(0.95, colors[idx] + 0.002);     // Red increases
            colors[idx + 1] = Math.min(0.95, colors[idx + 1] + 0.001); // Green increases
            colors[idx + 2] = Math.max(0.7, colors[idx + 2] - 0.001); // Blue decreases
          } else if (stage === "nucleosynthesis") {
            // During nucleosynthesis, colors differ by element
            if (particleType === 0) { // Hydrogen - more blue
              colors[idx] = 0.6 + Math.random() * 0.1;      // Red
              colors[idx + 1] = 0.7 + Math.random() * 0.1;  // Green 
              colors[idx + 2] = 0.9 + Math.random() * 0.1;  // Blue
            } else if (particleType === 1) { // Helium - more yellow/white
              colors[idx] = 0.8 + Math.random() * 0.1;      // Red
              colors[idx + 1] = 0.8 + Math.random() * 0.1;  // Green
              colors[idx + 2] = 0.6 + Math.random() * 0.1;  // Blue
            } else { // Heavier elements - reddish
              colors[idx] = 0.9 + Math.random() * 0.1;      // Red
              colors[idx + 1] = 0.3 + Math.random() * 0.2;  // Green
              colors[idx + 2] = 0.1 + Math.random() * 0.1;  // Blue
              sizes[i] = 0.08 + Math.random() * 0.04;        // Slightly larger
            }
            
            // Create small density variations - protogalactic clouds
            if (Math.random() < 0.0001) {
              // Create a small cluster
              for (let j = 0; j < 10; j++) {
                if (i + j < particleCount) {
                  // Move some nearby particles closer together
                  const targetIdx = (i + j) * 3;
                  if (positions[targetIdx] !== 0) { // Make sure particle is active
                    // Make velocity slightly convergent to create clumping
                    const dist = Math.sqrt(
                      positions[targetIdx] * positions[targetIdx] +
                      positions[targetIdx + 1] * positions[targetIdx + 1] +
                      positions[targetIdx + 2] * positions[targetIdx + 2]
                    );
                    
                    const centerX = positions[idx];
                    const centerY = positions[idx + 1];
                    const centerZ = positions[idx + 2];
                    
                    // Add a small attraction to this center
                    particleData.velocities[targetIdx] += (centerX - positions[targetIdx]) * 0.0001;
                    particleData.velocities[targetIdx + 1] += (centerY - positions[targetIdx + 1]) * 0.0001;
                    particleData.velocities[targetIdx + 2] += (centerZ - positions[targetIdx + 2]) * 0.0001;
                  }
                }
              }
            }
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
      {/* Quantum fluctuations */}
      {stage === "quantum-fluctuations" && (
        <Points ref={quantumRef} positions={quantumData.positions} sizes={quantumData.sizes} colors={quantumData.colors}>
          <PointMaterial 
            size={0.1} 
            sizeAttenuation={true} 
            vertexColors
            transparent
            opacity={0.7}
            alphaMap={particleTexture}
            depthWrite={false}
          />
        </Points>
      )}
      
      {/* Inflation particles */}
      {(stage === "inflation" || stage === "reheating") && (
        <Points 
          ref={inflationRef}
          positions={inflationData.positions}
          colors={inflationData.colors}
          sizes={inflationData.sizes}
        >
          <PointMaterial 
            size={0.08} 
            sizeAttenuation={true} 
            vertexColors
            transparent
            alphaMap={particleTexture}
            depthWrite={false}
          />
        </Points>
      )}
      
      {/* Particle formation and nucleosynthesis */}
      {(stage === "particle-formation" || stage === "nucleosynthesis") && (
        <Points 
          ref={particlesRef}
          positions={particleData.positions}
          colors={particleData.colors}
          sizes={particleData.sizes}
        >
          <PointMaterial 
            size={0.06} 
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