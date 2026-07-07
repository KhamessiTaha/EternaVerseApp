import Phaser from 'phaser';
import { ANOMALY_TYPE_MAP } from '../constants';
import { getChunkCoords, getChunkKey } from '../utils';

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
    const ringAlpha = isBackend ? 0.95 : 0.6;
    const coreAlpha = isBackend ? 0.9 : 0.55;
    const glowAlpha = isBackend ? 0.22 : 0.12;
    const lineWidth = isBackend ? 1.5 : 1;
    const tickLength = radius * 0.35;

    // Reticle-style marker (hollow ring + cardinal ticks + small pulsing
    // core) instead of a solid glowing orb - reads as an instrument contact,
    // not a video-game pickup.
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
    entity.fillCircle(0, 0, radius * 0.22);

    // Soft glow
    const glow = this.scene.add.graphics({ x, y })
      .fillStyle(typeObj.color, glowAlpha)
      .fillCircle(0, 0, radius * 1.6)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(9);

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
      targets: glow,
      scaleX: { from: 1, to: 1.25 },
      scaleY: { from: 1, to: 1.25 },
      alpha: { from: 0.5, to: 0.85 },
      duration: 1800 + severity * 200,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // Light source
    const baseIntensity = isBackend ? 1.1 : 0.7;
    const light = this.scene.lights.addLight(x, y, radius * 10, typeObj.color, baseIntensity);
    const lightProxy = { i: baseIntensity };

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

    // Interaction label - instrument tag, monospace, no solid neon-on-black box
    const hexColor = `#${typeObj.color.toString(16).padStart(6, "0")}`;
    const labelText = isBackend
      ? `${typeObj.label}\nSEV ${severity} · [F] RESOLVE`
      : `${typeObj.label}\n[F] RESOLVE`;

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
      severity, radius,
      entity, glow, light, lightProxy,
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
    if (anomaly.entity) {
      this.scene.tweens.getTweensOf(anomaly.entity).forEach(tween => tween.stop());
    }
    if (anomaly.glow) {
      this.scene.tweens.getTweensOf(anomaly.glow).forEach(tween => tween.stop());
    }
    if (anomaly.lightProxy) {
      // Stop tweens targeting the light proxy
      this.scene.tweens.getTweensOf(anomaly.lightProxy).forEach(tween => tween.stop());
    }
    
    // Destroy graphics objects
    anomaly.entity?.destroy();
    anomaly.glow?.destroy();
    if (anomaly.light) this.scene.lights.removeLight(anomaly.light);
    anomaly.interactionText?.destroy();
  }

  handleInteraction(player, loadedChunks) {
    let nearest = null;
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
        nearest = anom;
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

    // Visual feedback
    this.scene.cameras.main.shake(200, 0.005);

    const particleBurst = this.scene.add.particles(anomaly.x, anomaly.y, "Player", {
      speed: { min: 50, max: 150 },
      scale: { start: 0.02, end: 0 },
      lifespan: 800,
      quantity: 20,
      blendMode: "ADD"
    });

    this.scene.time.delayedCall(800, () => particleBurst.destroy());
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
}