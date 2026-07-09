import Phaser from "phaser";
import seedrandom from "seedrandom";
import { getChunkCoords, lerpFactorByDelta } from "../utils";
import { getSettings } from "../settings.js";
import { startAmbient, stopAmbient, updateEngine, stopEngine, playSfx } from "../audio.js";
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
import { CivilizationSystem } from "../systems/CivilizationSystem";
import { HazardSystem } from "../systems/HazardSystem";
import { SalvageSystem } from "../systems/SalvageSystem";

export const UniverseSceneFactory = (props) => {
  const { onHUDUpdate, onMinimapUpdate, onFullMapUpdate, onDiscovery, onCivContact } = props;

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
      this.onCivContact = onCivContact;
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
      this.civilizationSystem.renderVisible(this.chunkSystem.loadedChunks);

      // Space drone (fades in on the first user gesture if audio is locked)
      startAmbient();

      // Phaser fires 'shutdown' as an EVENT - a method merely named
      // shutdown() is never auto-called, so without this line none of the
      // scene's cleanup ever ran.
      this.events.once('shutdown', this.shutdown, this);
    }

    initSystems() {
      this.anomalySystem = new AnomalySystem(this);
      // ScanSystem must exist before ChunkSystem loads chunks: renderObject
      // consults it to re-attach cataloged markers on chunk regeneration.
      this.scanSystem = new ScanSystem(this);
      this.scanSystem.seedScanned((this.universe.discoveries || []).map((d) => d.id));
      this.chunkSystem = new ChunkSystem(this, this.anomalySystem);
      this.civilizationSystem = new CivilizationSystem(this);
      this.hazardSystem = new HazardSystem(this);
      this.salvageSystem = new SalvageSystem(this);
      this.minimapSystem = new MinimapSystem(this);
      this.fullMapSystem = new FullMapSystem(this);
      this.inputSystem = new InputSystem(this);
      this.hud = new HUD(this);

      this.anomalySystem.syncBackendAnomalies();
      this.civilizationSystem.sync();
    }

    createPlayer() {
      this.player = new PlayerObject(this, 0, 0, "Player");
      // Spawn grace: no anomaly forces or damage for the first few seconds,
      // so arriving in a hostile neighborhood never means instant pinball
      this.player.invulnerableUntil = this.time.now + 4000;

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

        // Camera shake + detonation audio
        if (getSettings().cameraShake) {
          this.cameras.main.shake(300, 0.008);
        }
        playSfx('explosion');

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

    /**
     * Hull reached zero (HazardSystem). Staged detonation - white-hot core
     * flash, dual shockwave rings, spinning debris shards, light flare -
     * then emergency recovery at the origin with an invulnerability window.
     */
    handleShipDestroyed() {
      if (this.respawning) return;
      this.respawning = true;

      const x = this.player.x;
      const y = this.player.y;

      playSfx('explosion');
      if (getSettings().cameraShake) {
        this.cameras.main.shake(500, 0.022);
      }
      this.cameras.main.flash(220, 255, 120, 60);

      this.player.setVisible(false);
      this.player.body.moves = false;
      this.player.setVelocity(0, 0);

      // 1. White-hot core flash
      const core = this.add.circle(x, y, 8, 0xffffff, 1)
        .setDepth(1999)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: core, scale: 7, alpha: 0,
        duration: 280, ease: 'Cubic.easeOut',
        onComplete: () => core.destroy(),
      });

      // 2. Dual shockwave rings, staggered
      [{ color: 0xf5cf7a, scale: 6, dur: 480, delay: 0 },
       { color: 0xe0524a, scale: 10, dur: 720, delay: 130 }].forEach((cfg) => {
        const ring = this.add.graphics({ x, y }).setDepth(1998);
        ring.lineStyle(3, cfg.color, 0.9);
        ring.strokeCircle(0, 0, 18);
        this.tweens.add({
          targets: ring, scaleX: cfg.scale, scaleY: cfg.scale, alpha: 0,
          duration: cfg.dur, delay: cfg.delay, ease: 'Cubic.easeOut',
          onComplete: () => ring.destroy(),
        });
      });

      // 3. Spinning debris shards
      const shardColors = [0xf5cf7a, 0xe0824a, 0x9497ad, 0xffffff];
      for (let i = 0; i < 14; i++) {
        const angle = (i / 14) * Math.PI * 2 + Math.random() * 0.5;
        const dist = 90 + Math.random() * 160;
        const shard = this.add.graphics({ x, y }).setDepth(1998);
        shard.fillStyle(shardColors[i % shardColors.length], 1);
        shard.fillRect(-3, -1.2, 6, 2.4);
        shard.rotation = Math.random() * Math.PI;
        this.tweens.add({
          targets: shard,
          x: x + Math.cos(angle) * dist,
          y: y + Math.sin(angle) * dist,
          rotation: shard.rotation + (Math.random() - 0.5) * 12,
          alpha: 0,
          scale: 0.3,
          duration: 650 + Math.random() * 350,
          ease: 'Cubic.easeOut',
          onComplete: () => shard.destroy(),
        });
      }

      // 4. Hot spark burst (additive, tight and fast)
      const sparks = this.add.particles(x, y, "Player", {
        speed: { min: 180, max: 420 },
        scale: { start: 0.02, end: 0 },
        lifespan: { min: 300, max: 700 },
        quantity: 26,
        angle: { min: 0, max: 360 },
        blendMode: "ADD",
        tint: [0xffe2b0, 0xe0824a, 0xffffff],
      });
      this.time.delayedCall(800, () => sparks.destroy());

      // 5. Light flare that decays with the fireball
      const flare = this.lights.addLight(x, y, 520, 0xffaa55, 3.5);
      const flareProxy = { i: 3.5 };
      this.tweens.add({
        targets: flareProxy, i: 0, duration: 750, ease: 'Cubic.easeOut',
        onUpdate: () => flare.setIntensity(flareProxy.i),
        onComplete: () => this.lights.removeLight(flare),
      });

      // 6. Notice, then recovery
      const notice = this.add.text(x, y - 70,
        'VESSEL DESTROYED\nEMERGENCY RECOVERY INITIATED', {
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: '14px',
          color: '#e0524a',
          align: 'center',
        }).setOrigin(0.5).setAlpha(0).setDepth(2000);
      this.tweens.add({ targets: notice, alpha: 1, y: y - 84, duration: 350, delay: 250 });

      this.time.delayedCall(1800, () => {
        notice.destroy();
        this.player.setPosition(0, 0);
        this.player.heal(100);
        this.player.setVisible(true);
        this.player.body.moves = true;
        this.player.invulnerableUntil = this.time.now + 4000;
        this.respawning = false;

        // Recovery ring imploding onto the ship + blink while invulnerable
        const arrival = this.add.graphics({ x: 0, y: 0 }).setDepth(1998);
        arrival.lineStyle(2, 0x4fd1a5, 0.9);
        arrival.strokeCircle(0, 0, 90);
        this.tweens.add({
          targets: arrival, scaleX: 0.1, scaleY: 0.1, alpha: 0,
          duration: 450, ease: 'Cubic.easeIn',
          onComplete: () => arrival.destroy(),
        });
        this.tweens.add({
          targets: this.player,
          alpha: { from: 0.35, to: 1 },
          duration: 250,
          yoyo: true,
          repeat: 7,
          onComplete: () => this.player.setAlpha(1),
        });
      });
    }

    update(time, delta) {
      this.inputSystem.handlePlayerMovement(this.player, delta);
      // Anomaly forces stack on top of the acceleration input just set
      this.hazardSystem.update(time);
      this.salvageSystem.update();
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

      // Velocity-reactive engine hum
      updateEngine(this.player.body.velocity.length() / 600, this.player.isBoosting || false);

      // Send HUD data to React
      if (this.onHUDUpdate) {
        this.onHUDUpdate(this.hud.getData());
      }

      this.checkChunkChange(time);

      this.anomalySystem.handleInteraction(
        this.player,
        this.chunkSystem.loadedChunks
      );
      this.civilizationSystem.handleInteraction(this.player);

      // Update minimap (now sends data to React)
      this.minimapSystem.update(
        this.player,
        this.currentChunk,
        this.chunkSystem.loadedChunks,
        this.anomalySystem.backendAnomalies,
        this.civilizationSystem.getMapMarkers(),
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
      if (this.cameraShakeIntensity > 0.0001 && getSettings().cameraShake) {
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
        this.civilizationSystem.renderVisible(this.chunkSystem.loadedChunks);
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
        this.civilizationSystem.getMapMarkers(),
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
      this.civilizationSystem.sync();
      this.civilizationSystem.renderVisible(this.chunkSystem.loadedChunks);
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
      this.inputSystem?.destroy();
      this.civilizationSystem?.destroy();
      stopEngine();
      stopAmbient();

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