/**
 * Waveform Collapse Mini-Game  —  real probabilistic quantum measurement.
 *
 * A quantum anomaly is a particle in a superposition across a lattice of
 * position eigenstates. Each state's probability is |ψ|² (a Gaussian wave
 * packet). MEASURING (SPACE) collapses the wavefunction into ONE state,
 * chosen at random weighted by those probabilities - so even a good setup can
 * miss. Resolve the anomaly by repeatedly collapsing it into the TARGET
 * eigenstate.
 *
 * The core tension is the real Heisenberg uncertainty principle:
 *   - SQUEEZE the packet (↑) -> higher peak probability on one state, but
 *     localizing position spreads momentum, so the packet DRIFTS FASTER and
 *     is harder to park on the target.
 *   - WIDEN it (↓) -> slow and easy to aim, but the probability is smeared so
 *     any single measurement is likely to miss.
 * Steer with ← / →, squeeze/widen with ↑ / ↓, and MEASURE when the target
 * state's probability peaks. The mechanic IS the physics.
 */
import Phaser from 'phaser';
import MiniGameScene, { MG_COLORS } from './MiniGameScene.js';

const THEME_COLOR = 0x4fd1a5; // quantum teal

const N = 5;              // position eigenstates in the lattice
const W_MIN = 0.40;       // tightest packet (~92% peak, fastest drift)
const W_MAX = 1.30;       // widest packet (~32% peak, slowest drift)
const W_REF = 0.9;        // reference width for the uncertainty-speed coupling
const BASE_DRIFT = 1.05;  // slots/sec at reference width, severity 1
const SQUEEZE_RATE = 1.9; // width units/sec while holding ↑ / ↓
const MEASURE_COOLDOWN = 0.22;

export class WaveformCollapseScene extends MiniGameScene {
  constructor() {
    super('WaveformCollapseScene');
  }

  init(data) {
    super.init(data);
    const severity = Math.max(1, Math.min(5, this.anomaly?.severity || 2));
    this.severity = severity;

    this.targetCollapses = 5 + severity;
    this.maxMisses = 4; // probabilistic misses need variance slack vs a timing game
    this.collapses = 0;
    this.misses = 0;

    // Wave packet: continuous center in [0, N-1], width = std dev in slots.
    this.center = 1 + Math.random() * (N - 2);
    this.width = W_MAX;
    this.dir = Math.random() < 0.5 ? -1 : 1; // drift direction (sign of velocity)
    this.target = this.pickTarget();

    this._cooldown = 0;
    this.accuracySamples = [];
    this.gameOver = false;
  }

  pickTarget() {
    // A new eigenstate to hit, never the one the packet is already sitting on.
    let t;
    do { t = Math.floor(Math.random() * N); } while (t === Math.round(this.center));
    return t;
  }

  // |ψ|² over the lattice: a normalized Gaussian centered on this.center.
  probs() {
    const p = [];
    let sum = 0;
    for (let i = 0; i < N; i++) {
      const d = i - this.center;
      const v = Math.exp(-(d * d) / (2 * this.width * this.width));
      p.push(v);
      sum += v;
    }
    for (let i = 0; i < N; i++) p[i] /= sum;
    return p;
  }

