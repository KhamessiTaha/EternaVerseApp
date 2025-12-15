import { useEffect, useRef, useState } from "react";
import Phaser from "phaser";
import seedrandom from "seedrandom";

const CHUNK_SIZE = 1000;
const UNIVERSE_SIZE = 100000;
const MINIMAP_SIZE = 150;
const ANOMALIES_PER_CHUNK = 2;
const ANOMALY_SPAWN_CHANCE = 0.3;

const getChunkCoords = (x, y) => ({
  chunkX: Math.floor(x / CHUNK_SIZE),
  chunkY: Math.floor(y / CHUNK_SIZE),
});
const getChunkKey = (x, y) => `${x}:${y}`;

// Map backend anomaly types to visual types
const ANOMALY_TYPE_MAP = {
  blackHoleMerger: { color: 0x9900ff, label: "BLACK HOLE", baseRadius: 15 },
  darkEnergySurge: { color: 0x0066ff, label: "DARK ENERGY", baseRadius: 12 },
  supernovaChain: { color: 0xff6600, label: "SUPERNOVA", baseRadius: 18 },
  quantumFluctuation: { color: 0x00ff99, label: "QUANTUM", baseRadius: 10 },
  galacticCollision: { color: 0xff3366, label: "GALACTIC", baseRadius: 16 },
  cosmicVoid: { color: 0x6600ff, label: "COSMIC VOID", baseRadius: 14 },
  magneticReversal: { color: 0xffcc00, label: "MAGNETIC", baseRadius: 13 },
  darkMatterClump: { color: 0xff0066, label: "DARK MATTER", baseRadius: 14 },
  // Fallback for procedural anomalies
  cosmicString: { color: 0xff0066, label: "COSMIC STRING", baseRadius: 14 },
  quantumTunneling: { color: 0x00ff99, label: "QUANTUM", baseRadius: 10 },
};

const ANOMALY_TYPES = Object.entries(ANOMALY_TYPE_MAP).map(([type, config]) => ({
  type,
  ...config
}));

