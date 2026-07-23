/**
 * Structural Realignment Mini-Game  —  real mass-spring lattice relaxation.
 *
 * A structural anomaly has tangled a spacetime truss: a network of nodes joined
 * by springs (Hooke's law), knocked out of its minimum-energy shape. Every
 * spring pulls toward its rest length, so the ALIGNED configuration is the
 * global energy minimum — but the scrambled lattice is stuck in a tangled
 * local minimum. Drag the free nodes to untangle it; the springs fight and
 * assist you, and when every link relaxes to its rest length the structure
 * snaps taut and locks. A tactile constraint-solving verb — no timing or
 * reflex, just reading a coupled elastic network and relaxing it.
 *
 * A link glows green as it nears its rest length, amber when stressed, red when
 * badly stretched or compressed — that colour is the only guide you need; the
 * target shape is wherever every link is green at once.
 */
import Phaser from 'phaser';
import MiniGameScene, { MG_COLORS } from './MiniGameScene.js';

const THEME_COLOR = 0x7d8ba8; // structural steel-blue
const K = 0.4;      // spring stiffness (gentle - guides, doesn't yank)
const DAMP = 6.5;   // velocity damping (nodes mostly stay where you drop them)
const NODE_R = 11;
const GRAB_R = 28;
const WIN_STRESS = 9;   // mean |len - rest| (px) considered "aligned"
const HOLD_TO_WIN = 0.4; // seconds it must stay aligned to lock

export class StructuralRealignmentScene extends MiniGameScene {
  constructor() {
    super('StructuralRealignmentScene');
  }

  init(data) {
    super.init(data);
    const severity = Math.max(1, Math.min(5, this.anomaly?.severity || 2));
    this.severity = severity;

    this.ringCount = Math.min(7, 3 + severity);
    this.timeLimit = 32 - severity * 2;
    this.scramble = 45 + severity * 12;
    // Guidance ramp: low severity shows where every node belongs; high severity
    // is the blind untangle. This is the difficulty axis, not just node count.
    this.showGhosts = severity <= 3;      // ringed target markers
    this.showConnectors = severity <= 2;  // line from each node to its marker

    this.elapsed = 0;
    this.alignedTime = 0;
    this.stress = Infinity;
    this.dragIndex = -1;
    this.pointer = { x: 0, y: 0 };
    this.gameOver = false;
  }

  create() {
    super.create();
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    this.cx = width / 2;
    this.cy = height / 2 + 24;

    this.createHeader(
      'STRUCTURAL REALIGNMENT',
      THEME_COLOR,
      `Severity ${this.anomaly?.severity || '?'} · Realign the lattice — turn every link green`
    );
    const help = this.showConnectors
      ? 'drag each node onto its ringed marker — the guide line turns green when it lands'
      : this.showGhosts
        ? 'drag the nodes onto their ringed markers until every link turns green'
        : 'no markers — read the links: green = at rest length, red = badly stressed';
    this.add.text(this.cx, 116, help, {
      fontFamily: '"IBM Plex Mono", monospace', fontSize: '11px', color: '#dfa73f',
    }).setOrigin(0.5);

    this.buildLattice();

    this.linkGfx = this.add.graphics();
    this.ghostGfx = this.add.graphics(); // node -> marker guide lines (dynamic)

    // Static target markers show where each free node belongs (low severity)
    if (this.showGhosts) {
      this.nodes.forEach((n) => {
        if (n.anchor) return;
        this.add.circle(n.tx, n.ty, NODE_R + 3, 0x000000, 0).setStrokeStyle(1, MG_COLORS.accent, 0.4);
      });
    }

    this.nodeGfx = this.nodes.map((n) => {
      const glow = this.add.circle(n.x, n.y, NODE_R + 5, THEME_COLOR, 0).setBlendMode(Phaser.BlendModes.ADD);
      const dot = this.add.circle(n.x, n.y, NODE_R, n.anchor ? MG_COLORS.accent : MG_COLORS.voidRaised)
        .setStrokeStyle(2, n.anchor ? MG_COLORS.accent : THEME_COLOR, n.anchor ? 0.9 : 0.7);
      return { glow, dot };
    });

    this.stressText = this.add.text(this.cx, 138, '', {
      fontFamily: '"IBM Plex Mono", monospace', fontSize: '13px', color: '#9497ad',
    }).setOrigin(0.5);

    const barWidth = 240;
    const barY = height - 46;
    this.add.rectangle(this.cx, barY, barWidth, 6, MG_COLORS.line).setOrigin(0.5);
    this.timeFill = this.add.rectangle(this.cx - barWidth / 2, barY, barWidth, 6, THEME_COLOR).setOrigin(0, 0.5);
    this.timeBarWidth = barWidth;
    this.add.text(this.cx, barY + 15, 'TIME REMAINING', {
      fontFamily: '"IBM Plex Mono", monospace', fontSize: '10px', color: '#565a72',
    }).setOrigin(0.5);

    this.input.on('pointerdown', (p) => this.onDown(p));
    this.input.on('pointermove', (p) => { this.pointer.x = p.x; this.pointer.y = p.y; });
    this.input.on('pointerup', () => { this.dragIndex = -1; });
  }

