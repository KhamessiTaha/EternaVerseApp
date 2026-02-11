/**
 * Quantum Stabilizer Mini-Game Scene
 *
 * A precision timing game where players must hit a moving indicator
 * within a target zone.
 *
 * Gameplay:
 * - Indicator oscillates left-right on a horizontal track
 * - Target zone is fixed at a random location
 * - Press SPACE to attempt hit when indicator is in zone
 * - Win: 5 successful hits before 3 failures
 * - Speed scales with anomaly severity
 */

import Phaser from 'phaser';
import MiniGameScene from './MiniGameScene.js';

export class QuantumStabilizerScene extends MiniGameScene {
  constructor() {
    super('QuantumStabilizerScene');
  }

  init(data) {
    super.init(data);

    // Game state
    this.indicatorPosition = 0;
    this.oscillationSpeed = 0;
    this.oscillationDirection = 1;
    this.targetZoneStart = 35;
    this.targetZoneWidth = 30;

    // Counters
    this.successHits = 0;
    this.failures = 0;
    this.totalAttempts = 0;

    // Timing
    this.gameStartTime = 0;
    this.hits = [];

    // UI references
    this.trackGraphics = null;
    this.indicatorGraphics = null;
    this.successText = null;
    this.failureText = null;
    this.instructionText = null;
  }

  create() {
    super.create();

    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    this.gameStartTime = this.time.now;

    // Calculate difficulty from anomaly severity
    const baseFactor = 0.4; // Very slow base
    const speedMultiplier = baseFactor * (this.anomaly?.severity || 0.5);
    this.oscillationSpeed = speedMultiplier;

    // Setup keyboard
    this.input.keyboard.on('keydown-SPACE', () => {
      this.attemptHit();
    });

    // Title
    this.add.text(width / 2, 40, 'QUANTUM STABILIZER', {
      font: 'bold 36px Courier',
      fill: '#00ffff',
      align: 'center'
    }).setOrigin(0.5);

    // Severity display
    this.add.text(width / 2, 85, `Anomaly Severity: ${(this.anomaly?.severity * 100).toFixed(0)}%`, {
      font: 'bold 16px Courier',
      fill: '#00ccff',
      align: 'center'
    }).setOrigin(0.5);

    // Game instructions
    this.instructionText = this.add.text(width / 2, 130, 'Press SPACE when indicator enters target zone', {
      font: '14px Courier',
      fill: '#cccccc',
      align: 'center'
    }).setOrigin(0.5);

    // Track setup
    const trackY = height / 2;
    const trackWidth = width - 80;
    const trackHeight = 60;
    const trackX = 40;

    // Background track
    const track = this.add.rectangle(
      trackX + trackWidth / 2,
      trackY,
      trackWidth,
      trackHeight,
      0x1a1a1a
    );
    track.setStrokeStyle(2, 0x00ffff);

    // Target zone highlight
    const zoneX = trackX + (trackWidth * this.targetZoneStart / 100);
    const zoneWidth = trackWidth * this.targetZoneWidth / 100;

    this.add.rectangle(
      zoneX + zoneWidth / 2,
      trackY,
      zoneWidth,
      trackHeight,
      0x00aa00,
      0.2
    );

    // Zone border
    this.add.rectangle(
      zoneX + zoneWidth / 2,
      trackY,
      zoneWidth,
      trackHeight,
      0xcccccc,
      0
    ).setStrokeStyle(2, 0x00ff00);

    // Text "TARGET ZONE"
    this.add.text(
      zoneX + zoneWidth / 2,
      trackY + 40,
      'TARGET',
      {
        font: 'bold 12px Courier',
        fill: '#00ff00',
        align: 'center'
      }
    ).setOrigin(0.5);

    // Indicator circle
    this.indicatorCircle = this.add.circle(
      trackX + 10,
      trackY,
      15,
      0x00ffff
    );

    // Glow effect for indicator
    this.add.circle(
      trackX + 10,
      trackY,
      20,
      0x00ffff,
      0.1
    );

    // Store track info for hit detection
    this.trackInfo = {
      x: trackX,
      y: trackY,
      width: trackWidth,
      height: trackHeight,
      zoneStart: zoneX,
      zoneWidth: zoneWidth
    };

    // Stats display
    const statsX = 40;
    const statsY = height - 120;

    this.add.text(statsX, statsY, 'HITS:', {
      font: 'bold 14px Courier',
      fill: '#00ff00'
    });

    this.successText = this.add.text(statsX + 60, statsY, '0 / 5', {
      font: 'bold 14px Courier',
      fill: '#00ff00'
    });

    this.add.text(statsX, statsY + 40, 'FAILURES:', {
      font: 'bold 14px Courier',
      fill: '#ff0000'
    });

    this.failureText = this.add.text(statsX + 100, statsY + 40, '0 / 3', {
      font: 'bold 14px Courier',
      fill: '#ff0000'
    });

    // Timer
    this.timerText = this.add.text(width - 40, statsY, '0.0s', {
      font: 'bold 14px Courier',
      fill: '#ffff00',
      align: 'right'
    }).setOrigin(1, 0);

    // Help text
    this.add.text(width / 2, height - 20, 'Press ESC to abort game', {
      font: '12px Courier',
      fill: '#666666',
      align: 'center'
    }).setOrigin(0.5);
  }

