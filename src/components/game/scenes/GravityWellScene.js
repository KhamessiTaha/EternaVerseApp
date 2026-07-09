/**
 * Gravity Well Containment Mini-Game
 *
 * A gravitational anomaly (black hole merger, dark matter clump) is pulling
 * a containment probe toward a rotating point of maximum tidal force. The
 * player holds arrow keys to counter-thrust and keep the probe inside the
 * containment ring for a sustained duration - a hold/balance challenge
 * rather than a single timed press, and pull strength escalates the longer
 * you survive.
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

    this.radius = 150;
    this.probe = { x: 0, y: 0 };
    this.pullAngle = Math.random() * Math.PI * 2;
    this.pullRotationSpeed = 0.35 + severity * 0.12; // rad/s
    this.pullStrengthBase = 40 + severity * 12;
    this.pullStrengthRampPerSec = 3 + severity * 1.5;
    this.counterForce = 220;

    this.elapsed = 0;
    this.survivalTarget = 11 + severity * 1.2;
    this.breaches = 0;
    this.maxBreaches = 3;

    this.containmentSamples = [];
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
      `Severity ${this.anomaly?.severity || '?'} · Hold arrow keys to counter-thrust`
    );

    this.add.circle(cx, cy, this.radius, THEME_COLOR, 0).setStrokeStyle(2, THEME_COLOR, 0.6);
    this.add.circle(cx, cy, 5, MG_COLORS.ink, 0.85);

    this.pullIndicator = this.add.graphics();

    this.probeGlow = this.add.circle(cx, cy, 14, MG_COLORS.good, 0.25).setBlendMode(Phaser.BlendModes.ADD);
    this.probeGraphics = this.add.circle(cx, cy, 8, MG_COLORS.good);

    const barWidth = 240;
    const barY = cy + this.radius + 50;
    this.add.rectangle(cx, barY, barWidth, 6, MG_COLORS.line).setOrigin(0.5);
    this.progressFill = this.add.rectangle(cx - barWidth / 2, barY, 0, 6, THEME_COLOR).setOrigin(0, 0.5);
    this.progressBarWidth = barWidth;

    this.add.text(cx, barY + 16, 'CONTAINMENT TIME', {
      fontFamily: '"IBM Plex Mono", monospace',
      fontSize: '10px',
      color: '#565a72',
    }).setOrigin(0.5);

    this.breachText = this.add.text(cx, 130, `BREACHES 0 / ${this.maxBreaches}`, {
      fontFamily: '"IBM Plex Mono", monospace',
      fontSize: '13px',
      color: '#e0524a',
    }).setOrigin(0.5);

    this.keys = this.input.keyboard.addKeys('UP,DOWN,LEFT,RIGHT');
  }

  update(time, delta) {
    if (this.gameOver) return;
    const dt = delta / 1000;
    this.elapsed += dt;

    this.pullAngle += this.pullRotationSpeed * dt;
    const pullStrength = this.pullStrengthBase + this.pullStrengthRampPerSec * this.elapsed;

    this.probe.x += Math.cos(this.pullAngle) * pullStrength * dt;
    this.probe.y += Math.sin(this.pullAngle) * pullStrength * dt;

    let inputX = 0;
    let inputY = 0;
    if (this.keys.LEFT.isDown) inputX -= 1;
    if (this.keys.RIGHT.isDown) inputX += 1;
    if (this.keys.UP.isDown) inputY -= 1;
    if (this.keys.DOWN.isDown) inputY += 1;

    if (inputX !== 0 || inputY !== 0) {
      const len = Math.sqrt(inputX * inputX + inputY * inputY);
      this.probe.x += (inputX / len) * this.counterForce * dt;
      this.probe.y += (inputY / len) * this.counterForce * dt;
    }

    const dist = Math.sqrt(this.probe.x ** 2 + this.probe.y ** 2);

    if (dist > this.radius) {
      this.registerBreach();
    } else {
      this.containmentSamples.push(1 - dist / this.radius);
    }

    this.probeGraphics.setPosition(this.centerX + this.probe.x, this.centerY + this.probe.y);
    this.probeGlow.setPosition(this.centerX + this.probe.x, this.centerY + this.probe.y);

    this.pullIndicator.clear();
    this.pullIndicator.lineStyle(2, MG_COLORS.critical, 0.5);
    const arrowLen = 30;
    this.pullIndicator.lineBetween(
      this.centerX, this.centerY,
      this.centerX + Math.cos(this.pullAngle) * arrowLen,
      this.centerY + Math.sin(this.pullAngle) * arrowLen
    );

    const progress = Math.min(1, this.elapsed / this.survivalTarget);
    this.progressFill.width = this.progressBarWidth * progress;

    if (this.elapsed >= this.survivalTarget) {
      this.endGame(true);
    } else if (this.breaches >= this.maxBreaches) {
      this.endGame(false);
    }
  }

  registerBreach() {
    this.breaches++;
    this.breachText.setText(`BREACHES ${this.breaches} / ${this.maxBreaches}`);
    this.shake(200, 0.01);
    this.showFeedback('BREACH!', MG_COLORS.critical, this.centerX, this.centerY - this.radius - 30);

    // Pull the probe back part-way so a breach doesn't guarantee an instant re-breach
    this.probe.x *= 0.4;
    this.probe.y *= 0.4;
  }

  endGame(success) {
    if (this.gameOver) return;
    this.gameOver = true;
    this.input.keyboard.off('keydown-ESC');

    const avgContainment = this.containmentSamples.length > 0
      ? this.containmentSamples.reduce((a, b) => a + b, 0) / this.containmentSamples.length
      : 0;
    const accuracy = Math.round(Phaser.Math.Clamp(avgContainment * 100, 0, 100));
    const score = Math.max(0, Math.round(accuracy * 12 - this.breaches * 150));

    this.finishGame({
      status: success ? 'success' : 'failed',
      accuracy,
      score,
      themeColor: THEME_COLOR,
      statLines: [
        { label: 'Containment Time', value: `${this.elapsed.toFixed(1)}s / ${this.survivalTarget.toFixed(1)}s` },
        { label: 'Avg. Containment', value: `${accuracy}%` },
        { label: 'Breaches', value: `${this.breaches} / ${this.maxBreaches}` },
        { label: 'Score', value: score },
      ],
      flavorText: success
        ? 'Tidal forces neutralized - event horizon stabilized.'
        : 'Containment field collapsed - mass continues to accrete.',
    });
  }
}

export default GravityWellScene;
