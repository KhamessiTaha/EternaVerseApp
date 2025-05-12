import { useEffect, useRef } from "react";
import Phaser from "phaser";

const PhaserGame = ({ universe }) => {
  const gameRef = useRef(null);

  useEffect(() => {
    const config = {
      type: Phaser.AUTO,
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: "#000000",
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
      this.load.image("player", "https://labs.phaser.io/assets/sprites/white-ball.png");
    }

    function create() {
      this.player = this.physics.add.image(400, 300, "player");
      this.player.setCollideWorldBounds(true);

      this.cursors = this.input.keyboard.createCursorKeys();
    }

    function update() {
      const speed = 200;
      this.player.setVelocity(0);

      if (this.cursors.left.isDown) this.player.setVelocityX(-speed);
      else if (this.cursors.right.isDown) this.player.setVelocityX(speed);

      if (this.cursors.up.isDown) this.player.setVelocityY(-speed);
      else if (this.cursors.down.isDown) this.player.setVelocityY(speed);
    }

    if (!gameRef.current) {
      gameRef.current = new Phaser.Game(config);
    }

    return () => {
      gameRef.current.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return (
    <div>
      <h1 className="text-white text-3xl font-bold mb-4">Gameplay for Universe: {universe.name}</h1>
      <div id="phaser-game" />
    </div>
  );
};

export default PhaserGame;