  // A triangulated ring-and-hub truss. Rest lengths come from the TARGET
  // (aligned) layout; free nodes are then scrambled into a tangle.
  buildLattice() {
    const R = 128;
    const m = this.ringCount;
    const target = [];
    for (let i = 0; i < m; i++) {
      const a = (i / m) * Math.PI * 2 - Math.PI / 2;
      target.push({ x: this.cx + Math.cos(a) * R, y: this.cy + Math.sin(a) * R });
    }
    const hub = m;
    target.push({ x: this.cx, y: this.cy });

    // Two anchors pin position + orientation so the solution is unique.
    const anchorA = 0;
    const anchorB = Math.floor(m / 2);

    this.nodes = target.map((t, i) => {
      const anchor = i === anchorA || i === anchorB;
      let x = t.x;
      let y = t.y;
      if (!anchor) {
        const ang = Math.random() * Math.PI * 2;
        const mag = this.scramble * (0.5 + Math.random() * 0.5);
        x = Phaser.Math.Clamp(this.cx + Math.cos(ang) * (R * 0.4) + Math.cos(ang) * mag, 120, this.cameras.main.width - 120);
        y = Phaser.Math.Clamp(this.cy + Math.sin(ang) * (R * 0.4) + Math.sin(ang) * mag, 170, this.cameras.main.height - 90);
      }
      return { x, y, vx: 0, vy: 0, anchor, tx: t.x, ty: t.y };
    });

    const edges = [];
    const addEdge = (a, b) => {
      const rest = Math.hypot(target[a].x - target[b].x, target[a].y - target[b].y);
      edges.push({ a, b, rest });
    };
    for (let i = 0; i < m; i++) {
      addEdge(i, (i + 1) % m); // ring
      addEdge(i, hub);         // spoke
      addEdge(i, (i + 2) % m); // chord (triangulation → rigid)
    }
    this.edges = edges;
  }

  onDown(p) {
    if (this.gameOver) return;
    let best = -1;
    let bestD = GRAB_R;
    this.nodes.forEach((n, i) => {
      if (n.anchor) return;
      const d = Phaser.Math.Distance.Between(p.x, p.y, n.x, n.y);
      if (d < bestD) { bestD = d; best = i; }
    });
    this.dragIndex = best;
    this.pointer.x = p.x;
    this.pointer.y = p.y;
  }

  update(time, delta) {
    if (this.gameOver) return;
    const dt = Math.min(delta / 1000, 0.03);
    this.elapsed += dt;

    // Accumulate spring forces
    const fx = new Array(this.nodes.length).fill(0);
    const fy = new Array(this.nodes.length).fill(0);
    let stressSum = 0;
    for (const e of this.edges) {
      const A = this.nodes[e.a];
      const B = this.nodes[e.b];
      const dx = B.x - A.x;
      const dy = B.y - A.y;
      const len = Math.hypot(dx, dy) || 0.0001;
      const diff = len - e.rest;
      stressSum += Math.abs(diff);
      const f = K * diff; // >0 stretched (attract), <0 compressed (repel)
      const ux = dx / len;
      const uy = dy / len;
      fx[e.a] += f * ux; fy[e.a] += f * uy;
      fx[e.b] -= f * ux; fy[e.b] -= f * uy;
    }
    this.stress = stressSum / this.edges.length;

    // Integrate free (non-dragged) nodes
    const damp = Math.max(0, 1 - DAMP * dt);
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      if (n.anchor) continue;
      if (i === this.dragIndex) {
        n.x = this.pointer.x; n.y = this.pointer.y; n.vx = 0; n.vy = 0;
        continue;
      }
      n.vx = (n.vx + fx[i] * dt) * damp;
      n.vy = (n.vy + fy[i] * dt) * damp;
      n.x += n.vx * dt;
      n.y += n.vy * dt;
    }

