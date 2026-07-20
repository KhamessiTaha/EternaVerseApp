/**
 * Structural Realignment Mini-Game
 *
 * A structural anomaly (galactic collision, cosmic void, cosmic string) has
 * scattered fragments out of alignment. Drag from the current fragment to
 * the next in sequence to relink them, under a ticking clock. A spatial
 * drag/planning mechanic - distinct from the click-reaction, hold-balance,
 * and rhythm-timing skills the other minigames test.
 */
import Phaser from 'phaser';
import MiniGameScene, { MG_COLORS } from './MiniGameScene.js';

const THEME_COLOR = 0x7d8ba8; // structural steel-blue

export class StructuralRealignmentScene extends MiniGameScene {
  constructor() {
    super('StructuralRealignmentScene');
  }

  init(data) {
    super.init(data);

    const severity = Math.max(1, Math.min(5, this.anomaly?.severity || 2));

    this.nodeCount = 5 + (severity >= 4 ? 1 : 0);
    this.timeLimit = 16 - severity * 0.6;
    this.maxStrikes = 3;
    this.strikes = 0;
    this.connected = 0;
    this.currentIndex = 0;
    this.elapsed = 0;
    this.dragStartNode = null;
    this.pointerX = null;
    this.pointerY = null;
    this.attempts = [];
    this.gameOver = false;
  }

  create() {
    super.create();

    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const cx = width / 2;
    const cy = height / 2 + 10;

    this.createHeader(
      'STRUCTURAL REALIGNMENT',
      THEME_COLOR,
      `Severity ${this.anomaly?.severity || '?'} · Drag from each fragment to the next in sequence`
    );

    const radius = 160;
    this.nodes = Array.from({ length: this.nodeCount }, (_, i) => {
      const angle = (i / this.nodeCount) * Math.PI * 2 - Math.PI / 2;
      return {
        baseX: cx + Math.cos(angle) * radius,
        baseY: cy + Math.sin(angle) * radius,
        jitterAngle: Math.random() * Math.PI * 2,
        jitterSpeed: 0.6 + Math.random() * 0.4,
      };
    });

    this.linkGraphics = this.add.graphics();
    this.dragGraphics = this.add.graphics();

    this.nodeVisuals = this.nodes.map((node, i) => {
      const circle = this.add.circle(node.baseX, node.baseY, 12, MG_COLORS.line).setStrokeStyle(1, THEME_COLOR, 0.6);
      const label = this.add.text(node.baseX, node.baseY, String(i + 1), {
        fontFamily: '"IBM Plex Mono", monospace',
        fontSize: '11px',
        color: '#9497ad',
      }).setOrigin(0.5);
      circle.setInteractive({ useHandCursor: true });
      return { circle, label };
    });

    this.highlightCurrentNode();

    const barWidth = 240;
    const barY = height - 70;
    this.add.rectangle(cx, barY, barWidth, 6, MG_COLORS.line).setOrigin(0.5);
    this.timeFill = this.add.rectangle(cx - barWidth / 2, barY, barWidth, 6, THEME_COLOR).setOrigin(0, 0.5);
    this.timeBarWidth = barWidth;

    this.add.text(cx, barY + 16, 'TIME REMAINING', {
      fontFamily: '"IBM Plex Mono", monospace',
      fontSize: '10px',
      color: '#565a72',
    }).setOrigin(0.5);

    this.strikeText = this.add.text(cx, 130, `STRIKES 0 / ${this.maxStrikes}`, {
      fontFamily: '"IBM Plex Mono", monospace',
      fontSize: '13px',
      color: '#e0524a',
    }).setOrigin(0.5);

    this.input.on('pointerdown', (pointer) => this.handlePointerDown(pointer));
    this.input.on('pointermove', (pointer) => this.handlePointerMove(pointer));
    this.input.on('pointerup', (pointer) => this.handlePointerUp(pointer));
  }

  highlightCurrentNode() {
    this.nodeVisuals.forEach((v, i) => {
      const isCurrent = i === this.currentIndex;
      v.circle.setStrokeStyle(isCurrent ? 2 : 1, isCurrent ? MG_COLORS.accent : THEME_COLOR, isCurrent ? 1 : 0.5);
    });
  }

  nodePosition(node, t) {
    const jitter = 5;
    return {
      x: node.baseX + Math.cos(node.jitterAngle + t * node.jitterSpeed) * jitter,
      y: node.baseY + Math.sin(node.jitterAngle + t * node.jitterSpeed) * jitter,
    };
  }

