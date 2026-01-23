import { CHUNK_SIZE, ANOMALY_TYPE_MAP } from '../constants';

export class FullMapSystem {
  constructor(scene) {
    this.scene = scene;
    this.showFullMap = false;
    this.fullMapTexts = [];
    this.createFullMap();
  }

  createFullMap() {
    this.fullMapContainer = this.scene.add.container(0, 0)
      .setScrollFactor(0)
      .setDepth(2000)
      .setVisible(false);
    
    this.fullMapBg = this.scene.add.graphics().setScrollFactor(0);
    this.fullMapGraphics = this.scene.add.graphics().setScrollFactor(0);
    this.fullMapContainer.add([this.fullMapBg, this.fullMapGraphics]);

    this.fullMapTitle = this.scene.add.text(0, 0, "", {
      font: "bold 18px Courier",
      fill: "#00ffff",
      stroke: "#003333",
      strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2001).setVisible(false);

    this.fullMapInstruction = this.scene.add.text(0, 0, "", {
      font: "bold 14px Courier",
      fill: "#00ff00",
      backgroundColor: "#000000",
      padding: { x: 10, y: 5 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2001).setVisible(false);

    this.fullMapContainer.add([this.fullMapTitle, this.fullMapInstruction]);
  }

  toggle() {
    this.showFullMap = !this.showFullMap;
    this.fullMapContainer?.setVisible(this.showFullMap);
  }

  updatePosition(titleX, titleY, instructionX, instructionY) {
    this.fullMapTitle?.setPosition(titleX, titleY);
    this.fullMapInstruction?.setPosition(instructionX, instructionY);
  }

  render(player, currentChunk, loadedChunks, backendAnomalies, resolvedAnomalies) {
    // Clear previous texts
    this.fullMapTexts.forEach(t => t.destroy());
    this.fullMapTexts = [];

    if (!this.showFullMap) {
      this.fullMapBg.clear();
      this.fullMapGraphics.clear();
      this.fullMapTitle?.setVisible(false);
      this.fullMapInstruction?.setVisible(false);
      return;
    }

    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    const padding = 100;
    const mapWidth = width - padding * 2;
    const mapHeight = height - padding * 2 - 40;

    this.fullMapBg.clear();
    this.fullMapGraphics.clear();
    
    // Draw background and decorative elements
    this.drawBackground(width, height);
    
    // Calculate world bounds
    const { worldMinX, worldMaxX, worldMinY, worldMaxY, worldWidth, worldHeight, scale, offsetX, offsetY } = 
      this.calculateBounds(currentChunk, mapWidth, mapHeight, padding);

    // Draw borders and grid
    this.drawBorders(offsetX, offsetY, worldWidth, worldHeight, scale);
    this.drawGrid(currentChunk, offsetX, offsetY, worldMinX, worldMinY, scale, worldWidth, worldHeight);

    // Render content
    this.renderGalaxies(loadedChunks, offsetX, offsetY, worldMinX, worldMinY, scale);
    const proceduralAnomalies = this.renderProceduralAnomalies(loadedChunks, offsetX, offsetY, worldMinX, worldMinY, scale);
    const backendAnomaliesInView = this.renderBackendAnomalies(backendAnomalies, resolvedAnomalies, 
      offsetX, offsetY, worldMinX, worldMaxX, worldMinY, worldMaxY, scale, player);
    this.renderPlayer(player, offsetX, offsetY, worldMinX, worldMinY, scale);

    // Draw UI panels
    this.drawLegend(offsetX, offsetY, worldWidth, scale);
    this.drawStats(offsetX, offsetY, worldWidth, scale, loadedChunks, backendAnomaliesInView, proceduralAnomalies, player);

    // Update title
    this.fullMapTitle.setText("═══ TACTICAL SCAN ═══").setVisible(true);
    const instructionText = `Viewing ${loadedChunks.size} chunks • ${backendAnomaliesInView.length} priority targets • Press M to close`;
    this.fullMapInstruction.setText(instructionText).setVisible(true);
  }

  drawBackground(width, height) {
    this.fullMapBg.fillStyle(0x000000, 0.98).fillRect(0, 0, width, height);
    
    const bracketSize = 40;
    const bracketThick = 3;
    this.fullMapBg.lineStyle(bracketThick, 0x00ffff, 0.8);
    
    // Corner brackets
    this.fullMapBg.lineBetween(20, 20, 20 + bracketSize, 20);
    this.fullMapBg.lineBetween(20, 20, 20, 20 + bracketSize);
    this.fullMapBg.lineBetween(width - 20, 20, width - 20 - bracketSize, 20);
    this.fullMapBg.lineBetween(width - 20, 20, width - 20, 20 + bracketSize);
    this.fullMapBg.lineBetween(20, height - 20, 20 + bracketSize, height - 20);
    this.fullMapBg.lineBetween(20, height - 20, 20, height - 20 - bracketSize);
    this.fullMapBg.lineBetween(width - 20, height - 20, width - 20 - bracketSize, height - 20);
    this.fullMapBg.lineBetween(width - 20, height - 20, width - 20, height - 20 - bracketSize);
  }

  calculateBounds(currentChunk, mapWidth, mapHeight, padding) {
    const radius = 2;
    const minChunkX = currentChunk.chunkX - radius;
    const maxChunkX = currentChunk.chunkX + radius;
    const minChunkY = currentChunk.chunkY - radius;
    const maxChunkY = currentChunk.chunkY + radius;
    
    const worldMinX = minChunkX * CHUNK_SIZE;
    const worldMaxX = (maxChunkX + 1) * CHUNK_SIZE;
    const worldMinY = minChunkY * CHUNK_SIZE;
    const worldMaxY = (maxChunkY + 1) * CHUNK_SIZE;
    
    const worldWidth = worldMaxX - worldMinX;
    const worldHeight = worldMaxY - worldMinY;

    const scale = Math.min(mapWidth / worldWidth, mapHeight / worldHeight) * 0.85;
    const offsetX = padding + (mapWidth - worldWidth * scale) / 2;
    const offsetY = padding + (mapHeight - worldHeight * scale) / 2;

    return { worldMinX, worldMaxX, worldMinY, worldMaxY, worldWidth, worldHeight, scale, offsetX, offsetY };
  }

  drawBorders(offsetX, offsetY, worldWidth, worldHeight, scale) {
    this.fullMapGraphics.lineStyle(1, 0x00ffff, 0.2)
      .strokeRect(offsetX - 20, offsetY - 20, worldWidth * scale + 40, worldHeight * scale + 40);
    this.fullMapGraphics.lineStyle(2, 0x00ffff, 0.4)
      .strokeRect(offsetX - 15, offsetY - 15, worldWidth * scale + 30, worldHeight * scale + 30);
    this.fullMapGraphics.lineStyle(1, 0x00ddff, 0.6)
      .strokeRect(offsetX - 10, offsetY - 10, worldWidth * scale + 20, worldHeight * scale + 20);
    this.fullMapGraphics.lineStyle(3, 0x00ffff, 1)
      .strokeRect(offsetX - 5, offsetY - 5, worldWidth * scale + 10, worldHeight * scale + 10);
  }

  drawGrid(currentChunk, offsetX, offsetY, worldMinX, worldMinY, scale, worldWidth, worldHeight) {
    const radius = 2;
    const minChunkX = currentChunk.chunkX - radius;
    const maxChunkX = currentChunk.chunkX + radius;
    const minChunkY = currentChunk.chunkY - radius;
    const maxChunkY = currentChunk.chunkY + radius;

    this.fullMapGraphics.lineStyle(1, 0x004466, 0.6);
    
    for (let cx = minChunkX; cx <= maxChunkX; cx++) {
      const x = offsetX + (cx * CHUNK_SIZE - worldMinX) * scale;
      this.fullMapGraphics.lineBetween(x, offsetY, x, offsetY + worldHeight * scale);
      
      const coordBg = this.scene.add.graphics()
        .fillStyle(0x000000, 0.8)
        .fillRect(x - 12, offsetY - 25, 24, 14)
        .setScrollFactor(0)
        .setDepth(2001);
      this.fullMapTexts.push(coordBg);
      
      const coordText = this.scene.add.text(x, offsetY - 18, `${cx}`, {
        font: "bold 9px Courier",
        fill: "#00aacc",
        align: "center"
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2002);
      this.fullMapTexts.push(coordText);
    }
    
    for (let cy = minChunkY; cy <= maxChunkY; cy++) {
      const y = offsetY + (cy * CHUNK_SIZE - worldMinY) * scale;
      this.fullMapGraphics.lineBetween(offsetX, y, offsetX + worldWidth * scale, y);
      
      const coordBg = this.scene.add.graphics()
        .fillStyle(0x000000, 0.8)
        .fillRect(offsetX - 30, y - 7, 24, 14)
        .setScrollFactor(0)
        .setDepth(2001);
      this.fullMapTexts.push(coordBg);
      
      const coordText = this.scene.add.text(offsetX - 18, y, `${cy}`, {
        font: "bold 9px Courier",
        fill: "#00aacc",
        align: "right"
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2002);
      this.fullMapTexts.push(coordText);
    }

    // Highlight current chunk
    const currentChunkX = offsetX + (currentChunk.chunkX * CHUNK_SIZE - worldMinX) * scale;
    const currentChunkY = offsetY + (currentChunk.chunkY * CHUNK_SIZE - worldMinY) * scale;
    const chunkWidth = CHUNK_SIZE * scale;
    
    this.fullMapGraphics.fillStyle(0x00ffff, 0.12).fillRect(currentChunkX, currentChunkY, chunkWidth, chunkWidth);
    this.fullMapGraphics.lineStyle(2, 0x00ffff, 0.8).strokeRect(currentChunkX, currentChunkY, chunkWidth, chunkWidth);
    this.fullMapGraphics.lineStyle(1, 0x00ffff, 0.4).strokeRect(currentChunkX - 2, currentChunkY - 2, chunkWidth + 4, chunkWidth + 4);
    
    const chunkLabel = this.scene.add.text(currentChunkX + chunkWidth / 2, currentChunkY + chunkWidth / 2, "ACTIVE\nCHUNK", {
      font: "bold 11px Courier",
      fill: "#00ffff",
      align: "center",
      stroke: "#000000",
      strokeThickness: 4
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2002).setAlpha(0.6);
    this.fullMapTexts.push(chunkLabel);
  }

  renderGalaxies(loadedChunks, offsetX, offsetY, worldMinX, worldMinY, scale) {
    loadedChunks.forEach((chunk) => {
      chunk.galaxies.forEach((galaxy) => {
        const mx = offsetX + (galaxy.x - worldMinX) * scale;
        const my = offsetY + (galaxy.y - worldMinY) * scale;
        this.fullMapGraphics.fillStyle(0xcccccc, 0.3).fillCircle(mx, my, 3);
        this.fullMapGraphics.fillStyle(0xffffff, 0.6).fillCircle(mx, my, 2);
        this.fullMapGraphics.fillStyle(0xffffff, 1).fillCircle(mx, my, 1);
      });
    });
  }

  renderProceduralAnomalies(loadedChunks, offsetX, offsetY, worldMinX, worldMinY, scale) {
    const proceduralAnomalies = [];
    loadedChunks.forEach((chunk) => {
      chunk.anomalies.forEach((anom) => {
        if (!anom.resolved) proceduralAnomalies.push(anom);
      });
    });

    proceduralAnomalies.forEach((anom) => {
      const mx = offsetX + (anom.x - worldMinX) * scale;
      const my = offsetY + (anom.y - worldMinY) * scale;
      const typeConfig = ANOMALY_TYPE_MAP[anom.type];
      
      this.fullMapGraphics.fillStyle(typeConfig?.color || 0xff0000, 0.1).fillCircle(mx, my, 12);
      this.fullMapGraphics.fillStyle(typeConfig?.color || 0xff0000, 0.3).fillCircle(mx, my, 8);
      this.fullMapGraphics.fillStyle(typeConfig?.color || 0xff0000, 0.6).fillCircle(mx, my, 5);
      this.fullMapGraphics.fillStyle(typeConfig?.color || 0xff0000, 1).fillCircle(mx, my, 4);
      this.fullMapGraphics.lineStyle(1.5, 0xffffff, 0.9).strokeCircle(mx, my, 4);
      this.fullMapGraphics.lineStyle(1, typeConfig?.color || 0xff0000, 0.5).strokeCircle(mx, my, 7);
    });

    return proceduralAnomalies;
  }

  renderBackendAnomalies(backendAnomalies, resolvedAnomalies, offsetX, offsetY, worldMinX, worldMaxX, worldMinY, worldMaxY, scale, player) {
    const backendAnomaliesInView = [];
    backendAnomalies.forEach((backendAnomaly) => {
      if (!resolvedAnomalies.has(backendAnomaly.id)) {
        const anomX = backendAnomaly.location.x;
        const anomY = backendAnomaly.location.y;
        
        if (anomX >= worldMinX && anomX <= worldMaxX && anomY >= worldMinY && anomY <= worldMaxY) {
          backendAnomaliesInView.push(backendAnomaly);
        }
      }
    });

    backendAnomaliesInView.forEach((backendAnomaly) => {
      const mx = offsetX + (backendAnomaly.location.x - worldMinX) * scale;
      const my = offsetY + (backendAnomaly.location.y - worldMinY) * scale;
      const typeConfig = ANOMALY_TYPE_MAP[backendAnomaly.type];
      
      this.fullMapGraphics.lineStyle(5, 0xffff00, 0.15).strokeCircle(mx, my, 22);
      this.fullMapGraphics.lineStyle(4, 0xffaa00, 0.3).strokeCircle(mx, my, 17);
      this.fullMapGraphics.lineStyle(3, 0xffff00, 0.6).strokeCircle(mx, my, 13);
      this.fullMapGraphics.lineStyle(3, 0xffff00, 1).strokeCircle(mx, my, 10);
      this.fullMapGraphics.fillStyle(0xffaa00, 0.2).fillCircle(mx, my, 16);
      this.fullMapGraphics.fillStyle(0xffdd00, 0.3).fillCircle(mx, my, 12);
      this.fullMapGraphics.fillStyle(typeConfig?.color || 0xff0000, 1).fillCircle(mx, my, 8);
      this.fullMapGraphics.lineStyle(2, 0xffffff, 1).strokeCircle(mx, my, 8);
      this.fullMapGraphics.lineStyle(1, 0xffff00, 0.8).strokeCircle(mx, my, 11);
      
      // Labels
      const labelWidth = 85;
      const labelHeight = 22;
      const labelBg = this.scene.add.graphics()
        .fillStyle(0x000000, 0.9)
        .fillRoundedRect(mx - labelWidth/2, my - 38, labelWidth, labelHeight, 6)
        .lineStyle(2, 0xffff00, 1)
        .strokeRoundedRect(mx - labelWidth/2, my - 38, labelWidth, labelHeight, 6)
        .lineStyle(1, 0xffaa00, 0.5)
        .strokeRoundedRect(mx - labelWidth/2 - 1, my - 39, labelWidth + 2, labelHeight + 2, 6)
        .setScrollFactor(0)
        .setDepth(2001);
      this.fullMapTexts.push(labelBg);
      
      const severityText = this.scene.add.text(mx, my - 27, `⚡ PRIORITY ${backendAnomaly.severity}`, {
        font: "bold 10px Courier",
        fill: "#ffff00",
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2003);
      this.fullMapTexts.push(severityText);
      
      const typeLabel = this.scene.add.text(mx, my + 18, typeConfig?.label || "ANOMALY", {
        font: "bold 8px Courier",
        fill: "#ffffff",
        backgroundColor: "#000000",
        padding: { x: 4, y: 2 }
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2002);
      this.fullMapTexts.push(typeLabel);
      
      const dist = Math.sqrt((backendAnomaly.location.x - player.x) ** 2 + (backendAnomaly.location.y - player.y) ** 2);
      const distText = this.scene.add.text(mx, my + 30, `${dist.toFixed(0)}u`, {
        font: "bold 9px Courier",
        fill: "#00ffff",
        backgroundColor: "#000000",
        padding: { x: 3, y: 1 }
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2002);
      this.fullMapTexts.push(distText);
      
      // Draw line to player if close
      const worldWidth = worldMaxX - worldMinX;
      if (dist < worldWidth / 2) {
        const px = offsetX + (player.x - worldMinX) * scale;
        const py = offsetY + (player.y - worldMinY) * scale;
        this.fullMapGraphics.lineStyle(1, 0xffff00, 0.3);
        this.fullMapGraphics.lineBetween(mx, my, px, py);
      }
    });

    return backendAnomaliesInView;
  }

  renderPlayer(player, offsetX, offsetY, worldMinX, worldMinY, scale) {
    const px = offsetX + (player.x - worldMinX) * scale;
    const py = offsetY + (player.y - worldMinY) * scale;
    
    const vel = player.body.velocity;
    if (vel.x !== 0 || vel.y !== 0) {
      const angle = Math.atan2(vel.y, vel.x);
      const speed = Math.sqrt(vel.x ** 2 + vel.y ** 2);
      const dirLength = 15 + Math.min(speed / 10, 20);
      
      this.fullMapGraphics.lineStyle(3, 0x00ffff, 0.3);
      this.fullMapGraphics.lineBetween(px, py, px + Math.cos(angle) * dirLength, py + Math.sin(angle) * dirLength);
      this.fullMapGraphics.lineStyle(2, 0x00ffff, 0.6);
      this.fullMapGraphics.lineBetween(px, py, px + Math.cos(angle) * (dirLength - 5), py + Math.sin(angle) * (dirLength - 5));
    }
    
    this.fullMapGraphics.fillStyle(0x00ffff, 0.15).fillCircle(px, py, 18);
    this.fullMapGraphics.fillStyle(0x00ffff, 0.3).fillCircle(px, py, 14);
    this.fullMapGraphics.fillStyle(0x000000, 1).fillCircle(px, py, 10);
    this.fullMapGraphics.fillStyle(0x00ffff, 1).fillCircle(px, py, 9);
    this.fullMapGraphics.lineStyle(2, 0xffffff, 1).strokeCircle(px, py, 9);
    this.fullMapGraphics.lineStyle(1, 0x00ffff, 0.8).strokeCircle(px, py, 12);
    this.fullMapGraphics.lineStyle(1, 0x00ffff, 0.4).strokeCircle(px, py, 15);
    
    const playerLabelBg = this.scene.add.graphics()
      .fillStyle(0x000000, 0.9)
      .fillRoundedRect(px - 20, py + 20, 40, 16, 4)
      .lineStyle(1, 0x00ffff, 0.8)
      .strokeRoundedRect(px - 20, py + 20, 40, 16, 4)
      .setScrollFactor(0)
      .setDepth(2001);
    this.fullMapTexts.push(playerLabelBg);
    
    const playerLabel = this.scene.add.text(px, py + 28, "◆ YOU ◆", {
      font: "bold 9px Courier",
      fill: "#00ffff",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2002);
    this.fullMapTexts.push(playerLabel);
  }

  drawLegend(offsetX, offsetY, worldWidth, scale) {
    const legendX = offsetX + worldWidth * scale + 35;
    const legendY = offsetY + 10;
    const legendWidth = 120;
    
    const legendBg = this.scene.add.graphics()
      .fillStyle(0x000000, 0.85)
      .fillRoundedRect(legendX - 10, legendY - 10, legendWidth, 140, 8)
      .lineStyle(2, 0x00ffff, 0.6)
      .strokeRoundedRect(legendX - 10, legendY - 10, legendWidth, 140, 8)
      .setScrollFactor(0)
      .setDepth(2000);
    this.fullMapTexts.push(legendBg);
    
    const legendTitle = this.scene.add.text(legendX + legendWidth/2 - 10, legendY, "LEGEND", {
      font: "bold 11px Courier",
      fill: "#00ffff",
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2002);
    this.fullMapTexts.push(legendTitle);
    
    const legendItems = [
      { color: 0xffffff, label: "Galaxy", isCircle: true, size: 2 },
      { color: 0xff6600, label: "Procedural", isCircle: true, size: 4 },
      { color: 0xffff00, label: "Backend ⚡", isCircle: true, isSpecial: true, size: 8 },
      { color: 0x00ffff, label: "Your Ship", isCircle: true, size: 9 },
      { color: 0x00ffff, label: "Active Chunk", isBox: true },
    ];

    legendItems.forEach((item, i) => {
      const ly = legendY + 25 + i * 22;
      
      if (item.isCircle) {
        if (item.isSpecial) {
          this.fullMapGraphics.lineStyle(2, item.color, 0.8).strokeCircle(legendX + 8, ly + 6, 6);
        }
        this.fullMapGraphics.fillStyle(item.color, 0.9).fillCircle(legendX + 8, ly + 6, item.size);
        if (item.size > 2) {
          this.fullMapGraphics.lineStyle(1, 0xffffff, 0.7).strokeCircle(legendX + 8, ly + 6, item.size);
        }
      }
      
      if (item.isBox) {
        this.fullMapGraphics.fillStyle(item.color, 0.15).fillRect(legendX + 2, ly, 12, 12);
        this.fullMapGraphics.lineStyle(1.5, item.color, 0.8).strokeRect(legendX + 2, ly, 12, 12);
      }
      
      const legendText = this.scene.add.text(legendX + 25, ly + 6, item.label, {
        font: "9px Courier",
        fill: "#cccccc"
      }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(2002);
      this.fullMapTexts.push(legendText);
    });
  }

  drawStats(offsetX, offsetY, worldWidth, scale, loadedChunks, backendAnomaliesInView, proceduralAnomalies, player) {
    const statsX = offsetX - worldWidth * scale / 2 - 140;
    const statsY = offsetY + 10;
    const statsWidth = 130;
    
    const statsBg = this.scene.add.graphics()
      .fillStyle(0x000000, 0.85)
      .fillRoundedRect(statsX, statsY, statsWidth, 180, 8)
      .lineStyle(2, 0x00ff88, 0.6)
      .strokeRoundedRect(statsX, statsY, statsWidth, 180, 8)
      .setScrollFactor(0)
      .setDepth(2000);
    this.fullMapTexts.push(statsBg);
    
    const statsTitle = this.scene.add.text(statsX + statsWidth/2, statsY + 12, "SCAN REPORT", {
      font: "bold 11px Courier",
      fill: "#00ff88",
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2002);
    this.fullMapTexts.push(statsTitle);
    
    const totalGalaxies = Array.from(loadedChunks.values()).reduce((sum, chunk) => sum + chunk.galaxies.length, 0);
    
    const statsData = [
      { label: "Loaded Chunks", value: loadedChunks.size, color: "#00aacc" },
      { label: "Galaxies", value: totalGalaxies, color: "#ffffff" },
      { label: "Backend ⚡", value: backendAnomaliesInView.length, color: "#ffff00" },
      { label: "Procedural", value: proceduralAnomalies.length, color: "#ff6600" },
      { label: "Position", value: `${player.x.toFixed(0)}, ${player.y.toFixed(0)}`, color: "#00ffff" },
    ];
    
    statsData.forEach((stat, i) => {
      const sy = statsY + 38 + i * 24;
      
      const statLabel = this.scene.add.text(statsX + 10, sy, stat.label + ":", {
        font: "9px Courier",
        fill: "#999999"
      }).setOrigin(0, 0).setScrollFactor(0).setDepth(2002);
      this.fullMapTexts.push(statLabel);
      
      const statValue = this.scene.add.text(statsX + 10, sy + 11, String(stat.value), {
        font: "bold 10px Courier",
        fill: stat.color
      }).setOrigin(0, 0).setScrollFactor(0).setDepth(2002);
      this.fullMapTexts.push(statValue);
    });
  }
}