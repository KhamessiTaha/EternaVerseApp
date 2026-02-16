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
      velocity: { x: 0, y: 0 },
      direction: 0,
      health: 100,
    };
    
    // === CONFIGURABLE FLAME PARAMETERS ===s
    this.flameConfig = {
      // Base angle offset (0 = straight back relative to ship direction)
      angleOffset: 0,
      
      // Spread angle in radians (how wide the flame cone is)
      spreadAngle: Math.PI / 12, // ~15 degrees spread
      
      // Thruster positions relative to ship center (local coordinates)
      // Positive Y = toward back of ship, Negative Y = toward front
      thrusterOffsets: {
        left: { x: -9, y: 17 },   // Left thruster position
        right: { x: 9, y: 17 }     // Right thruster position
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

    this.engineTrailContainer = scene.add.container(x, y);
    this.engineTrailContainer.setDepth(2);

    this.lastTrailTime = 0;
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

    // Create trail effect
    this.updateTrail(vel, inputData);
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
    if (this.engineTrailContainer) this.engineTrailContainer.destroy();
    super.destroy();
  }
}