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
import { getLoadoutLocal } from "../loadoutStore.js";
import { HULL_STATS } from "../content/hullCatalog.js";

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
      // Ship hulls are procedurally drawn (TextureFactory), not loaded assets.
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
      const { hull, shipColor } = getLoadoutLocal();
      this.player = new PlayerObject(this, 0, 0, TextureFactory.hullKey(hull));
      this.player.applyLoadout(hull, shipColor);
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

        playSfx('explosion');
        // Cinematic containment-collapse burst (shake, shockwaves, spokes,
        // sparks, flare) - visual.color was captured at creation time, more
        // reliable than re-deriving it from anomaly.type here.
        this.anomalySystem.playResolutionEffect(x, y, visual.color, anomaly.severity ?? visual.severity);

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
    /**
     * Full ship-death cinematic: a beat of compression (implosion pulse +
     * camera punch-in) before the hull ruptures into a layered eruption
     * (core flash, three staggered plasma rings, shattered hull-plate
     * debris, a hot spark burst, a secondary ember shower that lingers,
     * and a drifting wreckage core) - then a warp-in recovery. Uses the
     * shared 'evtex:spark' texture (tintable dot) throughout; the ship
     * sprite is never used as a particle, which is what made the old
     * version read as tiny ships flying apart instead of an explosion.
     */
    handleShipDestroyed() {
      if (this.respawning) return;
      this.respawning = true;

      const x = this.player.x;
      const y = this.player.y;
      const baseZoom = this.cameras.main.zoom;

      this.player.body.moves = false;
      this.player.setVelocity(0, 0);

      // --- Stage 0: compression beat. The ship itself animates through
      // this (power-surge flicker, then collapses to nothing) instead of
      // freezing solid, and the eruption is triggered from THAT tween's
      // completion rather than an independent timer - one continuous
      // handoff instead of two animations racing to the same deadline.
      const implosion = this.add.graphics({ x, y }).setDepth(1998);
      implosion.lineStyle(2, 0xffffff, 0.85);
      implosion.strokeCircle(0, 0, 60);
      this.tweens.add({
        targets: implosion,
        scaleX: 0.08, scaleY: 0.08,
        alpha: { from: 0.85, to: 0.2 },
        duration: 190,
        ease: 'Cubic.easeIn',
        onComplete: () => implosion.destroy(),
      });
      this.tweens.add({
        targets: this.cameras.main,
        zoom: baseZoom * 0.97,
        duration: 190,
        ease: 'Cubic.easeIn',
      });

      this.tweens.add({
        targets: this.player,
        alpha: { from: 1, to: 0.2 },
        duration: 26,
        yoyo: true,
        repeat: 2,
        onComplete: () => {
          this.tweens.add({
            targets: this.player,
            alpha: 0,
            duration: 55,
            ease: 'Cubic.easeIn',
            onComplete: () => this.detonateShip(x, y, baseZoom),
          });
        },
      });
    }

    detonateShip(x, y, baseZoom) {
      playSfx('explosion');
      if (getSettings().cameraShake) {
        this.cameras.main.shake(550, 0.026);
      }
      this.cameras.main.flash(120, 255, 255, 255);
      this.time.delayedCall(80, () => this.cameras.main.flash(260, 255, 140, 70));

      // Punch the zoom back out past baseline, then settle - sells weight
      this.tweens.add({
        targets: this.cameras.main,
        zoom: baseZoom * 1.05,
        duration: 160,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          this.tweens.add({ targets: this.cameras.main, zoom: baseZoom, duration: 380, ease: 'Sine.easeInOut' });
        },
      });

      this.player.setVisible(false);

      // White-hot core flash
      const core = this.add.circle(x, y, 10, 0xffffff, 1)
        .setDepth(1999).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: core, scale: 9, alpha: 0,
        duration: 300, ease: 'Cubic.easeOut',
        onComplete: () => core.destroy(),
      });

      // Triple shockwave: white-hot -> amber -> deep red, staggered so the
      // burst reads as expanding rather than one flat pulse
      [{ color: 0xffffff, scale: 5, dur: 380, delay: 0, width: 3 },
       { color: 0xf5cf7a, scale: 8, dur: 560, delay: 90, width: 2.5 },
       { color: 0xe0524a, scale: 12, dur: 820, delay: 200, width: 2 }].forEach((cfg) => {
        const ring = this.add.graphics({ x, y }).setDepth(1998);
        ring.lineStyle(cfg.width, cfg.color, 0.9);
        ring.strokeCircle(0, 0, 20);
        this.tweens.add({
          targets: ring, scaleX: cfg.scale, scaleY: cfg.scale, alpha: 0,
          duration: cfg.dur, delay: cfg.delay, ease: 'Cubic.easeOut',
          onComplete: () => ring.destroy(),
        });
      });

      // Shattered hull-plate debris - irregular polygons, not rectangles,
      // tumbling outward with rotational overshoot for weight
      const shardColors = [0xf5cf7a, 0xe0824a, 0x9497ad, 0xffffff, 0x8b7bd8];
      for (let i = 0; i < 20; i++) {
        const angle = (i / 20) * Math.PI * 2 + Math.random() * 0.4;
        const dist = 100 + Math.random() * 220;
        const s = 3 + Math.random() * 4;
        const shard = this.add.graphics({ x, y }).setDepth(1998);
        shard.fillStyle(shardColors[i % shardColors.length], 1);
        shard.fillPoints([
          { x: -s, y: -s * 0.5 }, { x: s * 0.6, y: -s }, { x: s, y: s * 0.4 }, { x: -s * 0.3, y: s },
        ], true);
        shard.rotation = Math.random() * Math.PI;
        this.tweens.add({
          targets: shard,
          x: x + Math.cos(angle) * dist,
          y: y + Math.sin(angle) * dist,
          rotation: shard.rotation + (Math.random() - 0.5) * 14,
          alpha: 0,
          scale: 0.25,
          duration: 700 + Math.random() * 450,
          ease: 'Cubic.easeOut',
          onComplete: () => shard.destroy(),
        });
      }

      // Hot spark burst - tight, fast, additive
      const sparks = this.add.particles(x, y, "evtex:spark", {
        speed: { min: 200, max: 460 },
        scale: { start: 0.55, end: 0 },
        lifespan: { min: 300, max: 750 },
        quantity: 34,
        angle: { min: 0, max: 360 },
        blendMode: "ADD",
        tint: [0xffe2b0, 0xe0824a, 0xffffff],
      });
      this.time.delayedCall(850, () => sparks.destroy());

      // Secondary ember shower - slower, drifts with gravity, lingers
      // longer than the initial burst for a smoldering-wreckage feel
      this.time.delayedCall(180, () => {
        const embers = this.add.particles(x, y, "evtex:spark", {
          speed: { min: 30, max: 110 },
          scale: { start: 0.3, end: 0 },
          lifespan: { min: 900, max: 1600 },
          quantity: 16,
          angle: { min: 0, max: 360 },
          gravityY: 40,
          blendMode: "ADD",
          tint: [0xe0824a, 0xffe2b0],
        });
        this.time.delayedCall(1700, () => embers.destroy());
      });

      // Light flare that decays with the fireball
      const flare = this.lights.addLight(x, y, 560, 0xffaa55, 4);
      const flareProxy = { i: 4 };
      this.tweens.add({
        targets: flareProxy, i: 0, duration: 800, ease: 'Cubic.easeOut',
        onUpdate: () => flare.setIntensity(flareProxy.i),
        onComplete: () => this.lights.removeLight(flare),
      });

      // Drifting wreckage ember - a small dim glow that lingers and slowly
      // fades, so the moment reads as "something was destroyed here" rather
      // than an instant clean reset
      const wreckDrift = { x: 0, y: 0 };
      const wreck = this.add.circle(x, y, 4, 0xe0824a, 0.9).setDepth(1997).setBlendMode(Phaser.BlendModes.ADD);
      const wreckLight = this.lights.addLight(x, y, 90, 0xe0824a, 1.2);
      this.tweens.add({
        targets: wreckDrift,
        x: (Math.random() - 0.5) * 140,
        y: (Math.random() - 0.5) * 140,
        duration: 1600,
        ease: 'Sine.easeOut',
        onUpdate: () => {
          wreck.setPosition(x + wreckDrift.x, y + wreckDrift.y);
          wreckLight.setPosition(x + wreckDrift.x, y + wreckDrift.y);
        },
      });
      this.tweens.add({
        targets: [wreck], alpha: 0, duration: 1600, delay: 200, ease: 'Cubic.easeIn',
        onComplete: () => { wreck.destroy(); this.lights.removeLight(wreckLight); },
      });

      // Notice, then recovery
      const notice = this.add.text(x, y - 70,
        'VESSEL DESTROYED\nEMERGENCY RECOVERY INITIATED', {
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: '14px',
          color: '#e0524a',
          align: 'center',
        }).setOrigin(0.5).setAlpha(0).setDepth(2000);
      this.tweens.add({ targets: notice, alpha: 1, y: y - 84, duration: 350, delay: 300 });

      this.time.delayedCall(2000, () => {
        notice.destroy();
        this.player.setPosition(0, 0);
        this.player.heal(100);
        this.player.setVisible(true);
        this.player.body.moves = true;
        this.player.invulnerableUntil = this.time.now + 4000;
        this.respawning = false;

        // Recovery ring imploding onto the ship + arrival flash + blink
        const arrival = this.add.graphics({ x: 0, y: 0 }).setDepth(1998);
        arrival.lineStyle(2, 0x4fd1a5, 0.9);
        arrival.strokeCircle(0, 0, 90);
        this.tweens.add({
          targets: arrival, scaleX: 0.1, scaleY: 0.1, alpha: 0,
          duration: 450, ease: 'Cubic.easeIn',
          onComplete: () => arrival.destroy(),
        });
        const arrivalFlash = this.add.circle(0, 0, 4, 0x4fd1a5, 1).setDepth(1999).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({
          targets: arrivalFlash, scale: 12, alpha: 0, duration: 350, ease: 'Cubic.easeOut',
          onComplete: () => arrivalFlash.destroy(),
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
      // Poll the loadout store: Hangar saves (from any panel, any tab
      // state) apply on the next frame with no cross-boundary wiring
      const lo = getLoadoutLocal();
      if (this.player.hullId !== lo.hull || this.player.loadoutColor !== lo.shipColor) {
        this.player.applyLoadout(lo.hull, lo.shipColor);
      }

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

      // Kept in sync with PlayerObject's constructor scale (0.105) - see
      // its comment for why 256px hull canvases land here.
      const baseScale = 0.105;
      const speedScale = speed > 50 ? 0.115 : baseScale;
      const boostScale = isBoosting ? 0.13 : speedScale;

      const s = Phaser.Math.Linear(this.player.scaleX, boostScale, lerpFactorByDelta(0.15, delta));

      // Relativistic hulls (Tachyon) visibly length-contract along their
      // axis of motion as v approaches "game-c": the real Lorentz factor,
      // scaleY = s * sqrt(1 - v²/c²). At its boosted top speed the needle
      // squashes to ~60% length - physics as a cosmetic flex.
      const hullStats = HULL_STATS[this.player.hullId] || {};
      let sy = s;
      if (hullStats.relativistic) {
        const C_GAME = 1900; // just above the fastest achievable speed
        const beta = Math.min(0.95, speed / C_GAME);
        sy = s * Math.sqrt(1 - beta * beta);
      }
      this.player.setScale(s, sy);

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