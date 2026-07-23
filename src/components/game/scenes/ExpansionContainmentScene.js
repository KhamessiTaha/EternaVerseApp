/**
 * Expansion Containment Mini-Game  —  real cosmic-expansion-history tracking.
 *
 * A cosmological anomaly is dragging the universe's expansion rate off its
 * physical track. The scrolling corridor is the target expansion history H(t):
 * it decelerates while matter dominates, then accelerates as dark energy takes
 * over — the real ΛCDM shape. Your marker is the actual expansion rate, and
 * you steer it with momentum:
 *
 *   ↑ inject dark energy  -> expansion accelerates (marker curves up)
 *   ↓ withdraw it         -> matter gravity decelerates it (marker falls)
 *
 * Keep the expansion rate inside the corridor as the history scrolls past. The
 * corridor MOVES, so you have to lead it — anticipation, not just reaction.
 * The marker red/blue-shifts with its expansion rate (real Doppler): fast
 * expansion reddens, contraction blueshifts.
 */
import Phaser from 'phaser';
import MiniGameScene, { MG_COLORS } from './MiniGameScene.js';

const THEME_COLOR = 0x5b8dd9; // cosmological blue
const G = 22;      // matter gravity (constant downward pull on expansion rate)
const CTRL = 95;   // dark-energy thrust authority
const RANGE = 120; // clamp on the expansion-rate axis (gauge units)
const PX_PER_SEC = 95;

export class ExpansionContainmentScene extends MiniGameScene {
  constructor() {
    super('ExpansionContainmentScene');
  }

  init(data) {
    super.init(data);
    const severity = Math.max(1, Math.min(5, this.anomaly?.severity || 2));
    this.severity = severity;

    this.corridorW = 74 - severity * 7;   // narrows with severity
    this.wig = 0.55 + severity * 0.10;     // era swing frequency
    this.amp = 34 + severity * 3;          // era swing amplitude
    this.survivalTarget = 13 + severity;
    this.maxBreaches = 3;

    this.H = this.center(0);
    this.v = 0;
    this.elapsed = 0;
    this.breaches = 0;
    this._breachCd = 0;
    this.corridorSamples = [];
    this.gameOver = false;
  }

  // Target expansion rate at cosmic time tau: a slow era swing (matter decel ->
  // dark-energy accel) plus finer structure, all in gauge units.
  center(tau) {
    const era = 26 * Math.sin(tau * 0.28 - 1.2);
    return era + this.amp * 0.6 * Math.sin(tau * this.wig) + this.amp * 0.5 * Math.sin(tau * this.wig * 1.7 + 1);
  }

  create() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    super.create();

    this.cyMid = height / 2 + 24;
    this.yScale = (height * 0.30) / RANGE;
    this.markerX = width * 0.32;

    this.createHeader(
      'EXPANSION CONTAINMENT',
      THEME_COLOR,
      `Severity ${this.anomaly?.severity || '?'} · Keep the expansion rate inside the corridor`
    );
    this.add.text(width / 2, 116, '↑ inject dark energy (accelerate)     ↓ withdraw (let gravity decelerate)', {
      fontFamily: '"IBM Plex Mono", monospace', fontSize: '11px', color: '#dfa73f',
    }).setOrigin(0.5);

    this.breachText = this.add.text(width / 2, 140, `BREACHES 0 / ${this.maxBreaches}`, {
      fontFamily: '"IBM Plex Mono", monospace', fontSize: '13px', color: '#e0524a',
    }).setOrigin(0.5);

    this.corridorGfx = this.add.graphics();
    this.centerlineGfx = this.add.graphics();

    // "Now" line at the marker column
    this.add.rectangle(this.markerX, this.cyMid, 1, height * 0.62, MG_COLORS.line, 0.6).setOrigin(0.5);

    this.markerGlow = this.add.circle(this.markerX, this.cyMid, 15, THEME_COLOR, 0.3).setBlendMode(Phaser.BlendModes.ADD);
    this.marker = this.add.circle(this.markerX, this.cyMid, 8, MG_COLORS.ink);

    const barWidth = 240;
    const barY = height - 46;
    this.add.rectangle(width / 2, barY, barWidth, 6, MG_COLORS.line).setOrigin(0.5);
    this.progressFill = this.add.rectangle(width / 2 - barWidth / 2, barY, 0, 6, THEME_COLOR).setOrigin(0, 0.5);
    this.progressBarWidth = barWidth;
    this.add.text(width / 2, barY + 15, 'COSMIC TIME', {
      fontFamily: '"IBM Plex Mono", monospace', fontSize: '10px', color: '#565a72',
    }).setOrigin(0.5);

