import Phaser from 'phaser';
import seedrandom from 'seedrandom';
import { CHUNK_SIZE, ANOMALY_SPAWN_CHANCE, ANOMALIES_PER_CHUNK, ANOMALY_TYPES } from '../constants';
import { getChunkKey } from '../utils';

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

    // Load nearby chunks
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
    const chunk = { galaxies: [], anomalies: [] };
    const chunkSeed = (this.scene.universe.seed ?? "seed") + getChunkKey(chunkX, chunkY);
    const rng = seedrandom(chunkSeed);

    // Generate galaxies
    this.generateGalaxies(chunk, chunkX, chunkY, rng);

    // Generate procedural anomalies
    if (rng() < ANOMALY_SPAWN_CHANCE) {
      this.generateProceduralAnomalies(chunk, chunkX, chunkY, rng);
    }

    return chunk;
  }

  generateGalaxies(chunk, chunkX, chunkY, rng) {
    const galaxyCount = 8 + Math.floor(rng() * 12);
    
    for (let i = 0; i < galaxyCount; i++) {
      const x = chunkX * CHUNK_SIZE + rng() * CHUNK_SIZE;
      const y = chunkY * CHUNK_SIZE + rng() * CHUNK_SIZE;
      const size = rng() * 25 + 4;
      const hue = Math.floor(rng() * 360);
      const wheel = Phaser.Display.Color.HSVColorWheel();
      const color = wheel[hue % wheel.length];

      const g = this.scene.add.graphics({ x, y })
        .fillStyle(Phaser.Display.Color.GetColor(color.r, color.g, color.b), 0.8)
        .fillCircle(0, 0, size)
        .setDepth(-1);

      if (size > 20) {
        this.scene.lights.addLight(
          x, y, size * 6, 
          Phaser.Display.Color.GetColor(color.r, color.g, color.b), 
          0.2
        );
      }

      chunk.galaxies.push(g);
    }
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
    chunk.galaxies.forEach(g => g.destroy());
    chunk.anomalies.forEach(a => this.anomalySystem.destroyAnomalyVisual(a));
  }
}