// src/components/game/combat/shipRenderer.js
//
// How a civilization's vessels LOOK. Everything Phaser-facing about a ship
// lives here so CivFleetSystem can stay a simulation - it moves ships and
// decides who shoots whom; this decides what that looks like.
//
// Solar 2 by way of code, not sprite sheets: additive glow, no hard outlines,
// silhouettes you can read at a glance, and motion that eases rather than
// snaps. A needle-thin interceptor should never be mistaken for the slab of a
// bomber even at the edge of the screen - because which one you shoot first
// is the whole tactical decision.
//
// Performance rules this file obeys:
//   * one Graphics for ALL engine trails (a polyline redraw, not a particle
//     emitter per ship)
//   * two shared particle emitters (sparks, smoke) reused via emitParticleAt,
//     instead of allocating an emitter per explosion
//   * ships beyond cull distance have no display objects at all
import Phaser from "phaser";
import { SHIP_ROLES } from "./fleetModel.js";

const TRAIL_LEN = 9;
const TRAIL_SAMPLE_MS = 55;
const SMOKE_INTERVAL_MS = 130;
const DAMAGED_AT = 0.45; // hull fraction below which a ship visibly suffers

export class ShipRenderer {
  constructor(scene) {
    this.scene = scene;

    // One draw call for every engine trail in the sky.
    this.trailGfx = scene.add.graphics().setDepth(8)
      .setBlendMode(Phaser.BlendModes.ADD);

    // Shared, always-off emitters. `emitParticleAt` fires bursts on demand.
    this.sparks = scene.add.particles(0, 0, "evtex:spark", {
      speed: { min: 70, max: 240 },
      scale: { start: 0.45, end: 0 },
      lifespan: { min: 240, max: 620 },
      blendMode: "ADD",
      emitting: false,
    }).setDepth(10);

    this.smoke = scene.add.particles(0, 0, "evtex:spark", {
      speed: { min: 8, max: 34 },
      scale: { start: 0.3, end: 0.02 },
      alpha: { start: 0.5, end: 0 },
      lifespan: { min: 500, max: 1000 },
      blendMode: "ADD",
      tint: 0x6b5a4a,
      emitting: false,
    }).setDepth(7);
  }

  /** Give a ship its display objects. Idempotent. */
  attach(ship) {
    if (ship.gfx) return;
    const spec = SHIP_ROLES[ship.role];
    const s = spec.radius / 12;
    const c = this.scene.add.container(ship.x, ship.y).setDepth(9);

    const engine = this.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    const hull = this.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    drawSilhouette(hull, ship.role, ship.color, s);

    c.add([engine, hull]);

    // Only shielded roles carry a bubble, and it stays invisible until hit.
    let shield = null;
    if (spec.shields > 0) {
      shield = this.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
      shield.lineStyle(1.6, 0x9fd8ff, 1);
      shield.strokeCircle(0, 0, spec.radius * 1.75);
      shield.setAlpha(0);
      c.add(shield);
    }

    ship.gfx = c;
    ship.gfxParts = { hull, engine, shield, scale: s };
  }

  detach(ship) {
    ship.gfx?.destroy(true);
    ship.gfx = null;
    ship.gfxParts = null;
    ship.trail = null;
  }

  /**
   * Per-frame visual state: position, the bank into a turn, engine throttle,
   * the shield's remaining strength, and smoke from a failing hull.
   */
  update(ship, time) {
    // Trail points are sampled even while culled-out so a ship re-entering
    // view doesn't drag a stale line across the screen.
    if (!ship.trail) ship.trail = [];
    if (time - (ship.trailAt || 0) > TRAIL_SAMPLE_MS) {
      ship.trailAt = time;
      ship.trail.push(ship.x, ship.y);
      if (ship.trail.length > TRAIL_LEN * 2) ship.trail.splice(0, 2);
    }

    const g = ship.gfx;
    if (!g) return;
    const spec = SHIP_ROLES[ship.role];
    const { engine, shield, scale } = ship.gfxParts;

    g.setPosition(ship.x, ship.y);
    g.rotation = ship.heading + Math.PI / 2;

    // Bank: a ship leans into its turn instead of pivoting like a turret.
    // turnRate is signed radians/sec, set by the mover.
    const lean = Phaser.Math.Clamp((ship.turnRate || 0) / spec.turn, -1, 1);
    ship.bank = Phaser.Math.Linear(ship.bank || 0, lean, 0.12);
    g.scaleX = 1 - Math.abs(ship.bank) * 0.42;

    // Engine glow rides the throttle and flickers, so idling ships look idle.
    const throttle = ship.throttle || 0;
    engine.clear();
    if (throttle > 0.05) {
      const flare = throttle * (0.8 + Math.sin(time * 0.03 + ship.seed) * 0.2);
      engine.fillStyle(ship.color, 0.5 * flare);
      engine.fillEllipse(0, 9 * scale, 6 * scale * flare, 13 * scale * flare);
      engine.fillStyle(0xffffff, 0.75 * flare);
      engine.fillEllipse(0, 7.5 * scale, 2.4 * scale * flare, 6 * scale * flare);
    }

    if (shield) {
      const frac = ship.shields / Math.max(1, spec.shields);
      const flick = time < (ship.shieldFlashUntil || 0) ? 1 : 0.22 * frac;
      shield.setAlpha(frac <= 0 ? 0 : flick);
    }

    // A hull below ~half streams smoke - the tell that says "finish this one".
    if (ship.hp / spec.hp < DAMAGED_AT && time - (ship.smokeAt || 0) > SMOKE_INTERVAL_MS) {
      ship.smokeAt = time;
      this.smoke.emitParticleAt(ship.x, ship.y, 1);
    }
  }

