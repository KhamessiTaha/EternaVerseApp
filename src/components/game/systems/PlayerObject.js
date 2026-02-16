import Phaser from 'phaser';

export class PlayerObject extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, texture) {
    super(scene, x, y, texture);
    
    // Add to scene and physics
    scene.add.existing(this);
    scene.physics.add.existing(this);
    
    // Physics setup
    this.body.setDamping(true);
    this.body.setDrag(0.97);
    this.body.setMaxVelocity(600);
    this.body.setAngularDrag(0.96);
    this.body.setMass(1.2);
    this.body.useDamping = true;
    this.body.allowRotation = false;
    
    // Visual state
    this.setScale(0.05);
    this.setTint(0xffffff);
    this.setDepth(5);
    
    // Animation state
    this.state = {
      boosting: false,
      velocity: { x: 0, y: 0 },
      direction: 0,
      health: 100,
      boostGlow: 0,
    };
    
    // === CONFIGURABLE FLAME PARAMETERS ===
    this.flameConfig = {
      // Base angle offset (0 = straight back relative to ship direction)
      angleOffset: 0,
      
      // Spread angle in radians (how wide the flame cone is)
      spreadAngle: Math.PI / 12, // ~15 degrees spread
      
      // Thruster positions relative to ship center (local coordinates)
      // Positive Y = toward back of ship, Negative Y = toward front
      thrusterOffsets: {
        left: { x: -3, y: 10 },   // Left thruster position
        right: { x: 3, y: 10 }     // Right thruster position
      },
      
      // Flame length multipliers
      minLength: 8,
      maxLength: 28,
      
      // Flame width multipliers
      minWidth: 2,
      maxWidth: 5,
      
      // Animation speeds
      turbulenceSpeed: 0.015,
      wobbleSpeed: 0.008,
      
      // Trail settings
      trailInterval: 30,        // ms between trail spawns
      trailSpread: 6,           // horizontal spread of trail particles
    };
    
    // Engine effects containers
    this.engineContainer = scene.add.container(x, y);
    this.engineContainer.setDepth(3);
    
    this.boosterLeft = null;
    this.boosterRight = null;
    this.boosterGlowLeft = null;
    this.boosterGlowRight = null;
    this.engineTrailContainer = scene.add.container(x, y);
    this.engineTrailContainer.setDepth(2);
    
    this.boostLight = null;
    this.wingsGlow = null;
    
    this.lastTrailTime = 0;
    
