// src/components/game/systems/ArtifactSystem.js
//
// Renders the things the player BUILT.
//
// Everything else in this world is procedural or simulated - generated from a
// seed, or spawned by the physics engine. Artifacts are the only objects that
// exist because a person decided they should, at a place they chose. They get
// their own system for that reason, and because they're the only world objects
// that live on the universe document rather than in a chunk.
//
// Scale-aware: an artifact remembers the cosmic scale and descent path it was
// planted at, so a beacon raised inside a star system doesn't render out at
// the galactic scale marking empty space.
import Phaser from "phaser";
import { ARTIFACTS } from "../content/artifacts.js";

const pathEq = (a = [], b = []) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

export class ArtifactSystem {
  constructor(scene) {
    this.scene = scene;
    this.rendered = new Map(); // artifact id -> container
  }

  /** Artifacts belonging to the scale + descent path the player is at now. */
  _here() {
    const world = this.scene.world || { scale: "galactic", path: [] };
    return (this.scene.universe?.artifacts || []).filter(
      (a) => (a.scale || "galactic") === world.scale && pathEq(a.path || [], world.path)
    );
  }

  /** Rebuild the visible set. Cheap - there are at most a couple of dozen. */
  sync() {
    const wanted = new Set();
    for (const a of this._here()) {
      wanted.add(a.id);
      if (!this.rendered.has(a.id)) this.rendered.set(a.id, this._create(a));
    }
    for (const [id, obj] of this.rendered.entries()) {
      if (!wanted.has(id)) { obj.destroy(true); this.rendered.delete(id); }
    }
  }

  /** Map markers, so a work is findable long after you forgot where it was. */
  getMapMarkers() {
    return this._here().map((a) => ({ x: a.x, y: a.y, kind: `artifact:${a.kind}` }));
  }

  _create(a) {
    const def = ARTIFACTS[a.kind] || ARTIFACTS.beacon;
    const c = this.scene.add.container(a.x, a.y).setDepth(7);

    const g = this.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    if (a.kind === "monument") {
      // A standing slab: deliberately hard-edged and vertical against a world
      // made of soft round light.
      g.fillStyle(def.color, 0.28);
      g.fillRect(-9, -30, 18, 40);
      g.fillStyle(def.color, 0.95);
      g.fillRect(-4, -26, 8, 34);
    } else if (a.kind === "vault") {
      g.fillStyle(def.color, 0.24);
      g.fillCircle(0, 0, 18);
      g.lineStyle(2, def.color, 0.95);
      g.strokeCircle(0, 0, 11);
      g.fillStyle(def.color, 0.9);
      g.fillCircle(0, 0, 3.5);
    } else {
      // Beacon: a mast with a light on top.
      g.lineStyle(2, def.color, 0.9);
      g.lineBetween(0, 8, 0, -18);
      g.fillStyle(def.color, 0.3);
      g.fillCircle(0, -22, 10);
      g.fillStyle(0xffffff, 0.95);
      g.fillCircle(0, -22, 3);
    }
    c.add(g);

    const label = this.scene.add.text(0, 18, def.label.toUpperCase(), {
      fontFamily: '"IBM Plex Mono", monospace', fontSize: "9px",
      color: "#9497ad",
    }).setOrigin(0.5, 0).setAlpha(0.75);
    c.add(label);

    if (a.note) {
      const note = this.scene.add.text(0, 30, `"${a.note}"`, {
        fontFamily: '"IBM Plex Mono", monospace', fontSize: "9px",
        color: "#5a5f73", fontStyle: "italic",
        align: "center", wordWrap: { width: 190 },
      }).setOrigin(0.5, 0);
      c.add(note);
    }

    // A slow pulse, so it reads as something maintained rather than debris.
    this.scene.tweens.add({
      targets: g, alpha: { from: 0.75, to: 1 },
      duration: 2200, yoyo: true, repeat: -1, ease: "Sine.easeInOut",
    });

    return c;
  }

  /** Scale change tears everything down; sync() rebuilds on return. */
  clear() {
    for (const obj of this.rendered.values()) obj.destroy(true);
    this.rendered.clear();
  }

  destroy() {
    this.clear();
  }
}
