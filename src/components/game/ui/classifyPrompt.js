// src/components/game/ui/classifyPrompt.js
//
// The Classify Before Scan prompt, drawn in WORLD space under the galaxy it
// asks about.
//
// Deliberately not HUD. The mechanic is "read this shape", so the prompt must
// never pull the player's eye off the shape - it sits directly beneath the
// object, in the same visual layer as the scan ring.
//
// The icons are drawn with Graphics rather than set as glyphs, because the
// icon IS the mnemonic: a flat ellipse, arms off a round core, arms off the
// ends of a bar, a scatter. Seeing them every time you approach a galaxy
// teaches the shape-to-name mapping without anyone reading the Codex.
import { CLASSIFY_BUCKETS } from "../world/classifyModel.js";

const CYAN = 0x4ec9e0;
const GOOD = 0x4fd1a5;
const INK = 0xc9ccdb;
const SLOT_W = 62;
const OFFSET_Y = 58; // below the object, clear of the scan ring (r=42)

/** One morphology icon, centred on (0,0), about 18px across. */
function drawIcon(g, id, color, alpha) {
  g.lineStyle(1.6, color, alpha);
  g.fillStyle(color, alpha * 0.8);

  if (id === "elliptical") {
    g.fillEllipse(0, 0, 17, 10);           // smooth, featureless, no disk
    return;
  }
  if (id === "spiral") {
    g.fillCircle(0, 0, 3.4);               // round core...
    for (const dir of [1, -1]) {           // ...arms winding out of it
      g.beginPath();
      for (let t = 0; t <= 1; t += 0.12) {
        const a = t * Math.PI * 1.15;
        const r = 3.4 + t * 6.4;
        const x = dir * Math.cos(a) * r;
        const y = dir * Math.sin(a) * r;
        if (t === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.strokePath();
    }
    return;
  }
  if (id === "barred") {
    g.lineStyle(2.4, color, alpha);
    g.lineBetween(-6, 0, 6, 0);            // the bar - look for this first
    g.lineStyle(1.6, color, alpha);
    for (const dir of [1, -1]) {           // arms start at the bar's ENDS
      g.beginPath();
      for (let t = 0; t <= 1; t += 0.14) {
        const a = t * Math.PI * 0.85;
        const r = t * 6.2;
        g.lineTo(dir * (6 + Math.cos(a) * r * 0.2), dir * Math.sin(a) * r);
        if (t === 0) g.moveTo(dir * 6, 0);
      }
      g.strokePath();
    }
    return;
  }
  // irregular - no symmetry, no core
  const blobs = [[-5, -2, 2.6], [1, -4, 2.0], [4, 1, 2.9], [-2, 4, 2.2], [6, -2, 1.6]];
  for (const [x, y, r] of blobs) g.fillCircle(x, y, r);
}

export class ClassifyPrompt {
  constructor(scene) {
    this.scene = scene;
    this.container = null;
    this.shownFor = null;   // target id currently prompted
    this.guess = null;      // bucket id the player called
  }

  get called() {
    return this.guess;
  }

  /** Show (or move) the prompt under a target. Idempotent per target id. */
  show(targetId, x, y) {
    if (this.shownFor !== targetId) {
      this.hide();
      this.shownFor = targetId;
      this.guess = null;
      this._build();
      this.container.setAlpha(0);
      this.scene.tweens.add({ targets: this.container, alpha: 1, duration: 220 });
    }
    this.container?.setPosition(x, y + OFFSET_Y);
  }

  /** Record a call and redraw in the collapsed "called" state. */
  setGuess(bucketId) {
    if (!this.container || this.guess === bucketId) return false;
    this.guess = bucketId;
    this._build();
    return true;
  }

  hide() {
    this.container?.destroy(true);
    this.container = null;
    this.shownFor = null;
    this.guess = null;
  }

  /** Keep the prompt alive through the channel, but stop offering new calls. */
  freeze() {
    this.locked = true;
  }

  destroy() {
    this.hide();
  }

  _build() {
    this.container?.destroy(true);
    const c = this.scene.add.container(0, 0).setDepth(49);

    const g = this.scene.add.graphics();
    c.add(g);

    if (this.guess) {
      // Called: collapse to a single quiet line. The payoff comes at resolve,
      // so this is confirmation, not celebration.
      const bucket = CLASSIFY_BUCKETS.find((b) => b.id === this.guess);
      const w = 132;
      g.fillStyle(0x0c0f1c, 0.82);
      g.fillRoundedRect(-w / 2, -15, w, 30, 4);
      g.lineStyle(1, GOOD, 0.55);
      g.strokeRoundedRect(-w / 2, -15, w, 30, 4);

      const icon = this.scene.add.graphics();
      icon.setPosition(-w / 2 + 20, 0);
      drawIcon(icon, bucket.id, GOOD, 1);
      c.add(icon);

      const label = this.scene.add.text(-w / 2 + 36, 0, `${bucket.label} · called`, {
        fontFamily: '"IBM Plex Mono", monospace', fontSize: "10px", color: "#4fd1a5",
      }).setOrigin(0, 0.5);
      c.add(label);

      this.container = c;
      return;
    }

    // Offering: four slots, one keypress each.
    const w = SLOT_W * CLASSIFY_BUCKETS.length + 16;
    g.fillStyle(0x0c0f1c, 0.78);
    g.fillRoundedRect(-w / 2, -22, w, 44, 4);
    g.lineStyle(1, CYAN, 0.35);
    g.strokeRoundedRect(-w / 2, -22, w, 44, 4);

    CLASSIFY_BUCKETS.forEach((b, i) => {
      const x = -w / 2 + 8 + SLOT_W * i + SLOT_W / 2;

      const icon = this.scene.add.graphics();
      icon.setPosition(x, -6);
      drawIcon(icon, b.id, INK, 0.9);
      c.add(icon);

      const key = this.scene.add.text(x - 22, -14, b.key, {
        fontFamily: '"IBM Plex Mono", monospace', fontSize: "10px", color: "#4ec9e0",
      }).setOrigin(0.5);
      c.add(key);

      const label = this.scene.add.text(x, 12, b.label, {
        fontFamily: '"IBM Plex Mono", monospace', fontSize: "8px", color: "#9497ad",
      }).setOrigin(0.5);
      c.add(label);
    });

    const hint = this.scene.add.text(0, 30, "classify · optional", {
      fontFamily: '"IBM Plex Mono", monospace', fontSize: "8px", color: "#5a5f73",
    }).setOrigin(0.5);
    c.add(hint);

    this.container = c;
  }
}

/**
 * The resolve card: what it actually was, whether you called it, and - only
 * when you were wrong - how to recognise it next time. Floats up and fades.
 */
export function showClassifyResult(scene, x, y, { className, label, result }) {
  const correct = result.correct;
  const c = scene.add.container(x, y + OFFSET_Y).setDepth(51);

  const lines = [];
  lines.push({ text: `${className} · ${label}`, size: 11, color: "#c9ccdb" });
  if (result.called) {
    lines.push(correct
      ? { text: "✓ CALLED IT", size: 12, color: "#4fd1a5" }
      : { text: `called ${result.guessLabel}`, size: 10, color: "#9497ad" });
  }
  if (result.diagnostic) {
    lines.push({ text: result.diagnostic, size: 9, color: "#9497ad", wrap: 300 });
  }

  let yOff = 0;
  for (const l of lines) {
    const t = scene.add.text(0, yOff, l.text, {
      fontFamily: '"IBM Plex Mono", monospace',
      fontSize: `${l.size}px`,
      color: l.color,
      align: "center",
      wordWrap: l.wrap ? { width: l.wrap } : undefined,
    }).setOrigin(0.5, 0);
    c.add(t);
    yOff += t.height + 4;
  }

  const bg = scene.add.graphics();
  bg.fillStyle(0x0c0f1c, 0.85);
  bg.fillRoundedRect(-160, -8, 320, yOff + 12, 4);
  bg.lineStyle(1, correct ? GOOD : 0x3a3f52, correct ? 0.6 : 0.5);
  bg.strokeRoundedRect(-160, -8, 320, yOff + 12, 4);
  c.addAt(bg, 0);

  // A wrong call is a lesson, so it lingers long enough to read. A right one
  // is a reward, so it gets out of the way.
  const hold = result.diagnostic ? 4200 : 1500;
  scene.tweens.add({
    targets: c,
    y: c.y - 18,
    alpha: { from: 1, to: 0 },
    duration: hold,
    ease: "Quad.easeIn",
    onComplete: () => c.destroy(true),
  });
}
