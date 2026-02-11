import Phaser from "phaser";

export class InputSystem {
  constructor(scene) {
    this.scene = scene;
    this.setupControls();
    
    // Enhanced physics parameters
    this.params = {
      ROTATION_SPEED: 0.06,
      ROTATION_ACCEL: 0.003,
      MAX_ROTATION_VEL: 0.08,
      THRUST: 280,
      BRAKE: 180,
      STRAFE_FORCE: 150,
      BOOST_MULTIPLIER: 1.8,
      BOOST_COST: 0.3, // per frame
    };
    
    this.rotationVelocity = 0;
    this.boostEnergy = 100;
    this.boostRechargeRate = 0.5;
  }

  setupControls() {
    this.keys = this.scene.input.keyboard.addKeys({
      thrust: Phaser.Input.Keyboard.KeyCodes.Z,
      brake: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.Q,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      strafeLeft: Phaser.Input.Keyboard.KeyCodes.A,
      strafeRight: Phaser.Input.Keyboard.KeyCodes.E,
      boost: Phaser.Input.Keyboard.KeyCodes.SHIFT,
      map: Phaser.Input.Keyboard.KeyCodes.M,
      fix: Phaser.Input.Keyboard.KeyCodes.F,
    });

    this.mapKey = this.keys.map;
    this.fixKey = this.keys.fix;

    // Setup F key listener for anomaly interaction
    this.scene.input.keyboard.on('keydown-F', () => {
      this.handleAnomalyInteraction();
    });
  }

  /**
   * Handle F key press - trigger anomaly interaction
   */
  handleAnomalyInteraction() {
    if (!this.scene.anomalySystem) return;

    const nearestAnomaly = this.findNearestAnomaly();

    if (nearestAnomaly) {
      console.log(`[Input] Anomaly interaction: ${nearestAnomaly.type} at (${nearestAnomaly.location.x.toFixed(0)}, ${nearestAnomaly.location.y.toFixed(0)})`);

      // Map anomaly type to minigame scene
      const gameScene = this.mapAnomalyToGame(nearestAnomaly.type);

      // Start minigame scene (this pauses the current scene)
      this.scene.scene.launch(gameScene, { anomaly: nearestAnomaly });
    } else {
      console.log('[Input] No anomalies nearby');
    }
  }

  /**
   * Map anomaly type to minigame scene key
   */
  mapAnomalyToGame(anomalyType) {
    const mapping = {
      'quantum_fluctuation': 'QuantumStabilizerScene',
      'temporal_distortion': 'QuantumStabilizerScene',
      'gravity_anomaly': 'QuantumStabilizerScene',
      'cosmic_radiation_burst': 'QuantumStabilizerScene',
      'dark_matter_spike': 'QuantumStabilizerScene',
      'exotic_particle_cascade': 'QuantumStabilizerScene'
    };
    return mapping[anomalyType] || 'QuantumStabilizerScene';
  }

  /**
   * Find the nearest anomaly within interaction range
   */
  findNearestAnomaly() {
    const INTERACTION_RANGE = 300; // World units
    const anomalies = Array.from(this.scene.anomalySystem.backendAnomalies.values());

    if (anomalies.length === 0) return null;

    const player = this.scene.player;
    let nearest = null;
    let nearestDistance = INTERACTION_RANGE;

    for (const anomaly of anomalies) {
      const distance = Phaser.Math.Distance.Between(
        player.x,
        player.y,
        anomaly.location.x,
        anomaly.location.y
      );

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = anomaly;
      }
    }

    return nearest;
  }

  handlePlayerMovement(player) {
    // --- SMOOTH ROTATION WITH ACCELERATION ---
    let rotationInput = 0;
    if (this.keys.left.isDown) rotationInput -= 1;
    if (this.keys.right.isDown) rotationInput += 1;

    if (rotationInput !== 0) {
      this.rotationVelocity += rotationInput * this.params.ROTATION_ACCEL;
      this.rotationVelocity = Phaser.Math.Clamp(
        this.rotationVelocity,
        -this.params.MAX_ROTATION_VEL,
        this.params.MAX_ROTATION_VEL
      );
    } else {
      // Smooth deceleration
      this.rotationVelocity *= 0.9;
    }

    player.rotation += this.rotationVelocity;

    // --- THRUST SYSTEM ---
    const angle = player.rotation - Math.PI / 2;
    const perpAngle = angle + Math.PI / 2; // For strafing
    
    // Check for boost
    const isBoosting = this.keys.boost.isDown && this.boostEnergy > 0;
    const thrustMultiplier = isBoosting ? this.params.BOOST_MULTIPLIER : 1;

    let isThrusting = false;
    let acceleration = new Phaser.Math.Vector2(0, 0);

    // Forward/Backward thrust
    if (this.keys.thrust.isDown) {
      const thrust = this.params.THRUST * thrustMultiplier;
      this.scene.physics.velocityFromRotation(angle, thrust, acceleration);
      isThrusting = true;
    } else if (this.keys.brake.isDown) {
      this.scene.physics.velocityFromRotation(angle, -this.params.BRAKE, acceleration);
      isThrusting = true;
    }

    // Strafing (sideways movement)
    if (this.keys.strafeLeft.isDown) {
      const strafeVec = new Phaser.Math.Vector2();
      this.scene.physics.velocityFromRotation(
        perpAngle - Math.PI,
        this.params.STRAFE_FORCE,
        strafeVec
      );
      acceleration.add(strafeVec);
      isThrusting = true;
    } else if (this.keys.strafeRight.isDown) {
      const strafeVec = new Phaser.Math.Vector2();
      this.scene.physics.velocityFromRotation(
        perpAngle,
        this.params.STRAFE_FORCE,
        strafeVec
      );
      acceleration.add(strafeVec);
      isThrusting = true;
    }

    // Apply acceleration
    if (isThrusting) {
      player.setAcceleration(acceleration.x, acceleration.y);
    } else {
      player.setAcceleration(0, 0);
    }

    // --- BOOST ENERGY MANAGEMENT ---
    if (isBoosting && isThrusting) {
      this.boostEnergy = Math.max(0, this.boostEnergy - this.params.BOOST_COST);
    } else if (this.boostEnergy < 100) {
      this.boostEnergy = Math.min(100, this.boostEnergy + this.boostRechargeRate);
    }

    // Store state for HUD
    player.boostEnergy = this.boostEnergy;
    player.isBoosting = isBoosting && isThrusting;
  }

  getBoostEnergy() {
    return this.boostEnergy;
  }
}