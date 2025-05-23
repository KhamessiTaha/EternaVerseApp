import { useEffect, useRef, useState } from "react";
import Phaser from "phaser";
import seedrandom from "seedrandom";
import axios from "axios";

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

    let galaxies = [];
    let anomalies = [];
    let minimap;
    let minimapBorder;
    let activeAnomalies = [];
    let fixKey;
    let interactionTexts = []; // Array to store all anomaly interaction texts

    const minimapSize = 140;
    const universeSize = 10000;

    function preload() {
      this.load.image("Player", "/assets/Player.png");
    }

    function create() {
      this.player = this.physics.add
        .sprite(0, 0, "Player")
        .setScale(0.05)
        .setDamping(true)
        .setDrag(0.98)
        .setMaxVelocity(300)
        .setCollideWorldBounds(false);

      this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
      this.cameras.main.setZoom(1.5);

      this.lights.enable().setAmbientColor(0x111111);
      this.player.setPipeline("Light2D");
      this.lights.addLight(this.player.x, this.player.y, 200).setIntensity(2.0);

      this.cursors = this.input.keyboard.addKeys({
        up: Phaser.Input.Keyboard.KeyCodes.W,
        down: Phaser.Input.Keyboard.KeyCodes.S,
        left: Phaser.Input.Keyboard.KeyCodes.A,
        right: Phaser.Input.Keyboard.KeyCodes.D,
        arrowUp: Phaser.Input.Keyboard.KeyCodes.UP,
        arrowDown: Phaser.Input.Keyboard.KeyCodes.DOWN,
        arrowLeft: Phaser.Input.Keyboard.KeyCodes.LEFT,
        arrowRight: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      });

      fixKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);

      // Create galaxies
      for (let i = 0; i < 200; i++) {
        const x = rng() * universeSize - universeSize / 2;
        const y = rng() * universeSize - universeSize / 2;
        const size = rng() * 30 + 10;
        const color =
          Phaser.Display.Color.HSVColorWheel()[Math.floor(rng() * 360)];

        const galaxy = this.add.graphics({ x, y });
        galaxy.fillStyle(
          Phaser.Display.Color.GetColor(color.r, color.g, color.b),
          1
        );
        galaxy.fillCircle(0, 0, size);
        galaxy.setDepth(-1);
        galaxies.push({ x, y });
      }

      // Create anomalies
      anomalies = universe.anomalies.map((a) => ({
        x: a.location?.x ?? rng() * universeSize - universeSize / 2,
        y: a.location?.y ?? rng() * universeSize - universeSize / 2,
        type: a.type,
        severity: a.severity ?? 5,
        resolved: false,
        glow: null,
        interactionText: null, // Store reference to the text object
      }));

      anomalies.forEach((a) => {
        // Create anomaly graphics with glow effect
        const anomaly = this.add.graphics({ x: a.x, y: a.y });
        anomaly.fillStyle(0xff0000, 0.6);
        anomaly.fillCircle(0, 0, 10 + a.severity);
        anomaly.lineStyle(2, 0xff5555, 1);
        anomaly.strokeCircle(0, 0, 10 + a.severity);

        // Add glow effect
        const glow = this.add.graphics({ x: a.x, y: a.y });
        glow.fillStyle(0xff0000, 0.3);
        glow.fillCircle(0, 0, 20 + a.severity * 2);
        glow.setBlendMode(Phaser.BlendModes.ADD);

        // Add pulsing animation
        this.tweens.add({
          targets: glow,
          scaleX: 1.2,
          scaleY: 1.2,
          alpha: 0.5,
          duration: 1000 + a.severity * 100,
          yoyo: true,
          repeat: -1,
        });

        // Create interaction text (initially hidden)
        const text = this.add
          .text(a.x, a.y - 40, `[${a.type}] PRESS F`, {
            font: 'bold 16px "Press Start 2P", Courier, monospace',
            fill: "#00ff00", // Classic green pixel color
            backgroundColor: "#000000",
            padding: { x: 8, y: 4 },
            align: "center",
            stroke: "#003300", // Dark green outline
            strokeThickness: 2,
            shadow: {
              offsetX: 2,
              offsetY: 2,
              color: "#003300",
              blur: 0,
              stroke: true,
            },
          })
          .setOrigin(0.5)
          .setVisible(false)
          .setDepth(1000);

        a.entity = anomaly;
        a.glow = glow;
        a.interactionText = text;
        a.inRange = false;
        activeAnomalies.push(a);

        // Add light to anomaly
        this.lights
          .addLight(a.x, a.y, 100 + a.severity * 10)
          .setIntensity(0.6 + a.severity * 0.05)
          .setColor(0xff3333);
      });

      // Create minimap
      minimap = this.add.graphics().setScrollFactor(0).setDepth(1000);
      minimapBorder = this.add.graphics().setScrollFactor(0).setDepth(999);
      this.minimapCamera = this.cameras
        .add(window.innerWidth - minimapSize - 20, 20, minimapSize, minimapSize)
        .setZoom(0.01)
        .setName("minimap");
      this.minimapCamera
        .setScroll(0, 0)
        .setBackgroundColor("rgba(0, 0, 0, 0.5)")
        .setVisible(true);
      minimapBorder.lineStyle(2, 0xffffff, 0.8);
      minimapBorder.strokeRect(
        window.innerWidth - minimapSize - 20,
        20,
        minimapSize,
        minimapSize
      );
    }

    function update() {
      const speed = 200;
      const keys = this.cursors;

      this.player.setAcceleration(
        keys.left.isDown || keys.arrowLeft.isDown
          ? -speed
          : keys.right.isDown || keys.arrowRight.isDown
          ? speed
          : 0,
        keys.up.isDown || keys.arrowUp.isDown
          ? -speed
          : keys.down.isDown || keys.arrowDown.isDown
          ? speed
          : 0
      );

      // Update player light
      this.lights.lights[0]?.setPosition(this.player.x, this.player.y);

      // Check for nearby anomalies
      let nearbyAnomaly = null;
      activeAnomalies.forEach((a) => {
        if (a.resolved) return;

        const dist = Phaser.Math.Distance.Between(
          a.x,
          a.y,
          this.player.x,
          this.player.y
        );
        a.inRange = dist < 60 + a.severity * 2;

        // Update interaction text visibility and position
        if (a.interactionText) {
          a.interactionText.setVisible(a.inRange);
          a.interactionText.setPosition(a.x, a.y - 40 - a.severity * 2);
        }

        if (a.inRange) {
          nearbyAnomaly = a;
        }
      });

      // Handle anomaly fixing
      if (nearbyAnomaly && Phaser.Input.Keyboard.JustDown(fixKey)) {
        // Remove anomaly visuals
        nearbyAnomaly.entity.destroy();
        nearbyAnomaly.glow.destroy();
        nearbyAnomaly.interactionText?.destroy();

        nearbyAnomaly.resolved = true;
        setResolvedCount((prev) => prev + 1);

        // 🔥 Update the database
        const token = localStorage.getItem("token");
        axios
          .put(
            `http://localhost:5000/api/universe/${universe._id}/resolve-anomaly/${nearbyAnomaly._id}`,
            {},
            { headers: { Authorization: token } }
          )
          .catch((err) =>
            console.error("Failed to update resolved anomaly:", err)
          );
      }
      // Update minimap
      const mapX = window.innerWidth - minimapSize - 20;
      const mapY = 20;
      const scale = minimapSize / universeSize;

      minimap.clear();
      minimap.fillStyle(0x000000, 0.7);
      minimap.fillRect(mapX, mapY, minimapSize, minimapSize);

      // Draw galaxies on minimap
      galaxies.forEach((g) => {
        const mx = mapX + (g.x + universeSize / 2) * scale;
        const my = mapY + (g.y + universeSize / 2) * scale;
        minimap.fillStyle(0xaaaaaa, 1);
        minimap.fillCircle(mx, my, 1);
      });

      // Draw anomalies on minimap
      anomalies.forEach((a) => {
        if (a.resolved) return;
        const ax = mapX + (a.x + universeSize / 2) * scale;
        const ay = mapY + (a.y + universeSize / 2) * scale;
        minimap.fillStyle(0xff4444, 1);
        minimap.fillCircle(ax, ay, 2 + a.severity * 0.2);
      });

      // Draw player on minimap
      const px = mapX + (this.player.x + universeSize / 2) * scale;
      const py = mapY + (this.player.y + universeSize / 2) * scale;
      minimap.fillStyle(0x00ffff, 1);
      minimap.fillCircle(px, py, 3);
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
        🌌 {universe.name} — {universe.difficulty} — 🛠 Fixed: {resolvedCount}/
        {universe.anomalies.length}
      </div>
      <div id="phaser-container" style={{ width: "100%", height: "100%" }} />
    </div>
  );
};

export default PhaserGame;
