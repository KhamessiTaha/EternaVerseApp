import React, { useEffect, useRef, useState } from "react";
import Phaser from "phaser";
import seedrandom from "seedrandom";

// Chunk system constants
const CHUNK_SIZE = 1000;
const UNIVERSE_SIZE = 100000;
const MINIMAP_SIZE = 150;

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
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: "100%",
        height: "100%",
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
      // basic scene state
      this.minimapX = 0;
      this.minimapY = 0;

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
      this.playerLight = this.lights.addLight(0, 0, 200).setIntensity(2.0);

      // Input
      this.cursors = this.input.keyboard.addKeys({
        up: Phaser.Input.Keyboard.KeyCodes.Z,
        down: Phaser.Input.Keyboard.KeyCodes.S,
        left: Phaser.Input.Keyboard.KeyCodes.Q,
        right: Phaser.Input.Keyboard.KeyCodes.D,
        w: Phaser.Input.Keyboard.KeyCodes.W,
        a: Phaser.Input.Keyboard.KeyCodes.A,
        s: Phaser.Input.Keyboard.KeyCodes.S,
        d: Phaser.Input.Keyboard.KeyCodes.D,
      });
      this.fixKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
      this.mapKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);

      // Movement arrows state and factory
      this.arrowStates = { up: false, down: false, left: false, right: false };
      const arrowSpacing = 50;

      const createArrow = (x, y, rotation, direction) => {
        const g = this.add.graphics()
          .fillStyle(0x00ff00, 0.6)
          .fillTriangle(-15, 10, 15, 10, 0, -10)
          .setPosition(x, y)
          .setRotation(rotation)
          .setScrollFactor(0)
          .setDepth(1001)
          .setInteractive(new Phaser.Geom.Triangle(-15, 10, 15, 10, 0, -10), Phaser.Geom.Triangle.Contains);

        g.on('pointerdown', () => {
          this.arrowStates[direction] = true;
          g.clear().fillStyle(0x00ff00, 1).fillTriangle(-15, 10, 15, 10, 0, -10);
        });
        g.on('pointerup', () => {
          this.arrowStates[direction] = false;
          g.clear().fillStyle(0x00ff00, 0.6).fillTriangle(-15, 10, 15, 10, 0, -10);
        });
        g.on('pointerout', () => {
          this.arrowStates[direction] = false;
          g.clear().fillStyle(0x00ff00, 0.6).fillTriangle(-15, 10, 15, 10, 0, -10);
        });

        return g;
      };

      // create arrows with placeholder positions; updateUIPositions will reposition them properly
      this.arrowUp = createArrow(100, this.scale.height - 150, 0, 'up');
      this.arrowDown = createArrow(100, this.scale.height - 50, Math.PI, 'down');
      this.arrowLeft = createArrow(50, this.scale.height - 100, -Math.PI / 2, 'left');
      this.arrowRight = createArrow(150, this.scale.height - 100, Math.PI / 2, 'right');

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
            .setDepth(-1)
            .setPipeline("Light2D");

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
          .strokeCircle(0, 0, 10 + a.severity)
          .setPipeline("Light2D");

        const glow = this.add.graphics({ x: a.x, y: a.y })
          .fillStyle(0xff0000, 0.3)
          .fillCircle(0, 0, 20 + a.severity * 2)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setPipeline("Light2D");

        // Add light to anomaly
        this.lights.addLight(a.x, a.y, 100 + a.severity * 10, 0xff0000, 1.5);

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
          font: 'bold 14px "Press Start 2P", Courier, monospace',
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

      // Minimap setup (fixed position handled by updateUIPositions)
      this.minimap = this.add.graphics().setScrollFactor(0).setDepth(1000);
      this.minimapBorder = this.add.graphics().setScrollFactor(0).setDepth(999);

      // Full map overlay container
      this.fullMapContainer = this.add.container(0, 0).setScrollFactor(0).setDepth(2000).setVisible(false);
      this.fullMapBg = this.add.graphics().setScrollFactor(0);
      this.fullMapGraphics = this.add.graphics().setScrollFactor(0);
      this.fullMapContainer.add([this.fullMapBg, this.fullMapGraphics]);

      // Title & instruction texts are created once and reused
      this.fullMapTitle = this.add.text(0, 0, '', {
        font: 'bold 18px "Press Start 2P", Courier, monospace',
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

      // Map toggle text
      this.mapToggleText = this.add.text(10, this.scale.height - 30, 'Press M for full map', {
        font: 'bold 12px Courier',
        fill: '#00ff00',
        backgroundColor: '#000000',
        padding: { x: 6, y: 3 },
      }).setScrollFactor(0).setDepth(1001).setAlpha(0.9);

      this.showFullMap = false;

      // Velocity indicator
      this.velocityText = this.add.text(10, 80, '', {
        font: 'bold 11px Courier',
        fill: '#ffff00',
        backgroundColor: '#000000',
        padding: { x: 6, y: 3 },
      }).setScrollFactor(0).setDepth(1001);

      // Coordinate display
      this.coordText = this.add.text(10, 100, '', {
        font: 'bold 11px Courier',
        fill: '#00ffff',
        backgroundColor: '#000000',
        padding: { x: 6, y: 3 },
      }).setScrollFactor(0).setDepth(1001);

      // Update UI positions helper
      this.updateUIPositions = () => {
        const w = this.scale.width;
        const h = this.scale.height;

        // Minimap top-right
        this.minimapX = w - MINIMAP_SIZE - 240;
        this.minimapY = 180;

        // Arrows bottom-left area
        const arrowBaseY = h - 100;
        this.arrowUp?.setPosition(100, arrowBaseY - arrowSpacing);
        this.arrowDown?.setPosition(100, arrowBaseY + arrowSpacing);
        this.arrowLeft?.setPosition(100 - arrowSpacing, arrowBaseY);
        this.arrowRight?.setPosition(100 + arrowSpacing, arrowBaseY);

        // Map toggle and HUD
        this.mapToggleText?.setPosition(10, h - 30);

        this.velocityText?.setPosition(10, 80);
        this.coordText?.setPosition(10, 100);

        // Full map title/instruction positions
        this.fullMapTitle?.setPosition(w / 2, 50);
        this.fullMapInstruction?.setPosition(w / 2, h - 40);
      };

      // Wire up resize handling so UI stays responsive
      this.scale.on('resize', () => {
        this.updateUIPositions();
        if (this.showFullMap) this.renderFullMap();
      });

      // Initial UI positioning
      this.updateUIPositions();

      // Initial render of full map elements (hidden by default)
      this.renderFullMap = () => {
        const width = this.scale.width;
        const height = this.scale.height;
        const padding = 50;
        const mapWidth = width - padding * 2;
        const mapHeight = height - padding * 2;

        this.fullMapBg.clear();
        this.fullMapGraphics.clear();

        // Background
        this.fullMapBg
          .fillStyle(0x000000, 0.95)
          .fillRect(0, 0, width, height);

        // Map border - CMB style
        this.fullMapGraphics
          .lineStyle(3, 0x00ffff, 1)
          .strokeRect(padding - 3, padding - 3, mapWidth + 6, mapHeight + 6)
          .lineStyle(1, 0x4444ff, 0.5)
          .strokeRect(padding - 6, padding - 6, mapWidth + 12, mapHeight + 12);

        // Grid
        const gridSpacing = 50;
        this.fullMapGraphics.lineStyle(1, 0x222244, 0.3);
        for (let x = padding; x <= padding + mapWidth; x += gridSpacing) {
          this.fullMapGraphics.lineBetween(x, padding, x, padding + mapHeight);
        }
        for (let y = padding; y <= padding + mapHeight; y += gridSpacing) {
          this.fullMapGraphics.lineBetween(padding, y, padding + mapWidth, y);
        }

        const scale = Math.min(mapWidth / UNIVERSE_SIZE, mapHeight / UNIVERSE_SIZE);
        const offsetX = padding + (mapWidth - UNIVERSE_SIZE * scale) / 2;
        const offsetY = padding + (mapHeight - UNIVERSE_SIZE * scale) / 2;

        // Draw galaxies
        this.loadedChunks.forEach(chunk => {
          chunk.objects.forEach(galaxy => {
            const mx = offsetX + (galaxy.x + UNIVERSE_SIZE / 2) * scale;
            const my = offsetY + (galaxy.y + UNIVERSE_SIZE / 2) * scale;

            const temp = (galaxy.x + galaxy.y) % 360;
            const color = Phaser.Display.Color.HSVToRGB(temp / 360, 0.6, 0.8);

            this.fullMapGraphics
              .fillStyle(Phaser.Display.Color.GetColor(color.r, color.g, color.b), 0.6)
              .fillCircle(mx, my, 2);
          });
        });

        // Draw anomalies
        this.activeAnomalies.forEach(a => {
          if (!a.resolved) {
            const mx = offsetX + (a.x + UNIVERSE_SIZE / 2) * scale;
            const my = offsetY + (a.y + UNIVERSE_SIZE / 2) * scale;

            this.fullMapGraphics
              .fillStyle(0xff0000, 0.8)
              .fillCircle(mx, my, 5)
              .lineStyle(2, 0xff5555, 1)
              .strokeCircle(mx, my, 5);
          }
        });

        // Draw player
        const px = offsetX + (this.player.x + UNIVERSE_SIZE / 2) * scale;
        const py = offsetY + (this.player.y + UNIVERSE_SIZE / 2) * scale;

        this.fullMapGraphics
          .fillStyle(0x00ffff, 1)
          .fillCircle(px, py, 6)
          .lineStyle(2, 0xffffff, 1)
          .strokeCircle(px, py, 6)
          .lineStyle(1, 0x00ffff, 0.5)
          .strokeCircle(px, py, 12);

        // Set text
        this.fullMapTitle.setText('COSMIC MICROWAVE BACKGROUND MAP');
        this.fullMapInstruction.setText('Press M to close');

        // Visibility
        this.fullMapTitle.setVisible(this.showFullMap);
        this.fullMapInstruction.setVisible(this.showFullMap);
      };

      // Initial render call to set visuals (hidden by default)
      this.renderFullMap();

    }

    function update() {
      // Player movement with both ZQSD and WASD
      const speed = 200;
      const isMovingLeft = this.cursors.left.isDown || this.cursors.a.isDown || this.arrowStates.left;
      const isMovingRight = this.cursors.right.isDown || this.cursors.d.isDown || this.arrowStates.right;
      const isMovingUp = this.cursors.up.isDown || this.cursors.w.isDown || this.arrowStates.up;
      const isMovingDown = this.cursors.down.isDown || this.cursors.s.isDown || this.arrowStates.down;

      this.player.setAcceleration(
        isMovingLeft ? -speed : isMovingRight ? speed : 0,
        isMovingUp ? -speed : isMovingDown ? speed : 0
      );

      // Update player light position
      this.playerLight.setPosition(this.player.x, this.player.y);

      // Update velocity and position display
      const velocity = Math.sqrt(
        this.player.body.velocity.x ** 2 + this.player.body.velocity.y ** 2
      );
      this.velocityText.setText(`Velocity: ${velocity.toFixed(1)} u/s`);
      this.coordText.setText(
        `Position: X:${this.player.x.toFixed(0)} Y:${this.player.y.toFixed(0)}`
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
        // Optimistically update UI first
        nearbyAnomaly.entity.destroy();
        nearbyAnomaly.glow.destroy();
        nearbyAnomaly.interactionText?.destroy();
        nearbyAnomaly.resolved = true;

        // Update the universe object to sync with parent component
        const anomalyIndex = universe.anomalies.findIndex(a => a._id === nearbyAnomaly._id);
        if (anomalyIndex !== -1) {
          universe.anomalies[anomalyIndex].resolved = true;
        }

        // Trigger React state update
        setResolvedCount(prev => prev + 1);

        // Send to API if available
        if (universe._id) {
          fetch(
            `http://localhost:5000/api/universe/${universe._id}/resolve-anomaly/${nearbyAnomaly._id}`,
            {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': localStorage.getItem("token") || ''
              }
            }
          ).then(response => {
            if (!response.ok) {
              console.error("Failed to resolve anomaly on server");
            }
          }).catch(err => {
            console.error("Failed to resolve anomaly:", err);
          });
        }
      }

      // Toggle full map
      if (Phaser.Input.Keyboard.JustDown(this.mapKey)) {
        this.showFullMap = !this.showFullMap;
        this.fullMapContainer.setVisible(this.showFullMap);

        // update title/instruction visibility handled inside renderFullMap
        this.renderFullMap();
      }

      // Update minimap using responsive positions
      const mapX = this.minimapX;
      const mapY = this.minimapY;
      const scale = MINIMAP_SIZE / UNIVERSE_SIZE;

      this.minimap.clear();
      this.minimapBorder.clear();

      // Minimap border with glow
      this.minimapBorder
        .lineStyle(3, 0x00ffff, 0.8)
        .strokeRect(mapX - 2, mapY - 2, MINIMAP_SIZE + 4, MINIMAP_SIZE + 4)
        .lineStyle(1, 0x00ffff, 0.4)
        .strokeRect(mapX - 5, mapY - 5, MINIMAP_SIZE + 10, MINIMAP_SIZE + 10);

      // Minimap background
      this.minimap
        .fillStyle(0x000033, 0.9)
        .fillRect(mapX, mapY, MINIMAP_SIZE, MINIMAP_SIZE);

      // Draw galaxies from loaded chunks
      this.loadedChunks.forEach(chunk => {
        chunk.objects.forEach(galaxy => {
          const mx = mapX + (galaxy.x + UNIVERSE_SIZE/2) * scale;
          const my = mapY + (galaxy.y + UNIVERSE_SIZE/2) * scale;
          if (mx >= mapX && mx <= mapX + MINIMAP_SIZE && my >= mapY && my <= mapY + MINIMAP_SIZE) {
            this.minimap.fillStyle(0xaaaaaa, 0.8).fillCircle(mx, my, 1.5);
          }
        });
      });

      // Draw anomalies on minimap
      this.activeAnomalies.forEach(a => {
        if (!a.resolved) {
          const mx = mapX + (a.x + UNIVERSE_SIZE/2) * scale;
          const my = mapY + (a.y + UNIVERSE_SIZE/2) * scale;
          if (mx >= mapX && mx <= mapX + MINIMAP_SIZE && my >= mapY && my <= mapY + MINIMAP_SIZE) {
            this.minimap.fillStyle(0xff0000, 1).fillCircle(mx, my, 2);
          }
        }
      });

      // Draw player on minimap
      const px = mapX + (this.player.x + UNIVERSE_SIZE/2) * scale;
      const py = mapY + (this.player.y + UNIVERSE_SIZE/2) * scale;
      this.minimap
        .fillStyle(0x00ffff, 1)
        .fillCircle(px, py, 3)
        .lineStyle(1, 0xffffff, 1)
        .strokeCircle(px, py, 3);

      // Update arrow positions on every frame to account for scale changes
      const arrowY = this.scale.height - 100;
      this.arrowUp?.setPosition(100, arrowY - 50);
      this.arrowDown?.setPosition(100, arrowY + 50);
      this.arrowLeft?.setPosition(50, arrowY);
      this.arrowRight?.setPosition(150, arrowY);

      // Update map toggle text position
      this.mapToggleText?.setPosition(10, this.scale.height - 30);
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
      if (gameRef.current) {
        try { gameRef.current.destroy(true); } catch (e) { /* ignore */ }
      }
      gameRef.current = null;
    };
  }, [universe]);

  return (
    <div className="w-screen h-screen bg-black relative overflow-hidden">
      <div className="absolute top-4 left-4 z-10 text-white text-sm px-4 py-3 bg-black bg-opacity-80 rounded-lg border-2 border-cyan-500 shadow-lg shadow-cyan-500/50">
        <div className="font-bold text-cyan-400 mb-1">🌌 {universe.name}</div>
        <div className="text-xs text-gray-300">Difficulty: {universe.difficulty}</div>
        <div className="text-xs text-green-400 mt-1">
          🛠 Fixed: {universe.anomalies?.filter((a) => a.resolved)?.length || 0}/
          {universe.anomalies?.length || 0}
        </div>
      </div>

      <div className="absolute top-4 right-4 z-10 text-white text-xs px-3 py-2 bg-black bg-opacity-80 rounded border border-cyan-500">
        <div className="font-bold text-cyan-400 mb-1">Controls</div>
        <div>WASD/ZQSD: Move</div>
        <div>F: Fix Anomaly</div>
        <div>M: Toggle Map</div>
      </div>

      <div id="phaser-container" className="w-full h-full" />
    </div>
  );
};

export default PhaserGame;
