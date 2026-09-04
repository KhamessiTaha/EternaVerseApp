// src/components/game/graphics/anomalyGlyph.js
//
// What an anomaly LOOKS like, and why that carries information.
//
// Every anomaly used to be the same drawing - a ring, four ticks, a core dot -
// with only the hue changing. Ten types rendered as one shape in ten colours,
// which meant the only way to know what you were flying at was to get close
// enough to read the label. Colour alone also fails the players who can't
// separate the muted jewel tones, and fails everyone at low zoom.
//
// So the silhouette carries the CATEGORY, and the category is exactly what
// decides which minigame you're about to play (InputSystem.mapAnomalyToGame).
// Reading the shape from a distance tells you what you're in for - a
// gravitational well means the orbital game, a quantum knot means waveform
// collapse - which turns approach into a decision instead of a reveal.
//
// Severity is countable rather than vague: N pips around the outside, one per
// level. "Bigger" is hard to judge with nothing to compare against; five dots
// are five dots.
//
// Drawing only - takes a Phaser Graphics and issues path calls. The geometry
// helpers above it are pure so the mapping and the counting can be tested.

/** Category -> silhouette. Anything unknown falls back to the plain ring. */
export const GLYPH_FOR_CATEGORY = {
  gravitational: "accretion",   // something is falling in
  cosmological: "expansion",    // something is being pulled apart
  stellar: "flare",             // something is burning
  quantum: "uncertainty",       // something refuses to be one thing
  structural: "lattice",        // something in the web itself
  electromagnetic: "dipole",    // a field, with two ends
};

export const GLYPHS = ["accretion", "expansion", "flare", "uncertainty", "lattice", "dipole", "ring"];

export function glyphFor(category) {
  return GLYPH_FOR_CATEGORY[category] || "ring";
}

/** Severity as a countable number of pips. Backend severity runs 1-5. */
export function severityPips(severity) {
  const n = Math.round(Number(severity));
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(5, n));
}

const rot = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];

