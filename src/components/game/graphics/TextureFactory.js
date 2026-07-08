// src/components/game/graphics/TextureFactory.js
//
// Boot-time procedural texture pool. Generates a small set of seeded
// RenderTextures (spirals, ellipticals, irregulars, nebulae, quasar,
// starfields) once per scene; chunks then instance them with per-object
// scale/rotation/alpha. Budget: well under 300ms on a mid-range machine.
import seedrandom from "seedrandom";
import { OBJECT_CLASSES } from "../world/researchValues.js";

const TEX_SIZE = 256;
const STAR_TEX_SIZE = 512;

const VARIANTS = { spiral: 3, barred: 2, elliptical: 3, irregular: 2, nebula: 3, quasar: 1, merger: 1 };

// Stellar-population palettes: spiral arms are blue-white (young stars),
// elliptical light is yellow-red (old populations) - real astronomy.
const ARM_COLORS = [0xcfe0ff, 0xbcd4ff, 0xe4ecff];
const CORE_COLOR = 0xffe9c9;
const ELLIPTICAL_COLORS = [0xffe2b0, 0xf5d09a, 0xffd9a8];
const NEBULA_PALETTES = [
  [0x8b7bd8, 0x5b8dd9, 0x4fd1a5],
  [0xe0824a, 0xc77dd8, 0x8b7bd8],
  [0x4ec9e0, 0x5b8dd9, 0x6d6ad4],
];

const stringHash = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
};

export class TextureFactory {
  static STARFIELD_KEYS = ["evtex:stars:0", "evtex:stars:1", "evtex:stars:2"];

  constructor(scene, seed) {
    this.scene = scene;
    this.rng = seedrandom(`${seed}#textures`);
  }

  generateAll() {
    for (const [family, count] of Object.entries(VARIANTS)) {
      for (let i = 0; i < count; i++) this._generate(family, i);
    }
    TextureFactory.STARFIELD_KEYS.forEach((key, i) => this._generateStarfield(key, i));
  }

  keyFor(descriptor) {
    const info = OBJECT_CLASSES[descriptor.objectClass];
    const family = info?.category === "galaxy" ? info.morph
      : info?.category === "nebula" ? "nebula"
      : descriptor.objectClass; // quasar | merger
    const fam = family === "lenticular" ? "elliptical" : family;
    const count = VARIANTS[fam] ?? 1;
    return `evtex:${fam}:${stringHash(descriptor.id) % count}`;
  }

  _generate(family, variant) {
    const key = `evtex:${family}:${variant}`;
    if (this.scene.textures.exists(key)) return;
    const rt = this.scene.make.renderTexture({ width: TEX_SIZE, height: TEX_SIZE }, false);
    const g = this.scene.make.graphics({ add: false });
    const c = TEX_SIZE / 2;

    if (family === "spiral" || family === "barred") this._drawSpiral(g, c, family === "barred");
    else if (family === "elliptical") this._drawElliptical(g, c);
    else if (family === "irregular") this._drawIrregular(g, c);
    else if (family === "nebula") this._drawNebula(g, c, variant);
    else if (family === "quasar") this._drawQuasar(g, c);
    else if (family === "merger") this._drawMerger(g, c);

    rt.draw(g);
    rt.saveTexture(key);
    g.destroy();
    rt.destroy();
  }

  _drawSpiral(g, c, barred) {
    const arms = 2 + Math.floor(this.rng() * 2) * 2; // 2 or 4
    const tightness = 0.18 + this.rng() * 0.12;
    const armColor = ARM_COLORS[Math.floor(this.rng() * ARM_COLORS.length)];

    // Core bulge: layered soft discs approximating a gaussian falloff.
    for (let r = 26; r > 2; r -= 3) {
      g.fillStyle(CORE_COLOR, 0.05 + (26 - r) * 0.012);
      g.fillCircle(c, c, r);
    }
    if (barred) {
      g.fillStyle(CORE_COLOR, 0.35);
      g.save(); g.translateCanvas(c, c); g.rotateCanvas(this.rng() * Math.PI);
      g.fillEllipse(0, 0, 92, 16);
      g.restore();
    }
    // Arms: dots along logarithmic spirals with jitter.
    for (let a = 0; a < arms; a++) {
      const phase = (a / arms) * Math.PI * 2 + (barred ? Math.PI / arms : 0);
      for (let t = barred ? 1.2 : 0.4; t < 7.2; t += 0.02) {
        const radius = 7 * Math.exp(tightness * t);
        if (radius > c - 8) break;
        const angle = t + phase;
        const jitter = (this.rng() - 0.5) * 9;
        const x = c + Math.cos(angle) * (radius + jitter);
        const y = c + Math.sin(angle) * (radius + jitter);
        g.fillStyle(armColor, 0.10 + this.rng() * 0.22);
        g.fillCircle(x, y, 1 + this.rng() * 2.1);
      }
    }
  }

