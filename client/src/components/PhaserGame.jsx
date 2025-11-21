import React, { useEffect, useRef, useState } from "react";
import Phaser from "phaser";
import seedrandom from "seedrandom";

// Configuration constants
const CHUNK_SIZE = 1000;
const UNIVERSE_SIZE = 100000;
const MINIMAP_SIZE = 150;
const ANOMALIES_PER_CHUNK = 2; // Average anomalies per chunk
const ANOMALY_SPAWN_CHANCE = 0.3; // 30% chance per chunk

// Helper functions
const getChunkCoords = (x, y) => ({
  chunkX: Math.floor(x / CHUNK_SIZE),
  chunkY: Math.floor(y / CHUNK_SIZE),
});

const getChunkKey = (x, y) => `${x}:${y}`;

// Anomaly types with gameplay characteristics
const ANOMALY_TYPES = [
  { 
    type: 'blackHoleMerger', 
    color: 0x9900ff, 
    label: 'BLACK HOLE',
    baseRadius: 15,
    description: 'Gravitational anomaly detected'
  },
  { 
    type: 'darkEnergySurge', 
    color: 0x0066ff, 
    label: 'DARK ENERGY',
    baseRadius: 12,
    description: 'Spacetime distortion'
  },
  { 
    type: 'supernovaChain', 
    color: 0xff6600, 
    label: 'SUPERNOVA',
    baseRadius: 18,
    description: 'Stellar collapse cascade'
  },
  { 
    type: 'quantumTunneling', 
    color: 0x00ff99, 
    label: 'QUANTUM',
    baseRadius: 10,
    description: 'Quantum instability'
  },
  { 
    type: 'cosmicString', 
    color: 0xff0066, 
    label: 'COSMIC STRING',
    baseRadius: 14,
    description: 'Topological defect'
  }
];

