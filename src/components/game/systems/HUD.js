export class HUD {
  constructor(scene) {
    this.scene = scene;
    
    // Cache values to reduce calculations
    this.lastVelocity = 0;
    this.lastX = 0;
    this.lastY = 0;
    this.lastBoostEnergy = 100;
    this.updateThreshold = 0.1;
    this.boostUpdateThreshold = 0.5;
  }

  update(player) {
    // Calculate velocity
    const vel = Math.sqrt(
      player.body.velocity.x ** 2 + player.body.velocity.y ** 2
    );
    
    if (Math.abs(vel - this.lastVelocity) > this.updateThreshold) {
      this.lastVelocity = vel;
    }

    // Get position
    const x = Math.floor(player.x);
    const y = Math.floor(player.y);
    
    if (x !== this.lastX || y !== this.lastY) {
      this.lastX = x;
      this.lastY = y;
    }

    // Get boost energy
    const boostEnergy = player.boostEnergy || 100;
    if (Math.abs(boostEnergy - this.lastBoostEnergy) > this.boostUpdateThreshold) {
      this.lastBoostEnergy = boostEnergy;
    }
  }

  getData() {
    return {
      velocity: this.lastVelocity,
      position: { x: this.lastX, y: this.lastY },
      boostEnergy: this.lastBoostEnergy,
      isBoosting: this.scene.player?.isBoosting || false
    };
  }

  destroy() {
    // No Phaser objects to destroy anymore
  }
}