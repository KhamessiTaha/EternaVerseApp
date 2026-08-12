// src/components/game/systems/CivFleetSystem.js
//
// Civilization vessels, and the battles they fight whether or not you show up.
//
// Every space-faring people keeps ships over its homeworld. When two of them
// go to war, one sends a strike force to the other's home - bombers escorted
// by guardians, with interceptors to keep anyone from interfering. The
// defenders meet them. That fight happens on its own; the player is a heavy
// thumb on the scale, not the reason it exists.
//
// What makes it a fight instead of a target list:
//   * bombers ignore you entirely and run for the world - if they reach it,
//     the population dies and the civilization can go EXTINCT while you watch
//   * guardians screen the bombers, so you must break through or flank
//   * interceptors hunt YOU, so chasing the bombers always costs something
//   * the attacker reinforces in waves - clearing one does not end the siege
//
// Client-side like the rift-spawn siege: the dogfight is rendered here, and
// only the CONSEQUENCES (relationship, war score, bombardment casualties) are
// reported to the server, which owns and validates them. Ship-on-ship kills
// are deliberately NOT reported - the player didn't do those.
//
// Drawing lives in combat/shipRenderer.js; the rules live in
// combat/fleetModel.js. This file is the simulation that joins them.
import Phaser from "phaser";
import { playSfx } from "../audio.js";
import { getLoadoutLocal } from "../loadoutStore.js";
import { HULL_STATS } from "../content/hullCatalog.js";
import { civAttitude } from "../utils";
import { narrate, narrateOnce, pick, CURATOR } from "../narrator.js";
import {
  SHIP_ROLES, PATROL_RADIUS, GRUDGE_MS,
  SHIELD_REGEN_PER_SEC, SHIELD_REGEN_DELAY_MS,
  WAVE_INTERVAL_MS, WAVE_REGROUP_MS, MAX_WAVES,
  homeFleetFor, raidWaveFor, shipStance, pickShipTarget, civUnderSiege, applyDamage,
  salvageFor,
} from "../combat/fleetModel.js";
import { ShipRenderer } from "../combat/shipRenderer.js";
import { dropSalvage } from "../world/salvageDrop.js";
import { CIV_TYPE_COLORS } from "./CivilizationSystem.js";

const RAIDER_COLOR = 0xe0524a;
const CULL_DISTANCE = 6000;
// How far a ship will look for something to shoot. Without this, fleets chase
// each other across a galaxy instead of fighting over the world in question.
const ENGAGE_RANGE = 1300;

export class CivFleetSystem {
  constructor(scene) {
    this.scene = scene;
    this.renderer = new ShipRenderer(scene);
    this.fleets = new Map();   // key -> fleet record (see _makeFleet)
    this.bolts = [];
    this.grudges = new Map();  // civId -> expiry timestamp
    this.onStrike = null;      // (civId, kills, context) -> diplomatic fallout
    this.onBombard = null;     // (defendingCivId, runs, attackerCivId) -> casualties
    this._live = [];           // every living ship, rebuilt each frame
  }

  registerWith(combatSystem) {
    combatSystem.addProvider(() => this._targets());
  }

  _targets() {
    return this._live.map((s) => ({
      id: s.id,
      x: s.x,
      y: s.y,
      radius: SHIP_ROLES[s.role].radius,
      hit: (damage) => this._damageShip(s, damage, true),
    }));
  }

  /** Has the player angered this people recently? Drives stance + attitude. */
  hasGrudge(civId) {
    return this.scene.time.now < (this.grudges.get(civId) ?? 0);
  }

  // ---------------------------------------------------------------- lifecycle

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
      const defenders = homeFleetFor(civ);
      if (defenders.length) {
        const key = `def:${civ.id}`;
        wanted.add(key);
        if (!this.fleets.has(key)) {
          this.fleets.set(key, this._makeFleet(key, civ, defenders, beacon.loc, false, civ.id));
        }
      }

      // ...and whoever has come to burn it. civUnderSiege is the single
      // definition of "under attack" shared with the distress call and the
      // Locator, so what the player is told matches what actually spawns.
      const allCivs = this.scene.universe?.civilizations || [];
      const enemyId = civUnderSiege(civ, this.scene.universe?.activeWars || [], allCivs);
      if (!enemyId) continue;
      const enemy = allCivs.find((c) => c.id === enemyId);
      const firstWave = raidWaveFor(enemy, 0);

