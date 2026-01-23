import Phaser from 'phaser';
import seedrandom from 'seedrandom';
import { getChunkCoords } from '../utils';
import { ChunkSystem } from '../systems/ChunkSystem';
import { AnomalySystem } from '../systems/AnomalySystem';
import { MinimapSystem } from '../systems/MinimapSystem';
import { FullMapSystem } from '../systems/FullMapSystem';
import { InputSystem } from '../systems/InputSystem';
import { HUD } from '../systems/HUD';
import { MINIMAP_SIZE } from '../constants';

export const UniverseSceneFactory = (props) => {
  return class UniverseScene extends Phaser.Scene {
    constructor() {
      super({ key: "UniverseScene" });
      this.currentChunk = null;
    }

    init(data) {
      this.universe = data.universe;
      this.onAnomalyResolved = data.onAnomalyResolved;
      this.setStats = data.setStats;
      this.rng = seedrandom(this.universe.seed ?? "default");
      
      // Initialize systems
      this.anomalySystem = new AnomalySystem(this);
      this.chunkSystem = new ChunkSystem(this, this.anomalySystem);
      this.minimapSystem = new MinimapSystem(this);
      this.fullMapSystem = new FullMapSystem(this);
      this.inputSystem = new InputSystem(this);
      this.hud = new HUD(this);
      
      this.anomalySystem.syncBackendAnomalies();
    }

    preload() {
      this.load.image("Player", "/assets/Player.png");
    }

    create() {
      // Player setup
      this.player = this.physics.add
        .sprite(0, 0, "Player")
        .setScale(0.05)
        .setDamping(true)
        .setDrag(0.98)
        .setMaxVelocity(400);

      this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
      this.cameras.main.setZoom(1.5);

      // Lighting system
      this.lights.enable().setAmbientColor(0x0a0a0a);
      this.playerLight = this.lights.addLight(0, 0, 250).setIntensity(2.5);

      // Initial chunk loading
      this.currentChunk = getChunkCoords(this.player.x, this.player.y);
      this.chunkSystem.loadNearbyChunks(this.currentChunk.chunkX, this.currentChunk.chunkY);

      // Update UI positions
      this.updateUIPositions();

      // Event handlers
      this.scale.on("resize", this.handleResize, this);
      
      this.fullMapSystem.render(
        this.player, 
        this.currentChunk, 
        this.chunkSystem.loadedChunks, 
        this.anomalySystem.backendAnomalies, 
        this.anomalySystem.resolvedAnomalies
      );
      this.anomalySystem.renderBackendAnomalies(this.chunkSystem.loadedChunks);
    }

    handleResize() {
      this.updateUIPositions();
      if (this.fullMapSystem.showFullMap) {
        this.fullMapSystem.render(
          this.player, 
          this.currentChunk, 
          this.chunkSystem.loadedChunks, 
          this.anomalySystem.backendAnomalies, 
          this.anomalySystem.resolvedAnomalies
        );
      }
    }

    update(time, delta) {
      this.inputSystem.handlePlayerMovement(this.player);
      this.updatePlayerLight();
      this.hud.update(this.player);
      this.checkChunkChange();
      this.anomalySystem.handleInteraction(this.player, this.chunkSystem.loadedChunks, this.inputSystem.fixKey);
      this.handleMapToggle();
      this.minimapSystem.update(
        this.player, 
        this.currentChunk, 
        this.chunkSystem.loadedChunks, 
        this.anomalySystem.backendAnomalies
      );
    }

    updatePlayerLight() {
      this.playerLight.setPosition(this.player.x, this.player.y);
    }

    checkChunkChange() {
      const newChunk = getChunkCoords(this.player.x, this.player.y);
      if (newChunk.chunkX !== this.currentChunk.chunkX || 
          newChunk.chunkY !== this.currentChunk.chunkY) {
        this.currentChunk = newChunk;
        this.chunkSystem.loadNearbyChunks(newChunk.chunkX, newChunk.chunkY);
        this.anomalySystem.renderBackendAnomalies(this.chunkSystem.loadedChunks);
      }
    }

    handleMapToggle() {
      if (Phaser.Input.Keyboard.JustDown(this.inputSystem.mapKey)) {
        this.fullMapSystem.toggle();
        this.fullMapSystem.render(
          this.player, 
          this.currentChunk, 
          this.chunkSystem.loadedChunks, 
          this.anomalySystem.backendAnomalies, 
          this.anomalySystem.resolvedAnomalies
        );
      }
    }

    updateUIPositions() {
      const w = this.scale.width;
      const h = this.scale.height;

      const minimapX = w - MINIMAP_SIZE - 280;
      const minimapY = 160;
      this.minimapSystem.updatePosition(minimapX, minimapY);

      const hudLeftMargin = 265;
      const hudTopMargin = 300;
      this.hud.updatePositions(hudLeftMargin, hudTopMargin);

      if (this.inputSystem.arrowUp) {
        const arrowCenterX = 340;
        const arrowBottomY = h - 200;
        
        this.inputSystem.arrowUp.setPosition(arrowCenterX, arrowBottomY - 80);
        this.inputSystem.arrowDown.setPosition(arrowCenterX, arrowBottomY);
        this.inputSystem.arrowLeft.setPosition(arrowCenterX - 50, arrowBottomY - 40);
        this.inputSystem.arrowRight.setPosition(arrowCenterX + 50, arrowBottomY - 40);
      }

      this.fullMapSystem.updatePosition(w / 2, 40, w / 2, h - 40);
    }

    updateFromUniverse(newUniverse) {
      this.universe = newUniverse;
      this.anomalySystem.syncBackendAnomalies();
      this.anomalySystem.renderBackendAnomalies(this.chunkSystem.loadedChunks);
    }
  };
};