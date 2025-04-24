import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

const BigBangSimulation = () => {
  const mountRef = useRef(null);
  const [simulationTime, setSimulationTime] = useState(0);
  const [simulationStage, setSimulationStage] = useState('Pre-Big Bang');
  const simulationRef = useRef({
    scene: null,
    camera: null,
    renderer: null,
    particles: null,
    galaxies: [],
    animationFrameId: null,
    clock: new THREE.Clock(),
    elapsedTime: 0
  });

  const constants = {
    inflationRate: 1.3,
    particleCount: 50000,
    quantumFluctuation: 0.5,
    matterRatio: 1.0001,
    darkMatterStrength: 0.3
  };

  useEffect(() => {
    const simulation = simulationRef.current;
    const mount = mountRef.current;

    // Scene setup
    simulation.scene = new THREE.Scene();
    
    // 2D Orthographic camera
    const aspect = window.innerWidth / window.innerHeight;
    simulation.camera = new THREE.OrthographicCamera(
      -aspect * 100,
      aspect * 100,
      100,
      -100,
      0.1,
      1000
    );
    simulation.camera.position.z = 10;

    // Renderer setup
    simulation.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance"
    });
    simulation.renderer.setSize(window.innerWidth, window.innerHeight);
    mount.appendChild(simulation.renderer.domElement);

    // Initialize particles
    initParticles();

    // Handle window resize
    const handleResize = () => {
      const aspect = window.innerWidth / window.innerHeight;
      simulation.camera.left = -aspect * 100;
      simulation.camera.right = aspect * 100;
      simulation.camera.top = 100;
      simulation.camera.bottom = -100;
      simulation.camera.updateProjectionMatrix();
      simulation.renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);
    startAnimationLoop();

    return () => {
      window.removeEventListener('resize', handleResize);
      stopAnimationLoop();
      mount.removeChild(simulation.renderer.domElement);
      simulation.renderer.dispose();
    };
  }, []);

  const initParticles = () => {
    const simulation = simulationRef.current;
    
    // Create 2D particle system
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(constants.particleCount * 2);
    const colors = new Float32Array(constants.particleCount * 3);
    const velocities = new Float32Array(constants.particleCount * 2);

    for (let i = 0; i < constants.particleCount; i++) {
      // Start clustered in center
      positions[i * 2] = (Math.random() - 0.5) * 0.1;
      positions[i * 2 + 1] = (Math.random() - 0.5) * 0.1;
      
      // Initial velocities
      velocities[i * 2] = (Math.random() - 0.5) * 0.05;
      velocities[i * 2 + 1] = (Math.random() - 0.5) * 0.05;
      
      // Colors based on type
      colors[i * 3] = Math.random() > 0.5 ? 1 : 0.8; // R
      colors[i * 3 + 1] = Math.random() > 0.5 ? 0.6 : 0.3; // G
      colors[i * 3 + 2] = Math.random() > 0.5 ? 0.4 : 0.1; // B
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 2));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 2));

    const material = new THREE.PointsMaterial({
      size: 0.1,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: false
    });

    simulation.particles = new THREE.Points(geometry, material);
    simulation.scene.add(simulation.particles);
  };

  const startAnimationLoop = () => {
    const simulation = simulationRef.current;
    
    const animate = () => {
      updateSimulation();
      simulation.renderer.render(simulation.scene, simulation.camera);
      simulation.animationFrameId = requestAnimationFrame(animate);
    };
    
    animate();
  };

  const stopAnimationLoop = () => {
    cancelAnimationFrame(simulationRef.current.animationFrameId);
  };

  const updateSimulation = () => {
    const simulation = simulationRef.current;
    const delta = simulation.clock.getDelta();
    simulation.elapsedTime += delta;
    setSimulationTime(simulation.elapsedTime);

    const positions = simulation.particles.geometry.attributes.position.array;
    const velocities = simulation.particles.geometry.attributes.velocity.array;
    const colors = simulation.particles.geometry.attributes.color.array;

    // Simulation stages
    if (simulation.elapsedTime < 1) {
      setSimulationStage('Singularity');
      handleSingularityPhase(positions, velocities);
    } else if (simulation.elapsedTime < 3) {
      setSimulationStage('Inflation');
      handleInflationPhase(positions, velocities);
    } else if (simulation.elapsedTime < 8) {
      setSimulationStage('Particle Formation');
      handleParticleFormation(positions, colors);
    } else if (simulation.elapsedTime < 15) {
      setSimulationStage('Structure Formation');
      handleStructureFormation(positions, colors);
    } else {
      setSimulationStage('Galaxy Formation');
      handleGalaxyFormation();
    }

    // Update particle positions
    for (let i = 0; i < positions.length; i += 2) {
      positions[i] += velocities[i] * delta * 10;
      positions[i + 1] += velocities[i + 1] * delta * 10;
    }

    simulation.particles.geometry.attributes.position.needsUpdate = true;
  };

  const handleSingularityPhase = (positions, velocities) => {
    // Add quantum fluctuations
    for (let i = 0; i < positions.length; i += 2) {
      velocities[i] += (Math.random() - 0.5) * 0.01;
      velocities[i + 1] += (Math.random() - 0.5) * 0.01;
    }
  };

  const handleInflationPhase = (positions, velocities) => {
    const inflationFactor = Math.pow(simulationRef.current.elapsedTime, 2) * 0.5;
    
    for (let i = 0; i < positions.length; i += 2) {
      const dx = positions[i];
      const dy = positions[i + 1];
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > 0) {
        const dirX = dx / distance;
        const dirY = dy / distance;
        
        // Expand outward with quantum fluctuations
        const expansion = inflationFactor * (1 + (Math.random() - 0.5) * constants.quantumFluctuation);
        positions[i] = dirX * expansion;
        positions[i + 1] = dirY * expansion;
      }
    }
  };

  const handleParticleFormation = (positions, colors) => {
    const structureFormation = simulationRef.current.elapsedTime - 3;
    
    for (let i = 0; i < positions.length; i += 2) {
      // Matter/antimatter annihilation
      if (Math.random() > constants.matterRatio) {
        colors[i/2 * 3] = 0.2;  // Fade out
        colors[i/2 * 3 + 1] = 0.2;
        colors[i/2 * 3 + 2] = 0.2;
      } else {
        // Cluster formation
        const clusterForce = Math.sin(structureFormation * 2) * 0.01;
        positions[i] += (Math.random() - 0.5) * clusterForce;
        positions[i + 1] += (Math.random() - 0.5) * clusterForce;
      }
    }
  };

  const handleStructureFormation = (positions, colors) => {
    const darkMatterInfluence = constants.darkMatterStrength * (simulationRef.current.elapsedTime - 8);
    
    for (let i = 0; i < positions.length; i += 2) {
      // Simulate dark matter gravitational wells
      const angle = Math.atan2(positions[i + 1], positions[i]);
      positions[i] += Math.cos(angle) * darkMatterInfluence * 0.01;
      positions[i + 1] += Math.sin(angle) * darkMatterInfluence * 0.01;
      
      // Color by density
      const density = Math.abs(positions[i]) + Math.abs(positions[i + 1]);
      colors[i/2 * 3] = 0.5 + density * 0.1;
      colors[i/2 * 3 + 1] = 0.3 + density * 0.05;
      colors[i/2 * 3 + 2] = 0.1 + density * 0.02;
    }
  };

  const handleGalaxyFormation = () => {
    const simulation = simulationRef.current;
    
    // Create spiral galaxy patterns
    if (simulation.galaxies.length < 20 && Math.random() < 0.01) {
      const galaxyGeometry = new THREE.BufferGeometry();
      const positions = new Float32Array(10000 * 2);
      const colors = new Float32Array(10000 * 3);

      for (let i = 0; i < 10000; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.pow(Math.random(), 2) * 50;
        const arm = Math.floor(Math.random() * 2) * Math.PI;
        
        positions[i * 2] = Math.cos(angle + arm) * radius;
        positions[i * 2 + 1] = Math.sin(angle + arm) * radius;
        
        // Star colors
        colors[i * 3] = 0.8 + Math.random() * 0.2;
        colors[i * 3 + 1] = 0.6 + Math.random() * 0.2;
        colors[i * 3 + 2] = 0.4 + Math.random() * 0.2;
      }

      galaxyGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 2));
      galaxyGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const galaxy = new THREE.Points(
        galaxyGeometry,
        new THREE.PointsMaterial({ size: 0.2, vertexColors: true })
      );

      galaxy.position.set(
        (Math.random() - 0.5) * 200,
        (Math.random() - 0.5) * 200,
        0
      );

      simulation.scene.add(galaxy);
      simulation.galaxies.push(galaxy);
    }

    // Rotate existing galaxies
    simulation.galaxies.forEach(galaxy => {
      galaxy.rotation += 0.001;
      galaxy.position.x += Math.sin(simulation.elapsedTime) * 0.01;
      galaxy.position.y += Math.cos(simulation.elapsedTime) * 0.01;
    });
  };

  return (
    <div className="relative w-full h-full">
      <div ref={mountRef} className="w-full h-full" />
      
      <div className="absolute top-4 left-4 p-3 bg-black bg-opacity-70 text-white rounded-lg">
        <h2 className="text-lg font-bold">Time: {simulationTime.toFixed(2)}s</h2>
        <p className="text-sm">Stage: {simulationStage}</p>
      </div>
    </div>
  );
};

export default BigBangSimulation;