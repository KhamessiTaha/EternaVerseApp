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
  weaponInMode, nextFireMode, fireModeFor, DEFAULT_FIRE_MODE,
} from "../combat/combatModel.js";

const BOLT_LIFESPAN_MS = 1400;
const MUZZLE_OFFSET = 22; // bolt spawns ahead of the nose, not inside the hull

export class CombatSystem {
  constructor(scene) {
    this.scene = scene;
    this.heatState = { heat: 0, locked: false, lastFiredAt: -Infinity };
    this.bolts = [];
    this.providers = [];
    // LANCE kills hull, PULSE strips shields. One key toggles between them -
    // see combatModel.FIRE_MODES for why the enemy roles demand both.
    this.fireMode = DEFAULT_FIRE_MODE;
    this._bindModeKey();
  }

  _bindModeKey() {
    const kb = this.scene.input?.keyboard;
    if (!kb) return;
    // R, NOT Q. Q is already a movement key on both supported layouts -
    // left-turn on AZERTY, strafe-left on QWERTY - so binding the toggle there
    // would spin the ship every time the player switched guns. R is free on
    // both and still sits under the hand that's on the movement cluster, which
    // matters: a mid-fight switch you have to reach for won't get used.
    this.modeKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    this.modeKey.on("down", () => this.cycleFireMode());
  }

  cycleFireMode() {
    if (this.scene.inputSystem?.isMinigameActive) return;
    this.fireMode = nextFireMode(this.fireMode);
    const mode = fireModeFor(this.fireMode);
    playSfx("uiClick");
    this.scene.events.emit("weapon:mode", mode);
    return mode;
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
      // The hull's weapon AS THIS MODE FIRES IT: damage, cadence, heat and
      // bolt speed are all scaled, so each hull keeps its character in both.
      const weapon = weaponInMode(weaponFor(getLoadoutLocal().hull), this.fireMode);
      const res = tryFire(this.heatState, weapon, time);
      this.heatState = res.state;
      if (res.fired) this._spawnBolt(player, weapon);
      else if (!wasLocked && this.heatState.locked) playSfx("boostDepleted"); // overheat clunk
    }

    // Mirror onto the player for HUD pickup (the boostEnergy convention)
    if (player) {
      player.weaponHeat = this.heatState.heat;
      player.weaponLocked = this.heatState.locked;
      player.fireMode = this.fireMode;
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

    // The bolt is coloured and shaped by its mode, so which gun is live is
    // readable from the screen mid-fight without checking the HUD: LANCE is a
    // long cyan splinter, PULSE a fat violet slug.
    const isPulse = this.fireMode === "pulse";
    const gfx = this.scene.add.graphics({ x, y }).setDepth(6).setBlendMode(Phaser.BlendModes.ADD);
    gfx.fillStyle(weapon.color ?? 0xf5cf7a, 1);
    if (isPulse) gfx.fillEllipse(0, 0, 9, 7);
    else gfx.fillEllipse(0, 0, 14, 3.5);
    gfx.rotation = angle;

    this.bolts.push({
      x, y,
      vx: Math.cos(angle) * weapon.boltSpeed,
      vy: Math.sin(angle) * weapon.boltSpeed,
      damage: weapon.damage,
      profile: weapon.profile,
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
        t.hit(b.damage, b.profile);
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
