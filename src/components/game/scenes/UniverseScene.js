import Phaser from "phaser";
import seedrandom from "seedrandom";
import { getChunkCoords, lerpFactorByDelta } from "../utils";
import { ChunkSystem } from "../systems/ChunkSystem";
import { TextureFactory } from "../graphics/TextureFactory.js";
import { BackgroundSystem } from "../systems/BackgroundSystem.js";
import { ScanSystem } from "../systems/ScanSystem.js";
import { AnomalySystem } from "../systems/AnomalySystem";
import { MinimapSystem } from "../systems/MinimapSystem";
import { FullMapSystem } from "../systems/FullMapSystem";
import { InputSystem } from "../systems/InputSystem";
import { HUD } from "../systems/HUD";
import { PlayerObject } from "../systems/PlayerObject";

export const UniverseSceneFactory = (props) => {
  const { onHUDUpdate, onMinimapUpdate, onFullMapUpdate, onDiscovery } = props;

  return class UniverseScene extends Phaser.Scene {
    constructor() {
      super({ key: "UniverseScene" });
      this.currentChunk = null;
      this.lastChunkCheck = 0;
      this.CHUNK_CHECK_INTERVAL = 150; // ms (update chunk every 150ms) !!!up for testing!!!
      this.onHUDUpdate = onHUDUpdate;
      this.onMinimapUpdate = onMinimapUpdate;
      this.onFullMapUpdate = onFullMapUpdate;
      this.onDiscovery = onDiscovery;
    }

    init({ universe, onAnomalyResolved, setStats }) {
      this.universe = universe;
      this.onAnomalyResolved = onAnomalyResolved;
      this.setStats = setStats;
      this.rng = seedrandom(universe.seed ?? "default");
    }

    preload() {
      this.load.image("Player", "/assets/Player.png");
    }

    create() {
      // Textures must exist before any chunk renders its objects.
      this.textureFactory = new TextureFactory(this, this.universe.seed ?? "default");
      this.textureFactory.generateAll();

      this.backgroundSystem = new BackgroundSystem(this);
      this.backgroundSystem.create();

      this.initSystems();
      this.createPlayer();
      this.initLighting();

      this.currentChunk = getChunkCoords(this.player.x, this.player.y);
      this.chunkSystem.loadNearbyChunks(
        this.currentChunk.chunkX,
        this.currentChunk.chunkY,
      );

      this.updateUIPositions();
      this.registerEvents();

      this.renderFullMap();
      this.anomalySystem.renderBackendAnomalies(this.chunkSystem.loadedChunks);
    }

    initSystems() {
      this.anomalySystem = new AnomalySystem(this);
      // ScanSystem must exist before ChunkSystem loads chunks: renderObject
      // consults it to re-attach cataloged markers on chunk regeneration.
      this.scanSystem = new ScanSystem(this);
      this.scanSystem.seedScanned((this.universe.discoveries || []).map((d) => d.id));
      this.chunkSystem = new ChunkSystem(this, this.anomalySystem);
      this.minimapSystem = new MinimapSystem(this);
      this.fullMapSystem = new FullMapSystem(this);
      this.inputSystem = new InputSystem(this);
      this.hud = new HUD(this);

      this.anomalySystem.syncBackendAnomalies();
    }

    createPlayer() {
      this.player = new PlayerObject(this, 0, 0, "Player");

      this.playerState = {
        boosting: false,
        drifting: false,
        velocity: { x: 0, y: 0 },
        boostGlow: 0,
      };

      this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
      this.cameras.main.setZoom(1.5);
      
      this.cameraShakeIntensity = 0;
    }

    initLighting() {
      this.lights.enable().setAmbientColor(0x0a0a0a);
      this.playerLight = this.lights.addLight(0, 0, 250).setIntensity(2.5);
      
      this.boostLight = this.lights.addLight(0, 0, 180)
        .setIntensity(0)
        .setColor(0x4fb8d4);
    }

    registerEvents() {
      this.scale.on("resize", this.handleResize, this);

      // Listen for minigame completion
      this.events.on('minigame:complete', (data) => {
        this.handleMinigameComplete(data);
      });

      // Listen for minigame abort
      this.events.on('minigame:abort', (data) => {
        this.handleMinigameAbort(data);
      });

      // Scan completions flow out to React (toast + backend submission)
      this.events.on('scan:complete', ({ discovery }) => {
        this.onDiscovery?.(discovery);
      });
    }

    handleMinigameComplete(data) {
      const { anomaly, result } = data;

      console.log(`✅ Minigame completed: ${result.status}`);
      console.log(`   Score: ${result.score}`);
      console.log(`   Accuracy: ${result.accuracy}%`);
      console.log(`   Anomaly object:`, anomaly);
      console.log(`   Impact: ${JSON.stringify(result.impact)}`);

      // Validate anomaly object has required fields
      if (!anomaly || typeof anomaly !== 'object') {
        console.error('❌ Invalid anomaly object - not an object:', anomaly);
        return;
      }

      if (!anomaly.id) {
        console.error('❌ Invalid anomaly object - missing id field:', anomaly);
        return;
      }

      // Only notify if the minigame was won (anomalyResolved = true)
      if (result.impact.anomalyResolved) {
        console.log(`✓ Game result was successful, calling anomaly resolution handler`);
        
        // Trigger destruction animation and visual effects
        this.playAnomalyDestructionEffect(anomaly);
        
        if (this.onAnomalyResolved) {
          const anomalyToResolve = {
            id: anomaly.id,
            type: anomaly.type,
            location: anomaly.location,
            severity: anomaly.severity,
            gameResult: result
          };
          console.log(`✓ Passing anomaly to resolution handler:`, anomalyToResolve);
          this.onAnomalyResolved(anomalyToResolve);
        }
      } else {
        console.log(`⚠️ Game result was not successful (${result.status}) - no backend resolution attempted`);
      }
    }

    playAnomalyDestructionEffect(anomaly) {
      try {
        // Backend anomalies are wrapped ({...data, visual}) in a Map keyed
        // by id; procedural anomalies live directly inside their chunk's
        // anomalies[] array and ARE the visual object.
        const visual = anomaly.isBackend
          ? this.anomalySystem.backendAnomalies.get(anomaly.id)?.visual
          : this.anomalySystem.findProceduralAnomaly(anomaly.id, this.chunkSystem.loadedChunks);

        if (!visual) {
          console.warn('⚠️ Could not find visual anomaly for destruction effect:', anomaly.id);
          return;
        }

        // Use location coordinates (guaranteed to exist)
        const x = anomaly.location?.x || visual.x;
        const y = anomaly.location?.y || visual.y;

        if (typeof x !== 'number' || typeof y !== 'number') {
          console.warn('⚠️ Invalid anomaly coordinates:', { x, y });
          return;
        }

        console.log(`🎆 Playing anomaly destruction effect at (${x.toFixed(0)}, ${y.toFixed(0)})`);

        // Camera shake effect
        this.cameras.main.shake(300, 0.008);

        // Create particle burst for destruction
        const particleBurst = this.add.particles(x, y, "Player", {
          speed: { min: 80, max: 200 },
          scale: { start: 0.03, end: 0 },
          lifespan: 1000,
          quantity: 30,
          angle: { min: 0, max: 360 },
          blendMode: "ADD"
        });

        // Remove particles after animation completes
        this.time.delayedCall(1000, () => {
          particleBurst.destroy();
        });

        // Destroy the visual anomaly
        this.anomalySystem.destroyAnomalyVisual(visual);

        if (anomaly.isBackend) {
          this.anomalySystem.backendAnomalies.delete(anomaly.id);
        } else {
          visual.resolved = true;
        }
        this.anomalySystem.resolvedAnomalies.add(anomaly.id);

        // Update stats
        this.setStats?.((prev) => ({
          ...prev,
          resolved: (prev.resolved || 0) + 1,
        }));

        console.log(`✓ Anomaly destruction complete: ${anomaly.id}`);

      } catch (err) {
        console.error('❌ Error playing anomaly destruction effect:', err);
      }
    }

    handleMinigameAbort(data) {
      const { anomaly } = data;
      console.log(`⚠️ Minigame aborted for ${anomaly.type}`);
    }

    update(time, delta) {
      this.inputSystem.handlePlayerMovement(this.player, delta);
      this.applyBanking(delta);

      // Update player visuals and animations
      this.player.updateVisuals({
        boosting: this.player.isBoosting || false,
      });
      this.player.updateGraphics();

      this.updatePlayerThrusters(delta);
      this.updateBoostEffects(delta);

      this.playerLight.setPosition(this.player.x, this.player.y);
      this.boostLight.setPosition(this.player.x, this.player.y);

      this.hud.update(this.player);
      this.backgroundSystem.update();
      this.scanSystem.update(delta);

      // Send HUD data to React
      if (this.onHUDUpdate) {
        this.onHUDUpdate(this.hud.getData());
      }

      this.checkChunkChange(time);

      this.anomalySystem.handleInteraction(
        this.player,
        this.chunkSystem.loadedChunks
      );

      // Update minimap (now sends data to React)
      this.minimapSystem.update(
        this.player,
        this.currentChunk,
        this.chunkSystem.loadedChunks,
        this.anomalySystem.backendAnomalies,
      );
      
      // Update full map (send data to React)
      this.renderFullMap();
      
      this.updateCameraShake();
    }

    applyBanking(delta) {
      // Bank based on how much the ship is drifting sideways relative to its
      // OWN facing, not raw world-space X velocity - using world-space vx
      // meant flying diagonally (which naturally has a nonzero world vx even
      // with zero rotation input) produced a phantom tilt unrelated to
      // actual turning or strafing.
      const { x: vx, y: vy } = this.player.body.velocity;
      const forwardAngle = this.player.rotation - Math.PI / 2;
      const rightAngle = forwardAngle + Math.PI / 2;
      const lateralVelocity = vx * Math.cos(rightAngle) + vy * Math.sin(rightAngle);

      const velocityBank = Phaser.Math.Clamp(lateralVelocity / 500, -0.25, 0.25);
      const rotationBank = this.inputSystem.rotationVelocity * 2;
      const totalBank = velocityBank + rotationBank;

      this.player.rotation += totalBank * lerpFactorByDelta(0.015, delta);
    }

    updatePlayerThrusters(delta) {
      const speed = this.player.body.velocity.length();
      const isBoosting = this.player.isBoosting;

      const baseScale = 0.05;
      const speedScale = speed > 50 ? 0.055 : baseScale;
      const boostScale = isBoosting ? 0.062 : speedScale;

      this.player.setScale(
        Phaser.Math.Linear(this.player.scaleX, boostScale, lerpFactorByDelta(0.15, delta)),
      );

      if (isBoosting) {
        this.cameraShakeIntensity = Phaser.Math.Linear(
          this.cameraShakeIntensity,
          0.0008,
          lerpFactorByDelta(0.2, delta)
        );
      } else {
        this.cameraShakeIntensity = Phaser.Math.Linear(
          this.cameraShakeIntensity,
          0,
          lerpFactorByDelta(0.1, delta)
        );
      }
    }

    updateBoostEffects(delta) {
      const isBoosting = this.player.isBoosting;
      const targetGlow = isBoosting ? 1.5 : 0;

      this.playerState.boostGlow = Phaser.Math.Linear(
        this.playerState.boostGlow,
        targetGlow,
        lerpFactorByDelta(0.2, delta)
      );

      this.boostLight.setIntensity(this.playerState.boostGlow);

      const mainLightIntensity = isBoosting ? 3.0 : 2.5;
      this.playerLight.setIntensity(
        Phaser.Math.Linear(
          this.playerLight.intensity,
          mainLightIntensity,
          lerpFactorByDelta(0.1, delta)
        )
      );
    }

    updateCameraShake() {
      if (this.cameraShakeIntensity > 0.0001) {
        this.cameras.main.shake(16, this.cameraShakeIntensity);
      }
    }

    checkChunkChange(time) {
      if (time - this.lastChunkCheck < this.CHUNK_CHECK_INTERVAL) return;
      this.lastChunkCheck = time;

      const nextChunk = getChunkCoords(this.player.x, this.player.y);
      if (
        nextChunk.chunkX !== this.currentChunk.chunkX ||
        nextChunk.chunkY !== this.currentChunk.chunkY
      ) {
        this.currentChunk = nextChunk;
        this.chunkSystem.loadNearbyChunks(nextChunk.chunkX, nextChunk.chunkY);
        this.anomalySystem.renderBackendAnomalies(
          this.chunkSystem.loadedChunks,
        );
      }
    }

    // Keep renderFullMap but it now just sends data
    renderFullMap() {
      this.fullMapSystem.render(
        this.player,
        this.currentChunk,
        this.chunkSystem.loadedChunks,
        this.anomalySystem.backendAnomalies,
        this.anomalySystem.resolvedAnomalies,
      );
    }


    handleResize() {

      this.inputSystem.updateArrowPositions?.(this.scale.width, this.scale.height);
    }

    updateUIPositions() {
      const { width: w, height: h } = this.scale;

      this.inputSystem.updateArrowPositions?.(w, h);
    }

    updateFromUniverse(newUniverse) {
      this.universe = newUniverse;
      this.anomalySystem.syncBackendAnomalies();
      this.anomalySystem.renderBackendAnomalies(this.chunkSystem.loadedChunks);
      this.scanSystem.seedScanned((newUniverse.discoveries || []).map((d) => d.id));
    }

    shutdown() {
      // Stop all tweens
      this.tweens.killAll();
      
      // Clean up chunk system and anomalies
      if (this.chunkSystem) {
        this.chunkSystem.loadedChunks.forEach((chunk) => {
          this.chunkSystem.cleanupChunk(chunk);
        });
        this.chunkSystem.loadedChunks.clear();
      }
      
      // Clean up backend anomalies
      if (this.anomalySystem && this.anomalySystem.backendAnomalies) {
        this.anomalySystem.backendAnomalies.forEach((anomaly) => {
          if (anomaly.visual) {
            this.anomalySystem.destroyAnomalyVisual(anomaly.visual);
          }
        });
        this.anomalySystem.backendAnomalies.clear();
      }
      
      this.backgroundSystem?.destroy();
      this.scanSystem?.destroy();

      // Remove lights
      if (this.playerLight) this.lights.removeLight(this.playerLight);
      if (this.boostLight) this.lights.removeLight(this.boostLight);
      
      // Off event listeners
      this.scale.off('resize', this.handleResize, this);
      this.events.off('minigame:complete');
      this.events.off('minigame:abort');
      this.events.off('scan:complete');
    }
  };
};