  update(time, delta) {
    // Update indicator position (oscillation)
    this.indicatorPosition += this.oscillationSpeed;

    // Bounce at edges
    if (this.indicatorPosition >= 100) {
      this.indicatorPosition = 100;
      this.oscillationDirection = -1;
    } else if (this.indicatorPosition <= 0) {
      this.indicatorPosition = 0;
      this.oscillationDirection = 1;
    }

    // Apply direction
    if (this.oscillationDirection === 1) {
      this.indicatorPosition += this.oscillationSpeed * 0.5;
    } else {
      this.indicatorPosition -= this.oscillationSpeed * 0.5;
    }

    // Update indicator visual position
    const newX = this.trackInfo.x + (this.trackInfo.width * this.indicatorPosition / 100);
    this.indicatorCircle.setX(newX);

    // Update timer
    const elapsedTime = (time - this.gameStartTime) / 1000;
    this.timerText.setText(`${elapsedTime.toFixed(1)}s`);

    // Check win/lose conditions
    if (this.successHits >= 5) {
      this.endGame('success');
    } else if (this.failures >= 3) {
      this.endGame('failed');
    }
  }

  attemptHit() {
    this.totalAttempts++;

    // Check if indicator is in target zone
    const indicatorX = this.trackInfo.x + (this.trackInfo.width * this.indicatorPosition / 100);
    const zoneStart = this.trackInfo.zoneStart;
    const zoneEnd = this.trackInfo.zoneStart + this.trackInfo.zoneWidth;

    const isHit = indicatorX >= zoneStart && indicatorX <= zoneEnd;

    if (isHit) {
      this.registerHit();
    } else {
      this.registerMiss();
    }
  }

  registerHit() {
    this.successHits++;

    // Calculate accuracy (0-100%, where 100 is perfect center)
    const zoneCenter = this.trackInfo.zoneStart + this.trackInfo.zoneWidth / 2;
    const indicatorX = this.trackInfo.x + (this.trackInfo.width * this.indicatorPosition / 100);
    const distanceFromCenter = Math.abs(indicatorX - zoneCenter);
    const maxDistance = this.trackInfo.zoneWidth / 2;
    const accuracy = Math.max(0, 100 - (distanceFromCenter / maxDistance) * 100);

    this.hits.push({
      attempt: this.totalAttempts,
      success: true,
      position: this.indicatorPosition,
      accuracy: Math.round(accuracy)
    });

    // Update display
    this.successText.setText(`${this.successHits} / 5`);

    // Visual feedback - green flash
    this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2 - 150,
      `✓ HIT! ${Math.round(accuracy)}%`,
      {
        font: 'bold 28px Courier',
        fill: '#00ff00'
      }
    ).setOrigin(0.5)
      .setDepth(100);

