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
  return class UniverseScene extends Phaser.Scene {
    constructor() {
      super({ key: "UniverseScene" });
      this.currentChunk = null;
      this.lastChunkCheck = 0;
      this.CHUNK_CHECK_INTERVAL = 150; // ms
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
        .setDrag(0.96)
        .setMaxVelocity(500)
        .setAngularDrag(0.95);

      // Physics properties for better control
      this.player.body.setMass(1);
      this.player.body.useDamping = true;

      // Movement state
      this.playerState = {
        boosting: false,
        drifting: false,
        velocity: { x: 0, y: 0 },
      };

      this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
      this.cameras.main.setZoom(1.5);
    }

    initLighting() {
      this.lights.enable().setAmbientColor(0x0a0a0a);
      this.playerLight = this.lights.addLight(0, 0, 250).setIntensity(2.5);
    }

    registerEvents() {
      this.scale.on("resize", this.handleResize, this);
    }

    update(time, delta) {
      this.inputSystem.handlePlayerMovement(this.player);
      this.updatePlayerRotation();
      this.applyBanking();
      this.updatePlayerThrusters();

      this.playerLight.setPosition(this.player.x, this.player.y);

      this.hud.update(this.player);
      this.checkChunkChange(time);

      this.anomalySystem.handleInteraction(
        this.player,
        this.chunkSystem.loadedChunks,
        this.inputSystem.fixKey,
      );

      this.handleMapToggle();

      this.minimapSystem.update(
        this.player,
        this.currentChunk,
        this.chunkSystem.loadedChunks,
        this.anomalySystem.backendAnomalies,
      );
    }
    updatePlayerRotation() {
      const body = this.player.body;
      if (!body) return;

      const vx = body.velocity.x;
      const vy = body.velocity.y;

      if (Math.abs(vx) < 5 && Math.abs(vy) < 5) return;

      const ASSET_ANGLE_OFFSET = 90;

      const targetAngle =
        Phaser.Math.RadToDeg(Math.atan2(vy, vx)) + ASSET_ANGLE_OFFSET;

      this.player.rotation = Phaser.Math.Angle.RotateTo(
        this.player.rotation,
        Phaser.Math.DegToRad(targetAngle),
        0.15,
      );
    }
    applyBanking() {
      const vx = this.player.body.velocity.x;
      const bank = Phaser.Math.Clamp(vx / 400, -0.3, 0.3);

      this.player.rotation += bank * 0.02;
    }

    updatePlayerThrusters() {
      const speed = this.player.body.velocity.length();

      const targetScale = speed > 50 ? 0.055 : 0.05;

      this.player.setScale(
        Phaser.Math.Linear(this.player.scaleX, targetScale, 0.1),
      );
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

    handleMapToggle() {
      if (!Phaser.Input.Keyboard.JustDown(this.inputSystem.mapKey)) return;
      this.fullMapSystem.toggle();
      this.renderFullMap();
    }

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
      this.updateUIPositions();
      if (this.fullMapSystem.showFullMap) {
        this.renderFullMap();
      }
    }

    updateUIPositions() {
      const { width: w, height: h } = this.scale;

      this.minimapSystem.updatePosition(w - MINIMAP_SIZE - 280, 160);

      this.hud.updatePositions(265, 300);
      this.inputSystem.updateArrowPositions?.(w, h);

      this.fullMapSystem.updatePosition(w / 2, 40, w / 2, h - 40);
    }

    updateFromUniverse(newUniverse) {
      this.universe = newUniverse;
      this.anomalySystem.syncBackendAnomalies();
      this.anomalySystem.renderBackendAnomalies(this.chunkSystem.loadedChunks);
    }
  };
};
