/**
 * Gravity Well Containment Mini-Game  —  real two-body orbital mechanics.
 *
 * A gravitational anomaly (a black-hole remnant / dark-matter clump) sits at
 * the center with a real, softened inverse-square field. A containment probe
 * carries genuine momentum and is on a perturbed orbit. The player fires
 * thrust to CIRCULARIZE that orbit and hold it inside the containment annulus
 * - not by pointing at where they want to be, but by managing orbital energy
 * the way you actually do in space:
 *
 *   - thrust PROGRADE (along your motion)  -> raises the opposite side (apoapsis)
 *   - thrust RETROGRADE (against motion)   -> lowers the opposite side
 *   - thrust radially                       -> rotates the orbit's shape
 *
 * Falling inside the accretion radius or crossing the containment wall counts
 * as a breach. Hold a stable orbit for the full duration to contain it. The
 * mechanic IS the physics - there is no fake pull vector anywhere in here.
 */
import Phaser from 'phaser';
import MiniGameScene, { MG_COLORS } from './MiniGameScene.js';

const THEME_COLOR = 0x8b7bd8; // gravitational violet

export class GravityWellScene extends MiniGameScene {
  constructor() {
    super('GravityWellScene');
  }

  init(data) {
    super.init(data);

    const severity = Math.max(1, Math.min(5, this.anomaly?.severity || 2));
    this.severity = severity;

    // --- Field & orbit geometry (pixels, seconds) --------------------------
    // GM and softening are chosen so a circular orbit at R0 has a ~5s period
    // and a comfortable circular speed. Softening keeps the singularity finite.
    this.GM = 2.6e6 * (1 + (severity - 2) * 0.06);
    this.soft2 = 32 * 32;
    this.R0 = 112;                       // ideal (target) orbital radius
    this.Rin = 50 + severity * 2;        // accretion radius - breach if r < Rin
    this.Rout = 180 - severity * 2;      // containment wall  - breach if r > Rout
    this.thrust = 250;                   // px/s^2 while a key is held

    // --- Probe state (world-space relative to the central mass) -------------
    // Start on the ideal radius but with a perturbed velocity, so the player
    // is CORRECTING an unstable orbit rather than building one from nothing.
    const aG = this.GM / (this.R0 * this.R0 + this.soft2);
    const vCirc = Math.sqrt(aG * this.R0);
    const startAngle = Math.random() * Math.PI * 2;
    this.probe = { x: Math.cos(startAngle) * this.R0, y: Math.sin(startAngle) * this.R0 };

    // Tangential direction (perpendicular to radius) + a perturbation: scale
    // the tangential speed off-circular and add a radial kick -> ellipse.
    const tang = { x: -Math.sin(startAngle), y: Math.cos(startAngle) };
    const radial = { x: Math.cos(startAngle), y: Math.sin(startAngle) };
    // Tuned so a minor anomaly's orbit is a gentle ellipse (winnable with
    // light correction) while a severe one genuinely escapes without skill.
    const speedFactor = 1 + (0.06 + severity * 0.03) * (Math.random() < 0.5 ? -1 : 1);
    const radialKick = (Math.random() - 0.5) * vCirc * (0.15 + severity * 0.03);
    this.vel = {
      x: tang.x * vCirc * speedFactor + radial.x * radialKick,
      y: tang.y * vCirc * speedFactor + radial.y * radialKick,
    };

    this.elapsed = 0;
    this.survivalTarget = 10 + severity * 1.2;
    this.breaches = 0;
    this.maxBreaches = 3;
    this._breachCooldown = 0;

    this.qualitySamples = [];
    this.trail = [];
    this.maxTrail = 90;
    this.gameOver = false;
  }