const PhaserGame = ({ universe, onAnomalyResolved }) => {
  const gameRef = useRef(null);
  const [stats, setStats] = useState({
    resolved: 0,
    discovered: 0
  });

  useEffect(() => {
    const rng = seedrandom(universe.seed);

    const config = {
      type: Phaser.AUTO,
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: "#000000",
      parent: "phaser-container",
      physics: {
        default: "arcade",
        arcade: {
          gravity: { y: 0 },
          debug: false,
        },
      },
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      scene: {
        preload,
        create,
        update,
      },
    };

    function preload() {
      this.load.image("Player", "/assets/Player.png");
    }

    function create() {
      // Scene state
      this.minimapX = 0;
      this.minimapY = 0;
      this.discoveredAnomalies = new Set();
      this.resolvedAnomalies = new Set();

      // Player setup
      this.player = this.physics.add
        .sprite(0, 0, "Player")
        .setScale(0.05)
        .setDamping(true)
        .setDrag(0.98)
        .setMaxVelocity(400)
        .setCollideWorldBounds(false);

      this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
      this.cameras.main.setZoom(1.5);

      // Lighting system
      this.lights.enable().setAmbientColor(0x0a0a0a);
      this.player.setPipeline("Light2D");
      this.playerLight = this.lights.addLight(0, 0, 250).setIntensity(2.5);

      // Input
      this.cursors = this.input.keyboard.addKeys({
        up: Phaser.Input.Keyboard.KeyCodes.W,
        down: Phaser.Input.Keyboard.KeyCodes.S,
        left: Phaser.Input.Keyboard.KeyCodes.A,
        right: Phaser.Input.Keyboard.KeyCodes.D,
        z: Phaser.Input.Keyboard.KeyCodes.Z,
        q: Phaser.Input.Keyboard.KeyCodes.Q,
        s2: Phaser.Input.Keyboard.KeyCodes.S,
        d2: Phaser.Input.Keyboard.KeyCodes.D,
      });
      this.fixKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
      this.mapKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);

      // Touch controls
      this.arrowStates = { up: false, down: false, left: false, right: false };
      this.createTouchControls();

      // Chunk system
      this.loadedChunks = new Map();
      this.activeChunkRadius = 2;
      this.currentChunk = getChunkCoords(this.player.x, this.player.y);

      // Initialize chunk loading
      this.loadNearbyChunks(this.currentChunk.chunkX, this.currentChunk.chunkY);

      // UI Setup
      this.showFullMap = false;
      this.createUI();
      this.updateUIPositions();

      // Resize handling
      this.scale.on('resize', () => {
        this.updateUIPositions();
        if (this.showFullMap) this.renderFullMap();
      });

      this.renderFullMap();
    }

    function update() {
      // Player movement
      const speed = 250;
      const isMovingLeft = this.cursors.left.isDown || this.cursors.q.isDown || this.arrowStates.left;
      const isMovingRight = this.cursors.right.isDown || this.cursors.d2.isDown || this.arrowStates.right;
      const isMovingUp = this.cursors.up.isDown || this.cursors.z.isDown || this.arrowStates.up;
      const isMovingDown = this.cursors.down.isDown || this.cursors.s2.isDown || this.arrowStates.down;

      this.player.setAcceleration(
        isMovingLeft ? -speed : isMovingRight ? speed : 0,
        isMovingUp ? -speed : isMovingDown ? speed : 0
      );

      // Update player light
      this.playerLight.setPosition(this.player.x, this.player.y);

      // Update HUD
      const velocity = Math.sqrt(
        this.player.body.velocity.x ** 2 + this.player.body.velocity.y ** 2
      );
      this.velocityText.setText(`VELOCITY: ${velocity.toFixed(1)} u/s`);
      this.coordText.setText(
        `COORDINATES: X:${this.player.x.toFixed(0)} Y:${this.player.y.toFixed(0)}`
      );

      // Chunk management
      const newChunk = getChunkCoords(this.player.x, this.player.y);
      if (newChunk.chunkX !== this.currentChunk.chunkX ||
          newChunk.chunkY !== this.currentChunk.chunkY) {
        this.currentChunk = newChunk;
        this.loadNearbyChunks(newChunk.chunkX, newChunk.chunkY);
      }

      // Anomaly interaction
      this.handleAnomalyInteraction();

      // Map toggle
      if (Phaser.Input.Keyboard.JustDown(this.mapKey)) {
        this.showFullMap = !this.showFullMap;
        this.fullMapContainer.setVisible(this.showFullMap);
        this.renderFullMap();
      }

      // Update minimap
      this.updateMinimap();
    }

    // Chunk loading system
    const loadNearbyChunks = function(centerX, centerY) {
      const newChunks = new Map();
      const radius = this.activeChunkRadius;

      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          const chunkX = centerX + dx;
          const chunkY = centerY + dy;
          const key = getChunkKey(chunkX, chunkY);

          if (!this.loadedChunks.has(key)) {
            const chunk = this.generateChunk(chunkX, chunkY);
            newChunks.set(key, chunk);
          } else {
            newChunks.set(key, this.loadedChunks.get(key));
          }
        }
      }

        
      // Cleanup old chunks
      this.loadedChunks.forEach((chunk, key) => {
        if (!newChunks.has(key)) {
          chunk.galaxies.forEach(obj => obj.destroy());
          chunk.anomalies.forEach(anom => {
            anom.entity?.destroy();
            anom.glow?.destroy();
            if (anom.light) this.lights.removeLight(anom.light);
            anom.interactionText?.destroy();
          });
        }
      });
      this.loadedChunks = newChunks;
    };

    const generateChunk = function(chunkX, chunkY) {
      const chunk = { galaxies: [], anomalies: [] };
      const chunkSeed = universe.seed + getChunkKey(chunkX, chunkY);
      const chunkRNG = seedrandom(chunkSeed);

      // Generate galaxies (visual environment)
      const galaxyCount = 15 + Math.floor(chunkRNG() * 10);
      for (let i = 0; i < galaxyCount; i++) {
        const x = chunkX * CHUNK_SIZE + chunkRNG() * CHUNK_SIZE;
        const y = chunkY * CHUNK_SIZE + chunkRNG() * CHUNK_SIZE;
        const size = chunkRNG() * 25 + 8;
        const hue = chunkRNG() * 360;
        const color = Phaser.Display.Color.HSVColorWheel()[Math.floor(hue)];

        const galaxy = this.add.graphics({ x, y })
          .fillStyle(Phaser.Display.Color.GetColor(color.r, color.g, color.b), 0.8)
          .fillCircle(0, 0, size)
          .setDepth(-1)
          .setPipeline("Light2D");

        // Add subtle glow to larger galaxies
        if (size > 20) {
          this.lights.addLight(x, y, size * 8, 
            Phaser.Display.Color.GetColor(color.r, color.g, color.b), 0.3);
        }

        chunk.galaxies.push(galaxy);
      }

      // Generate procedural anomalies
      if (chunkRNG() < ANOMALY_SPAWN_CHANCE) {
        const anomalyCount = Math.floor(chunkRNG() * ANOMALIES_PER_CHUNK) + 1;
        
        for (let i = 0; i < anomalyCount; i++) {
          const anomalyType = ANOMALY_TYPES[Math.floor(chunkRNG() * ANOMALY_TYPES.length)];
          const severity = Math.floor(chunkRNG() * 5) + 1;
          
          const x = chunkX * CHUNK_SIZE + chunkRNG() * CHUNK_SIZE;
          const y = chunkY * CHUNK_SIZE + chunkRNG() * CHUNK_SIZE;
          
          // Create unique ID for this anomaly
          const anomalyId = `${chunkX}:${chunkY}:${i}`;
          
          // Skip if already resolved
          if (this.resolvedAnomalies.has(anomalyId)) continue;

          const anomaly = this.createAnomaly(x, y, anomalyType, severity, anomalyId);
          chunk.anomalies.push(anomaly);
          
          // Track discovery
          if (!this.discoveredAnomalies.has(anomalyId)) {
            this.discoveredAnomalies.add(anomalyId);
            setStats(prev => ({ ...prev, discovered: prev.discovered + 1 }));
          }
        }
      }

      return chunk;
    };

    const createAnomaly = function(x, y, type, severity, id) {
      const radius = type.baseRadius + severity * 2;
      
      // Main anomaly body
      const entity = this.add.graphics({ x, y })
        .fillStyle(type.color, 0.7)
        .fillCircle(0, 0, radius)
        .lineStyle(2, type.color, 1)
        .strokeCircle(0, 0, radius)
        .setPipeline("Light2D")
        .setDepth(10);

      // Animated glow
      const glow = this.add.graphics({ x, y })
        .fillStyle(type.color, 0.3)
        .fillCircle(0, 0, radius * 1.8)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setPipeline("Light2D")
        .setDepth(9);

      this.tweens.add({
        targets: glow,
        scaleX: 1.3,
        scaleY: 1.3,
        alpha: 0.6,
        duration: 1500 + severity * 200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });

      // Dynamic light
      const light = this.lights.addLight(x, y, radius * 12, type.color, 1.2);
      
      // Add pulsing to light
      this.tweens.add({
        targets: light,
        intensity: { from: 1.2, to: 2.0 },
        duration: 2000 + severity * 300,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });

      // Interaction prompt
      const interactionText = this.add.text(x, y - radius - 25, 
        `[${type.label}]\nPRESS F TO RESOLVE`, {
        font: 'bold 11px Courier',
        fill: "#00ff00",
        backgroundColor: "#000000",
        padding: { x: 6, y: 3 },
        align: "center",
        stroke: "#003300",
        strokeThickness: 2,
      }).setOrigin(0.5).setVisible(false).setDepth(1000);

      return {
        id,
        x,
        y,
        type: type.type,
        severity,
        radius,
        entity,
        glow,
        light,
        interactionText,
        inRange: false,
        resolved: false
      };
    };

    const handleAnomalyInteraction = function() {
      let nearestAnomaly = null;
      let minDist = Infinity;

      // Check all anomalies in loaded chunks
      this.loadedChunks.forEach(chunk => {
        chunk.anomalies.forEach(anom => {
          if (anom.resolved) return;
          
          const dist = Phaser.Math.Distance.Between(
            anom.x, anom.y, this.player.x, this.player.y
          );
          
          const interactionRange = anom.radius * 5;
          anom.inRange = dist < interactionRange;
          anom.interactionText?.setVisible(anom.inRange);
          
          if (anom.inRange && dist < minDist) {
            minDist = dist;
            nearestAnomaly = anom;
          }
        });
      });

      // Resolve anomaly
      if (nearestAnomaly && Phaser.Input.Keyboard.JustDown(this.fixKey)) {
        nearestAnomaly.resolved = true;
        this.resolvedAnomalies.add(nearestAnomaly.id);
        
        // Visual feedback
        this.cameras.main.shake(200, 0.005);
        
        // Particle effect
        const particles = this.add.particles(nearestAnomaly.x, nearestAnomaly.y, 'Player', {
          speed: { min: 50, max: 150 },
          scale: { start: 0.02, end: 0 },
          lifespan: 1000,
          quantity: 20,
          blendMode: 'ADD'
        });
        
        this.time.delayedCall(1000, () => particles.destroy());
        
        // Cleanup
        nearestAnomaly.entity.destroy();
        nearestAnomaly.glow.destroy();
        //nearestAnomaly.light.destroy(); !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        nearestAnomaly.interactionText?.destroy();
        
        // Update stats
        setStats(prev => ({ ...prev, resolved: prev.resolved + 1 }));
        
        // Callback to parent component
        if (onAnomalyResolved) {
          onAnomalyResolved({
            type: nearestAnomaly.type,
            severity: nearestAnomaly.severity,
            location: { x: nearestAnomaly.x, y: nearestAnomaly.y }
          });
        }
      }
    };

    const createTouchControls = function() {
      const createArrow = (x, y, rotation, direction) => {
        const g = this.add.graphics()
          .fillStyle(0x00ff00, 0.5)
          .fillTriangle(-15, 10, 15, 10, 0, -10)
          .setPosition(x, y)
          .setRotation(rotation)
          .setScrollFactor(0)
          .setDepth(1001)
          .setInteractive(
            new Phaser.Geom.Triangle(-15, 10, 15, 10, 0, -10), 
            Phaser.Geom.Triangle.Contains
          );

        g.on('pointerdown', () => {
          this.arrowStates[direction] = true;
          g.clear().fillStyle(0x00ff00, 1).fillTriangle(-15, 10, 15, 10, 0, -10);
        });
        g.on('pointerup', () => {
          this.arrowStates[direction] = false;
          g.clear().fillStyle(0x00ff00, 0.5).fillTriangle(-15, 10, 15, 10, 0, -10);
        });
        g.on('pointerout', () => {
          this.arrowStates[direction] = false;
          g.clear().fillStyle(0x00ff00, 0.5).fillTriangle(-15, 10, 15, 10, 0, -10);
        });

        return g;
      };

      this.arrowUp = createArrow(100, 100, 0, 'up');
      this.arrowDown = createArrow(100, 100, Math.PI, 'down');
      this.arrowLeft = createArrow(100, 100, -Math.PI / 2, 'left');
      this.arrowRight = createArrow(100, 100, Math.PI / 2, 'right');
    };

    const createUI = function() {
      // Minimap
      this.minimap = this.add.graphics().setScrollFactor(0).setDepth(1000);
      this.minimapBorder = this.add.graphics().setScrollFactor(0).setDepth(999);

      // Full map
      this.fullMapContainer = this.add.container(0, 0)
        .setScrollFactor(0).setDepth(2000).setVisible(false);
      this.fullMapBg = this.add.graphics().setScrollFactor(0);
      this.fullMapGraphics = this.add.graphics().setScrollFactor(0);
      this.fullMapContainer.add([this.fullMapBg, this.fullMapGraphics]);

      this.fullMapTitle = this.add.text(0, 0, '', {
        font: 'bold 18px Courier',
        fill: '#00ffff',
        stroke: '#003333',
        strokeThickness: 3,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2001).setVisible(false);

      this.fullMapInstruction = this.add.text(0, 0, '', {
        font: 'bold 14px Courier',
        fill: '#00ff00',
        backgroundColor: '#000000',
        padding: { x: 10, y: 5 },
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2001).setVisible(false);

      // HUD elements
      this.velocityText = this.add.text(10, 80, '', {
        font: 'bold 12px Courier',
        fill: '#00ff00',
        backgroundColor: '#000000',
        padding: { x: 6, y: 3 },
      }).setScrollFactor(0).setDepth(1001);

      this.coordText = this.add.text(10, 100, '', {
        font: 'bold 12px Courier',
        fill: '#00ffff',
        backgroundColor: '#000000',
        padding: { x: 6, y: 3 },
      }).setScrollFactor(0).setDepth(1001);

      this.mapToggleText = this.add.text(10, 120, 'PRESS M FOR FULL MAP', {
        font: 'bold 11px Courier',
        fill: '#ffff00',
        backgroundColor: '#000000',
        padding: { x: 6, y: 3 },
      }).setScrollFactor(0).setDepth(1001).setAlpha(0.8);
    };

    const updateUIPositions = function() {
      const w = this.scale.width;
      const h = this.scale.height;

      // Minimap
      this.minimapX = w - MINIMAP_SIZE - 20;
      this.minimapY = 20;

      // Touch controls
      const arrowY = h - 100;
      this.arrowUp?.setPosition(100, arrowY - 50);
      this.arrowDown?.setPosition(100, arrowY + 50);
      this.arrowLeft?.setPosition(50, arrowY);
      this.arrowRight?.setPosition(150, arrowY);

      // Full map
      this.fullMapTitle?.setPosition(w / 2, 40);
      this.fullMapInstruction?.setPosition(w / 2, h - 40);
    };

    const updateMinimap = function() {
      const mapX = this.minimapX;
      const mapY = this.minimapY;
      const scale = MINIMAP_SIZE / UNIVERSE_SIZE;

      this.minimap.clear();
      this.minimapBorder.clear();

      // Border
      this.minimapBorder
        .lineStyle(2, 0x00ffff, 0.8)
        .strokeRect(mapX - 2, mapY - 2, MINIMAP_SIZE + 4, MINIMAP_SIZE + 4);

      // Background
      this.minimap
        .fillStyle(0x000022, 0.95)
        .fillRect(mapX, mapY, MINIMAP_SIZE, MINIMAP_SIZE);

      // Galaxies
      this.loadedChunks.forEach(chunk => {
        chunk.galaxies.forEach(galaxy => {
          const mx = mapX + (galaxy.x + UNIVERSE_SIZE/2) * scale;
          const my = mapY + (galaxy.y + UNIVERSE_SIZE/2) * scale;
          if (mx >= mapX && mx <= mapX + MINIMAP_SIZE && 
              my >= mapY && my <= mapY + MINIMAP_SIZE) {
            this.minimap.fillStyle(0x666666, 0.6).fillCircle(mx, my, 1);
          }
        });
      });

      // Anomalies
      this.loadedChunks.forEach(chunk => {
        chunk.anomalies.forEach(anom => {
          if (!anom.resolved) {
            const mx = mapX + (anom.x + UNIVERSE_SIZE/2) * scale;
            const my = mapY + (anom.y + UNIVERSE_SIZE/2) * scale;
            if (mx >= mapX && mx <= mapX + MINIMAP_SIZE && 
                my >= mapY && my <= mapY + MINIMAP_SIZE) {
              const anomType = ANOMALY_TYPES.find(t => t.type === anom.type);
              this.minimap.fillStyle(anomType?.color || 0xff0000, 1).fillCircle(mx, my, 2);
            }
          }
        });
      });

      // Player
      const px = mapX + (this.player.x + UNIVERSE_SIZE/2) * scale;
      const py = mapY + (this.player.y + UNIVERSE_SIZE/2) * scale;
      this.minimap
        .fillStyle(0x00ffff, 1)
        .fillCircle(px, py, 3)
        .lineStyle(1, 0xffffff, 1)
        .strokeCircle(px, py, 3);
    };

    const renderFullMap = function() {
      if (!this.showFullMap) return;

      const width = this.scale.width;
      const height = this.scale.height;
      const padding = 50;
      const mapWidth = width - padding * 2;
      const mapHeight = height - padding * 2;

      this.fullMapBg.clear();
      this.fullMapGraphics.clear();

      // Background
      this.fullMapBg.fillStyle(0x000000, 0.95).fillRect(0, 0, width, height);

      // Border
      this.fullMapGraphics
        .lineStyle(3, 0x00ffff, 1)
        .strokeRect(padding - 3, padding - 3, mapWidth + 6, mapHeight + 6);

      const scale = Math.min(mapWidth / UNIVERSE_SIZE, mapHeight / UNIVERSE_SIZE);
      const offsetX = padding + (mapWidth - UNIVERSE_SIZE * scale) / 2;
      const offsetY = padding + (mapHeight - UNIVERSE_SIZE * scale) / 2;

      // Galaxies
      this.loadedChunks.forEach(chunk => {
        chunk.galaxies.forEach(galaxy => {
          const mx = offsetX + (galaxy.x + UNIVERSE_SIZE / 2) * scale;
          const my = offsetY + (galaxy.y + UNIVERSE_SIZE / 2) * scale;
          this.fullMapGraphics.fillStyle(0x666666, 0.5).fillCircle(mx, my, 2);
        });
      });

      // Anomalies
      this.loadedChunks.forEach(chunk => {
        chunk.anomalies.forEach(anom => {
          if (!anom.resolved) {
            const mx = offsetX + (anom.x + UNIVERSE_SIZE / 2) * scale;
            const my = offsetY + (anom.y + UNIVERSE_SIZE / 2) * scale;
            const anomType = ANOMALY_TYPES.find(t => t.type === anom.type);
            
            this.fullMapGraphics
              .fillStyle(anomType?.color || 0xff0000, 0.8)
              .fillCircle(mx, my, 4)
              .lineStyle(1, anomType?.color || 0xff0000, 1)
              .strokeCircle(mx, my, 4);
          }
        });
      });

      // Player
      const px = offsetX + (this.player.x + UNIVERSE_SIZE / 2) * scale;
      const py = offsetY + (this.player.y + UNIVERSE_SIZE / 2) * scale;
      this.fullMapGraphics
        .fillStyle(0x00ffff, 1)
        .fillCircle(px, py, 6)
        .lineStyle(2, 0xffffff, 1)
        .strokeCircle(px, py, 8);

      this.fullMapTitle.setText('UNIVERSE MAP').setVisible(true);
      this.fullMapInstruction.setText('Press M to close').setVisible(true);
    };

    // Attach methods to scene
    Object.assign(Phaser.Scene.prototype, {
      loadNearbyChunks,
      generateChunk,
      createAnomaly,
      handleAnomalyInteraction,
      createTouchControls,
      createUI,
      updateUIPositions,
      updateMinimap,
      renderFullMap
    });

    if (!gameRef.current) {
      gameRef.current = new Phaser.Game(config);
    }

    const resizeHandler = () => {
      gameRef.current?.scale.resize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", resizeHandler);

    return () => {
      window.removeEventListener("resize", resizeHandler);
      if (gameRef.current) {
        try { gameRef.current.destroy(true); } catch (e) { /* ignore */ }
      }
      gameRef.current = null;
    };
  }, [universe, onAnomalyResolved]);

  return (
    <div className="w-screen h-screen bg-black relative overflow-hidden">
      {/* Universe Info Panel */}
      <div className="absolute top-4 left-4 z-10 text-white text-sm px-4 py-3 bg-black bg-opacity-90 rounded-lg border-2 border-cyan-500 shadow-lg shadow-cyan-500/50">
        <div className="font-bold text-cyan-400 mb-2 text-base">🌌 {universe.name}</div>
        <div className="space-y-1 text-xs">
          <div className="text-gray-300">Difficulty: <span className="text-yellow-400">{universe.difficulty}</span></div>
          <div className="text-green-400">Discovered: {stats.discovered}</div>
          <div className="text-cyan-400">Resolved: {stats.resolved}</div>
          <div className="text-purple-400 mt-2 pt-2 border-t border-cyan-700">
            Age: {(universe.currentState?.age / 1e9).toFixed(2)} Gyr
          </div>
        </div>
      </div>

      {/* Controls Panel */}
      <div className="absolute top-4 right-4 z-10 text-white text-xs px-3 py-2 bg-black bg-opacity-90 rounded border border-cyan-500">
        <div className="font-bold text-cyan-400 mb-1">CONTROLS</div>
        <div className="space-y-0.5 text-gray-300">
          <div>WASD/ZQSD: Move</div>
          <div>F: Resolve Anomaly</div>
          <div>M: Toggle Map</div>
        </div>
      </div>

      <div id="phaser-container" className="w-full h-full" />
    </div>
  );
};

export default PhaserGame;