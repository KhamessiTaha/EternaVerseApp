import Phaser from 'phaser';
import { getSettings } from '../settings.js';

export class PlayerObject extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, texture) {
    super(scene, x, y, texture);
    
    // Add to scene and physics
    scene.add.existing(this);
    scene.physics.add.existing(this);
    
    // Physics setup
    this.body.setDamping(true);
    this.body.setDrag(0.97);
    // Generous per-axis cap only; actual top speed (including thruster
    // upgrades AND the boosted speed cap) is the resultant-vector clamp in
    // InputSystem. Must stay above max boosted+upgraded speed (~1116).
    this.body.setMaxVelocity(1400);
    this.body.setAngularDrag(0.96);
    this.body.setMass(1.2);
    this.body.useDamping = true;
    this.body.allowRotation = false;
    
    // Visual state - hull textures are 256px canvases (see TextureFactory),
    // scale tuned to land around the same ~27px on-screen size the old
    // 512px PNG had at 0.05. Kept in sync with updatePlayerThrusters'
    // baseScale/speedScale/boostScale in UniverseScene.js.
    this.setScale(0.105);
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
    this.activeParticles = [];
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
    const trailQuality = getSettings().trailQuality;
    if (trailQuality === "off" || velocity < 40) return;

    const now = this.scene.time.now;
    if (now - this.lastTrailTime < this.flameConfig.trailInterval) return;

    this.lastTrailTime = now;

    // Particle intensity (low quality halves the count and skips the
    // outer-layer / sparkle particles below)
    const boostMultiplier = inputData.boosting ? 1.5 : 1;
    const velocityFactor = Math.min(velocity / 600, 1);
    let particleCount = Math.floor(2 + velocityFactor * 4) * boostMultiplier;
    if (trailQuality === "low") particleCount = Math.max(1, Math.floor(particleCount / 2));
    
    // Colors - normal thrust matches the HUD's amber accent (starlight),
    // boost shifts to a cool cyan "overdrive" tone distinct from any UI status color
    const isBoosting = inputData.boosting;
    const coreColor = isBoosting ? 0x9fe6f0 : 0xf5cf7a;
    const midColor = isBoosting ? 0x4fb8d4 : 0xdfa73f;
    const outerColor = isBoosting ? 0x225f75 : 0x8a5f22;
    
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
        
        if (trailQuality === "high" && Math.random() > 0.4) {
          this.createParticle(
            spawnX + trailDir.x * 2,
            spawnY + trailDir.y * 2,
            outerColor, 0.25, 3.5, 320, 'Cubic'
          );
        }

        // Sparkles when boosting
        if (trailQuality === "high" && isBoosting && Math.random() > 0.6) {
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

    // Track particle
    this.activeParticles.push(particle);

    // Animate
    this.scene.tweens.add({
      targets: particle,
      alpha: 0,
      scale: { from: startScale, to: startScale * 0.1 },
      duration: duration,
      ease: `${easeType}.easeOut`,
      onComplete: () => {
        if (particle && !particle.isDestroyed) {
          particle.destroy();
          const index = this.activeParticles.indexOf(particle);
          if (index > -1) {
            this.activeParticles.splice(index, 1);
          }
        }
      },
    });
  }
  
  /**
   * Play damage feedback animation
   */
  playDamageAnimation() {
    this.scene.tweens.add({
      targets: this,
      scaleX: { from: 0.105, to: 0.095 },
      duration: 80,
      yoyo: true,
      repeat: 2,
      ease: 'Cubic.easeOut',
    });

    if (getSettings().cameraShake) {
      this.scene.cameras.main.shake(150, 0.005);
    }
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
  destroy(fromScene) {
    // Only destroy our satellite display objects when the ship is destroyed
    // INDIVIDUALLY. When fromScene is true the whole scene is tearing down
    // and Phaser's DisplayList is already iterating-and-destroying every
    // object - destroying siblings here mutates that list mid-iteration and
    // crashes DisplayList.shutdown ("Cannot read properties of undefined"),
    // leaving the game half-dead on the next launch.
    if (!fromScene) {
      this.activeParticles.forEach(particle => {
        if (particle && !particle.isDestroyed) {
          particle.destroy();
        }
      });
      if (this.engineTrailContainer) this.engineTrailContainer.destroy();
    }
    this.activeParticles = [];
    this.engineTrailContainer = null;

    super.destroy(fromScene);
  }
}