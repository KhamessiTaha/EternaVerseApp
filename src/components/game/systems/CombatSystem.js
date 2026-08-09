// src/components/game/systems/CombatSystem.js
//
// The warden's gun. Hold [X]: energy bolts fire along the nose, bent toward
// the best target inside a forgiving aim-assist cone (combatModel.pickTarget).
// Sustained fire builds heat; overheat locks the gun until it cools - the
// boost-lockout rhythm, applied to a trigger.
//
// Enemies plug in through a provider registry: any system can addProvider()
// a function returning live targets ({ id, x, y, radius, hit(dmg) -> dead }).
// Rift-spawn register today; v2 fleet ships will register the same way, so
// the gun never needs to know what it's shooting.
import Phaser from "phaser";
import { playSfx } from "../audio.js";
import { getLoadoutLocal } from "../loadoutStore.js";
import {
  weaponFor, applyCooling, tryFire, pickTarget,
} from "../combat/combatModel.js";

const BOLT_LIFESPAN_MS = 1400;
const MUZZLE_OFFSET = 22; // bolt spawns ahead of the nose, not inside the hull

export class CombatSystem {
  constructor(scene) {
    this.scene = scene;
    this.heatState = { heat: 0, locked: false, lastFiredAt: -Infinity };
    this.bolts = [];
    this.providers = [];
  }

  /** Register a target source: fn() -> [{ id, x, y, radius, hit(dmg)->dead }] */
  addProvider(fn) {
    this.providers.push(fn);
  }

  _targets() {
    const out = [];
    for (const fn of this.providers) {
      const list = fn();
      if (Array.isArray(list)) out.push(...list);
    }
    return out;
  }

  update(time, delta) {
    // Cooling never pauses - a locked gun recovering is part of the rhythm.
    this.heatState = applyCooling(this.heatState, delta);

    const player = this.scene.player;
    const paused = this.scene.inputSystem?.isMinigameActive || this.scene.respawning;

    if (!paused && player?.body && this.scene.inputSystem?.keys?.fire?.isDown) {
      const wasLocked = this.heatState.locked;
      const weapon = weaponFor(getLoadoutLocal().hull);
      const res = tryFire(this.heatState, weapon, time);
      this.heatState = res.state;
      if (res.fired) this._spawnBolt(player, weapon);
      else if (!wasLocked && this.heatState.locked) playSfx("boostDepleted"); // overheat clunk
    }

    // Mirror onto the player for HUD pickup (the boostEnergy convention)
    if (player) {
      player.weaponHeat = this.heatState.heat;
      player.weaponLocked = this.heatState.locked;
    }

    this._updateBolts(time, delta);
  }

  _spawnBolt(player, weapon) {
    const noseAngle = player.rotation - Math.PI / 2;

    // Aim assist: bend the shot toward the best target in the cone, capped so
    // it reads as help, not homing.
    let angle = noseAngle;
    const target = pickTarget({ x: player.x, y: player.y, noseAngle }, this._targets(), {});
    if (target) angle = Math.atan2(target.y - player.y, target.x - player.x);

    const x = player.x + Math.cos(noseAngle) * MUZZLE_OFFSET;
    const y = player.y + Math.sin(noseAngle) * MUZZLE_OFFSET;

    const gfx = this.scene.add.graphics({ x, y }).setDepth(6).setBlendMode(Phaser.BlendModes.ADD);
    gfx.fillStyle(0xf5cf7a, 1);
    gfx.fillEllipse(0, 0, 12, 4);
    gfx.rotation = angle;

    this.bolts.push({
      x, y,
      vx: Math.cos(angle) * weapon.boltSpeed,
      vy: Math.sin(angle) * weapon.boltSpeed,
      damage: weapon.damage,
      bornAt: this.scene.time.now,
      gfx,
    });
    playSfx("uiClick");
  }

  _updateBolts(time, delta) {
    if (this.bolts.length === 0) return;
    const dt = (delta / 1000) * (this.scene.worldTimeScale ?? 1);
    const targets = this._targets();

    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      if (time - b.bornAt > BOLT_LIFESPAN_MS) {
        this._removeBolt(i);
        continue;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.gfx.setPosition(b.x, b.y);

      for (const t of targets) {
        if (Phaser.Math.Distance.Between(b.x, b.y, t.x, t.y) > (t.radius ?? 16) + 6) continue;
        this._impact(b.x, b.y);
        t.hit(b.damage);
        this._removeBolt(i);
        break;
      }
    }
  }

  _impact(x, y) {
    const burst = this.scene.add.particles(x, y, "evtex:spark", {
      speed: { min: 40, max: 120 },
      scale: { start: 0.3, end: 0 },
      lifespan: { min: 120, max: 300 },
      quantity: 6,
      blendMode: "ADD",
      tint: [0xf5cf7a, 0xffffff],
    });
    this.scene.time.delayedCall(350, () => burst.destroy());
    playSfx("minigameHit");
  }

  _removeBolt(index) {
    this.bolts[index].gfx.destroy();
    this.bolts.splice(index, 1);
  }

  /** Drop all in-flight bolts (scale change / teardown). */
  clear() {
    this.bolts.forEach((b) => b.gfx.destroy());
    this.bolts = [];
  }

  destroy() {
    this.clear();
    this.providers = [];
  }
}