  create() {
    super.create();
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    this.cx = width / 2;
    this.baselineY = height / 2 + 90;
    this.spacing = 74;
    this.maxBarH = 190;
    this.startX = this.cx - ((N - 1) / 2) * this.spacing;

    this.createHeader(
      'WAVEFORM COLLAPSE',
      THEME_COLOR,
      `Severity ${this.anomaly?.severity || '?'} · Collapse the packet into the gold target state`
    );
    this.add.text(this.cx, 116, '← → steer    ↑ squeeze (riskier)    ↓ widen    SPACE measure', {
      fontFamily: '"IBM Plex Mono", monospace', fontSize: '11px', color: '#dfa73f',
    }).setOrigin(0.5);

    this.collapseText = this.add.text(this.cx - 130, 142, `COLLAPSED 0 / ${this.targetCollapses}`, {
      fontFamily: '"IBM Plex Mono", monospace', fontSize: '13px', color: '#4fd1a5',
    }).setOrigin(0, 0.5);
    this.missText = this.add.text(this.cx + 130, 142, `DECOHERED 0 / ${this.maxMisses}`, {
      fontFamily: '"IBM Plex Mono", monospace', fontSize: '13px', color: '#e0524a',
    }).setOrigin(1, 0.5);

    // Baseline + per-slot graphics
    this.add.rectangle(this.cx, this.baselineY, this.spacing * N, 1, MG_COLORS.line).setOrigin(0.5);
    this.barGraphics = this.add.graphics();
    this.envelopeGraphics = this.add.graphics();

    // Static slot labels + target highlight (target ring is repositioned on retarget)
    this.slotLabels = [];
    for (let i = 0; i < N; i++) {
      const x = this.startX + i * this.spacing;
      this.add.text(x, this.baselineY + 14, `|${i}⟩`, {
        fontFamily: '"IBM Plex Mono", monospace', fontSize: '12px', color: '#565a72',
      }).setOrigin(0.5);
    }
    this.targetRing = this.add.rectangle(0, this.baselineY - this.maxBarH / 2, this.spacing - 12, this.maxBarH, MG_COLORS.accent, 0)
      .setStrokeStyle(2, MG_COLORS.accent, 0.7);
    this.positionTargetRing();

    this.pTargetText = this.add.text(this.cx, this.baselineY + 44, '', {
      fontFamily: '"IBM Plex Mono", monospace', fontSize: '13px', color: '#9497ad',
    }).setOrigin(0.5);

    this.keys = this.input.keyboard.addKeys('UP,DOWN,LEFT,RIGHT');
    this.input.keyboard.on('keydown-SPACE', () => this.measure());
  }

  positionTargetRing() {
    this.targetRing.x = this.startX + this.target * this.spacing;
  }

  update(time, delta) {
    if (this.gameOver) return;
    const dt = Math.min(delta / 1000, 0.05);
    if (this._cooldown > 0) this._cooldown -= dt;

    // Squeeze / widen (Heisenberg: width sets both peak height AND drift speed)
    if (this.keys.UP.isDown) this.width = Math.max(W_MIN, this.width - SQUEEZE_RATE * dt);
    if (this.keys.DOWN.isDown) this.width = Math.min(W_MAX, this.width + SQUEEZE_RATE * dt);

    // Steer: choose drift direction
    if (this.keys.LEFT.isDown) this.dir = -1;
    if (this.keys.RIGHT.isDown) this.dir = 1;

    // Uncertainty coupling: narrower packet -> faster drift.
    const speed = BASE_DRIFT * (1 + this.severity * 0.16) * (W_REF / this.width);
    this.center += this.dir * speed * dt;

    // Reflect off the lattice walls (particle in a box)
    const lo = 0.15, hi = N - 1 - 0.15;
    if (this.center < lo) { this.center = lo; this.dir = 1; }
    else if (this.center > hi) { this.center = hi; this.dir = -1; }

    this.render();
  }