      const key = `raid:${enemyId}@${civ.id}`;
      wanted.add(key);
      if (!this.fleets.has(key)) {
        const fleet = this._makeFleet(key, enemy, firstWave, beacon.loc, true, civ.id);
        fleet.nextWaveAt = this.scene.time.now + WAVE_INTERVAL_MS;
        this.fleets.set(key, fleet);
        narrateOnce(`siege:${key}`, pick(CURATOR.fleet.siege));
      }
    }

    // Drop fleets whose civ is no longer here (scale change, extinction, peace)
    for (const [key, fleet] of this.fleets.entries()) {
      if (!wanted.has(key)) {
        fleet.ships.forEach((s) => this.renderer.detach(s));
        this.fleets.delete(key);
      }
    }
  }

  _makeFleet(key, owner, roles, home, isRaider, defendingCivId) {
    const fleet = {
      key,
      ownerId: owner.id,
      ownerType: owner.type,
      defendingCivId,
      isRaider,
      home: { x: home.x, y: home.y },
      ships: [],
      wave: 0,
      nextWaveAt: 0,
      regroupAt: 0,     // set when a wave is wiped out, cleared when the next lands
      exhausted: false, // every wave sent and destroyed
    };
    fleet.ships = this._buildShips(fleet, owner, roles);
    return fleet;
  }

  _buildShips(fleet, owner, roles) {
    const color = fleet.isRaider
      ? RAIDER_COLOR
      : (CIV_TYPE_COLORS[owner.type] ?? CIV_TYPE_COLORS.Type0);
    const base = PATROL_RADIUS[owner.type] ?? PATROL_RADIUS.Type1;
    const radius = fleet.isRaider ? base * 2.2 : base;
    const n = Math.max(1, roles.length);

    return roles.map((role, i) => {
      const spec = SHIP_ROLES[role];
      const angle = (i / n) * Math.PI * 2 + fleet.wave * 0.7;
      return {
        id: `${fleet.key}:w${fleet.wave}:${i}`,
        fleetKey: fleet.key,
        ownerId: fleet.ownerId,
        battle: fleet.defendingCivId, // which world this ship is fighting over
        defendingCivId: fleet.defendingCivId,
        isRaider: fleet.isRaider,
        role,
        color,
        seed: (i + 1) * 1.7 + fleet.wave,
        homeX: fleet.home.x,
        homeY: fleet.home.y,
        patrolRadius: radius,
        orbitAngle: angle,
        x: fleet.home.x + Math.cos(angle) * radius,
        y: fleet.home.y + Math.sin(angle) * radius,
        heading: angle + Math.PI / 2,
        hp: spec.hp,
        shields: spec.shields,
        dead: false,
        lastHitAt: 0,
        nextFireAt: 0,
        nextBombardAt: 0,
        throttle: 0,
        turnRate: 0,
        bank: 0,
        gfx: null,
      };
    });
  }

  // ------------------------------------------------------------------- damage

  /**
   * Damage a ship. `byPlayer` separates the player's shots (which carry
   * diplomatic weight and are reported to the server) from ships killing each
   * other, which is just the war happening. Returns true when it dies.
   */
  _damageShip(ship, damage, byPlayer) {
    if (ship.dead) return true;
    const time = this.scene.time.now;
    const hadShields = ship.shields > 0;

    const next = applyDamage({ hp: ship.hp, shields: ship.shields }, damage);
    ship.hp = next.hp;
    ship.shields = next.shields;
    ship.lastHitAt = time;

    this.renderer.hit(ship, hadShields, time);

    // Shooting a people's ships is an act of war against THEM, even if they
    // were the ones besieging someone else.
    if (byPlayer) this._provoke(ship.ownerId);

    if (ship.hp > 0) return false;

    ship.dead = true;
    this.renderer.destroyShip(ship);
    playSfx("explosion");
    // Wreckage. Only the player's kills pay out - ships shooting each other
    // isn't a reward loop, it's a war happening near you.
    if (byPlayer) {
      dropSalvage(this.scene, ship.x, ship.y, salvageFor(ship.role));
      this._reportKill(ship);
    }
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

    const fleet = this.fleets.get(ship.fleetKey);
    if (!fleet || fleet.ships.some((s) => !s.dead)) return;

    if (!fleet.isRaider) {
      narrate(pick(CURATOR.fleet.fleetDestroyed), "grim");
    } else if (fleet.wave >= MAX_WAVES) {
      // Last wave, last hull. The siege is genuinely over.
      fleet.exhausted = true;
      narrate(pick(CURATOR.fleet.siegeBroken), "proud");
      playSfx("surgeContained");
    }
    // Otherwise say nothing yet - _reinforce announces the next wave when it
    // actually arrives, and one line beats two.
  }

  // -------------------------------------------------------------------- frame

  update(time, delta) {
    const player = this.scene.player;
    if (!player?.body || this.scene.respawning) return;
    const dt = (delta / 1000) * (this.scene.worldTimeScale ?? 1);
    const paused = this.scene.inputSystem?.isMinigameActive;
    const invulnerable = time < (player.invulnerableUntil || 0);
    const armor = HULL_STATS[getLoadoutLocal().hull]?.damageTaken ?? 1;

    this._live = [];
    for (const fleet of this.fleets.values()) {
      if (!paused) this._reinforce(fleet, time);
      // Bury the dead so a long siege doesn't grow an unbounded array.
      if (fleet.ships.some((s) => s.dead)) {
        fleet.ships = fleet.ships.filter((s) => !s.dead);
      }
      for (const s of fleet.ships) this._live.push(s);
    }

    for (const ship of this._live) {
      const pDist = Phaser.Math.Distance.Between(player.x, player.y, ship.x, ship.y);
      if (!ship.gfx && pDist < CULL_DISTANCE) this.renderer.attach(ship);
      else if (ship.gfx && pDist > CULL_DISTANCE) this.renderer.detach(ship);

      if (!paused) this._think(ship, player, pDist, dt, time);
      this.renderer.update(ship, time);
    }

    this.renderer.drawTrails(this._live);
    this._updateBolts(player, dt, time, paused, invulnerable, armor);
  }

  /**
   * The next wave of a siege - on a timer, or sooner if the player wiped the
   * last one out. Clearing a wave buys a breath, not an ending.
   */
  _reinforce(fleet, time) {
    if (!fleet.isRaider || fleet.exhausted || fleet.wave >= MAX_WAVES) return;

    if (fleet.ships.every((s) => s.dead)) {
      if (!fleet.regroupAt) {
        fleet.regroupAt = time + WAVE_REGROUP_MS;
        return;
      }
      if (time < fleet.regroupAt) return;
    } else if (time < fleet.nextWaveAt) {
      return;
    }
    fleet.regroupAt = 0;

    const owner = (this.scene.universe?.civilizations || [])
      .find((c) => c.id === fleet.ownerId);
    if (!owner || owner.extinct) {
      fleet.exhausted = true;
      return;
    }

    fleet.wave += 1;
    fleet.nextWaveAt = time + WAVE_INTERVAL_MS;
    const roles = raidWaveFor(owner, fleet.wave);
    fleet.ships.push(...this._buildShips(fleet, owner, roles));
    narrateOnce(`wave:${fleet.key}:${fleet.wave}`, pick(CURATOR.fleet.reinforcements));
  }

  /** One ship's decision and movement for this frame. */
  _think(ship, player, pDist, dt, time) {
    const spec = SHIP_ROLES[ship.role];
    const owner = (this.scene.universe?.civilizations || [])
      .find((c) => c.id === ship.ownerId);
    const attitude = owner ? civAttitude(owner) : "neutral";
    const playerThreat = this.hasGrudge(ship.ownerId) || attitude === "hostile";

    // Shields come back when nothing has hit this ship for a while.
    if (spec.shields > 0 && time - ship.lastHitAt > SHIELD_REGEN_DELAY_MS) {
      ship.shields = Math.min(spec.shields, ship.shields + SHIELD_REGEN_PER_SEC * dt);
    }

    const underSiege = !ship.isRaider && this._live.some(
      (s) => s.isRaider && s.battle === ship.battle
    );
    const stance = shipStance({
      isRaider: ship.isRaider,
      underSiege,
      attitude,
      grudgeUntil: this.grudges.get(ship.ownerId) ?? 0,
      playerDistance: pDist,
      now: time,
    });

    const target = pickShipTarget(ship.role, {
      candidates: this._candidatesFor(ship, player, pDist, playerThreat, stance),
      worldPos: ship.isRaider ? { x: ship.homeX, y: ship.homeY } : null,
      playerThreat,
    });

    if (!target) {
      this._patrol(ship, spec, dt);
      return;
    }

    if (target.kind === "world") {
      this._bombardRun(ship, spec, target, dt, time);
      return;
    }

    this._pursue(ship, spec, target, dt);
    if (time >= ship.nextFireAt && spec.fireIntervalMs > 0) {
      const d = Phaser.Math.Distance.Between(ship.x, ship.y, target.x, target.y);
      if (d < spec.range) {
        ship.nextFireAt = time + spec.fireIntervalMs * Phaser.Math.FloatBetween(0.85, 1.15);
        this._fire(ship, spec, target, time);
      }
    }
  }

  /**
   * What this ship can see worth shooting: enemy vessels in the same battle,
   * plus the player when the player has earned it.
   */
  _candidatesFor(ship, player, pDist, playerThreat, stance) {
    const out = [];
    for (const other of this._live) {
      if (other === ship || other.battle !== ship.battle) continue;
      if (other.isRaider === ship.isRaider) continue;
      const d = Phaser.Math.Distance.Between(ship.x, ship.y, other.x, other.y);
      if (d <= ENGAGE_RANGE) out.push({ kind: "ship", x: other.x, y: other.y, distance: d, ref: other });
    }
    if (playerThreat && stance !== "patrol" && pDist <= ENGAGE_RANGE) {
      out.push({ kind: "player", x: player.x, y: player.y, distance: pDist, ref: player });
    }
    return out;
  }

  // ----------------------------------------------------------------- movement

  _patrol(ship, spec, dt) {
    const prev = ship.heading;
    ship.orbitAngle += (spec.speed / Math.max(1, ship.patrolRadius)) * 0.35 * dt;
    ship.x = ship.homeX + Math.cos(ship.orbitAngle) * ship.patrolRadius;
    ship.y = ship.homeY + Math.sin(ship.orbitAngle) * ship.patrolRadius;
    ship.heading = ship.orbitAngle + Math.PI / 2;
    ship.turnRate = dt > 0 ? Phaser.Math.Angle.Wrap(ship.heading - prev) / dt : 0;
    ship.throttle = 0.35;
  }

  _pursue(ship, spec, target, dt) {
    const applied = this._steer(ship, spec, target.x, target.y, dt);
    // Hold at weapons range rather than ramming.
    const d = Phaser.Math.Distance.Between(ship.x, ship.y, target.x, target.y);
    const closing = d > spec.range * 0.6;
    ship.throttle = closing ? 1 : 0.25;
    if (closing) this._advance(ship, spec.speed, dt);
    return applied;
  }

  /**
   * A bomber's run: close on the world, then hold in low orbit and drop.
   * Nothing distracts it - stopping this is the player's job.
   */
  _bombardRun(ship, spec, target, dt, time) {
    this._steer(ship, spec, target.x, target.y, dt);
    const d = Phaser.Math.Distance.Between(ship.x, ship.y, target.x, target.y);

    if (d > spec.bombardRange) {
      ship.throttle = 1;
      this._advance(ship, spec.speed, dt);
      return;
    }

    // In position. Circle tight and keep dropping.
    ship.throttle = 0.4;
    ship.orbitAngle += 0.5 * dt;
    ship.x = target.x + Math.cos(ship.orbitAngle) * spec.bombardRange * 0.85;
    ship.y = target.y + Math.sin(ship.orbitAngle) * spec.bombardRange * 0.85;

    if (!ship.nextBombardAt) {
      ship.nextBombardAt = time + spec.bombardIntervalMs;
      narrateOnce(`bombard:${ship.battle}`, pick(CURATOR.fleet.bombardment));
      return;
    }
    if (time < ship.nextBombardAt) return;

    ship.nextBombardAt = time + spec.bombardIntervalMs;
    this.renderer.bombardBeam(ship, target.x, target.y);

    // Felt, not just seen - but only if you are close enough for it to be
    // your problem. The scene decays the shake back down next frame.
    const p = this.scene.player;
    if (p && Phaser.Math.Distance.Between(p.x, p.y, ship.x, ship.y) < 1400) {
      playSfx("explosion");
      this.scene.cameraShakeIntensity = Math.max(this.scene.cameraShakeIntensity || 0, 0.005);
    }
    this.onBombard?.(ship.battle, 1, ship.ownerId);
  }

  /** Turn toward a point, recording the turn rate so the renderer can bank. */
  _steer(ship, spec, tx, ty, dt) {
    const desired = Math.atan2(ty - ship.y, tx - ship.x);
    const delta = Phaser.Math.Angle.Wrap(desired - ship.heading);
    const applied = Phaser.Math.Clamp(delta, -spec.turn * dt, spec.turn * dt);
    ship.heading += applied;
    ship.turnRate = dt > 0 ? applied / dt : 0;
    return applied;
  }

  _advance(ship, speed, dt) {
    ship.x += Math.cos(ship.heading) * speed * dt;
    ship.y += Math.sin(ship.heading) * speed * dt;
    // Patrol orbit is re-anchored so a ship that disengages doesn't teleport
    // back onto its old station.
    ship.orbitAngle = Math.atan2(ship.y - ship.homeY, ship.x - ship.homeX);
  }

  // -------------------------------------------------------------------- bolts

  _fire(ship, spec, target, time) {
    // Lead the shot slightly so ships trade fire instead of trailing each other.
    const angle = Math.atan2(target.y - ship.y, target.x - ship.x)
      + Phaser.Math.FloatBetween(-0.05, 0.05);
    const gfx = this.scene.add.graphics({ x: ship.x, y: ship.y }).setDepth(6)
      .setBlendMode(Phaser.BlendModes.ADD);
    gfx.fillStyle(ship.color, 0.4);
    gfx.fillEllipse(0, 0, 18, 6);
    gfx.fillStyle(0xffffff, 0.95);
    gfx.fillEllipse(0, 0, 9, 2.5);
    gfx.rotation = angle;

    this.bolts.push({
      x: ship.x, y: ship.y,
      vx: Math.cos(angle) * spec.boltSpeed,
      vy: Math.sin(angle) * spec.boltSpeed,
      damage: spec.damage,
      battle: ship.battle,
      fromRaider: ship.isRaider,
      hitsPlayer: target.kind === "player",
      bornAt: time,
      gfx,
    });
    playSfx("uiClick");
  }

  _updateBolts(player, dt, time, paused, invulnerable, armor) {
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      if (time - b.bornAt > 5000) {
        this._killBolt(i);
        continue;
      }
      if (paused) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.gfx.setPosition(b.x, b.y);

      // A bolt fired at the player still hits the enemy ships it passes
      // through, which is how a three-way fight gets interesting.
      let consumed = false;
      for (const s of this._live) {
        if (s.dead || s.battle !== b.battle || s.isRaider === b.fromRaider) continue;
        if (Phaser.Math.Distance.Between(s.x, s.y, b.x, b.y) < SHIP_ROLES[s.role].radius + 4) {
          this._damageShip(s, b.damage, false);
          consumed = true;
          break;
        }
      }
      if (consumed) {
        this._killBolt(i);
        continue;
      }

      if (b.hitsPlayer && !invulnerable &&
          Phaser.Math.Distance.Between(player.x, player.y, b.x, b.y) < 24) {
        this._killBolt(i);
        const remaining = player.takeDamage(b.damage * armor);
        playSfx("minigameMiss");
        if (remaining <= 0) this.scene.handleShipDestroyed();
      }
    }
  }

  _killBolt(i) {
    this.bolts[i].gfx.destroy();
    this.bolts.splice(i, 1);
  }

  // ---------------------------------------------------------------- teardown

  /** Drop everything (scale change); sync() rebuilds on return. */
  clear() {
    for (const fleet of this.fleets.values()) {
      fleet.ships.forEach((s) => this.renderer.detach(s));
    }
    this.fleets.clear();
    this._live = [];
    this.bolts.forEach((b) => b.gfx.destroy());
    this.bolts = [];
    this.renderer.drawTrails([]);
  }

  destroy() {
    this.clear();
    this.grudges.clear();
    this.renderer.destroy();
  }
}