    this.createEngineEffects();
  }
  
  /**
   * Create engine visual effects (boosters, trails, lights)
   */
  createEngineEffects() {
    // Create dual booster graphics
    this.boosterLeft = this.scene.add.graphics();
    this.boosterLeft.setDepth(4);
    
    this.boosterRight = this.scene.add.graphics();
    this.boosterRight.setDepth(4);
    
    // Booster glows
    this.boosterGlowLeft = this.scene.add.graphics();
    this.boosterGlowLeft.setDepth(3);
    
    this.boosterGlowRight = this.scene.add.graphics();
    this.boosterGlowRight.setDepth(3);
    
    // Wing glow effect
    this.wingsGlow = this.scene.add.graphics();
    this.wingsGlow.setDepth(4);
    
    // Boost light
    this.boostLight = this.scene.lights.addLight(this.x, this.y, 180)
      .setIntensity(0)
      .setColor(0x4488ff);
  }
  
  /**
   * Update player visuals based on current state
   * Called each frame
   */
  updateVisuals(inputData = {}) {
    const velocity = this.body.velocity;
    const vel = Math.sqrt(velocity.x ** 2 + velocity.y ** 2);
    
    // Update state
    this.state.velocity = { x: velocity.x, y: velocity.y };
    this.state.boosting = inputData.boosting || false;
    
    // Update engine visuals
    this.updateEngineEffects(vel, inputData);
    
    // Update color based on boost state
    this.updateShipColor(inputData);
    
    // Update wing glows
    this.updateWingGlows(vel, inputData);
    
    // Create trail effect
    this.updateTrail(vel, inputData);
  }
  
  /**
   * Update dual booster engine effects
   */
  updateEngineEffects(velocity, inputData) {
    const boostMultiplier = inputData.boosting ? 1.8 : 1;
    const enginePower = Math.min(velocity / 600, 1) * boostMultiplier;
    
    // Booster flame color
    const flameColor = inputData.boosting ? 0x4488ff : 0xff8800;
    const flameAlpha = 0.5 + enginePower * 0.5;
    
    // Clear previous boosters
    this.boosterLeft.clear();
    this.boosterRight.clear();
    this.boosterGlowLeft.clear();
    this.boosterGlowRight.clear();
    
    if (velocity > 30) {
      // Flame parameters with config
      const flameLength = this.flameConfig.minLength + 
                         enginePower * (this.flameConfig.maxLength - this.flameConfig.minLength);
      const flameWidth = this.flameConfig.minWidth + 
                        enginePower * (this.flameConfig.maxWidth - this.flameConfig.minWidth);
      const flameVariation = Math.sin(this.scene.time.now * 0.01) * 0.5 + 0.5;
      
      // Left booster
      this.drawBooster(
        this.boosterLeft,
        this.boosterGlowLeft,
        this.flameConfig.thrusterOffsets.left,
        flameColor,
        flameAlpha,
        flameLength,
        flameWidth,
        flameVariation,
        inputData.boosting
      );
      
      // Right booster
      this.drawBooster(
        this.boosterRight,
        this.boosterGlowRight,
        this.flameConfig.thrusterOffsets.right,
        flameColor,
        flameAlpha,
        flameLength,
        flameWidth,
        flameVariation,
        inputData.boosting
      );
    }
    
    // Boost light intensity
    if (this.boostLight) {
      if (inputData.boosting) {
        this.boostLight.setIntensity(Math.min(0.8 + enginePower * 0.7, 2));
      } else {
        this.boostLight.setIntensity(Math.max(0, this.boostLight.intensity - 0.08));
      }
    }
  }
  
  /**
   * Draw individual booster engine with enhanced flames
   * FIXED: Proper rotation handling and flame direction
   */
  drawBooster(flameGraphics, glowGraphics, offset, color, alpha, length, width, variation, isBoosting) {
    const shipRotation = this.rotation;
    
    // Calculate world position of thruster (rotate offset by ship rotation)
    const cos = Math.cos(shipRotation);
    const sin = Math.sin(shipRotation);
    const rotatedOffset = {
      x: offset.x * cos - offset.y * sin,
      y: offset.x * sin + offset.y * cos
    };
    
    const boosterX = this.x + rotatedOffset.x;
    const boosterY = this.y + rotatedOffset.y;
    
    // Flame points backward from ship's current direction
    // Ship default orientation is PI/2 (facing up), so we subtract PI/2 to align
    // Then add PI to point backward
    const flameAngle = shipRotation + Math.PI - Math.PI / 2 + this.flameConfig.angleOffset;
    
    // Flame direction vector
    const flameDir = {
      x: Math.cos(flameAngle),
      y: Math.sin(flameAngle)
    };
    
    // Perpendicular direction for flame width
    const perpDir = {
      x: -Math.sin(flameAngle),
      y: Math.cos(flameAngle)
    };
    
    // Add dynamic turbulence for realistic flame movement
    const time = this.scene.time.now;
    const turbulence = Math.sin(time * this.flameConfig.turbulenceSpeed + offset.x * 10) * 0.3 + 0.5;
    const wobble = Math.cos(time * this.flameConfig.wobbleSpeed) * 0.2;
    
    // === THREE-LAYER FLAME RENDERING ===
    
    // Layer 1: Inner core (white hot center)
    this.drawFlameLayer(
      flameGraphics,
      boosterX, boosterY,
      flameDir, perpDir,
      width * 0.4,
      length * 0.6,
      0xffffff,
      alpha * 0.8,
      0.3
    );
    
    // Layer 2: Main flame (colored)
    this.drawFlameLayer(
      flameGraphics,
      boosterX, boosterY,
      flameDir, perpDir,
      width * (1 + variation * 0.3) + wobble,
      length,
      color,
      alpha,
      0.5
    );
    
    // Layer 3: Outer flame (darker, wispy)
    this.drawWispyFlame(
      flameGraphics,
      boosterX, boosterY,
      flameDir, perpDir,
      width * (1.3 + variation * 0.4),
      length,
      color,
      alpha * 0.4,
      turbulence
    );
    
    // === GLOW EFFECTS ===
    this.drawFlameGlow(
      glowGraphics,
      boosterX, boosterY,
      flameDir,
      width,
      length,
      isBoosting ? 0x00aaff : 0xffaa00,
      variation + turbulence * 0.3,
      isBoosting
    );
  }
  
  /**
   * Draw a single flame layer (core or main)
   */
  drawFlameLayer(graphics, x, y, flameDir, perpDir, width, length, color, alpha, tipWidth) {
    graphics.fillStyle(color, alpha);
    graphics.beginPath();
    
    // Base of flame (wide, at thruster position)
    graphics.moveTo(
      x + perpDir.x * (width / 2),
      y + perpDir.y * (width / 2)
    );
    graphics.lineTo(
      x - perpDir.x * (width / 2),
      y - perpDir.y * (width / 2)
    );
    
    // Tip of flame (narrow, extending backward)
    graphics.lineTo(
      x + flameDir.x * length - perpDir.x * tipWidth,
      y + flameDir.y * length - perpDir.y * tipWidth
    );
    graphics.lineTo(
      x + flameDir.x * length + perpDir.x * tipWidth,
      y + flameDir.y * length + perpDir.y * tipWidth
    );
    
    graphics.closePath();
    graphics.fillPath();
  }
  
  /**
   * Draw wispy outer flame with turbulent edges
   */
  drawWispyFlame(graphics, x, y, flameDir, perpDir, width, length, color, alpha, turbulence) {
    const turbLeft = turbulence * 0.5;
    const turbRight = -turbulence * 0.5;
    
    graphics.fillStyle(color, alpha);
    graphics.beginPath();
    
    // Base
    graphics.moveTo(x + perpDir.x * (width / 2), y + perpDir.y * (width / 2));
    graphics.lineTo(x - perpDir.x * (width / 2), y - perpDir.y * (width / 2));
    
    // Wispy right edge
    graphics.lineTo(
      x + flameDir.x * (length * 0.5) + perpDir.x * (width / 2 + turbRight),
      y + flameDir.y * (length * 0.5) + perpDir.y * (width / 2 + turbRight)
    );
    graphics.lineTo(
      x + flameDir.x * (length * 1.1) + perpDir.x * (0.8 + turbRight),
      y + flameDir.y * (length * 1.1) + perpDir.y * (0.8 + turbRight)
    );
    
    // Wispy left edge
    graphics.lineTo(
      x + flameDir.x * (length * 1.1) - perpDir.x * (0.8 + turbLeft),
      y + flameDir.y * (length * 1.1) - perpDir.y * (0.8 + turbLeft)
    );
    graphics.lineTo(
      x + flameDir.x * (length * 0.5) - perpDir.x * (width / 2 + turbLeft),
      y + flameDir.y * (length * 0.5) - perpDir.y * (width / 2 + turbLeft)
    );
    
    graphics.closePath();
    graphics.fillPath();
  }
  
  /**
   * Draw multi-layer flame glow
   */
  drawFlameGlow(graphics, x, y, flameDir, width, length, color, variation, isBoosting) {
    // Center glow at midpoint of flame
    const glowCenter = {
      x: x + flameDir.x * (length * 0.5),
      y: y + flameDir.y * (length * 0.5)
    };
    
    // Inner glow (tight)
    graphics.fillStyle(color, 0.4 * variation);
    graphics.fillCircle(glowCenter.x, glowCenter.y, width * 1.8 + variation);
    
    // Mid glow (medium)
    graphics.fillStyle(color, 0.25 * variation);
    graphics.fillCircle(
      glowCenter.x + flameDir.x * length * 0.2,
      glowCenter.y + flameDir.y * length * 0.2,
      width * 2.8 + variation * 1.5
    );
    
    // Outer glow (soft)
    graphics.fillStyle(color, 0.12 * variation);
    graphics.fillCircle(
      glowCenter.x + flameDir.x * length * 0.4,
      glowCenter.y + flameDir.y * length * 0.4,
      width * 4 + variation * 2
    );
    
    // Boost sparkles
    if (isBoosting) {
      const perpAngle = Math.atan2(flameDir.y, flameDir.x) + Math.PI / 2;
      const perpDir = { x: Math.cos(perpAngle), y: Math.sin(perpAngle) };
      
      graphics.fillStyle(0xffffff, 0.6 * variation);
      graphics.fillCircle(
        x + perpDir.x * (width * 0.5) + flameDir.x * (length * 0.3),
        y + perpDir.y * (width * 0.5) + flameDir.y * (length * 0.3),
        width * 0.4
      );
      graphics.fillCircle(
        x - perpDir.x * (width * 0.5) + flameDir.x * (length * 0.4),
        y - perpDir.y * (width * 0.5) + flameDir.y * (length * 0.4),
        width * 0.3
      );
    }
  }
  
  /**
   * Create engine trail particles
   */
  updateTrail(velocity, inputData) {
    if (velocity < 40) return;
    
    const now = this.scene.time.now;
    if (now - this.lastTrailTime < this.flameConfig.trailInterval) return;
    
    this.lastTrailTime = now;
    
    // Particle intensity
    const boostMultiplier = inputData.boosting ? 1.5 : 1;
    const velocityFactor = Math.min(velocity / 600, 1);
    const particleCount = Math.floor(2 + velocityFactor * 4) * boostMultiplier;
    
    // Colors
    const isBoosting = inputData.boosting;
    const coreColor = isBoosting ? 0x88ddff : 0xffaa44;
    const midColor = isBoosting ? 0x4488ff : 0xff8800;
    const outerColor = isBoosting ? 0x0044aa : 0xaa4400;
    
    // Trail spawns from back of ship
    // Ship default orientation is PI/2 (facing up)
    const shipRotation = this.rotation;
    const trailAngle = shipRotation + Math.PI - Math.PI / 2 + this.flameConfig.angleOffset;
    
    const trailDir = {
      x: Math.cos(trailAngle),
      y: Math.sin(trailAngle)
    };
    
    // Perpendicular for spread
    const perpAngle = trailAngle + Math.PI / 2;
    const perpDir = {
      x: Math.cos(perpAngle),
      y: Math.sin(perpAngle)
    };
    
    // Spawn particles from thruster positions
    const thrusters = [
      this.flameConfig.thrusterOffsets.left,
      this.flameConfig.thrusterOffsets.right
    ];
    
    thrusters.forEach(offset => {
      // Rotate offset to world space
      const cos = Math.cos(shipRotation);
      const sin = Math.sin(shipRotation);
      const rotatedOffset = {
        x: offset.x * cos - offset.y * sin,
        y: offset.x * sin + offset.y * cos
      };
      
      const thrusterX = this.x + rotatedOffset.x;
      const thrusterY = this.y + rotatedOffset.y;
      
      for (let i = 0; i < particleCount / 2; i++) {
        const sideOffset = (Math.random() - 0.5) * this.flameConfig.trailSpread;
        const depthOffset = (Math.random() - 0.5) * 2;
        
        // Spawn position (behind thruster)
        const spawnX = thrusterX + trailDir.x * 8 + perpDir.x * sideOffset;
        const spawnY = thrusterY + trailDir.y * 8 + perpDir.y * sideOffset;
        
        // Layer particles
        this.createParticle(spawnX, spawnY, coreColor, 0.8, 1.5, 200, 'Sine');
        this.createParticle(
          spawnX + trailDir.x * depthOffset,
          spawnY + trailDir.y * depthOffset,
          midColor, 0.5, 2.5, 280, 'Quad'
        );
        
        if (Math.random() > 0.4) {
          this.createParticle(
            spawnX + trailDir.x * 2,
            spawnY + trailDir.y * 2,
            outerColor, 0.25, 3.5, 320, 'Cubic'
          );
        }
        
        // Sparkles when boosting
        if (isBoosting && Math.random() > 0.6) {
          this.createParticle(
            spawnX + perpDir.x * sideOffset * 0.5,
            spawnY + perpDir.y * sideOffset * 0.5,
            0xffffff, 0.6, 1.2, 150, 'Sine'
          );
        }
      }
    });
  }
  
  /**
   * Create an individual particle with animation
   */
  createParticle(x, y, color, startAlpha, startScale, duration, easeType) {
    const particle = this.scene.add.graphics();
    particle.setPosition(x, y);
    particle.setDepth(2);
    
    // Draw particle
    particle.fillStyle(color, startAlpha);
    particle.fillCircle(0, 0, 2);
    
    // Animate
    this.scene.tweens.add({
      targets: particle,
      alpha: 0,
      scale: { from: startScale, to: startScale * 0.1 },
      duration: duration,
      ease: `${easeType}.easeOut`,
      onComplete: () => particle.destroy(),
    });
  }
  
  /**
   * Update ship color based on state
   */
  updateShipColor(inputData) {
    if (inputData.boosting) {
      this.setTint(0x44ffff);
      this.setAlpha(0.95);
    } else if (this.state.health < 30) {
      this.setTint(0xff4444);
      this.setAlpha(0.85);
    } else if (this.state.health < 60) {
      this.setTint(0xffaa44);
      this.setAlpha(0.9);
    } else {
      this.setTint(0xffffff);
      this.setAlpha(1);
    }
  }
  
  /**
   * Update wing glow effects
   */
  updateWingGlows(velocity, inputData) {
    this.wingsGlow.clear();
    
    if (velocity > 100) {
      const glowIntensity = Math.min(velocity / 600, 1);
      const glowColor = inputData.boosting ? 0x00ffff : 0x0088ff;
      const glowAlpha = glowIntensity * 0.4;
      
      const shipRotation = this.rotation;
      const cos = Math.cos(shipRotation);
      const sin = Math.sin(shipRotation);
      
      // Wing positions in local coordinates
      const wings = [
        { x: -5, y: -3 },  // Left wing
        { x: 5, y: -3 },   // Right wing
        { x: 0, y: -2 }    // Center spine
      ];
      
      wings.forEach((wing, index) => {
        // Rotate to world space
        const rotated = {
          x: wing.x * cos - wing.y * sin,
          y: wing.x * sin + wing.y * cos
        };
        
        const alpha = index === 2 ? glowAlpha * 0.6 : glowAlpha;
        const width = index === 2 ? 2 : 4;
        const height = index === 2 ? 6 : 5;
        
        this.wingsGlow.fillStyle(glowColor, alpha);
        this.wingsGlow.fillEllipse(this.x + rotated.x, this.y + rotated.y, width, height);
      });
    }
  }
  
  /**
   * Play boost activation animation
   */
  playBoostAnimation() {
    this.scene.tweens.add({
      targets: this,
      scaleX: { from: 0.05, to: 0.055 },
      scaleY: { from: 0.05, to: 0.055 },
      duration: 100,
      yoyo: true,
      ease: 'Sine.easeOut',
    });
  }
  
  /**
   * Play damage feedback animation
   */
  playDamageAnimation() {
    this.scene.tweens.add({
      targets: this,
      scaleX: { from: 0.05, to: 0.045 },
      duration: 80,
      yoyo: true,
      repeat: 2,
      ease: 'Cubic.easeOut',
    });
    
    this.scene.cameras.main.shake(150, 0.005);
  }
  
  /**
   * Update all graphics positions
   */
  updateGraphics() {
    if (this.boostLight) {
      this.boostLight.setPosition(this.x, this.y);
    }
  }
  
  /**
   * Get current ship state
   */
  getState() {
    return {
      ...this.state,
      x: this.x,
      y: this.y,
      angle: this.angle,
    };
  }
  
  /**
   * Damage the ship
   */
  takeDamage(amount) {
    this.state.health = Math.max(0, this.state.health - amount);
    this.playDamageAnimation();
    return this.state.health;
  }
  
  /**
   * Heal the ship
   */
  heal(amount) {
    this.state.health = Math.min(100, this.state.health + amount);
    return this.state.health;
  }
  
  /**
   * Clean up
   */
  destroy() {
    if (this.boosterLeft) this.boosterLeft.destroy();
    if (this.boosterRight) this.boosterRight.destroy();
    if (this.boosterGlowLeft) this.boosterGlowLeft.destroy();
    if (this.boosterGlowRight) this.boosterGlowRight.destroy();
    if (this.wingsGlow) this.wingsGlow.destroy();
    if (this.engineContainer) this.engineContainer.destroy();
    if (this.engineTrailContainer) this.engineTrailContainer.destroy();
    if (this.boostLight) this.scene.lights.removeLight(this.boostLight);
    super.destroy();
  }
}