const UniverseSceneFactory = (props) => {
  return class UniverseScene extends Phaser.Scene {
    constructor() {
      super({ key: "UniverseScene" });
      this.loadedChunks = new Map();
      this.activeChunkRadius = 2;
      this.discoveredAnomalies = new Set();
      this.resolvedAnomalies = new Set();
      this.backendAnomalies = new Map(); // Store backend anomalies separately
      this.arrowStates = { up: false, down: false, left: false, right: false };
    }

    init(data) {
      this.universe = data.universe;
      this.onAnomalyResolved = data.onAnomalyResolved;
      this.setStats = data.setStats;
      this.rng = seedrandom(this.universe.seed ?? "default");
      
      // Initialize backend anomalies
      this.syncBackendAnomalies();
    }

    preload() {
      this.load.image("Player", "/assets/Player.png");
    }

    create() {
      // Player
      this.player = this.physics.add
        .sprite(0, 0, "Player")
        .setScale(0.05)
        .setDamping(true)
        .setDrag(0.98)
        .setMaxVelocity(400)
        .setCollideWorldBounds(false);

      this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
      this.cameras.main.setZoom(1.5);

      this.lights.enable().setAmbientColor(0x0a0a0a);
      this.playerLight = this.lights.addLight(0, 0, 250).setIntensity(2.5);

      // Controls
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

      this.createTouchControls();

      this.currentChunk = getChunkCoords(this.player.x, this.player.y);
      this.loadNearbyChunks(this.currentChunk.chunkX, this.currentChunk.chunkY);

      this.showFullMap = false;
      this.createUI();
      this.updateUIPositions();

      this.scale.on("resize", () => {
        this.updateUIPositions();
        if (this.showFullMap) this.renderFullMap();
      });

      this.renderFullMap();
      
      // Render backend anomalies initially
      this.renderBackendAnomalies();
    }

    // NEW: Sync backend anomalies from universe data
    syncBackendAnomalies() {
      if (!this.universe?.anomalies) return;

      const activeBackendAnomalies = this.universe.anomalies.filter(a => !a.resolved);
      
      console.log(`🔄 Syncing ${activeBackendAnomalies.length} backend anomalies`);

      // Update or create backend anomaly visuals
      for (const backendAnomaly of activeBackendAnomalies) {
        if (!this.backendAnomalies.has(backendAnomaly.id)) {
          // New backend anomaly - will be rendered when in range
          this.backendAnomalies.set(backendAnomaly.id, {
            ...backendAnomaly,
            visual: null // Will be created when chunk loads
          });
          
          if (!this.discoveredAnomalies.has(backendAnomaly.id)) {
            this.discoveredAnomalies.add(backendAnomaly.id);
            this.setStats?.((prev) => ({ 
              ...prev, 
              discovered: (prev.discovered || 0) + 1 
            }));
          }
        }
      }

      // Remove resolved backend anomalies
      const activeIds = new Set(activeBackendAnomalies.map(a => a.id));
      for (const [id, anomaly] of this.backendAnomalies.entries()) {
        if (!activeIds.has(id)) {
          // Backend anomaly was resolved
          if (anomaly.visual) {
            this.destroyAnomalyVisual(anomaly.visual);
          }
          this.backendAnomalies.delete(id);
          this.resolvedAnomalies.add(id);
        }
      }
    }

    // NEW: Render backend anomalies that are in loaded chunks
    renderBackendAnomalies() {
      for (const [id, backendAnomaly] of this.backendAnomalies.entries()) {
        // Skip if already has visual or is resolved
        if (backendAnomaly.visual || this.resolvedAnomalies.has(id)) continue;

        // Use backend location (convert from universe coordinates)
        const x = backendAnomaly.location?.x || 0;
        const y = backendAnomaly.location?.y || 0;

        // Check if in loaded chunks
        const chunk = getChunkCoords(x, y);
        const isLoaded = this.loadedChunks.has(getChunkKey(chunk.chunkX, chunk.chunkY));

        if (isLoaded) {
          const typeConfig = ANOMALY_TYPE_MAP[backendAnomaly.type] || ANOMALY_TYPE_MAP.quantumFluctuation;
          
          const visual = this.createAnomaly(
            x, 
            y, 
            typeConfig, 
            backendAnomaly.severity,
            backendAnomaly.id,
            true // Mark as backend anomaly
          );

          backendAnomaly.visual = visual;
          
          console.log(`✨ Rendered backend anomaly: ${backendAnomaly.type} at (${x.toFixed(0)}, ${y.toFixed(0)})`);
        }
      }
    }

    update(time, delta) {
      const speed = 250;
      const isMovingLeft =
        this.cursors.left.isDown || this.cursors.q?.isDown || this.arrowStates.left;
      const isMovingRight =
        this.cursors.right.isDown || this.cursors.d2?.isDown || this.arrowStates.right;
      const isMovingUp =
        this.cursors.up.isDown || this.cursors.z?.isDown || this.arrowStates.up;
      const isMovingDown =
        this.cursors.down.isDown || this.cursors.s2?.isDown || this.arrowStates.down;

      this.player.setAcceleration(
        isMovingLeft ? -speed : isMovingRight ? speed : 0,
        isMovingUp ? -speed : isMovingDown ? speed : 0
      );

      this.playerLight.setPosition(this.player.x, this.player.y);

      const vel =
        Math.sqrt(this.player.body.velocity.x ** 2 + this.player.body.velocity.y ** 2) || 0;
      this.velocityText?.setText(`VELOCITY: ${vel.toFixed(1)} u/s`);
      this.coordText?.setText(
        `COORDINATES: X:${this.player.x.toFixed(0)} Y:${this.player.y.toFixed(0)}`
      );

      const newChunk = getChunkCoords(this.player.x, this.player.y);
      if (newChunk.chunkX !== this.currentChunk.chunkX || newChunk.chunkY !== this.currentChunk.chunkY) {
        this.currentChunk = newChunk;
        this.loadNearbyChunks(newChunk.chunkX, newChunk.chunkY);
        // Re-render backend anomalies when chunks change
        this.renderBackendAnomalies();
      }

      this.handleAnomalyInteraction();

      if (Phaser.Input.Keyboard.JustDown(this.mapKey)) {
        this.showFullMap = !this.showFullMap;
        this.fullMapContainer?.setVisible(this.showFullMap);
        this.renderFullMap();
      }

      this.updateMinimap();
    }

    loadNearbyChunks(centerX, centerY) {
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
          chunk.galaxies.forEach(g => g.destroy());
          chunk.anomalies.forEach(a => this.destroyAnomalyVisual(a));
        }
      });

      this.loadedChunks = newChunks;
    }

    generateChunk(chunkX, chunkY) {
      const chunk = { galaxies: [], anomalies: [] };
      const chunkSeed = (this.universe.seed ?? "seed") + getChunkKey(chunkX, chunkY);
      const rng = seedrandom(chunkSeed);

      // Galaxies (visual only, not synced with backend)
      const galaxyCount = 8 + Math.floor(rng() * 12);
      for (let i = 0; i < galaxyCount; i++) {
        const x = chunkX * CHUNK_SIZE + rng() * CHUNK_SIZE;
        const y = chunkY * CHUNK_SIZE + rng() * CHUNK_SIZE;
        const size = rng() * 25 + 4;
        const hue = Math.floor(rng() * 360);
        const wheel = Phaser.Display.Color.HSVColorWheel();
        const color = wheel[hue % wheel.length];

        const g = this.add.graphics({ x, y }).fillStyle(
          Phaser.Display.Color.GetColor(color.r, color.g, color.b),
          0.8
        ).fillCircle(0, 0, size).setDepth(-1);

        if (size > 20) {
          this.lights.addLight(x, y, size * 6, Phaser.Display.Color.GetColor(color.r, color.g, color.b), 0.2);
        }

        chunk.galaxies.push(g);
      }

      // Procedural anomalies (visual only, lower priority than backend)
      if (rng() < ANOMALY_SPAWN_CHANCE) {
        const anomalyCount = Math.floor(rng() * ANOMALIES_PER_CHUNK) + 1;
        for (let i = 0; i < anomalyCount; i++) {
          const type = ANOMALY_TYPES[Math.floor(rng() * ANOMALY_TYPES.length)];
          const severity = Math.floor(rng() * 3) + 1; // Lower severity for procedural
          const x = chunkX * CHUNK_SIZE + rng() * CHUNK_SIZE;
          const y = chunkY * CHUNK_SIZE + rng() * CHUNK_SIZE;
          const anomalyId = `${chunkX}:${chunkY}:${i}`;

          if (this.resolvedAnomalies.has(anomalyId)) continue;

          const anomaly = this.createAnomaly(x, y, type, severity, anomalyId, false);
          chunk.anomalies.push(anomaly);

          if (!this.discoveredAnomalies.has(anomalyId)) {
            this.discoveredAnomalies.add(anomalyId);
            this.setStats?.((prev) => ({ ...prev, discovered: (prev.discovered || 0) + 1 }));
          }
        }
      }

      return chunk;
    }

    createAnomaly(x, y, typeObj, severity, id, isBackend = false) {
      const radius = typeObj.baseRadius + severity * 2;
      
      // Backend anomalies are more prominent
      const alpha = isBackend ? 0.9 : 0.7;
      const glowAlpha = isBackend ? 0.35 : 0.25;

      const entity = this.add.graphics({ x, y })
        .fillStyle(typeObj.color, alpha)
        .fillCircle(0, 0, radius)
        .lineStyle(2, typeObj.color, 1)
        .strokeCircle(0, 0, radius)
        .setDepth(10);

      const glow = this.add.graphics({ x, y })
        .fillStyle(typeObj.color, glowAlpha)
        .fillCircle(0, 0, radius * 1.8)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(9);

      this.tweens.add({
        targets: glow,
        scaleX: { from: 1, to: 1.3 },
        scaleY: { from: 1, to: 1.3 },
        alpha: { from: 0.5, to: 0.8 },
        duration: 1500 + severity * 200,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });

      const light = this.lights.addLight(x, y, radius * 12, typeObj.color, 1.2);

      const lightProxy = { i: 1.2 };
      this.tweens.add({
        targets: lightProxy,
        i: { from: 1.2, to: 2.0 },
        duration: 2000 + severity * 300,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
        onUpdate: () => {
          if (light && light.setIntensity) light.setIntensity(lightProxy.i);
        },
      });

      const labelText = isBackend 
        ? `[⚡ ${typeObj.label}]\nPRESS F TO RESOLVE`
        : `[${typeObj.label}]\nPRESS F TO RESOLVE`;

      const interactionText = this.add
        .text(x, y - radius - 25, labelText, {
          font: "bold 11px Courier",
          fill: isBackend ? "#ffff00" : "#00ff00",
          backgroundColor: "#000000",
          padding: { x: 6, y: 3 },
          align: "center",
        })
        .setOrigin(0.5)
        .setDepth(1000)
        .setVisible(false);

      return {
        id,
        x,
        y,
        type: typeObj.type,
        severity,
        radius,
        entity,
        glow,
        light,
        interactionText,
        inRange: false,
        resolved: false,
        isBackend, // Flag to distinguish backend vs procedural
      };
    }

    destroyAnomalyVisual(anomaly) {
      anomaly.entity?.destroy();
      anomaly.glow?.destroy();
      if (anomaly.light) this.lights.removeLight(anomaly.light);
      anomaly.interactionText?.destroy();
    }

    handleAnomalyInteraction() {
      let nearest = null;
      let minDist = Infinity;

      // Check procedural anomalies
      this.loadedChunks.forEach((chunk) => {
        chunk.anomalies.forEach((anom) => {
          if (anom.resolved) return;

          const dist = Phaser.Math.Distance.Between(anom.x, anom.y, this.player.x, this.player.y);
          const interactionRange = anom.radius * 5;

          anom.inRange = dist < interactionRange;
          anom.interactionText?.setVisible(anom.inRange);

          if (anom.inRange && dist < minDist) {
            minDist = dist;
            nearest = anom;
          }
        });
      });

      // Check backend anomalies
      this.backendAnomalies.forEach((backendAnomaly) => {
        if (!backendAnomaly.visual || backendAnomaly.visual.resolved) return;

        const anom = backendAnomaly.visual;
        const dist = Phaser.Math.Distance.Between(anom.x, anom.y, this.player.x, this.player.y);
        const interactionRange = anom.radius * 5;

        anom.inRange = dist < interactionRange;
        anom.interactionText?.setVisible(anom.inRange);

        if (anom.inRange && dist < minDist) {
          minDist = dist;
          nearest = anom;
        }
      });

      // Resolve nearest anomaly
      if (nearest && Phaser.Input.Keyboard.JustDown(this.fixKey)) {
        nearest.resolved = true;
        this.resolvedAnomalies.add(nearest.id);

        this.cameras.main.shake(200, 0.005);

        const particleBurst = this.add.particles(
          nearest.x,
          nearest.y,
          "Player",
          {
            speed: { min: 50, max: 150 },
            scale: { start: 0.02, end: 0 },
            lifespan: 800,
            quantity: 20,
            blendMode: "ADD"
          }
        );

        this.time.delayedCall(800, () => particleBurst.destroy());

        this.destroyAnomalyVisual(nearest);

        this.setStats?.((prev) => ({
          ...prev,
          resolved: (prev.resolved || 0) + 1,
        }));

        // Notify GameplayPage with full anomaly data
        if (this.onAnomalyResolved) {
          this.onAnomalyResolved({
            id: nearest.id,
            type: nearest.type,
            severity: nearest.severity,
            location: { x: nearest.x, y: nearest.y },
            isBackend: nearest.isBackend
          });
        }

        console.log(`✅ Resolved ${nearest.isBackend ? 'BACKEND' : 'procedural'} anomaly: ${nearest.type}`);
      }
    }

    createTouchControls() {
      const createArrow = (x, y, rotation, direction) => {
        const tri = new Phaser.Geom.Triangle(-15, 10, 15, 10, 0, -10);
        const g = this.add.graphics()
          .fillStyle(0x00ff00, 0.5)
          .fillTriangle(-15, 10, 15, 10, 0, -10)
          .setPosition(x, y)
          .setRotation(rotation)
          .setScrollFactor(0)
          .setDepth(1001)
          .setInteractive(tri, Phaser.Geom.Triangle.Contains);

        g.on("pointerdown", () => {
          this.arrowStates[direction] = true;
          g.clear().fillStyle(0x00ff00, 1).fillTriangle(-15, 10, 15, 10, 0, -10);
        });
        g.on("pointerup", () => {
          this.arrowStates[direction] = false;
          g.clear().fillStyle(0x00ff00, 0.5).fillTriangle(-15, 10, 15, 10, 0, -10);
        });
        g.on("pointerout", () => {
          this.arrowStates[direction] = false;
          g.clear().fillStyle(0x00ff00, 0.5).fillTriangle(-15, 10, 15, 10, 0, -10);
        });

        return g;
      };

      const h = this.scale.height;
      this.arrowUp = createArrow(100, h - 120, 0, "up");
      this.arrowDown = createArrow(100, h - 40, Math.PI, "down");
      this.arrowLeft = createArrow(50, h - 80, -Math.PI / 2, "left");
      this.arrowRight = createArrow(150, h - 80, Math.PI / 2, "right");
    }

    createUI() {
      this.minimap = this.add.graphics().setScrollFactor(0).setDepth(1000);
      this.minimapBorder = this.add.graphics().setScrollFactor(0).setDepth(999);

      this.fullMapContainer = this.add.container(0, 0).setScrollFactor(0).setDepth(2000).setVisible(false);
      this.fullMapBg = this.add.graphics().setScrollFactor(0);
      this.fullMapGraphics = this.add.graphics().setScrollFactor(0);
      this.fullMapContainer.add([this.fullMapBg, this.fullMapGraphics]);

      this.fullMapTitle = this.add.text(0, 0, "", {
        font: "bold 18px Courier",
        fill: "#00ffff",
        stroke: "#003333",
        strokeThickness: 3,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2001).setVisible(false);

      this.fullMapInstruction = this.add.text(0, 0, "", {
        font: "bold 14px Courier",
        fill: "#00ff00",
        backgroundColor: "#000000",
        padding: { x: 10, y: 5 },
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2001).setVisible(false);

      this.velocityText = this.add.text(10, 80, "", {
        font: "bold 12px Courier",
        fill: "#00ff00",
        backgroundColor: "#000000",
        padding: { x: 6, y: 3 },
      }).setScrollFactor(0).setDepth(1001);

      this.coordText = this.add.text(10, 100, "", {
        font: "bold 12px Courier",
        fill: "#00ffff",
        backgroundColor: "#000000",
        padding: { x: 6, y: 3 },
      }).setScrollFactor(0).setDepth(1001);

      this.mapToggleText = this.add.text(10, 120, "PRESS M FOR FULL MAP", {
        font: "bold 11px Courier",
        fill: "#ffff00",
        backgroundColor: "#000000",
        padding: { x: 6, y: 3 },
      }).setScrollFactor(0).setDepth(1001).setAlpha(0.8);

      this.fullMapContainer.add([this.fullMapTitle, this.fullMapInstruction]);
    }

    updateUIPositions() {
      const w = this.scale.width;
      const h = this.scale.height;

      this.minimapX = w - MINIMAP_SIZE - 280;
      this.minimapY = 160;

      const hudLeftMargin = 265;
      const hudTopMargin = 300;
      
      this.velocityText?.setPosition(hudLeftMargin, hudTopMargin);
      this.coordText?.setPosition(hudLeftMargin, hudTopMargin + 20);
      this.mapToggleText?.setPosition(hudLeftMargin, hudTopMargin + 40);

      if (this.arrowUp) {
        const arrowCenterX = 340;
        const arrowBottomY = h - 200;
        
        this.arrowUp.setPosition(arrowCenterX, arrowBottomY - 80);
        this.arrowDown.setPosition(arrowCenterX, arrowBottomY);
        this.arrowLeft.setPosition(arrowCenterX - 50, arrowBottomY - 40);
        this.arrowRight.setPosition(arrowCenterX + 50, arrowBottomY - 40);
      }

      this.fullMapTitle?.setPosition(w / 2, 40);
      this.fullMapInstruction?.setPosition(w / 2, h - 40);
    }

    updateMinimap() {
      const mapX = this.minimapX ?? 10;
      const mapY = this.minimapY ?? 10;
      const radius = this.activeChunkRadius;
      const chunksWidth = (radius * 2 + 1) * CHUNK_SIZE;
      const chunksHeight = (radius * 2 + 1) * CHUNK_SIZE;
      const centerX = this.currentChunk.chunkX * CHUNK_SIZE + CHUNK_SIZE / 2;
      const centerY = this.currentChunk.chunkY * CHUNK_SIZE + CHUNK_SIZE / 2;
      const scale = MINIMAP_SIZE / chunksWidth;

      this.minimap.clear();
      this.minimapBorder.clear();

      this.minimapBorder.lineStyle(2, 0x00ffff, 0.8).strokeRect(mapX - 2, mapY - 2, MINIMAP_SIZE + 4, MINIMAP_SIZE + 4);
      this.minimap.fillStyle(0x000022, 0.95).fillRect(mapX, mapY, MINIMAP_SIZE, MINIMAP_SIZE);

      this.minimapBorder.lineStyle(1, 0x004444, 0.5);
      for (let dx = -radius; dx <= radius; dx++) {
        const x = mapX + (dx * CHUNK_SIZE + chunksWidth / 2) * scale;
        this.minimapBorder.lineBetween(x, mapY, x, mapY + MINIMAP_SIZE);
      }
      for (let dy = -radius; dy <= radius; dy++) {
        const y = mapY + (dy * CHUNK_SIZE + chunksHeight / 2) * scale;
        this.minimapBorder.lineBetween(mapX, y, mapX + MINIMAP_SIZE, y);
      }

      // Galaxies
      this.loadedChunks.forEach((chunk) => {
        chunk.galaxies.forEach((galaxy) => {
          const relX = galaxy.x - centerX;
          const relY = galaxy.y - centerY;
          const mx = mapX + (relX + chunksWidth / 2) * scale;
          const my = mapY + (relY + chunksHeight / 2) * scale;
          if (mx >= mapX && mx <= mapX + MINIMAP_SIZE && my >= mapY && my <= mapY + MINIMAP_SIZE) {
            this.minimap.fillStyle(0x666666, 0.6).fillCircle(mx, my, 1.5);
          }
        });
      });

      // Procedural anomalies
      this.loadedChunks.forEach((chunk) => {
        chunk.anomalies.forEach((anom) => {
          if (!anom.resolved) {
            const relX = anom.x - centerX;
            const relY = anom.y - centerY;
            const mx = mapX + (relX + chunksWidth / 2) * scale;
            const my = mapY + (relY + chunksHeight / 2) * scale;
            if (mx >= mapX && mx <= mapX + MINIMAP_SIZE && my >= mapY && my <= mapY + MINIMAP_SIZE) {
              const typeConfig = ANOMALY_TYPE_MAP[anom.type];
              this.minimap.fillStyle(typeConfig?.color || 0xff0000, 0.7).fillCircle(mx, my, 2);
            }
          }
        });
      });

      // Backend anomalies (larger dots, yellow border)
      this.backendAnomalies.forEach((backendAnomaly) => {
        if (backendAnomaly.visual && !backendAnomaly.visual.resolved) {
          const relX = backendAnomaly.location.x - centerX;
          const relY = backendAnomaly.location.y - centerY;
          const mx = mapX + (relX + chunksWidth / 2) * scale;
          const my = mapY + (relY + chunksHeight / 2) * scale;
          if (mx >= mapX && mx <= mapX + MINIMAP_SIZE && my >= mapY && my <= mapY + MINIMAP_SIZE) {
            const typeConfig = ANOMALY_TYPE_MAP[backendAnomaly.type];
            // Draw with yellow border to distinguish
            this.minimap.lineStyle(2, 0xffff00, 1).strokeCircle(mx, my, 4);
            this.minimap.fillStyle(typeConfig?.color || 0xff0000, 1).fillCircle(mx, my, 3);
          }
        }
      });

      // Player
      const relPX = this.player.x - centerX;
      const relPY = this.player.y - centerY;
      const px = mapX + (relPX + chunksWidth / 2) * scale;
      const py = mapY + (relPY + chunksHeight / 2) * scale;
      this.minimap.fillStyle(0x00ffff, 1).fillCircle(px, py, 4).lineStyle(1, 0xffffff, 1).strokeCircle(px, py, 4);
    }

    renderFullMap() {
      if (!this.showFullMap) return;
      const width = this.scale.width;
      const height = this.scale.height;
      const padding = 50;
      const mapWidth = width - padding * 2;
      const mapHeight = height - padding * 2;

      this.fullMapBg.clear();
      this.fullMapGraphics.clear();
      this.fullMapBg.fillStyle(0x000000, 0.95).fillRect(0, 0, width, height);

      this.fullMapGraphics.lineStyle(3, 0x00ffff, 1).strokeRect(padding - 3, padding - 3, mapWidth + 6, mapHeight + 6);

      const scale = Math.min(mapWidth / UNIVERSE_SIZE, mapHeight / UNIVERSE_SIZE);
      const offsetX = padding + (mapWidth - UNIVERSE_SIZE * scale) / 2;
      const offsetY = padding + (mapHeight - UNIVERSE_SIZE * scale) / 2;

      // Galaxies
      this.loadedChunks.forEach((chunk) => {
        chunk.galaxies.forEach((galaxy) => {
          const mx = offsetX + (galaxy.x + UNIVERSE_SIZE / 2) * scale;
          const my = offsetY + (galaxy.y + UNIVERSE_SIZE / 2) * scale;
          this.fullMapGraphics.fillStyle(0x666666, 0.5).fillCircle(mx, my, 2);
        });
      });

      // Procedural anomalies
      this.loadedChunks.forEach((chunk) => {
        chunk.anomalies.forEach((anom) => {
          if (!anom.resolved) {
            const mx = offsetX + (anom.x + UNIVERSE_SIZE / 2) * scale;
            const my = offsetY + (anom.y + UNIVERSE_SIZE / 2) * scale;
            const typeConfig = ANOMALY_TYPE_MAP[anom.type];
            this.fullMapGraphics.fillStyle(typeConfig?.color || 0xff0000, 0.6).fillCircle(mx, my, 3)
              .lineStyle(1, typeConfig?.color || 0xff0000, 1).strokeCircle(mx, my, 3);
          }
        });
      });

      // Backend anomalies (larger, with star marker)
      this.backendAnomalies.forEach((backendAnomaly) => {
        if (!this.resolvedAnomalies.has(backendAnomaly.id)) {
          const mx = offsetX + (backendAnomaly.location.x + UNIVERSE_SIZE / 2) * scale;
          const my = offsetY + (backendAnomaly.location.y + UNIVERSE_SIZE / 2) * scale;
          const typeConfig = ANOMALY_TYPE_MAP[backendAnomaly.type];
          
          // Draw star shape for backend anomalies
          this.fullMapGraphics.lineStyle(2, 0xffff00, 1).strokeCircle(mx, my, 6);
          this.fullMapGraphics.fillStyle(typeConfig?.color || 0xff0000, 0.9).fillCircle(mx, my, 5);
          
          // Add severity indicator
          const severityText = backendAnomaly.severity;
          const textObj = this.add.text(mx, my - 10, `${severityText}`, {
            font: "bold 10px Courier",
            fill: "#ffff00",
            stroke: "#000000",
            strokeThickness: 2
          }).setOrigin(0.5).setScrollFactor(0).setDepth(2002);
          
          // Store text to clean up later
          if (!this.fullMapTexts) this.fullMapTexts = [];
          this.fullMapTexts.push(textObj);
        }
      });

      // Player
      const px = offsetX + (this.player.x + UNIVERSE_SIZE / 2) * scale;
      const py = offsetY + (this.player.y + UNIVERSE_SIZE / 2) * scale;
      this.fullMapGraphics.fillStyle(0x00ffff, 1).fillCircle(px, py, 6).lineStyle(2, 0xffffff, 1).strokeCircle(px, py, 8);

      this.fullMapTitle.setText("UNIVERSE MAP").setVisible(true);
      
      const backendCount = Array.from(this.backendAnomalies.values()).filter(a => !this.resolvedAnomalies.has(a.id)).length;
      this.fullMapInstruction.setText(
        `Backend Anomalies: ${backendCount} (yellow star) | Procedural: ${this.loadedChunks.size * 2} | Press M to close`
      ).setVisible(true);
    }

    // NEW: Update method to sync with universe changes
    updateFromUniverse(newUniverse) {
      this.universe = newUniverse;
      this.syncBackendAnomalies();
      this.renderBackendAnomalies();
    }
  };
};

