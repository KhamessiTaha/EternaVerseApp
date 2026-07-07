/**
 * Polarity Balance Mini-Game
 *
 * An electromagnetic anomaly (magnetic reversal) is destabilizing both
 * magnetic poles at once. Keep North (W/S) and South (UP/DOWN) each inside
 * their target band while random reversal pulses knock them around - the
 * two poles are lightly coupled, so correcting one nudges the other. A
 * genuine divided-attention dual-task, distinct from the single continuous
 * 2D balance of the Gravity Well.
 */
import Phaser from 'phaser';
import MiniGameScene, { MG_COLORS } from './MiniGameScene.js';

const THEME_COLOR = 0x4ec9e0; // electromagnetic cyan

export class PolarityBalanceScene extends MiniGameScene {
  constructor() {
    super('PolarityBalanceScene');
  }

  init(data) {
    super.init(data);

    const severity = Math.max(1, Math.min(5, this.anomaly?.severity || 2));

    this.north = 50;
    this.south = 50;
    this.targetMin = 35;
    this.targetMax = 65;
    this.hardMin = 10;
    this.hardMax = 90;

    this.nudgeAmount = 55;
    this.coupling = 0.18;

    this.pulseInterval = 2.6 - severity * 0.15;
    this.timeSincePulse = 0;
    this.pulseStrength = 10 + severity * 3;

    this.survivalTarget = 12 + severity * 1.1;
    this.elapsed = 0;
    this.breaches = 0;
    this.maxBreaches = 3;

    this.syncSamples = [];
    this.gameOver = false;
  }

  create() {
    super.create();

    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const cy = height / 2 + 10;

    this.createHeader(
      'POLARITY BALANCE',
      THEME_COLOR,
      `Severity ${this.anomaly?.severity || '?'} · W/S = North pole · UP/DOWN = South pole`
    );

    const gaugeHeight = 220;
    const gaugeWidth = 46;
    const northX = width / 2 - 90;
    const southX = width / 2 + 90;

    this.northGauge = this.createGauge(northX, cy, gaugeWidth, gaugeHeight, 'NORTH');
    this.southGauge = this.createGauge(southX, cy, gaugeWidth, gaugeHeight, 'SOUTH');

    const barWidth = 240;
    const barY = height - 70;
    this.add.rectangle(width / 2, barY, barWidth, 6, MG_COLORS.line).setOrigin(0.5);
    this.progressFill = this.add.rectangle(width / 2 - barWidth / 2, barY, 0, 6, THEME_COLOR).setOrigin(0, 0.5);
    this.progressBarWidth = barWidth;

    this.add.text(width / 2, barY + 16, 'SYNC TIME', {
      fontFamily: '"IBM Plex Mono", monospace',
      fontSize: '10px',
      color: '#565a72',
    }).setOrigin(0.5);

    this.breachText = this.add.text(width / 2, 130, `BREACHES 0 / ${this.maxBreaches}`, {
      fontFamily: '"IBM Plex Mono", monospace',
      fontSize: '13px',
      color: '#e0524a',
    }).setOrigin(0.5);

    this.keys = this.input.keyboard.addKeys('W,S,UP,DOWN');
  }

  createGauge(x, y, w, h, label) {
    this.add.rectangle(x, y, w, h, MG_COLORS.voidRaised).setStrokeStyle(1, MG_COLORS.line);

    const bandTop = y - h / 2 + (h * (100 - this.targetMax)) / 100;
    const bandHeight = (h * (this.targetMax - this.targetMin)) / 100;
    this.add.rectangle(x, bandTop + bandHeight / 2, w, bandHeight, THEME_COLOR, 0.15)
      .setStrokeStyle(1, THEME_COLOR, 0.5);

    const fill = this.add.rectangle(x, y + h / 2, w - 6, 0, THEME_COLOR).setOrigin(0.5, 1);

    this.add.text(x, y - h / 2 - 14, label, {
      fontFamily: '"IBM Plex Mono", monospace',
      fontSize: '11px',
      color: '#9497ad',
    }).setOrigin(0.5);

    return { x, y, w, h, fill };
  }

