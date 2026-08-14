// src/components/game/content/deathScenes.test.js
//
// The requirement these encode: the six deaths must not look the same, and
// each must behave like the thing it's named after. Both are testable without
// a renderer, because the scenes are pure functions over Float32Arrays.
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEATHS, deathFor } from "./deathScenes.js";

const KINDS = Object.keys(DEATHS);

/** Run a death to progress p and hand back its buffers. */
function frame(kind, p) {
  const death = DEATHS[kind];
  const field = death.seed();
  const pos = new Float32Array(field.n * 3);
  const col = new Float32Array(field.n * 3);
  death.step(p, field, pos, col);
  return { death, field, pos, col };
}

const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const brightness = (col) => mean(col);
/** How spread out the field is - the single best summary of its shape. */
function radius(pos) {
  let s = 0;
  for (let i = 0; i < pos.length; i += 3) {
    s += Math.hypot(pos[i], pos[i + 1], pos[i + 2]);
  }
  return s / (pos.length / 3);
}

test("every death seeds a field matching its declared count", () => {
  for (const kind of KINDS) {
    const death = DEATHS[kind];
    const field = death.seed();
    assert.equal(field.n, death.count, kind);
    assert.ok(death.pointSize > 0, kind);
  }
});

test("no death ever produces a NaN or an infinity", () => {
  // One bad number turns into an invisible or exploded field at runtime, and
  // WebGL won't tell you which.
  for (const kind of KINDS) {
    for (const p of [0, 0.25, 0.5, 0.75, 1]) {
      const { pos, col } = frame(kind, p);
      for (let i = 0; i < pos.length; i++) {
        assert.ok(Number.isFinite(pos[i]), `${kind} p=${p} position[${i}]`);
        assert.ok(Number.isFinite(col[i]), `${kind} p=${p} colour[${i}]`);
      }
    }
  }
});

test("the six deaths do not start from the same picture", () => {
  // The whole point of the rebuild: they used to share one field of galaxy
  // discs, so every ending was the same image with a different filter.
  const signatures = KINDS.map((k) => {
    const { pos, field } = frame(k, 0);
    return { kind: k, r: radius(pos), n: field.n };
  });

  for (let i = 0; i < signatures.length; i++) {
    for (let j = i + 1; j < signatures.length; j++) {
      const a = signatures[i], b = signatures[j];
      const differs = Math.abs(a.r - b.r) > 0.5 || a.n !== b.n;
      assert.ok(differs, `${a.kind} and ${b.kind} open on the same image`);
    }
  }
});

test("heat death gets darker and emptier; a crunch gets brighter and tighter", () => {
  // These two are mirror images and must never be confusable.
  const coolStart = frame("cool", 0);
  const coolEnd = frame("cool", 1);
  assert.ok(brightness(coolEnd.col) < brightness(coolStart.col) * 0.5,
    "heat death must end dark");
  assert.ok(radius(coolEnd.pos) > radius(coolStart.pos),
    "heat death must end further apart");

  const crunchStart = frame("crunch", 0);
  const crunchEnd = frame("crunch", 1);
  assert.ok(brightness(crunchEnd.col) > brightness(crunchStart.col),
    "a crunch heats up - it must NOT end dark");
  assert.ok(radius(crunchEnd.pos) < radius(crunchStart.pos) * 0.2,
    "a crunch must end collapsed");
});

test("stellar death kills stars in mass order - blue giants first", () => {
  const death = DEATHS.snuff;
  const field = death.seed();
  const pos = new Float32Array(field.n * 3);
  const col = new Float32Array(field.n * 3);

  // Partway through, the heavy stars should be gone and the dwarfs still lit.
  death.step(0.55, field, pos, col);

  let heavyLit = 0, heavyTotal = 0, lightLit = 0, lightTotal = 0;
  for (let i = 0; i < field.n; i++) {
    const lit = col[i * 3] + col[i * 3 + 1] + col[i * 3 + 2] > 0.05;
    if (field.mass[i] > 0.75) { heavyTotal++; if (lit) heavyLit++; }
    else if (field.mass[i] < 0.25) { lightTotal++; if (lit) lightLit++; }
  }
  assert.ok(heavyTotal > 0 && lightTotal > 0, "the field must contain both");
  const heavyFrac = heavyLit / heavyTotal;
  const lightFrac = lightLit / lightTotal;
  assert.ok(heavyFrac < lightFrac,
    `massive stars must burn out first (heavy ${heavyFrac.toFixed(2)} vs dwarf ${lightFrac.toFixed(2)})`);
});

test("a big rip unbinds in order: clusters, then galaxies, then the rest", () => {
  // Early on the field should already be spreading, and the late stage should
  // be violently larger than the early one - not a uniform expansion.
  const early = radius(frame("rip", 0.3).pos);
  const mid = radius(frame("rip", 0.6).pos);
  const late = radius(frame("rip", 1).pos);

  assert.ok(mid > early, "clusters separate first");
  assert.ok(late / mid > (mid / early) * 1.5,
    "the final shredding must be far more violent than the first stage");
});

test("maximum entropy ends with every point the same colour", () => {
  const start = frame("diffuse", 0);
  const end = frame("diffuse", 1);

  // Measure ONE channel across points. Spread over the interleaved array
  // would also pick up the r/g/b difference within a single (grey) colour,
  // which is not a gradient - uniformity means every POINT matches, not that
  // every point is neutral grey.
  const spreadRed = (col) => {
    const reds = [];
    for (let i = 0; i < col.length; i += 3) reds.push(col[i]);
    const m = mean(reds);
    return Math.sqrt(mean(reds.map((v) => (v - m) ** 2)));
  };

  assert.ok(spreadRed(start.col) > 0.05, "it must START with real variety");
  assert.ok(spreadRed(end.col) < 0.01,
    "no gradients may remain - that is what maximum entropy means");
});

test("the unravelling lattice starts ordered and ends scattered", () => {
  // The inverse of maximum entropy, and the test that keeps it that way.
  const start = frame("unravel", 0);
  const end = frame("unravel", 1);

  // A regular lattice has evenly-spaced coordinates: few distinct values.
  const distinctX = (pos) => new Set(
    Array.from({ length: 400 }, (_, i) => pos[i * 3].toFixed(2))
  ).size;

  assert.ok(distinctX(start.pos) < 40, "it must OPEN as a readable grid");
  assert.ok(distinctX(end.pos) > 100, "and end with the grid destroyed");
  assert.ok(radius(end.pos) > radius(start.pos), "and further apart");
});

test("deathFor falls back rather than throwing on an unknown kind", () => {
  assert.equal(deathFor("crunch"), DEATHS.crunch);
  assert.equal(deathFor("nonsense"), DEATHS.cool);
  assert.equal(deathFor(undefined), DEATHS.cool);
});
