// src/components/game/world/salvageDrop.js
//
// Wreckage. When something the player shot comes apart, it leaves salvage
// motes behind - the same session-only hull-repair pickups ChunkSystem seeds
// into a chunk, so SalvageSystem collects them without knowing where they
// came from.
//
// Extracted because three callers now drop wreckage (rift-spawn, civilization
// vessels, and the ambient chunk seeding they were copied from) and a mote
// that looks or behaves differently depending on what died is a bug waiting
// to happen.
import { getChunkCoords, getChunkKey } from "../utils";

const MOTE_COLOR = 0xdfa73f;
const SCATTER = 50;

/**
 * Scatter `count` salvage motes around a point, pushed into whichever loaded
 * chunk contains them. Returns how many actually landed - zero when the chunk
 * isn't loaded, which is normal for a kill at the edge of the world.
 */
export function dropSalvage(scene, x, y, count) {
  const { chunkX, chunkY } = getChunkCoords(x, y);
  const chunk = scene.chunkSystem?.loadedChunks.get(getChunkKey(chunkX, chunkY));
  if (!chunk) return 0;
  if (!chunk.salvage) chunk.salvage = [];

  for (let i = 0; i < count; i++) {
    const mx = x + (Math.random() - 0.5) * SCATTER;
    const my = y + (Math.random() - 0.5) * SCATTER;
    chunk.salvage.push({ x: mx, y: my, collected: false, gfx: createMote(scene, mx, my) });
  }
  return count;
}

/** The mote itself: a slow-bobbing amber chip. Mirrors ChunkSystem's seeding. */
export function createMote(scene, x, y) {
  const gfx = scene.add.graphics({ x, y }).setDepth(3);
  gfx.fillStyle(MOTE_COLOR, 0.9);
  gfx.fillRect(-2.5, -2.5, 5, 5);
  gfx.rotation = Math.PI / 4;

  scene.tweens.add({
    targets: gfx,
    y: y + 6,
    alpha: { from: 0.5, to: 0.95 },
    duration: 1400 + Math.random() * 900,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
  });
  return gfx;
}
