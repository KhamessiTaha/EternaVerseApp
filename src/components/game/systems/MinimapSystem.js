export class MinimapSystem {
  constructor(scene) {
    this.scene = scene;
  }

  update(player, currentChunk, loadedChunks, backendAnomalies) {
    if (this.scene.onMinimapUpdate) {
      this.scene.onMinimapUpdate({
        player: {
          x: player.x,
          y: player.y,
          rotation: player.rotation
        },
        currentChunk: {
          chunkX: currentChunk.chunkX,
          chunkY: currentChunk.chunkY
        },
        loadedChunks: this.formatLoadedChunks(loadedChunks),
        anomalies: this.formatAnomalies(loadedChunks, backendAnomalies),
        size: 200
      });
    }
  }

  formatLoadedChunks(loadedChunks) {
    if (!loadedChunks) return {};
    
    const formatted = {};
    loadedChunks.forEach((chunk, key) => {
      formatted[key] = {
        chunkX: Math.floor(key.split(':')[0]),
        chunkY: Math.floor(key.split(':')[1])
      };
    });
    
    return formatted;
  }

  formatAnomalies(loadedChunks, backendAnomalies) {
    const allAnomalies = [];
    
    // Collect procedural anomalies from loaded chunks
    if (loadedChunks) {
      loadedChunks.forEach((chunk) => {
        if (chunk.anomalies && Array.isArray(chunk.anomalies)) {
          chunk.anomalies.forEach(anomaly => {
            if (!anomaly.resolved) {
              allAnomalies.push({
                x: anomaly.x,
                y: anomaly.y,
                isBackend: false
              });
            }
          });
        }
      });
    }
    
    // Collect backend anomalies
    if (backendAnomalies) {
      backendAnomalies.forEach((backendAnomaly) => {
        if (backendAnomaly.visual && !backendAnomaly.visual.resolved) {
          allAnomalies.push({
            x: backendAnomaly.location?.x || backendAnomaly.visual.x,
            y: backendAnomaly.location?.y || backendAnomaly.visual.y,
            isBackend: true
          });
        }
      });
    }
    
    return allAnomalies;
  }

  updatePosition(x, y) {
  }

  destroy() {
  
  }
}