  update(time, delta) {
    if (this.gameOver) return;
    const dt = delta / 1000;
    this.elapsed += dt;
    const t = time / 1000;

    this.nodes.forEach((node, i) => {
      const pos = this.nodePosition(node, t);
      const v = this.nodeVisuals[i];
      v.circle.setPosition(pos.x, pos.y);
      v.label.setPosition(pos.x, pos.y);
    });

    this.dragGraphics.clear();
    if (this.dragStartNode) {
      this.dragGraphics.lineStyle(2, MG_COLORS.accent, 0.7);
      const startPos = this.nodePosition(this.dragStartNode, t);
      this.dragGraphics.lineBetween(startPos.x, startPos.y, this.pointerX ?? startPos.x, this.pointerY ?? startPos.y);
    }

    const remaining = Math.max(0, this.timeLimit - this.elapsed);
    this.timeFill.width = this.timeBarWidth * (remaining / this.timeLimit);

    if (remaining <= 0) {
      this.endGame(false);
    }
  }

  handlePointerDown(pointer) {
    if (this.gameOver) return;
    const node = this.nodes[this.currentIndex];
    const pos = this.nodePosition(node, this.time.now / 1000);
    const dist = Phaser.Math.Distance.Between(pointer.x, pointer.y, pos.x, pos.y);
    if (dist <= 20) {
      this.dragStartNode = node;
    }
  }

  handlePointerMove(pointer) {
    this.pointerX = pointer.x;
    this.pointerY = pointer.y;
  }

  handlePointerUp(pointer) {
    if (this.gameOver || !this.dragStartNode) return;

    const nextIndex = this.currentIndex + 1;
    if (nextIndex >= this.nodes.length) {
      this.dragStartNode = null;
      return;
    }

    const targetNode = this.nodes[nextIndex];
    const pos = this.nodePosition(targetNode, this.time.now / 1000);
    const dist = Phaser.Math.Distance.Between(pointer.x, pointer.y, pos.x, pos.y);

    if (dist <= 24) {
      this.registerConnection(this.currentIndex, nextIndex);
    } else {
      this.registerStrike();
    }

    this.dragStartNode = null;
  }

  registerConnection(fromIndex, toIndex) {
    this.attempts.push(1);
    const fromV = this.nodeVisuals[fromIndex];
    const toV = this.nodeVisuals[toIndex];

    this.linkGraphics.lineStyle(2, MG_COLORS.good, 0.8);
    this.linkGraphics.lineBetween(fromV.circle.x, fromV.circle.y, toV.circle.x, toV.circle.y);
    fromV.circle.setFillStyle(MG_COLORS.good, 0.3);

    this.connected++;
    this.currentIndex = toIndex;
    this.showFeedback('LINKED', MG_COLORS.good, toV.circle.x, toV.circle.y - 30);

    if (this.currentIndex >= this.nodes.length - 1) {
      toV.circle.setFillStyle(MG_COLORS.good, 0.3);
      this.endGame(true);
    } else {
      this.highlightCurrentNode();
    }
  }

  registerStrike() {
    this.attempts.push(0);
    this.strikes++;
    this.strikeText.setText(`STRIKES ${this.strikes} / ${this.maxStrikes}`);
    this.showFeedback('MISALIGNED', MG_COLORS.critical, this.pointerX, this.pointerY);
    this.shake(120, 0.006);

    if (this.strikes >= this.maxStrikes) {
      this.endGame(false);
    }
  }

  endGame(success) {
    if (this.gameOver) return;
    this.gameOver = true;
    this.input.keyboard.off('keydown-ESC');
    this.input.off('pointerdown');
    this.input.off('pointermove');
    this.input.off('pointerup');

    const accuracy = this.attempts.length > 0
      ? Math.round((this.attempts.reduce((a, b) => a + b, 0) / this.attempts.length) * 100)
      : 0;
    const score = Math.max(0, Math.round(this.connected * 90 + accuracy * 4 - this.strikes * 100));

    this.finishGame({
      status: success ? 'success' : 'failed',
      accuracy,
      score,
      themeColor: THEME_COLOR,
      statLines: [
        { label: 'Fragments Linked', value: `${this.connected} / ${this.nodes.length - 1}` },
        { label: 'Accuracy', value: `${accuracy}%` },
        { label: 'Strikes', value: `${this.strikes} / ${this.maxStrikes}` },
        { label: 'Score', value: score },
      ],
      flavorText: success
        ? 'Fragments realigned into a stable lattice.'
        : 'Structure failed to reform - fragments drift apart.',
    });
  }
}

export default StructuralRealignmentScene;
