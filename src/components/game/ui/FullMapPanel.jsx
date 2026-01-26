import { useEffect, useRef } from 'react';

export const FullMapPanel = ({ isOpen, onClose, fullMapData }) => {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    if (!isOpen || !fullMapData || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { player, currentChunk, loadedChunks, anomalies, resolvedAnomalies } = fullMapData;
    
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
    
    const CHUNK_SIZE = 2000;
    const viewRadius = 5; // Show 5 chunks in each direction
    const scale = Math.min(width, height) / (CHUNK_SIZE * (viewRadius * 2 + 1));
    const centerX = width / 2;
    const centerY = height / 2;
    
    // Draw grid
    ctx.strokeStyle = '#1a3a3a';
    ctx.lineWidth = 1;
    for (let x = -viewRadius; x <= viewRadius; x++) {
      for (let y = -viewRadius; y <= viewRadius; y++) {
        const chunkOffsetX = x * CHUNK_SIZE;
        const chunkOffsetY = y * CHUNK_SIZE;
        
        const drawX = centerX + chunkOffsetX * scale;
        const drawY = centerY + chunkOffsetY * scale;
        const size = CHUNK_SIZE * scale;
        
        ctx.strokeRect(drawX, drawY, size, size);
      }
    }
    
    // Draw loaded chunks highlight
    if (loadedChunks) {
      Object.values(loadedChunks).forEach(chunk => {
        const chunkOffsetX = (chunk.chunkX - currentChunk.chunkX) * CHUNK_SIZE;
        const chunkOffsetY = (chunk.chunkY - currentChunk.chunkY) * CHUNK_SIZE;
        
        const x = centerX + chunkOffsetX * scale;
        const y = centerY + chunkOffsetY * scale;
        const w = CHUNK_SIZE * scale;
        
        // Highlight loaded chunks
        ctx.fillStyle = '#0a4a4a';
        ctx.globalAlpha = 0.3;
        ctx.fillRect(x, y, w, w);
        ctx.globalAlpha = 1;
        
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, w);
      });
    }
    
    // Draw resolved anomalies
    if (resolvedAnomalies) {
      resolvedAnomalies.forEach(anomaly => {
        const anomalyOffsetX = anomaly.x - player.x;
        const anomalyOffsetY = anomaly.y - player.y;
        
        const ax = centerX + anomalyOffsetX * scale;
        const ay = centerY + anomalyOffsetY * scale;
        
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ax, ay, 4, 0, Math.PI * 2);
        ctx.stroke();
        
        // Draw checkmark
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(ax - 2, ay);
        ctx.lineTo(ax, ay + 2);
        ctx.lineTo(ax + 3, ay - 2);
        ctx.stroke();
      });
    }
    
    // Draw active anomalies
    if (anomalies) {
      anomalies.forEach(anomaly => {
        const anomalyOffsetX = anomaly.x - player.x;
        const anomalyOffsetY = anomaly.y - player.y;
        
        const ax = centerX + anomalyOffsetX * scale;
        const ay = centerY + anomalyOffsetY * scale;
        
        const isBackend = anomaly.isBackend;
        
        // Outer glow
        ctx.fillStyle = isBackend ? '#ffff00' : '#ff6600';
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.arc(ax, ay, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        
        // Main dot
        ctx.fillStyle = isBackend ? '#ffff00' : '#ff6600';
        ctx.beginPath();
        ctx.arc(ax, ay, 5, 0, Math.PI * 2);
        ctx.fill();
        
        // Border
        ctx.strokeStyle = isBackend ? '#ffffff' : '#ffaa00';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ax, ay, 6, 0, Math.PI * 2);
        ctx.stroke();
      });
    }
    
    // Draw player
    if (player) {
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(player.rotation || 0);
      
      // Player ship
      ctx.fillStyle = '#00ff00';
      ctx.shadowColor = '#00ff00';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(-8, 8);
      ctx.lineTo(0, 4);
      ctx.lineTo(8, 8);
      ctx.closePath();
      ctx.fill();
      
      ctx.shadowBlur = 0;
      ctx.restore();
      
      // Player position circle
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(centerX, centerY, 30, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    
  }, [isOpen, fullMapData]);
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      {/* Map Container */}
      <div className="relative w-[90vw] h-[85vh] max-w-6xl bg-gradient-to-br from-gray-900 via-black to-gray-900 rounded-xl border-2 border-cyan-500/60 shadow-2xl shadow-cyan-500/40 overflow-hidden">
        
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/90 to-transparent p-4 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🗺️</span>
              <div>
                <h2 className="text-cyan-400 font-bold text-xl tracking-wider">FULL MAP</h2>
                <p className="text-gray-400 text-xs">Galactic Navigation System</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-red-600/80 hover:bg-red-600 text-white rounded-lg border border-red-400/50 font-bold transition-all text-sm"
            >
              CLOSE [M]
            </button>
          </div>
        </div>
        
        {/* Canvas */}
        <canvas
          ref={canvasRef}
          width={1200}
          height={800}
          className="w-full h-full"
        />
        
        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-black/90 rounded-lg border border-cyan-500/40 p-3 backdrop-blur-sm">
          <div className="text-cyan-400 font-bold text-xs mb-2 tracking-wider">LEGEND</div>
          <div className="space-y-1.5 text-[10px]">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gradient-to-r from-yellow-500 to-yellow-300 rounded-full border-2 border-white"></div>
              <span className="text-gray-300">Backend Anomaly (High Priority)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gradient-to-r from-orange-600 to-orange-400 rounded-full"></div>
              <span className="text-gray-300">Procedural Anomaly</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full border-2 border-green-500 flex items-center justify-center text-green-500">✓</div>
              <span className="text-gray-300">Resolved Anomaly</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 rounded" style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }}></div>
              <span className="text-gray-300">Your Ship</span>
            </div>
            <div className="flex items-center gap-2 pt-1 border-t border-cyan-700/30">
              <div className="w-4 h-4 border-2 border-cyan-500"></div>
              <span className="text-gray-300">Loaded Chunk</span>
            </div>
          </div>
        </div>
        
        {/* Coordinates Display */}
        {fullMapData?.player && (
          <div className="absolute bottom-4 right-4 bg-black/90 rounded-lg border border-cyan-500/40 p-3 backdrop-blur-sm">
            <div className="text-cyan-400 font-bold text-xs mb-2 tracking-wider">POSITION</div>
            <div className="space-y-1 text-sm font-mono">
              <div className="flex gap-3">
                <span className="text-gray-400">X:</span>
                <span className="text-cyan-300">{Math.floor(fullMapData.player.x)}</span>
              </div>
              <div className="flex gap-3">
                <span className="text-gray-400">Y:</span>
                <span className="text-cyan-300">{Math.floor(fullMapData.player.y)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};