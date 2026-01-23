export class HUD {
  constructor(scene) {
    this.scene = scene;
    this.createHUD();
  }

  createHUD() {
    this.velocityText = this.scene.add.text(10, 80, "", {
      font: "bold 12px Courier",
      fill: "#00ff00",
      backgroundColor: "#000000",
      padding: { x: 6, y: 3 },
    }).setScrollFactor(0).setDepth(1001);

    this.coordText = this.scene.add.text(10, 100, "", {
      font: "bold 12px Courier",
      fill: "#00ffff",
      backgroundColor: "#000000",
      padding: { x: 6, y: 3 },
    }).setScrollFactor(0).setDepth(1001);

    this.mapToggleText = this.scene.add.text(10, 120, "PRESS M FOR FULL MAP", {
      font: "bold 11px Courier",
      fill: "#ffff00",
      backgroundColor: "#000000",
      padding: { x: 6, y: 3 },
    }).setScrollFactor(0).setDepth(1001).setAlpha(0.8);
  }

  update(player) {
    const vel = Math.sqrt(
      player.body.velocity.x ** 2 + player.body.velocity.y ** 2
    );
    this.velocityText?.setText(`VELOCITY: ${vel.toFixed(1)} u/s`);
    this.coordText?.setText(
      `COORDINATES: X:${player.x.toFixed(0)} Y:${player.y.toFixed(0)}`
    );
  }

  updatePositions(hudLeftMargin, hudTopMargin) {
    this.velocityText?.setPosition(hudLeftMargin, hudTopMargin);
    this.coordText?.setPosition(hudLeftMargin, hudTopMargin + 20);
    this.mapToggleText?.setPosition(hudLeftMargin, hudTopMargin + 40);
  }
}