// src/components/game/systems/CivFleetSystem.js
//
// Civilization vessels. Every space-faring people keeps ships around its
// homeworld, and when two civilizations go to war one of them sends a strike
// force to the other's home - which is where the player can intervene.
//
// The loop this creates:
//   * shoot a people's ships and that people turns on you (a grudge, then war
//     footing) - aggression has a diplomatic price
//   * hostile civilizations open fire on sight, unprovoked
//   * a besieged world is visibly under attack; destroy the raiders and you
//     have SAVED them - the war tips, and they remember it
//
// Client-side like the rift-spawn siege: ships are ambience with teeth, and
// only the CONSEQUENCES (relationship, war score) are reported to the server,
// which owns and validates them.
import Phaser from "phaser";
import { playSfx } from "../audio.js";
import { getLoadoutLocal } from "../loadoutStore.js";
import { HULL_STATS } from "../content/hullCatalog.js";
import { civAttitude } from "../utils";
import { narrate, narrateOnce, pick, CURATOR } from "../narrator.js";
import {
  SHIP_CLASSES, PATROL_RADIUS, GRUDGE_MS,
  fleetFor, raidFleetFor, shipStance, besiegerOf,
} from "../combat/fleetModel.js";
import { CIV_TYPE_COLORS } from "./CivilizationSystem.js";

const RAIDER_COLOR = 0xe0524a;
const CULL_DISTANCE = 6000;

export class CivFleetSystem {
  constructor(scene) {
    this.scene = scene;
    this.fleets = new Map();   // civId -> { ships: [], defenderOf: civId|null }
    this.bolts = [];
    this.grudges = new Map();  // civId -> expiry timestamp
    this.onStrike = null;      // (civId, kills, context) -> reported to the server
  }

  registerWith(combatSystem) {
    combatSystem.addProvider(() => this._targets());
  }

  _targets() {
    const out = [];
    for (const fleet of this.fleets.values()) {
      for (const s of fleet.ships) {
        if (s.dead) continue;
        out.push({
          id: s.id,
          x: s.x,
          y: s.y,
          radius: SHIP_CLASSES[s.cls].radius,
          hit: (damage) => this._damageShip(s, damage),
        });
      }
    }
    return out;
  }

  /** Has the player angered this people recently? Drives stance + attitude. */
  hasGrudge(civId) {
    return this.scene.time.now < (this.grudges.get(civId) ?? 0);
  }

  /**
   * Build fleets for every civilization currently rendered at this scale. A
   * civ's ships live at its home; a besieger's raiders are spawned AT the
   * defender's home, so a war is something you fly into the middle of.
   */
  sync() {
    const civSystem = this.scene.civilizationSystem;
    if (!civSystem) return;

    const wanted = new Set();
    for (const beacon of civSystem.beacons.values()) {
      if (!beacon.visible || !beacon.loc) continue;
      const civ = beacon.data;

      // The defenders of this world
      const defenders = fleetFor(civ);
      if (defenders.length) {
        wanted.add(civ.id);
        if (!this.fleets.has(civ.id)) {
          this.fleets.set(civ.id, {
            ships: this._buildShips(civ, defenders, beacon.loc, false, civ.id),
            home: beacon.loc,
          });
        }
      }

      // ...and whoever has come to burn it
      const enemyId = besiegerOf(civ.id, this.scene.universe?.activeWars || []);
      if (!enemyId) continue;
      const enemy = (this.scene.universe?.civilizations || []).find((c) => c.id === enemyId);
      if (!enemy || enemy.extinct) continue;
      const raiders = raidFleetFor(enemy);
      if (!raiders.length) continue;

      const raidKey = `${enemyId}@${civ.id}`;
      wanted.add(raidKey);
      if (!this.fleets.has(raidKey)) {
        this.fleets.set(raidKey, {
          ships: this._buildShips(enemy, raiders, beacon.loc, true, civ.id),
          home: beacon.loc,
        });
        narrateOnce(`siege:${raidKey}`, pick(CURATOR.fleet.siege));
      }
    }

    // Drop fleets whose civ is no longer here (scale change, extinction, peace)
    for (const [key, fleet] of this.fleets.entries()) {
      if (!wanted.has(key)) {
        fleet.ships.forEach((s) => this._destroyShipGfx(s));
        this.fleets.delete(key);
      }
    }
  }

