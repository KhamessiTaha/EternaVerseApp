import { CHUNK_SIZE, MINIMAP_SIZE, ANOMALY_TYPE_MAP } from '../constants';

export class MinimapSystem {
  constructor(scene) {
    this.scene = scene;
    this.minimapX = 10;
    this.minimapY = 10;
    this.createMinimap();
  }

  createMinimap() {
    this.minimap = this.scene.add.graphics().setScrollFactor(0).setDepth(1000);
    this.minimapBorder = this.scene.add.graphics().setScrollFactor(0).setDepth(999);
  }

  updatePosition(x, y) {
    this.minimapX = x;
    this.minimapY = y;
  }

  update(player, currentChunk, loadedChunks, backendAnomalies) {
    const mapX = this.minimapX;
    const mapY = this.minimapY;
    const radius = 2; // activeChunkRadius
    const chunksWidth = (radius * 2 + 1) * CHUNK_SIZE;
    const chunksHeight = (radius * 2 + 1) * CHUNK_SIZE;
    const centerX = currentChunk.chunkX * CHUNK_SIZE + CHUNK_SIZE / 2;
    const centerY = currentChunk.chunkY * CHUNK_SIZE + CHUNK_SIZE / 2;
    const scale = MINIMAP_SIZE / chunksWidth;

    this.minimap.clear();
    this.minimapBorder.clear();

    // Border and background
    this.minimapBorder
      .lineStyle(2, 0x00ffff, 0.8)
      .strokeRect(mapX - 2, mapY - 2, MINIMAP_SIZE + 4, MINIMAP_SIZE + 4);
    
    this.minimap
      .fillStyle(0x000022, 0.95)
      .fillRect(mapX, mapY, MINIMAP_SIZE, MINIMAP_SIZE);

    // Grid lines
    this.minimapBorder.lineStyle(1, 0x004444, 0.5);
    for (let dx = -radius; dx <= radius; dx++) {
      const x = mapX + (dx * CHUNK_SIZE + chunksWidth / 2) * scale;
      this.minimapBorder.lineBetween(x, mapY, x, mapY + MINIMAP_SIZE);
    }
    for (let dy = -radius; dy <= radius; dy++) {
      const y = mapY + (dy * CHUNK_SIZE + chunksHeight / 2) * scale;
      this.minimapBorder.lineBetween(mapX, y, mapX + MINIMAP_SIZE, y);
    }

    // Render galaxies
    this.renderGalaxies(loadedChunks, mapX, mapY, centerX, centerY, scale, chunksWidth, chunksHeight);

    // Render anomalies
    this.renderAnomalies(loadedChunks, backendAnomalies, mapX, mapY, centerX, centerY, scale, chunksWidth, chunksHeight);

    // Render player
    this.renderPlayer(player, mapX, mapY, centerX, centerY, scale, chunksWidth, chunksHeight);
  }

  renderGalaxies(loadedChunks, mapX, mapY, centerX, centerY, scale, chunksWidth, chunksHeight) {
    loadedChunks.forEach((chunk) => {
      chunk.galaxies.forEach((galaxy) => {
        const relX = galaxy.x - centerX;
        const relY = galaxy.y - centerY;
        const mx = mapX + (relX + chunksWidth / 2) * scale;
        const my = mapY + (relY + chunksHeight / 2) * scale;
        
        if (this.isInBounds(mx, my, mapX, mapY)) {
          this.minimap.fillStyle(0x666666, 0.6).fillCircle(mx, my, 1.5);
        }
      });
    });
  }

  renderAnomalies(loadedChunks, backendAnomalies, mapX, mapY, centerX, centerY, scale, chunksWidth, chunksHeight) {
    // Procedural anomalies
    loadedChunks.forEach((chunk) => {
      chunk.anomalies.forEach((anom) => {
        if (!anom.resolved) {
          const coords = this.getCoords(anom.x, anom.y, centerX, centerY, mapX, mapY, scale, chunksWidth, chunksHeight);
          
          if (coords) {
            const typeConfig = ANOMALY_TYPE_MAP[anom.type];
            this.minimap.fillStyle(typeConfig?.color || 0xff0000, 0.7).fillCircle(coords.mx, coords.my, 2);
          }
        }
      });
    });

    // Backend anomalies
    backendAnomalies.forEach((backendAnomaly) => {
      if (backendAnomaly.visual && !backendAnomaly.visual.resolved) {
        const coords = this.getCoords(
          backendAnomaly.location.x, backendAnomaly.location.y,
          centerX, centerY, mapX, mapY, scale, chunksWidth, chunksHeight
        );
        
        if (coords) {
          const typeConfig = ANOMALY_TYPE_MAP[backendAnomaly.type];
          this.minimap.lineStyle(2, 0xffff00, 1).strokeCircle(coords.mx, coords.my, 4);
          this.minimap.fillStyle(typeConfig?.color || 0xff0000, 1).fillCircle(coords.mx, coords.my, 3);
        }
      }
    });
  }

  renderPlayer(player, mapX, mapY, centerX, centerY, scale, chunksWidth, chunksHeight) {
    const relPX = player.x - centerX;
    const relPY = player.y - centerY;
    const px = mapX + (relPX + chunksWidth / 2) * scale;
    const py = mapY + (relPY + chunksHeight / 2) * scale;
    
    this.minimap.fillStyle(0x00ffff, 1).fillCircle(px, py, 4);
    this.minimap.lineStyle(1, 0xffffff, 1).strokeCircle(px, py, 4);
  }

  getCoords(x, y, centerX, centerY, mapX, mapY, scale, chunksWidth, chunksHeight) {
    const relX = x - centerX;
    const relY = y - centerY;
    const mx = mapX + (relX + chunksWidth / 2) * scale;
    const my = mapY + (relY + chunksHeight / 2) * scale;
    
    return this.isInBounds(mx, my, mapX, mapY) ? { mx, my } : null;
  }

  isInBounds(mx, my, mapX, mapY) {
    return mx >= mapX && mx <= mapX + MINIMAP_SIZE && 
           my >= mapY && my <= mapY + MINIMAP_SIZE;
  }
}