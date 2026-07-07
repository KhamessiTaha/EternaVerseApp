import { useEffect, useRef } from 'react';

const VOID_RAISED = '#0c0f1c';
const LINE = '#1e2540';
const ACCENT = '#dfa73f';
const WARN = '#e0824a';
const GOOD = '#4fd1a5';
const INK_FAINT = '#565a72';

export const MinimapPanel = ({ minimapData, onMapToggle }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!minimapData || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { player, currentChunk, loadedChunks, anomalies, size = 200 } = minimapData;
    const radius = size / 2;

    ctx.clearRect(0, 0, size, size);

    // Clip to circle so everything below reads as a scope, not a square
    ctx.save();
    ctx.beginPath();
    ctx.arc(radius, radius, radius - 1, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = VOID_RAISED;
    ctx.fillRect(0, 0, size, size);

    const CHUNK_SIZE = 2000;
    const scale = size / (CHUNK_SIZE * 3);
    const centerX = radius;
    const centerY = radius;

    if (loadedChunks) {
      Object.values(loadedChunks).forEach((chunk) => {
        const chunkOffsetX = (chunk.chunkX - currentChunk.chunkX) * CHUNK_SIZE;
        const chunkOffsetY = (chunk.chunkY - currentChunk.chunkY) * CHUNK_SIZE;
        const x = centerX + chunkOffsetX * scale;
        const y = centerY + chunkOffsetY * scale;
        const w = CHUNK_SIZE * scale;

        ctx.strokeStyle = LINE;
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, w, w);

        if (chunk.stars) {
          ctx.globalAlpha = 0.5;
          ctx.fillStyle = '#e9e7f2';
          chunk.stars.forEach((star) => {
            const starX = x + (star.x % CHUNK_SIZE) * scale;
            const starY = y + (star.y % CHUNK_SIZE) * scale;
            ctx.fillRect(starX, starY, 1, 1);
          });
          ctx.globalAlpha = 1;
        }
      });
    }

    if (anomalies) {
      anomalies.forEach((anomaly) => {
        const ax = centerX + (anomaly.x - player.x) * scale;
        const ay = centerY + (anomaly.y - player.y) * scale;
        if (ax < 0 || ax > size || ay < 0 || ay > size) return;

        ctx.fillStyle = anomaly.isBackend ? WARN : INK_FAINT;
        ctx.beginPath();
        ctx.arc(ax, ay, 2.5, 0, Math.PI * 2);
        ctx.fill();

        if (anomaly.isBackend) {
          ctx.strokeStyle = WARN;
          ctx.lineWidth = 1;
          ctx.globalAlpha = 0.5;
          ctx.beginPath();
          ctx.arc(ax, ay, 4.5, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      });
    }

    // Radial sweep grid lines
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(centerX, radius * 0.15);
    ctx.lineTo(centerX, radius * 1.85);
    ctx.moveTo(radius * 0.15, centerY);
    ctx.lineTo(radius * 1.85, centerY);
    ctx.stroke();

    if (player) {
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(player.rotation || 0);
      ctx.fillStyle = GOOD;
      ctx.beginPath();
      ctx.moveTo(0, -5);
      ctx.lineTo(-3.5, 3.5);
      ctx.lineTo(3.5, 3.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();

    ctx.strokeStyle = '#2c3560';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(radius, radius, radius - 1, 0, Math.PI * 2);
    ctx.stroke();
  }, [minimapData]);

  if (!minimapData) return null;

  const size = minimapData.size || 96;
  const activeBackend = (minimapData.anomalies || []).filter((a) => a.isBackend).length;

  return (
    <div className="pointer-events-auto flex flex-col items-center">
      <div className="relative">
        <canvas ref={canvasRef} width={size} height={size} className="rounded-full" />
        {activeBackend > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-warn text-void text-[9px] font-mono font-semibold flex items-center justify-center">
            {activeBackend}
          </span>
        )}
      </div>
      <button
        onClick={onMapToggle}
        className="mt-2 text-[9px] tracking-wider uppercase text-ink-faint hover:text-accent transition-colors font-mono"
      >
        Scope · [M] Full Map
      </button>
    </div>
  );
};
