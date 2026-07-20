import Phaser from "phaser";
import { scaleByDelta, decayByDelta } from "../utils";
import { getShipModifiers } from "../content/upgradeCatalog.js";
import { getSettings, onSettingsChange } from "../settings.js";
import { playSfx } from "../audio.js";
import { getLoadoutLocal } from "../loadoutStore.js";
import { HULL_STATS } from "../content/hullCatalog.js";
import { narrateOnce, pick, CURATOR } from "../narrator.js";

// Movement key presets, selected via the settings menu. AZERTY (ZQSD) is the
// game's original binding; QWERTY gives the standard WASD cluster.
const KEY_LAYOUTS = {
  azerty: { thrust: "Z", brake: "S", left: "Q", right: "D", strafeLeft: "A", strafeRight: "E" },
  qwerty: { thrust: "W", brake: "S", left: "A", right: "D", strafeLeft: "Q", strafeRight: "E" },
};

export class InputSystem {
  constructor(scene) {
    this.scene = scene;
    this.setupControls();

    // Rebind movement keys immediately when the layout setting changes
    this.unsubscribeSettings = onSettingsChange(() => this.applyKeyboardLayout());

    // Self-managed cleanup: don't rely solely on the scene remembering to
    // call destroy(). A full game teardown (leaving the universe) fires
    // 'destroy', NOT 'shutdown' - relying on 'shutdown' alone left this
    // subscribed forever with a torn-down scene.input.keyboard, and the
    // next settings change anywhere in the app would throw inside this
    // stale listener, aborting the whole notification loop for everyone
    // after it in the Set (e.g. the radar-size listener never ran).
    this.scene.events.once('shutdown', this.destroy, this);
    this.scene.events.once('destroy', this.destroy, this);

    // Enhanced physics parameters
    this.params = {
      ROTATION_SPEED: 0.06,
      ROTATION_ACCEL: 0.003,
      MAX_ROTATION_VEL: 0.08,
      THRUST: 280,
      BRAKE: 180,
      STRAFE_FORCE: 150,
      BOOST_MULTIPLIER: 2.0, // thrust (acceleration) multiplier while boosting
      BOOST_SPEED_MULTIPLIER: 1.5, // top-speed multiplier while boosting - this is what makes boost FEEL like boost
      BOOST_COST: 0.35, // per reference frame (~4.8s to fully drain)
      MAX_SPEED: 600, // resultant-vector cap; PlayerObject's per-axis body cap sits above boosted+upgraded speeds
      BOOST_LOCKOUT_THRESHOLD: 20, // once fully drained, boost is locked out until energy recovers to this
    };

    this.rotationVelocity = 0;
    this.boostEnergy = 100;
    this.boostRechargeRate = 0.09; // per reference frame (~18.5s to fully recharge) - boost is now much faster, so the refill penalty is steep to match
    this.boostLocked = false; // true from the moment energy hits 0 until it climbs back to BOOST_LOCKOUT_THRESHOLD
    
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
    this.applyKeyboardLayout();

    // Setup F key listener for anomaly interaction
    this.scene.input.keyboard.on('keydown-F', () => {
      this.handleAnomalyInteraction();
    });

    // V key: scan the nearest unscanned cosmic object / anomaly
    this.scene.input.keyboard.on('keydown-V', () => {
      if (this.isMinigameActive) return;
      this.scene.scanSystem?.tryStartScan();
    });

    // G key: open First Contact with the nearest civilization beacon
    this.scene.input.keyboard.on('keydown-G', () => {
      if (this.isMinigameActive) return;
      const civ = this.scene.civilizationSystem?.findNearest(this.scene.player);
      if (civ) this.scene.onCivContact?.(civ.id);
    });
  }

