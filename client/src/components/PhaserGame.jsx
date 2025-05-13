import { useEffect, useRef } from "react";
import Phaser from "phaser";
import seedrandom from "seedrandom";

const PhaserGame = ({ universe }) => {
  const gameRef = useRef(null);

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
          debug: false
        }
      },
      scene: {
        preload,
        create,
        update
      }
    };

    function preload() {
      this.load.image("Player", "/assets/Player.png");
    }

    function create() {
      // Create Player
      this.player = this.physics.add.sprite(0, 0, "Player")
        .setScale(1.5)
        .setDamping(true)
        .setDrag(0.98)
        .setMaxVelocity(300)
        .setCollideWorldBounds(false);

      // Camera setup
      this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
      this.cameras.main.setZoom(1.5);
      this.cameras.main.setBackgroundColor("#000000");

      // Lighting
      this.lights.enable().setAmbientColor(0x111111);
      this.player.setPipeline("Light2D");
      this.lights.addLight(this.player.x, this.player.y, 200).setIntensity(2.0);

      // Controls
      this.cursors = this.input.keyboard.addKeys({
        up: Phaser.Input.Keyboard.KeyCodes.W,
        down: Phaser.Input.Keyboard.KeyCodes.S,
        left: Phaser.Input.Keyboard.KeyCodes.A,
        right: Phaser.Input.Keyboard.KeyCodes.D,
        arrowUp: Phaser.Input.Keyboard.KeyCodes.UP,
        arrowDown: Phaser.Input.Keyboard.KeyCodes.DOWN,
        arrowLeft: Phaser.Input.Keyboard.KeyCodes.LEFT,
        arrowRight: Phaser.Input.Keyboard.KeyCodes.RIGHT
      });

      // Procedural Galaxies
      const galaxyCount = 200;
      for (let i = 0; i < galaxyCount; i++) {
        const x = rng() * 10000 - 5000;
        const y = rng() * 10000 - 5000;
        const size = rng() * 30 + 10;
        const color = Phaser.Display.Color.HSVColorWheel()[Math.floor(rng() * 360)];

        const galaxy = this.add.graphics({ x, y });
        galaxy.fillStyle(Phaser.Display.Color.GetColor(color.r, color.g, color.b), 1);
        galaxy.fillCircle(0, 0, size);
        galaxy.setDepth(-1); // behind the player
      }
    }

    function update() {
      const speed = 200;
      const keys = this.cursors;

      if (keys.left.isDown || keys.arrowLeft.isDown) this.player.setAccelerationX(-speed);
      else if (keys.right.isDown || keys.arrowRight.isDown) this.player.setAccelerationX(speed);
      else this.player.setAccelerationX(0);

      if (keys.up.isDown || keys.arrowUp.isDown) this.player.setAccelerationY(-speed);
      else if (keys.down.isDown || keys.arrowDown.isDown) this.player.setAccelerationY(speed);
      else this.player.setAccelerationY(0);

      // Move light with player
      if (this.lights) {
        this.lights.lights[0]?.setPosition(this.player.x, this.player.y);
      }
    }

    if (!gameRef.current) {
      gameRef.current = new Phaser.Game(config);
    }

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, [universe]);

  return (
    <div className="w-screen h-screen bg-black">
      <div className="absolute top-2 left-2 z-10 text-white text-sm px-4 py-2 bg-black bg-opacity-60 rounded">
        🌌 {universe.name} — {universe.difficulty}
      </div>
      <div id="phaser-container" />
    </div>
  );
};

export default PhaserGame;
