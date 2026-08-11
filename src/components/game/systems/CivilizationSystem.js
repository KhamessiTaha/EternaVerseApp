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
import { civVisibleAt, civLocation, civAnchorObject, civHostStructureAt, civInDistress } from "../world/civPlacement.js";
import { cosmicProfile } from "../world/cosmicProfile.js";
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

// How far a civilization's presence reaches, by tier - drives the broadcast
// ring and the interaction prompt. A galactic power is felt from much further
// away than a people who just invented radio.
const TIER_SCALE = { Type0: 12, Type1: 20, Type2: 38, Type3: 66 };

// Deterministic per-civ jitter, so a given people's city-lights always fall in
// the same places on their world.
const hashUnit = (id, i) => {
  let h = 2166136261;
  const s = `${id}#${i}`;
  for (let k = 0; k < s.length; k++) { h ^= s.charCodeAt(k); h = Math.imul(h, 16777619); }
  return (Math.abs(h) % 10000) / 10000;
};
const hashAngle = (id, i) => hashUnit(id, i) * Math.PI * 2;

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

  /** Is this civ currently in one of the universe's active wars? */
  _isAtWar(civId) {
    return !!(this.scene.universe?.activeWars || []).find((w) => w.a === civId || w.b === civId);
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
        // Attitude or war status changed - rebuild the visual so halo/label
        // match; recreated on the next renderVisible
        if (existing.visual &&
            (existing.visual.attitude !== civAttitude(civ) ||
             existing.visual.atWar !== this._isAtWar(civ.id) ||
             existing.visual.ascended !== !!civ.ascended)) {
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
  // Destroy all civ beacon visuals (data kept) - used when descending a cosmic
  // scale. renderVisible recreates them at the galactic scale.
  clearVisuals() {
    for (const beacon of this.beacons.values()) {
      if (beacon.visual) {
        this.destroyVisual(beacon.visual);
        beacon.visual = null;
      }
    }
  }

  renderVisible(loadedChunks) {
    const player = this.scene.player;
    // Civ placement derives its own per-scale seeds, so it MUST get the base
    // universe seed - not worldSeed(), which changes on descent and would hide
    // a civ's beacon at its own (deeper) home scale.
    const seed = this.scene.universe?.seed ?? "seed";
    const world = this.scene.world ?? { scale: "galactic", path: [] };
    // Place civs against the SAME density the world is rendered with, so their
    // home galaxy/star exists on screen (Coherent Cosmos consistency).
    const cp = cosmicProfile(this.scene.universe?.currentState);

    for (const beacon of this.beacons.values()) {
      // A civ only appears at the scale + descent path it actually inhabits
      // (Cosmic Scales Phase 2). Its beacon position is derived per-civ.
      beacon.visible = civVisibleAt(seed, beacon.data, world, cp);
      if (!beacon.visible) {
        if (beacon.visual) { this.destroyVisual(beacon.visual); beacon.visual = null; }
        continue;
      }

      // Anchored to the actual world/star/galaxy the civ inhabits, so the
      // beacon is drawn ONTO its home rather than floating in nearby space.
      const anchor = civAnchorObject(seed, beacon.data, cp);
      const { x, y } = civLocation(beacon.data, seed, cp);
      beacon.loc = { x, y };
      beacon.anchor = anchor;

      if (!beacon.visual) {
        const chunk = getChunkCoords(x, y);
        if (loadedChunks.has(getChunkKey(chunk.chunkX, chunk.chunkY))) {
          beacon.visual = this.createBeacon(beacon.data, beacon.loc);
        }
      } else if (player && Phaser.Math.Distance.Between(player.x, player.y, x, y) > CULL_DISTANCE) {
        this.destroyVisual(beacon.visual);
        beacon.visual = null;
      }
    }

    this._renderHostMarkers(loadedChunks, seed, world, cp);
  }

  // Mark descendable structures (galaxies at galactic, stars at stellar) that
  // contain a civ living deeper, so descent is purposeful. A structure hosting
  // a civ in DISTRESS pulses urgent red (a distress signal to follow down);
  // otherwise it's a calm green "civilization present" mark.
  _renderHostMarkers(loadedChunks, seed, world, cp) {
    (this._hostMarkers || []).forEach((m) => { this.scene.tweens.killTweensOf(m); m.destroy(); });
    this._hostMarkers = [];

    const normal = new Set();
    const distress = new Set();
    for (const beacon of this.beacons.values()) {
      const id = civHostStructureAt(seed, beacon.data, world, cp);
      if (!id) continue;
      if (civInDistress(beacon.data)) distress.add(id); else normal.add(id);
    }
    if (normal.size === 0 && distress.size === 0) return;

    for (const chunk of loadedChunks.values()) {
      for (const entry of chunk.objects) {
        const id = entry.descriptor.id;
        const isDistress = distress.has(id);
        if (!isDistress && !normal.has(id)) continue;
        const { x, y } = entry.descriptor;
        const color = isDistress ? 0xe0524a : 0x4fd1a5;
        const marker = this.scene.add.graphics({ x, y }).setDepth(7);
        marker.lineStyle(isDistress ? 2 : 1.5, color, 0.95);
        marker.strokeCircle(0, 0, 22);
        this.scene.tweens.add({
          targets: marker,
          scaleX: isDistress ? 1.9 : 1.5, scaleY: isDistress ? 1.9 : 1.5,
          alpha: { from: 0.95, to: 0.2 },
          duration: isDistress ? 850 : 1500, yoyo: true, repeat: -1, ease: "Sine.easeInOut",
        });
        this._hostMarkers.push(marker);
      }
    }
  }

  /**
   * The civilization itself, drawn onto its world. Returns a container holding
   * every piece so the caller can move/destroy it as one object.
   *
   * Solar-2 language throughout: soft additive glow, no hard outlines, nothing
   * static. Every tier orbits, breathes, or pulses - a civilization should look
   * like something living on a world, not a marker pinned near one.
   */
  _createTierVisual(civ, x, y, color) {
    const container = this.scene.add.container(x, y).setDepth(9);
    const t = this.scene.tweens;
    const add = (obj) => { container.add(obj); return obj; };
    // Tweens that drive a plain proxy object (not a display child) must be
    // tracked explicitly - nothing else can find them at teardown, and an
    // orphaned onUpdate would keep poking a destroyed sprite.
    container.proxyTweens = [];

    if (civ.type === "Type3") {
      // GALACTIC: the galaxy's arms are threaded with light. Nodes of
      // civilization pulse outward along the spiral - the whole structure
      // is inhabited.
      const arms = 3;
      const nodesPerArm = 7;
      for (let a = 0; a < arms; a++) {
        const phase = (a / arms) * Math.PI * 2;
        for (let n = 0; n < nodesPerArm; n++) {
          const tt = 0.35 + (n / nodesPerArm) * 2.4;
          const r = 9 * Math.exp(0.30 * tt);
          const ang = tt + phase;
          const node = add(
            this.scene.add.circle(Math.cos(ang) * r, Math.sin(ang) * r, 2.2, color, 0.95)
              .setBlendMode(Phaser.BlendModes.ADD)
          );
          // A slow wave of light travelling outward along each arm
          t.add({
            targets: node,
            alpha: { from: 0.15, to: 1 },
            scale: { from: 0.6, to: 1.5 },
            duration: 900,
            delay: n * 190 + a * 120,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
          });
        }
      }
      // The whole galaxy turns, very slowly
      t.add({ targets: container, angle: 360, duration: 240000, repeat: -1 });
      const halo = add(
        this.scene.add.circle(0, 0, 62, color, 0.05).setBlendMode(Phaser.BlendModes.ADD)
      );
      t.add({
        targets: halo, alpha: { from: 0.05, to: 0.14 }, scale: { from: 1, to: 1.12 },
        duration: 4200, yoyo: true, repeat: -1, ease: "Sine.easeInOut",
      });

    } else if (civ.type === "Type2") {
      // STELLAR: a Dyson swarm. Collector arcs orbit the star at different
      // rates, eclipsing it as they pass - the star flickers behind its own
      // harvested light.
      const starGlow = add(
        this.scene.add.circle(0, 0, 13, 0xffe6b0, 0.85).setBlendMode(Phaser.BlendModes.ADD)
      );
      t.add({
        targets: starGlow, alpha: { from: 0.6, to: 0.95 }, scale: { from: 0.94, to: 1.06 },
        duration: 1700, yoyo: true, repeat: -1, ease: "Sine.easeInOut",
      });

      // Three collector rings at different radii/tilts, each a partial arc so
      // the swarm reads as segments rather than a solid shell.
      [0, 1, 2].forEach((i) => {
        const radius = 24 + i * 9;
        const ring = this.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
        ring.lineStyle(2.5, color, 0.85);
        // Two opposing arcs = a swarm mid-construction, not a finished sphere
        ring.beginPath();
        ring.arc(0, 0, radius, 0, Math.PI * 0.62);
        ring.strokePath();
        ring.beginPath();
        ring.arc(0, 0, radius, Math.PI, Math.PI * 1.62);
        ring.strokePath();
        ring.setScale(1, 0.42 + i * 0.14); // tilted orbital planes
        add(ring);
        t.add({
          targets: ring,
          angle: i % 2 === 0 ? 360 : -360,
          duration: 14000 + i * 6000,
          repeat: -1,
        });
      });

    } else if (civ.type === "Type1") {
      // PLANETARY (mastered): the whole world is lit. A warm halo, a bright
      // band of city-light across the terminator, and a thin ring of orbital
      // infrastructure turning overhead.
      const world = add(
        this.scene.add.circle(0, 0, 9, color, 0.5).setBlendMode(Phaser.BlendModes.ADD)
      );
      t.add({
        targets: world, alpha: { from: 0.35, to: 0.6 },
        duration: 2600, yoyo: true, repeat: -1, ease: "Sine.easeInOut",
      });

      // City-light band
      const band = this.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
      band.fillStyle(0xffe9a8, 0.9);
      for (let i = 0; i < 14; i++) {
        const ang = (i / 14) * Math.PI * 2;
        band.fillCircle(Math.cos(ang) * 7.5, Math.sin(ang) * 3.2, 1.1);
      }
      add(band);
      t.add({
        targets: band, alpha: { from: 0.55, to: 1 },
        duration: 1500, yoyo: true, repeat: -1, ease: "Sine.easeInOut",
      });

      // Orbital ring
      const orbit = this.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
      orbit.lineStyle(1.2, color, 0.75);
      orbit.strokeCircle(0, 0, 17);
      orbit.setScale(1, 0.35);
      add(orbit);
      t.add({ targets: orbit, angle: 360, duration: 22000, repeat: -1 });

      // A single station catching the light as it goes round
      const station = add(
        this.scene.add.circle(17, 0, 1.8, 0xffffff, 1).setBlendMode(Phaser.BlendModes.ADD)
      );
      const orbitState = { a: 0 };
      container.proxyTweens.push(t.add({
        targets: orbitState, a: Math.PI * 2, duration: 9000, repeat: -1,
        onUpdate: () => {
          if (!station.scene) return; // destroyed mid-flight
          station.setPosition(Math.cos(orbitState.a) * 17, Math.sin(orbitState.a) * 6);
        },
      }));

    } else {
      // EMERGENT (Type 0): scattered city-lights on the night side. Faint,
      // irregular, easy to miss - someone down there has only just begun.
      const lights = [];
      for (let i = 0; i < 7; i++) {
        const ang = hashAngle(civ.id, i);
        const r = 2 + (hashUnit(civ.id, i) * 5);
        const light = add(
          this.scene.add.circle(Math.cos(ang) * r, Math.sin(ang) * r, 1.1, 0xffd9a0, 0.9)
            .setBlendMode(Phaser.BlendModes.ADD)
        );
        lights.push(light);
        // Each light flickers on its own irregular cadence
        t.add({
          targets: light,
          alpha: { from: 0.25, to: 1 },
          duration: 700 + hashUnit(civ.id, i + 20) * 1400,
          delay: hashUnit(civ.id, i + 40) * 900,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
      }
      const dim = add(
        this.scene.add.circle(0, 0, 8, color, 0.12).setBlendMode(Phaser.BlendModes.ADD)
      );
      t.add({
        targets: dim, alpha: { from: 0.08, to: 0.2 },
        duration: 3200, yoyo: true, repeat: -1, ease: "Sine.easeInOut",
      });
    }

    return container;
  }

  createBeacon(civ, loc) {
    const { x, y } = loc ?? civ.location;
    // A dying civ's beacon burns urgent red - the distress signal, up close.
    const color = civInDistress(civ) ? 0xe0524a : (CIV_TYPE_COLORS[civ.type] ?? CIV_TYPE_COLORS.Type0);
    const attitude = civAttitude(civ);

    // The civilization is drawn ON its world. Each Kardashev tier gets its own
    // structure - you read how advanced a people are from across the system,
    // before any label: scattered city-lights, a lit and ringed homeworld, a
    // Dyson swarm eclipsing a star, a galaxy threaded with light.
    const core = this._createTierVisual(civ, x, y, color);

    // Broadcast rings: the universal "signal source" pulse. Scaled to the
    // civ's presence so a galactic power broadcasts across a galaxy.
    const ringRadius = TIER_SCALE[civ.type] ?? TIER_SCALE.Type0;
    const rings = [0, 1].map((i) => {
      const ring = this.scene.add.graphics({ x, y }).setDepth(8)
        .setBlendMode(Phaser.BlendModes.ADD);
      ring.lineStyle(1.5, color, 0.55);
      ring.strokeCircle(0, 0, ringRadius);
      this.scene.tweens.add({
        targets: ring,
        scaleX: 3.2,
        scaleY: 3.2,
        alpha: { from: 0.55, to: 0 },
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

    // Your chosen species is crowned with a gold star, so you can find the
    // people whose story you're shaping anywhere in the universe.
    if (this.scene.universe?.chosenCivId === civ.id) {
      const star = this.scene.add.text(x, y - 26, "★", {
        fontFamily: '"IBM Plex Mono", monospace', fontSize: "16px", color: "#f5cf7a",
      }).setOrigin(0.5).setDepth(10);
      this.scene.tweens.add({
        targets: star, y: y - 30, alpha: { from: 1, to: 0.55 },
        duration: 1200, yoyo: true, repeat: -1, ease: "Sine.easeInOut",
      });
      extras.push(star);
    }

    // An ascended people (a completed legacy) wear a permanent radiant crown -
    // a double halo and a bright glyph - so a shepherd's finished work is
    // visible forever, even after the mantle passed to someone new.
    if (civ.ascended) {
      const crown = this.scene.add.text(x, y - 27, "✦", {
        fontFamily: '"IBM Plex Mono", monospace', fontSize: "18px", color: "#ffe9a8",
      }).setOrigin(0.5).setDepth(11).setBlendMode(Phaser.BlendModes.ADD);
      this.scene.tweens.add({
        targets: crown, alpha: { from: 1, to: 0.6 }, scale: { from: 1, to: 1.15 },
        duration: 1600, yoyo: true, repeat: -1, ease: "Sine.easeInOut",
      });
      const aura = this.scene.add.graphics({ x, y }).setDepth(7);
      aura.lineStyle(2, 0xffe9a8, 0.5);
      aura.strokeCircle(0, 0, 26);
      aura.lineStyle(1, 0xffe9a8, 0.3);
      aura.strokeCircle(0, 0, 34);
      this.scene.tweens.add({
        targets: aura, angle: 360, duration: 18000, repeat: -1,
      });
      extras.push(crown, aura);
    }

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

    const atWar = this._isAtWar(civ.id);
    const attitudeLine = ATTITUDE_LABEL[attitude] ? ` · ${ATTITUDE_LABEL[attitude]}` : "";
    const warLine = atWar ? " · AT WAR" : "";
    const label = this.scene.add
      .text(x, y - 34, `[${civDesignation(civ.id)}]\n${civ.type.replace("Type", "TYPE ")}${attitudeLine}${warLine} · [G] CONTACT`, {
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

    return { x, y, core, rings, label, extras, attitude, atWar, ascended: !!civ.ascended };
  }

  /** Show/hide contact prompts based on player proximity. Bigger powers are
   *  hailable from further out - their presence physically reaches further. */
  handleInteraction(player, range = 300) {
    for (const beacon of this.beacons.values()) {
      if (!beacon.visual) continue;
      const reach = range + (TIER_SCALE[beacon.data.type] ?? 0) * 4;
      const inRange =
        Phaser.Math.Distance.Between(player.x, player.y, beacon.visual.x, beacon.visual.y) < reach;
      beacon.visual.label.setVisible(inRange);
    }
  }

  /** Nearest contactable civilization within range, as plain data. Only civs
   *  rendered at the current scale (with a live beacon) are contactable. */
  findNearest(player, range = 300) {
    let nearest = null;
    let best = Infinity;
    for (const beacon of this.beacons.values()) {
      if (!beacon.visual) continue;
      const { x, y } = beacon.loc ?? beacon.data.location;
      const d = Phaser.Math.Distance.Between(player.x, player.y, x, y);
      // Each civ is hailable within its OWN reach (matches the prompt shown by
      // handleInteraction), and among those we take the closest.
      const reach = range + (TIER_SCALE[beacon.data.type] ?? 0) * 4;
      if (d < reach && d < best) {
        best = d;
        nearest = beacon.data;
      }
    }
    return nearest;
  }

  /** Beacon positions for the map layers - only civs present at this scale. */
  getMapMarkers() {
    return Array.from(this.beacons.values())
      .filter((b) => b.visible)
      .map((b) => ({
        x: (b.loc ?? b.data.location).x,
        y: (b.loc ?? b.data.location).y,
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
    // The tier visual is a container of independently-animated parts: kill the
    // tweens on the container, on every child, and on any proxy driver before
    // destroying the tree.
    if (visual.core) {
      this.scene.tweens.killTweensOf(visual.core);
      (visual.core.list || []).forEach((child) => this.scene.tweens.killTweensOf(child));
      (visual.core.proxyTweens || []).forEach((tw) => tw.stop());
      visual.core.destroy(true);
    }
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
        if (!beacon.visual) continue; // only civs present at this scale fire
        if (civAttitude(beacon.data) !== "hostile" || beacon.data.type === "Type0") continue;
        const { x, y } = beacon.loc ?? beacon.data.location;
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
