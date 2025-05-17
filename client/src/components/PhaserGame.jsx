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
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
      },
      scene: {
        preload,
        create,
        update
      }
    };

    let galaxies = [];
    let minimap;
    const minimapSize = 140;
    const universeSize = 10000;

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

      // Create minimap container
      minimap = this.add.graphics();
      minimap.setScrollFactor(0);  // This makes the minimap stay fixed on screen
      minimap.setDepth(1000);      // This ensures the minimap is drawn on top
      
      // Create a camera that doesn't move
      this.minimapCamera = this.cameras.add(
        window.innerWidth - minimapSize - 20, 
        20, 
        minimapSize, 
        minimapSize
      ).setZoom(0.01).setName('minimap');
      
      // Make the minimap camera fixed (not following the player)
      this.minimapCamera.setScroll(0, 0);
      this.minimapCamera.setBackgroundColor('rgba(0, 0, 0, 0.5)');
      this.minimapCamera.setVisible(true);
      
      // Create a border for the minimap
      this.minimapBorder = this.add.graphics().setScrollFactor(0).setDepth(999);
      this.minimapBorder.lineStyle(2, 0xffffff, 0.8);
      this.minimapBorder.strokeRect(
        window.innerWidth - minimapSize - 20, 
        20, 
        minimapSize, 
        minimapSize
      );
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

      // Draw minimap
      const mapX = window.innerWidth - minimapSize - 20;
      const mapY = 20;
      
      // Clear previous minimap drawing
      minimap.clear();
      
      // Draw minimap background
      minimap.fillStyle(0x000000, 0.7);
      minimap.fillRect(mapX, mapY, minimapSize, minimapSize);
      
      // Draw galaxies on minimap
      galaxies.forEach((g) => {
        const scaleFactor = minimapSize / universeSize;
        const mx = mapX + (g.x + universeSize / 2) * scaleFactor;
        const my = mapY + (g.y + universeSize / 2) * scaleFactor;
        
        if (mx >= mapX && mx <= mapX + minimapSize && 
            my >= mapY && my <= mapY + minimapSize) {
          minimap.fillStyle(0xaaaaaa, 1);
          minimap.fillCircle(mx, my, 1);
        }
      });
      
      // Draw player on minimap
      const playerScaleFactor = minimapSize / universeSize;
      const playerMX = mapX + (this.player.x + universeSize / 2) * playerScaleFactor;
      const playerMY = mapY + (this.player.y + universeSize / 2) * playerScaleFactor;
      
      minimap.fillStyle(0x00ffff, 1);
      minimap.fillCircle(playerMX, playerMY, 3);
      
      // Update minimap border position when window resizes
      this.minimapBorder.clear();
      this.minimapBorder.lineStyle(2, 0xffffff, 0.8);
      this.minimapBorder.strokeRect(
        window.innerWidth - minimapSize - 20, 
        20, 
        minimapSize, 
        minimapSize
      );
      
      // Update minimap camera position
      this.minimapCamera.setPosition(window.innerWidth - minimapSize - 20, 20);
    }

    if (!gameRef.current) {
      gameRef.current = new Phaser.Game(config);
    }

    // Handle window resize
    const resizeHandler = () => {
      if (gameRef.current) {
        gameRef.current.scale.resize(window.innerWidth, window.innerHeight);
      }
    };
    
    window.addEventListener('resize', resizeHandler);

    return () => {
      window.removeEventListener('resize', resizeHandler);
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
      <div id="phaser-container" style={{ width: "100%", height: "100%" }} />
    </div>
  );
};

export default PhaserGame;