  create() {
    super.create();

    const cx = this.cameras.main.width / 2;
    const cy = this.cameras.main.height / 2 + 20;
    this.centerX = cx;
    this.centerY = cy;

    this.createHeader(
      'GRAVITY WELL CONTAINMENT',
      THEME_COLOR,
      `Severity ${this.anomaly?.severity || '?'} · Circularize into the green ring`
    );

    // Control legend - orbit-relative, matches the live status guidance
    this.add.text(cx, 116, '↑ prograde   ↓ retrograde   ← radial in   → radial out', {
      fontFamily: '"IBM Plex Mono", monospace', fontSize: '11px', color: '#dfa73f',
    }).setOrigin(0.5);

    // Containment wall (escape boundary) and accretion radius (collapse boundary)
    this.add.circle(cx, cy, this.Rout, THEME_COLOR, 0).setStrokeStyle(2, THEME_COLOR, 0.55);
    this.add.circle(cx, cy, this.Rin, MG_COLORS.critical, 0.06).setStrokeStyle(1, MG_COLORS.critical, 0.5);

    // Ideal orbit (the ring the player is aiming to ride) - faint green guide
    this.idealRing = this.add.circle(cx, cy, this.R0, MG_COLORS.good, 0).setStrokeStyle(1, MG_COLORS.good, 0.35);

    // Central mass with a little glow
    this.add.circle(cx, cy, 16, THEME_COLOR, 0.12).setBlendMode(Phaser.BlendModes.ADD);
    this.add.circle(cx, cy, 6, MG_COLORS.ink, 0.9);

    this.trailGraphics = this.add.graphics();
    this.velGraphics = this.add.graphics();

    this.probeGlow = this.add.circle(cx, cy, 13, MG_COLORS.good, 0.28).setBlendMode(Phaser.BlendModes.ADD);
    this.probeGraphics = this.add.circle(cx, cy, 7, MG_COLORS.good);

    // Readouts
    this.breachText = this.add.text(cx, 142, `BREACHES 0 / ${this.maxBreaches}`, {
      fontFamily: '"IBM Plex Mono", monospace', fontSize: '13px', color: '#e0524a',
    }).setOrigin(0.5);

    this.statusText = this.add.text(cx, cy + this.Rout + 34, '', {
      fontFamily: '"IBM Plex Mono", monospace', fontSize: '13px', color: '#9497ad',
    }).setOrigin(0.5);

    const barWidth = 240;
    const barY = cy + this.Rout + 60;
    this.add.rectangle(cx, barY, barWidth, 6, MG_COLORS.line).setOrigin(0.5);
    this.progressFill = this.add.rectangle(cx - barWidth / 2, barY, 0, 6, THEME_COLOR).setOrigin(0, 0.5);
    this.progressBarWidth = barWidth;
    this.add.text(cx, barY + 16, 'STABLE ORBIT TIME', {
      fontFamily: '"IBM Plex Mono", monospace', fontSize: '10px', color: '#565a72',
    }).setOrigin(0.5);

    this.keys = this.input.keyboard.addKeys('UP,DOWN,LEFT,RIGHT');
  }

  update(time, delta) {
    if (this.gameOver) return;
    // Clamp dt so a frame hitch can't tunnel the probe through the field.
    const dt = Math.min(delta / 1000, 0.04);
    this.elapsed += dt;
    if (this._breachCooldown > 0) this._breachCooldown -= dt;

    // --- Gravity: real softened inverse-square, directed at the center ------
    const r2 = this.probe.x * this.probe.x + this.probe.y * this.probe.y;
    const r = Math.sqrt(r2);
    const aMag = this.GM / (r2 + this.soft2);
    let ax = -aMag * (this.probe.x / r);
    let ay = -aMag * (this.probe.y / r);

    // --- Player thrust (orbit-relative, NOT screen-relative) ---------------
    // Prograde/retrograde/radial are defined off the probe's current motion
    // and position, so the on-screen "thrust prograde" guidance always maps to
    // the same key no matter where the probe is in its orbit. (Absolute arrow
    // keys fought the rotating prograde direction and made this near-unplayable.)
    const spd = Math.sqrt(this.vel.x * this.vel.x + this.vel.y * this.vel.y) || 1;
    const proX = this.vel.x / spd;        // prograde: along motion
    const proY = this.vel.y / spd;
    const radX = this.probe.x / (r || 1); // radial: away from center
    const radY = this.probe.y / (r || 1);
    let tx = 0;
    let ty = 0;
    if (this.keys.UP.isDown)    { tx += proX; ty += proY; } // prograde  → raises far side
    if (this.keys.DOWN.isDown)  { tx -= proX; ty -= proY; } // retrograde → lowers far side
    if (this.keys.RIGHT.isDown) { tx += radX; ty += radY; } // radial out
    if (this.keys.LEFT.isDown)  { tx -= radX; ty -= radY; } // radial in
    if (tx !== 0 || ty !== 0) {
      const len = Math.sqrt(tx * tx + ty * ty);
      ax += (tx / len) * this.thrust;
      ay += (ty / len) * this.thrust;
    }

    // Semi-implicit Euler (update velocity first, then position) - stable for orbits.
    this.vel.x += ax * dt;
    this.vel.y += ay * dt;
    this.probe.x += this.vel.x * dt;
    this.probe.y += this.vel.y * dt;

    // --- Boundary handling: bounce off the wall / graze the accretion edge --
    const newR = Math.sqrt(this.probe.x * this.probe.x + this.probe.y * this.probe.y);
    if (newR < this.Rin) {
      this.clampToBoundary(this.Rin, true);
      this.registerBreach('ACCRETION');
    } else if (newR > this.Rout) {
      this.clampToBoundary(this.Rout, false);
      this.registerBreach('ESCAPE');
    } else {
      // Quality: 1.0 riding the ideal ring, ->0 at either boundary.
      const dev = Math.abs(newR - this.R0);
      const maxDev = Math.max(this.R0 - this.Rin, this.Rout - this.R0);
      this.qualitySamples.push(Phaser.Math.Clamp(1 - dev / maxDev, 0, 1));
    }

    this.render(newR);

    const progress = Math.min(1, this.elapsed / this.survivalTarget);
    this.progressFill.width = this.progressBarWidth * progress;

    if (this.elapsed >= this.survivalTarget) this.endGame(true);
    else if (this.breaches >= this.maxBreaches) this.endGame(false);
  }

