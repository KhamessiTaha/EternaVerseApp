import { Canvas, useFrame } from "@react-three/fiber";
import { useRef, useState, useMemo, useEffect } from "react";
import { Points, PointMaterial, Text } from "@react-three/drei";
import * as THREE from "three";

const BigBangSimulation = () => {
  const [stage, setStage] = useState("pre-bigbang");

  useEffect(() => {
    // Start the simulation after a brief pause to show empty space
    const timer = setTimeout(() => {
      setStage("quantum-fluctuations");
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Progress through stages of the universe's evolution
  useEffect(() => {
    let timer;
    if (stage === "quantum-fluctuations") {
      timer = setTimeout(() => setStage("inflation"), 4000);
    } else if (stage === "inflation") {
      timer = setTimeout(() => setStage("reheating"), 3000);
    } else if (stage === "reheating") {
      timer = setTimeout(() => setStage("particle-formation"), 4000);
    } else if (stage === "particle-formation") {
      timer = setTimeout(() => setStage("nucleosynthesis"), 5000);
    }
    return () => clearTimeout(timer);
  }, [stage]);

  const stageMapping = {
    "pre-bigbang": "Pre-Big Bang (Empty Spacetime)",
    "quantum-fluctuations": "Quantum Fluctuations (10⁻⁴³ s)",
    "inflation": "Cosmic Inflation (10⁻³⁶ to 10⁻³² s)",
    "reheating": "Reheating (10⁻³² to 10⁻¹² s)",
    "particle-formation": "Particle Formation (10⁻¹² to 10⁻⁶ s)",
    "nucleosynthesis": "Nucleosynthesis (1s to 3 minutes)"
  };

  return (
    <div className="w-full h-screen bg-black relative">
      <div className="absolute top-4 left-4 text-white z-10 bg-black bg-opacity-70 p-2 rounded">
        {stageMapping[stage]}
      </div>
      <Canvas camera={{ position: [0, 0, 35], fov: 60 }}>
        {stage !== "pre-bigbang" && (
          <>
            <ambientLight intensity={0.1} />
            <pointLight position={[0, 0, 0]} intensity={3} color={stage === "reheating" ? "#ffffff" : "#ffaa44"} />
            <Universe stage={stage} />
          </>
        )}
      </Canvas>
    </div>
  );
};

const Universe = ({ stage }) => {
  // Store time elapsed inside the Canvas component
  const [timeElapsed, setTimeElapsed] = useState(0);
  
  // Update simulation time
  useFrame(() => {
    setTimeElapsed(prev => prev + 0.016); // ~60fps
  });
  
  // Different particle systems for different phases
  const quantumRef = useRef();
  const inflationRef = useRef();
  const particlesRef = useRef();
  
  // Quantum fluctuation particles (very few, subtle)
  const quantumCount = 100;
  const quantumData = useMemo(() => {
    const positions = new Float32Array(quantumCount * 3);
    const sizes = new Float32Array(quantumCount);
    
    for (let i = 0; i < quantumCount; i++) {
      // All positions initialized to zero (will be updated in animation)
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;
      
      sizes[i] = 0.1;
    }
    
    return { positions, sizes };
  }, []);
  
  // Inflation particles (rapidly expanding)
  const inflationCount = 5000;
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
      colors[i * 3] = 0.9;     // Red
      colors[i * 3 + 1] = 0.9; // Green
      colors[i * 3 + 2] = 1.0; // Blue
      
      sizes[i] = 0.05;
    }
    
    return { positions, colors, sizes };
  }, []);
  
  // Main particle system (matter formation)
  const particleCount = 20000;
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
      colors[i * 3] = 0.8;     // Red
      colors[i * 3 + 1] = 0.8; // Green
      colors[i * 3 + 2] = 1.0; // Blue
      
      // Varied particle sizes
      sizes[i] = Math.random() * 0.04 + 0.01;
      
      // Assign particle types with proper distribution
      // 75% hydrogen, 25% helium for nucleosynthesis (simplified)
      types[i] = Math.random() < 0.75 ? 0 : 1;
    }
    
    return { positions, colors, sizes, velocities, types };
  }, []);
  
  // Custom texture creation for particles
  const particleTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext("2d");
    
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
    gradient.addColorStop(0.2, "rgba(240, 240, 255, 0.8)");
    gradient.addColorStop(0.5, "rgba(160, 180, 255, 0.4)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
    
    return new THREE.CanvasTexture(canvas);
  }, []);
  
  // Animate quantum fluctuations - tiny, ephemeral particle/antiparticle pairs
  useFrame(() => {
    if (stage === "quantum-fluctuations" && quantumRef.current) {
      const positions = quantumRef.current.geometry.attributes.position.array;
      
      for (let i = 0; i < quantumCount; i++) {
        const idx = i * 3;
        
        // Quantum fluctuation simulation: particles appear and disappear randomly
        // Heisenberg uncertainty principle visualization
        if (Math.random() < 0.08) {
          // New random position near center (very small radius)
          const r = Math.random() * 1;
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos((Math.random() * 2) - 1);
          
          positions[idx] = r * Math.sin(phi) * Math.cos(theta) * 0.5;
          positions[idx + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.5;
          positions[idx + 2] = r * Math.cos(phi) * 0.5;
        } else if (Math.random() < 0.1) {
          // Some particles disappear (reset to origin)
          positions[idx] = 0;
          positions[idx + 1] = 0;
          positions[idx + 2] = 0;
        }
      }
      
      quantumRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });
  
  // Animate inflation - exponential expansion
  useFrame(() => {
    if ((stage === "inflation" || stage === "reheating") && inflationRef.current) {
      const positions = inflationRef.current.geometry.attributes.position.array;
      const sizes = inflationRef.current.geometry.attributes.size.array;
      const colors = inflationRef.current.geometry.attributes.color.array;
      
      // Early inflation is *extremely* rapid
      const expansionRate = stage === "inflation" ? 1.4 : 1.05;
      
      for (let i = 0; i < inflationCount; i++) {
        const idx = i * 3;
        const x = positions[idx];
        const y = positions[idx + 1];
        const z = positions[idx + 2];
        
        if (stage === "inflation") {
          // If at origin, initialize with random direction
          if (x === 0 && y === 0 && z === 0 && Math.random() < 0.3) {
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
            sizes[i] = Math.min(0.12, sizes[i] + 0.001);
          }
        }
      }
      
      inflationRef.current.geometry.attributes.position.needsUpdate = true;
      inflationRef.current.geometry.attributes.color.needsUpdate = true;
      inflationRef.current.geometry.attributes.size.needsUpdate = true;
    }
  });
  
  // Animate particle formation and nucleosynthesis
  useFrame(() => {
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
          const r = Math.pow(Math.random(), 0.5) * 2;
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos((Math.random() * 2) - 1);
          
          // Add small perturbations to create density variations
          // These become the seeds of future cosmic structure
          const perturbation = Math.sin(theta * 5) * Math.cos(phi * 3) * 0.1;
          
          positions[idx] = (r + perturbation) * Math.sin(phi) * Math.cos(theta);
          positions[idx + 1] = (r + perturbation) * Math.sin(phi) * Math.sin(theta);
          positions[idx + 2] = (r + perturbation) * Math.cos(phi);
          
          // Initial velocity in radial direction
          const speed = 0.001 * (1 + Math.random() * 0.1);
          particleData.velocities[idx] = positions[idx] * speed;
          particleData.velocities[idx + 1] = positions[idx + 1] * speed;
          particleData.velocities[idx + 2] = positions[idx + 2] * speed;
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
            colors[idx] = Math.min(1.0, colors[idx] + 0.002);  // Red increases
            colors[idx + 1] = Math.min(1.0, colors[idx + 1] + 0.001); // Green increases
            colors[idx + 2] = Math.max(0.7, colors[idx + 2] - 0.001); // Blue decreases
          } else if (stage === "nucleosynthesis") {
            // During nucleosynthesis, colors differ by element
            if (particleType === 0) { // Hydrogen - more blue
              colors[idx] = 0.7;      // Red
              colors[idx + 1] = 0.8;  // Green 
              colors[idx + 2] = 1.0;  // Blue
            } else { // Helium - more yellow/white
              colors[idx] = 0.9;      // Red
              colors[idx + 1] = 0.9;  // Green
              colors[idx + 2] = 0.7;  // Blue
            }
            
            // Small percentage forms heavier elements - shown as reddish
            if (Math.random() < 0.0001) {
              colors[idx] = 1.0;      // Red
              colors[idx + 1] = 0.4;  // Green
              colors[idx + 2] = 0.2;  // Blue
              sizes[i] = 0.08;        // Slightly larger
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
        <Points ref={quantumRef} positions={quantumData.positions} sizes={quantumData.sizes}>
          <PointMaterial 
            size={0.05} 
            sizeAttenuation={true} 
            color="#aabbff" 
            transparent
            opacity={0.6}
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
            size={0.05} 
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
            size={0.05} 
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