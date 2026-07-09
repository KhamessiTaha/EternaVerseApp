/**
 * Base class for mini-game scenes
 *
 * Mini-games are Phaser scenes that handle interactive gameplay.
 * Extend this class to create new mini-games. This base class owns the
 * shared chrome (theme palette, grading, feedback popups, result screen)
 * so individual games only need to implement their core mechanic.
 */
import Phaser from 'phaser';
import { getGradeForAccuracy } from '../utils';
import { getSettings } from '../settings.js';

// Shared observatory palette - keep in sync with tailwind.config.js tokens
export const MG_COLORS = {
  void: 0x070912,
  voidRaised: 0x0c0f1c,
  line: 0x1e2540,
  lineBright: 0x2c3560,
  ink: 0xe9e7f2,
  inkDim: 0x9497ad,
  inkFaint: 0x565a72,
  accent: 0xdfa73f,
  good: 0x4fd1a5,
  warn: 0xe0824a,
  critical: 0xe0524a,
};

// Presentation-only: accuracy -> multiplier lives in game/utils.js (the
// shared source of truth also used by GameplayPage/backend); this just maps
// each grade letter to a display color.
const GRADE_DISPLAY_COLOR = {
  S: MG_COLORS.accent,
  A: MG_COLORS.good,
  B: 0x4ec9e0,
  C: MG_COLORS.warn,
  F: MG_COLORS.critical,
};

const hexColor = (num) => `#${num.toString(16).padStart(6, '0')}`;

export class MiniGameScene extends Phaser.Scene {
  constructor(sceneKey) {
    super({ key: sceneKey });
    this.anomaly = null;
    this.universeScene = null;
    this._feedbackText = null;
    this._feedbackTimer = null;
  }

  /**
   * Initialize scene with anomaly data
   */
  init(data) {
    this.anomaly = data.anomaly;
  }

  /**
   * Create is called when scene starts
   * Override in subclasses to set up game UI and objects - call super.create() first
   */
  create() {
    this.universeScene = this.scene.get('UniverseScene');

    this.input.keyboard.on('keydown-ESC', () => {
      this.abortGame();
    });

    // Full-bleed background so the minigame reads as its own instrument, not a
    // Phaser default-grey canvas
    this.add.rectangle(0, 0, this.cameras.main.width, this.cameras.main.height, MG_COLORS.void)
      .setOrigin(0, 0)
      .setDepth(-10);
  }

  /**
   * Camera shake that respects the player's settings. Minigames should call
   * this instead of this.cameras.main.shake directly.
   */
  shake(duration, intensity) {
    if (getSettings().cameraShake) {
      this.cameras.main.shake(duration, intensity);
    }
  }

  /**
   * Grade a 0-100 accuracy/performance score into an S-F tier (thresholds
   * and stabilityMultiplier come from the shared GRADE_TIERS in game/utils.js).
   */
  getGrade(accuracy) {
    const tier = getGradeForAccuracy(accuracy);
    return { ...tier, color: GRADE_DISPLAY_COLOR[tier.grade] };
  }

  /**
   * Standard header: title + category-colored rule + optional subtitle.
   */
  createHeader(title, themeColor, subtitle) {
    const width = this.cameras.main.width;

    this.add.text(width / 2, 46, title, {
      fontFamily: '"IBM Plex Mono", monospace',
      fontSize: '28px',
      fontStyle: 'bold',
      color: hexColor(themeColor),
      align: 'center',
    }).setOrigin(0.5);

    this.add.rectangle(width / 2, 76, 120, 2, themeColor).setOrigin(0.5);

    if (subtitle) {
      this.add.text(width / 2, 98, subtitle, {
        fontFamily: '"IBM Plex Mono", monospace',
        fontSize: '12px',
        color: hexColor(MG_COLORS.inkFaint),
        align: 'center',
      }).setOrigin(0.5);
    }

    this.add.text(width / 2, this.cameras.main.height - 22, '[ESC] abort', {
      fontFamily: '"IBM Plex Mono", monospace',
      fontSize: '11px',
      color: hexColor(MG_COLORS.inkFaint),
    }).setOrigin(0.5);
  }

  /**
   * Reusable transient feedback popup (HIT/MISS/etc.) - reuses one text
   * object so rapid input doesn't stack duplicate texts.
   */
  showFeedback(text, color, x, y) {
    if (this._feedbackTimer) {
      this.time.removeEvent(this._feedbackTimer);
      this._feedbackTimer = null;
    }
    if (this._feedbackText) {
      this._feedbackText.destroy();
      this._feedbackText = null;
    }

    this._feedbackText = this.add.text(
      x ?? this.cameras.main.width / 2,
      y ?? this.cameras.main.height / 2 - 140,
      text,
      {
        fontFamily: '"IBM Plex Mono", monospace',
        fontSize: '22px',
        fontStyle: 'bold',
        color: hexColor(color),
      }
    ).setOrigin(0.5).setDepth(100);

    this.tweens.add({
      targets: this._feedbackText,
      y: (y ?? this.cameras.main.height / 2 - 140) - 18,
      alpha: { from: 1, to: 0 },
      duration: 550,
      ease: 'Cubic.easeOut',
    });

    this._feedbackTimer = this.time.delayedCall(550, () => {
      this._feedbackText?.destroy();
      this._feedbackText = null;
      this._feedbackTimer = null;
    });
  }

