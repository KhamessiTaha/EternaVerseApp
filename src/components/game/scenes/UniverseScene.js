import Phaser from "phaser";
import seedrandom from "seedrandom";
import { getChunkCoords } from "../utils";
import { ChunkSystem } from "../systems/ChunkSystem";
import { AnomalySystem } from "../systems/AnomalySystem";
import { MinimapSystem } from "../systems/MinimapSystem";
import { FullMapSystem } from "../systems/FullMapSystem";
import { InputSystem } from "../systems/InputSystem";
import { HUD } from "../systems/HUD";
import { MINIMAP_SIZE } from "../constants";

export const UniverseSceneFactory = (props) => {
  const { onHUDUpdate, onMinimapUpdate, onFullMapUpdate } = props;

  return class UniverseScene extends Phaser.Scene {
    constructor() {
      super({ key: "UniverseScene" });
      this.currentChunk = null;
      this.lastChunkCheck = 0;
      this.CHUNK_CHECK_INTERVAL = 150; // ms (update chunk every 150ms) !!!up for testing!!!
      this.onHUDUpdate = onHUDUpdate;
      this.onMinimapUpdate = onMinimapUpdate;
      this.onFullMapUpdate = onFullMapUpdate;
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
      this.chunkSystem = new ChunkSystem(this, this.anomalySystem);
      this.minimapSystem = new MinimapSystem(this);
      this.fullMapSystem = new FullMapSystem(this);
      this.inputSystem = new InputSystem(this);
      this.hud = new HUD(this);

      this.anomalySystem.syncBackendAnomalies();
    }

    createPlayer() {
      this.player = this.physics.add
        .sprite(0, 0, "Player")
        .setScale(0.05)
        .setDamping(true)
        .setDrag(0.97)
        .setMaxVelocity(600)
        .setAngularDrag(0.96);

      this.player.body.setMass(1.2);
      this.player.body.useDamping = true;
      this.player.body.allowRotation = false;

      this.playerState = {
        boosting: false,
        drifting: false,
        velocity: { x: 0, y: 0 },
        thrustParticles: null,
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
        .setColor(0x4488ff);
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
    }

    handleMinigameComplete(data) {
      const { anomaly, result } = data;

      console.log(`✅ Minigame completed: ${result.status}`);
      console.log(`   Score: ${result.score}`);
      console.log(`   Accuracy: ${result.accuracy}%`);
      console.log(`   Impact: ${JSON.stringify(result.impact)}`);

      // If anomaly was resolved, notify the parent GameplayPage
      if (result.impact.anomalyResolved && this.onAnomalyResolved) {
        this.onAnomalyResolved({
          ...anomaly,
          gameResult: result
        });
      }
    }

    handleMinigameAbort(data) {
      const { anomaly } = data;
      console.log(`⚠️ Minigame aborted for ${anomaly.type}`);
    }

    update(time, delta) {
      this.inputSystem.handlePlayerMovement(this.player);
      this.applyBanking();
      this.updatePlayerThrusters();
      this.updateBoostEffects();

      this.playerLight.setPosition(this.player.x, this.player.y);
      this.boostLight.setPosition(this.player.x, this.player.y);

      this.hud.update(this.player);
      
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

    applyBanking() {
      const vx = this.player.body.velocity.x;
      const vy = this.player.body.velocity.y;
      
      const velocityBank = Phaser.Math.Clamp(vx / 500, -0.25, 0.25);
      const rotationBank = this.inputSystem.rotationVelocity * 2;
      const totalBank = velocityBank + rotationBank;
      
      this.player.rotation += totalBank * 0.015;
    }

    updatePlayerThrusters() {
      const speed = this.player.body.velocity.length();
      const isBoosting = this.player.isBoosting;

      const baseScale = 0.05;
      const speedScale = speed > 50 ? 0.055 : baseScale;
      const boostScale = isBoosting ? 0.062 : speedScale;

      this.player.setScale(
        Phaser.Math.Linear(this.player.scaleX, boostScale, 0.15),
      );

      if (isBoosting) {
        this.cameraShakeIntensity = Phaser.Math.Linear(
          this.cameraShakeIntensity,
          0.0008,
          0.2
        );
      } else {
        this.cameraShakeIntensity = Phaser.Math.Linear(
          this.cameraShakeIntensity,
          0,
          0.1
        );
      }
    }

    updateBoostEffects() {
      const isBoosting = this.player.isBoosting;
      const targetGlow = isBoosting ? 1.5 : 0;
      
      this.playerState.boostGlow = Phaser.Math.Linear(
        this.playerState.boostGlow,
        targetGlow,
        0.2
      );
      
      this.boostLight.setIntensity(this.playerState.boostGlow);
      
      const mainLightIntensity = isBoosting ? 3.0 : 2.5;
      this.playerLight.setIntensity(
        Phaser.Math.Linear(
          this.playerLight.intensity,
          mainLightIntensity,
          0.1
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
    }
  };
};