const PhaserGame = ({ universe, onAnomalyResolved, onUniverseUpdate }) => {
  const gameRef = useRef(null);
  const sceneRef = useRef(null);
  const [stats, setStats] = useState({ resolved: 0, discovered: 0 });

  useEffect(() => {
    const SceneClass = UniverseSceneFactory({ universe, onAnomalyResolved, setStats });

    const config = {
      type: Phaser.AUTO,
      backgroundColor: "#000000",
      parent: "phaser-container",
      physics: {
        default: "arcade",
        arcade: { gravity: { y: 0 }, debug: false },
      },
      scale: {
        mode: Phaser.Scale.RESIZE,
        width:"100%",
        height:"100%",
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      scene: SceneClass,
    };

    if (!gameRef.current) {
      gameRef.current = new Phaser.Game(config);
      gameRef.current.scene.start("UniverseScene", { universe, onAnomalyResolved, setStats });
      sceneRef.current = gameRef.current.scene.getScene("UniverseScene");
    }

    const resizeHandler = () => {
      gameRef.current?.scale.resize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", resizeHandler);

    return () => {
      window.removeEventListener("resize", resizeHandler);
      if (gameRef.current) {
        try {
          gameRef.current.destroy(true);
        } catch (e) {
          /* ignore */
        }
      }
      gameRef.current = null;
      sceneRef.current = null;
    };
  }, [universe?.seed, universe?.name]);

  // NEW: Sync universe updates to the Phaser scene
  useEffect(() => {
    if (sceneRef.current && universe) {
      sceneRef.current.updateFromUniverse(universe);
    }
  }, [universe?.anomalies, universe?.currentState]);

  return (
    <div className="w-screen h-screen bg-black relative overflow-hidden">
      <div className="absolute top-4 left-4 z-10 text-white text-sm px-4 py-3 bg-black bg-opacity-90 rounded-lg border-2 border-cyan-500 shadow-lg shadow-cyan-500/50">
        <div className="font-bold text-cyan-400 mb-2 text-base">🌌 {universe?.name}</div>
        <div className="space-y-1 text-xs">
          <div className="text-gray-300">Difficulty: <span className="text-yellow-400">{universe?.difficulty}</span></div>
          <div className="text-green-400">Discovered: {stats.discovered}</div>
          <div className="text-cyan-400">Resolved: {stats.resolved}</div>
          <div className="text-purple-400 mt-2 pt-2 border-t border-cyan-700">
            Age: {((universe?.currentState?.age || 0) / 1e9).toFixed(2)} Gyr
          </div>
          <div className="text-yellow-400">
            Galaxies: {universe?.currentState?.galaxyCount?.toLocaleString() || 0}
          </div>
          <div className="text-blue-400">
            Stars: {universe?.currentState?.starCount ? (universe.currentState.starCount / 1e9).toFixed(2) + 'B' : 0}
          </div>
          <div className="text-orange-400">
            Stability: {(((universe?.currentState?.stabilityIndex || 1) * 100)).toFixed(1)}%
          </div>
          <div className="text-pink-400">
            Backend Anomalies: {universe?.anomalies?.filter(a => !a.resolved).length || 0}
          </div>
        </div>
      </div>

      <div className="absolute bottom-5 right-4 z-10 text-white text-xs px-3 py-2 bg-black bg-opacity-90 rounded border border-cyan-500">
        <div className="font-bold text-cyan-400 mb-1">CONTROLS</div>
        <div className="space-y-0.5 text-gray-300">
          <div>WASD/ZQSD: Move</div>
          <div>F: Resolve Anomaly</div>
          <div>M: Toggle Map</div>
          <div className="text-yellow-400 text-xs pt-1 border-t border-cyan-700">
            ⚡ = Backend Anomaly
          </div>
        </div>
      </div>

      <div id="phaser-container" className="w-full h-full" />
    </div>
  );
};

export default PhaserGame;