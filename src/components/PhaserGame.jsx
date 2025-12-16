import { useEffect, useRef, useState, useCallback } from "react";
import Phaser from "phaser";
import seedrandom from "seedrandom";

const CHUNK_SIZE = 1000;
const UNIVERSE_SIZE = 100000;
const MINIMAP_SIZE = 150;
const ANOMALIES_PER_CHUNK = 2;
const ANOMALY_SPAWN_CHANCE = 0.3;
const CHUNK_UNLOAD_RADIUS = 3;

const getChunkCoords = (x, y) => ({
  chunkX: Math.floor(x / CHUNK_SIZE),
  chunkY: Math.floor(y / CHUNK_SIZE),
});
const getChunkKey = (x, y) => `${x}:${y}`;

const ANOMALY_TYPE_MAP = {
  blackHoleMerger: { color: 0x9900ff, label: "BLACK HOLE", baseRadius: 15 },
  darkEnergySurge: { color: 0x0066ff, label: "DARK ENERGY", baseRadius: 12 },
  supernovaChain: { color: 0xff6600, label: "SUPERNOVA", baseRadius: 18 },
  quantumFluctuation: { color: 0x00ff99, label: "QUANTUM", baseRadius: 10 },
  galacticCollision: { color: 0xff3366, label: "GALACTIC", baseRadius: 16 },
  cosmicVoid: { color: 0x6600ff, label: "COSMIC VOID", baseRadius: 14 },
  magneticReversal: { color: 0xffcc00, label: "MAGNETIC", baseRadius: 13 },
  darkMatterClump: { color: 0xff0066, label: "DARK MATTER", baseRadius: 14 },
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
      this.backendAnomalies = new Map();
      this.arrowStates = { up: false, down: false, left: false, right: false };
      this.fullMapTexts = [];
    }

    init(data) {
      this.universe = data.universe;
      this.onAnomalyResolved = data.onAnomalyResolved;
      this.setStats = data.setStats;
      this.rng = seedrandom(this.universe.seed ?? "default");
      this.syncBackendAnomalies();
    }

    preload() {
      this.load.image("Player", "/assets/Player.png");
    }

    create() {
      // Player setup
      this.player = this.physics.add
        .sprite(0, 0, "Player")
        .setScale(0.05)
        .setDamping(true)
        .setDrag(0.98)
        .setMaxVelocity(400);

      this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
      this.cameras.main.setZoom(1.5);

      // Lighting system
      this.lights.enable().setAmbientColor(0x0a0a0a);
      this.playerLight = this.lights.addLight(0, 0, 250).setIntensity(2.5);

      // Input setup
      this.setupControls();

      // Initial chunk loading
      this.currentChunk = getChunkCoords(this.player.x, this.player.y);
      this.loadNearbyChunks(this.currentChunk.chunkX, this.currentChunk.chunkY);

      // UI creation
      this.showFullMap = false;
      this.createUI();
      this.updateUIPositions();

      // Event handlers
      this.scale.on("resize", this.handleResize, this);
      
      this.renderFullMap();
      this.renderBackendAnomalies();
    }

    setupControls() {
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
    }

    handleResize() {
      this.updateUIPositions();
      if (this.showFullMap) this.renderFullMap();
    }

    syncBackendAnomalies() {
      if (!this.universe?.anomalies) return;

      const activeBackendAnomalies = this.universe.anomalies.filter(a => !a.resolved);
      const activeIds = new Set(activeBackendAnomalies.map(a => a.id));

      // Add or update backend anomalies
      for (const backendAnomaly of activeBackendAnomalies) {
        if (!this.backendAnomalies.has(backendAnomaly.id)) {
          this.backendAnomalies.set(backendAnomaly.id, {
            ...backendAnomaly,
            visual: null
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
      for (const [id, anomaly] of this.backendAnomalies.entries()) {
        if (!activeIds.has(id)) {
          if (anomaly.visual) {
            this.destroyAnomalyVisual(anomaly.visual);
          }
          this.backendAnomalies.delete(id);
          this.resolvedAnomalies.add(id);
        }
      }
    }

    renderBackendAnomalies() {
      for (const [id, backendAnomaly] of this.backendAnomalies.entries()) {
        if (backendAnomaly.visual || this.resolvedAnomalies.has(id)) continue;

        const x = backendAnomaly.location?.x || 0;
        const y = backendAnomaly.location?.y || 0;
        const chunk = getChunkCoords(x, y);
        const isLoaded = this.loadedChunks.has(getChunkKey(chunk.chunkX, chunk.chunkY));

        if (isLoaded) {
          const typeConfig = ANOMALY_TYPE_MAP[backendAnomaly.type] || ANOMALY_TYPE_MAP.quantumFluctuation;
          backendAnomaly.visual = this.createAnomaly(
            x, y, typeConfig, backendAnomaly.severity, backendAnomaly.id, true
          );
        }
      }
    }

    update(time, delta) {
      this.handlePlayerMovement();
      this.updatePlayerLight();
      this.updateHUD();
      this.checkChunkChange();
      this.handleAnomalyInteraction();
      this.handleMapToggle();
      this.updateMinimap();
    }

    handlePlayerMovement() {
      const speed = 250;
      const isMovingLeft = this.cursors.left.isDown || this.cursors.q?.isDown;
      const isMovingRight = this.cursors.right.isDown || this.cursors.d2?.isDown;
      const isMovingUp = this.cursors.up.isDown || this.cursors.z?.isDown;
      const isMovingDown = this.cursors.down.isDown || this.cursors.s2?.isDown;

      this.player.setAcceleration(
        isMovingLeft ? -speed : isMovingRight ? speed : 0,
        isMovingUp ? -speed : isMovingDown ? speed : 0
      );
    }

    updatePlayerLight() {
      this.playerLight.setPosition(this.player.x, this.player.y);
    }

    updateHUD() {
      const vel = Math.sqrt(
        this.player.body.velocity.x ** 2 + this.player.body.velocity.y ** 2
      );
      this.velocityText?.setText(`VELOCITY: ${vel.toFixed(1)} u/s`);
      this.coordText?.setText(
        `COORDINATES: X:${this.player.x.toFixed(0)} Y:${this.player.y.toFixed(0)}`
      );
    }

    checkChunkChange() {
      const newChunk = getChunkCoords(this.player.x, this.player.y);
      if (newChunk.chunkX !== this.currentChunk.chunkX || 
          newChunk.chunkY !== this.currentChunk.chunkY) {
        this.currentChunk = newChunk;
        this.loadNearbyChunks(newChunk.chunkX, newChunk.chunkY);
        this.renderBackendAnomalies();
      }
    }

    handleMapToggle() {
      if (Phaser.Input.Keyboard.JustDown(this.mapKey)) {
        this.showFullMap = !this.showFullMap;
        this.fullMapContainer?.setVisible(this.showFullMap);
        this.renderFullMap();
      }
    }

    loadNearbyChunks(centerX, centerY) {
      const newChunks = new Map();
      const radius = this.activeChunkRadius;

      // Load nearby chunks
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          const chunkX = centerX + dx;
          const chunkY = centerY + dy;
          const key = getChunkKey(chunkX, chunkY);

          if (!this.loadedChunks.has(key)) {
            newChunks.set(key, this.generateChunk(chunkX, chunkY));
          } else {
            newChunks.set(key, this.loadedChunks.get(key));
          }
        }
      }

      // Cleanup far chunks
      this.loadedChunks.forEach((chunk, key) => {
        if (!newChunks.has(key)) {
          this.cleanupChunk(chunk);
        }
      });

      this.loadedChunks = newChunks;
    }

    cleanupChunk(chunk) {
      chunk.galaxies.forEach(g => g.destroy());
      chunk.anomalies.forEach(a => this.destroyAnomalyVisual(a));
    }

    generateChunk(chunkX, chunkY) {
      const chunk = { galaxies: [], anomalies: [] };
      const chunkSeed = (this.universe.seed ?? "seed") + getChunkKey(chunkX, chunkY);
      const rng = seedrandom(chunkSeed);

      // Generate galaxies
      this.generateGalaxies(chunk, chunkX, chunkY, rng);

      // Generate procedural anomalies
      if (rng() < ANOMALY_SPAWN_CHANCE) {
        this.generateProceduralAnomalies(chunk, chunkX, chunkY, rng);
      }

      return chunk;
    }

    generateGalaxies(chunk, chunkX, chunkY, rng) {
      const galaxyCount = 8 + Math.floor(rng() * 12);
      
      for (let i = 0; i < galaxyCount; i++) {
        const x = chunkX * CHUNK_SIZE + rng() * CHUNK_SIZE;
        const y = chunkY * CHUNK_SIZE + rng() * CHUNK_SIZE;
        const size = rng() * 25 + 4;
        const hue = Math.floor(rng() * 360);
        const wheel = Phaser.Display.Color.HSVColorWheel();
        const color = wheel[hue % wheel.length];

        const g = this.add.graphics({ x, y })
          .fillStyle(Phaser.Display.Color.GetColor(color.r, color.g, color.b), 0.8)
          .fillCircle(0, 0, size)
          .setDepth(-1);

        if (size > 20) {
          this.lights.addLight(
            x, y, size * 6, 
            Phaser.Display.Color.GetColor(color.r, color.g, color.b), 
            0.2
          );
        }

        chunk.galaxies.push(g);
      }
    }

    generateProceduralAnomalies(chunk, chunkX, chunkY, rng) {
      const anomalyCount = Math.floor(rng() * ANOMALIES_PER_CHUNK) + 1;
      
      for (let i = 0; i < anomalyCount; i++) {
        const type = ANOMALY_TYPES[Math.floor(rng() * ANOMALY_TYPES.length)];
        const severity = Math.floor(rng() * 3) + 1;
        const x = chunkX * CHUNK_SIZE + rng() * CHUNK_SIZE;
        const y = chunkY * CHUNK_SIZE + rng() * CHUNK_SIZE;
        const anomalyId = `${chunkX}:${chunkY}:${i}`;

        if (this.resolvedAnomalies.has(anomalyId)) continue;

        const anomaly = this.createAnomaly(x, y, type, severity, anomalyId, false);
        chunk.anomalies.push(anomaly);

        if (!this.discoveredAnomalies.has(anomalyId)) {
          this.discoveredAnomalies.add(anomalyId);
          this.setStats?.((prev) => ({ 
            ...prev, 
            discovered: (prev.discovered || 0) + 1 
          }));
        }
      }
    }

    createAnomaly(x, y, typeObj, severity, id, isBackend = false) {
      const radius = typeObj.baseRadius + severity * 2;
      const alpha = isBackend ? 0.9 : 0.7;
      const glowAlpha = isBackend ? 0.35 : 0.25;

      // Core entity
      const entity = this.add.graphics({ x, y })
        .fillStyle(typeObj.color, alpha)
        .fillCircle(0, 0, radius)
        .lineStyle(2, typeObj.color, 1)
        .strokeCircle(0, 0, radius)
        .setDepth(10);

      // Glow effect
      const glow = this.add.graphics({ x, y })
        .fillStyle(typeObj.color, glowAlpha)
        .fillCircle(0, 0, radius * 1.8)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(9);

      // Pulsing animation
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

      // Light source
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
          if (light?.setIntensity) light.setIntensity(lightProxy.i);
        },
      });

      // Interaction text
      const labelText = isBackend 
        ? `[⚡ ${typeObj.label}]\nSEV: ${severity} | PRESS F`
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
        id, x, y,
        type: typeObj.type,
        severity, radius,
        entity, glow, light,
        interactionText,
        inRange: false,
        resolved: false,
        isBackend,
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

      // Check all anomalies
      const checkAnomaly = (anom) => {
        if (anom.resolved) return;

        const dist = Phaser.Math.Distance.Between(
          anom.x, anom.y, this.player.x, this.player.y
        );
        const interactionRange = anom.radius * 5;

        anom.inRange = dist < interactionRange;
        anom.interactionText?.setVisible(anom.inRange);

        if (anom.inRange && dist < minDist) {
          minDist = dist;
          nearest = anom;
        }
      };

      // Check procedural anomalies
      this.loadedChunks.forEach((chunk) => {
        chunk.anomalies.forEach(checkAnomaly);
      });

      // Check backend anomalies
      this.backendAnomalies.forEach((backendAnomaly) => {
        if (backendAnomaly.visual) {
          checkAnomaly(backendAnomaly.visual);
        }
      });

      // Resolve nearest anomaly
      if (nearest && Phaser.Input.Keyboard.JustDown(this.fixKey)) {
        this.resolveAnomaly(nearest);
      }
    }

    resolveAnomaly(anomaly) {
      anomaly.resolved = true;
      this.resolvedAnomalies.add(anomaly.id);

      // Visual feedback
      this.cameras.main.shake(200, 0.005);

      const particleBurst = this.add.particles(anomaly.x, anomaly.y, "Player", {
        speed: { min: 50, max: 150 },
        scale: { start: 0.02, end: 0 },
        lifespan: 800,
        quantity: 20,
        blendMode: "ADD"
      });

      this.time.delayedCall(800, () => particleBurst.destroy());
      this.destroyAnomalyVisual(anomaly);

      // Update stats
      this.setStats?.((prev) => ({
        ...prev,
        resolved: (prev.resolved || 0) + 1,
      }));

      // Notify parent component
      if (this.onAnomalyResolved) {
        this.onAnomalyResolved({
          id: anomaly.id,
          type: anomaly.type,
          severity: anomaly.severity,
          location: { x: anomaly.x, y: anomaly.y },
          isBackend: anomaly.isBackend
        });
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

        const activate = () => {
          this.arrowStates[direction] = true;
          g.clear().fillStyle(0x00ff00, 1).fillTriangle(-15, 10, 15, 10, 0, -10);
        };

        const deactivate = () => {
          this.arrowStates[direction] = false;
          g.clear().fillStyle(0x00ff00, 0.5).fillTriangle(-15, 10, 15, 10, 0, -10);
        };

        g.on("pointerdown", activate);
        g.on("pointerup", deactivate);
        g.on("pointerout", deactivate);

        return g;
      };

      const h = this.scale.height;
      this.arrowUp = createArrow(100, h - 120, 0, "up");
      this.arrowDown = createArrow(100, h - 40, Math.PI, "down");
      this.arrowLeft = createArrow(50, h - 80, -Math.PI / 2, "left");
      this.arrowRight = createArrow(150, h - 80, Math.PI / 2, "right");
    }

    createUI() {
      // Minimap
      this.minimap = this.add.graphics().setScrollFactor(0).setDepth(1000);
      this.minimapBorder = this.add.graphics().setScrollFactor(0).setDepth(999);

      // Full map
      this.fullMapContainer = this.add.container(0, 0)
        .setScrollFactor(0)
        .setDepth(2000)
        .setVisible(false);
      
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

      // HUD elements
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

      // Border and background
      this.minimapBorder
        .lineStyle(2, 0x00ffff, 0.8)
        .strokeRect(mapX - 2, mapY - 2, MINIMAP_SIZE + 4, MINIMAP_SIZE + 4);
      
      this.minimap
        .fillStyle(0x000022, 0.95)
        .fillRect(mapX, mapY, MINIMAP_SIZE, MINIMAP_SIZE);

      // Grid lines
      this.minimapBorder.lineStyle(1, 0x004444, 0.5);
      for (let dx = -radius; dx <= radius; dx++) {
        const x = mapX + (dx * CHUNK_SIZE + chunksWidth / 2) * scale;
        this.minimapBorder.lineBetween(x, mapY, x, mapY + MINIMAP_SIZE);
      }
      for (let dy = -radius; dy <= radius; dy++) {
        const y = mapY + (dy * CHUNK_SIZE + chunksHeight / 2) * scale;
        this.minimapBorder.lineBetween(mapX, y, mapX + MINIMAP_SIZE, y);
      }

      // Render galaxies
      this.renderMinimapGalaxies(mapX, mapY, centerX, centerY, scale, chunksWidth, chunksHeight);

      // Render anomalies
      this.renderMinimapAnomalies(mapX, mapY, centerX, centerY, scale, chunksWidth, chunksHeight);

      // Render player
      this.renderMinimapPlayer(mapX, mapY, centerX, centerY, scale, chunksWidth, chunksHeight);
    }

    renderMinimapGalaxies(mapX, mapY, centerX, centerY, scale, chunksWidth, chunksHeight) {
      this.loadedChunks.forEach((chunk) => {
        chunk.galaxies.forEach((galaxy) => {
          const relX = galaxy.x - centerX;
          const relY = galaxy.y - centerY;
          const mx = mapX + (relX + chunksWidth / 2) * scale;
          const my = mapY + (relY + chunksHeight / 2) * scale;
          
          if (this.isInMinimapBounds(mx, my, mapX, mapY)) {
            this.minimap.fillStyle(0x666666, 0.6).fillCircle(mx, my, 1.5);
          }
        });
      });
    }

    renderMinimapAnomalies(mapX, mapY, centerX, centerY, scale, chunksWidth, chunksHeight) {
      // Procedural anomalies
      this.loadedChunks.forEach((chunk) => {
        chunk.anomalies.forEach((anom) => {
          if (!anom.resolved) {
            const coords = this.getMinimapCoords(
              anom.x, anom.y, centerX, centerY, mapX, mapY, scale, chunksWidth, chunksHeight
            );
            
            if (coords) {
              const typeConfig = ANOMALY_TYPE_MAP[anom.type];
              this.minimap.fillStyle(typeConfig?.color || 0xff0000, 0.7)
                .fillCircle(coords.mx, coords.my, 2);
            }
          }
        });
      });

      // Backend anomalies (highlighted)
      this.backendAnomalies.forEach((backendAnomaly) => {
        if (backendAnomaly.visual && !backendAnomaly.visual.resolved) {
          const coords = this.getMinimapCoords(
            backendAnomaly.location.x, backendAnomaly.location.y,
            centerX, centerY, mapX, mapY, scale, chunksWidth, chunksHeight
          );
          
          if (coords) {
            const typeConfig = ANOMALY_TYPE_MAP[backendAnomaly.type];
            this.minimap.lineStyle(2, 0xffff00, 1).strokeCircle(coords.mx, coords.my, 4);
            this.minimap.fillStyle(typeConfig?.color || 0xff0000, 1)
              .fillCircle(coords.mx, coords.my, 3);
          }
        }
      });
    }

    renderMinimapPlayer(mapX, mapY, centerX, centerY, scale, chunksWidth, chunksHeight) {
      const relPX = this.player.x - centerX;
      const relPY = this.player.y - centerY;
      const px = mapX + (relPX + chunksWidth / 2) * scale;
      const py = mapY + (relPY + chunksHeight / 2) * scale;
      
      this.minimap.fillStyle(0x00ffff, 1).fillCircle(px, py, 4);
      this.minimap.lineStyle(1, 0xffffff, 1).strokeCircle(px, py, 4);
    }

    getMinimapCoords(x, y, centerX, centerY, mapX, mapY, scale, chunksWidth, chunksHeight) {
      const relX = x - centerX;
      const relY = y - centerY;
      const mx = mapX + (relX + chunksWidth / 2) * scale;
      const my = mapY + (relY + chunksHeight / 2) * scale;
      
      return this.isInMinimapBounds(mx, my, mapX, mapY) ? { mx, my } : null;
    }

    isInMinimapBounds(mx, my, mapX, mapY) {
      return mx >= mapX && mx <= mapX + MINIMAP_SIZE && 
             my >= mapY && my <= mapY + MINIMAP_SIZE;
    }

    renderFullMap() {
      // Clear previous texts first
      this.fullMapTexts.forEach(t => t.destroy());
      this.fullMapTexts = [];

      if (!this.showFullMap) {
        this.fullMapBg.clear();
        this.fullMapGraphics.clear();
        this.fullMapTitle?.setVisible(false);
        this.fullMapInstruction?.setVisible(false);
        return;
      }

      const width = this.scale.width;
      const height = this.scale.height;
      const padding = 100;
      const mapWidth = width - padding * 2;
      const mapHeight = height - padding * 2 - 40;

      this.fullMapBg.clear();
      this.fullMapGraphics.clear();
      
      // Animated dark background with scan line effect
      this.fullMapBg.fillStyle(0x000000, 0.98).fillRect(0, 0, width, height);
      
      // Corner brackets for sci-fi feel
      const bracketSize = 40;
      const bracketThick = 3;
      this.fullMapBg.lineStyle(bracketThick, 0x00ffff, 0.8);
      // Top-left
      this.fullMapBg.lineBetween(20, 20, 20 + bracketSize, 20);
      this.fullMapBg.lineBetween(20, 20, 20, 20 + bracketSize);
      // Top-right
      this.fullMapBg.lineBetween(width - 20, 20, width - 20 - bracketSize, 20);
      this.fullMapBg.lineBetween(width - 20, 20, width - 20, 20 + bracketSize);
      // Bottom-left
      this.fullMapBg.lineBetween(20, height - 20, 20 + bracketSize, height - 20);
      this.fullMapBg.lineBetween(20, height - 20, 20, height - 20 - bracketSize);
      // Bottom-right
      this.fullMapBg.lineBetween(width - 20, height - 20, width - 20 - bracketSize, height - 20);
      this.fullMapBg.lineBetween(width - 20, height - 20, width - 20, height - 20 - bracketSize);
      
      // Dark frame around map area
      this.fullMapBg.fillStyle(0x001122, 0.4)
        .fillRect(padding - 35, padding - 35, mapWidth + 70, mapHeight + 70);

      // Calculate bounds of loaded chunks
      const radius = this.activeChunkRadius;
      const minChunkX = this.currentChunk.chunkX - radius;
      const maxChunkX = this.currentChunk.chunkX + radius;
      const minChunkY = this.currentChunk.chunkY - radius;
      const maxChunkY = this.currentChunk.chunkY + radius;
      
      const worldMinX = minChunkX * CHUNK_SIZE;
      const worldMaxX = (maxChunkX + 1) * CHUNK_SIZE;
      const worldMinY = minChunkY * CHUNK_SIZE;
      const worldMaxY = (maxChunkY + 1) * CHUNK_SIZE;
      
      const worldWidth = worldMaxX - worldMinX;
      const worldHeight = worldMaxY - worldMinY;

      // Calculate scale to fit loaded area
      const scale = Math.min(mapWidth / worldWidth, mapHeight / worldHeight) * 0.85;
      const offsetX = padding + (mapWidth - worldWidth * scale) / 2;
      const offsetY = padding + (mapHeight - worldHeight * scale) / 2;

      // Outer decorative borders
      this.fullMapGraphics.lineStyle(1, 0x00ffff, 0.2)
        .strokeRect(offsetX - 20, offsetY - 20, worldWidth * scale + 40, worldHeight * scale + 40);
      this.fullMapGraphics.lineStyle(2, 0x00ffff, 0.4)
        .strokeRect(offsetX - 15, offsetY - 15, worldWidth * scale + 30, worldHeight * scale + 30);
      this.fullMapGraphics.lineStyle(1, 0x00ddff, 0.6)
        .strokeRect(offsetX - 10, offsetY - 10, worldWidth * scale + 20, worldHeight * scale + 20);
      this.fullMapGraphics.lineStyle(3, 0x00ffff, 1)
        .strokeRect(offsetX - 5, offsetY - 5, worldWidth * scale + 10, worldHeight * scale + 10);

      // Draw chunk grid with better styling
      this.fullMapGraphics.lineStyle(1, 0x004466, 0.6);
      for (let cx = minChunkX; cx <= maxChunkX; cx++) {
        const x = offsetX + (cx * CHUNK_SIZE - worldMinX) * scale;
        this.fullMapGraphics.lineBetween(x, offsetY, x, offsetY + worldHeight * scale);
        
        // Chunk coordinate labels with background
        const coordBg = this.add.graphics()
          .fillStyle(0x000000, 0.8)
          .fillRect(x - 12, offsetY - 25, 24, 14)
          .setScrollFactor(0)
          .setDepth(2001);
        this.fullMapTexts.push(coordBg);
        
        const coordText = this.add.text(x, offsetY - 18, `${cx}`, {
          font: "bold 9px Courier",
          fill: "#00aacc",
          align: "center"
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2002);
        this.fullMapTexts.push(coordText);
      }
      
      for (let cy = minChunkY; cy <= maxChunkY; cy++) {
        const y = offsetY + (cy * CHUNK_SIZE - worldMinY) * scale;
        this.fullMapGraphics.lineBetween(offsetX, y, offsetX + worldWidth * scale, y);
        
        // Chunk coordinate labels with background
        const coordBg = this.add.graphics()
          .fillStyle(0x000000, 0.8)
          .fillRect(offsetX - 30, y - 7, 24, 14)
          .setScrollFactor(0)
          .setDepth(2001);
        this.fullMapTexts.push(coordBg);
        
        const coordText = this.add.text(offsetX - 18, y, `${cy}`, {
          font: "bold 9px Courier",
          fill: "#00aacc",
          align: "right"
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2002);
        this.fullMapTexts.push(coordText);
      }

      // Highlight current chunk with animated border
      const currentChunkX = offsetX + (this.currentChunk.chunkX * CHUNK_SIZE - worldMinX) * scale;
      const currentChunkY = offsetY + (this.currentChunk.chunkY * CHUNK_SIZE - worldMinY) * scale;
      const chunkWidth = CHUNK_SIZE * scale;
      
      this.fullMapGraphics.fillStyle(0x00ffff, 0.12)
        .fillRect(currentChunkX, currentChunkY, chunkWidth, chunkWidth);
      this.fullMapGraphics.lineStyle(2, 0x00ffff, 0.8)
        .strokeRect(currentChunkX, currentChunkY, chunkWidth, chunkWidth);
      this.fullMapGraphics.lineStyle(1, 0x00ffff, 0.4)
        .strokeRect(currentChunkX - 2, currentChunkY - 2, chunkWidth + 4, chunkWidth + 4);
      
      // Current chunk label
      const chunkLabel = this.add.text(
        currentChunkX + chunkWidth / 2, 
        currentChunkY + chunkWidth / 2, 
        "ACTIVE\nCHUNK", 
        {
          font: "bold 11px Courier",
          fill: "#00ffff",
          align: "center",
          stroke: "#000000",
          strokeThickness: 4
        }
      ).setOrigin(0.5).setScrollFactor(0).setDepth(2002).setAlpha(0.6);
      this.fullMapTexts.push(chunkLabel);

      // Render galaxies with improved visuals
      this.loadedChunks.forEach((chunk) => {
        chunk.galaxies.forEach((galaxy) => {
          const mx = offsetX + (galaxy.x - worldMinX) * scale;
          const my = offsetY + (galaxy.y - worldMinY) * scale;
          this.fullMapGraphics.fillStyle(0xcccccc, 0.3).fillCircle(mx, my, 3);
          this.fullMapGraphics.fillStyle(0xffffff, 0.6).fillCircle(mx, my, 2);
          this.fullMapGraphics.fillStyle(0xffffff, 1).fillCircle(mx, my, 1);
        });
      });

      // Collect and render procedural anomalies
      const proceduralAnomalies = [];
      this.loadedChunks.forEach((chunk) => {
        chunk.anomalies.forEach((anom) => {
          if (!anom.resolved) {
            proceduralAnomalies.push(anom);
          }
        });
      });

      proceduralAnomalies.forEach((anom) => {
        const mx = offsetX + (anom.x - worldMinX) * scale;
        const my = offsetY + (anom.y - worldMinY) * scale;
        const typeConfig = ANOMALY_TYPE_MAP[anom.type];
        
        // Layered glow effect
        this.fullMapGraphics.fillStyle(typeConfig?.color || 0xff0000, 0.1)
          .fillCircle(mx, my, 12);
        this.fullMapGraphics.fillStyle(typeConfig?.color || 0xff0000, 0.3)
          .fillCircle(mx, my, 8);
        this.fullMapGraphics.fillStyle(typeConfig?.color || 0xff0000, 0.6)
          .fillCircle(mx, my, 5);
        
        // Core with white border
        this.fullMapGraphics.fillStyle(typeConfig?.color || 0xff0000, 1)
          .fillCircle(mx, my, 4);
        this.fullMapGraphics.lineStyle(1.5, 0xffffff, 0.9)
          .strokeCircle(mx, my, 4);
        this.fullMapGraphics.lineStyle(1, typeConfig?.color || 0xff0000, 0.5)
          .strokeCircle(mx, my, 7);
      });

      // Collect backend anomalies in view
      const backendAnomaliesInView = [];
      this.backendAnomalies.forEach((backendAnomaly) => {
        if (!this.resolvedAnomalies.has(backendAnomaly.id)) {
          const anomX = backendAnomaly.location.x;
          const anomY = backendAnomaly.location.y;
          
          if (anomX >= worldMinX && anomX <= worldMaxX && 
              anomY >= worldMinY && anomY <= worldMaxY) {
            backendAnomaliesInView.push(backendAnomaly);
          }
        }
      });

      // Render backend anomalies with enhanced effects
      backendAnomaliesInView.forEach((backendAnomaly) => {
        const mx = offsetX + (backendAnomaly.location.x - worldMinX) * scale;
        const my = offsetY + (backendAnomaly.location.y - worldMinY) * scale;
        const typeConfig = ANOMALY_TYPE_MAP[backendAnomaly.type];
        
        // Pulsing danger rings
        this.fullMapGraphics.lineStyle(5, 0xffff00, 0.15).strokeCircle(mx, my, 22);
        this.fullMapGraphics.lineStyle(4, 0xffaa00, 0.3).strokeCircle(mx, my, 17);
        this.fullMapGraphics.lineStyle(3, 0xffff00, 0.6).strokeCircle(mx, my, 13);
        this.fullMapGraphics.lineStyle(3, 0xffff00, 1).strokeCircle(mx, my, 10);
        
        // Outer glow
        this.fullMapGraphics.fillStyle(0xffaa00, 0.2).fillCircle(mx, my, 16);
        this.fullMapGraphics.fillStyle(0xffdd00, 0.3).fillCircle(mx, my, 12);
        
        // Core with type color
        this.fullMapGraphics.fillStyle(typeConfig?.color || 0xff0000, 1)
          .fillCircle(mx, my, 8);
        this.fullMapGraphics.lineStyle(2, 0xffffff, 1)
          .strokeCircle(mx, my, 8);
        this.fullMapGraphics.lineStyle(1, 0xffff00, 0.8)
          .strokeCircle(mx, my, 11);
        
        // Enhanced label with icon
        const labelWidth = 85;
        const labelHeight = 22;
        const labelBg = this.add.graphics()
          .fillStyle(0x000000, 0.9)
          .fillRoundedRect(mx - labelWidth/2, my - 38, labelWidth, labelHeight, 6)
          .lineStyle(2, 0xffff00, 1)
          .strokeRoundedRect(mx - labelWidth/2, my - 38, labelWidth, labelHeight, 6)
          .lineStyle(1, 0xffaa00, 0.5)
          .strokeRoundedRect(mx - labelWidth/2 - 1, my - 39, labelWidth + 2, labelHeight + 2, 6)
          .setScrollFactor(0)
          .setDepth(2001);
        this.fullMapTexts.push(labelBg);
        
        const severityText = this.add.text(mx, my - 27, 
          `⚡ PRIORITY ${backendAnomaly.severity}`, {
          font: "bold 10px Courier",
          fill: "#ffff00",
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2003);
        this.fullMapTexts.push(severityText);
        
        // Type label below
        const typeLabel = this.add.text(mx, my + 18, typeConfig?.label || "ANOMALY", {
          font: "bold 8px Courier",
          fill: "#ffffff",
          backgroundColor: "#000000",
          padding: { x: 4, y: 2 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2002);
        this.fullMapTexts.push(typeLabel);
        
        // Distance indicator
        const dist = Math.sqrt(
          (backendAnomaly.location.x - this.player.x) ** 2 + 
          (backendAnomaly.location.y - this.player.y) ** 2
        );
        const distText = this.add.text(mx, my + 30, `${dist.toFixed(0)}u`, {
          font: "bold 9px Courier",
          fill: "#00ffff",
          backgroundColor: "#000000",
          padding: { x: 3, y: 1 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2002);
        this.fullMapTexts.push(distText);
        
        // Draw line to player if close
        if (dist < worldWidth / 2) {
          const px = offsetX + (this.player.x - worldMinX) * scale;
          const py = offsetY + (this.player.y - worldMinY) * scale;
          this.fullMapGraphics.lineStyle(1, 0xffff00, 0.3);
          this.fullMapGraphics.lineBetween(mx, my, px, py);
        }
      });

      // Render player with enhanced visuals
      const px = offsetX + (this.player.x - worldMinX) * scale;
      const py = offsetY + (this.player.y - worldMinY) * scale;
      
      // Movement trail/direction
      const vel = this.player.body.velocity;
      if (vel.x !== 0 || vel.y !== 0) {
        const angle = Math.atan2(vel.y, vel.x);
        const speed = Math.sqrt(vel.x ** 2 + vel.y ** 2);
        const dirLength = 15 + Math.min(speed / 10, 20);
        
        // Direction cone
        this.fullMapGraphics.lineStyle(3, 0x00ffff, 0.3);
        this.fullMapGraphics.lineBetween(px, py, 
          px + Math.cos(angle) * dirLength,
          py + Math.sin(angle) * dirLength
        );
        this.fullMapGraphics.lineStyle(2, 0x00ffff, 0.6);
        this.fullMapGraphics.lineBetween(px, py, 
          px + Math.cos(angle) * (dirLength - 5),
          py + Math.sin(angle) * (dirLength - 5)
        );
      }
      
      // Player icon with rings
      this.fullMapGraphics.fillStyle(0x00ffff, 0.15).fillCircle(px, py, 18);
      this.fullMapGraphics.fillStyle(0x00ffff, 0.3).fillCircle(px, py, 14);
      this.fullMapGraphics.fillStyle(0x000000, 1).fillCircle(px, py, 10);
      this.fullMapGraphics.fillStyle(0x00ffff, 1).fillCircle(px, py, 9);
      this.fullMapGraphics.lineStyle(2, 0xffffff, 1).strokeCircle(px, py, 9);
      this.fullMapGraphics.lineStyle(1, 0x00ffff, 0.8).strokeCircle(px, py, 12);
      this.fullMapGraphics.lineStyle(1, 0x00ffff, 0.4).strokeCircle(px, py, 15);
      
      // Player label
      const playerLabelBg = this.add.graphics()
        .fillStyle(0x000000, 0.9)
        .fillRoundedRect(px - 20, py + 20, 40, 16, 4)
        .lineStyle(1, 0x00ffff, 0.8)
        .strokeRoundedRect(px - 20, py + 20, 40, 16, 4)
        .setScrollFactor(0)
        .setDepth(2001);
      this.fullMapTexts.push(playerLabelBg);
      
      const playerLabel = this.add.text(px, py + 28, "◆ YOU ◆", {
        font: "bold 9px Courier",
        fill: "#00ffff",
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2002);
      this.fullMapTexts.push(playerLabel);

      // Enhanced legend panel
      const legendX = offsetX + worldWidth * scale + 35;
      const legendY = offsetY + 10;
      const legendWidth = 120;
      
      // Legend background
      const legendBg = this.add.graphics()
        .fillStyle(0x000000, 0.85)
        .fillRoundedRect(legendX - 10, legendY - 10, legendWidth, 140, 8)
        .lineStyle(2, 0x00ffff, 0.6)
        .strokeRoundedRect(legendX - 10, legendY - 10, legendWidth, 140, 8)
        .setScrollFactor(0)
        .setDepth(2000);
      this.fullMapTexts.push(legendBg);
      
      const legendTitle = this.add.text(legendX + legendWidth/2 - 10, legendY, "LEGEND", {
        font: "bold 11px Courier",
        fill: "#00ffff",
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2002);
      this.fullMapTexts.push(legendTitle);
      
      const legendItems = [
        { color: 0xffffff, label: "Galaxy", isCircle: true, size: 2 },
        { color: 0xff6600, label: "Procedural", isCircle: true, size: 4 },
        { color: 0xffff00, label: "Backend ⚡", isCircle: true, isSpecial: true, size: 8 },
        { color: 0x00ffff, label: "Your Ship", isCircle: true, size: 9 },
        { color: 0x00ffff, label: "Active Chunk", isBox: true },
      ];

      legendItems.forEach((item, i) => {
        const ly = legendY + 25 + i * 22;
        
        if (item.isCircle) {
          if (item.isSpecial) {
            this.fullMapGraphics.lineStyle(2, item.color, 0.8).strokeCircle(legendX + 8, ly + 6, 6);
          }
          this.fullMapGraphics.fillStyle(item.color, 0.9).fillCircle(legendX + 8, ly + 6, item.size);
          if (item.size > 2) {
            this.fullMapGraphics.lineStyle(1, 0xffffff, 0.7).strokeCircle(legendX + 8, ly + 6, item.size);
          }
        }
        
        if (item.isBox) {
          this.fullMapGraphics.fillStyle(item.color, 0.15).fillRect(legendX + 2, ly, 12, 12);
          this.fullMapGraphics.lineStyle(1.5, item.color, 0.8).strokeRect(legendX + 2, ly, 12, 12);
        }
        
        const legendText = this.add.text(legendX + 25, ly + 6, item.label, {
          font: "9px Courier",
          fill: "#cccccc"
        }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(2002);
        this.fullMapTexts.push(legendText);
      });

      // Stats panel on left side
      const statsX = offsetX - worldWidth * scale / 2 - 140;
      const statsY = offsetY + 10;
      const statsWidth = 130;
      
      const statsBg = this.add.graphics()
        .fillStyle(0x000000, 0.85)
        .fillRoundedRect(statsX, statsY, statsWidth, 180, 8)
        .lineStyle(2, 0x00ff88, 0.6)
        .strokeRoundedRect(statsX, statsY, statsWidth, 180, 8)
        .setScrollFactor(0)
        .setDepth(2000);
      this.fullMapTexts.push(statsBg);
      
      const statsTitle = this.add.text(statsX + statsWidth/2, statsY + 12, "SCAN REPORT", {
        font: "bold 11px Courier",
        fill: "#00ff88",
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2002);
      this.fullMapTexts.push(statsTitle);
      
      const totalGalaxies = Array.from(this.loadedChunks.values())
        .reduce((sum, chunk) => sum + chunk.galaxies.length, 0);
      
      const statsData = [
        { label: "Loaded Chunks", value: this.loadedChunks.size, color: "#00aacc" },
        { label: "Galaxies", value: totalGalaxies, color: "#ffffff" },
        { label: "Backend ⚡", value: backendAnomaliesInView.length, color: "#ffff00" },
        { label: "Procedural", value: proceduralAnomalies.length, color: "#ff6600" },
        { label: "Position", value: `${this.player.x.toFixed(0)}, ${this.player.y.toFixed(0)}`, color: "#00ffff" },
      ];
      
      statsData.forEach((stat, i) => {
        const sy = statsY + 38 + i * 24;
        
        const statLabel = this.add.text(statsX + 10, sy, stat.label + ":", {
          font: "9px Courier",
          fill: "#999999"
        }).setOrigin(0, 0).setScrollFactor(0).setDepth(2002);
        this.fullMapTexts.push(statLabel);
        
        const statValue = this.add.text(statsX + 10, sy + 11, String(stat.value), {
          font: "bold 10px Courier",
          fill: stat.color
        }).setOrigin(0, 0).setScrollFactor(0).setDepth(2002);
        this.fullMapTexts.push(statValue);
      });

      // Update title with scan animation effect
      this.fullMapTitle.setText("═══ TACTICAL SCAN ═══").setVisible(true);
      
      const instructionText = `Viewing ${this.loadedChunks.size} chunks • ${backendAnomaliesInView.length} priority targets • Press M to close`;
      this.fullMapInstruction.setText(instructionText).setVisible(true);
    }

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
  const [expandedPanels, setExpandedPanels] = useState({
    universe: true,
    structures: true,
    life: true,
    mission: true,
    controls: true
  });

  const togglePanel = (panel) => {
    setExpandedPanels(prev => ({ ...prev, [panel]: !prev[panel] }));
  };

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
        width: "100%",
        height: "100%",
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
          console.error("Cleanup error:", e);
        }
      }
      gameRef.current = null;
      sceneRef.current = null;
    };
  }, [universe?.seed, universe?.name]);

  useEffect(() => {
    if (sceneRef.current && universe) {
      sceneRef.current.updateFromUniverse(universe);
    }
  }, [universe?.anomalies, universe?.currentState]);

  // Helper function to format large numbers
  const formatNumber = (num) => {
    if (!num) return '0';
    if (num < 1e3) return Math.floor(num).toLocaleString();
    if (num < 1e6) return (num / 1e3).toFixed(1) + 'K';
    if (num < 1e9) return (num / 1e6).toFixed(1) + 'M';
    if (num < 1e12) return (num / 1e9).toFixed(2) + 'B';
    return num.toExponential(1);
  };

  // Calculate stability status
  const getStabilityStatus = () => {
    const stability = universe?.currentState?.stabilityIndex || 1;
    if (stability > 0.8) return { text: 'Excellent', color: 'text-green-400', icon: '✓' };
    if (stability > 0.6) return { text: 'Good', color: 'text-lime-400', icon: '○' };
    if (stability > 0.4) return { text: 'Fair', color: 'text-yellow-400', icon: '△' };
    if (stability > 0.2) return { text: 'Poor', color: 'text-orange-400', icon: '!' };
    return { text: 'Critical', color: 'text-red-400', icon: '⚠' };
  };

  // Get cosmic phase display
  const getCosmicPhase = () => {
    const phase = universe?.currentState?.cosmicPhase || 'unknown';
    const phases = {
      dark_ages: { text: 'Dark Ages', icon: '🌑' },
      reionization: { text: 'Reionization', icon: '🌓' },
      galaxy_formation: { text: 'Galaxy Formation', icon: '🌌' },
      stellar_peak: { text: 'Stellar Peak', icon: '⭐' },
      gradual_decline: { text: 'Gradual Decline', icon: '🌅' },
      twilight_era: { text: 'Twilight Era', icon: '🌆' },
      degenerate_era: { text: 'Degenerate Era', icon: '🌃' }
    };
    return phases[phase] || { text: phase, icon: '❓' };
  };

  const stabilityStatus = getStabilityStatus();
  const cosmicPhase = getCosmicPhase();
  const activeCivs = universe?.civilizations?.filter(c => !c.extinct).length || 0;
  const advancedCivs = universe?.civilizations?.filter(c => !c.extinct && c.type !== 'Type0').length || 0;

  return (
    <div className="w-screen h-screen bg-black relative overflow-hidden">
      {/* Enhanced Universe Status Panel */}
      <div className="absolute top-4 left-4 z-10 text-white text-sm max-w-xs">
        {/* Main Info Card */}
        <div className="bg-black bg-opacity-95 rounded-lg border-2 border-cyan-500 shadow-lg shadow-cyan-500/50 mb-3">
          <div 
            className="px-4 py-3 border-b border-cyan-700 cursor-pointer hover:bg-cyan-900 hover:bg-opacity-20 transition-colors"
            onClick={() => togglePanel('universe')}
          >
            <div className="font-bold text-cyan-400 text-base flex items-center justify-between">
              <span>🌌 {universe?.name || "Unknown Universe"}</span>
              <span className="text-xs text-gray-400 flex items-center gap-2">
                {universe?.difficulty || "N/A"}
                <span className="text-lg">{expandedPanels.universe ? '−' : '+'}</span>
              </span>
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {cosmicPhase.icon} {cosmicPhase.text}
            </div>
          </div>
          
          {expandedPanels.universe && (
            <div className="px-4 py-3 space-y-2 text-xs">
              {/* Age & Time */}
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Age:</span>
                <span className="text-purple-400 font-mono">
                  {((universe?.currentState?.age || 0) / 1e9).toFixed(2)} Gyr
                </span>
              </div>

              {/* Stability with visual indicator */}
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Stability:</span>
                <span className={`${stabilityStatus.color} font-mono flex items-center gap-1`}>
                  <span>{stabilityStatus.icon}</span>
                  {((universe?.currentState?.stabilityIndex || 1) * 100).toFixed(1)}%
                  <span className="text-xs">({stabilityStatus.text})</span>
                </span>
              </div>

              {/* Temperature */}
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Temperature:</span>
                <span className="text-blue-300 font-mono">
                  {(universe?.currentState?.temperature || 2.725).toFixed(3)} K
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Structures Card */}
        <div className="bg-black bg-opacity-95 rounded-lg border-2 border-purple-500 shadow-lg shadow-purple-500/30 mb-3">
          <div 
            className="px-4 py-2 border-b border-purple-700 cursor-pointer hover:bg-purple-900 hover:bg-opacity-20 transition-colors"
            onClick={() => togglePanel('structures')}
          >
            <div className="font-bold text-purple-400 text-xs flex items-center justify-between">
              <span>🏗️ COSMIC STRUCTURES</span>
              <span className="text-lg">{expandedPanels.structures ? '−' : '+'}</span>
            </div>
          </div>
          
          {expandedPanels.structures && (
            <div className="px-4 py-3 space-y-1.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Galaxies:</span>
                <span className="text-yellow-400 font-mono">
                  {formatNumber(universe?.currentState?.galaxyCount)}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Stars:</span>
                <span className="text-blue-400 font-mono">
                  {formatNumber(universe?.currentState?.starCount)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-400">Black Holes:</span>
                <span className="text-indigo-400 font-mono">
                  {formatNumber(universe?.currentState?.blackHoleCount)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-400">Metallicity:</span>
                <span className="text-amber-400 font-mono">
                  {((universe?.currentState?.metallicity || 0) * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Life & Civilizations Card */}
        {(universe?.currentState?.lifeBearingPlanetsCount > 0 || activeCivs > 0) && (
          <div className="bg-black bg-opacity-95 rounded-lg border-2 border-green-500 shadow-lg shadow-green-500/30 mb-3">
            <div 
              className="px-4 py-2 border-b border-green-700 cursor-pointer hover:bg-green-900 hover:bg-opacity-20 transition-colors"
              onClick={() => togglePanel('life')}
            >
              <div className="font-bold text-green-400 text-xs flex items-center justify-between">
                <span>🌿 LIFE & CIVILIZATION</span>
                <span className="text-lg">{expandedPanels.life ? '−' : '+'}</span>
              </div>
            </div>
            
            {expandedPanels.life && (
              <div className="px-4 py-3 space-y-1.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Life-Bearing:</span>
                  <span className="text-green-400 font-mono">
                    {formatNumber(universe?.currentState?.lifeBearingPlanetsCount)}
                  </span>
                </div>
                
                {activeCivs > 0 && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Civilizations:</span>
                      <span className="text-cyan-400 font-mono">
                        {activeCivs}
                      </span>
                    </div>

                    {advancedCivs > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Advanced (Type I+):</span>
                        <span className="text-purple-400 font-mono">
                          {advancedCivs}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between items-center text-gray-500 text-[10px]">
                      <span>Extinct:</span>
                      <span className="font-mono">
                        {universe?.civilizations?.filter(c => c.extinct).length || 0}
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Mission Status Card */}
        <div className="bg-black bg-opacity-95 rounded-lg border-2 border-pink-500 shadow-lg shadow-pink-500/30">
          <div 
            className="px-4 py-2 border-b border-pink-700 cursor-pointer hover:bg-pink-900 hover:bg-opacity-20 transition-colors"
            onClick={() => togglePanel('mission')}
          >
            <div className="font-bold text-pink-400 text-xs flex items-center justify-between">
              <span>🎯 MISSION STATUS</span>
              <span className="text-lg">{expandedPanels.mission ? '−' : '+'}</span>
            </div>
          </div>
          
          {expandedPanels.mission && (
            <div className="px-4 py-3 space-y-1.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Anomalies Discovered:</span>
                <span className="text-green-400 font-mono">{stats.discovered}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Anomalies Resolved:</span>
                <span className="text-cyan-400 font-mono">{stats.resolved}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-400">⚡ Backend Active:</span>
                <span className="text-yellow-400 font-mono">
                  {universe?.anomalies?.filter(a => !a.resolved).length || 0}
                </span>
              </div>

              {stats.discovered > 0 && (
                <div className="pt-2 border-t border-pink-700">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-gray-500">Success Rate:</span>
                    <span className="text-purple-400 font-mono">
                      {((stats.resolved / stats.discovered) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Enhanced Controls Panel */}
      <div className="absolute bottom-5 right-4 z-10 text-white">
        <div className="bg-black bg-opacity-95 rounded-lg border-2 border-cyan-500 shadow-lg shadow-cyan-500/30">
          <div 
            className="px-4 py-2 border-b border-cyan-700 cursor-pointer hover:bg-cyan-900 hover:bg-opacity-20 transition-colors"
            onClick={() => togglePanel('controls')}
          >
            <div className="font-bold text-cyan-400 text-sm flex items-center justify-between">
              <span>⌨️ CONTROLS</span>
              <span className="text-lg">{expandedPanels.controls ? '−' : '+'}</span>
            </div>
          </div>
          
          {expandedPanels.controls && (
            <div className="px-4 py-3 space-y-1 text-xs">
              <div className="flex items-center gap-3">
                <kbd className="px-2 py-1 bg-gray-800 rounded border border-gray-600 text-[10px] font-mono">
                  WASD
                </kbd>
                <span className="text-gray-300">Movement</span>
              </div>
              
              <div className="flex items-center gap-3">
                <kbd className="px-2 py-1 bg-gray-800 rounded border border-gray-600 text-[10px] font-mono">
                  F
                </kbd>
                <span className="text-gray-300">Resolve Anomaly</span>
              </div>
              
              <div className="flex items-center gap-3">
                <kbd className="px-2 py-1 bg-gray-800 rounded border border-gray-600 text-[10px] font-mono">
                  M
                </kbd>
                <span className="text-gray-300">Toggle Chunk Map</span>
              </div>

              <div className="pt-2 border-t border-cyan-700 mt-2">
                <div className="text-yellow-400 text-[10px] flex items-center gap-1">
                  <span>⚡</span>
                  <span>Backend Anomaly (High Priority)</span>
                </div>
                <div className="text-gray-400 text-[10px] mt-1 flex items-center gap-1">
                  <span>○</span>
                  <span>Procedural Anomaly</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div id="phaser-container" className="w-full h-full" />
    </div>
  );
};

export default PhaserGame;