  _buildShips(owner, classes, home, isRaider, defendingCivId) {
    const color = isRaider ? RAIDER_COLOR : (CIV_TYPE_COLORS[owner.type] ?? CIV_TYPE_COLORS.Type0);
    const radius = PATROL_RADIUS[owner.type] ?? PATROL_RADIUS.Type1;
    return classes.map((cls, i) => {
      const angle = (i / classes.length) * Math.PI * 2 + (isRaider ? Math.PI / 4 : 0);
      const r = isRaider ? radius * 1.5 : radius;
      return {
        id: `${owner.id}${isRaider ? "#raid" : "#def"}:${defendingCivId}:${i}`,
        ownerId: owner.id,
        defendingCivId,       // the world this ship is fighting over
        isRaider,
        cls,
        color,
        homeX: home.x,
        homeY: home.y,
        patrolRadius: r,
        orbitAngle: angle,
        x: home.x + Math.cos(angle) * r,
        y: home.y + Math.sin(angle) * r,
        heading: angle + Math.PI / 2,
        hp: SHIP_CLASSES[cls].hp,
        dead: false,
        nextFireAt: 0,
        gfx: null,
      };
    });
  }

  /** Player fire landed on a ship. Returns true when it dies. */
  _damageShip(ship, damage) {
    if (ship.dead) return true;
    ship.hp -= damage;

    // Shooting a people's ships is an act of war against THEM, even if they
    // were the ones besieging someone else.
    this._provoke(ship.ownerId);

    if (ship.gfx) {
      ship.gfx.setAlpha(0.4);
      this.scene.time.delayedCall(70, () => ship.gfx?.setAlpha(1));
    }
    if (ship.hp > 0) return false;

    ship.dead = true;
    this._explode(ship);
    this._reportKill(ship);
    return true;
  }

  _provoke(civId) {
    const already = this.hasGrudge(civId);
    this.grudges.set(civId, this.scene.time.now + GRUDGE_MS);
    if (!already) {
      narrateOnce("first-provoke", pick(CURATOR.fleet.provoked));
      playSfx("alert");
    }
  }

