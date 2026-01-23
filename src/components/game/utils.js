import { CHUNK_SIZE } from './constants';

export const getChunkCoords = (x, y) => ({
  chunkX: Math.floor(x / CHUNK_SIZE),
  chunkY: Math.floor(y / CHUNK_SIZE),
});

export const getChunkKey = (x, y) => `${x}:${y}`;

export const formatNumber = (num) => {
  if (!num) return '0';
  if (num < 1e3) return Math.floor(num).toLocaleString();
  if (num < 1e6) return (num / 1e3).toFixed(1) + 'K';
  if (num < 1e9) return (num / 1e6).toFixed(1) + 'M';
  if (num < 1e12) return (num / 1e9).toFixed(2) + 'B';
  return num.toExponential(1);
};