  // Push the probe back to a boundary radius and kill the velocity component
  // that carried it across, so it grazes the edge instead of teleporting.
  clampToBoundary(boundaryR, inner) {
    const r = Math.sqrt(this.probe.x * this.probe.x + this.probe.y * this.probe.y) || 1;
    const nx = this.probe.x / r;
    const ny = this.probe.y / r;
    this.probe.x = nx * boundaryR;
    this.probe.y = ny * boundaryR;
    // Radial velocity component (outward positive)
    const vr = this.vel.x * nx + this.vel.y * ny;
    // Remove the offending radial component: inward at accretion, outward at wall.
    if ((inner && vr < 0) || (!inner && vr > 0)) {
      this.vel.x -= vr * nx;
      this.vel.y -= vr * ny;
    }
  }

  registerBreach(kind) {
    if (this._breachCooldown > 0) return; // grace so one graze isn't three breaches
    this._breachCooldown = 0.8;
    this.breaches++;
    this.breachText.setText(`BREACHES ${this.breaches} / ${this.maxBreaches}`);
    this.shake(160, 0.008);
    this.showFeedback(
      kind === 'ACCRETION' ? 'ACCRETION!' : 'ESCAPE!',
      MG_COLORS.critical,
      this.centerX, this.centerY - this.Rout - 24
    );
  }

  render(r) {
    const px = this.centerX + this.probe.x;
    const py = this.centerY + this.probe.y;
    this.probeGraphics.setPosition(px, py);
    this.probeGlow.setPosition(px, py);

    // Trail
    this.trail.push({ x: px, y: py });
    if (this.trail.length > this.maxTrail) this.trail.shift();
    this.trailGraphics.clear();
    this.trailGraphics.lineStyle(1.5, THEME_COLOR, 0.5);
    this.trailGraphics.beginPath();
    this.trail.forEach((p, i) => (i === 0 ? this.trailGraphics.moveTo(p.x, p.y) : this.trailGraphics.lineTo(p.x, p.y)));
    this.trailGraphics.strokePath();

    // Velocity (prograde) vector - teaches which way "prograde" points
    const speed = Math.sqrt(this.vel.x * this.vel.x + this.vel.y * this.vel.y);
    this.velGraphics.clear();
    if (speed > 1) {
      const len = Phaser.Math.Clamp(speed * 0.16, 14, 46);
      const ux = this.vel.x / speed;
      const uy = this.vel.y / speed;
      this.velGraphics.lineStyle(2, MG_COLORS.accent, 0.85);
      this.velGraphics.lineBetween(px, py, px + ux * len, py + uy * len);
      // arrowhead
      const a = Math.atan2(uy, ux);
      this.velGraphics.lineBetween(px + ux * len, py + uy * len,
        px + ux * len - Math.cos(a - 0.4) * 7, py + uy * len - Math.sin(a - 0.4) * 7);
      this.velGraphics.lineBetween(px + ux * len, py + uy * len,
        px + ux * len - Math.cos(a + 0.4) * 7, py + uy * len - Math.sin(a + 0.4) * 7);
    }

    // Orbit status + probe tint from how close to the ideal ring
    const dev = Math.abs(r - this.R0);
    const band = Math.max(this.R0 - this.Rin, this.Rout - this.R0);
    const quality = Phaser.Math.Clamp(1 - dev / band, 0, 1);
    let status;
    let color;
    if (quality > 0.7) { status = 'STABLE ORBIT'; color = MG_COLORS.good; }
    else if (r < this.R0) { status = 'ORBIT DECAYING — thrust prograde'; color = MG_COLORS.warn; }
    else { status = 'ORBIT ESCAPING — thrust retrograde'; color = MG_COLORS.warn; }
    this.statusText.setText(`ALT ${Math.round(r)}  ·  V ${Math.round(speed)}  ·  ${status}`);
    this.statusText.setColor(`#${color.toString(16).padStart(6, '0')}`);
    this.probeGraphics.setFillStyle(quality > 0.7 ? MG_COLORS.good : MG_COLORS.warn);
  }

  endGame(success) {
    if (this.gameOver) return;
    this.gameOver = true;
    this.input.keyboard.off('keydown-ESC');

    const avgQuality = this.qualitySamples.length > 0
      ? this.qualitySamples.reduce((a, b) => a + b, 0) / this.qualitySamples.length
      : 0;
    const accuracy = Math.round(Phaser.Math.Clamp(avgQuality * 100, 0, 100));
    const score = Math.max(0, Math.round(accuracy * 12 - this.breaches * 150));

    this.finishGame({
      status: success ? 'success' : 'failed',
      accuracy,
      score,
      themeColor: THEME_COLOR,
      statLines: [
        { label: 'Orbit Held', value: `${this.elapsed.toFixed(1)}s / ${this.survivalTarget.toFixed(1)}s` },
        { label: 'Orbit Precision', value: `${accuracy}%` },
        { label: 'Breaches', value: `${this.breaches} / ${this.maxBreaches}` },
        { label: 'Score', value: score },
      ],
      flavorText: success
        ? 'Stable orbit achieved — tidal forces neutralized, event horizon held.'
        : 'Orbit lost — the probe was torn into the accretion flow.',
    });
  }
}

export default GravityWellScene;