  _reportKill(ship) {
    // Killing a BESIEGER is an intervention on the defender's behalf; killing a
    // defender is simple aggression. Either way the server owns the outcome.
    this.onStrike?.(ship.ownerId, 1, {
      wasRaider: ship.isRaider,
      defendingCivId: ship.defendingCivId,
    });

    const fleet = [...this.fleets.values()].find((f) => f.ships.includes(ship));
    if (fleet && fleet.ships.every((s) => s.dead)) {
      if (ship.isRaider) {
        narrate(pick(CURATOR.fleet.siegeBroken), "proud");
        playSfx("surgeContained");
      } else {
        narrate(pick(CURATOR.fleet.fleetDestroyed), "grim");
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

    for (const fleet of this.fleets.values()) {
      for (const ship of fleet.ships) {
        if (ship.dead) continue;
        const stats = SHIP_CLASSES[ship.cls];
        const pDist = Phaser.Math.Distance.Between(player.x, player.y, ship.x, ship.y);

        if (!ship.gfx && pDist < CULL_DISTANCE) ship.gfx = this._createGfx(ship);
        else if (ship.gfx && pDist > CULL_DISTANCE) this._destroyShipGfx(ship);

        if (paused) continue;

        const owner = (this.scene.universe?.civilizations || []).find((c) => c.id === ship.ownerId);
        const stance = shipStance({
          isRaider: ship.isRaider,
          attitude: owner ? civAttitude(owner) : "neutral",
          grudgeUntil: this.grudges.get(ship.ownerId) ?? 0,
          playerDistance: pDist,
          now: time,
        });

        let target = null;
        if (stance === "hunt") {
          target = { x: player.x, y: player.y, isPlayer: true };
        } else if (stance === "raid") {
          // Raiders press the world they came for; if the player is closer and
          // has provoked them, they turn on the player instead.
          target = this.hasGrudge(ship.ownerId) && pDist < stats.range
            ? { x: player.x, y: player.y, isPlayer: true }
            : { x: ship.homeX, y: ship.homeY, isPlayer: false };
        }

        if (target) this._pursue(ship, stats, target, dt);
        else this._patrol(ship, stats, dt);

        // Fire
        if (target && time >= ship.nextFireAt) {
          const d = Phaser.Math.Distance.Between(ship.x, ship.y, target.x, target.y);
          if (d < stats.range) {
            ship.nextFireAt = time + stats.fireIntervalMs;
            this._fire(ship, stats, target, time);
          }
        }

        if (ship.gfx) {
          ship.gfx.setPosition(ship.x, ship.y);
          ship.gfx.rotation = ship.heading + Math.PI / 2;
        }
      }
    }

    this._updateBolts(player, dt, time, paused, invulnerable, armor);
  }

  _patrol(ship, stats, dt) {
    ship.orbitAngle += (stats.speed / Math.max(1, ship.patrolRadius)) * 0.35 * dt;
    ship.x = ship.homeX + Math.cos(ship.orbitAngle) * ship.patrolRadius;
    ship.y = ship.homeY + Math.sin(ship.orbitAngle) * ship.patrolRadius;
    ship.heading = ship.orbitAngle + Math.PI / 2;
  }

  _pursue(ship, stats, target, dt) {
    const desired = Math.atan2(target.y - ship.y, target.x - ship.x);
    const turn = Phaser.Math.Angle.Wrap(desired - ship.heading);
    ship.heading += Phaser.Math.Clamp(turn, -stats.turn * dt, stats.turn * dt);
    // Hold at weapons range rather than ramming
    const d = Phaser.Math.Distance.Between(ship.x, ship.y, target.x, target.y);
    if (d > stats.range * 0.6) {
      ship.x += Math.cos(ship.heading) * stats.speed * dt;
      ship.y += Math.sin(ship.heading) * stats.speed * dt;
    }
  }

  _fire(ship, stats, target, time) {
    const angle = Math.atan2(target.y - ship.y, target.x - ship.x);
    const gfx = this.scene.add.graphics({ x: ship.x, y: ship.y }).setDepth(6)
      .setBlendMode(Phaser.BlendModes.ADD);
    gfx.fillStyle(ship.color, 0.95);
    gfx.fillEllipse(0, 0, 10, 3.5);
    gfx.rotation = angle;

    this.bolts.push({
      x: ship.x, y: ship.y,
      vx: Math.cos(angle) * stats.boltSpeed,
      vy: Math.sin(angle) * stats.boltSpeed,
      damage: stats.damage,
      hitsPlayer: !!target.isPlayer,
      bornAt: time,
      gfx,
    });
    playSfx("uiClick");
  }

  _updateBolts(player, dt, time, paused, invulnerable, armor) {
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      if (time - b.bornAt > 5000) {
        b.gfx.destroy();
        this.bolts.splice(i, 1);
        continue;
      }
      if (paused) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.gfx.setPosition(b.x, b.y);

      if (b.hitsPlayer && !invulnerable &&
          Phaser.Math.Distance.Between(player.x, player.y, b.x, b.y) < 24) {
        b.gfx.destroy();
        this.bolts.splice(i, 1);
        const remaining = player.takeDamage(b.damage * armor);
        playSfx("minigameMiss");
        if (remaining <= 0) this.scene.handleShipDestroyed();
      }
    }
  }

  _explode(ship) {
    const burst = this.scene.add.particles(ship.x, ship.y, "evtex:spark", {
      speed: { min: 80, max: 210 },
      scale: { start: 0.45, end: 0 },
      lifespan: { min: 260, max: 560 },
      quantity: 16,
      blendMode: "ADD",
      tint: [ship.color, 0xf5cf7a],
    });
    this.scene.time.delayedCall(650, () => burst.destroy());
    this._destroyShipGfx(ship);
    playSfx("explosion");
  }

  // Solar-2 vessel: a soft glowing dart with a bright core, no hard outline.
  _createGfx(ship) {
    const stats = SHIP_CLASSES[ship.cls];
    const s = stats.radius / 12;
    const gfx = this.scene.add.graphics({ x: ship.x, y: ship.y }).setDepth(9)
      .setBlendMode(Phaser.BlendModes.ADD);
    gfx.fillStyle(ship.color, 0.35);
    gfx.fillTriangle(0, -15 * s, 9 * s, 9 * s, -9 * s, 9 * s);
    gfx.fillStyle(ship.color, 0.95);
    gfx.fillTriangle(0, -11 * s, 5.5 * s, 6 * s, -5.5 * s, 6 * s);
    gfx.fillStyle(0xffffff, 0.9);
    gfx.fillCircle(0, -2 * s, 1.8 * s);
    return gfx;
  }

  _destroyShipGfx(ship) {
    ship.gfx?.destroy();
    ship.gfx = null;
  }

  /** Drop everything (scale change); sync() rebuilds on return. */
  clear() {
    for (const fleet of this.fleets.values()) {
      fleet.ships.forEach((s) => this._destroyShipGfx(s));
    }
    this.fleets.clear();
    this.bolts.forEach((b) => b.gfx.destroy());
    this.bolts = [];
  }

  destroy() {
    this.clear();
    this.grudges.clear();
  }
}
