// src/components/game/systems/CivilizationSystem.js
//
// First Contact beacons: renders active civilizations (those with server-
// assigned locations) as broadcast-signal markers in the world, mirrors the
// AnomalySystem pattern - synced from universe.civilizations, visuals
// created only when their chunk is loaded, culled when the player moves
// away. Interaction (G key) is routed through InputSystem.
import Phaser from "phaser";
import { getChunkCoords, getChunkKey, civDesignation } from "../utils";

// Kardashev type -> beacon color (matches the escalation feel: mundane ->
// notable -> remarkable -> transcendent)
export const CIV_TYPE_COLORS = {
  Type0: 0x9497ad,
  Type1: 0x4fd1a5,
  Type2: 0xdfa73f,
  Type3: 0x8b7bd8,
};

const CULL_DISTANCE = 5000; // world units - drop visuals well outside the loaded area

export class CivilizationSystem {
  constructor(scene) {
    this.scene = scene;
    this.beacons = new Map(); // civ.id -> { data, visual }
  }

  /** Refresh the tracked set from the universe document. */
  sync() {
    const civs = (this.scene.universe?.civilizations || []).filter(
      (c) => !c.extinct && typeof c.location?.x === "number" && typeof c.location?.y === "number"
    );
    const activeIds = new Set(civs.map((c) => c.id));

    for (const civ of civs) {
      const existing = this.beacons.get(civ.id);
      if (existing) {
        existing.data = civ; // keep stats fresh for the interaction label
      } else {
        this.beacons.set(civ.id, { data: civ, visual: null });
      }
    }

    // Remove beacons for civs that went extinct or vanished
    for (const [id, beacon] of this.beacons.entries()) {
      if (!activeIds.has(id)) {
        if (beacon.visual) this.destroyVisual(beacon.visual);
        this.beacons.delete(id);
      }
    }
  }

  /** Create visuals for beacons whose chunk is loaded; cull distant ones. */
  renderVisible(loadedChunks) {
    const player = this.scene.player;

    for (const beacon of this.beacons.values()) {
      const { x, y } = beacon.data.location;

      if (!beacon.visual) {
        const chunk = getChunkCoords(x, y);
        if (loadedChunks.has(getChunkKey(chunk.chunkX, chunk.chunkY))) {
          beacon.visual = this.createBeacon(beacon.data);
        }
      } else if (player && Phaser.Math.Distance.Between(player.x, player.y, x, y) > CULL_DISTANCE) {
        this.destroyVisual(beacon.visual);
        beacon.visual = null;
      }
    }
  }

  createBeacon(civ) {
    const { x, y } = civ.location;
    const color = CIV_TYPE_COLORS[civ.type] ?? CIV_TYPE_COLORS.Type0;

    // Core: small settlement mark - a filled diamond, deliberately unlike
    // the anomaly reticle so contacts read differently at a glance
    const core = this.scene.add.graphics({ x, y }).setDepth(9);
    core.fillStyle(color, 0.95);
    core.fillPoints([
      new Phaser.Geom.Point(0, -7),
      new Phaser.Geom.Point(6, 0),
      new Phaser.Geom.Point(0, 7),
      new Phaser.Geom.Point(-6, 0),
    ], true);

    // Broadcast rings: two expanding circles on staggered loops - the
    // universal "signal source" visual
    const rings = [0, 1].map((i) => {
      const ring = this.scene.add.graphics({ x, y }).setDepth(8);
      ring.lineStyle(1.5, color, 0.8);
      ring.strokeCircle(0, 0, 12);
      this.scene.tweens.add({
        targets: ring,
        scaleX: 3.2,
        scaleY: 3.2,
        alpha: { from: 0.8, to: 0 },
        duration: 2400,
        delay: i * 1200,
        repeat: -1,
        ease: "Sine.easeOut",
      });
      return ring;
    });

    const label = this.scene.add
      .text(x, y - 34, `[${civDesignation(civ.id)}]\n${civ.type.replace("Type", "TYPE ")} · [G] CONTACT`, {
        fontFamily: '"IBM Plex Mono", monospace',
        fontSize: "11px",
        color: `#${color.toString(16).padStart(6, "0")}`,
        align: "center",
        backgroundColor: "#0c0f1c",
        padding: { x: 8, y: 5 },
      })
      .setOrigin(0.5)
      .setDepth(1000)
      .setVisible(false);

    return { x, y, core, rings, label };
  }

  /** Show/hide contact prompts based on player proximity. */
  handleInteraction(player, range = 300) {
    for (const beacon of this.beacons.values()) {
      if (!beacon.visual) continue;
      const inRange =
        Phaser.Math.Distance.Between(player.x, player.y, beacon.visual.x, beacon.visual.y) < range;
      beacon.visual.label.setVisible(inRange);
    }
  }

  /** Nearest contactable civilization within range, as plain data. */
  findNearest(player, range = 300) {
    let nearest = null;
    let best = range;
    for (const beacon of this.beacons.values()) {
      const { x, y } = beacon.data.location;
      const d = Phaser.Math.Distance.Between(player.x, player.y, x, y);
      if (d < best) {
        best = d;
        nearest = beacon.data;
      }
    }
    return nearest;
  }

  /** Beacon positions for the map layers. */
  getMapMarkers() {
    return Array.from(this.beacons.values()).map((b) => ({
      x: b.data.location.x,
      y: b.data.location.y,
      type: b.data.type,
    }));
  }

  destroyVisual(visual) {
    visual.rings.forEach((ring) => {
      this.scene.tweens.getTweensOf(ring).forEach((t) => t.stop());
      ring.destroy();
    });
    visual.core.destroy();
    visual.label.destroy();
  }

  destroy() {
    for (const beacon of this.beacons.values()) {
      if (beacon.visual) this.destroyVisual(beacon.visual);
    }
    this.beacons.clear();
  }
}
