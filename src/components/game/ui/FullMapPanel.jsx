import { useEffect, useRef } from 'react';
import { CHUNK_SIZE } from '../constants';

const VOID = '#070912';
const LINE = '#1e2540';
const LINE_BRIGHT = '#2c3560';
const ACCENT = '#dfa73f';
const WARN = '#e0824a';
const GOOD = '#4fd1a5';
const INK = '#e9e7f2';

// Kardashev type -> beacon color (mirrors CivilizationSystem.CIV_TYPE_COLORS)
const CIV_COLORS = {
  Type0: '#9497ad',
  Type1: '#4fd1a5',
  Type2: '#dfa73f',
  Type3: '#8b7bd8',
};

export const FullMapPanel = ({ isOpen, onClose, fullMapData }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !fullMapData || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { player, currentChunk, loadedChunks, anomalies, resolvedAnomalies, civs } = fullMapData;

    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = VOID;
    ctx.fillRect(0, 0, width, height);

    const viewRadius = 5;
    const scale = Math.min(width, height) / (CHUNK_SIZE * (viewRadius * 2 + 1));
    const centerX = width / 2;
    const centerY = height / 2;

    ctx.strokeStyle = LINE;
    ctx.lineWidth = 1;
    for (let x = -viewRadius; x <= viewRadius; x++) {
      for (let y = -viewRadius; y <= viewRadius; y++) {
        const drawX = centerX + x * CHUNK_SIZE * scale;
        const drawY = centerY + y * CHUNK_SIZE * scale;
        const size = CHUNK_SIZE * scale;
        ctx.strokeRect(drawX, drawY, size, size);
      }
    }

    if (loadedChunks) {
      Object.values(loadedChunks).forEach((chunk) => {
        const chunkOffsetX = (chunk.chunkX - currentChunk.chunkX) * CHUNK_SIZE;
        const chunkOffsetY = (chunk.chunkY - currentChunk.chunkY) * CHUNK_SIZE;
        const x = centerX + chunkOffsetX * scale;
        const y = centerY + chunkOffsetY * scale;
        const w = CHUNK_SIZE * scale;

        ctx.fillStyle = LINE;
        ctx.globalAlpha = 0.35;
        ctx.fillRect(x, y, w, w);
        ctx.globalAlpha = 1;

        ctx.strokeStyle = LINE_BRIGHT;
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, w, w);
      });
    }

    if (resolvedAnomalies) {
      resolvedAnomalies.forEach((anomaly) => {
        const ax = centerX + (anomaly.x - player.x) * scale;
        const ay = centerY + (anomaly.y - player.y) * scale;

        ctx.strokeStyle = GOOD;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.arc(ax, ay, 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      });
    }

    if (anomalies) {
      anomalies.forEach((anomaly) => {
        const ax = centerX + (anomaly.x - player.x) * scale;
        const ay = centerY + (anomaly.y - player.y) * scale;
        const color = anomaly.isBackend ? WARN : '#565a72';

        ctx.fillStyle = color;
        ctx.globalAlpha = 0.25;
        ctx.beginPath();
        ctx.arc(ax, ay, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(ax, ay, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = INK;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(ax, ay, 5, 0, Math.PI * 2);
        ctx.stroke();
      });
    }

    // Civilization beacons - diamonds, colored by Kardashev type
    if (civs) {
      civs.forEach((civ) => {
        const cx = centerX + (civ.x - player.x) * scale;
        const cy = centerY + (civ.y - player.y) * scale;
        const color = CIV_COLORS[civ.type] || CIV_COLORS.Type0;

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 6);
        ctx.lineTo(cx + 5, cy);
        ctx.lineTo(cx, cy + 6);
        ctx.lineTo(cx - 5, cy);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      });
    }

    if (player) {
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(player.rotation || 0);
      ctx.fillStyle = GOOD;
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(-7, 7);
      ctx.lineTo(0, 3);
      ctx.lineTo(7, 7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.strokeStyle = LINE_BRIGHT;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(centerX, centerY, 30, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [isOpen, fullMapData]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/85 backdrop-blur-sm">
      <div className="relative w-[90vw] h-[85vh] max-w-6xl bg-void border border-line overflow-hidden">
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-void to-transparent p-4 z-10 pointer-events-none">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-sans text-ink font-medium text-lg tracking-wide">Full Map</h2>
              <p className="text-ink-faint text-[10px] font-mono tracking-wider uppercase">Galactic Navigation</p>
            </div>
            <button
              onClick={onClose}
              className="pointer-events-auto font-mono text-[11px] tracking-wider text-ink-dim hover:text-ink border border-line-bright hover:border-accent px-3 py-1.5 transition-colors"
            >
              CLOSE [M]
            </button>
          </div>
        </div>

        <canvas ref={canvasRef} width={1200} height={800} className="w-full h-full" />

        <div className="absolute bottom-4 left-4 bg-void-raised/80 backdrop-blur-sm border border-line p-3 font-mono">
          <div className="text-accent text-[9px] tracking-wider uppercase mb-2">Legend</div>
          <div className="space-y-1.5 text-[10px] text-ink-dim">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-warn" />
              Backend anomaly
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-ink-faint" />
              Procedural anomaly
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full border border-good" />
              Resolved
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rotate-45 bg-accent" />
              Civilization
            </div>
            <div className="flex items-center gap-2 pt-1 border-t border-line">
              <span className="w-2 h-2 border border-line-bright" />
              Loaded chunk
            </div>
          </div>
        </div>

        {fullMapData?.player && (
          <div className="absolute bottom-4 right-4 bg-void-raised/80 backdrop-blur-sm border border-line p-3 font-mono">
            <div className="text-accent text-[9px] tracking-wider uppercase mb-2">Position</div>
            <div className="text-[12px] tabular-nums text-ink">
              {Math.floor(fullMapData.player.x)}, {Math.floor(fullMapData.player.y)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
