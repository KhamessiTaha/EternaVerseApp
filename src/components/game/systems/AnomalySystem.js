import Phaser from 'phaser';
import { ANOMALY_TYPE_MAP } from '../constants';
import { getChunkCoords, getChunkKey } from '../utils';
import { getSettings } from '../settings.js';
import { dangerRadius } from './HazardSystem.js';

export class AnomalySystem {
  constructor(scene) {
    this.scene = scene;
    this.discoveredAnomalies = new Set();
    this.resolvedAnomalies = new Set();
    this.backendAnomalies = new Map();
  }

  syncBackendAnomalies() {
    if (!this.scene.universe?.anomalies) return;

    const activeBackendAnomalies = this.scene.universe.anomalies.filter(a => !a.resolved);
    const activeIds = new Set(activeBackendAnomalies.map(a => a.id));

    // Add or update backend anomalies
    for (const backendAnomaly of activeBackendAnomalies) {
      if (!this.backendAnomalies.has(backendAnomaly.id)) {
        this.backendAnomalies.set(backendAnomaly.id, {
          ...backendAnomaly,
          visual: null
        });
        
        if (!this.discoveredAnomalies.has(backendAnomaly.id)) {
          this.discoveredAnomalies.add(backendAnomaly.id);
          this.scene.setStats?.((prev) => ({ 
            ...prev, 
            discovered: (prev.discovered || 0) + 1 
          }));
        }
      }
    }

    // Remove resolved backend anomalies
    for (const [id, anomaly] of this.backendAnomalies.entries()) {
      if (!activeIds.has(id)) {
        if (anomaly.visual) {
          this.destroyAnomalyVisual(anomaly.visual);
        }
        this.backendAnomalies.delete(id);
        this.resolvedAnomalies.add(id);
      }
    }
  }

  renderBackendAnomalies(loadedChunks) {
    for (const [id, backendAnomaly] of this.backendAnomalies.entries()) {
      if (backendAnomaly.visual || this.resolvedAnomalies.has(id)) continue;

      const x = backendAnomaly.location?.x || 0;
      const y = backendAnomaly.location?.y || 0;
      const chunk = getChunkCoords(x, y);
      const isLoaded = loadedChunks.has(getChunkKey(chunk.chunkX, chunk.chunkY));

      if (isLoaded) {
        const typeConfig = ANOMALY_TYPE_MAP[backendAnomaly.type] || ANOMALY_TYPE_MAP.quantumFluctuation;
        backendAnomaly.visual = this.createAnomaly(
          x, y, typeConfig, backendAnomaly.severity, backendAnomaly.id, true
        );
      }
    }
  }