    this.keys = this.input.keyboard.addKeys('UP,DOWN');
  }

  mapY(H) {
    return this.cyMid - H * this.yScale;
  }

  update(time, delta) {
    if (this.gameOver) return;
    const dt = Math.min(delta / 1000, 0.04);
    this.elapsed += dt;
    if (this._breachCd > 0) this._breachCd -= dt;

    // Momentum dynamics: gravity pulls the rate down, dark-energy thrust lifts it.
    let u = 0;
    if (this.keys.UP.isDown) u += CTRL;
    if (this.keys.DOWN.isDown) u -= CTRL;
    this.v += (-G + u) * dt;
    this.H += this.v * dt;
    if (this.H > RANGE) { this.H = RANGE; this.v = 0; }
    else if (this.H < -RANGE) { this.H = -RANGE; this.v = 0; }

    const c = this.center(this.elapsed);
    const inCorridor = Math.abs(this.H - c) <= this.corridorW / 2;
    if (!inCorridor && this._breachCd <= 0) this.registerBreach();
    this.corridorSamples.push(inCorridor ? 1 : 0);

    this.render(c, inCorridor);

    const progress = Math.min(1, this.elapsed / this.survivalTarget);
    this.progressFill.width = this.progressBarWidth * progress;

    if (this.elapsed >= this.survivalTarget) this.endGame(true);
    else if (this.breaches >= this.maxBreaches) this.endGame(false);
  }

  render(c, inCorridor) {
    const width = this.cameras.main.width;
    const half = this.corridorW / 2;

    // Draw the scrolling corridor: screen x maps to cosmic time around "now".
    this.corridorGfx.clear();
    this.centerlineGfx.clear();
    this.corridorGfx.fillStyle(THEME_COLOR, 0.12);
    this.centerlineGfx.lineStyle(1, THEME_COLOR, 0.4);

    const step = 8;
    const upper = [];
    const lower = [];
    for (let x = 0; x <= width; x += step) {
      const tau = this.elapsed + (x - this.markerX) / PX_PER_SEC;
      const cc = this.center(tau);
      upper.push({ x, y: this.mapY(cc + half) });
      lower.push({ x, y: this.mapY(cc - half) });
    }
    // Filled band (upper left->right, lower right->left)
    this.corridorGfx.beginPath();
    this.corridorGfx.moveTo(upper[0].x, upper[0].y);
    upper.forEach((p) => this.corridorGfx.lineTo(p.x, p.y));
    for (let i = lower.length - 1; i >= 0; i--) this.corridorGfx.lineTo(lower[i].x, lower[i].y);
    this.corridorGfx.closePath();
    this.corridorGfx.fillPath();
    // Centerline
    this.centerlineGfx.beginPath();
    for (let x = 0; x <= width; x += step) {
      const tau = this.elapsed + (x - this.markerX) / PX_PER_SEC;
      const y = this.mapY(this.center(tau));
      if (x === 0) this.centerlineGfx.moveTo(x, y); else this.centerlineGfx.lineTo(x, y);
    }
    this.centerlineGfx.strokePath();

    // Marker: position + redshift/blueshift color from its expansion rate
    const my = this.mapY(this.H);
    this.marker.setPosition(this.markerX, my).setFillStyle(inCorridor ? this.redshiftColor(this.v) : MG_COLORS.critical);
    this.markerGlow.setPosition(this.markerX, my).setFillStyle(inCorridor ? THEME_COLOR : MG_COLORS.critical, 0.3);
  }

  // Doppler tint: expanding fast (v>0) reddens, contracting (v<0) blueshifts.
  redshiftColor(v) {
    const p = Phaser.Math.Clamp(v / 120, -1, 1);
    const r = Phaser.Math.Clamp(Math.round(200 + p * 55), 0, 255);
    const g = Phaser.Math.Clamp(Math.round(200 - Math.abs(p) * 40), 0, 255);
    const b = Phaser.Math.Clamp(Math.round(200 - p * 120), 0, 255);
    return Phaser.Display.Color.GetColor(r, g, b);
  }

  registerBreach() {
    this.breaches++;
    this._breachCd = 0.7;
    this.breachText.setText(`BREACHES ${this.breaches} / ${this.maxBreaches}`);
    this.shake(160, 0.008);
    this.showFeedback('METRIC STRESS!', MG_COLORS.critical, this.markerX, this.mapY(this.H) - 30);
  }

  endGame(success) {
    if (this.gameOver) return;
    this.gameOver = true;
    this.input.keyboard.off('keydown-ESC');

    const avg = this.corridorSamples.length
      ? this.corridorSamples.reduce((a, b) => a + b, 0) / this.corridorSamples.length
      : 0;
    const accuracy = Math.round(Phaser.Math.Clamp(avg * 100, 0, 100));
    const score = Math.max(0, Math.round(accuracy * 12 - this.breaches * 150));

    this.finishGame({
      status: success ? 'success' : 'failed',
      accuracy,
      score,
      themeColor: THEME_COLOR,
      statLines: [
        { label: 'History Tracked', value: `${this.elapsed.toFixed(1)}s / ${this.survivalTarget.toFixed(1)}s` },
        { label: 'On-Track', value: `${accuracy}%` },
        { label: 'Metric Breaches', value: `${this.breaches} / ${this.maxBreaches}` },
        { label: 'Score', value: score },
      ],
      flavorText: success
        ? 'Expansion held to its history — the metric relaxed back onto ΛCDM.'
        : 'Expansion tore off its track — runaway metric distortion.',
    });
  }
}

export default ExpansionContainmentScene;
