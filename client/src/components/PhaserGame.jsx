import { useEffect, useRef, useState } from "react";
import Phaser from "phaser";
import seedrandom from "seedrandom";
import axios from "axios";

// Chunk system constants
const CHUNK_SIZE = 1000;
const UNIVERSE_SIZE = 100000;
const MINIMAP_SIZE = 140;

// Helper functions
const getChunkCoords = (x, y) => ({
  chunkX: Math.floor(x / CHUNK_SIZE),
  chunkY: Math.floor(y / CHUNK_SIZE),
});

const getChunkKey = (x, y) => `${x}:${y}`;

const PhaserGame = ({ universe }) => {
  const gameRef = useRef(null);
  const [resolvedCount, setResolvedCount] = useState(0);

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
      // Player setup
      this.player = this.physics.add
        .sprite(0, 0, "Player")
        .setScale(0.05)
        .setDamping(true)
        .setDrag(0.98)
        .setMaxVelocity(300)
        .setCollideWorldBounds(false);

      this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
      this.cameras.main.setZoom(1.5);

      // Lighting
      this.lights.enable().setAmbientColor(0x111111);
      this.player.setPipeline("Light2D");
      this.lights.addLight(this.player.x, this.player.y, 200).setIntensity(2.0);

      // Input
      this.cursors = this.input.keyboard.addKeys({
        up: Phaser.Input.Keyboard.KeyCodes.W,
        down: Phaser.Input.Keyboard.KeyCodes.S,
        left: Phaser.Input.Keyboard.KeyCodes.A,
        right: Phaser.Input.Keyboard.KeyCodes.D,
      });
      this.fixKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);

      // Initialize chunk system
      this.loadedChunks = new Map();
      this.activeChunkRadius = 2;
      this.currentChunk = getChunkCoords(this.player.x, this.player.y);

      // Define chunk methods on the scene
      this.loadNearbyChunks = (centerX, centerY) => {
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

        // Remove old chunks
        this.loadedChunks.forEach((chunk, key) => {
          if (!newChunks.has(key)) {
            chunk.objects.forEach(obj => obj.destroy());
          }
        });

        this.loadedChunks = newChunks;
      };

      this.generateChunk = (chunkX, chunkY) => {
        const chunk = { objects: [] };
        const chunkSeed = universe.seed + getChunkKey(chunkX, chunkY);
        const chunkRNG = seedrandom(chunkSeed);

        // Generate 20 galaxies per chunk
        for (let i = 0; i < 20; i++) {
          const x = chunkX * CHUNK_SIZE + chunkRNG() * CHUNK_SIZE;
          const y = chunkY * CHUNK_SIZE + chunkRNG() * CHUNK_SIZE;
          const size = chunkRNG() * 30 + 10;
          const color = Phaser.Display.Color.HSVColorWheel()[
            Math.floor(chunkRNG() * 360)
          ];

          const galaxy = this.add.graphics({ x, y })
            .fillStyle(Phaser.Display.Color.GetColor(color.r, color.g, color.b), 1)
            .fillCircle(0, 0, size)
            .setDepth(-1);

          chunk.objects.push(galaxy);
        }
        return chunk;
      };

      // Initial chunk load
      this.loadNearbyChunks(this.currentChunk.chunkX, this.currentChunk.chunkY);
      this.activeAnomalies = [];
      // Anomaly setup
      const anomalies = universe.anomalies
        ?.filter((a) => !a.resolved)
        .map((a) => ({
          x: a.location?.x ?? rng() * UNIVERSE_SIZE - UNIVERSE_SIZE / 2,
          y: a.location?.y ?? rng() * UNIVERSE_SIZE - UNIVERSE_SIZE / 2,
          type: a.type,
          severity: a.severity ?? 5,
          _id: a._id,
          resolved: false,
          glow: null,
          interactionText: null,
        }));

      // Create anomaly graphics
      anomalies.forEach((a) => {
        const anomaly = this.add.graphics({ x: a.x, y: a.y })
          .fillStyle(0xff0000, 0.6)
          .fillCircle(0, 0, 10 + a.severity)
          .lineStyle(2, 0xff5555, 1)
          .strokeCircle(0, 0, 10 + a.severity);

        const glow = this.add.graphics({ x: a.x, y: a.y })
          .fillStyle(0xff0000, 0.3)
          .fillCircle(0, 0, 20 + a.severity * 2)
          .setBlendMode(Phaser.BlendModes.ADD);

        this.tweens.add({
          targets: glow,
          scaleX: 1.2,
          scaleY: 1.2,
          alpha: 0.5,
          duration: 1000 + a.severity * 100,
          yoyo: true,
          repeat: -1,
        });

        const text = this.add.text(a.x, a.y - 40, `[${a.type}] PRESS F`, {
          font: 'bold 16px "Press Start 2P", Courier, monospace',
          fill: "#00ff00",
          backgroundColor: "#000000",
          padding: { x: 8, y: 4 },
          align: "center",
          stroke: "#003300",
          strokeThickness: 2,
        }).setOrigin(0.5).setVisible(false).setDepth(1000);

        a.entity = anomaly;
        a.glow = glow;
        a.interactionText = text;
        a.inRange = false;
        this.activeAnomalies.push(a);
      });

      // Minimap setup
      this.minimap = this.add.graphics().setScrollFactor(0).setDepth(1000);
      this.minimapBorder = this.add.graphics().setScrollFactor(0).setDepth(999);
    }

    function update() {
      // Player movement
      const speed = 200;
      this.player.setAcceleration(
        this.cursors.left.isDown ? -speed : this.cursors.right.isDown ? speed : 0,
        this.cursors.up.isDown ? -speed : this.cursors.down.isDown ? speed : 0
      );

      // Chunk updates
      const newChunk = getChunkCoords(this.player.x, this.player.y);
      if (newChunk.chunkX !== this.currentChunk.chunkX || 
          newChunk.chunkY !== this.currentChunk.chunkY) {
        this.currentChunk = newChunk;
        this.loadNearbyChunks(newChunk.chunkX, newChunk.chunkY);
      }

      // Anomaly interaction
      let nearbyAnomaly = null;
      this.activeAnomalies.forEach((a) => {
        if (a.resolved) return;
        const dist = Phaser.Math.Distance.Between(
          a.x, a.y, this.player.x, this.player.y
        );
        a.inRange = dist < 60 + a.severity * 2;
        a.interactionText?.setVisible(a.inRange);
        if (a.inRange) nearbyAnomaly = a;
      });

      if (nearbyAnomaly && Phaser.Input.Keyboard.JustDown(this.fixKey)) {
        nearbyAnomaly.entity.destroy();
        nearbyAnomaly.glow.destroy();
        nearbyAnomaly.interactionText?.destroy();
        nearbyAnomaly.resolved = true;
        setResolvedCount(prev => prev + 1);

        axios.patch(
          `http://localhost:5000/api/universe/${universe._id}/resolve-anomaly/${nearbyAnomaly._id}`,
          {},
          { headers: { Authorization: localStorage.getItem("token") } }
        ).catch(err => console.error("Failed to resolve anomaly:", err));
      }

      // Update minimap
      const mapX = window.innerWidth - MINIMAP_SIZE - 250;
      const mapY = 150;
      const scale = MINIMAP_SIZE / UNIVERSE_SIZE;

      this.minimap.clear();
      this.minimap.fillStyle(0x000000, 0.7).fillRect(mapX, mapY, MINIMAP_SIZE, MINIMAP_SIZE);

      // Draw galaxies from loaded chunks
      this.loadedChunks.forEach(chunk => {
        chunk.objects.forEach(galaxy => {
          const mx = mapX + (galaxy.x + UNIVERSE_SIZE/2) * scale;
          const my = mapY + (galaxy.y + UNIVERSE_SIZE/2) * scale;
          this.minimap.fillStyle(0xaaaaaa, 1).fillCircle(mx, my, 1);
        });
      });

      // Draw player
      const px = mapX + (this.player.x + UNIVERSE_SIZE/2) * scale;
      const py = mapY + (this.player.y + UNIVERSE_SIZE/2) * scale;
      this.minimap.fillStyle(0x00ffff, 1).fillCircle(px, py, 3);
    }

    if (!gameRef.current) {
      gameRef.current = new Phaser.Game(config);
    }

    const resizeHandler = () => {
      gameRef.current?.scale.resize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", resizeHandler);

    return () => {
      window.removeEventListener("resize", resizeHandler);
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, [universe]);

  return (
    <div className="w-screen h-screen bg-black">
      <div className="absolute top-2 left-2 z-10 text-white text-sm px-4 py-2 bg-black bg-opacity-60 rounded">
        🌌 {universe.name} — {universe.difficulty}
        <br />
        🛠 Fixed: {universe.anomalies?.filter((a) => a.resolved)?.length || 0}/
        {universe.anomalies?.length || 0}
      </div>
      <div id="phaser-container" style={{ width: "100%", height: "100%" }} />
    </div>
  );
};

export default PhaserGame;