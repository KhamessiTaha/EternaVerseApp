export class FullMapSystem {
  constructor(scene) {
    this.scene = scene;
  }

  render(player, currentChunk, loadedChunks, backendAnomalies, resolvedAnomalies) {
    // Just send data to React
    if (this.scene.onFullMapUpdate) {
      this.scene.onFullMapUpdate({
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
        anomalies: this.formatActiveAnomalies(loadedChunks, backendAnomalies),
        resolvedAnomalies: this.formatResolvedAnomalies(loadedChunks, resolvedAnomalies)
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

  formatActiveAnomalies(loadedChunks, backendAnomalies) {
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

  formatResolvedAnomalies(loadedChunks, resolvedAnomalies) {
    const resolved = [];
    
    // Collect resolved procedural anomalies from loaded chunks
    if (loadedChunks) {
      loadedChunks.forEach((chunk) => {
        if (chunk.anomalies && Array.isArray(chunk.anomalies)) {
          chunk.anomalies.forEach(anomaly => {
            if (anomaly.resolved) {
              resolved.push({
                x: anomaly.x,
                y: anomaly.y,
                isBackend: false
              });
            }
          });
        }
      });
    }
    
    // Note: Backend resolved anomalies are already removed from backendAnomalies Map
    // We'd need to track them separately if we want to show them on the map
    
    return resolved;
  }

  toggle() {
    // Map toggle is now handled by React
  }

  updatePosition(x, y, w, h) {
    // No longer needed - React handles positioning
  }

  destroy() {
    // Nothing to destroy
  }
}