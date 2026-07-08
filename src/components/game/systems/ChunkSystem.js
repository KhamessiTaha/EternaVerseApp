import Phaser from 'phaser';
import seedrandom from 'seedrandom';
import { CHUNK_SIZE, ANOMALY_SPAWN_CHANCE, ANOMALIES_PER_CHUNK, ANOMALY_TYPES } from '../constants';
import { getChunkKey } from '../utils';
import { generateChunkObjects } from '../world/objectGenerator.js';

export class ChunkSystem {
  constructor(scene, anomalySystem) {
    this.scene = scene;
    this.anomalySystem = anomalySystem;
    this.loadedChunks = new Map();
    this.activeChunkRadius = 2;
  }

  loadNearbyChunks(centerX, centerY) {
    const newChunks = new Map();
    const radius = this.activeChunkRadius;

    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        const chunkX = centerX + dx;
        const chunkY = centerY + dy;
        const key = getChunkKey(chunkX, chunkY);

        if (!this.loadedChunks.has(key)) {
          newChunks.set(key, this.generateChunk(chunkX, chunkY));
        } else {
          newChunks.set(key, this.loadedChunks.get(key));
        }
      }
    }

    // Cleanup far chunks
    this.loadedChunks.forEach((chunk, key) => {
      if (!newChunks.has(key)) {
        this.cleanupChunk(chunk);
      }
    });

    this.loadedChunks = newChunks;
  }

  generateChunk(chunkX, chunkY) {
    const chunk = { objects: [], anomalies: [] };
    const seed = this.scene.universe.seed ?? "seed";

    for (const descriptor of generateChunkObjects(seed, chunkX, chunkY)) {
      chunk.objects.push(this.renderObject(descriptor));
    }

    // Procedural anomalies (unchanged behavior)
    const chunkSeed = seed + getChunkKey(chunkX, chunkY);
    const rng = seedrandom(chunkSeed);
    if (rng() < ANOMALY_SPAWN_CHANCE) {
      this.generateProceduralAnomalies(chunk, chunkX, chunkY, rng);
    }

    return chunk;
  }

  renderObject(descriptor) {
    const isNebula = descriptor.category === "nebula";
    const isPhenomenon = descriptor.category === "phenomenon";

    const image = this.scene.add.image(
      descriptor.x, descriptor.y,
      this.scene.textureFactory.keyFor(descriptor)
    )
      .setScale(descriptor.scale)
      .setRotation(descriptor.rotation)
      .setAlpha(descriptor.alpha)
      .setDepth(isNebula ? -3 : -1);

    if (isNebula || descriptor.objectClass === "quasar") {
      image.setBlendMode(Phaser.BlendModes.ADD);
    }

    if (descriptor.objectClass === "quasar") {
      this.scene.tweens.add({
        targets: image,
        alpha: { from: 0.75, to: 1 },
        scaleX: { from: descriptor.scale * 0.96, to: descriptor.scale * 1.06 },
        scaleY: { from: descriptor.scale * 0.96, to: descriptor.scale * 1.06 },
        duration: 1400, yoyo: true, repeat: -1, ease: "Sine.easeInOut",
      });
    }

    // Point lights for the larger structures only (perf budget).
    // NOTE: the old implementation leaked these lights on chunk unload -
    // they are now tracked per-object and removed in cleanupChunk.
    let light = null;
    if (isPhenomenon || (descriptor.category === "galaxy" && descriptor.scale > 0.65)) {
      const color = descriptor.objectClass === "quasar" ? 0x9fe6f0 : 0xffe2b0;
      light = this.scene.lights.addLight(descriptor.x, descriptor.y, 140 * descriptor.scale + 60, color, 0.35);
    }

    const entry = { descriptor, image, light };

    if (this.scene.scanSystem?.isScanned(descriptor.id)) {
      this.scene.scanSystem.attachCatalogedMarker(entry);
    }

    return entry;
  }

  generateProceduralAnomalies(chunk, chunkX, chunkY, rng) {
    const anomalyCount = Math.floor(rng() * ANOMALIES_PER_CHUNK) + 1;

    for (let i = 0; i < anomalyCount; i++) {
      const type = ANOMALY_TYPES[Math.floor(rng() * ANOMALY_TYPES.length)];
      const severity = Math.floor(rng() * 3) + 1;
      const x = chunkX * CHUNK_SIZE + rng() * CHUNK_SIZE;
      const y = chunkY * CHUNK_SIZE + rng() * CHUNK_SIZE;
      const anomalyId = `${chunkX}:${chunkY}:${i}`;

      if (this.anomalySystem.resolvedAnomalies.has(anomalyId)) continue;

      const anomaly = this.anomalySystem.createAnomaly(x, y, type, severity, anomalyId, false);
      chunk.anomalies.push(anomaly);

      if (!this.anomalySystem.discoveredAnomalies.has(anomalyId)) {
        this.anomalySystem.discoveredAnomalies.add(anomalyId);
        this.scene.setStats?.((prev) => ({
          ...prev,
          discovered: (prev.discovered || 0) + 1
        }));
      }
    }
  }

  cleanupChunk(chunk) {
    for (const entry of chunk.objects) {
      this.scene.tweens.killTweensOf(entry.image);
      entry.image.destroy();
      if (entry.light) this.scene.lights.removeLight(entry.light);
      entry.marker?.destroy();
    }
    chunk.anomalies.forEach(a => this.anomalySystem.destroyAnomalyVisual(a));
  }
}
