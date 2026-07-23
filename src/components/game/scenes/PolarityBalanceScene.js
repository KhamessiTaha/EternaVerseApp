/**
 * Polarity Balance Mini-Game  —  real Lorentz-force magnetic confinement.
 *
 * An electromagnetic anomaly has spat out a charged probe that moves at
 * constant speed and won't stop. Your only tool is the containment field's
 * POLARITY: a magnetic field perpendicular to the plane curves the probe via
 * the Lorentz force F = qv×B, always perpendicular to its motion, bending it
 * into a circular arc (cyclotron motion) whose radius is r = mv/qB.
 *
 *   ← field one way  -> curve counter-clockwise
 *   → field the other -> curve clockwise
 *   neither           -> B = 0, the probe coasts in a straight line
 *
 * Thread the probe through the glowing flux nodes to drain the anomaly, using
 * nothing but polarity to steer, while the containment wall stays lethal — the
 * probe can't brake, so every approach is an arc you have to plan. The
 * mechanic IS the physics: real cyclotron steering, no scripted timing.
 */
import Phaser from 'phaser';
import MiniGameScene, { MG_COLORS } from './MiniGameScene.js';

const THEME_COLOR = 0x4ec9e0; // electromagnetic cyan
const NODE_R = 20;            // flux-node collection radius
const PROBE_R = 7;

export class PolarityBalanceScene extends MiniGameScene {
  constructor() {
    super('PolarityBalanceScene');
  }

  init(data) {
    super.init(data);
    const severity = Math.max(1, Math.min(5, this.anomaly?.severity || 2));
    this.severity = severity;

    this.speed = 150 + severity * 15;                 // px/s, constant
    this.turnRadius = 44 + severity * 5;              // cyclotron radius
    this.omega = this.speed / this.turnRadius;        // angular rate under field
    this.nodesTarget = 4 + severity;
    this.parTime = this.nodesTarget * 2.2;

    this.maxBreaches = 3;
    this.breaches = 0;
    this.collected = 0;
    this._breachCd = 0;
    this.elapsed = 0;
    this.gameOver = false;
  }

  create() {
    super.create();
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    this.cx = width / 2;
    this.cy = height / 2 + 24;
    this.rBound = Math.min(208, height / 2 - 70);

    this.createHeader(
      'POLARITY BALANCE',
      THEME_COLOR,
      `Severity ${this.anomaly?.severity || '?'} · Steer with the field · reach every flux node`
    );
    this.add.text(this.cx, 116, '← field out (curve left)     → field in (curve right)     release = coast straight', {
      fontFamily: '"IBM Plex Mono", monospace', fontSize: '11px', color: '#dfa73f',
    }).setOrigin(0.5);

    this.collectText = this.add.text(this.cx - 120, 142, `NODES 0 / ${this.nodesTarget}`, {
      fontFamily: '"IBM Plex Mono", monospace', fontSize: '13px', color: '#4fd1a5',
    }).setOrigin(0, 0.5);
    this.breachText = this.add.text(this.cx + 120, 142, `BREACHES 0 / ${this.maxBreaches}`, {
      fontFamily: '"IBM Plex Mono", monospace', fontSize: '13px', color: '#e0524a',
    }).setOrigin(1, 0.5);

    // Containment wall
    this.wall = this.add.circle(this.cx, this.cy, this.rBound, THEME_COLOR, 0.03).setStrokeStyle(2, THEME_COLOR, 0.5);

    // Field polarity indicator (⊙ out of page / ⊗ into page)
    this.fieldText = this.add.text(this.cx, this.cy + this.rBound + 26, '', {
      fontFamily: '"IBM Plex Mono", monospace', fontSize: '13px', color: '#565a72',
    }).setOrigin(0.5);

    // Probe (world coords relative to center)
    this.probe = { x: 0, y: 0, th: -Math.PI / 2 };
    this.trail = [];
    this.maxTrail = 70;
    this.trailGraphics = this.add.graphics();
    this.probeGlow = this.add.circle(this.cx, this.cy, 15, THEME_COLOR, 0.3).setBlendMode(Phaser.BlendModes.ADD);
    this.probeDot = this.add.circle(this.cx, this.cy, PROBE_R, MG_COLORS.ink);

    // First flux node
    this.node = this.add.circle(0, 0, NODE_R * 0.55, MG_COLORS.good, 0.9);
    this.nodeGlow = this.add.circle(0, 0, NODE_R, MG_COLORS.good, 0.25).setBlendMode(Phaser.BlendModes.ADD);
    this.spawnNode();

    this.keys = this.input.keyboard.addKeys('LEFT,RIGHT');
  }

  spawnNode() {
    const a = Math.random() * Math.PI * 2;
    // Up to 0.8 R: some nodes hug the wall, making the approach genuinely risky.
    const rr = (0.25 + Math.random() * 0.55) * this.rBound;
    this.nodePos = { x: Math.cos(a) * rr, y: Math.sin(a) * rr };
    this.node.setPosition(this.cx + this.nodePos.x, this.cy + this.nodePos.y);
    this.nodeGlow.setPosition(this.cx + this.nodePos.x, this.cy + this.nodePos.y);
  }

