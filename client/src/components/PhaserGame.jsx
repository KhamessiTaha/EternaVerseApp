import { useEffect, useRef, useState } from "react";
import Phaser from "phaser";
import seedrandom from "seedrandom";

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
    let interactionText;

    const minimapSize = 140;
    const universeSize = 10000;

    function preload() {
      this.load.image("Player", "/assets/Player.png");
    }

    function create() {
      // Player
      this.player = this.physics.add.sprite(0, 0, "Player")
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

      // Galaxies
      for (let i = 0; i < 200; i++) {
        const x = rng() * universeSize - universeSize / 2;
        const y = rng() * universeSize - universeSize / 2;
        const size = rng() * 30 + 10;
        const color = Phaser.Display.Color.HSVColorWheel()[Math.floor(rng() * 360)];

        const galaxy = this.add.graphics({ x, y });
        galaxy.fillStyle(Phaser.Display.Color.GetColor(color.r, color.g, color.b), 1);
        galaxy.fillCircle(0, 0, size);
        galaxy.setDepth(-1);
        galaxies.push({ x, y });
      }

      // Anomalies
      anomalies = universe.anomalies.map((a) => ({
        x: a.location?.x ?? rng() * universeSize - universeSize / 2,
        y: a.location?.y ?? rng() * universeSize - universeSize / 2,
        type: a.type,
        severity: a.severity ?? 5,
        resolved: false,
      }));

      anomalies.forEach((a, i) => {
        const anomaly = this.add.circle(a.x, a.y, 10 + a.severity, 0xff0000, 0.6);
        anomaly.setStrokeStyle(2, 0xff5555);
        anomaly.setDepth(0);
        anomaly.setPipeline("Light2D");
        this.lights.addLight(a.x, a.y, 100).setIntensity(0.6 + a.severity * 0.05);

        this.physics.add.existing(anomaly);
        this.physics.add.overlap(this.player, anomaly, () => {
          anomaly.inRange = true;
        });

        a.entity = anomaly;
        a.inRange = false;
        activeAnomalies.push(a);
      });

      // Minimap
      minimap = this.add.graphics().setScrollFactor(0).setDepth(1000);
      minimapBorder = this.add.graphics().setScrollFactor(0).setDepth(999);
      this.minimapCamera = this.cameras.add(
        window.innerWidth - minimapSize - 20,
        20,
        minimapSize,
        minimapSize
      ).setZoom(0.01).setName("minimap");
      this.minimapCamera.setScroll(0, 0).setBackgroundColor("rgba(0, 0, 0, 0.5)").setVisible(true);
      minimapBorder.lineStyle(2, 0xffffff, 0.8);
      minimapBorder.strokeRect(window.innerWidth - minimapSize - 20, 20, minimapSize, minimapSize);

      // Interaction text
      interactionText = this.add.text(20, window.innerHeight - 40, "", {
        font: "16px monospace",
        fill: "#ffffff",
        backgroundColor: "#000000aa",
        padding: { x: 8, y: 4 },
      }).setScrollFactor(0).setDepth(1000);
    }

    function update() {
      const speed = 200;
      const keys = this.cursors;

      this.player.setAcceleration(
        (keys.left.isDown || keys.arrowLeft.isDown ? -speed : keys.right.isDown || keys.arrowRight.isDown ? speed : 0),
        (keys.up.isDown || keys.arrowUp.isDown ? -speed : keys.down.isDown || keys.arrowDown.isDown ? speed : 0)
      );

      this.lights.lights[0]?.setPosition(this.player.x, this.player.y);

      // Detect interaction range
      let nearbyAnomaly = null;
      activeAnomalies.forEach((a) => {
        const dist = Phaser.Math.Distance.Between(a.x, a.y, this.player.x, this.player.y);
        if (dist < 60 && !a.resolved) {
          nearbyAnomaly = a;
        }
      });

      if (nearbyAnomaly) {
        interactionText.setText(`🛠 Anomaly: ${nearbyAnomaly.type} (F to fix)`);
        if (Phaser.Input.Keyboard.JustDown(fixKey)) {
          nearbyAnomaly.entity.destroy();
          nearbyAnomaly.resolved = true;
          setResolvedCount((prev) => prev + 1);
        }
      } else {
        interactionText.setText("");
      }

      // Minimap logic
      const mapX = window.innerWidth - minimapSize - 20;
      const mapY = 20;
      const scale = minimapSize / universeSize;

      minimap.clear();
      minimap.fillStyle(0x000000, 0.7);
      minimap.fillRect(mapX, mapY, minimapSize, minimapSize);

      galaxies.forEach((g) => {
        const mx = mapX + (g.x + universeSize / 2) * scale;
        const my = mapY + (g.y + universeSize / 2) * scale;
        minimap.fillStyle(0xaaaaaa, 1);
        minimap.fillCircle(mx, my, 1);
      });

      anomalies.forEach((a) => {
        if (a.resolved) return;
        const ax = mapX + (a.x + universeSize / 2) * scale;
        const ay = mapY + (a.y + universeSize / 2) * scale;
        minimap.fillStyle(0xff4444, 1);
        minimap.fillCircle(ax, ay, 2);
      });

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
        🌌 {universe.name} — {universe.difficulty} — 🛠 Fixed: {resolvedCount}
      </div>
      <div id="phaser-container" style={{ width: "100%", height: "100%" }} />
    </div>
  );
};

export default PhaserGame;