  render() {
    const p = this.probs();
    this.barGraphics.clear();
    for (let i = 0; i < N; i++) {
      const x = this.startX + i * this.spacing;
      const h = p[i] * this.maxBarH;
      const isTarget = i === this.target;
      this.barGraphics.fillStyle(isTarget ? MG_COLORS.accent : THEME_COLOR, isTarget ? 0.9 : 0.55);
      this.barGraphics.fillRect(x - (this.spacing - 18) / 2, this.baselineY - h, this.spacing - 18, h);
    }

    // Smooth continuous |ψ|² envelope over the discrete bars
    this.envelopeGraphics.clear();
    this.envelopeGraphics.lineStyle(1.5, MG_COLORS.ink, 0.4);
    this.envelopeGraphics.beginPath();
    const steps = 120;
    let peak = 0;
    for (let i = 0; i < N; i++) peak = Math.max(peak, p[i]);
    for (let s = 0; s <= steps; s++) {
      const slot = (s / steps) * (N - 1);
      const d = slot - this.center;
      const raw = Math.exp(-(d * d) / (2 * this.width * this.width));
      // scale raw (unnormalized 0..1) to match the normalized bar peak
      const h = (raw * (peak / 1)) * this.maxBarH;
      const x = this.startX + slot * this.spacing;
      const y = this.baselineY - h;
      if (s === 0) this.envelopeGraphics.moveTo(x, y);
      else this.envelopeGraphics.lineTo(x, y);
    }
    this.envelopeGraphics.strokePath();

    const pt = p[this.target];
    // Target ring brightens as its probability rises - a cue to measure now.
    this.targetRing.setStrokeStyle(2, MG_COLORS.accent, 0.3 + pt * 0.7);
    this.pTargetText.setText(`P(target |${this.target}⟩) = ${Math.round(pt * 100)}%   ·   width ${this.width.toFixed(2)}`);
    this.pTargetText.setColor(pt > 0.6 ? '#4fd1a5' : pt > 0.35 ? '#dfa73f' : '#9497ad');
  }

  measure() {
    if (this.gameOver || this._cooldown > 0) return;
    this._cooldown = MEASURE_COOLDOWN;

    const p = this.probs();
    const pt = p[this.target];
    this.accuracySamples.push(pt);

    // Collapse: weighted-random pick over |ψ|².
    let roll = Math.random();
    let collapsed = N - 1;
    for (let i = 0; i < N; i++) { roll -= p[i]; if (roll <= 0) { collapsed = i; break; } }

    const x = this.startX + collapsed * this.spacing;
    this.cameras.main.flash(120, 79, 209, 165, false);

    if (collapsed === this.target) {
      this.collapses++;
      this.collapseText.setText(`COLLAPSED ${this.collapses} / ${this.targetCollapses}`);
      this.showFeedback(`|${collapsed}⟩  ${Math.round(pt * 100)}%`, MG_COLORS.good, x, this.baselineY - this.maxBarH - 24);
      if (this.collapses >= this.targetCollapses) { this.endGame(true); return; }
      this.target = this.pickTarget();
      this.positionTargetRing();
    } else {
      this.misses++;
      this.missText.setText(`DECOHERED ${this.misses} / ${this.maxMisses}`);
      this.showFeedback(`|${collapsed}⟩  DECOHERED`, MG_COLORS.critical, x, this.baselineY - this.maxBarH - 24);
      this.shake(120, 0.006);
      // Measurement disturbs the system: the packet re-spreads and re-seeds.
      this.width = W_MAX;
      this.center = 1 + Math.random() * (N - 2);
      if (this.misses >= this.maxMisses) { this.endGame(false); return; }
    }
  }

  endGame(success) {
    if (this.gameOver) return;
    this.gameOver = true;
    this.input.keyboard.off('keydown-ESC');
    this.input.keyboard.off('keydown-SPACE');

    const avg = this.accuracySamples.length
      ? this.accuracySamples.reduce((a, b) => a + b, 0) / this.accuracySamples.length
      : 0;
    const accuracy = Math.round(Phaser.Math.Clamp(avg * 100, 0, 100));
    const score = Math.max(0, Math.round(this.collapses * 90 + accuracy * 5 - this.misses * 130));

    this.finishGame({
      status: success ? 'success' : 'failed',
      accuracy,
      score,
      themeColor: THEME_COLOR,
      statLines: [
        { label: 'Collapsed', value: `${this.collapses} / ${this.targetCollapses}` },
        { label: 'Avg. Measurement P', value: `${accuracy}%` },
        { label: 'Decoherences', value: `${this.misses} / ${this.maxMisses}` },
        { label: 'Score', value: score },
      ],
      flavorText: success
        ? 'Wavefunction pinned to the target eigenstate — superposition resolved.'
        : 'Repeated bad measurements decohered the system into noise.',
    });
  }
}

export default WaveformCollapseScene;
