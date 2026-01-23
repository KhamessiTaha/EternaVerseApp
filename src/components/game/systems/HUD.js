export class HUD {
  constructor(scene) {
    this.scene = scene;
    this.createHUD();
    
    // Optimized: Cache values to reduce string operations
    this.lastVelocity = 0;
    this.lastX = 0;
    this.lastY = 0;
    this.updateThreshold = 0.1; // Only update if change is significant
  }

  createHUD() {
    // Optimized: Use monospace font for better performance
    const textStyle = {
      font: "bold 11px monospace",
      backgroundColor: "#000000",
      padding: { x: 5, y: 2 },
    };

    this.velocityText = this.scene.add.text(10, 80, "", {
      ...textStyle,
      fill: "#00ff00",
    }).setScrollFactor(0).setDepth(1001);

    this.coordText = this.scene.add.text(10, 100, "", {
      ...textStyle,
      fill: "#00ffff",
    }).setScrollFactor(0).setDepth(1001);

    this.mapToggleText = this.scene.add.text(10, 120, "PRESS M FOR MAP", {
      ...textStyle,
      fill: "#ffff00",
    }).setScrollFactor(0).setDepth(1001).setAlpha(0.7);
  }

  update(player) {
    // Optimized: Only update text when values change significantly
    const vel = Math.sqrt(
      player.body.velocity.x ** 2 + player.body.velocity.y ** 2
    );
    
    if (Math.abs(vel - this.lastVelocity) > this.updateThreshold) {
      this.velocityText?.setText(`VEL: ${vel.toFixed(1)} u/s`);
      this.lastVelocity = vel;
    }

    const x = Math.floor(player.x);
    const y = Math.floor(player.y);
    
    if (x !== this.lastX || y !== this.lastY) {
      this.coordText?.setText(`POS: ${x}, ${y}`);
      this.lastX = x;
      this.lastY = y;
    }
  }

  updatePositions(hudLeftMargin, hudTopMargin) {
    this.velocityText?.setPosition(hudLeftMargin, hudTopMargin);
    this.coordText?.setPosition(hudLeftMargin, hudTopMargin + 20);
    this.mapToggleText?.setPosition(hudLeftMargin, hudTopMargin + 40);
  }

  destroy() {
    this.velocityText?.destroy();
    this.coordText?.destroy();
    this.mapToggleText?.destroy();
  }
}