// src/components/game/systems/CivilizationSystem.js
//
// First Contact beacons: renders active civilizations (those with server-
// assigned locations) as broadcast-signal markers in the world, mirrors the
// AnomalySystem pattern - synced from universe.civilizations, visuals
// created only when their chunk is loaded, culled when the player moves
// away. Interaction (G key) is routed through InputSystem.
import Phaser from "phaser";
import { getChunkCoords, getChunkKey, civDesignation, civAttitude } from "../utils";
import { playSfx } from "../audio.js";
import { getLoadoutLocal } from "../loadoutStore.js";
import { HULL_STATS } from "../content/hullCatalog.js";
import { narrateOnce, pick, CURATOR } from "../narrator.js";

// Kardashev type -> beacon color (matches the escalation feel: mundane ->
// notable -> remarkable -> transcendent)
export const CIV_TYPE_COLORS = {
  Type0: 0x9497ad,
  Type1: 0x4fd1a5,
  Type2: 0xdfa73f,
  Type3: 0x8b7bd8,
};

const CULL_DISTANCE = 5000; // world units - drop visuals well outside the loaded area

// Missile defense (hostile Type1+ civs): homing projectiles the player must
// outrun or outturn - they're faster than cruise speed but turn poorly, so
// dodging is a real skill, and boost is a hard escape.
const MISSILE_RANGE = 1300;     // beacon starts firing inside this
const MISSILE_SPEED = 330;
const MISSILE_TURN = 2.2;       // rad/s - deliberately sluggish
const MISSILE_LIFESPAN = 6500;  // ms
const MISSILE_DAMAGE = 12;
const MISSILE_HIT_RADIUS = 26;
const MISSILE_COOLDOWN = [4200, 6500]; // per-beacon, randomized
const MAX_MISSILES = 6;

const ATTITUDE_LABEL = {
  worship: "WORSHIPS YOU",
  friendly: "FRIENDLY",
  neutral: "",
  wary: "WARY",
  hostile: "HOSTILE",
};

export class CivilizationSystem {
  constructor(scene) {
    this.scene = scene;
    this.beacons = new Map(); // civ.id -> { data, visual, attitude, nextMissileAt }
    this.missiles = [];
    this.ceasefireUntil = 0; // Cruiser's Ceasefire Broadcast (AbilitySystem)
  }

  /** Destroy (harmlessly) all missiles within radius - Cutter's pulse. */
  clearMissilesNear(x, y, radius) {
    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const m = this.missiles[i];
      if (Phaser.Math.Distance.Between(x, y, m.x, m.y) <= radius) {
        this._detonateMissile(m, i);
      }
    }
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
        // Attitude changed (uplift, backfire, pacify...) - rebuild the
        // visual so halo/label match; recreated on the next renderVisible
        if (existing.visual && existing.visual.attitude !== civAttitude(civ)) {
          this.destroyVisual(existing.visual);
          existing.visual = null;
        }
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
    const attitude = civAttitude(civ);

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

    // Attitude flourishes: the world should read how they feel about you
    // at a glance, before you ever open the contact panel
    const extras = [];
    if (attitude === "worship") {
      // Golden halo + a slow orbiting votive light
      const halo = this.scene.add.graphics({ x, y }).setDepth(8);
      halo.lineStyle(1.5, 0xf5cf7a, 0.65);
      halo.strokeCircle(0, 0, 22);
      const votive = this.scene.add.circle(x + 22, y, 2.5, 0xf5cf7a, 0.95)
        .setDepth(9).setBlendMode(Phaser.BlendModes.ADD);
      const orbit = { angle: 0 };
      this.scene.tweens.add({
        targets: orbit, angle: Math.PI * 2, duration: 4000, repeat: -1,
        onUpdate: () => votive.setPosition(x + Math.cos(orbit.angle) * 22, y + Math.sin(orbit.angle) * 22),
      });
      extras.push(halo, votive);
    } else if (attitude === "hostile") {
      // Angry red threat pulse
      const threat = this.scene.add.graphics({ x, y }).setDepth(8);
      threat.lineStyle(1.5, 0xe0524a, 0.9);
      threat.strokeCircle(0, 0, 18);
      this.scene.tweens.add({
        targets: threat, alpha: { from: 0.9, to: 0.15 },
        duration: 450, yoyo: true, repeat: -1,
      });
      extras.push(threat);
    }

