// src/components/game/systems/AbilitySystem.js
//
// Per-hull active abilities on SPACE. Each hull has one signature trick
// (content/abilities.js); effects are implemented here against the other
// systems. Cooldown state feeds the HUD via getHUD().
import { getLoadoutLocal } from "../loadoutStore.js";
import { ABILITIES } from "../content/abilities.js";
import { playSfx } from "../audio.js";
import { narrateOnce, pick, CURATOR } from "../narrator.js";

export class AbilitySystem {
  constructor(scene) {
    this.scene = scene;
    this.cooldownUntil = 0;
    this.activeUntil = 0;

    scene.input.keyboard.on("keydown-SPACE", () => this.trigger());
  }

  /** HUD chip data: current hull's ability + readiness. */
  getHUD() {
    const ability = ABILITIES[getLoadoutLocal().hull];
    if (!ability) return null;
    const now = this.scene.time.now;
    return {
      label: ability.label,
      active: now < this.activeUntil,
      cooldown: Math.max(0, Math.ceil((this.cooldownUntil - now) / 1000)),
    };
  }

  trigger() {
    const scene = this.scene;
    if (scene.inputSystem?.isMinigameActive || scene.respawning) return;

    const now = scene.time.now;
    if (now < this.cooldownUntil) {
      playSfx("uiDenied");
      return;
    }

    const hull = getLoadoutLocal().hull;
    const ability = ABILITIES[hull];
    if (!ability) return;

    const fired = this[`_${hull}`]?.(now, ability);
    if (fired === false) {
      // Ability had no valid target (e.g. nothing to scan) - don't consume
      playSfx("uiDenied");
      return;
    }

    this.cooldownUntil = now + ability.cooldown;
    this.activeUntil = now + (ability.duration || 0);
    playSfx("ability");
    narrateOnce("first-ability", pick(CURATOR.firstAbility));
  }

  /** Expanding ring feedback at the ship, colored per ability. */
  _pulseRing(color, radius = 90, duration = 450) {
    const p = this.scene.player;
    const ring = this.scene.add.graphics({ x: p.x, y: p.y }).setDepth(1500);
    ring.lineStyle(2, color, 0.9);
    ring.strokeCircle(0, 0, 16);
    this.scene.tweens.add({
      targets: ring, scaleX: radius / 16, scaleY: radius / 16, alpha: 0,
      duration, ease: "Cubic.easeOut", onComplete: () => ring.destroy(),
    });
  }

  // ------------------------------------------------------------- per hull

  _interceptor() {
    const scan = this.scene.scanSystem;
    scan.tryStartScan();
    if (!scan.active) return false; // nothing in range - refund
    scan._complete();
    this._pulseRing(0xdfa73f, 140);
  }

  _cutter(now) {
    this.scene.civilizationSystem.clearMissilesNear(this.scene.player.x, this.scene.player.y, 520);
    this.scene.player.invulnerableUntil = now + 2000;
    this._pulseRing(0x4ec9e0, 520, 550);
  }

  _falcon(now) {
    const p = this.scene.player;
    const angle = p.rotation - Math.PI / 2;
    p.body.velocity.x = Math.cos(angle) * 950;
    p.body.velocity.y = Math.sin(angle) * 950;
    p.invulnerableUntil = now + 900;
    this._pulseRing(0xf5cf7a, 70, 300);
  }

  _cruiser(now, ability) {
    const civs = this.scene.civilizationSystem;
    civs.ceasefireUntil = now + ability.duration;
    // Standing ordnance stands down too
    for (let i = civs.missiles.length - 1; i >= 0; i--) civs._fizzleMissile(civs.missiles[i], i);
    this._pulseRing(0x4fd1a5, 700, 900);
  }

  _bastion(now, ability) {
    const p = this.scene.player;
    p.invulnerableUntil = now + ability.duration;
    p.setVelocity(0, 0);
    p.body.moves = false;

    const shield = this.scene.add.graphics({ x: p.x, y: p.y }).setDepth(1500);
    shield.lineStyle(2.5, 0x9497ad, 0.85);
    shield.strokeCircle(0, 0, 34);
    this.scene.tweens.add({
      targets: shield, alpha: { from: 0.85, to: 0.3 },
      duration: 500, yoyo: true, repeat: Math.floor(ability.duration / 1000) - 1,
    });

    this.scene.time.delayedCall(ability.duration, () => {
      shield.destroy();
      if (!this.scene.respawning) p.body.moves = true;
    });
  }

  _hauler() {
    this.scene.salvageSystem.collectWithin(this.scene.player.x, this.scene.player.y, 700);
    this._pulseRing(0xdfa73f, 700, 800);
  }

  _tachyon(now, ability) {
    this.scene.worldTimeScale = 0.35;
    this.scene.tweens.timeScale = 0.35;
    this.scene.cameras.main.flash(200, 78, 201, 224, false);
    this._pulseRing(0x4ec9e0, 900, 1100);
    this.scene.time.delayedCall(ability.duration, () => {
      this.scene.worldTimeScale = 1;
      this.scene.tweens.timeScale = 1;
    });
  }

  _vanguard() {
    this.scene.player.heal(35);
    const input = this.scene.inputSystem;
    input.boostEnergy = Math.min(100, input.boostEnergy + 50);
    this._pulseRing(0x4fd1a5, 120, 500);
  }
}