  /** Redraw every engine trail in one pass. Call once per frame. */
  drawTrails(ships) {
    const g = this.trailGfx;
    g.clear();
    for (const ship of ships) {
      const t = ship.trail;
      if (!ship.gfx || !t || t.length < 4) continue;
      const points = t.length / 2;
      for (let i = 1; i < points; i++) {
        const f = i / points; // 0 at the tail, 1 at the ship
        g.lineStyle(SHIP_ROLES[ship.role].radius * 0.28 * f, ship.color, 0.34 * f * f);
        g.beginPath();
        g.moveTo(t[(i - 1) * 2], t[(i - 1) * 2 + 1]);
        g.lineTo(t[i * 2], t[i * 2 + 1]);
        g.strokePath();
      }
    }
  }

  /** A hit landed. Shields ring; bare hull flashes and sheds sparks. */
  hit(ship, absorbedByShield, time) {
    if (absorbedByShield) {
      ship.shieldFlashUntil = time + 140;
      if (ship.shields <= 0) this._shatterShield(ship);
      return;
    }
    const hull = ship.gfxParts?.hull;
    if (hull) {
      hull.setAlpha(0.35);
      this.scene.time.delayedCall(70, () => hull?.setAlpha(1));
    }
    this.sparks.setParticleTint(0xffd9a0);
    this.sparks.emitParticleAt(ship.x, ship.y, 3);
  }

  _shatterShield(ship) {
    const spec = SHIP_ROLES[ship.role];
    const ring = this.scene.add.graphics({ x: ship.x, y: ship.y }).setDepth(10)
      .setBlendMode(Phaser.BlendModes.ADD);
    ring.lineStyle(2.5, 0x9fd8ff, 1);
    ring.strokeCircle(0, 0, spec.radius * 1.75);
    this.scene.tweens.add({
      targets: ring,
      scale: 2.1,
      alpha: 0,
      duration: 340,
      ease: "Cubic.easeOut",
      onComplete: () => ring.destroy(),
    });
  }

  /**
   * Death: the hull tears into pieces that spin off and burn out, a shock ring
   * pushes through them, and a couple of secondary blasts pop a beat later.
   * The point is that a kill READS as a kill from across the screen.
   */
  destroyShip(ship) {
    const spec = SHIP_ROLES[ship.role];
    const { x, y, color } = ship;
    const scale = spec.radius / 12;

    // Break-up: three shards of the silhouette, tumbling outward.
    for (let i = 0; i < 3; i++) {
      const shard = this.scene.add.graphics({ x, y }).setDepth(9)
        .setBlendMode(Phaser.BlendModes.ADD);
      shard.fillStyle(color, 0.85);
      shard.fillTriangle(
        0, -6 * scale,
        (4 + i) * scale, (5 + i) * scale,
        -(3 + i) * scale, (4 + i) * scale
      );
      shard.rotation = ship.heading;
      const a = ship.heading + (i / 3) * Math.PI * 2;
      this.scene.tweens.add({
        targets: shard,
        x: x + Math.cos(a) * (34 + i * 12),
        y: y + Math.sin(a) * (34 + i * 12),
        rotation: shard.rotation + (i % 2 ? 5 : -5),
        alpha: 0,
        scale: 0.3,
        duration: 620 + i * 90,
        ease: "Quad.easeOut",
        onComplete: () => shard.destroy(),
      });
    }

    // Shock ring.
    const ring = this.scene.add.graphics({ x, y }).setDepth(10)
      .setBlendMode(Phaser.BlendModes.ADD);
    ring.lineStyle(3, 0xffe0a8, 1);
    ring.strokeCircle(0, 0, spec.radius);
    this.scene.tweens.add({
      targets: ring,
      scale: 3.4,
      alpha: 0,
      duration: 460,
      ease: "Cubic.easeOut",
      onComplete: () => ring.destroy(),
    });

    this.sparks.setParticleTint([color, 0xf5cf7a]);
    this.sparks.emitParticleAt(x, y, 18);

    // Secondaries: something in there was still holding pressure.
    for (let i = 1; i <= 2; i++) {
      this.scene.time.delayedCall(140 * i + 90, () => {
        if (!this.sparks?.scene) return;
        this.sparks.emitParticleAt(
          x + Phaser.Math.Between(-18, 18),
          y + Phaser.Math.Between(-18, 18),
          6
        );
      });
    }

    this.detach(ship);
  }