/** Stroke a closed parametric loop from a point function. */
function loop(g, steps, fn) {
  g.beginPath();
  for (let i = 0; i <= steps; i++) {
    const [x, y] = fn(i / steps);
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.strokePath();
}

/**
 * Draw one anomaly's body into `g`, centred on (0,0).
 *
 * @param g       Phaser.GameObjects.Graphics
 * @param color   int tint
 * @param radius  body radius in world units
 * @param severity 1-5
 * @param alpha   line alpha
 * @param width   line width
 * @param detail  false on low graphics quality - drops the ornamental passes
 */
export function drawAnomalyGlyph(g, { category, color, radius: r, severity, alpha = 0.95, width = 1.75, detail = true }) {
  const glyph = glyphFor(category);
  g.lineStyle(width, color, alpha);

  if (glyph === "accretion") {
    // A dark core with a bright rim, and a disk falling into it. The hole is
    // the point: this is the only glyph with an unlit centre.
    g.fillStyle(0x05060d, 0.95);
    g.fillCircle(0, 0, r * 0.46);
    g.strokeCircle(0, 0, r * 0.46);
    for (const tilt of [0.32, -0.32]) {
      loop(g, 40, (t) => {
        const a = t * Math.PI * 2;
        return rot(Math.cos(a) * r * 1.25, Math.sin(a) * r * 0.34, tilt);
      });
    }
  } else if (glyph === "expansion") {
    // No closed outline anywhere - the shape is coming apart. Chevrons point
    // outward, and nothing holds them.
    const arms = 6;
    for (let i = 0; i < arms; i++) {
      const a = (i / arms) * Math.PI * 2;
      const [tx, ty] = rot(r * 1.15, 0, a);
      const [lx, ly] = rot(r * 0.72, -r * 0.3, a);
      const [rx, ry] = rot(r * 0.72, r * 0.3, a);
      g.beginPath();
      g.moveTo(lx, ly); g.lineTo(tx, ty); g.lineTo(rx, ry);
      g.strokePath();
    }
    g.fillStyle(color, alpha * 0.5);
    g.fillCircle(0, 0, r * 0.16);
  } else if (glyph === "flare") {
    // Burning: a hot filled core throwing uneven spikes.
    const spikes = 10;
    for (let i = 0; i < spikes; i++) {
      const a = (i / spikes) * Math.PI * 2;
      const len = i % 2 === 0 ? r * 1.45 : r * 0.95;
      const [x1, y1] = rot(r * 0.42, 0, a);
      const [x2, y2] = rot(len, 0, a);
      g.lineBetween(x1, y1, x2, y2);
    }
    g.fillStyle(color, alpha);
    g.fillCircle(0, 0, r * 0.36);
    if (detail) {
      g.fillStyle(0xffffff, alpha * 0.55);
      g.fillCircle(0, 0, r * 0.16);
    }
  } else if (glyph === "uncertainty") {
    // Refuses to be one thing: the outline is broken, and the interior is
    // scattered rather than solid.
    const segs = 11;
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * Math.PI * 2;
      const a1 = a0 + (Math.PI * 2 / segs) * 0.52;
      g.beginPath();
      for (let k = 0; k <= 6; k++) {
        const a = a0 + (a1 - a0) * (k / 6);
        const x = Math.cos(a) * r, y = Math.sin(a) * r;
        if (k === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.strokePath();
    }
    if (detail) {
      g.fillStyle(color, alpha * 0.8);
      // Fixed offsets, not random: the same anomaly must look the same every
      // time it re-enters view.
      for (const [dx, dy, dr] of [[-0.34, -0.12, 0.1], [0.2, -0.36, 0.08], [0.36, 0.22, 0.11], [-0.14, 0.38, 0.075], [0.02, 0.04, 0.06]]) {
        g.fillCircle(dx * r, dy * r, Math.max(1, dr * r));
      }
    }
  } else if (glyph === "lattice") {
    // A fault in the web itself: rigid, straight-edged, braced.
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    g.beginPath();
    pts.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)));
    g.closePath();
    g.strokePath();
    if (detail) {
      g.lineStyle(width * 0.7, color, alpha * 0.6);
      for (let i = 0; i < 3; i++) g.lineBetween(...pts[i], ...pts[i + 3]);
      g.lineStyle(width, color, alpha);
    }
    g.fillStyle(color, alpha);
    g.fillCircle(0, 0, r * 0.14);
  } else if (glyph === "dipole") {
    // A field with two ends. Two lobes and the axis running through them.
    for (const s of [1, -1]) {
      loop(g, 34, (t) => {
        const a = t * Math.PI * 2;
        // Teardrop: wide at the far end, pinched at the origin.
        const rr = r * (0.62 + 0.38 * Math.cos(a));
        return [s * (rr * 0.95) * (0.5 + 0.5 * Math.cos(a)) + s * r * 0.12, Math.sin(a) * rr * 0.62];
      });
    }
    g.lineStyle(width * 0.8, color, alpha * 0.7);
    g.lineBetween(-r * 1.15, 0, r * 1.15, 0);
    g.lineStyle(width, color, alpha);
    g.fillStyle(color, alpha);
    g.fillCircle(0, 0, r * 0.12);
  } else {
    // Unknown category: the old ring, so a new backend type is still visible.
    g.strokeCircle(0, 0, r);
    g.fillStyle(color, alpha);
    g.fillCircle(0, 0, r * 0.26);
  }

  drawSeverityPips(g, { color, radius: r, severity, alpha });
}

/**
 * Severity as countable dots on the outside, reading clockwise from the top.
 * A critical five looks like five things, not like "bigger".
 */
export function drawSeverityPips(g, { color, radius: r, severity, alpha = 0.95 }) {
  const n = severityPips(severity);
  const ring = r * 1.62;
  const spread = Math.PI * 0.52;
  const start = -Math.PI / 2 - spread / 2;
  g.fillStyle(color, alpha);
  for (let i = 0; i < n; i++) {
    const a = n === 1 ? -Math.PI / 2 : start + spread * (i / (n - 1));
    g.fillCircle(Math.cos(a) * ring, Math.sin(a) * ring, Math.max(1.3, r * 0.075));
  }
}
