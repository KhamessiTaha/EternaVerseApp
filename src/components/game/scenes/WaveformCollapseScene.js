/**
 * Waveform Collapse Mini-Game
 *
 * A quantum anomaly (fluctuation, tunneling) is an unstable superposition -
 * an oscillating waveform drifts through a target band, and the player
 * "measures" it (SPACE) to collapse it into the target eigenstate. Every
 * successful measurement re-targets a new band at the same rhythm; every
 * few seconds a genuine decoherence event shifts the wave's frequency
 * itself, forcing the player to re-adapt their timing rather than just
 * memorizing one period - the mechanic this game is actually testing.
 */
import Phaser from 'phaser';
import MiniGameScene, { MG_COLORS } from './MiniGameScene.js';

const THEME_COLOR = 0x4fd1a5; // quantum teal

export class WaveformCollapseScene extends MiniGameScene {
  constructor() {
    super('WaveformCollapseScene');
  }

  init(data) {
    super.init(data);

    const severity = Math.max(1, Math.min(5, this.anomaly?.severity || 2));

    this.targetCollapses = 8 + severity;
    this.maxMisses = 3;
    this.collapses = 0;
    this.misses = 0;

    this.amplitude = 70;
    this.frequency = 0.7 + severity * 0.12;
    this.phase = 0;
    this.elapsed = 0;

    this.decoherenceInterval = 3.4;
    this.timeSinceDecoherence = 0;

    this.targetY = 0;
    this.targetBand = 34;

    this.accuracySamples = [];
    this.gameOver = false;
  }

  create() {
    super.create();

    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    this.centerY = height / 2 + 10;
    this.collapseLineX = width / 2;

    this.createHeader(
      'WAVEFORM COLLAPSE',
      THEME_COLOR,
      `Severity ${this.anomaly?.severity || '?'} · Press SPACE as the wave crosses the target band`
    );

    this.add.rectangle(width / 2, this.centerY, width - 100, 1, MG_COLORS.line).setOrigin(0.5);
    this.add.rectangle(this.collapseLineX, this.centerY, 2, 200, MG_COLORS.inkFaint).setOrigin(0.5);

    this.bandGraphics = this.add.graphics();
    this.repositionTarget();

    this.waveGraphics = this.add.graphics();
    this.waveHistory = [];
    this.maxHistory = 260;

    this.marker = this.add.circle(this.collapseLineX, this.centerY, 6, MG_COLORS.ink);

    this.collapseText = this.add.text(width / 2 - 100, 130, `COLLAPSED 0 / ${this.targetCollapses}`, {
      fontFamily: '"IBM Plex Mono", monospace',
      fontSize: '13px',
      color: '#4fd1a5',
    }).setOrigin(0, 0.5);

    this.missText = this.add.text(width / 2 + 100, 130, `DECOHERED 0 / ${this.maxMisses}`, {
      fontFamily: '"IBM Plex Mono", monospace',
      fontSize: '13px',
      color: '#e0524a',
    }).setOrigin(1, 0.5);

    this.input.keyboard.on('keydown-SPACE', () => this.attemptCollapse());
  }

  // Quiet retarget after a successful collapse - same rhythm, new position
  repositionTarget() {
    this.targetY = (Math.random() - 0.5) * this.amplitude * 1.3;

    this.bandGraphics.clear();
    this.bandGraphics.fillStyle(THEME_COLOR, 0.15);
    this.bandGraphics.fillRect(
      this.collapseLineX - 90, this.centerY + this.targetY - this.targetBand,
      180, this.targetBand * 2
    );
    this.bandGraphics.lineStyle(1, THEME_COLOR, 0.6);
    this.bandGraphics.strokeRect(
      this.collapseLineX - 90, this.centerY + this.targetY - this.targetBand,
      180, this.targetBand * 2
    );
  }

