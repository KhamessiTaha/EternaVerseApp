export class HUD {
  constructor(scene) {
    this.scene = scene;
    this.createHUD();
    
    // Optimized: Cache values to reduce string operations
    this.lastVelocity = 0;
    this.lastX = 0;
    this.lastY = 0;
    this.lastBoostEnergy = 100;
    this.updateThreshold = 0.1; // Only update if change is significant
    this.boostUpdateThreshold = 0.5; // Update boost less frequently
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

    // Boost energy display
    this.boostText = this.scene.add.text(10, 120, "", {
      ...textStyle,
      fill: "#4488ff",
    }).setScrollFactor(0).setDepth(1001);

    // Boost energy bar background
    this.boostBarBg = this.scene.add.graphics()
      .setScrollFactor(0)
      .setDepth(1001);
    
    // Boost energy bar fill
    this.boostBar = this.scene.add.graphics()
      .setScrollFactor(0)
      .setDepth(1002);

    this.mapToggleText = this.scene.add.text(10, 160, "PRESS M FOR MAP", {
      ...textStyle,
      fill: "#ffff00",
    }).setScrollFactor(0).setDepth(1001).setAlpha(0.7);

    // Flight tip
    this.flightTipText = this.scene.add.text(10, 180, "SHIFT = BOOST", {
      ...textStyle,
      fill: "#88aaff",
    }).setScrollFactor(0).setDepth(1001).setAlpha(0.6);
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

    // Update boost energy display
    const boostEnergy = player.boostEnergy || 100;
    if (Math.abs(boostEnergy - this.lastBoostEnergy) > this.boostUpdateThreshold) {
      this.updateBoostDisplay(boostEnergy, player.isBoosting);
      this.lastBoostEnergy = boostEnergy;
    }
  }

  updateBoostDisplay(energy, isBoosting) {
    // Update text
    const energyPercent = energy.toFixed(0);
    const status = isBoosting ? " [ACTIVE]" : "";
    this.boostText?.setText(`BOOST: ${energyPercent}%${status}`);

    // Update color based on energy level
    let color = 0x4488ff; // Blue
    if (energy < 30) {
      color = 0xff4444; // Red when low
    } else if (energy < 60) {
      color = 0xffaa44; // Orange when medium
    }

    if (isBoosting) {
      color = 0x44ffff; // Cyan when active
    }

    this.boostText?.setColor(`#${color.toString(16).padStart(6, '0')}`);

    // Draw boost bar
    const barWidth = 100;
    const barHeight = 8;
    const barX = this.boostText?.x || 10;
    const barY = (this.boostText?.y || 120) + 15;

    // Clear previous graphics
    this.boostBarBg?.clear();
    this.boostBar?.clear();

    // Draw background
    this.boostBarBg?.fillStyle(0x222222, 0.8);
    this.boostBarBg?.fillRect(barX, barY, barWidth, barHeight);
    this.boostBarBg?.lineStyle(1, 0x444444, 1);
    this.boostBarBg?.strokeRect(barX, barY, barWidth, barHeight);

    // Draw fill
    const fillWidth = (energy / 100) * barWidth;
    this.boostBar?.fillStyle(color, isBoosting ? 1 : 0.8);
    this.boostBar?.fillRect(barX, barY, fillWidth, barHeight);

    // Add glow effect when boosting
    if (isBoosting) {
      this.boostBar?.lineStyle(2, color, 0.5);
      this.boostBar?.strokeRect(barX - 1, barY - 1, fillWidth + 2, barHeight + 2);
    }
  }

  updatePositions(hudLeftMargin, hudTopMargin) {
    this.velocityText?.setPosition(hudLeftMargin, hudTopMargin);
    this.coordText?.setPosition(hudLeftMargin, hudTopMargin + 20);
    this.boostText?.setPosition(hudLeftMargin, hudTopMargin + 40);
    this.mapToggleText?.setPosition(hudLeftMargin, hudTopMargin + 80);
    this.flightTipText?.setPosition(hudLeftMargin, hudTopMargin + 100);

    // Update boost bar position
    if (this.boostText) {
      const barX = hudLeftMargin;
      const barY = hudTopMargin + 55;
      
      this.boostBarBg?.clear();
      this.boostBar?.clear();
      
      // Redraw at new position
      this.updateBoostDisplay(this.lastBoostEnergy, false);
    }
  }

  destroy() {
    this.velocityText?.destroy();
    this.coordText?.destroy();
    this.boostText?.destroy();
    this.boostBarBg?.destroy();
    this.boostBar?.destroy();
    this.mapToggleText?.destroy();
    this.flightTipText?.destroy();
  }
}