  updateGaugeFill(gauge, value) {
    const ratio = Phaser.Math.Clamp(value, 0, 100) / 100;
    gauge.fill.height = gauge.h * ratio;
    gauge.fill.y = gauge.y + gauge.h / 2;

    const inBand = value >= this.targetMin && value <= this.targetMax;
    const critical = value <= this.hardMin || value >= this.hardMax;
    gauge.fill.fillColor = inBand ? MG_COLORS.good : critical ? MG_COLORS.critical : THEME_COLOR;
  }

  update(time, delta) {
    if (this.gameOver) return;
    const dt = delta / 1000;
    this.elapsed += dt;
    this.timeSincePulse += dt;

    if (this.timeSincePulse >= this.pulseInterval) {
      this.timeSincePulse = 0;
      const pulse = (Math.random() - 0.5) * 2 * this.pulseStrength;
      this.north = Phaser.Math.Clamp(this.north + pulse, 0, 100);
      this.south = Phaser.Math.Clamp(this.south - pulse * 0.6, 0, 100);
    }

    let northDelta = 0;
    let southDelta = 0;
    if (this.keys.W.isDown) northDelta -= this.nudgeAmount * dt;
    if (this.keys.S.isDown) northDelta += this.nudgeAmount * dt;
    if (this.keys.UP.isDown) southDelta -= this.nudgeAmount * dt;
    if (this.keys.DOWN.isDown) southDelta += this.nudgeAmount * dt;

    this.north = Phaser.Math.Clamp(this.north + northDelta - southDelta * this.coupling, 0, 100);
    this.south = Phaser.Math.Clamp(this.south + southDelta - northDelta * this.coupling, 0, 100);

    this.updateGaugeFill(this.northGauge, this.north);
    this.updateGaugeFill(this.southGauge, this.south);

    const northSync = this.north >= this.targetMin && this.north <= this.targetMax ? 1 : 0;
    const southSync = this.south >= this.targetMin && this.south <= this.targetMax ? 1 : 0;
    this.syncSamples.push((northSync + southSync) / 2);

    if (this.north <= this.hardMin || this.north >= this.hardMax || this.south <= this.hardMin || this.south >= this.hardMax) {
      this.registerBreach();
    }

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
    this.cameras.main.shake(200, 0.01);
    this.showFeedback('POLARITY BREACH!', MG_COLORS.critical, this.cameras.main.width / 2, 170);

    // Snap both poles back toward center so one breach doesn't cascade every frame
    this.north = 50 + (this.north - 50) * 0.3;
    this.south = 50 + (this.south - 50) * 0.3;
  }

  endGame(success) {
    if (this.gameOver) return;
    this.gameOver = true;
    this.input.keyboard.off('keydown-ESC');

    const avg = this.syncSamples.length > 0
      ? this.syncSamples.reduce((a, b) => a + b, 0) / this.syncSamples.length
      : 0;
    const accuracy = Math.round(Phaser.Math.Clamp(avg * 100, 0, 100));
    const score = Math.max(0, Math.round(accuracy * 12 - this.breaches * 150));

    this.finishGame({
      status: success ? 'success' : 'failed',
      accuracy,
      score,
      themeColor: THEME_COLOR,
      statLines: [
        { label: 'Sync Time', value: `${this.elapsed.toFixed(1)}s / ${this.survivalTarget.toFixed(1)}s` },
        { label: 'Avg. Sync', value: `${accuracy}%` },
        { label: 'Breaches', value: `${this.breaches} / ${this.maxBreaches}` },
        { label: 'Score', value: score },
      ],
      flavorText: success
        ? 'Dipole field re-synchronized - polarity holding steady.'
        : 'Poles decoupled - magnetic field reversal runaway.',
    });
  }
}

export default PolarityBalanceScene;