    // Win requires the aligned state to HOLD, not just flash past
    if (this.stress < WIN_STRESS) this.alignedTime += dt;
    else this.alignedTime = 0;

    this.render();

    const remaining = Math.max(0, this.timeLimit - this.elapsed);
    this.timeFill.width = this.timeBarWidth * (remaining / this.timeLimit);

    if (this.alignedTime >= HOLD_TO_WIN) this.endGame(true);
    else if (remaining <= 0) this.endGame(false);
  }

  render() {
    // Guide lines from each free node to its marker (lowest severities)
    this.ghostGfx.clear();
    if (this.showConnectors) {
      for (const n of this.nodes) {
        if (n.anchor) continue;
        const landed = Math.hypot(n.x - n.tx, n.y - n.ty) < 12;
        this.ghostGfx.lineStyle(1, landed ? MG_COLORS.good : MG_COLORS.accent, landed ? 0.55 : 0.3);
        this.ghostGfx.lineBetween(n.x, n.y, n.tx, n.ty);
      }
    }

    this.linkGfx.clear();
    let greenCount = 0;
    for (const e of this.edges) {
      const A = this.nodes[e.a];
      const B = this.nodes[e.b];
      const len = Math.hypot(B.x - A.x, B.y - A.y);
      const err = Math.abs(len - e.rest);
      let color;
      if (err < 8) { color = MG_COLORS.good; greenCount++; }
      else if (err < 34) color = MG_COLORS.warn;
      else color = MG_COLORS.critical;
      this.linkGfx.lineStyle(2, color, 0.85);
      this.linkGfx.lineBetween(A.x, A.y, B.x, B.y);
    }

    this.nodes.forEach((n, i) => {
      const g = this.nodeGfx[i];
      g.dot.setPosition(n.x, n.y);
      g.glow.setPosition(n.x, n.y);
      const held = i === this.dragIndex;
      g.glow.setFillStyle(THEME_COLOR, held ? 0.4 : 0);
      if (!n.anchor) g.dot.setStrokeStyle(2, held ? MG_COLORS.accent : THEME_COLOR, held ? 1 : 0.7);
    });

    const pct = Math.round((greenCount / this.edges.length) * 100);
    this.stressText.setText(`LINKS ALIGNED ${greenCount} / ${this.edges.length}   (${pct}%)`);
    this.stressText.setColor(pct === 100 ? '#4fd1a5' : pct > 60 ? '#e0824a' : '#9497ad');
  }

  endGame(success) {
    if (this.gameOver) return;
    this.gameOver = true;
    this.input.keyboard.off('keydown-ESC');
    this.input.off('pointerdown');
    this.input.off('pointermove');
    this.input.off('pointerup');

    // Alignment quality: fraction of links at rest length, and how fast.
    const aligned = this.edges.filter((e) => {
      const A = this.nodes[e.a]; const B = this.nodes[e.b];
      return Math.abs(Math.hypot(B.x - A.x, B.y - A.y) - e.rest) < 8;
    }).length;
    const alignPct = Math.round((aligned / this.edges.length) * 100);
    const par = this.timeLimit * 0.5;
    const speedBonus = success ? Math.max(0, 100 - Math.max(0, this.elapsed - par) * 4) : 0;
    const accuracy = success ? Math.round(Phaser.Math.Clamp(speedBonus, 0, 100)) : alignPct;
    const score = Math.max(0, Math.round((success ? 400 : 0) + accuracy * 5));

    this.finishGame({
      status: success ? 'success' : 'failed',
      accuracy,
      score,
      themeColor: THEME_COLOR,
      statLines: [
        { label: 'Links Aligned', value: `${aligned} / ${this.edges.length}` },
        { label: success ? 'Time' : 'Best Alignment', value: success ? `${this.elapsed.toFixed(1)}s` : `${alignPct}%` },
        { label: 'Score', value: score },
      ],
      flavorText: success
        ? 'Lattice relaxed to its rest state — the structure crystallized and holds.'
        : 'The truss never found its minimum — structure collapsed under residual stress.',
    });
  }
}

export default StructuralRealignmentScene;