  _drawElliptical(g, c) {
    const ellipticity = this.rng(); // 0 = E0 round ... 1 = E7 flat
    const color = ELLIPTICAL_COLORS[Math.floor(this.rng() * ELLIPTICAL_COLORS.length)];
    const ry = 1 - ellipticity * 0.62;
    for (let r = 100; r > 3; r -= 2.5) {
      g.fillStyle(color, 0.012 + (100 - r) * 0.0035);
      g.fillEllipse(c, c, r * 2, r * 2 * ry);
    }
  }

  _drawIrregular(g, c) {
    const color = ARM_COLORS[Math.floor(this.rng() * ARM_COLORS.length)];
    const clumps = 5 + Math.floor(this.rng() * 4);
    for (let i = 0; i < clumps; i++) {
      const cx = c + (this.rng() - 0.5) * 110;
      const cy = c + (this.rng() - 0.5) * 110;
      for (let j = 0; j < 45; j++) {
        g.fillStyle(this.rng() < 0.25 ? CORE_COLOR : color, 0.08 + this.rng() * 0.2);
        g.fillCircle(cx + (this.rng() - 0.5) * 46, cy + (this.rng() - 0.5) * 46, 1 + this.rng() * 2);
      }
    }
  }

  _drawNebula(g, c, variant) {
    const palette = NEBULA_PALETTES[variant % NEBULA_PALETTES.length];
    for (let layer = 0; layer < 3; layer++) {
      const color = palette[layer];
      for (let i = 0; i < 26; i++) {
        const x = c + (this.rng() - 0.5) * (150 - layer * 30);
        const y = c + (this.rng() - 0.5) * (150 - layer * 30);
        g.fillStyle(color, 0.02 + this.rng() * 0.035);
        g.fillCircle(x, y, 18 + this.rng() * (44 - layer * 10));
      }
    }
  }

  _drawQuasar(g, c) {
    for (let r = 30; r > 2; r -= 2) {
      g.fillStyle(0xffffff, 0.05 + (30 - r) * 0.02);
      g.fillCircle(c, c, r);
    }
    // Relativistic jets: thin fading spikes.
    g.fillStyle(0x9fe6f0, 0.4);
    g.fillEllipse(c, c - 62, 7, 108);
    g.fillEllipse(c, c + 62, 7, 108);
    g.fillStyle(0x4ec9e0, 0.15);
    g.fillEllipse(c, c, 220, 10);
  }

  _drawMerger(g, c) {
    // Two offset elliptical bodies plus a tidal bridge of scattered stars.
    const draw = (cx, cy) => {
      for (let r = 52; r > 3; r -= 2.5) {
        g.fillStyle(CORE_COLOR, 0.015 + (52 - r) * 0.004);
        g.fillEllipse(cx, cy, r * 2, r * 1.5);
      }
    };
    draw(c - 46, c - 22);
    draw(c + 46, c + 22);
    for (let t = 0; t < 1; t += 0.02) {
      const x = c - 46 + t * 92 + (this.rng() - 0.5) * 20;
      const y = c - 22 + t * 44 + Math.sin(t * Math.PI) * 26 + (this.rng() - 0.5) * 12;
      g.fillStyle(ARM_COLORS[0], 0.12 + this.rng() * 0.18);
      g.fillCircle(x, y, 1 + this.rng() * 1.8);
    }
  }

  _generateStarfield(key, layerIndex) {
    if (this.scene.textures.exists(key)) return;
    const rt = this.scene.make.renderTexture({ width: STAR_TEX_SIZE, height: STAR_TEX_SIZE }, false);
    const g = this.scene.make.graphics({ add: false });
    const counts = [170, 110, 60][layerIndex] ?? 100;
    const maxR = [0.9, 1.3, 1.8][layerIndex] ?? 1;
    for (let i = 0; i < counts; i++) {
      const tintRoll = this.rng();
      const color = tintRoll < 0.12 ? 0xbcd4ff : tintRoll < 0.2 ? 0xffe2b0 : 0xffffff;
      g.fillStyle(color, 0.25 + this.rng() * 0.6);
      g.fillCircle(this.rng() * STAR_TEX_SIZE, this.rng() * STAR_TEX_SIZE, 0.4 + this.rng() * maxR);
    }
    rt.draw(g);
    rt.saveTexture(key);
    g.destroy();
    rt.destroy();
  }
}
