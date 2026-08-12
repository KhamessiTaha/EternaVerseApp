// src/components/game/systems/RiftSpawnSystem.js
//
// Rift sieges: severity-4+ Critical anomalies field an escort of rift-spawn -
// the unraveling given motion. Stingers orbit until you close, then dart in
// for contact damage; tethers hold their orbit and shell you with slow
// dumb-fire bolts. While any guard lives, the anomaly can't be resolved
// (InputSystem refuses F with a hint) - fight first, then contain.
//
// Client-side like the missile defense: seeded per anomaly id so a siege is
// identical on re-approach, session-cleared once beaten, galactic-scale only
// (cleared alongside anomaly visuals on descent). Kills drop salvage motes
// into the chunk - the reward loop with zero new server surface.
import Phaser from "phaser";
import seedrandom from "seedrandom";
import { dropSalvage } from "../world/salvageDrop.js";
import { playSfx } from "../audio.js";
import { getLoadoutLocal } from "../loadoutStore.js";
import { HULL_STATS } from "../content/hullCatalog.js";
import { narrate, narrateOnce, pick, CURATOR } from "../narrator.js";
import { siegeCompositionFor, RIFT_STATS } from "../combat/combatModel.js";

const CULL_DISTANCE = 5200;   // beyond this, visuals sleep (entities persist)
const SALVAGE_PER_KILL = [1, 2];

export class RiftSpawnSystem {
  constructor(scene) {
    this.scene = scene;
    this.sieges = new Map();       // anomalyId -> { entities: [] }
    this.clearedSieges = new Set(); // session-local: beaten sieges stay beaten
    this.enemyBolts = [];
  }

  /** Wire this system into the player's gun as a target source. */
  registerWith(combatSystem) {
    combatSystem.addProvider(() => this._combatTargets());
  }

  _combatTargets() {
    const out = [];
    for (const [anomalyId, siege] of this.sieges.entries()) {
      for (const e of siege.entities) {
        if (e.dead) continue;
        out.push({
          id: e.id,
          x: e.x,
          y: e.y,
          radius: RIFT_STATS[e.kind].radius,
          hit: (damage) => this._damageEntity(anomalyId, e, damage),
        });
      }
    }
    return out;
  }

  /** True while any guard of this anomaly still lives. */
  isBesieged(anomalyId) {
    const siege = this.sieges.get(anomalyId);
    return !!siege && siege.entities.some((e) => !e.dead);
  }

  /** Sync sieges from the anomaly roster (galactic scale only). */
  sync() {
    if ((this.scene.world?.scale ?? "galactic") !== "galactic") return;

    const active = new Set();
    this.scene.anomalySystem.backendAnomalies.forEach((anomaly, id) => {
      if (this.clearedSieges.has(id)) return;
      if (typeof anomaly.location?.x !== "number") return;
      const composition = siegeCompositionFor(anomaly.severity);
      if (composition.length === 0) return;
      active.add(id);
      if (!this.sieges.has(id)) {
        this.sieges.set(id, this._spawnSiege(id, anomaly, composition));
      }
    });

    // Anomaly resolved/vanished: its siege dissolves with it
    for (const [id, siege] of this.sieges.entries()) {
      if (!active.has(id)) {
        siege.entities.forEach((e) => this._destroyEntityGfx(e));
        this.sieges.delete(id);
      }
    }
  }

  _spawnSiege(anomalyId, anomaly, composition) {
    const rng = seedrandom(`${anomalyId}#siege`);
    const { x: ax, y: ay } = anomaly.location;
    const entities = composition.map((kind, i) => {
      const stats = RIFT_STATS[kind];
      const angle = rng() * Math.PI * 2;
      const radius = stats.orbitRadius * (0.85 + rng() * 0.3);
      return {
        id: `${anomalyId}#rs${i}`,
        kind,
        anchorX: ax,
        anchorY: ay,
        orbitAngle: angle,
        orbitRadius: radius,
        x: ax + Math.cos(angle) * radius,
        y: ay + Math.sin(angle) * radius,
        heading: angle + Math.PI / 2,
        hp: stats.hp,
        dead: false,
        nextTouchAt: 0,
        nextBoltAt: 0,
        stunnedUntil: 0,
        gfx: null,
      };
    });
    return { entities };
  }