  /**
   * A bombardment run landing on a world: a heavy lance from the bomber down
   * to the surface, then a bloom where it hits. This is the thing the player
   * is supposed to see and fly toward.
   */
  bombardBeam(ship, tx, ty) {
    const beam = this.scene.add.graphics().setDepth(8)
      .setBlendMode(Phaser.BlendModes.ADD);
    beam.lineStyle(5, 0xff7a5c, 0.9);
    beam.lineBetween(ship.x, ship.y, tx, ty);
    beam.lineStyle(1.6, 0xffffff, 0.9);
    beam.lineBetween(ship.x, ship.y, tx, ty);
    this.scene.tweens.add({
      targets: beam,
      alpha: 0,
      duration: 420,
      ease: "Quad.easeIn",
      onComplete: () => beam.destroy(),
    });

    this.sparks.setParticleTint([0xff7a5c, 0xffd0a0]);
    this.sparks.emitParticleAt(tx, ty, 10);
  }

  destroy() {
    this.trailGfx.destroy();
    this.sparks.destroy();
    this.smoke.destroy();
  }
}

/**
 * The four silhouettes. Each is a soft outer glow plus a bright core, so they
 * read as light rather than as outlined sprites - and each has a distinct
 * proportion: needle, slab, arrowhead, spindle.
 */
function drawSilhouette(g, role, color, s) {
  const glow = (a) => g.fillStyle(color, a);

  if (role === "interceptor") {
    // Needle: all length, no width. Two swept fins.
    glow(0.3);
    g.fillTriangle(0, -19 * s, 6 * s, 10 * s, -6 * s, 10 * s);
    glow(0.95);
    g.fillTriangle(0, -16 * s, 2.8 * s, 8 * s, -2.8 * s, 8 * s);
    glow(0.55);
    g.fillTriangle(2.5 * s, 2 * s, 9 * s, 11 * s, 2.5 * s, 9 * s);
    g.fillTriangle(-2.5 * s, 2 * s, -9 * s, 11 * s, -2.5 * s, 9 * s);
    g.fillStyle(0xffffff, 0.95);
    g.fillCircle(0, -6 * s, 1.5 * s);
    return;
  }

  if (role === "bomber") {
    // Slab: a wide blunt hexagon with an ugly bright payload underneath.
    glow(0.28);
    g.fillPoints([
      { x: 0, y: -14 * s }, { x: 11 * s, y: -5 * s }, { x: 9 * s, y: 11 * s },
      { x: -9 * s, y: 11 * s }, { x: -11 * s, y: -5 * s },
    ], true);
    glow(0.9);
    g.fillPoints([
      { x: 0, y: -10 * s }, { x: 7.5 * s, y: -3 * s }, { x: 6 * s, y: 8 * s },
      { x: -6 * s, y: 8 * s }, { x: -7.5 * s, y: -3 * s },
    ], true);
    // Payload glow - what it is carrying, and why it must die first.
    g.fillStyle(0xff8a5c, 0.85);
    g.fillEllipse(0, 3 * s, 7 * s, 4.5 * s);
    g.fillStyle(0xffffff, 0.9);
    g.fillEllipse(0, 3 * s, 2.6 * s, 1.8 * s);
    return;
  }

  if (role === "guardian") {
    // Arrowhead: broad flared prow built to sit between you and the bombers.
    glow(0.3);
    g.fillPoints([
      { x: 0, y: -15 * s }, { x: 14 * s, y: 8 * s }, { x: 5 * s, y: 5 * s },
      { x: -5 * s, y: 5 * s }, { x: -14 * s, y: 8 * s },
    ], true);
    glow(0.95);
    g.fillPoints([
      { x: 0, y: -11 * s }, { x: 8 * s, y: 6 * s }, { x: 0, y: 3 * s },
      { x: -8 * s, y: 6 * s },
    ], true);
    g.fillStyle(0x9fd8ff, 0.9);
    g.fillCircle(0, -4 * s, 2.2 * s);
    return;
  }

  // cruiser - spindle hull with two side pods
  glow(0.3);
  g.fillEllipse(0, 0, 9 * s, 30 * s);
  glow(0.95);
  g.fillEllipse(0, 0, 5 * s, 24 * s);
  glow(0.6);
  g.fillEllipse(7 * s, 3 * s, 3.5 * s, 12 * s);
  g.fillEllipse(-7 * s, 3 * s, 3.5 * s, 12 * s);
  g.fillStyle(0xffffff, 0.9);
  g.fillCircle(0, -7 * s, 1.8 * s);
}
