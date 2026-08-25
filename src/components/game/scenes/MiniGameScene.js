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
import { playSfx } from '../audio.js';
import { recordBest } from '../bestScores.js';

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
    // The feedback color already carries the semantics (good = success,
    // critical = failure, warn = alert), so it doubles as the audio cue -
    // every minigame gets hit/miss sounds without per-game wiring.
    if (color === MG_COLORS.good) playSfx('minigameHit');
    else if (color === MG_COLORS.critical) playSfx('minigameMiss');
    else if (color === MG_COLORS.warn) playSfx('alert');

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
    ).setOrigin(0.5).setDepth(100).setScale(1.35);

    // Quick scale-punch so hits and misses register with a snap.
    this.tweens.add({ targets: this._feedbackText, scale: 1, duration: 160, ease: 'Back.easeOut' });
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
    playSfx(result.status === 'success' ? 'minigameWin' : 'minigameLose');
    const grade = result.status === 'success' ? this.getGrade(result.accuracy) : this.getGrade(0);

    const baseBoost = 0.05 + (result.accuracy / 100) * 0.08;
    const stabilityBoost = result.status === 'success' ? baseBoost * grade.multiplier : -0.03;

    // Personal best per minigame per severity. Only recorded on a success -
    // a failed containment isn't a score, it's a non-attempt.
    const best = result.status === 'success'
      ? recordBest(this.scene.key, this.anomaly?.severity, result.accuracy)
      : null;

    const fullResult = {
      ...result,
      grade: grade.grade,
      gradeColor: grade.color,
      newBest: !!best?.isNew,
      bestAccuracy: best?.best ?? null,
      impact: {
        anomalyResolved: result.status === 'success',
        stabilityBoost,
        // Mastery pays in salvage too, not just stability - an S leaves six
        // motes in the water where a C leaves one.
        salvageMotes: result.status === 'success' ? grade.salvageMotes : 0,
        scoreBoost: result.status === 'success' ? result.score : 0,
        message: result.status === 'success'
          ? `Stabilized · Grade ${grade.grade} · +${(stabilityBoost * 100).toFixed(1)}% stability`
          : 'Containment failed - anomaly remains active',
      },
    };

    this.showResultScreen(fullResult);
  }

  // A quick radial spray of additive motes - the celebratory pop on a win.
  _burst(x, y, color, count = 16) {
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const dist = 55 + Math.random() * 130;
      const dot = this.add.circle(x, y, 2 + Math.random() * 3, color, 0.9)
        .setDepth(203).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: dot,
        x: x + Math.cos(ang) * dist,
        y: y + Math.sin(ang) * dist,
        alpha: 0,
        scale: 0.2,
        duration: 480 + Math.random() * 320,
        ease: 'Cubic.easeOut',
        onComplete: () => dot.destroy(),
      });
    }
  }

  showResultScreen(result) {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const centerY = height / 2;
    const success = result.status === 'success';
    const themeColor = result.themeColor ?? MG_COLORS.accent;

    // An S skips the debrief entirely. Mastery is rewarded with FLOW: the
    // player who nailed it is the one who least needs to be told how they did,
    // and making them sit through a summary punishes the thing we want. One
    // flash, the grade punched over the playfield, and straight back to
    // flight - the celebration lands in the world, not on a card.
    if (success && result.grade === 'S') {
      this._snapCutOut(result, width, height, centerY, themeColor);
      return;
    }

    // Overlay fades in fast; a colored flash punches on top of it.
    const overlay = this.add.rectangle(0, 0, width, height, MG_COLORS.void, 0.9).setOrigin(0, 0).setDepth(200).setAlpha(0);
    this.tweens.add({ targets: overlay, alpha: 1, duration: 170, ease: 'Quad.easeOut' });
    const flash = this.add.rectangle(0, 0, width, height, success ? themeColor : MG_COLORS.critical, 0.42)
      .setOrigin(0, 0).setDepth(201).setBlendMode(Phaser.BlendModes.SCREEN);
    this.tweens.add({ targets: flash, alpha: 0, duration: success ? 320 : 240, ease: 'Quad.easeOut', onComplete: () => flash.destroy() });
    this.shake(success ? 160 : 340, success ? 0.008 : 0.015);

    const titleText = success ? 'CONTAINED' : 'CONTAINMENT FAILED';
    const titleColor = success ? MG_COLORS.good : MG_COLORS.critical;
    const title = this.add.text(width / 2, centerY - 130, titleText, {
      fontFamily: '"IBM Plex Mono", monospace', fontSize: '30px', fontStyle: 'bold', color: hexColor(titleColor),
    }).setOrigin(0.5).setDepth(202).setAlpha(0);
    this.tweens.add({ targets: title, alpha: 1, y: { from: centerY - 142, to: centerY - 130 }, delay: 110, duration: 300, ease: 'Back.easeOut' });
    if (!success) {
      // failure title stutters in
      this.tweens.add({ targets: title, alpha: { from: 1, to: 0.4 }, yoyo: true, repeat: 2, delay: 110, duration: 60 });
    }

    if (success) {
      const grade = this.add.text(width / 2, centerY - 80, result.grade, {
        fontFamily: '"IBM Plex Mono", monospace', fontSize: '54px', fontStyle: 'bold', color: hexColor(result.gradeColor),
      }).setOrigin(0.5).setDepth(202).setAlpha(0).setScale(2.6);
      this.tweens.add({
        targets: grade, alpha: 1, scale: 1, delay: 220, duration: 360, ease: 'Back.easeOut',
        onComplete: () => this._burst(width / 2, centerY - 80, result.gradeColor ?? themeColor),
      });
    }

    (result.statLines || []).forEach((line, i) => {
      const y = centerY - 10 + i * 26;
      const lbl = this.add.text(width / 2 - 90, y, line.label, {
        fontFamily: '"IBM Plex Mono", monospace', fontSize: '13px', color: hexColor(MG_COLORS.inkFaint),
      }).setOrigin(0, 0.5).setDepth(202).setAlpha(0);
      const val = this.add.text(width / 2 + 90, y, String(line.value), {
        fontFamily: '"IBM Plex Mono", monospace', fontSize: '13px', color: hexColor(MG_COLORS.ink),
      }).setOrigin(1, 0.5).setDepth(202).setAlpha(0);
      this.tweens.add({ targets: [lbl, val], alpha: 1, delay: 380 + i * 70, duration: 220 });
    });

    const n = result.statLines?.length || 0;
    if (result.flavorText) {
      const flavor = this.add.text(width / 2, centerY - 10 + n * 26 + 24, result.flavorText, {
        fontFamily: '"IBM Plex Mono", monospace', fontSize: '12px', fontStyle: 'italic',
        color: hexColor(themeColor), align: 'center', wordWrap: { width: width * 0.7 },
      }).setOrigin(0.5).setDepth(202).setAlpha(0);
      this.tweens.add({ targets: flavor, alpha: 1, delay: 380 + n * 70 + 120, duration: 300 });
    }

    if (result.newBest) {
      const badge = this.add.text(width / 2, centerY - 108, 'NEW BEST', {
        fontFamily: '"IBM Plex Mono", monospace', fontSize: '13px', fontStyle: 'bold',
        color: hexColor(MG_COLORS.good),
      }).setOrigin(0.5).setDepth(202).setAlpha(0);
      this.tweens.add({
        targets: badge, alpha: 1, scale: { from: 1.8, to: 1 },
        delay: 300, duration: 320, ease: 'Back.easeOut',
      });
    }

    // Was 2800ms. That is a very long time to be told something you already
    // know, every single containment, and it is the main reason the loop
    // dragged. Long enough to read the grade, short enough to stay in flow.
    this.time.delayedCall(1200, () => {
      this.completeGame(result);
    });
  }

  /**
   * The S-grade exit: no debrief screen, just a punch and a cut.
   * Deliberately ~420ms - long enough that the grade registers, short enough
   * that it reads as the game getting out of your way.
   */
  _snapCutOut(result, width, height, centerY, themeColor) {
    const flash = this.add.rectangle(0, 0, width, height, themeColor, 0.5)
      .setOrigin(0, 0).setDepth(201).setBlendMode(Phaser.BlendModes.SCREEN);
    this.tweens.add({ targets: flash, alpha: 0, duration: 380, ease: 'Quad.easeOut' });
    this.shake(120, 0.006);

    const grade = this.add.text(width / 2, centerY, 'S', {
      fontFamily: '"IBM Plex Mono", monospace', fontSize: '76px', fontStyle: 'bold',
      color: hexColor(result.gradeColor ?? themeColor),
    }).setOrigin(0.5).setDepth(202).setScale(2.4).setAlpha(0);
    this.tweens.add({ targets: grade, alpha: 1, scale: 1, duration: 200, ease: 'Back.easeOut' });
    this._burst(width / 2, centerY, result.gradeColor ?? themeColor, 26);

    if (result.newBest) {
      const badge = this.add.text(width / 2, centerY + 54, 'NEW BEST', {
        fontFamily: '"IBM Plex Mono", monospace', fontSize: '14px', fontStyle: 'bold',
        color: hexColor(MG_COLORS.good),
      }).setOrigin(0.5).setDepth(202).setAlpha(0);
      this.tweens.add({ targets: badge, alpha: 1, duration: 180, delay: 120 });
    }

    this.time.delayedCall(420, () => this.completeGame(result));
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