    // Remove feedback text after 500ms
    this.time.delayedCall(500, () => {
      // Fade out would be better but keeping simple
    });
  }

  registerMiss() {
    this.failures++;

    this.hits.push({
      attempt: this.totalAttempts,
      success: false,
      position: this.indicatorPosition
    });

    // Update display
    this.failureText.setText(`${this.failures} / 3`);

    // Visual feedback - red flash
    this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2 - 150,
      '✗ MISS!',
      {
        font: 'bold 28px Courier',
        fill: '#ff0000'
      }
    ).setOrigin(0.5)
      .setDepth(100);
  }

  endGame(status) {
    // Disable input
    this.input.keyboard.off('keydown-SPACE');

    // Calculate result
    const elapsedTime = this.time.now - this.gameStartTime;
    const avgAccuracy = this.hits
      .filter(h => h.success)
      .reduce((sum, h) => sum + (h.accuracy || 0), 0) / Math.max(1, this.successHits);

    // Calculate score
    const hitBonus = this.successHits * 100;
    const accuracyBonus = avgAccuracy * 10;
    const failurePenalty = this.failures * 50;
    const score = Math.max(0, hitBonus + accuracyBonus - failurePenalty);

    const result = {
      status,
      successHits: this.successHits,
      failures: this.failures,
      totalAttempts: this.totalAttempts,
      accuracy: Math.round(avgAccuracy),
      score: Math.round(score),
      timeTaken: Math.round(elapsedTime),
      hits: this.hits,
      impact: {
        anomalyResolved: status === 'success',
        stabilityBoost: status === 'success' ? (0.05 + (avgAccuracy / 100) * 0.08) : -0.03,
        scoreBoost: status === 'success' ? score : 0,
        message: status === 'success'
          ? `✓ Perfect stabilization! +${((avgAccuracy / 100) * 8).toFixed(1)}% stability`
          : `✗ Failed to stabilize - anomaly remains unstable`
      }
    };

    // Show result screen
    this.showResultScreen(result);
  }

  showResultScreen(result) {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Semi-transparent overlay
    this.add.rectangle(0, 0, width, height, 0x000000, 0.8).setOrigin(0, 0);

    // Result title
    const titleColor = result.status === 'success' ? '#00ff00' : '#ff0000';
    const titleText = result.status === 'success' ? 'GAME WON!' : 'GAME OVER';

    this.add.text(width / 2, height / 2 - 100, titleText, {
      font: 'bold 48px Courier',
      fill: titleColor,
      align: 'center'
    }).setOrigin(0.5);

    // Stats
    const statsY = height / 2;
    const lineHeight = 35;

    this.add.text(width / 2, statsY, `Hits: ${result.successHits} / 5`, {
      font: 'bold 20px Courier',
      fill: '#00ff00',
      align: 'center'
    }).setOrigin(0.5);

    this.add.text(width / 2, statsY + lineHeight, `Failures: ${result.failures} / 3`, {
      font: 'bold 20px Courier',
      fill: '#ff0000',
      align: 'center'
    }).setOrigin(0.5);

    this.add.text(width / 2, statsY + lineHeight * 2, `Accuracy: ${result.accuracy}%`, {
      font: 'bold 20px Courier',
      fill: '#ffff00',
      align: 'center'
    }).setOrigin(0.5);

    this.add.text(width / 2, statsY + lineHeight * 3, `Score: ${result.score}`, {
      font: 'bold 20px Courier',
      fill: '#00ffff',
      align: 'center'
    }).setOrigin(0.5);

    // Message
    this.add.text(width / 2, statsY + lineHeight * 5, result.impact.message, {
      font: '16px Courier',
      fill: '#cccccc',
      align: 'center'
    }).setOrigin(0.5);

    // Auto-complete after 3 seconds
    this.time.delayedCall(3000, () => {
      this.completeGame(result);
    });
  }
}

export default QuantumStabilizerScene;
