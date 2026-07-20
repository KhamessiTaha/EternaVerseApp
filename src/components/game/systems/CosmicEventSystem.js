// src/components/game/systems/CosmicEventSystem.js
//
// Live cosmic events: timed, spatial happenings that interrupt cruising and
// demand a decision. One active at a time (they stay special). Three kinds:
//  - supernova: a star 2-3.5 chunks away detonates in 90s; get close to
//    capture spectral data (big RP) then get CLEAR of the blast
//  - comet: streaks across the region shedding hull-repair motes; skim the
//    head to sample it
//  - derelict: a dead hulk drifts nearby; hold position alongside to
//    salvage it (channel, like scanning)
// Rewards are claimed through the server (per-kind cooldowns); everything
// else is client-side spectacle. Curator announces each with a compass
// bearing; active events ping on both maps.
import Phaser from "phaser";
import { playSfx } from "../audio.js";
import { narrate, pick, CURATOR } from "../narrator.js";
import { getLoadoutLocal } from "../loadoutStore.js";
import { HULL_STATS } from "../content/hullCatalog.js";
import { TextureFactory } from "../graphics/TextureFactory.js";

const FIRST_EVENT_DELAY = [45000, 80000];
const EVENT_INTERVAL = [70000, 130000];
const SPAWN_DIST = [2000, 3500]; // world units from player

