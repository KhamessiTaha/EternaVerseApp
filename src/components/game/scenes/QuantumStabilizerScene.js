/**
 * Stabilizer Mini-Game (generic fallback)
 *
 * A precision timing game where players must hit a moving indicator within
 * a target zone. Used for anomaly categories that don't have a dedicated
 * minigame yet (cosmological, structural, electromagnetic) - see
 * InputSystem.mapAnomalyToGame for the category routing.
 */
import Phaser from 'phaser';
import MiniGameScene, { MG_COLORS } from './MiniGameScene.js';

const THEME_COLOR = MG_COLORS.accent;

export class QuantumStabilizerScene extends MiniGameScene {
  constructor() {
    super('QuantumStabilizerScene');
  }

  init(data) {
    super.init(data);

    this.indicatorPosition = 0;
    this.oscillationDirection = 1;
    this.targetZoneStart = 35;
    this.targetZoneWidth = 30;

    this.successHits = 0;
    this.failures = 0;
    this.totalAttempts = 0;
    this.hits = [];
    this.gameOver = false;
  }

  create() {
    super.create();

    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    const severity = this.anomaly?.severity || 2;
    const validSeverity = Math.max(0.3, Math.min(1.0, severity / 3));
    this.oscillationSpeed = 0.5 + validSeverity * 1.5;

    this.createHeader(
      'FIELD STABILIZER',
      THEME_COLOR,
      `Severity ${severity} · Press SPACE when the indicator enters the target zone`
    );

    this.input.keyboard.on('keydown-SPACE', () => this.attemptHit());

    const trackY = height / 2 + 10;
    const trackWidth = width - 120;
    const trackHeight = 50;
    const trackX = 60;

    this.add.rectangle(trackX + trackWidth / 2, trackY, trackWidth, trackHeight, MG_COLORS.voidRaised)
      .setStrokeStyle(1, MG_COLORS.line);

    const zoneX = trackX + (trackWidth * this.targetZoneStart) / 100;
    const zoneWidth = (trackWidth * this.targetZoneWidth) / 100;

    this.add.rectangle(zoneX + zoneWidth / 2, trackY, zoneWidth, trackHeight, MG_COLORS.good, 0.15)
      .setStrokeStyle(1, MG_COLORS.good, 0.7);

    this.add.text(zoneX + zoneWidth / 2, trackY + trackHeight / 2 + 16, 'TARGET', {
      fontFamily: '"IBM Plex Mono", monospace',
      fontSize: '10px',
      color: '#4fd1a5',
    }).setOrigin(0.5);

    this.indicatorGlow = this.add.circle(trackX + 8, trackY, 16, THEME_COLOR, 0.2).setBlendMode(Phaser.BlendModes.ADD);
    this.indicatorCircle = this.add.circle(trackX + 8, trackY, 9, THEME_COLOR);

    this.trackInfo = { x: trackX, y: trackY, width: trackWidth, zoneStart: zoneX, zoneWidth };

    this.successText = this.add.text(trackX, height - 130, 'HITS 0 / 5', {
      fontFamily: '"IBM Plex Mono", monospace',
      fontSize: '13px',
      color: '#4fd1a5',
    });

    this.failureText = this.add.text(trackX, height - 105, 'FAILURES 0 / 3', {
      fontFamily: '"IBM Plex Mono", monospace',
      fontSize: '13px',
      color: '#e0524a',
    });
  }

  update() {
    if (this.gameOver) return;

    this.indicatorPosition += this.oscillationSpeed * this.oscillationDirection;
    if (this.indicatorPosition >= 100) {
      this.indicatorPosition = 100;
      this.oscillationDirection = -1;
    } else if (this.indicatorPosition <= 0) {
      this.indicatorPosition = 0;
      this.oscillationDirection = 1;
    }

    const newX = this.trackInfo.x + (this.trackInfo.width * this.indicatorPosition) / 100;
    this.indicatorCircle.setX(newX);
    this.indicatorGlow.setX(newX);
  }

  attemptHit() {
    if (this.gameOver) return;
    this.totalAttempts++;

    const indicatorX = this.trackInfo.x + (this.trackInfo.width * this.indicatorPosition) / 100;
    const zoneStart = this.trackInfo.zoneStart;
    const zoneEnd = this.trackInfo.zoneStart + this.trackInfo.zoneWidth;
    const isHit = indicatorX >= zoneStart && indicatorX <= zoneEnd;

    if (isHit) this.registerHit(indicatorX);
    else this.registerMiss();
  }

  registerHit(indicatorX) {
    this.successHits++;

    const zoneCenter = this.trackInfo.zoneStart + this.trackInfo.zoneWidth / 2;
    const distanceFromCenter = Math.abs(indicatorX - zoneCenter);
    const maxDistance = this.trackInfo.zoneWidth / 2;
    const accuracy = Math.max(0, 1 - distanceFromCenter / maxDistance);

    this.hits.push({ success: true, accuracy });
    this.successText.setText(`HITS ${this.successHits} / 5`);
    this.showFeedback(`HIT ${Math.round(accuracy * 100)}%`, MG_COLORS.good);

    if (this.successHits >= 5) this.endGame(true);
  }

  registerMiss() {
    this.failures++;
    this.hits.push({ success: false, accuracy: 0 });
    this.failureText.setText(`FAILURES ${this.failures} / 3`);
    this.showFeedback('MISS', MG_COLORS.critical);
    this.cameras.main.shake(100, 0.004);

    if (this.failures >= 3) this.endGame(false);
  }

  endGame(success) {
    if (this.gameOver) return;
    this.gameOver = true;
    this.input.keyboard.off('keydown-ESC');
    this.input.keyboard.off('keydown-SPACE');

    const successfulHits = this.hits.filter((h) => h.success);
    const avgAccuracy = successfulHits.length > 0
      ? successfulHits.reduce((sum, h) => sum + h.accuracy, 0) / successfulHits.length
      : 0;
    const accuracy = Math.round(Phaser.Math.Clamp(avgAccuracy * 100, 0, 100));
    const score = Math.max(0, Math.round(this.successHits * 100 + accuracy * 5 - this.failures * 80));

    this.finishGame({
      status: success ? 'success' : 'failed',
      accuracy,
      score,
      themeColor: THEME_COLOR,
      statLines: [
        { label: 'Hits', value: `${this.successHits} / 5` },
        { label: 'Failures', value: `${this.failures} / 3` },
        { label: 'Accuracy', value: `${accuracy}%` },
        { label: 'Score', value: score },
      ],
      flavorText: success
        ? 'Field harmonics locked - anomaly signature neutralized.'
        : 'Field failed to lock - anomaly signature persists.',
    });
  }
}

export default QuantumStabilizerScene;
