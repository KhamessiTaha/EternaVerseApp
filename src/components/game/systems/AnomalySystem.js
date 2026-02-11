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
    const alpha = isBackend ? 0.9 : 0.7;
    const glowAlpha = isBackend ? 0.35 : 0.25;

    // Core entity
    const entity = this.scene.add.graphics({ x, y })
      .fillStyle(typeObj.color, alpha)
      .fillCircle(0, 0, radius)
      .lineStyle(2, typeObj.color, 1)
      .strokeCircle(0, 0, radius)
      .setDepth(10);

    // Glow effect
    const glow = this.scene.add.graphics({ x, y })
      .fillStyle(typeObj.color, glowAlpha)
      .fillCircle(0, 0, radius * 1.8)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(9);

    // Pulsing animation
    this.scene.tweens.add({
      targets: glow,
      scaleX: { from: 1, to: 1.3 },
      scaleY: { from: 1, to: 1.3 },
      alpha: { from: 0.5, to: 0.8 },
      duration: 1500 + severity * 200,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // Light source
    const light = this.scene.lights.addLight(x, y, radius * 12, typeObj.color, 1.2);
    const lightProxy = { i: 1.2 };
    
    this.scene.tweens.add({
      targets: lightProxy,
      i: { from: 1.2, to: 2.0 },
      duration: 2000 + severity * 300,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
      onUpdate: () => {
        if (light?.setIntensity) light.setIntensity(lightProxy.i);
      },
    });

    // Interaction text
    const labelText = isBackend 
      ? `[⚡ ${typeObj.label}]\nSEV: ${severity} | PRESS F`
      : `[${typeObj.label}]\nPRESS F TO RESOLVE`;

    const interactionText = this.scene.add
      .text(x, y - radius - 25, labelText, {
        font: "bold 11px Courier",
        fill: isBackend ? "#ffff00" : "#00ff00",
        backgroundColor: "#000000",
        padding: { x: 6, y: 3 },
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(1000)
      .setVisible(false);

    return {
      id, x, y,
      type: typeObj.type,
      severity, radius,
      entity, glow, light,
      interactionText,
      inRange: false,
      resolved: false,
      isBackend,
    };
  }

  destroyAnomalyVisual(anomaly) {
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