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

const ANOMALY_TYPES = [
  { type: "blackHoleMerger", color: 0x9900ff, label: "BLACK HOLE", baseRadius: 15 },
  { type: "darkEnergySurge", color: 0x0066ff, label: "DARK ENERGY", baseRadius: 12 },
  { type: "supernovaChain", color: 0xff6600, label: "SUPERNOVA", baseRadius: 18 },
  { type: "quantumTunneling", color: 0x00ff99, label: "QUANTUM", baseRadius: 10 },
  { type: "cosmicString", color: 0xff0066, label: "COSMIC STRING", baseRadius: 14 },
];

const UniverseSceneFactory = (props) => {
  // returns a Scene class that closes over props (universe, callbacks)
  return class UniverseScene extends Phaser.Scene {
    constructor() {
      super({ key: "UniverseScene" });
      this.loadedChunks = new Map();
      this.activeChunkRadius = 2;
      this.discoveredAnomalies = new Set();
      this.resolvedAnomalies = new Set();
      this.arrowStates = { up: false, down: false, left: false, right: false };
    }

    init(data) {
      this.universe = data.universe;
      this.onAnomalyResolved = data.onAnomalyResolved;
      this.setStats = data.setStats;
      // rng seed for visual determinism
      this.rng = seedrandom(this.universe.seed ?? "default");
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

      // Lights (enable global lights)
      this.lights.enable().setAmbientColor(0x0a0a0a);
      // Note: Pipelines on Graphics may not work — avoid setting pipeline on graphics objects
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

      // touch controls
      this.createTouchControls();

      // chunk system
      this.currentChunk = getChunkCoords(this.player.x, this.player.y);
      this.loadNearbyChunks(this.currentChunk.chunkX, this.currentChunk.chunkY);

      // UI & minimap
      this.showFullMap = false;
      this.createUI();
      this.updateUIPositions();

      this.scale.on("resize", () => {
        this.updateUIPositions();
        if (this.showFullMap) this.renderFullMap();
      });

      // initial render
      this.renderFullMap();
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

      // follow light
      this.playerLight.setPosition(this.player.x, this.player.y);

      // HUD
      const vel =
        Math.sqrt(this.player.body.velocity.x ** 2 + this.player.body.velocity.y ** 2) || 0;
      this.velocityText?.setText(`VELOCITY: ${vel.toFixed(1)} u/s`);
      this.coordText?.setText(
        `COORDINATES: X:${this.player.x.toFixed(0)} Y:${this.player.y.toFixed(0)}`
      );

      // chunk checks
      const newChunk = getChunkCoords(this.player.x, this.player.y);
      if (newChunk.chunkX !== this.currentChunk.chunkX || newChunk.chunkY !== this.currentChunk.chunkY) {
        this.currentChunk = newChunk;
        this.loadNearbyChunks(newChunk.chunkX, newChunk.chunkY);
      }

      // anomalies
      this.handleAnomalyInteraction();

      // map toggle
      if (Phaser.Input.Keyboard.JustDown(this.mapKey)) {
        this.showFullMap = !this.showFullMap;
        this.fullMapContainer?.setVisible(this.showFullMap);
        this.renderFullMap();
      }

      // minimap
      this.updateMinimap();
    }

    // ----- chunking & generation -----
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

      // cleanup old chunks not in newChunks
      this.loadedChunks.forEach((chunk, key) => {
        if (!newChunks.has(key)) {
          chunk.galaxies.forEach(g => g.destroy());
          chunk.anomalies.forEach(a => {
            a.entity?.destroy();
            a.glow?.destroy();
            if (a.light) this.lights.removeLight(a.light);
            a.interactionText?.destroy();
          });
        }
      });

      this.loadedChunks = newChunks;
    }

    generateChunk(chunkX, chunkY) {
      const chunk = { galaxies: [], anomalies: [] };
      const chunkSeed = (this.universe.seed ?? "seed") + getChunkKey(chunkX, chunkY);
      const rng = seedrandom(chunkSeed);

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

        // subtle light for large galaxies
        if (size > 20) {
          this.lights.addLight(x, y, size * 6, Phaser.Display.Color.GetColor(color.r, color.g, color.b), 0.2);
        }

        chunk.galaxies.push(g);
      }

      // anomalies (probabilistic)
      if (rng() < ANOMALY_SPAWN_CHANCE) {
        const anomalyCount = Math.floor(rng() * ANOMALIES_PER_CHUNK) + 1;
        for (let i = 0; i < anomalyCount; i++) {
          const type = ANOMALY_TYPES[Math.floor(rng() * ANOMALY_TYPES.length)];
          const severity = Math.floor(rng() * 5) + 1;
          const x = chunkX * CHUNK_SIZE + rng() * CHUNK_SIZE;
          const y = chunkY * CHUNK_SIZE + rng() * CHUNK_SIZE;
          const anomalyId = `${chunkX}:${chunkY}:${i}`;

          if (this.resolvedAnomalies.has(anomalyId)) continue;

          const anomaly = this.createAnomaly(x, y, type, severity, anomalyId);
          chunk.anomalies.push(anomaly);

          if (!this.discoveredAnomalies.has(anomalyId)) {
            this.discoveredAnomalies.add(anomalyId);
            // keep stats in React via closure
            this.setStats?.((prev) => ({ ...prev, discovered: (prev.discovered || 0) + 1 }));
          }
        }
      }

      return chunk;
    }

    createAnomaly(x, y, typeObj, severity, id) {
      const radius = typeObj.baseRadius + severity * 2;

      const entity = this.add.graphics({ x, y })
        .fillStyle(typeObj.color, 0.7)
        .fillCircle(0, 0, radius)
        .lineStyle(2, typeObj.color, 1)
        .strokeCircle(0, 0, radius)
        .setDepth(10);

      const glow = this.add.graphics({ x, y })
        .fillStyle(typeObj.color, 0.25)
        .fillCircle(0, 0, radius * 1.8)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(9);

      // tween glow alpha / scale (graphics can't easily tween scale in the same way, but we can tween scale)
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

      // pulse light intensity using a tween on a numeric property of a fake object
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

      const interactionText = this.add
        .text(x, y - radius - 25, `[${typeObj.label}]\nPRESS F TO RESOLVE`, {
          font: "bold 11px Courier",
          fill: "#00ff00",
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
      };
    }

    handleAnomalyInteraction() {
  let nearest = null;
  let minDist = Infinity;

  // Find nearest anomaly in range
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

  if (nearest && Phaser.Input.Keyboard.JustDown(this.fixKey)) {
    nearest.resolved = true;
    this.resolvedAnomalies.add(nearest.id);

    this.cameras.main.shake(200, 0.005);

    // ---- FIXED PARTICLES FOR PHASER 3.60 ----
    const particleBurst = this.add.particles(
      nearest.x,
      nearest.y,
      "Player", // same texture as before
      {
        speed: { min: 50, max: 150 },
        scale: { start: 0.02, end: 0 },
        lifespan: 800,
        quantity: 20,
        blendMode: "ADD"
      }
    );

    // auto-remove burst
    this.time.delayedCall(800, () => particleBurst.destroy());
    // ------------------------------------------

    // cleanup anomaly objects
    nearest.entity?.destroy();
    nearest.glow?.destroy();
    if (nearest.light) this.lights.removeLight(nearest.light);
    nearest.interactionText?.destroy();

    // update stats
    this.setStats?.((prev) => ({
      ...prev,
      resolved: (prev.resolved || 0) + 1,
    }));

    // callback
    if (this.onAnomalyResolved) {
      this.onAnomalyResolved({
        type: nearest.type,
        severity: nearest.severity,
        location: { x: nearest.x, y: nearest.y },
      });
    }
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
      // minimap
      this.minimap = this.add.graphics().setScrollFactor(0).setDepth(1000);
      this.minimapBorder = this.add.graphics().setScrollFactor(0).setDepth(999);

      // full map container
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

      // HUD
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

      // full map group add texts to container so toggle works
      this.fullMapContainer.add([this.fullMapTitle, this.fullMapInstruction]);
    }

    updateUIPositions() {
      const w = this.scale.width;
      const h = this.scale.height;

      this.minimapX = w - MINIMAP_SIZE - 270;
      this.minimapY = 150;

      // reposition arrows if present
      if (this.arrowUp) {
        this.arrowUp.setPosition(100, h - 120);
        this.arrowDown.setPosition(100, h - 40);
        this.arrowLeft.setPosition(50, h - 80);
        this.arrowRight.setPosition(150, h - 80);
      }

      this.velocityText?.setPosition(20, 20);

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

      // grid
      this.minimapBorder.lineStyle(1, 0x004444, 0.5);
      for (let dx = -radius; dx <= radius; dx++) {
        const x = mapX + (dx * CHUNK_SIZE + chunksWidth / 2) * scale;
        this.minimapBorder.lineBetween(x, mapY, x, mapY + MINIMAP_SIZE);
      }
      for (let dy = -radius; dy <= radius; dy++) {
        const y = mapY + (dy * CHUNK_SIZE + chunksHeight / 2) * scale;
        this.minimapBorder.lineBetween(mapX, y, mapX + MINIMAP_SIZE, y);
      }

      // galaxies
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

      // anomalies
      this.loadedChunks.forEach((chunk) => {
        chunk.anomalies.forEach((anom) => {
          if (!anom.resolved) {
            const relX = anom.x - centerX;
            const relY = anom.y - centerY;
            const mx = mapX + (relX + chunksWidth / 2) * scale;
            const my = mapY + (relY + chunksHeight / 2) * scale;
            if (mx >= mapX && mx <= mapX + MINIMAP_SIZE && my >= mapY && my <= mapY + MINIMAP_SIZE) {
              const t = ANOMALY_TYPES.find((tt) => tt.type === anom.type);
              this.minimap.fillStyle(t?.color || 0xff0000, 1).fillCircle(mx, my, 3);
            }
          }
        });
      });

      // player
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

      this.loadedChunks.forEach((chunk) => {
        chunk.galaxies.forEach((galaxy) => {
          const mx = offsetX + (galaxy.x + UNIVERSE_SIZE / 2) * scale;
          const my = offsetY + (galaxy.y + UNIVERSE_SIZE / 2) * scale;
          this.fullMapGraphics.fillStyle(0x666666, 0.5).fillCircle(mx, my, 2);
        });
      });

      this.loadedChunks.forEach((chunk) => {
        chunk.anomalies.forEach((anom) => {
          if (!anom.resolved) {
            const mx = offsetX + (anom.x + UNIVERSE_SIZE / 2) * scale;
            const my = offsetY + (anom.y + UNIVERSE_SIZE / 2) * scale;
            const t = ANOMALY_TYPES.find((tt) => tt.type === anom.type);
            this.fullMapGraphics.fillStyle(t?.color || 0xff0000, 0.8).fillCircle(mx, my, 4)
              .lineStyle(1, t?.color || 0xff0000, 1).strokeCircle(mx, my, 4);
          }
        });
      });

      const px = offsetX + (this.player.x + UNIVERSE_SIZE / 2) * scale;
      const py = offsetY + (this.player.y + UNIVERSE_SIZE / 2) * scale;
      this.fullMapGraphics.fillStyle(0x00ffff, 1).fillCircle(px, py, 6).lineStyle(2, 0xffffff, 1).strokeCircle(px, py, 8);

      this.fullMapTitle.setText("UNIVERSE MAP").setVisible(true);
      this.fullMapInstruction.setText("Press M to close").setVisible(true);
    }
  };
};

const PhaserGame = ({ universe, onAnomalyResolved, onUniverseUpdate }) => {
  const gameRef = useRef(null);
  const [stats, setStats] = useState({ resolved: 0, discovered: 0 });

  useEffect(() => {
    // Create Scene class with access to props via init data
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

    // create game once
    if (!gameRef.current) {
      gameRef.current = new Phaser.Game(config);
      // pass initial data to the scene when it starts
      gameRef.current.scene.start("UniverseScene", { universe, onAnomalyResolved, setStats });
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
    };
  }, [universe?.seed, universe?.name]); // keep deps minimal to avoid reinitializing often

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
            Stability: {(((universe?.currentState?.stabilityIndex || 1) * 100) ).toFixed(1)}%
          </div>
          <div className="text-pink-400">
            Interventions: {universe?.metrics?.playerInterventions || 0}
          </div>
        </div>
      </div>

      <div className="absolute bottom-5 right-4 z-10 text-white text-xs px-3 py-2 bg-black bg-opacity-90 rounded border border-cyan-500">
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
