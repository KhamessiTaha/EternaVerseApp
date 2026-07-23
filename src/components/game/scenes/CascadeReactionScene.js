/**
 * Cascade Reaction Mini-Game  —  real thermonuclear-runaway management.
 *
 * A stellar anomaly is a row of fusion cores that have lost their thermostat.
 * Each core's temperature sits at an UNSTABLE equilibrium: fusion power is
 * ferociously temperature-sensitive (P ∝ Tⁿ), so any excursion runs away —
 * hotter → more fusion → hotter → detonation (this is how Type Ia supernovae
 * actually ignite), or cooler → fusion falters → quench → collapse. Fusion
 * noise keeps knocking each core off balance.
 *
 * You are one operator. You can only apply control to the FOCUSED core
 * (↑ compress/ignite, ↓ vent/expand). Every core you're NOT watching drifts
 * toward breach on its own, so the game is attention scheduling: sweep the
 * row (← / →) and catch each runaway before it detonates or quenches. The
 * mechanic IS the physics — there is no scripted "reaction", just an unstable
 * system you have to actively stabilize.
 */
import Phaser from 'phaser';
import MiniGameScene, { MG_COLORS } from './MiniGameScene.js';

const THEME_COLOR = 0xe0824a; // stellar orange

const N_EXP = 5;          // fusion power exponent (T^5) vs T^4 cooling
const DET = 2.0;          // detonation temperature (supernova breach)
const QUENCH = 0.35;      // quench temperature (core-collapse breach)
const BAND = [0.82, 1.18]; // stable green band around the ideal T=1
const CTRL = 2.0;         // player control authority (per second)
const NOISE = 0.25;       // fusion fluctuation amplitude

function randn() {
  // cheap ~gaussian (sum of uniforms), std ≈ 1
  return (Math.random() + Math.random() + Math.random() + Math.random() - 2) * 0.7;
}

export class CascadeReactionScene extends MiniGameScene {
  constructor() {
    super('CascadeReactionScene');
  }

  init(data) {
    super.init(data);
    const severity = Math.max(1, Math.min(5, this.anomaly?.severity || 2));
    this.severity = severity;

    this.coolK = 0.8 + severity * 0.12; // runaway speed
    this.coreCount = Math.min(6, 2 + severity);
    this.survivalTarget = 11 + severity * 1.2;
    this.maxBreaches = 3;

    this.cores = Array.from({ length: this.coreCount }, () => ({ T: 1.0, cd: 0 }));
    this.focus = 0;
    this.elapsed = 0;
    this.breaches = 0;
    this.bandSamples = [];
    this.gameOver = false;
  }