  /**
   * (Re)bind all polled keys from the current keyboard-layout setting.
   * Safe to call at any time - old Key objects are released first so
   * abandoned bindings don't keep firing.
   */
  applyKeyboardLayout() {
    // Defensive: if this instance is somehow still subscribed after its
    // scene was torn down (Phaser nulls out input internals on shutdown),
    // bail instead of throwing - a thrown error here would abort the
    // settings module's listener loop for every OTHER subscriber too.
    if (!this.scene?.input?.keyboard) return;

    const layout = KEY_LAYOUTS[getSettings().keyboardLayout] || KEY_LAYOUTS.azerty;

    if (this.keys) {
      Object.values(this.keys).forEach((key) => this.scene.input.keyboard.removeKey(key));
    }

    this.keys = this.scene.input.keyboard.addKeys({
      ...layout,
      boost: Phaser.Input.Keyboard.KeyCodes.SHIFT,
      map: Phaser.Input.Keyboard.KeyCodes.M,
      fix: Phaser.Input.Keyboard.KeyCodes.F,
      scan: Phaser.Input.Keyboard.KeyCodes.V,
    });

    this.mapKey = this.keys.map;
    this.fixKey = this.keys.fix;
  }

  destroy() {
    // Safe to call more than once - shutdown/destroy events and
    // UniverseScene's own cleanup can all reach this.
    this.unsubscribeSettings?.();
    this.unsubscribeSettings = null;
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

      // Verify the anomaly is still available (it might have been resolved
      // between checks) - only backend anomalies have a fast map lookup;
      // procedural ones were already filtered to unresolved in the scan above
      if (nearestAnomaly.isBackend && !this.scene.anomalySystem.backendAnomalies.has(nearestAnomaly.id)) {
        console.log('[Input] Anomaly no longer available (already resolved)');
        return;
      }

      console.log(`[Input] Anomaly interaction: ${nearestAnomaly.type} (${nearestAnomaly.category}) at (${nearestAnomaly.location.x.toFixed(0)}, ${nearestAnomaly.location.y.toFixed(0)})`);
      console.log(`[Input] Anomaly ID: ${nearestAnomaly.id}, Severity: ${nearestAnomaly.severity}`);

      // Mark this anomaly as being resolved
      this.resolvingAnomalyId = nearestAnomaly.id;

      // Emit minigame start event (this will pause movement)
      this.scene.events.emit('minigame:start', { anomaly: nearestAnomaly });

      // Map anomaly category to minigame scene
      const gameScene = this.mapAnomalyToGame(nearestAnomaly.category);

      // Start minigame scene (this pauses the current scene)
      this.scene.scene.launch(gameScene, { anomaly: nearestAnomaly });
    } else {
      console.log('[Input] No anomalies nearby');
    }
  }

  /**
   * Map anomaly category to minigame scene key. Any unrecognized/future
   * category falls back to the generic timing game.
   */
  mapAnomalyToGame(category) {
    const mapping = {
      gravitational: 'GravityWellScene',
      stellar: 'CascadeReactionScene',
      quantum: 'WaveformCollapseScene',
      cosmological: 'ExpansionContainmentScene',
      structural: 'StructuralRealignmentScene',
      electromagnetic: 'PolarityBalanceScene',
    };
    return mapping[category] || 'QuantumStabilizerScene';
  }

  /**
   * Find the nearest interactable anomaly within range, across BOTH backend
   * anomalies (this.scene.anomalySystem.backendAnomalies) and procedural
   * anomalies (living inside loaded chunks) - normalized to a common shape
   * so the rest of the interaction/minigame pipeline doesn't need to care
   * which source an anomaly came from.
   */
  findNearestAnomaly() {
    const INTERACTION_RANGE = 300; // World units
    const player = this.scene.player;
    let nearest = null;
    let nearestDistance = INTERACTION_RANGE;

    for (const anomaly of this.scene.anomalySystem.backendAnomalies.values()) {
      if (!anomaly.location || typeof anomaly.location.x !== 'number' || typeof anomaly.location.y !== 'number') {
        continue;
      }

      const distance = Phaser.Math.Distance.Between(player.x, player.y, anomaly.location.x, anomaly.location.y);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = {
          id: anomaly.id,
          type: anomaly.type,
          category: anomaly.category,
          severity: anomaly.severity,
          location: { x: anomaly.location.x, y: anomaly.location.y },
          isBackend: true,
        };
      }
    }

    if (this.scene.chunkSystem?.loadedChunks) {
      this.scene.chunkSystem.loadedChunks.forEach((chunk) => {
        chunk.anomalies.forEach((anomaly) => {
          if (anomaly.resolved) return;

          const distance = Phaser.Math.Distance.Between(player.x, player.y, anomaly.x, anomaly.y);
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearest = {
              id: anomaly.id,
              type: anomaly.type,
              category: anomaly.category,
              severity: anomaly.severity,
              location: { x: anomaly.x, y: anomaly.y },
              isBackend: false,
            };
          }
        });
      });
    }

    if (nearest) {
      console.log('[InputSystem] Found nearest anomaly:', {
        id: nearest.id,
        type: nearest.type,
        category: nearest.category,
        severity: nearest.severity,
        distance: nearestDistance.toFixed(0)
      });
    }

    return nearest;
  }

  handlePlayerMovement(player, delta = 16.667) {
    // Skip all input handling if minigame is active
    if (this.isMinigameActive) {
      return;
    }

    // Ship-upgrade stat multipliers (Ion Thrusters / Boost Reactor). Read
    // live from the scene's universe so a purchase applies immediately.
    const mods = getShipModifiers(this.scene.universe?.upgrades);

    // Hull flight characteristics stack multiplicatively on the upgrade
    // mods (getShipModifiers returns a fresh object each call, so mutating
    // it here is safe) - every downstream use of mods picks these up.
    const hullStats = HULL_STATS[getLoadoutLocal().hull] || {};
    mods.thrust *= hullStats.thrust || 1;
    mods.maxSpeed *= hullStats.maxSpeed || 1;

    // Relativistic mass: F = gamma * m * a, so at fixed engine force your
    // acceleration falls by 1/gamma as v approaches game-c (gamma computed
    // per-frame in UniverseScene). Engines feel heavier the faster you go -
    // a physically honest soft wall at the speed of light.
    mods.thrust /= this.scene.gamma || 1;

    // --- SMOOTH ROTATION WITH ACCELERATION ---
    // Turn sensitivity (settings) scales both how fast rotation ramps up and
    // its cap, so the whole turn feel shifts together. Hull turn rating
    // stacks the same way.
    const sensitivity = (getSettings().turnSensitivity || 1) * (hullStats.turn || 1);

    let rotationInput = 0;
    if (this.keys.left.isDown) rotationInput -= 1;
    if (this.keys.right.isDown) rotationInput += 1;

    if (rotationInput !== 0) {
      this.rotationVelocity += rotationInput * scaleByDelta(this.params.ROTATION_ACCEL * sensitivity, delta);
      this.rotationVelocity = Phaser.Math.Clamp(
        this.rotationVelocity,
        -this.params.MAX_ROTATION_VEL * sensitivity,
        this.params.MAX_ROTATION_VEL * sensitivity
      );
    } else {
      // Smooth deceleration
      this.rotationVelocity = decayByDelta(this.rotationVelocity, 0.9, delta);
    }

    player.rotation += this.rotationVelocity;

    // --- THRUST SYSTEM ---
    const angle = player.rotation - Math.PI / 2;
    const perpAngle = angle + Math.PI / 2; // For strafing
    
    // Check for boost - locked out entirely once fully drained, until energy
    // recovers past BOOST_LOCKOUT_THRESHOLD (prevents chain-tapping boost
    // the instant a sliver of energy trickles back in)
    const isBoosting = this.keys.boost.isDown && this.boostEnergy > 0 && !this.boostLocked;
    const thrustMultiplier = isBoosting ? this.params.BOOST_MULTIPLIER : 1;

    let isThrusting = false;
    let acceleration = new Phaser.Math.Vector2(0, 0);

    // Forward/Backward thrust (thruster upgrades scale all translational forces)
    if (this.keys.thrust.isDown) {
      const thrust = this.params.THRUST * mods.thrust * thrustMultiplier;
      this.scene.physics.velocityFromRotation(angle, thrust, acceleration);
      isThrusting = true;
    } else if (this.keys.brake.isDown) {
      this.scene.physics.velocityFromRotation(angle, -this.params.BRAKE * mods.thrust, acceleration);
      isThrusting = true;
    }

    // Strafing (sideways movement)
    if (this.keys.strafeLeft.isDown) {
      const strafeVec = new Phaser.Math.Vector2();
      this.scene.physics.velocityFromRotation(
        perpAngle - Math.PI,
        this.params.STRAFE_FORCE * mods.thrust,
        strafeVec
      );
      acceleration.add(strafeVec);
      isThrusting = true;
    } else if (this.keys.strafeRight.isDown) {
      const strafeVec = new Phaser.Math.Vector2();
      this.scene.physics.velocityFromRotation(
        perpAngle,
        this.params.STRAFE_FORCE * mods.thrust,
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
      this.boostEnergy = Math.max(0, this.boostEnergy - scaleByDelta(this.params.BOOST_COST, delta));
    } else if (this.boostEnergy < 100) {
      this.boostEnergy = Math.min(100, this.boostEnergy + scaleByDelta(this.boostRechargeRate * mods.boostRecharge, delta));
    }

    // Trigger lockout the moment energy bottoms out; release it only once
    // energy has climbed back past the threshold
    if (this.boostEnergy <= 0) {
      if (!this.boostLocked) {
        playSfx('boostDepleted');
        narrateOnce('boost-locked', pick(CURATOR.boostLocked));
      }
      this.boostLocked = true;
    } else if (this.boostLocked && this.boostEnergy >= this.params.BOOST_LOCKOUT_THRESHOLD) {
      this.boostLocked = false;
    }

    // Store state for HUD
    player.boostEnergy = this.boostEnergy;
    player.boostLocked = this.boostLocked;
    player.isBoosting = isBoosting && isThrusting;

    // Clamp resultant speed - Arcade Physics' setMaxVelocity caps each axis
    // independently, not the vector length, so combining forward thrust with
    // strafe (diagonal movement) could otherwise exceed the intended top
    // speed by up to ~41% (sqrt(2)x on a perfect diagonal). This clamp is
    // the single speed authority (PlayerObject's body cap sits above it).
    // Boosting raises the cap itself; when boost ends the excess bleeds off
    // smoothly instead of snapping down to cruise speed in one frame.
    const maxSpeed = this.params.MAX_SPEED * mods.maxSpeed *
      (player.isBoosting ? this.params.BOOST_SPEED_MULTIPLIER : 1);
    const speed = player.body.velocity.length();
    if (speed > maxSpeed) {
      player.body.velocity.setLength(Math.max(maxSpeed, decayByDelta(speed, 0.985, delta)));
    }

    // --- ASSISTED FLIGHT MODEL (settings) ---
    // The forgiving mode: decompose velocity into forward/lateral relative
    // to the ship's facing, then (a) bleed lateral drift hard so the ship
    // GOES WHERE THE NOSE POINTS instead of sliding, and (b) auto-brake
    // forward momentum whenever no thrust is held, so releasing the keys
    // means stopping. Newtonian mode skips all of this - pure inertia.
    if (getSettings().flightModel === "assisted") {
      const fwdAngle = player.rotation - Math.PI / 2;
      const fx = Math.cos(fwdAngle);
      const fy = Math.sin(fwdAngle);
      const v = player.body.velocity;
      const forward = v.x * fx + v.y * fy;
      const latX = v.x - forward * fx;
      const latY = v.y - forward * fy;

      const grip = decayByDelta(1, 0.9, delta);          // sideways drift dies fast
      const brake = isThrusting ? 1 : decayByDelta(1, 0.965, delta); // coast to a stop in ~2s

      v.x = forward * brake * fx + latX * grip;
      v.y = forward * brake * fy + latY * grip;
    }
  }

  getBoostEnergy() {
    return this.boostEnergy;
  }
}