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