  _damageEntity(anomalyId, entity, damage) {
    if (entity.dead) return true;
    entity.hp -= damage;
    if (entity.gfx) {
      // Hit flash
      entity.gfx.setAlpha(0.4);
      this.scene.time.delayedCall(70, () => entity.gfx?.setAlpha(1));
    }
    if (entity.hp > 0) return false;

    entity.dead = true;
    this._explode(entity);
    this._dropSalvage(entity);
    narrateOnce("first-rift-kill", pick(CURATOR.siege.firstKill));

    if (!this.isBesieged(anomalyId)) {
      this.clearedSieges.add(anomalyId);
      narrate(pick(CURATOR.siege.cleared), "proud");
      playSfx("surgeContained");
    }
    return true;
  }

  _explode(entity) {
    this._destroyEntityGfx(entity);
    const burst = this.scene.add.particles(entity.x, entity.y, "evtex:spark", {
      speed: { min: 70, max: 190 },
      scale: { start: 0.4, end: 0 },
      lifespan: { min: 250, max: 520 },
      quantity: 14,
      blendMode: "ADD",
      tint: [RIFT_STATS[entity.kind].color, 0xf5cf7a],
    });
    this.scene.time.delayedCall(600, () => burst.destroy());
    playSfx("explosion");
  }

  // Reward: salvage motes pushed into the entity's chunk (world/salvageDrop),
  // identical to the ones ChunkSystem seeds, so SalvageSystem collects them
  // without knowing what died.
  _dropSalvage(entity) {
    const [lo, hi] = SALVAGE_PER_KILL;
    dropSalvage(this.scene, entity.x, entity.y, lo + Math.floor(Math.random() * (hi - lo + 1)));
  }

  /** Containment Pulse interplay: briefly stun rift-spawn near the blast. */
  staggerNear(x, y, radius, durationMs = 2500) {
    const until = this.scene.time.now + durationMs;
    for (const siege of this.sieges.values()) {
      for (const e of siege.entities) {
        if (!e.dead && Phaser.Math.Distance.Between(x, y, e.x, e.y) <= radius) {
          e.stunnedUntil = until;
        }
      }
    }
  }

  update(time, delta) {
    const player = this.scene.player;
    if (!player?.body || this.scene.respawning) return;
    const dt = (delta / 1000) * (this.scene.worldTimeScale ?? 1);
    const paused = this.scene.inputSystem?.isMinigameActive;
    const invulnerable = time < (player.invulnerableUntil || 0);
    const armor = HULL_STATS[getLoadoutLocal().hull]?.damageTaken ?? 1;

    for (const siege of this.sieges.values()) {
      for (const e of siege.entities) {
        if (e.dead) continue;

        const playerDist = Phaser.Math.Distance.Between(player.x, player.y, e.x, e.y);

        // Visual lifecycle: create when near, sleep when far
        if (!e.gfx && playerDist < CULL_DISTANCE) e.gfx = this._createGfx(e);
        else if (e.gfx && playerDist > CULL_DISTANCE) this._destroyEntityGfx(e);

        if (paused || time < e.stunnedUntil) continue;

        const stats = RIFT_STATS[e.kind];
        if (e.kind === "stinger") {
          this._updateStinger(e, stats, player, playerDist, dt, time, invulnerable, armor);
        } else {
          this._updateTether(e, stats, player, playerDist, dt, time);
        }

        if (e.gfx) {
          e.gfx.setPosition(e.x, e.y);
          e.gfx.rotation = e.heading + Math.PI / 2;
        }
      }
    }

    this._updateEnemyBolts(player, dt, time, paused, invulnerable, armor);
  }

  _updateStinger(e, stats, player, playerDist, dt, time, invulnerable, armor) {
    if (playerDist < stats.aggroRange) {
      // Pursue: turn-rate-limited steering toward the player
      const desired = Math.atan2(player.y - e.y, player.x - e.x);
      const turn = Phaser.Math.Angle.Wrap(desired - e.heading);
      e.heading += Phaser.Math.Clamp(turn, -stats.turn * dt, stats.turn * dt);
      e.x += Math.cos(e.heading) * stats.speed * dt;
      e.y += Math.sin(e.heading) * stats.speed * dt;

      if (!invulnerable && playerDist < stats.radius + 20 && time >= e.nextTouchAt) {
        e.nextTouchAt = time + stats.touchCooldownMs;
        const remaining = player.takeDamage(stats.contactDamage * armor);
        playSfx("alert");
        if (remaining <= 0) this.scene.handleShipDestroyed();
      }
    } else {
      // Idle: drift around the anomaly
      e.orbitAngle += 0.6 * dt;
      e.x = e.anchorX + Math.cos(e.orbitAngle) * e.orbitRadius;
      e.y = e.anchorY + Math.sin(e.orbitAngle) * e.orbitRadius;
      e.heading = e.orbitAngle + Math.PI / 2;
    }
  }

