// src/components/game/graphics/TextureFactory.js
//
// Boot-time procedural texture pool. Generates a small set of seeded
// RenderTextures (spirals, ellipticals, irregulars, nebulae, quasar,
// starfields) once per scene; chunks then instance them with per-object
// scale/rotation/alpha. Budget: well under 300ms on a mid-range machine.
import seedrandom from "seedrandom";
import { OBJECT_CLASSES } from "../world/researchValues.js";
import { PLANET_CLASSES } from "../world/worldScales.js";
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

// 0xRRGGBB + alpha -> canvas rgba() string.
const toRgba = (hex, a) => `rgba(${(hex >> 16) & 255},${(hex >> 8) & 255},${hex & 255},${a})`;

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
    this._generateStar();
    Object.entries(PLANET_CLASSES).forEach(([id, info]) => this._generatePlanet(id, info));
    HULL_CATALOG.forEach((hull) => this._generateHull(hull.id));
  }

  // A star: a broad soft corona, four diffraction spikes, and a hot core -
  // all white, tinted per-object to the spectral color, additive-blended.
  // Fully transparent at the edges so overlaps blend cleanly.
  _generateStar() {
    const key = "evtex:star";
    if (this.scene.textures.exists(key)) return;
    const size = 256;
    const c = size / 2;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    // Corona: wide falloff that reaches zero well before the edge.
    const corona = ctx.createRadialGradient(c, c, 0, c, c, c);
    corona.addColorStop(0, "rgba(255,255,255,1)");
    corona.addColorStop(0.07, "rgba(255,255,255,0.95)");
    corona.addColorStop(0.2, "rgba(255,255,255,0.4)");
    corona.addColorStop(0.5, "rgba(255,255,255,0.1)");
    corona.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = corona;
    ctx.fillRect(0, 0, size, size);

    // Diffraction spikes: two crossed, tapered glows (add within the canvas).
    ctx.globalCompositeOperation = "lighter";
    const spike = (w, h) => {
      const g = ctx.createLinearGradient(c, c - h, c, c + h);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.5, "rgba(255,255,255,0.5)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(c, c, w, h, 0, 0, Math.PI * 2);
      ctx.fill();
    };
    spike(1.6, c * 0.92); // vertical
    spike(c * 0.92, 1.6); // horizontal
    ctx.globalCompositeOperation = "source-over";

    // Hot core
    const core = ctx.createRadialGradient(c, c, 0, c, c, size * 0.1);
    core.addColorStop(0, "rgba(255,255,255,1)");
    core.addColorStop(1, "rgba(255,255,255,0.55)");
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(c, c, size * 0.1, 0, Math.PI * 2);
    ctx.fill();

    this.scene.textures.addCanvas(key, canvas);
  }

  // A shaded planet with a lit limb, a night-side terminator, a soft
  // atmosphere halo for worlds that have air, and per-type surface detail
  // (gas bands, terran continents, ice caps, molten cracks, cratered rock).
  // One colored texture per class; transparent outside the atmosphere.
  _generatePlanet(classId, info) {
    const key = `evtex:planet:${classId}`;
    if (this.scene.textures.exists(key)) return;
    const size = 128;
    const c = size / 2;
    const r = size * 0.38;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    const rng = seedrandom(`${key}#surface`);

    const R = (info.color >> 16) & 255;
    const G = (info.color >> 8) & 255;
    const B = info.color & 255;
    const cl = (v) => Math.max(0, Math.min(255, Math.round(v)));
    const rgba = (f, a) => `rgba(${cl(R * f)},${cl(G * f)},${cl(B * f)},${a})`;
    const hasAtmo = ["terran", "ocean", "ice", "gas"].includes(classId);

    // Soft atmosphere halo (transparent-edged) so overlaps blend, never a box.
    if (hasAtmo) {
      const halo = ctx.createRadialGradient(c, c, r * 0.85, c, c, r * 1.32);
      halo.addColorStop(0, rgba(1.4, 0.4));
      halo.addColorStop(1, rgba(1.4, 0));
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(c, c, r * 1.32, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.clip();

    // Base sphere, lit from the upper-left.
    const body = ctx.createRadialGradient(c - r * 0.38, c - r * 0.38, r * 0.1, c, c, r * 1.2);
    body.addColorStop(0, rgba(1.45, 1));
    body.addColorStop(0.55, rgba(1.0, 1));
    body.addColorStop(1, rgba(0.4, 1));
    ctx.fillStyle = body;
    ctx.fillRect(0, 0, size, size);

    // Per-type surface detail
    if (classId === "gas") {
      for (let by = -r; by < r; by += 3 + rng() * 4) {
        ctx.fillStyle = rgba(0.7 + rng() * 0.6, 0.4);
        ctx.fillRect(c - r, c + by, r * 2, 1.5 + rng() * 3);
      }
    } else if (classId === "terran") {
      for (let i = 0; i < 11; i++) {
        ctx.fillStyle = `rgba(${cl(60 + rng() * 40)},${cl(120 + rng() * 60)},${cl(70 + rng() * 30)},0.6)`;
        this._blob(ctx, c + (rng() - 0.5) * r * 1.4, c + (rng() - 0.5) * r * 1.4, 4 + rng() * 9, rng);
      }
    } else if (classId === "ocean") {
      for (let i = 0; i < 7; i++) {
        ctx.fillStyle = rgba(1.5, 0.25);
        this._blob(ctx, c + (rng() - 0.5) * r * 1.5, c + (rng() - 0.5) * r * 1.5, 5 + rng() * 8, rng);
      }
    } else if (classId === "ice") {
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      this._blob(ctx, c, c - r * 0.7, r * 0.8, rng);
      this._blob(ctx, c, c + r * 0.7, r * 0.8, rng);
      for (let i = 0; i < 8; i++) {
        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(c + (rng() - 0.5) * r * 1.6, c + (rng() - 0.5) * r * 1.6);
        ctx.lineTo(c + (rng() - 0.5) * r * 1.6, c + (rng() - 0.5) * r * 1.6);
        ctx.stroke();
      }
    } else if (classId === "lava") {
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 22; i++) {
        ctx.strokeStyle = `rgba(255,${cl(90 + rng() * 90)},40,${0.3 + rng() * 0.4})`;
        ctx.lineWidth = 0.8 + rng() * 1.4;
        ctx.beginPath();
        const x = c + (rng() - 0.5) * r * 1.7;
        const y = c + (rng() - 0.5) * r * 1.7;
        ctx.moveTo(x, y);
        ctx.lineTo(x + (rng() - 0.5) * 14, y + (rng() - 0.5) * 14);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
    } else {
      // rocky / desert / barren: mottled surface + a few craters
      for (let i = 0; i < 46; i++) {
        ctx.fillStyle = rgba(rng() < 0.5 ? 0.72 : 1.3, 0.22);
        ctx.beginPath();
        ctx.arc(c + (rng() - 0.5) * r * 1.9, c + (rng() - 0.5) * r * 1.9, 1 + rng() * 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      for (let i = 0; i < 5; i++) {
        const x = c + (rng() - 0.5) * r * 1.5;
        const y = c + (rng() - 0.5) * r * 1.5;
        const cr = 2 + rng() * 4;
        ctx.fillStyle = rgba(0.55, 0.4);
        ctx.beginPath();
        ctx.arc(x, y, cr, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = rgba(1.4, 0.3);
        ctx.beginPath();
        ctx.arc(x - cr * 0.3, y - cr * 0.3, cr * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Night-side terminator, opposite the light.
    const term = ctx.createRadialGradient(c + r * 0.55, c + r * 0.55, r * 0.2, c, c, r * 1.45);
    term.addColorStop(0, "rgba(2,2,12,0)");
    term.addColorStop(1, "rgba(2,2,12,0.74)");
    ctx.fillStyle = term;
    ctx.fillRect(0, 0, size, size);
    ctx.restore();

    // Bright lit limb on the day side (atmosphere worlds catch the light).
    if (hasAtmo) {
      ctx.strokeStyle = rgba(1.7, 0.5);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(c, c, r - 0.7, Math.PI * 1.15, Math.PI * 1.95);
      ctx.stroke();
    }

    this.scene.textures.addCanvas(key, canvas);
  }

  // Small irregular filled blob (continents, ice caps) around (x, y).
  _blob(ctx, x, y, radius, rng) {
    ctx.beginPath();
    const pts = 7;
    for (let i = 0; i <= pts; i++) {
      const a = (i / pts) * Math.PI * 2;
      const rr = radius * (0.6 + rng() * 0.7);
      const px = x + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
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
    if (descriptor.category === "star") return "evtex:star";
    if (descriptor.category === "planet") return `evtex:planet:${descriptor.objectClass}`;
    const info = OBJECT_CLASSES[descriptor.objectClass];
    const family = info?.category === "galaxy" ? info.morph
      : info?.category === "nebula" ? "nebula"
      : descriptor.objectClass; // quasar | merger
    const fam = family === "lenticular" ? "elliptical" : family;
    const count = VARIANTS[fam] ?? 1;
    return `evtex:${fam}:${stringHash(descriptor.id) % count}`;
  }

  // Galaxy/nebula/phenomenon textures. Drawn on a real <canvas> (like the
  // hulls and starfield), NOT a Phaser RenderTexture: RenderTextures use
  // premultiplied alpha on the GPU and leave an opaque dark box around the
  // sprite - the "not a PNG" artifact. Canvas textures are cleanly transparent.
  _generate(family, variant) {
    const key = `evtex:${family}:${variant}`;
    if (this.scene.textures.exists(key)) return;
    const size = TEX_SIZE;
    const c = size / 2;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    if (family === "spiral" || family === "barred") this._drawSpiral(ctx, c, family === "barred");
    else if (family === "elliptical") this._drawElliptical(ctx, c);
    else if (family === "irregular") this._drawIrregular(ctx, c);
    else if (family === "nebula") this._drawNebula(ctx, c, variant);
    else if (family === "quasar") this._drawQuasar(ctx, c);
    else if (family === "merger") this._drawMerger(ctx, c);

    this.scene.textures.addCanvas(key, canvas);
  }

  // Canvas draw helpers (mirror the old Graphics fillCircle/fillEllipse).
  _disc(ctx, hex, alpha, x, y, r) {
    ctx.fillStyle = toRgba(hex, alpha);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  _oval(ctx, hex, alpha, x, y, w, h) {
    ctx.fillStyle = toRgba(hex, alpha);
    ctx.beginPath();
    ctx.ellipse(x, y, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawSpiral(ctx, c, barred) {
    const arms = 2 + Math.floor(this.rng() * 2) * 2; // 2 or 4
    const tightness = 0.18 + this.rng() * 0.12;
    const armColor = ARM_COLORS[Math.floor(this.rng() * ARM_COLORS.length)];

    // Core bulge: layered soft discs approximating a gaussian falloff.
    for (let r = 26; r > 2; r -= 3) this._disc(ctx, CORE_COLOR, 0.05 + (26 - r) * 0.012, c, c, r);
    if (barred) {
      ctx.save();
      ctx.translate(c, c);
      ctx.rotate(this.rng() * Math.PI);
      this._oval(ctx, CORE_COLOR, 0.35, 0, 0, 92, 16);
      ctx.restore();
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
        // Sprinkle pink HII star-forming regions and bright blue-white young
        // stars through the arms - real spiral astronomy, and far less flat.
        const roll = this.rng();
        const dotColor = roll < 0.05 ? 0xff9ec8 : roll < 0.11 ? 0xffffff : armColor;
        const dotAlpha = roll < 0.11 ? 0.28 + this.rng() * 0.3 : 0.10 + this.rng() * 0.22;
        this._disc(ctx, dotColor, dotAlpha, x, y, (roll < 0.05 ? 1.6 : 1) + this.rng() * 2.1);
      }
    }
  }

  _drawElliptical(ctx, c) {
    const ellipticity = this.rng(); // 0 = E0 round ... 1 = E7 flat
    const color = ELLIPTICAL_COLORS[Math.floor(this.rng() * ELLIPTICAL_COLORS.length)];
    const ry = 1 - ellipticity * 0.62;
    for (let r = 100; r > 3; r -= 2.5) this._oval(ctx, color, 0.012 + (100 - r) * 0.0035, c, c, r * 2, r * 2 * ry);
  }

  _drawIrregular(ctx, c) {
    const color = ARM_COLORS[Math.floor(this.rng() * ARM_COLORS.length)];
    const clumps = 5 + Math.floor(this.rng() * 4);
    for (let i = 0; i < clumps; i++) {
      const cx = c + (this.rng() - 0.5) * 110;
      const cy = c + (this.rng() - 0.5) * 110;
      for (let j = 0; j < 45; j++) {
        this._disc(ctx, this.rng() < 0.25 ? CORE_COLOR : color, 0.08 + this.rng() * 0.2,
          cx + (this.rng() - 0.5) * 46, cy + (this.rng() - 0.5) * 46, 1 + this.rng() * 2);
      }
    }
  }

  _drawNebula(ctx, c, variant) {
    const palette = NEBULA_PALETTES[variant % NEBULA_PALETTES.length];
    for (let layer = 0; layer < 3; layer++) {
      const color = palette[layer];
      for (let i = 0; i < 26; i++) {
        const x = c + (this.rng() - 0.5) * (150 - layer * 30);
        const y = c + (this.rng() - 0.5) * (150 - layer * 30);
        this._disc(ctx, color, 0.02 + this.rng() * 0.035, x, y, 18 + this.rng() * (44 - layer * 10));
      }
    }
  }

  _drawQuasar(ctx, c) {
    for (let r = 30; r > 2; r -= 2) this._disc(ctx, 0xffffff, 0.05 + (30 - r) * 0.02, c, c, r);
    // Relativistic jets: thin fading spikes.
    this._oval(ctx, 0x9fe6f0, 0.4, c, c - 62, 7, 108);
    this._oval(ctx, 0x9fe6f0, 0.4, c, c + 62, 7, 108);
    this._oval(ctx, 0x4ec9e0, 0.15, c, c, 220, 10);
  }

  _drawMerger(ctx, c) {
    // Two offset elliptical bodies plus a tidal bridge of scattered stars.
    const body = (cx, cy) => {
      for (let r = 52; r > 3; r -= 2.5) this._oval(ctx, CORE_COLOR, 0.015 + (52 - r) * 0.004, cx, cy, r * 2, r * 1.5);
    };
    body(c - 46, c - 22);
    body(c + 46, c + 22);
    for (let t = 0; t < 1; t += 0.02) {
      const x = c - 46 + t * 92 + (this.rng() - 0.5) * 20;
      const y = c - 22 + t * 44 + Math.sin(t * Math.PI) * 26 + (this.rng() - 0.5) * 12;
      this._disc(ctx, ARM_COLORS[0], 0.12 + this.rng() * 0.18, x, y, 1 + this.rng() * 1.8);
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