  update(time, delta) {
    if (this.gameOver) return;
    const dt = Math.min(delta / 1000, 0.04);
    this.elapsed += dt;
    if (this._breachCd > 0) this._breachCd -= dt;

    // Lorentz steering: field polarity sets the turn direction; none = straight.
    const left = this.keys.LEFT.isDown;
    const right = this.keys.RIGHT.isDown;
    if (left && !right) this.probe.th -= this.omega * dt;
    else if (right && !left) this.probe.th += this.omega * dt;

    this.probe.x += Math.cos(this.probe.th) * this.speed * dt;
    this.probe.y += Math.sin(this.probe.th) * this.speed * dt;

    // Containment wall (lethal)
    const r = Math.hypot(this.probe.x, this.probe.y);
    if (r > this.rBound - PROBE_R) {
      if (this._breachCd <= 0) this.registerBreach();
      // Reflect inward so one graze isn't an instant cascade
      const ang = Math.atan2(this.probe.y, this.probe.x);
      this.probe.x = Math.cos(ang) * (this.rBound - PROBE_R - 2);
      this.probe.y = Math.sin(ang) * (this.rBound - PROBE_R - 2);
      this.probe.th = ang + Math.PI + (Math.random() - 0.5) * 0.4; // head back inward
    }

    // Flux-node collection
    if (Math.hypot(this.probe.x - this.nodePos.x, this.probe.y - this.nodePos.y) < NODE_R + PROBE_R) {
      this.collected++;
      this.collectText.setText(`NODES ${this.collected} / ${this.nodesTarget}`);
      // Positive feedback color triggers the 'hit' audio cue via the base class.
      this.showFeedback('+FLUX', MG_COLORS.good, this.cx + this.nodePos.x, this.cy + this.nodePos.y - 26);
      if (this.collected >= this.nodesTarget) { this.endGame(true); return; }
      this.spawnNode();
    }

    this.render(left, right);
  }

  render(left, right) {
    const px = this.cx + this.probe.x;
    const py = this.cy + this.probe.y;
    this.probeDot.setPosition(px, py);
    this.probeGlow.setPosition(px, py);

    // Trail traces the cyclotron arcs
    this.trail.push({ x: px, y: py });
    if (this.trail.length > this.maxTrail) this.trail.shift();
    this.trailGraphics.clear();
    this.trailGraphics.lineStyle(2, THEME_COLOR, 0.55);
    this.trailGraphics.beginPath();
    this.trail.forEach((p, i) => (i === 0 ? this.trailGraphics.moveTo(p.x, p.y) : this.trailGraphics.lineTo(p.x, p.y)));
    this.trailGraphics.strokePath();

    // Wall glows red when the probe is close to escaping
    const r = Math.hypot(this.probe.x, this.probe.y);
    const near = r > this.rBound * 0.82;
    this.wall.setStrokeStyle(2, near ? MG_COLORS.critical : THEME_COLOR, near ? 0.9 : 0.5);

    if (left && !right) this.fieldText.setText('⊙ FIELD OUT — curving left').setColor('#4ec9e0');
    else if (right && !left) this.fieldText.setText('⊗ FIELD IN — curving right').setColor('#4ec9e0');
    else this.fieldText.setText('— NO FIELD — coasting straight').setColor('#565a72');
  }

  registerBreach() {
    this.breaches++;
    this._breachCd = 0.7;
    this.breachText.setText(`BREACHES ${this.breaches} / ${this.maxBreaches}`);
    this.shake(180, 0.01);
    this.showFeedback('CONTAINMENT BREACH!', MG_COLORS.critical, this.cx, this.cy - this.rBound - 22);
    if (this.breaches >= this.maxBreaches) this.endGame(false);
  }

  endGame(success) {
    if (this.gameOver) return;
    this.gameOver = true;
    this.input.keyboard.off('keydown-ESC');

    const timePenalty = Math.max(0, this.elapsed - this.parTime);
    const accuracy = Math.round(Phaser.Math.Clamp(100 - this.breaches * 15 - timePenalty * 1.5, 0, 100));
    const score = Math.max(0, Math.round(this.collected * 70 + accuracy * 6 - this.breaches * 130));

    this.finishGame({
      status: success ? 'success' : 'failed',
      accuracy,
      score,
      themeColor: THEME_COLOR,
      statLines: [
        { label: 'Flux Nodes', value: `${this.collected} / ${this.nodesTarget}` },
        { label: 'Time', value: `${this.elapsed.toFixed(1)}s (par ${this.parTime.toFixed(0)}s)` },
        { label: 'Breaches', value: `${this.breaches} / ${this.maxBreaches}` },
        { label: 'Score', value: score },
      ],
      flavorText: success
        ? 'Flux drained — the field held and the polarity anomaly collapsed.'
        : 'The probe escaped confinement — magnetic reversal ran away.',
    });
  }
}

export default PolarityBalanceScene;
