import Phaser from 'phaser';

export class InputSystem {
  constructor(scene) {
    this.scene = scene;
    this.arrowStates = { up: false, down: false, left: false, right: false };
    this.setupControls();
  }

  setupControls() {
    this.cursors = this.scene.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      z: Phaser.Input.Keyboard.KeyCodes.Z,
      q: Phaser.Input.Keyboard.KeyCodes.Q,
      s2: Phaser.Input.Keyboard.KeyCodes.S,
      d2: Phaser.Input.Keyboard.KeyCodes.D,
    });
    this.fixKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
    this.mapKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);
  }

  handlePlayerMovement(player) {
    const speed = 250;
    const isMovingLeft = this.cursors.left.isDown || this.cursors.q?.isDown;
    const isMovingRight = this.cursors.right.isDown || this.cursors.d2?.isDown;
    const isMovingUp = this.cursors.up.isDown || this.cursors.z?.isDown;
    const isMovingDown = this.cursors.down.isDown || this.cursors.s2?.isDown;

    player.setAcceleration(
      isMovingLeft ? -speed : isMovingRight ? speed : 0,
      isMovingUp ? -speed : isMovingDown ? speed : 0
    );
  }

  createTouchControls() {
    const createArrow = (x, y, rotation, direction) => {
      const tri = new Phaser.Geom.Triangle(-15, 10, 15, 10, 0, -10);
      const g = this.scene.add.graphics()
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

    const h = this.scene.scale.height;
    this.arrowUp = createArrow(100, h - 120, 0, "up");
    this.arrowDown = createArrow(100, h - 40, Math.PI, "down");
    this.arrowLeft = createArrow(50, h - 80, -Math.PI / 2, "left");
    this.arrowRight = createArrow(150, h - 80, Math.PI / 2, "right");
  }
}