  create() {
    super.create();
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const cx = width / 2;
    this.cy = height / 2 + 20;

    this.createHeader(
      'CASCADE REACTION',
      THEME_COLOR,
      `Severity ${this.anomaly?.severity || '?'} · Hold every core in the green band`
    );
    this.add.text(cx, 116, '← → select core     ↑ ignite (hotter)     ↓ vent (cooler)', {
      fontFamily: '"IBM Plex Mono", monospace', fontSize: '11px', color: '#dfa73f',
    }).setOrigin(0.5);
    this.add.text(cx, 134, 'unwatched cores run away on their own', {
      fontFamily: '"IBM Plex Mono", monospace', fontSize: '10px', color: '#565a72',
    }).setOrigin(0.5);

    this.breachText = this.add.text(cx, 158, `BREACHES 0 / ${this.maxBreaches}`, {
      fontFamily: '"IBM Plex Mono", monospace', fontSize: '13px', color: '#e0524a',
    }).setOrigin(0.5);

    // Core cell geometry
    const spacing = Math.min(150, (width - 120) / this.coreCount);
    this.startX = cx - ((this.coreCount - 1) / 2) * spacing;
    this.spacing = spacing;
    this.starY = this.cy - 66;
    this.trackTop = this.cy - 34;
    this.trackH = 160;
    this.trackBot = this.trackTop + this.trackH;

    // Per-core static + dynamic graphics
    this.coreGfx = this.cores.map((_, i) => {
      const x = this.startX + i * spacing;
      // Thermometer track
      this.add.rectangle(x, this.trackTop + this.trackH / 2, 6, this.trackH, MG_COLORS.line).setOrigin(0.5);
      // Green stable band segment
      const bandTopY = this.tempToY(BAND[1]);
      const bandBotY = this.tempToY(BAND[0]);
      this.add.rectangle(x, (bandTopY + bandBotY) / 2, 14, bandBotY - bandTopY, MG_COLORS.good, 0.18).setOrigin(0.5);
      // Detonation / quench caps
      this.add.rectangle(x, this.tempToY(DET), 20, 2, MG_COLORS.critical, 0.7).setOrigin(0.5);
      this.add.rectangle(x, this.tempToY(QUENCH), 20, 2, MG_COLORS.critical, 0.7).setOrigin(0.5);
      // Core index
      this.add.text(x, this.trackBot + 14, `${i + 1}`, {
        fontFamily: '"IBM Plex Mono", monospace', fontSize: '11px', color: '#565a72',
      }).setOrigin(0.5);

      const glow = this.add.circle(x, this.starY, 26, THEME_COLOR, 0.22).setBlendMode(Phaser.BlendModes.ADD);
      const star = this.add.circle(x, this.starY, 16, THEME_COLOR);
      const ring = this.add.circle(x, this.starY, 24, MG_COLORS.good, 0).setStrokeStyle(2, MG_COLORS.good, 0.8);
      const tick = this.add.rectangle(x, this.cy, 22, 3, MG_COLORS.ink).setOrigin(0.5);
      return { x, glow, star, ring, tick };
    });

    // Focus bracket (moves to the selected core)
    this.focusBracket = this.add.rectangle(this.startX, this.cy - 10, spacing - 10, this.trackH + 90, MG_COLORS.accent, 0)
      .setStrokeStyle(2, MG_COLORS.accent, 0.8);

    // Progress
    const barWidth = 240;
    const barY = this.trackBot + 44;
    this.add.rectangle(cx, barY, barWidth, 6, MG_COLORS.line).setOrigin(0.5);
    this.progressFill = this.add.rectangle(cx - barWidth / 2, barY, 0, 6, THEME_COLOR).setOrigin(0, 0.5);
    this.progressBarWidth = barWidth;
    this.add.text(cx, barY + 16, 'CONTAINMENT TIME', {
      fontFamily: '"IBM Plex Mono", monospace', fontSize: '10px', color: '#565a72',
    }).setOrigin(0.5);

    this.keys = this.input.keyboard.addKeys('UP,DOWN,LEFT,RIGHT');
    this.input.keyboard.on('keydown-LEFT', () => { this.focus = (this.focus - 1 + this.coreCount) % this.coreCount; });
    this.input.keyboard.on('keydown-RIGHT', () => { this.focus = (this.focus + 1) % this.coreCount; });
  }

  tempToY(T) {
    // DET at the top of the track, QUENCH at the bottom.
    return this.trackBot - ((T - QUENCH) / (DET - QUENCH)) * this.trackH;
  }

  net(T) {
    // Unstable at T=1: >0 above (runs hot), <0 below (quenches).
    return this.coolK * (Math.pow(T, N_EXP) - Math.pow(T, 4));
  }

  update(time, delta) {
    if (this.gameOver) return;
    const dt = Math.min(delta / 1000, 0.04);
    this.elapsed += dt;

    let inBand = 0;
    for (let i = 0; i < this.coreCount; i++) {
      const core = this.cores[i];
      if (core.cd > 0) core.cd -= dt;

      let control = 0;
      if (i === this.focus) {
        if (this.keys.UP.isDown) control += CTRL;
        if (this.keys.DOWN.isDown) control -= CTRL;
      }
      core.T += (this.net(core.T) + control) * dt + NOISE * randn() * Math.sqrt(dt);

      if (core.T >= DET || core.T <= QUENCH) {
        if (core.cd <= 0) this.registerBreach(i, core.T >= DET);
        core.T = 1.0; // re-ignite a fresh core
      } else if (core.T >= BAND[0] && core.T <= BAND[1]) {
        inBand++;
      }
    }
    this.bandSamples.push(inBand / this.coreCount);

    this.render();

    const progress = Math.min(1, this.elapsed / this.survivalTarget);
    this.progressFill.width = this.progressBarWidth * progress;

    if (this.elapsed >= this.survivalTarget) this.endGame(true);
    else if (this.breaches >= this.maxBreaches) this.endGame(false);
  }