    const attitudeLine = ATTITUDE_LABEL[attitude] ? ` · ${ATTITUDE_LABEL[attitude]}` : "";
    const label = this.scene.add
      .text(x, y - 34, `[${civDesignation(civ.id)}]\n${civ.type.replace("Type", "TYPE ")}${attitudeLine} · [G] CONTACT`, {
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

    return { x, y, core, rings, label, extras, attitude };
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
    (visual.extras || []).forEach((obj) => {
      this.scene.tweens.getTweensOf(obj).forEach((t) => t.stop());
      obj.destroy();
    });
    visual.core.destroy();
    visual.label.destroy();
  }

  /**
   * Missile defense: hostile Type1+ civs fire slow-turning homing missiles
   * at the player inside MISSILE_RANGE. Outrun them (they expire), outturn
   * them (poor turn rate), or eat MISSILE_DAMAGE modified by hull armor.
   * Pure client-side ambience/danger - nothing persists.
   */
  update(time, delta) {
    const player = this.scene.player;
    if (!player?.body || this.scene.respawning) return;
    // Tachyon's Time Dilation slows the world - missiles included
    const dt = (delta / 1000) * (this.scene.worldTimeScale ?? 1);
    const paused = this.scene.inputSystem?.isMinigameActive;
    const invulnerable = time < (player.invulnerableUntil || 0);
    const ceasefire = time < this.ceasefireUntil;

    // Launches
    if (!paused && !invulnerable && !ceasefire && this.missiles.length < MAX_MISSILES) {
      for (const beacon of this.beacons.values()) {
        if (civAttitude(beacon.data) !== "hostile" || beacon.data.type === "Type0") continue;
        const { x, y } = beacon.data.location;
        if (Phaser.Math.Distance.Between(player.x, player.y, x, y) > MISSILE_RANGE) continue;

        if (!beacon.nextMissileAt) {
          // First detection grace so entering range isn't an instant launch
          beacon.nextMissileAt = time + 1800;
        } else if (time >= beacon.nextMissileAt) {
          beacon.nextMissileAt = time + MISSILE_COOLDOWN[0] + Math.random() * (MISSILE_COOLDOWN[1] - MISSILE_COOLDOWN[0]);
          this._launchMissile(x, y, time);
          if (this.missiles.length >= MAX_MISSILES) break;
        }
      }
    }

    // Flight
    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const m = this.missiles[i];

      if (time - m.bornAt > MISSILE_LIFESPAN) {
        this._fizzleMissile(m, i);
        continue;
      }

      if (!paused) {
        // Steer toward the player, turn-rate limited
        const desired = Math.atan2(player.y - m.y, player.x - m.x);
        const current = Math.atan2(m.vy, m.vx);
        const turn = Phaser.Math.Angle.Wrap(desired - current);
        const applied = Phaser.Math.Clamp(turn, -MISSILE_TURN * dt, MISSILE_TURN * dt);
        const heading = current + applied;
        m.vx = Math.cos(heading) * MISSILE_SPEED;
        m.vy = Math.sin(heading) * MISSILE_SPEED;
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        m.gfx.setPosition(m.x, m.y);
        m.gfx.rotation = heading + Math.PI / 2;
      }

      if (!invulnerable && Phaser.Math.Distance.Between(player.x, player.y, m.x, m.y) < MISSILE_HIT_RADIUS) {
        this._detonateMissile(m, i);
        const armor = HULL_STATS[getLoadoutLocal().hull]?.damageTaken ?? 1;
        const remaining = player.takeDamage(MISSILE_DAMAGE * armor);
        if (remaining <= 0) this.scene.handleShipDestroyed();
      }
    }
  }

  _launchMissile(x, y, time) {
    const player = this.scene.player;
    const angle = Math.atan2(player.y - y, player.x - x);

    const gfx = this.scene.add.graphics({ x, y }).setDepth(11);
    gfx.fillStyle(0xe0524a, 1);
    gfx.fillTriangle(0, -7, 4.5, 6, -4.5, 6);
    gfx.fillStyle(0xf5cf7a, 0.9);
    gfx.fillCircle(0, 7, 2); // exhaust glow
    gfx.rotation = angle + Math.PI / 2;

    this.missiles.push({
      x, y,
      vx: Math.cos(angle) * MISSILE_SPEED,
      vy: Math.sin(angle) * MISSILE_SPEED,
      bornAt: time,
      gfx,
    });
    playSfx("alert");
    narrateOnce('first-missile', pick(CURATOR.firstMissile));
  }

  _fizzleMissile(m, index) {
    this.scene.tweens.add({
      targets: m.gfx, alpha: 0, scale: 0.3, duration: 250,
      onComplete: () => m.gfx.destroy(),
    });
    this.missiles.splice(index, 1);
  }

  _detonateMissile(m, index) {
    const burst = this.scene.add.particles(m.x, m.y, "evtex:spark", {
      speed: { min: 60, max: 160 },
      scale: { start: 0.35, end: 0 },
      lifespan: { min: 200, max: 450 },
      quantity: 10,
      blendMode: "ADD",
      tint: [0xe0524a, 0xf5cf7a],
    });
    this.scene.time.delayedCall(500, () => burst.destroy());
    m.gfx.destroy();
    this.missiles.splice(index, 1);
    playSfx("minigameMiss");
  }

  destroy() {
    for (const beacon of this.beacons.values()) {
      if (beacon.visual) this.destroyVisual(beacon.visual);
    }
    this.beacons.clear();
    this.missiles.forEach((m) => m.gfx.destroy());
    this.missiles = [];
  }
}