const compass = (dx, dy) => {
  const dirs = ["east", "southeast", "south", "southwest", "west", "northwest", "north", "northeast"];
  const idx = Math.round(((Math.atan2(dy, dx) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8;
  return dirs[idx];
};

export class CosmicEventSystem {
  constructor(scene) {
    this.scene = scene;
    this.active = null;
    this.nextAt = scene.time.now + Phaser.Math.Between(...FIRST_EVENT_DELAY);
  }

  getMapMarkers() {
    return this.active ? [{ x: this.active.x, y: this.active.y, kind: this.active.kind }] : [];
  }

  update(time, delta) {
    if (this.scene.respawning) return;
    if (this.active) {
      this[`_update_${this.active.kind}`](time, delta * (this.scene.worldTimeScale ?? 1));
    } else if (time >= this.nextAt && !this.scene.inputSystem?.isMinigameActive) {
      this._spawn(time);
    }
  }

  _finish() {
    this.active = null;
    this.nextAt = this.scene.time.now + Phaser.Math.Between(...EVENT_INTERVAL);
  }

  _spawn(time) {
    const p = this.scene.player;
    const angle = Math.random() * Math.PI * 2;
    const dist = Phaser.Math.Between(...SPAWN_DIST);
    const x = p.x + Math.cos(angle) * dist;
    const y = p.y + Math.sin(angle) * dist;
    const dir = compass(x - p.x, y - p.y);

    const roll = Math.random();
    if (roll < 0.35) this._spawnSupernova(time, x, y, dir);
    else if (roll < 0.7) this._spawnComet(time, x, y, dir);
    else this._spawnDerelict(time, x, y, dir);

    playSfx("alert");
  }

  _claim(kind) {
    this.scene.onEventReward?.(kind);
  }

  _label(x, y, text, colorHex) {
    return this.scene.add.text(x, y - 46, text, {
      fontFamily: '"IBM Plex Mono", monospace',
      fontSize: "11px",
      color: colorHex,
      align: "center",
      backgroundColor: "#0c0f1c",
      padding: { x: 8, y: 5 },
    }).setOrigin(0.5).setDepth(1000);
  }

  // ---------------------------------------------------------- supernova

  _spawnSupernova(time, x, y, dir) {
    const core = this.scene.add.circle(x, y, 12, 0xfff2d5, 1)
      .setDepth(8).setBlendMode(Phaser.BlendModes.ADD);
    const glow = this.scene.add.circle(x, y, 30, 0xffca7a, 0.3)
      .setDepth(7).setBlendMode(Phaser.BlendModes.ADD);
    const light = this.scene.lights.addLight(x, y, 700, 0xffd9a0, 2);
    const label = this._label(x, y, "", "#e0824a");

    this.active = {
      kind: "supernova", x, y, core, glow, light, label,
      detonateAt: time + 90000, captured: false,
    };
    narrate(CURATOR.events.supernova(dir));
  }

  _update_supernova(time) {
    const e = this.active;
    const p = this.scene.player;
    const remaining = Math.max(0, Math.ceil((e.detonateAt - time) / 1000));

    // Increasingly violent pulsing as the end approaches
    const panic = 1 - Math.min(1, (e.detonateAt - time) / 90000);
    const throb = 1 + panic * 1.6 + Math.sin(time / (120 - panic * 80)) * 0.25 * (1 + panic);
    e.core.setScale(throb);
    e.glow.setScale(throb * (1 + panic));
    e.light.setIntensity(2 + panic * 3);

    e.label.setText(
      `DYING STAR\nT-${remaining}s${e.captured ? " · DATA ACQUIRED" : " · APPROACH TO SCAN"}`
    );

    if (!e.captured && Phaser.Math.Distance.Between(p.x, p.y, e.x, e.y) < 280) {
      e.captured = true;
      playSfx("scanComplete");
      narrate(pick(CURATOR.events.supernovaCaptured));
      this._claim("supernova");
    }

    if (time >= e.detonateAt) this._detonateSupernova();
  }

  _detonateSupernova() {
    const e = this.active;
    const p = this.scene.player;

    // The full cinematic burst, severity 5, white-gold
    this.scene.anomalySystem.playResolutionEffect(e.x, e.y, 0xffe2b0, 5);
    playSfx("explosion");

    // Blast damage inside 700 units, falling off with distance
    const dist = Phaser.Math.Distance.Between(p.x, p.y, e.x, e.y);
    if (dist < 700 && this.scene.time.now >= (p.invulnerableUntil || 0)) {
      const armor = HULL_STATS[getLoadoutLocal().hull]?.damageTaken ?? 1;
      const dmg = Math.round(35 * (1 - dist / 700) * armor);
      if (dmg > 0) {
        const remaining = p.takeDamage(dmg);
        if (remaining <= 0) this.scene.handleShipDestroyed();
      }
    }

    // Fading remnant glow where the star was
    const remnant = this.scene.add.circle(e.x, e.y, 60, 0xc77dd8, 0.18)
      .setDepth(6).setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({
      targets: remnant, alpha: 0, scale: 2.2, duration: 20000,
      onComplete: () => remnant.destroy(),
    });

    this._cleanupSupernova();
    this._finish();
  }

  _cleanupSupernova() {
    const e = this.active;
    e.core.destroy();
    e.glow.destroy();
    e.label.destroy();
    this.scene.lights.removeLight(e.light);
  }

  // -------------------------------------------------------------- comet

  _spawnComet(time, x, y, dir) {
    const p = this.scene.player;
    // Aim to pass NEAR the player (offset so it crosses, not hits)
    const aimX = p.x + (Math.random() - 0.5) * 1200;
    const aimY = p.y + (Math.random() - 0.5) * 1200;
    const angle = Math.atan2(aimY - y, aimX - x);

    const head = this.scene.add.circle(x, y, 7, 0xdff6ff, 1)
      .setDepth(8).setBlendMode(Phaser.BlendModes.ADD);
    const light = this.scene.lights.addLight(x, y, 300, 0x9fe6f0, 1.5);
    const tail = this.scene.add.particles(x, y, "evtex:spark", {
      speed: { min: 10, max: 40 },
      scale: { start: 0.35, end: 0 },
      lifespan: { min: 500, max: 1100 },
      frequency: 45,
      blendMode: "ADD",
      tint: [0x9fe6f0, 0xffffff],
    });
    const label = this._label(x, y, "COMET\nSKIM THE HEAD TO SAMPLE", "#4ec9e0");

    this.active = {
      kind: "comet", x, y, head, tail, light, label,
      vx: Math.cos(angle) * 95, vy: Math.sin(angle) * 95,
      endAt: time + 65000, sampled: false, motes: [], lastMoteAt: 0,
    };
    narrate(CURATOR.events.comet(dir));
  }

  _update_comet(time, delta) {
    const e = this.active;
    const p = this.scene.player;
    const dt = delta / 1000;

    e.x += e.vx * dt;
    e.y += e.vy * dt;
    e.head.setPosition(e.x, e.y);
    e.tail.setPosition(e.x, e.y);
    e.light.setPosition(e.x, e.y);
    e.label.setPosition(e.x, e.y - 46);

    // Shed a hull-repair mote in the wake every ~700ms
    if (time - e.lastMoteAt > 700) {
      e.lastMoteAt = time;
      const gfx = this.scene.add.graphics({ x: e.x, y: e.y }).setDepth(3);
      gfx.fillStyle(0x9fe6f0, 0.9);
      gfx.fillRect(-2.5, -2.5, 5, 5);
      gfx.rotation = Math.PI / 4;
      const mote = { x: e.x, y: e.y, gfx, collected: false };
      e.motes.push(mote);
      this.scene.tweens.add({
        targets: gfx, alpha: 0, delay: 14000, duration: 2000,
        onComplete: () => { mote.collected = true; gfx.destroy(); },
      });
    }

    // Collect wake motes by flying through them
    for (const mote of e.motes) {
      if (mote.collected) continue;
      if (Phaser.Math.Distance.Between(p.x, p.y, mote.x, mote.y) < 42) {
        mote.collected = true;
        this.scene.tweens.killTweensOf(mote.gfx);
        mote.gfx.destroy();
        p.heal(4);
        playSfx("salvage");
      }
    }

    // Sample the head at close range (the risky, rewarding part)
    if (!e.sampled && Phaser.Math.Distance.Between(p.x, p.y, e.x, e.y) < 200) {
      e.sampled = true;
      e.label.setText("COMET\nSAMPLED");
      playSfx("scanComplete");
      this._claim("comet");
    }

    if (time >= e.endAt) {
      e.motes.forEach((m) => { if (!m.collected) { this.scene.tweens.killTweensOf(m.gfx); m.gfx.destroy(); } });
      e.head.destroy();
      e.tail.destroy();
      e.label.destroy();
      this.scene.lights.removeLight(e.light);
      this._finish();
    }
  }

  // ----------------------------------------------------------- derelict

  _spawnDerelict(time, x, y, dir) {
    const hulk = this.scene.add.image(x, y, TextureFactory.hullKey("hauler"))
      .setScale(0.11).setTint(0x6a7086).setAlpha(0.9)
      .setRotation(Math.random() * Math.PI * 2).setDepth(4);
    const light = this.scene.lights.addLight(x, y, 220, 0x9497ad, 0.8);
    const label = this._label(x, y, "DERELICT HULK\nHOLD POSITION ALONGSIDE TO SALVAGE", "#9497ad");
    const ring = this.scene.add.graphics({ x, y }).setDepth(999);

    this.active = {
      kind: "derelict", x, y, hulk, light, label, ring,
      endAt: time + 180000, progress: 0, needed: 2500, done: false,
      driftAngle: Math.random() * Math.PI * 2,
    };
    narrate(CURATOR.events.derelict(dir));
  }

  _update_derelict(time, delta) {
    const e = this.active;
    const p = this.scene.player;

    // Slow drift + slow tumble
    e.x += Math.cos(e.driftAngle) * 8 * (delta / 1000);
    e.y += Math.sin(e.driftAngle) * 8 * (delta / 1000);
    e.hulk.setPosition(e.x, e.y);
    e.hulk.rotation += 0.0004 * delta;
    e.light.setPosition(e.x, e.y);
    e.label.setPosition(e.x, e.y - 52);
    e.ring.setPosition(e.x, e.y);

    // Salvage channel: progress while close, decay while away
    const near = Phaser.Math.Distance.Between(p.x, p.y, e.x, e.y) < 170;
    e.progress = Phaser.Math.Clamp(e.progress + (near ? delta : -delta * 1.5), 0, e.needed);

    e.ring.clear();
    if (e.progress > 0) {
      e.ring.lineStyle(3, 0xdfa73f, 0.9);
      e.ring.beginPath();
      e.ring.arc(0, 0, 30, -Math.PI / 2, -Math.PI / 2 + (e.progress / e.needed) * Math.PI * 2);
      e.ring.strokePath();
    }

    if (!e.done && e.progress >= e.needed) {
      e.done = true;
      p.heal(25);
      playSfx("install");
      narrate(pick(CURATOR.events.derelictLooted));
      this._claim("derelict");

      const burst = this.scene.add.particles(e.x, e.y, "evtex:spark", {
        speed: { min: 40, max: 140 }, scale: { start: 0.4, end: 0 },
        lifespan: 600, quantity: 14, blendMode: "ADD", tint: [0xdfa73f, 0xffffff],
      });
      this.scene.time.delayedCall(700, () => burst.destroy());
      this._cleanupDerelict();
      this._finish();
      return;
    }

    if (time >= e.endAt) {
      this._cleanupDerelict();
      this._finish();
    }
  }

  _cleanupDerelict() {
    const e = this.active;
    this.scene.tweens.add({
      targets: e.hulk, alpha: 0, duration: 600,
      onComplete: () => e.hulk.destroy(),
    });
    e.label.destroy();
    e.ring.destroy();
    this.scene.lights.removeLight(e.light);
  }

  destroy() {
    if (!this.active) return;
    if (this.active.kind === "supernova") this._cleanupSupernova();
    else if (this.active.kind === "derelict") this._cleanupDerelict();
    else if (this.active.kind === "comet") {
      const e = this.active;
      e.motes.forEach((m) => { if (!m.collected) m.gfx.destroy(); });
      e.head.destroy(); e.tail.destroy(); e.label.destroy();
      this.scene.lights.removeLight(e.light);
    }
    this.active = null;
  }
}