  createAnomaly(x, y, typeObj, severity, id, isBackend = false) {
    const radius = typeObj.baseRadius + severity * 2;
    const ringAlpha = isBackend ? 0.95 : 0.65;
    const coreAlpha = isBackend ? 0.96 : 0.68;
    const glowAlpha = isBackend ? 0.24 : 0.16;
    const lineWidth = isBackend ? 1.75 : 1.2;
    const tickLength = radius * 0.33;

    // Soft halo + ambient bloom for the anomaly. This is the main visual
    // signature players will track through the world.
    const isLowQuality = this.scene.graphicsQualityLow;
    const halo = this.scene.add.graphics({ x, y })
      .fillStyle(typeObj.color, glowAlpha)
      .fillCircle(0, 0, radius * 2.3)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(8);

    const pulse = this.scene.add.graphics({ x, y })
      .lineStyle(2, typeObj.color, ringAlpha * 0.9)
      .strokeCircle(0, 0, radius * 1.4)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(9);

    const accent = isLowQuality ? null : this.scene.add.graphics({ x, y })
      .lineStyle(1.2, 0xffffff, ringAlpha * 0.14)
      .strokeEllipse(0, 0, radius * 1.18, radius * 0.72)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(8);

    const entity = this.scene.add.graphics({ x, y }).setDepth(10);
    entity.lineStyle(lineWidth, typeObj.color, ringAlpha);
    entity.strokeCircle(0, 0, radius);
    [0, 90, 180, 270].forEach((deg) => {
      const rad = Phaser.Math.DegToRad(deg);
      const inner = radius + 2;
      const outer = inner + tickLength;
      entity.lineBetween(
        Math.cos(rad) * inner, Math.sin(rad) * inner,
        Math.cos(rad) * outer, Math.sin(rad) * outer
      );
    });
    entity.fillStyle(typeObj.color, coreAlpha);
    entity.fillCircle(0, 0, radius * 0.26);

    // Danger ring: hull damage inside this radius (HazardSystem) - faint,
    // but a player who's been burned once learns to read it.
    const danger = this.scene.add.graphics({ x, y })
      .lineStyle(1, 0xe0524a, isBackend ? 0.32 : 0.26)
      .strokeCircle(0, 0, dangerRadius(severity))
      .setDepth(7);

    // Pulsing animation - whole reticle breathes, glow breathes on its own cadence
    this.scene.tweens.add({
      targets: entity,
      scaleX: { from: 0.94, to: 1.08 },
      scaleY: { from: 0.94, to: 1.08 },
      alpha: { from: 0.85, to: 1 },
      duration: 1500 + severity * 200,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    this.scene.tweens.add({
      targets: pulse,
      scaleX: { from: 1, to: 1.45 },
      scaleY: { from: 1, to: 1.45 },
      alpha: { from: 0.65, to: 0.1 },
      duration: 1400 + severity * 150,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    if (accent) {
      this.scene.tweens.add({
        targets: accent,
        rotation: Math.PI * 2,
        duration: 6800 + severity * 220,
        repeat: -1,
        ease: "Linear",
      });
    }

    this.scene.tweens.add({
      targets: halo,
      scaleX: { from: 0.95, to: 1.1 },
      scaleY: { from: 0.95, to: 1.1 },
      alpha: { from: glowAlpha * 1.15, to: glowAlpha * 0.75 },
      duration: 1900 + severity * 170,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // Light source
    const baseIntensity = isBackend ? 1.3 : 0.8;
    const light = isLowQuality ? null : this.scene.lights.addLight(x, y, radius * 12, typeObj.color, baseIntensity);
    const lightProxy = light ? { i: baseIntensity } : null;

    if (lightProxy) {
      this.scene.tweens.add({
        targets: lightProxy,
        i: { from: baseIntensity, to: baseIntensity * 1.6 },
        duration: 2000 + severity * 300,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
        onUpdate: () => {
          if (light?.setIntensity) light.setIntensity(lightProxy.i);
        },
      });
    }

    // Interaction label - instrument tag, monospace, no solid neon-on-black box
    const hexColor = `#${typeObj.color.toString(16).padStart(6, "0")}`;
    // The tier IS the fiction: CRITICAL anomalies are physics-engine events
    // with real consequences; MINOR ones are ambient field turbulence -
    // smaller but still real rewards
    const labelText = isBackend
      ? `${typeObj.label}\nCRITICAL · SEV ${severity} · [F] RESOLVE`
      : `${typeObj.label}\nMINOR · [F] RESOLVE`;

    const interactionText = this.scene.add
      .text(x, y - radius - 26, labelText, {
        fontFamily: '"IBM Plex Mono", monospace',
        fontSize: "11px",
        color: hexColor,
        align: "center",
        backgroundColor: "#0c0f1c",
        padding: { x: 8, y: 5 },
      })
      .setOrigin(0.5)
      .setDepth(1000)
      .setVisible(false);

    return {
      id, x, y,
      type: typeObj.type,
      category: typeObj.category,
      color: typeObj.color,
      severity, radius,
      entity, pulse, halo, accent, danger, light, lightProxy,
      interactionText,
      inRange: false,
      resolved: false,
      isBackend,
    };
  }

  /**
   * Locate a procedural anomaly's visual object by id across loaded chunks.
   * Procedural anomalies live directly inside chunk.anomalies[] (no separate
   * id-indexed map the way backend anomalies have), so this is a linear scan.
   */
  findProceduralAnomaly(id, loadedChunks) {
    if (!loadedChunks) return null;
    for (const chunk of loadedChunks.values()) {
      const found = chunk.anomalies.find((a) => a.id === id);
      if (found) return found;
    }
    return null;
  }

  destroyAnomalyVisual(anomaly) {
    // Stop all tweens targeting this anomaly's graphics
    [anomaly.entity, anomaly.pulse, anomaly.halo, anomaly.accent, anomaly.danger, anomaly.lightProxy].forEach((target) => {
      if (target) {
        this.scene.tweens.getTweensOf(target).forEach((tween) => tween.stop());
      }
    });

    // Destroy graphics objects and cleanup lights
    anomaly.entity?.destroy();
    anomaly.pulse?.destroy();
    anomaly.halo?.destroy();
    anomaly.accent?.destroy();
    anomaly.danger?.destroy();
    if (anomaly.light) this.scene.lights.removeLight(anomaly.light);
    anomaly.interactionText?.destroy();
  }

  handleInteraction(player, loadedChunks) {
    let minDist = Infinity;

    const checkAnomaly = (anom) => {
      if (anom.resolved) return;

      const dist = Phaser.Math.Distance.Between(
        anom.x, anom.y, player.x, player.y
      );
      const interactionRange = anom.radius * 5;

      anom.inRange = dist < interactionRange;
      anom.interactionText?.setVisible(anom.inRange);

      if (anom.inRange && dist < minDist) {
        minDist = dist;
      }
    };

    // Check procedural anomalies
    loadedChunks.forEach((chunk) => {
      chunk.anomalies.forEach(checkAnomaly);
    });

    // Check backend anomalies
    this.backendAnomalies.forEach((backendAnomaly) => {
      if (backendAnomaly.visual) {
        checkAnomaly(backendAnomaly.visual);
      }
    });

    // F key handling moved to InputSystem for minigame triggering
  }

  resolveAnomaly(anomaly) {
    anomaly.resolved = true;
    this.resolvedAnomalies.add(anomaly.id);

    this.playResolutionEffect(anomaly.x, anomaly.y, anomaly.color, anomaly.severity);
    this.destroyAnomalyVisual(anomaly);

    // Update stats
    this.scene.setStats?.((prev) => ({
      ...prev,
      resolved: (prev.resolved || 0) + 1,
    }));

    // Notify parent component
    if (this.scene.onAnomalyResolved) {
      this.scene.onAnomalyResolved({
        id: anomaly.id,
        type: anomaly.type,
        severity: anomaly.severity,
        location: { x: anomaly.x, y: anomaly.y },
        isBackend: anomaly.isBackend
      });
    }
  }

  /**
   * Cinematic containment-collapse sequence for a resolved anomaly: the
   * reticle snaps inward (containment closing) then releases as a colored
   * shockwave/spoke/spark burst with a decaying light flare. Shared by the
   * live minigame-completion path (UniverseScene.playAnomalyDestructionEffect)
   * and this class's own resolveAnomaly. Uses the shared 'evtex:spark'
   * texture (a soft tintable dot) rather than the ship sprite, which is
   * what made earlier explosions read as tiny ships flying apart.
   */
  playResolutionEffect(x, y, color = 0xdfa73f, severity = 1) {
    const scene = this.scene;
    const sev = Math.max(1, Math.min(5, severity || 1));

    if (getSettings().cameraShake) {
      scene.cameras.main.shake(180 + sev * 40, 0.004 + sev * 0.0015);
    }
    if (sev >= 4) {
      const r = (color >> 16) & 255, g = (color >> 8) & 255, b = color & 255;
      scene.cameras.main.flash(160, r, g, b, false);
    }

    // Containment collapse: the reticle's ring snaps inward before releasing
    const collapse = scene.add.graphics({ x, y }).setDepth(1500);
    collapse.lineStyle(2, color, 0.9);
    collapse.strokeCircle(0, 0, 70 + sev * 14);
    scene.tweens.add({
      targets: collapse,
      scaleX: 0.05, scaleY: 0.05,
      alpha: { from: 0.9, to: 0.3 },
      duration: 200,
      ease: "Cubic.easeIn",
      onComplete: () => {
        collapse.destroy();
        this._burstResolution(x, y, color, sev);
      },
    });
  }

  _burstResolution(x, y, color, sev) {
    const scene = this.scene;

    // White-hot core flash
    const core = scene.add.circle(x, y, 6 + sev, 0xffffff, 1)
      .setDepth(1502).setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({
      targets: core, scale: 5 + sev, alpha: 0,
      duration: 260, ease: "Cubic.easeOut",
      onComplete: () => core.destroy(),
    });

    // Dual shockwave rings - the anomaly's own color, then a brighter
    // white-hot rim just behind it
    [{ tint: color, scale: 4 + sev * 0.6, dur: 420, delay: 0 },
     { tint: 0xffffff, scale: 6 + sev * 0.8, dur: 620, delay: 90 }].forEach((cfg) => {
      const ring = scene.add.graphics({ x, y }).setDepth(1501);
      ring.lineStyle(2, cfg.tint, 0.85);
      ring.strokeCircle(0, 0, 14 + sev * 2);
      scene.tweens.add({
        targets: ring, scaleX: cfg.scale, scaleY: cfg.scale, alpha: 0,
        duration: cfg.dur, delay: cfg.delay, ease: "Cubic.easeOut",
        onComplete: () => ring.destroy(),
      });
    });

    // Radial energy spokes: pre-drawn full-length streaks scaled up from
    // the origin, reading as energy release rather than solid debris
    const spokeCount = 6 + sev * 2;
    for (let i = 0; i < spokeCount; i++) {
      const angle = (i / spokeCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      const len = 50 + sev * 14 + Math.random() * 26;
      const spoke = scene.add.graphics({ x, y })
        .setDepth(1500).setBlendMode(Phaser.BlendModes.ADD).setScale(0.15);
      spoke.lineStyle(2.5, i % 2 === 0 ? color : 0xffffff, 0.85);
      spoke.lineBetween(0, 0, Math.cos(angle) * len, Math.sin(angle) * len);
      scene.tweens.add({
        targets: spoke,
        scaleX: 1, scaleY: 1,
        alpha: { from: 0.9, to: 0 },
        duration: 380 + Math.random() * 220,
        ease: "Cubic.easeOut",
        onComplete: () => spoke.destroy(),
      });
    }

    // Spark particles - tintable soft dots, not the ship sprite
    const sparks = scene.add.particles(x, y, "evtex:spark", {
      speed: { min: 60 + sev * 20, max: 200 + sev * 40 },
      scale: { start: 0.45 + sev * 0.05, end: 0 },
      lifespan: { min: 400, max: 900 },
      quantity: 18 + sev * 6,
      angle: { min: 0, max: 360 },
      blendMode: "ADD",
      tint: [color, 0xffffff],
    });
    scene.time.delayedCall(1000, () => sparks.destroy());

    // Decaying light flare
    const flare = scene.lights.addLight(x, y, 260 + sev * 40, color, 2.5 + sev * 0.4);
    const proxy = { i: flare.intensity };
    scene.tweens.add({
      targets: proxy, i: 0, duration: 500 + sev * 60, ease: "Cubic.easeOut",
      onUpdate: () => flare.setIntensity(proxy.i),
      onComplete: () => scene.lights.removeLight(flare),
    });
  }
}