  /**
   * Complete the minigame with a result. Result shape:
   * {
   *   status: 'success' | 'failed',
   *   accuracy: 0-100,
   *   score: number,
   *   statLines: [{ label, value }],
   *   flavorText: string,
   *   themeColor: number,
   * }
   * Builds `impact` (what GameplayPage/backend care about) automatically
   * from grade + status, then hands off to the base MiniGame lifecycle.
   */
  finishGame(result) {
    const grade = result.status === 'success' ? this.getGrade(result.accuracy) : this.getGrade(0);

    const baseBoost = 0.05 + (result.accuracy / 100) * 0.08;
    const stabilityBoost = result.status === 'success' ? baseBoost * grade.stabilityMultiplier : -0.03;

    const fullResult = {
      ...result,
      grade: grade.grade,
      gradeColor: grade.color,
      impact: {
        anomalyResolved: result.status === 'success',
        stabilityBoost,
        scoreBoost: result.status === 'success' ? result.score : 0,
        message: result.status === 'success'
          ? `Stabilized · Grade ${grade.grade} · +${(stabilityBoost * 100).toFixed(1)}% stability`
          : 'Containment failed - anomaly remains active',
      },
    };

    this.showResultScreen(fullResult);
  }

  showResultScreen(result) {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const themeColor = result.themeColor ?? MG_COLORS.accent;

    this.add.rectangle(0, 0, width, height, MG_COLORS.void, 0.88).setOrigin(0, 0).setDepth(200);

    const centerY = height / 2;
    const titleText = result.status === 'success' ? 'CONTAINED' : 'CONTAINMENT FAILED';
    const titleColor = result.status === 'success' ? MG_COLORS.good : MG_COLORS.critical;

    this.add.text(width / 2, centerY - 130, titleText, {
      fontFamily: '"IBM Plex Mono", monospace',
      fontSize: '30px',
      fontStyle: 'bold',
      color: hexColor(titleColor),
    }).setOrigin(0.5).setDepth(201);

    if (result.status === 'success') {
      this.add.text(width / 2, centerY - 82, result.grade, {
        fontFamily: '"IBM Plex Mono", monospace',
        fontSize: '52px',
        fontStyle: 'bold',
        color: hexColor(result.gradeColor),
      }).setOrigin(0.5).setDepth(201);
    }

    (result.statLines || []).forEach((line, i) => {
      const y = centerY - 10 + i * 26;
      this.add.text(width / 2 - 90, y, line.label, {
        fontFamily: '"IBM Plex Mono", monospace',
        fontSize: '13px',
        color: hexColor(MG_COLORS.inkFaint),
      }).setOrigin(0, 0.5).setDepth(201);
      this.add.text(width / 2 + 90, y, String(line.value), {
        fontFamily: '"IBM Plex Mono", monospace',
        fontSize: '13px',
        color: hexColor(MG_COLORS.ink),
      }).setOrigin(1, 0.5).setDepth(201);
    });

    const flavorY = centerY - 10 + (result.statLines?.length || 0) * 26 + 24;
    if (result.flavorText) {
      this.add.text(width / 2, flavorY, result.flavorText, {
        fontFamily: '"IBM Plex Mono", monospace',
        fontSize: '12px',
        fontStyle: 'italic',
        color: hexColor(themeColor),
        align: 'center',
        wordWrap: { width: width * 0.7 },
      }).setOrigin(0.5).setDepth(201);
    }

    this.time.delayedCall(2800, () => {
      this.completeGame(result);
    });
  }

  /**
   * Emit result event that UniverseScene will listen for, then switch back.
   */
  completeGame(result) {
    if (!this.universeScene) {
      console.error('UniverseScene reference not found');
      return;
    }

    this.universeScene.events.emit('minigame:complete', {
      anomaly: this.anomaly,
      result,
    });

    this.scene.stop();
    this.scene.resume('UniverseScene');
  }

  /**
   * Abort the minigame (ESC key or close button)
   */
  abortGame() {
    if (this.universeScene) {
      this.universeScene.events.emit('minigame:abort', {
        anomaly: this.anomaly,
      });
    }

    this.scene.stop();
    this.scene.resume('UniverseScene');
  }
}

export default MiniGameScene;
