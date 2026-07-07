/**
 * Supernova Cascade Mini-Game
 *
 * A stellar anomaly is chaining ignition points outward. Click each point
 * before its containment ring depletes; each success speeds up the chain
 * (shorter windows, matching how a real cascade accelerates), each miss lets
 * the chain run further out of control. A different input modality (mouse,
 * reactive) from the gravity well's held-key balancing.
 */
import Phaser from 'phaser';
import MiniGameScene, { MG_COLORS } from './MiniGameScene.js';

const THEME_COLOR = 0xe0824a; // stellar orange

export class CascadeReactionScene extends MiniGameScene {
  constructor() {
    super('CascadeReactionScene');
  }

  init(data) {
    super.init(data);

    const severity = Math.max(1, Math.min(5, this.anomaly?.severity || 2));

    this.containedTarget = 10 + severity * 2;
    this.maxCascades = 4;
    this.contained = 0;
    this.cascades = 0;

    this.baseLifespan = 1900 - severity * 80;
    this.minLifespan = 650;
    this.baseSpawnDelay = 420;

    this.reactionScores = [];
    this.gameOver = false;
    this.activePoint = null;
  }

  create() {
    super.create();

    const cx = this.cameras.main.width / 2;
    const cy = this.cameras.main.height / 2 + 10;
    this.centerX = cx;
    this.centerY = cy;

    this.createHeader(
      'SUPERNOVA CASCADE',
      THEME_COLOR,
      `Severity ${this.anomaly?.severity || '?'} · Click each ignition point before it detonates`
    );

    const slotCount = 7;
    const slotRadius = 170;
    this.slots = Array.from({ length: slotCount }, (_, i) => {
      const angle = (i / slotCount) * Math.PI * 2 - Math.PI / 2;
      return {
        x: cx + Math.cos(angle) * slotRadius,
        y: cy + Math.sin(angle) * slotRadius,
      };
    });

    this.slots.forEach((s) => {
      this.add.circle(s.x, s.y, 6, MG_COLORS.line);
    });

    this.containedText = this.add.text(cx - 100, 130, `CONTAINED 0 / ${this.containedTarget}`, {
      fontFamily: '"IBM Plex Mono", monospace',
      fontSize: '13px',
      color: '#4fd1a5',
    }).setOrigin(0, 0.5);

    this.cascadeText = this.add.text(cx + 100, 130, `CASCADES 0 / ${this.maxCascades}`, {
      fontFamily: '"IBM Plex Mono", monospace',
      fontSize: '13px',
      color: '#e0524a',
    }).setOrigin(1, 0.5);

    this.spawnNext();
  }

  currentLifespan() {
    return Math.max(this.minLifespan, this.baseLifespan * Math.pow(0.95, this.contained));
  }

  spawnNext() {
    if (this.gameOver) return;

    const slot = Phaser.Utils.Array.GetRandom(this.slots);
    const lifespan = this.currentLifespan();

    const ring = this.add.graphics();
    const core = this.add.circle(slot.x, slot.y, 14, THEME_COLOR, 0.9).setInteractive({ useHandCursor: true });
    const glow = this.add.circle(slot.x, slot.y, 22, THEME_COLOR, 0.25).setBlendMode(Phaser.BlendModes.ADD);

    const point = { slot, ring, core, glow, spawnedAt: this.time.now, lifespan, resolved: false };
    this.activePoint = point;

    core.on('pointerdown', () => this.handleHit(point));

    point.timer = this.time.delayedCall(lifespan, () => {
      if (!point.resolved) this.handleCascade(point);
    });
  }

  update(time) {
    const point = this.activePoint;
    if (this.gameOver || !point || point.resolved) return;

    const elapsed = time - point.spawnedAt;
    const remaining = Phaser.Math.Clamp(1 - elapsed / point.lifespan, 0, 1);

    point.ring.clear();
    const ringColor = remaining < 0.25 ? MG_COLORS.critical : THEME_COLOR;
    point.ring.lineStyle(3, ringColor, 0.9);
    point.ring.strokeCircle(point.slot.x, point.slot.y, 14 + remaining * 16);
  }

  handleHit(point) {
    if (point.resolved || this.gameOver) return;
    point.resolved = true;
    point.timer.remove();

    const reactionMs = this.time.now - point.spawnedAt;
    const reactionScore = Phaser.Math.Clamp(1 - reactionMs / point.lifespan, 0, 1);
    this.reactionScores.push(reactionScore);

    this.contained++;
    this.containedText.setText(`CONTAINED ${this.contained} / ${this.containedTarget}`);

    this.destroyPoint(point);
    this.showFeedback('CONTAINED', MG_COLORS.good, point.slot.x, point.slot.y - 40);
    this.cameras.main.shake(60, 0.003);

    if (this.contained >= this.containedTarget) {
      this.endGame(true);
    } else {
      this.time.delayedCall(this.baseSpawnDelay, () => this.spawnNext());
    }
  }

  handleCascade(point) {
    if (point.resolved || this.gameOver) return;
    point.resolved = true;

    this.cascades++;
    this.cascadeText.setText(`CASCADES ${this.cascades} / ${this.maxCascades}`);

    this.destroyPoint(point);
    this.showFeedback('CASCADE!', MG_COLORS.critical, point.slot.x, point.slot.y - 40);
    this.cameras.main.shake(220, 0.012);

    if (this.cascades >= this.maxCascades) {
      this.endGame(false);
    } else {
      this.time.delayedCall(this.baseSpawnDelay, () => this.spawnNext());
    }
  }

  destroyPoint(point) {
    point.ring.destroy();
    point.core.destroy();
    point.glow.destroy();
    if (this.activePoint === point) this.activePoint = null;
  }

  endGame(success) {
    if (this.gameOver) return;
    this.gameOver = true;
    this.input.keyboard.off('keydown-ESC');

    const avgReaction = this.reactionScores.length > 0
      ? this.reactionScores.reduce((a, b) => a + b, 0) / this.reactionScores.length
      : 0;
    const accuracy = Math.round(Phaser.Math.Clamp(avgReaction * 100, 0, 100));
    const score = Math.max(0, Math.round(this.contained * 80 + accuracy * 6 - this.cascades * 120));

    this.finishGame({
      status: success ? 'success' : 'failed',
      accuracy,
      score,
      themeColor: THEME_COLOR,
      statLines: [
        { label: 'Contained', value: `${this.contained} / ${this.containedTarget}` },
        { label: 'Avg. Reaction', value: `${accuracy}%` },
        { label: 'Cascades', value: `${this.cascades} / ${this.maxCascades}` },
        { label: 'Score', value: score },
      ],
      flavorText: success
        ? 'Chain reaction contained before runaway ignition.'
        : 'Cascade outran containment - stellar core destabilized.',
    });
  }
}

export default CascadeReactionScene;
