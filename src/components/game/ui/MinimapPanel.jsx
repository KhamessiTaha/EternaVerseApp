import { useEffect, useRef } from 'react';

export const MinimapPanel = ({ minimapData, onMapToggle }) => {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    if (!minimapData || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { player, currentChunk, loadedChunks, anomalies, size = 200 } = minimapData;
    
    // Clear canvas
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, size, size);
    
    const CHUNK_SIZE = 2000;
    const scale = size / (CHUNK_SIZE * 3); // Show 3x3 chunks
    const centerX = size / 2;
    const centerY = size / 2;
    
    // Draw loaded chunks
    if (loadedChunks) {
      Object.values(loadedChunks).forEach(chunk => {
        const chunkOffsetX = (chunk.chunkX - currentChunk.chunkX) * CHUNK_SIZE;
        const chunkOffsetY = (chunk.chunkY - currentChunk.chunkY) * CHUNK_SIZE;
        
        const x = centerX + chunkOffsetX * scale;
        const y = centerY + chunkOffsetY * scale;
        const w = CHUNK_SIZE * scale;
        
        // Draw chunk outline
        ctx.strokeStyle = '#1a3a3a';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, w, w);
        
        // Draw stars in chunk
        if (chunk.stars) {
          chunk.stars.forEach(star => {
            const starX = x + (star.x % CHUNK_SIZE) * scale;
            const starY = y + (star.y % CHUNK_SIZE) * scale;
            
            ctx.fillStyle = star.color || '#ffffff';
            ctx.globalAlpha = 0.6;
            ctx.fillRect(starX, starY, 1, 1);
          });
          ctx.globalAlpha = 1;
        }
      });
    }
    
    // Draw anomalies
    if (anomalies) {
      anomalies.forEach(anomaly => {
        const anomalyOffsetX = anomaly.x - player.x;
        const anomalyOffsetY = anomaly.y - player.y;
        
        const ax = centerX + anomalyOffsetX * scale;
        const ay = centerY + anomalyOffsetY * scale;
        
        // Check if anomaly is in view
        if (ax >= 0 && ax <= size && ay >= 0 && ay <= size) {
          ctx.fillStyle = anomaly.isBackend ? '#ffff00' : '#ff6600';
          ctx.beginPath();
          ctx.arc(ax, ay, 3, 0, Math.PI * 2);
          ctx.fill();
          
          // Glow effect for backend anomalies
          if (anomaly.isBackend) {
            ctx.strokeStyle = '#ffff00';
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.arc(ax, ay, 5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
        }
      });
    }
    
    // Draw player
    if (player) {
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(player.rotation || 0);
      
      // Player ship triangle
      ctx.fillStyle = '#00ff00';
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(-4, 4);
      ctx.lineTo(4, 4);
      ctx.closePath();
      ctx.fill();
      
      ctx.restore();
    }
    
    // Draw border
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, size, size);
    
  }, [minimapData]);
  
  if (!minimapData) return null;
  
  const size = minimapData.size || 200;
  
  return (
    <div className="bg-black/90 rounded-lg border-2 border-cyan-500/60 shadow-lg shadow-cyan-500/30 p-2 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-cyan-400 font-bold text-xs tracking-wider">🗺️ RADAR</span>
        <button
          onClick={onMapToggle}
          className="text-[10px] text-yellow-400 hover:text-yellow-300 transition-colors px-2 py-1 bg-black/50 rounded border border-yellow-600/30 hover:border-yellow-400/50"
        >
          M = FULL MAP
        </button>
      </div>
      <canvas 
        ref={canvasRef}
        width={size}
        height={size}
        className="w-full h-auto"
      />
      <div className="mt-2 text-[9px] text-gray-400 space-y-1">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-yellow-400 rounded-full border border-yellow-600"></span>
          <span>Backend Anomaly</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-orange-500 rounded-full"></span>
          <span>Procedural Anomaly</span>
        </div>
      </div>
    </div>
  );
};