// src/components/game/systems/WaypointSystem.js
//
// Cross-scale civilization guidance. Contact is a core mechanic, but a civ's
// home is buried at the scale its Kardashev type dictates (a Type 0 sits two
// descents down, inside one specific star system) - effectively unfindable by
// hand. The Locator panel plants a target here; this draws the breadcrumb:
// a single edge-of-screen arrow that always points at the NEXT thing to do -
// fly to a galaxy, descend into it, fly to a star, descend, arrive - and a
// label that tells you which. It re-derives the next hop every frame from the
// live world state, so it advances automatically as you descend or drift.
import Phaser from "phaser";
import { CHUNK_SIZE } from "../constants";
import { cosmicProfile } from "../world/cosmicProfile.js";
import { generateScaleObjects } from "../world/worldScales.js";
import { nextHopToCiv, civLocation } from "../world/civPlacement.js";
import { civDesignation } from "../utils";

const ARROW_COLOR = 0x4fd1a5;
const ARRIVED_DIST = 260; // world units - close enough that the beacon is right there

export class WaypointSystem {
  constructor(scene) {
    this.scene = scene;
    this.civId = null;

    this.arrow = scene.add.graphics().setScrollFactor(0).setDepth(951).setVisible(false);
    this.ring = scene.add.graphics().setScrollFactor(0).setDepth(951).setVisible(false);
    this.label = scene.add.text(0, 0, "", {
      fontFamily: '"IBM Plex Mono", monospace', fontSize: "12px", color: "#4fd1a5",
      backgroundColor: "rgba(8,12,20,0.78)", padding: { x: 7, y: 4 }, align: "center",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(952).setVisible(false);
  }

  setTarget(civId) { this.civId = civId; }
  clear() { this.civId = null; this._hide(); }
  hasTarget() { return !!this.civId; }

  _hide() {
    this.arrow.setVisible(false);
    this.ring.setVisible(false);
    this.label.setVisible(false);
  }

  // Resolve a structure id (galaxy / star at the current scale) to a world
  // position. Prefers a loaded chunk (exact + live); otherwise regenerates the
  // structure's chunk deterministically - the id encodes its chunk coords.
  _structurePos(structureId) {
    for (const chunk of this.scene.chunkSystem.loadedChunks.values()) {
      for (const entry of chunk.objects) {
        if (entry.descriptor.id === structureId) {
          return { x: entry.descriptor.x, y: entry.descriptor.y, name: entry.descriptor.name };
        }
      }
    }
    const parts = String(structureId).split(":");
    const cx = parseInt(parts[1], 10);
    const cy = parseInt(parts[2], 10);
    if (Number.isNaN(cx) || Number.isNaN(cy)) return null;
    const seed = this.scene.worldSeed();
    const cp = cosmicProfile(this.scene.universe?.currentState);
    const parentName = this.scene.world?.labels?.[this.scene.world.labels.length - 1];
    const objs = generateScaleObjects(seed, cx, cy, this.scene.world.scale, parentName, cp);
    const match = objs.find((o) => o.id === structureId);
    if (match) return { x: match.x, y: match.y, name: match.name };
    return { x: (cx + 0.5) * CHUNK_SIZE, y: (cy + 0.5) * CHUNK_SIZE, name: null };
  }

  update() {
    if (!this.civId) return;
    const civ = (this.scene.universe?.civilizations || []).find((c) => c.id === this.civId);
    if (!civ || civ.extinct) { this.clear(); return; }

    const seed = this.scene.worldSeed();
    const name = civDesignation(civ.id);
    const hop = nextHopToCiv(seed, civ, this.scene.world);

    // Off-branch / too-deep: no direction to point, just tell them to back out.
    if (hop.mode === "ascend") {
      this._hide();
      this._showBanner(`↑ ${name}: ascend to relocate  [BACKSPACE]`);
      return;
    }
    if (hop.mode === "gone") { this.clear(); return; }

    let pos, prefix, hint;
    if (hop.mode === "here") {
      pos = civLocation(civ);
      prefix = name;
      const d = Phaser.Math.Distance.Between(this.scene.player.x, this.scene.player.y, pos.x, pos.y);
      hint = d < ARRIVED_DIST ? "arrived  [G]" : "here";
    } else {
      pos = this._structurePos(hop.structureId);
      if (!pos) { this._hide(); return; }
      prefix = pos.name ? `${name} · via ${pos.name}` : name;
      hint = `descend  [ENTER]`;
    }

    this._draw(pos, prefix, hint);
  }

  // A centered banner with no arrow (used when the player must ascend).
  _showBanner(text) {
    const w = this.scene.scale.width;
    this.bannerY = 128;
    this.label.setText(text).setPosition(w / 2, this.bannerY).setVisible(true);
  }

  _draw(pos, prefix, hint) {
    const cam = this.scene.cameras.main;
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;
    const cx = w / 2;
    const cy = h / 2;

    // World -> screen (accounts for zoom and camera center).
    const sx = (pos.x - cam.midPoint.x) * cam.zoom + cx;
    const sy = (pos.y - cam.midPoint.y) * cam.zoom + cy;

    const dist = Phaser.Math.Distance.Between(this.scene.player.x, this.scene.player.y, pos.x, pos.y);
    const distText = dist >= 1000 ? `${(dist / 1000).toFixed(1)}k` : `${Math.round(dist)}`;

    const onScreen = sx > 40 && sx < w - 40 && sy > 70 && sy < h - 140;

    if (onScreen) {
      // Target is visible: pulse a ring on it, hide the arrow.
      this.arrow.setVisible(false);
      const t = 0.5 + 0.5 * Math.sin(this.scene.time.now / 220);
      this.ring.clear();
      this.ring.lineStyle(2, ARROW_COLOR, 0.5 + 0.4 * t);
      this.ring.strokeCircle(sx, sy, 20 + 6 * t);
      this.ring.setVisible(true);
      this.label.setText(`${prefix} · ${distText} · ${hint}`).setPosition(sx, sy - 34).setVisible(true);
      return;
    }

    // Off-screen: clamp an arrow to a margin box, pointed at the target.
    this.ring.setVisible(false);
    const dx = sx - cx;
    const dy = sy - cy;
    const ang = Math.atan2(dy, dx);
    const mx = w / 2 - 56;
    const my = h / 2 - 100;
    const tX = Math.abs(dx) > 1e-3 ? mx / Math.abs(dx) : Infinity;
    const tY = Math.abs(dy) > 1e-3 ? my / Math.abs(dy) : Infinity;
    const k = Math.min(tX, tY);
    const ex = cx + dx * k;
    const ey = cy + dy * k;

    this.arrow.clear();
    this.arrow.fillStyle(ARROW_COLOR, 0.95);
    this.arrow.fillTriangle(14, 0, -9, -9, -9, 9);
    this.arrow.setPosition(ex, ey).setRotation(ang).setVisible(true);

    // Label sits just inside the arrow, upright.
    const lx = Phaser.Math.Clamp(ex - Math.cos(ang) * 26, 90, w - 90);
    const ly = Phaser.Math.Clamp(ey - Math.sin(ang) * 26, 90, h - 90);
    this.label.setText(`${prefix} · ${distText} · ${hint}`).setPosition(lx, ly).setVisible(true);
  }

  destroy() {
    this.arrow.destroy();
    this.ring.destroy();
    this.label.destroy();
  }
}