  // Periodic forced event - changes the wave's actual frequency, not just the target
  triggerDecoherence() {
    this.frequency = 0.6 + Math.random() * 1.1 + (this.anomaly?.severity || 2) * 0.08;
    this.timeSinceDecoherence = 0;
    this.repositionTarget();
    this.cameras.main.flash(180, 79, 209, 165, false);
    this.showFeedback('DECOHERENCE SHIFT', MG_COLORS.warn, this.collapseLineX, this.centerY - 120);
  }

  currentWaveY() {
    return Math.sin(2 * Math.PI * this.frequency * this.elapsed + this.phase) * this.amplitude;
  }

  update(time, delta) {
    if (this.gameOver) return;
    const dt = delta / 1000;
    this.elapsed += dt;
    this.timeSinceDecoherence += dt;

    if (this.timeSinceDecoherence >= this.decoherenceInterval) {
      this.triggerDecoherence();
    }

    const y = this.currentWaveY();
    this.marker.y = this.centerY + y;

    this.waveHistory.push(y);
    if (this.waveHistory.length > this.maxHistory) this.waveHistory.shift();

    this.waveGraphics.clear();
    this.waveGraphics.lineStyle(2, THEME_COLOR, 0.8);
    this.waveGraphics.beginPath();
    const step = 2;
    this.waveHistory.forEach((sampleY, i) => {
      const x = this.collapseLineX - (this.waveHistory.length - i) * step;
      const py = this.centerY + sampleY;
      if (i === 0) this.waveGraphics.moveTo(x, py);
      else this.waveGraphics.lineTo(x, py);
    });
    this.waveGraphics.strokePath();
  }

  attemptCollapse() {
    if (this.gameOver) return;

    const y = this.currentWaveY();
    const distance = Math.abs(y - this.targetY);
    const inBand = distance <= this.targetBand;

    if (inBand) {
      const accuracy = Phaser.Math.Clamp(1 - distance / this.targetBand, 0, 1);
      this.accuracySamples.push(accuracy);
      this.collapses++;
      this.collapseText.setText(`COLLAPSED ${this.collapses} / ${this.targetCollapses}`);
      this.showFeedback(`COLLAPSED ${Math.round(accuracy * 100)}%`, MG_COLORS.good, this.collapseLineX, this.centerY - 90);

      if (this.collapses >= this.targetCollapses) {
        this.endGame(true);
        return;
      }
      this.repositionTarget();
    } else {
      this.misses++;
      this.missText.setText(`DECOHERED ${this.misses} / ${this.maxMisses}`);
      this.showFeedback('DECOHERED', MG_COLORS.critical, this.collapseLineX, this.centerY - 90);
      this.shake(120, 0.006);

      if (this.misses >= this.maxMisses) {
        this.endGame(false);
      }
    }
  }

  endGame(success) {
    if (this.gameOver) return;
    this.gameOver = true;
    this.input.keyboard.off('keydown-ESC');
    this.input.keyboard.off('keydown-SPACE');

    const avgAccuracy = this.accuracySamples.length > 0
      ? this.accuracySamples.reduce((a, b) => a + b, 0) / this.accuracySamples.length
      : 0;
    const accuracy = Math.round(Phaser.Math.Clamp(avgAccuracy * 100, 0, 100));
    const score = Math.max(0, Math.round(this.collapses * 90 + accuracy * 5 - this.misses * 130));

    this.finishGame({
      status: success ? 'success' : 'failed',
      accuracy,
      score,
      themeColor: THEME_COLOR,
      statLines: [
        { label: 'Collapsed', value: `${this.collapses} / ${this.targetCollapses}` },
        { label: 'Avg. Coherence', value: `${accuracy}%` },
        { label: 'Decoherences', value: `${this.misses} / ${this.maxMisses}` },
        { label: 'Score', value: score },
      ],
      flavorText: success
        ? 'Wavefunction resolved to a stable eigenstate.'
        : 'Superposition collapsed into decoherent noise.',
    });
  }
}

export default WaveformCollapseScene;
