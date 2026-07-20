// src/components/game/graphics/TextureFactory.js
//
// Boot-time procedural texture pool. Generates a small set of seeded
// RenderTextures (spirals, ellipticals, irregulars, nebulae, quasar,
// starfields) once per scene; chunks then instance them with per-object
// scale/rotation/alpha. Budget: well under 300ms on a mid-range machine.
import seedrandom from "seedrandom";
import { OBJECT_CLASSES } from "../world/researchValues.js";
import { HULL_CATALOG, HULL_SHAPES } from "../content/hullCatalog.js";

const TEX_SIZE = 256;
const STAR_TEX_SIZE = 512;
const HULL_TEX_SIZE = 256;

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
    this._generateSpark();
    HULL_CATALOG.forEach((hull) => this._generateHull(hull.id));
  }

  /** Texture key for a given hull id - drawn once, tinted per-player via setTint. */
  static hullKey(hullId) {
    return `evtex:hull:${hullId}`;
  }

  /**
   * Ship hull silhouettes: vector-drawn (path fills, not raster art), one
   * canvas per archetype, grayscale-with-gradient so a single setTint()
   * recolors the whole hull accurately. Nose points toward the top of the
   * canvas (+Y up in image space) to match the existing rotation
   * convention (PlayerObject assumes forward = rotation - PI/2).
   */
  _generateHull(hullId) {
    const key = TextureFactory.hullKey(hullId);
    if (this.scene.textures.exists(key)) return;

    const size = HULL_TEX_SIZE;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    // Nose-bright-to-tail-dark shading reads as dimensional once tinted
    const shade = ctx.createLinearGradient(0, size * 0.12, 0, size * 0.92);
    shade.addColorStop(0, "#ffffff");
    shade.addColorStop(1, "#9aa0b8");

    const shape = HULL_SHAPES[hullId] || HULL_SHAPES.interceptor;

    ctx.beginPath();
    shape.points.forEach(([fx, fy], i) => {
      const x = fx * size, y = fy * size;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = shade;
    ctx.fill();
    ctx.strokeStyle = "rgba(20,22,38,0.55)";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Subtle metallic highlight along the hull silhouette
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    const [ccx, ccy, cr] = shape.cockpit;
    ctx.beginPath();
    ctx.ellipse(ccx * size, ccy * size, cr * size * 0.55, cr * size, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(16,18,28,0.7)";
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(ccx * size, ccy * size, cr * size * 0.42, cr * size * 0.8, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.fill();

    this.scene.textures.addCanvas(key, canvas);
  }

  /**
   * Soft radial-gradient dot, white on transparent - the shared particle
   * texture for explosions/sparks (anomaly resolution, ship destruction).
   * Tinted per-emitter via Phaser's particle `tint`, so one texture covers
   * every color. Using the ship sprite as a stand-in (the old approach) is
   * what made past explosions read as "tiny ships flying everywhere."
   */
  _generateSpark() {
    const key = "evtex:spark";
    if (this.scene.textures.exists(key)) return;

    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.35, "rgba(255,255,255,0.7)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    this.scene.textures.addCanvas(key, canvas);
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
    // These must be plain canvas textures, NOT the RenderTexture.saveTexture
    // path used for the object sprites above: TileSprite (BackgroundSystem's
    // parallax layers) cannot tile a dynamic texture in WebGL and renders
    // Phaser's green "missing texture" grid across the whole screen instead.
    const canvas = document.createElement("canvas");
    canvas.width = STAR_TEX_SIZE;
    canvas.height = STAR_TEX_SIZE;
    const ctx = canvas.getContext("2d");

    const counts = [220, 140, 75][layerIndex] ?? 100;
    const maxR = [1.1, 1.6, 2.4][layerIndex] ?? 1;
    const dustAlpha = [0.08, 0.05, 0.04][layerIndex] ?? 0.05;

    // Faint background dust cloud layer for extra depth
    const nebula = ctx.createRadialGradient(
      STAR_TEX_SIZE * 0.3, STAR_TEX_SIZE * 0.25, 0,
      STAR_TEX_SIZE * 0.5, STAR_TEX_SIZE * 0.5, STAR_TEX_SIZE * 0.95
    );
    nebula.addColorStop(0, `rgba(255,255,255,${dustAlpha * 0.8})`);
    nebula.addColorStop(0.4, `rgba(150,180,255,${dustAlpha * 0.32})`);
    nebula.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = nebula;
    ctx.fillRect(0, 0, STAR_TEX_SIZE, STAR_TEX_SIZE);

    for (let i = 0; i < counts; i++) {
      const tintRoll = this.rng();
      const rgb = tintRoll < 0.10 ? "188,212,255" : tintRoll < 0.22 ? "255,226,176" : "255,255,255";
      const alpha = (0.25 + this.rng() * 0.6) * (layerIndex === 2 ? 0.9 : 1);
      const radius = 0.5 + this.rng() * maxR;
      const x = this.rng() * STAR_TEX_SIZE;
      const y = this.rng() * STAR_TEX_SIZE;
      ctx.fillStyle = `rgba(${rgb},${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();

      if (this.rng() < 0.09) {
        ctx.fillStyle = `rgba(255,255,255,${(alpha * 0.75).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, y, radius * 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (layerIndex === 0) {
      // Add a handful of rare bright sparkle stars
      for (let i = 0; i < 24; i++) {
        const x = this.rng() * STAR_TEX_SIZE;
        const y = this.rng() * STAR_TEX_SIZE;
        ctx.strokeStyle = "rgba(255,255,255,0.45)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x - 4, y); ctx.lineTo(x + 4, y);
        ctx.moveTo(x, y - 4); ctx.lineTo(x, y + 4);
        ctx.stroke();
      }
    }

    this.scene.textures.addCanvas(key, canvas);
  }
}
