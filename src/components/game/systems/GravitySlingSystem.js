// src/components/game/systems/GravitySlingSystem.js
//
// Traversal, made a game. The void is full of masses (stars, galaxies) that
// used to be inert scan-targets. Now they have GRAVITY you can use: fly near
// and your path curves; dive close at speed and you SLINGSHOT - a real gravity
// assist that refunds boost and whips your velocity. So crossing empty space
// becomes a course you fly skilfully, and the boost economy rewards daring
// flight instead of just waiting out a recharge.
//
// Forces are added to player.body.acceleration (same convention as
// HazardSystem) and capped well below thrust (280), so gravity curves you but
// can never trap you - it's a tool, not a tractor beam.
import { playSfx } from "../audio.js";
import { narrate, narrateOnce, pick, CURATOR } from "../narrator.js";

const GRAVITY_K = 46;       // pull per unit mass at point-blank (falloff below)
const MAX_GRAVITY = 150;    // summed cap - always beatable by thrust
const SLIP_SPEED_MIN = 190; // must be moving to earn slipstream
const SLIP_REF_SPEED = 520; // speed at which slipstream is "full"
const BOOST_REFUND = 34;    // boost energy/sec at full slipstream
const GRAZE_SPEED_MIN = 240;
const GRAZE_KICK = 120;     // velocity impulse on a close pass
const GRAZE_BOOST = 22;     // boost energy granted per graze
const GRAZE_COOLDOWN = 650; // ms between graze pops (per system, debounced)

// A body's gravitational mass, from its kind + rendered size. Only real bodies
// pull - nebulae/anomalies/planets are too diffuse or small to matter here.
function massOf(d) {
  if (d.category === "galaxy") return 1.4 * (0.6 + (d.scale || 0.5));
  if (d.category === "star") return 1.0 * (0.5 + (d.scale || 0.5)) * (d.central ? 2.3 : 1);
  return 0;
}

export class GravitySlingSystem {
  constructor(scene) {
    this.scene = scene;
    this.slip = 0;         // 0..1 slipstream flow (for the HUD / speed lines)
    this._grazeCd = 0;
    this._grazes = 0;
  }

  getTraversal() {
    return { slip: this.slip, grazes: this._grazes };
  }

  update(time, delta) {
    const player = this.scene.player;
    if (!player?.body) return;
    if (this.scene.respawning || this.scene.inputSystem?.isMinigameActive) { this.slip = 0; return; }
    if (time < (player.invulnerableUntil || 0)) { this.slip = 0; return; }

    const dt = delta / 1000;
    const vx = player.body.velocity.x;
    const vy = player.body.velocity.y;
    const speed = Math.hypot(vx, vy);

    let fx = 0, fy = 0;
    let bestSlip = 0;
    let nearest = null;
    let nearestD = Infinity;

    this.scene.chunkSystem.loadedChunks.forEach((chunk) => {
      for (const { descriptor: d } of chunk.objects) {
        const mass = massOf(d);
        if (mass <= 0) continue;
        const assist = 250 + mass * 180;
        const dx = d.x - player.x;
        const dy = d.y - player.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist < assist) {
          const falloff = Math.pow(1 - dist / assist, 2);
          const accel = GRAVITY_K * mass * falloff;
          fx += (dx / dist) * accel;
          fy += (dy / dist) * accel;
          if (speed > SLIP_SPEED_MIN) {
            bestSlip = Math.max(bestSlip, falloff * Math.min(1, speed / SLIP_REF_SPEED));
          }
        }
        if (dist < nearestD) { nearestD = dist; nearest = { d, mass, assist }; }
      }
    });

    // Gentle, capped gravity - curves the path, never traps.
    const total = Math.hypot(fx, fy);
    if (total > MAX_GRAVITY) { fx = (fx / total) * MAX_GRAVITY; fy = (fy / total) * MAX_GRAVITY; }
    const tScale = this.scene.worldTimeScale ?? 1;
    player.body.acceleration.x += fx * tScale;
    player.body.acceleration.y += fy * tScale;

    // Slipstream: proximity-at-speed refunds boost and builds the flow.
    const input = this.scene.inputSystem;
    if (bestSlip > 0.06) {
      this.slip = Math.min(1, this.slip + (bestSlip - this.slip) * Math.min(1, dt * 4));
      if (input) input.boostEnergy = Math.min(100, input.boostEnergy + bestSlip * BOOST_REFUND * dt);
    } else {
      this.slip = Math.max(0, this.slip - dt * 1.6);
    }

    // Graze: a close, fast pass whips you out (the slingshot payoff).
    if (nearest && speed > GRAZE_SPEED_MIN && time > this._grazeCd) {
      const grazeDist = 70 + nearest.mass * 34;
      if (nearestD < grazeDist) {
        this._grazeCd = time + GRAZE_COOLDOWN;
        this._graze(player, vx, vy, speed);
      }
    }
  }

  _graze(player, vx, vy, speed) {
    this._grazes += 1;
    const input = this.scene.inputSystem;
    if (input) input.boostEnergy = Math.min(100, input.boostEnergy + GRAZE_BOOST);

    // Whip: an impulse along current heading - the assist "flings" you.
    player.body.velocity.x += (vx / speed) * GRAZE_KICK;
    player.body.velocity.y += (vy / speed) * GRAZE_KICK;

    playSfx('slingshot');
    this._grazeFx(player.x, player.y);

    // The Curator notices a properly reckless pass now and then.
    if (this._grazes === 3) narrateOnce('first-sling', pick(CURATOR.slingshot), 'amused');
    else if (this._grazes % 12 === 0) narrate(pick(CURATOR.slingshot), 'amused');
  }

  _grazeFx(x, y) {
    const ring = this.scene.add.graphics({ x, y }).setDepth(60);
    ring.lineStyle(2.5, 0x9fe0ff, 0.9);
    ring.strokeCircle(0, 0, 26);
    this.scene.tweens.add({
      targets: ring, scaleX: 3, scaleY: 3, alpha: 0,
      duration: 420, ease: 'Cubic.easeOut', onComplete: () => ring.destroy(),
    });
    const txt = this.scene.add.text(x, y - 40, 'SLINGSHOT', {
      fontFamily: '"IBM Plex Mono", monospace', fontSize: '13px', color: '#9fe0ff',
    }).setOrigin(0.5).setDepth(61);
    this.scene.tweens.add({
      targets: txt, y: y - 66, alpha: 0, duration: 700, ease: 'Cubic.easeOut',
      onComplete: () => txt.destroy(),
    });
  }

  destroy() {}
}