  _updateTether(e, stats, player, playerDist, dt, time) {
    e.orbitAngle += stats.orbitSpeed * dt;
    e.x = e.anchorX + Math.cos(e.orbitAngle) * e.orbitRadius;
    e.y = e.anchorY + Math.sin(e.orbitAngle) * e.orbitRadius;
    e.heading = Math.atan2(player.y - e.y, player.x - e.x);

    if (playerDist < stats.range && time >= e.nextBoltAt) {
      e.nextBoltAt = time + stats.fireIntervalMs;
      const angle = e.heading; // dumb-fire: aimed at launch, never steers
      const gfx = this.scene.add.graphics({ x: e.x, y: e.y }).setDepth(6).setBlendMode(Phaser.BlendModes.ADD);
      gfx.fillStyle(stats.color, 0.95);
      gfx.fillCircle(0, 0, 5);
      this.enemyBolts.push({
        x: e.x, y: e.y,
        vx: Math.cos(angle) * stats.boltSpeed,
        vy: Math.sin(angle) * stats.boltSpeed,
        damage: stats.boltDamage,
        bornAt: time,
        lifespan: stats.boltLifespanMs,
        gfx,
      });
      playSfx("uiDenied");
    }
  }

  _updateEnemyBolts(player, dt, time, paused, invulnerable, armor) {
    for (let i = this.enemyBolts.length - 1; i >= 0; i--) {
      const b = this.enemyBolts[i];
      if (time - b.bornAt > b.lifespan) {
        b.gfx.destroy();
        this.enemyBolts.splice(i, 1);
        continue;
      }
      if (paused) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.gfx.setPosition(b.x, b.y);

      if (!invulnerable && Phaser.Math.Distance.Between(player.x, player.y, b.x, b.y) < 24) {
        b.gfx.destroy();
        this.enemyBolts.splice(i, 1);
        const remaining = player.takeDamage(b.damage * armor);
        playSfx("minigameMiss");
        if (remaining <= 0) this.scene.handleShipDestroyed();
      }
    }
  }

  _createGfx(e) {
    const stats = RIFT_STATS[e.kind];
    const gfx = this.scene.add.graphics({ x: e.x, y: e.y }).setDepth(9);
    if (e.kind === "stinger") {
      // Jagged sliver - a splinter of the tear itself
      gfx.fillStyle(stats.color, 0.95);
      gfx.fillTriangle(0, -12, 7, 8, -7, 8);
      gfx.lineStyle(1, 0xf5cf7a, 0.6);
      gfx.strokeTriangle(0, -12, 7, 8, -7, 8);
    } else {
      // Barbed ring - an anchored knot of unraveled fabric
      gfx.lineStyle(2.5, stats.color, 0.9);
      gfx.strokeCircle(0, 0, stats.radius - 4);
      gfx.fillStyle(stats.color, 0.8);
      [0, 90, 180, 270].forEach((deg) => {
        const rad = Phaser.Math.DegToRad(deg);
        gfx.fillCircle(Math.cos(rad) * (stats.radius - 4), Math.sin(rad) * (stats.radius - 4), 3.5);
      });
    }
    return gfx;
  }

  _destroyEntityGfx(e) {
    e.gfx?.destroy();
    e.gfx = null;
  }

  /** Drop everything (scale change): entities respawn from sync() on return. */
  clear() {
    for (const siege of this.sieges.values()) {
      siege.entities.forEach((e) => this._destroyEntityGfx(e));
    }
    this.sieges.clear();
    this.enemyBolts.forEach((b) => b.gfx.destroy());
    this.enemyBolts = [];
  }

  destroy() {
    this.clear();
  }
}
