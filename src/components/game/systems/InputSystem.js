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
    
    // Minigame state
    this.isMinigameActive = false;
    this.savedVelocity = { x: 0, y: 0 };
    this.resolvingAnomalyId = null; // Track which anomaly is being resolved
    
    this.setupMinigameListeners();
  }
  
  /**
   * Setup listeners for minigame events
   */
  setupMinigameListeners() {
    // Listen for minigame start
    this.scene.events.on('minigame:start', () => {
      this.pauseMovement();
    });
    
    // Listen for minigame complete/abort
    this.scene.events.on('minigame:complete', () => {
      this.resumeMovement();
    });
    
    this.scene.events.on('minigame:abort', () => {
      this.resumeMovement();
    });
  }
  
  /**
   * Stop spacecraft movement and save current velocity
   */
  pauseMovement() {
    this.isMinigameActive = true;
    const player = this.scene.player;
    
    if (player && player.body) {
      // Save current velocity
      this.savedVelocity = {
        x: player.body.velocity.x,
        y: player.body.velocity.y
      };
      
      // Stop all movement
      player.setVelocity(0, 0);
      player.setAcceleration(0, 0);
      
      console.log('[InputSystem] Spacecraft paused - velocity zeroed');
    }
  }
  
  /**
   * Resume spacecraft movement
   */
  resumeMovement() {
    this.isMinigameActive = false;
    this.resolvingAnomalyId = null; // Clear the resolving anomaly
    console.log('[InputSystem] Movement control restored');
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
    if (!this.scene.anomalySystem || this.isMinigameActive) return;

    const nearestAnomaly = this.findNearestAnomaly();

    if (nearestAnomaly) {
      // Prevent duplicate resolution attempts
      if (this.resolvingAnomalyId === nearestAnomaly.id) {
        console.log('[Input] Anomaly resolution already in progress');
        return;
      }

      // Verify the anomaly is still in the active backendAnomalies map
      // (it might have been resolved between checks)
      if (!this.scene.anomalySystem.backendAnomalies.has(nearestAnomaly.id)) {
        console.log('[Input] Anomaly no longer available (already resolved)');
        return;
      }

      console.log(`[Input] Anomaly interaction: ${nearestAnomaly.type} at (${nearestAnomaly.location.x.toFixed(0)}, ${nearestAnomaly.location.y.toFixed(0)})`);
      console.log(`[Input] Anomaly ID: ${nearestAnomaly.id}, Severity: ${nearestAnomaly.severity}`);

      // Mark this anomaly as being resolved
      this.resolvingAnomalyId = nearestAnomaly.id;

      // Emit minigame start event (this will pause movement)
      this.scene.events.emit('minigame:start', { anomaly: nearestAnomaly });

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
      // Validate anomaly has required properties
      if (!anomaly.location || !anomaly.location.x || !anomaly.location.y) {
        console.warn('[InputSystem] Anomaly missing location data:', anomaly);
        continue;
      }

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

    if (nearest) {
      console.log('[InputSystem] Found nearest anomaly:', {
        id: nearest.id,
        type: nearest.type,
        severity: nearest.severity,
        distance: nearestDistance.toFixed(0)
      });
    }

    return nearest;
  }

  handlePlayerMovement(player) {
    // Skip all input handling if minigame is active
    if (this.isMinigameActive) {
      return;
    }

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