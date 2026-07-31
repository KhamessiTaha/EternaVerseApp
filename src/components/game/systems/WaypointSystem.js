// src/components/game/systems/WaypointSystem.js
//
// Cross-scale civilization guidance. Contact is a core mechanic, but a civ's
// home is buried at the scale its Kardashev type dictates (a Type 0 sits two
// descents down, inside one specific star system) - effectively unfindable by
// hand. The Locator panel plants a target here; this draws the breadcrumb.
//
// Rendering is WORLD-space on purpose: the arrow orbits the player's ship,
// always a fixed distance away, pointing at the next thing to do. That avoids
// any screen-projection / camera-zoom math (which is fragile with this game's
// lookahead camera) - if the ship is on screen, so is the arrow. The next hop
// is re-derived every frame from the live world, so guidance advances on its
// own as the player descends.
import Phaser from "phaser";
import { cosmicProfile } from "../world/cosmicProfile.js";
import { generateScaleObjects } from "../world/worldScales.js";
import { nextHopToCiv, civLocation } from "../world/civPlacement.js";
import { civDesignation } from "../utils";

const ARROW_COLOR = 0x4fd1a5;
const ORBIT_R = 170;       // world units the arrow floats from the ship
const ARRIVED_DIST = 240;  // close enough that the beacon is right here

export class WaypointSystem {
  constructor(scene) {
    this.scene = scene;
    this.civId = null;

    // Arrow + target ring live in WORLD space (default scrollFactor 1), above
    // beacons (depth 9). The label is screen-fixed (scrollFactor 0).
    this.arrow = scene.add.graphics().setDepth(60).setVisible(false);
    this.ring = scene.add.graphics().setDepth(60).setVisible(false);
    this.label = scene.add.text(0, 0, "", {
      fontFamily: '"IBM Plex Mono", monospace', fontSize: "12px", color: "#8ff0cf",
      backgroundColor: "rgba(8,12,20,0.82)", padding: { x: 8, y: 4 }, align: "center",
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
    // No real match: don't invent a target in empty space - the caller hides
    // the arrow rather than pulsing a ring over nothing.
    return null;
  }

  update() {
    if (!this.civId || !this.scene.player) return;
    const civ = (this.scene.universe?.civilizations || []).find((c) => c.id === this.civId);
    if (!civ || civ.extinct) { this.clear(); return; }

    // Placement is computed from the BASE universe seed (civHost/homeStarId
    // derive their own per-scale seeds internally) - NOT worldSeed(), which
    // changes on descent and would make the home stop matching the path.
    const baseSeed = this.scene.universe?.seed ?? "seed";
    const name = civDesignation(civ.id);
    // Same profile the world is rendered with, so the civ's home is chosen from
    // structures that actually exist on screen (not the full-density fallback).
    const cp = cosmicProfile(this.scene.universe?.currentState);
    const hop = nextHopToCiv(baseSeed, civ, this.scene.world, cp);

    if (hop.mode === "gone") { this.clear(); return; }
    if (hop.mode === "ascend") {
      // No direction to point - back out to the branch that leads to the civ.
      this.arrow.setVisible(false);
      this.ring.setVisible(false);
      this._label(`↑ ${name} · wrong branch · ascend [BACKSPACE]`);
      return;
    }

    let pos, prefix, hint;
    if (hop.mode === "here") {
      pos = civLocation(civ);
      prefix = name;
      const d = Phaser.Math.Distance.Between(this.scene.player.x, this.scene.player.y, pos.x, pos.y);
      // Reached them: stop guiding automatically (the arrow's job is done).
      if (d < ARRIVED_DIST) {
        this.scene.onWaypointArrive?.(this.civId);
        this.clear();
        return;
      }
      hint = "here";
    } else {
      pos = this._structurePos(hop.structureId);
      if (!pos) { this._hide(); return; }
      prefix = pos.name ? `${name} · via ${pos.name}` : name;
      hint = "descend [ENTER]";
    }

    this._draw(pos, `◈ ${prefix} · ${hint}`);
  }

  _draw(pos, text) {
    const player = this.scene.player;
    const cam = this.scene.cameras.main;
    const dist = Phaser.Math.Distance.Between(player.x, player.y, pos.x, pos.y);
    const distText = dist >= 1000 ? ` · ${(dist / 1000).toFixed(1)}k` : ` · ${Math.round(dist)}`;

    // If the target is on screen, ring it; otherwise show the arrow. The arrow
    // orbits the CAMERA CENTRE (not the ship) so camera lookahead / boost can
    // never push it off-screen - the bug where fast up/down flight lost it.
    if (cam.worldView.contains(pos.x, pos.y)) {
      const t = 0.5 + 0.5 * Math.sin(this.scene.time.now / 220);
      this.ring.clear();
      this.ring.lineStyle(2.5, ARROW_COLOR, 0.55 + 0.35 * t);
      this.ring.strokeCircle(0, 0, 24 + 8 * t);
      this.ring.setPosition(pos.x, pos.y).setVisible(true);
      this.arrow.setVisible(false);
    } else {
      const cx = cam.midPoint.x;
      const cy = cam.midPoint.y;
      const ang = Math.atan2(pos.y - cy, pos.x - cx);
      const ax = cx + Math.cos(ang) * ORBIT_R;
      const ay = cy + Math.sin(ang) * ORBIT_R;
      this.arrow.clear();
      this.arrow.fillStyle(ARROW_COLOR, 0.95);
      this.arrow.fillTriangle(22, 0, -13, -12, -13, 12);
      this.arrow.lineStyle(2, 0x0a0f14, 0.9);
      this.arrow.strokeTriangle(22, 0, -13, -12, -13, 12);
      this.arrow.setPosition(ax, ay).setRotation(ang).setVisible(true);
      this.ring.setVisible(false);
    }

    this._label(text + distText);
  }

  // Screen-fixed banner near the top - no projection, always readable.
  _label(text) {
    this.label.setText(text).setPosition(this.scene.scale.width / 2, 128).setVisible(true);
  }

  destroy() {
    this.arrow.destroy();
    this.ring.destroy();
    this.label.destroy();
  }
}