  render() {
    for (let i = 0; i < this.coreCount; i++) {
      const core = this.cores[i];
      const g = this.coreGfx[i];
      const T = core.T;

      // Star: radius + physical temperature color
      const radius = 8 + ((T - QUENCH) / (DET - QUENCH)) * 26;
      const col = this.tempColor(T);
      g.star.setRadius(radius).setFillStyle(col);
      g.glow.setRadius(radius + 10).setFillStyle(col, 0.22);

      // Danger ring + tick color from stability state
      const inBand = T >= BAND[0] && T <= BAND[1];
      const critical = T >= 1.6 || T <= 0.5;
      const state = inBand ? MG_COLORS.good : critical ? MG_COLORS.critical : MG_COLORS.warn;
      g.ring.setStrokeStyle(2, state, inBand ? 0.5 : 0.95).setRadius(radius + 8);
      g.tick.y = this.tempToY(T);
      g.tick.setFillStyle(state);
    }

    // Move the focus bracket to the selected core
    this.focusBracket.x = this.coreGfx[this.focus].x;
  }

  tempColor(T) {
    const lin = Phaser.Math.Linear;
    let r; let g; let b;
    if (T <= 1.0) {
      const f = Phaser.Math.Clamp((T - QUENCH) / (1.0 - QUENCH), 0, 1); // deep red -> stellar gold
      r = lin(0xc0, 0xff, f); g = lin(0x39, 0xb0, f); b = lin(0x2b, 0x60, f);
    } else {
      const f = Phaser.Math.Clamp((T - 1.0) / (DET - 1.0), 0, 1); // gold -> blue-white
      r = lin(0xff, 0xbf, f); g = lin(0xb0, 0xe0, f); b = lin(0x60, 0xff, f);
    }
    return Phaser.Display.Color.GetColor(r, g, b);
  }

  registerBreach(i, detonated) {
    this.breaches++;
    this.breachText.setText(`BREACHES ${this.breaches} / ${this.maxBreaches}`);
    this.cores[i].cd = 0.8;
    this.shake(200, 0.011);
    this.showFeedback(
      detonated ? 'DETONATION!' : 'QUENCH!',
      MG_COLORS.critical,
      this.coreGfx[i].x, this.starY - 44
    );
  }

  endGame(success) {
    if (this.gameOver) return;
    this.gameOver = true;
    this.input.keyboard.off('keydown-ESC');
    this.input.keyboard.off('keydown-LEFT');
    this.input.keyboard.off('keydown-RIGHT');

    const avg = this.bandSamples.length
      ? this.bandSamples.reduce((a, b) => a + b, 0) / this.bandSamples.length
      : 0;
    const accuracy = Math.round(Phaser.Math.Clamp(avg * 100, 0, 100));
    const score = Math.max(0, Math.round(accuracy * 12 - this.breaches * 150));

    this.finishGame({
      status: success ? 'success' : 'failed',
      accuracy,
      score,
      themeColor: THEME_COLOR,
      statLines: [
        { label: 'Cores Held', value: `${this.coreCount}` },
        { label: 'Time Contained', value: `${this.elapsed.toFixed(1)}s / ${this.survivalTarget.toFixed(1)}s` },
        { label: 'Avg. In-Band', value: `${accuracy}%` },
        { label: 'Breaches', value: `${this.breaches} / ${this.maxBreaches}` },
        { label: 'Score', value: score },
      ],
      flavorText: success
        ? 'Every core held below runaway — the cascade never ignited.'
        : 'A core crossed the runaway threshold and took the chain with it.',
    });
  }
}

export default CascadeReactionScene;
