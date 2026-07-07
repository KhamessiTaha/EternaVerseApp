/**
 * Expansion Containment Mini-Game
 *
 * A cosmological anomaly (dark energy surge) is driving multiple expansion
 * fronts outward simultaneously. Click each front to push it back before it
 * breaches its critical radius. Unlike the Cascade's one-at-a-time reaction
 * chain, all fronts grow continuously and in parallel - this is a divided-
 * attention/triage challenge, not a reflex chain.
 */
import Phaser from 'phaser';
import MiniGameScene, { MG_COLORS } from './MiniGameScene.js';

const THEME_COLOR = 0x5b8dd9; // cosmological blue

export class ExpansionContainmentScene extends MiniGameScene {
  constructor() {
    super('ExpansionContainmentScene');
  }

  init(data) {
    super.init(data);

    const severity = Math.max(1, Math.min(5, this.anomaly?.severity || 2));

    this.nodeCount = 3 + (severity >= 4 ? 1 : 0);
    this.growthRate = 5 + severity * 1.6;
    this.criticalRadius = 90;
    this.pushBackAmount = 40;

    this.survivalTarget = 12 + severity * 1.2;
    this.elapsed = 0;
    this.breaches = 0;
    this.maxBreaches = 3;

    this.containmentSamples = [];
    this.gameOver = false;
    this.fronts = [];
  }

  create() {
    super.create();

    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const cy = height / 2 + 10;

    this.createHeader(
      'EXPANSION CONTAINMENT',
      THEME_COLOR,
      `Severity ${this.anomaly?.severity || '?'} · Click each front to push it back before it breaches`
    );

    const margin = 160;
    const positions = Array.from({ length: this.nodeCount }, (_, i) => ({
      x: margin + (i * (width - margin * 2)) / Math.max(1, this.nodeCount - 1),
      y: cy + (i % 2 === 0 ? -60 : 60),
    }));

    this.fronts = positions.map((pos) => {
      const ring = this.add.graphics();
      const zone = this.add.circle(pos.x, pos.y, 6, THEME_COLOR, 0.9).setInteractive({ useHandCursor: true });
      const front = { x: pos.x, y: pos.y, radius: 14, ring, zone };
      zone.on('pointerdown', () => this.pushBack(front));
      return front;
    });

    const barWidth = 240;
    const barY = height - 70;
    this.add.rectangle(width / 2, barY, barWidth, 6, MG_COLORS.line).setOrigin(0.5);
    this.progressFill = this.add.rectangle(width / 2 - barWidth / 2, barY, 0, 6, THEME_COLOR).setOrigin(0, 0.5);
    this.progressBarWidth = barWidth;

    this.add.text(width / 2, barY + 16, 'CONTAINMENT TIME', {
      fontFamily: '"IBM Plex Mono", monospace',
      fontSize: '10px',
      color: '#565a72',
    }).setOrigin(0.5);

    this.breachText = this.add.text(width / 2, 130, `BREACHES 0 / ${this.maxBreaches}`, {
      fontFamily: '"IBM Plex Mono", monospace',
      fontSize: '13px',
      color: '#e0524a',
    }).setOrigin(0.5);
  }

  pushBack(front) {
    if (this.gameOver) return;
    front.radius = Math.max(14, front.radius - this.pushBackAmount);
    this.showFeedback('PUSHED', MG_COLORS.good, front.x, front.y - 40);
  }

  update(time, delta) {
    if (this.gameOver) return;
    const dt = delta / 1000;
    this.elapsed += dt;

    let worstRatio = 0;
    this.fronts.forEach((front) => {
      front.radius += this.growthRate * dt;
      const ratio = front.radius / this.criticalRadius;
      worstRatio = Math.max(worstRatio, ratio);

      front.ring.clear();
      const color = ratio > 0.75 ? MG_COLORS.critical : THEME_COLOR;
      front.ring.lineStyle(2, color, 0.8);
      front.ring.strokeCircle(front.x, front.y, front.radius);

      if (front.radius >= this.criticalRadius) {
        this.registerBreach(front);
      }
    });

    this.containmentSamples.push(Phaser.Math.Clamp(1 - worstRatio, 0, 1));

    const progress = Math.min(1, this.elapsed / this.survivalTarget);
    this.progressFill.width = this.progressBarWidth * progress;

    if (this.elapsed >= this.survivalTarget) {
      this.endGame(true);
    } else if (this.breaches >= this.maxBreaches) {
      this.endGame(false);
    }
  }

  registerBreach(front) {
    this.breaches++;
    this.breachText.setText(`BREACHES ${this.breaches} / ${this.maxBreaches}`);
    this.cameras.main.shake(200, 0.01);
    this.showFeedback('BREACH!', MG_COLORS.critical, front.x, front.y - 40);
    front.radius = 14;
  }

  endGame(success) {
    if (this.gameOver) return;
    this.gameOver = true;
    this.input.keyboard.off('keydown-ESC');

    const avg = this.containmentSamples.length > 0
      ? this.containmentSamples.reduce((a, b) => a + b, 0) / this.containmentSamples.length
      : 0;
    const accuracy = Math.round(Phaser.Math.Clamp(avg * 100, 0, 100));
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
        ? 'Expansion fronts throttled - local metric stabilized.'
        : 'Expansion outpaced containment - space continues to stretch.',
    });
  }
}

export default ExpansionContainmentScene;
