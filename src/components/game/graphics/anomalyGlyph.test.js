// src/components/game/graphics/anomalyGlyph.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GLYPH_FOR_CATEGORY, GLYPHS, glyphFor, severityPips, drawAnomalyGlyph,
} from "./anomalyGlyph.js";
import { ANOMALY_TYPE_MAP } from "../constants.js";

/** Records the path calls a Phaser Graphics would receive. */
function fakeGraphics() {
  const calls = [];
  const rec = (name) => (...args) => { calls.push({ name, args }); return api; };
  const api = {
    calls,
    lineStyle: rec("lineStyle"), fillStyle: rec("fillStyle"),
    strokeCircle: rec("strokeCircle"), fillCircle: rec("fillCircle"),
    strokeEllipse: rec("strokeEllipse"), fillEllipse: rec("fillEllipse"),
    lineBetween: rec("lineBetween"), beginPath: rec("beginPath"),
    moveTo: rec("moveTo"), lineTo: rec("lineTo"), closePath: rec("closePath"),
    strokePath: rec("strokePath"),
  };
  return api;
}

const draw = (over = {}) => {
  const g = fakeGraphics();
  drawAnomalyGlyph(g, { category: "quantum", color: 0x4fd1a5, radius: 12, severity: 3, ...over });
  return g;
};

test("every anomaly category in the game maps to a real silhouette", () => {
  // A category with no glyph would silently fall back to the plain ring that
  // this module exists to replace.
  const categories = new Set(Object.values(ANOMALY_TYPE_MAP).map((t) => t.category));
  for (const c of categories) {
    assert.ok(GLYPH_FOR_CATEGORY[c], `category "${c}" has no glyph`);
    assert.ok(GLYPHS.includes(glyphFor(c)), `glyph for "${c}" is not a known shape`);
  }
});

test("the six categories are six DIFFERENT shapes", () => {
  // The whole point is telling them apart at a distance; two categories
  // sharing a silhouette would be the old bug in a new coat.
  const categories = [...new Set(Object.values(ANOMALY_TYPE_MAP).map((t) => t.category))];
  const shapes = categories.map(glyphFor);
  assert.equal(new Set(shapes).size, categories.length, `duplicate silhouettes: ${shapes.join(", ")}`);
});

test("an unknown category still draws something visible", () => {
  assert.equal(glyphFor("something-the-backend-added-later"), "ring");
  assert.equal(glyphFor(undefined), "ring");
  const g = draw({ category: "something-new" });
  assert.ok(g.calls.some((c) => c.name === "strokeCircle"), "nothing was drawn");
});

test("severity is countable, and clamped to what the backend can send", () => {
  assert.equal(severityPips(1), 1);
  assert.equal(severityPips(5), 5);
  assert.equal(severityPips(0), 1, "there is no zero-severity anomaly");
  assert.equal(severityPips(99), 5);
  assert.equal(severityPips(3.4), 3);
  assert.equal(severityPips(undefined), 1);
  assert.equal(severityPips(NaN), 1);
});

test("a severity-5 anomaly draws five more pips than a severity-1", () => {
  const count = (g) => g.calls.filter((c) => c.name === "fillCircle").length;
  // Same glyph, so the only difference in filled dots is the pip row.
  assert.equal(count(draw({ severity: 5 })) - count(draw({ severity: 1 })), 4);
});

test("every category draws without throwing, at any severity", () => {
  for (const category of Object.keys(GLYPH_FOR_CATEGORY)) {
    for (const severity of [1, 2, 3, 4, 5]) {
      assert.doesNotThrow(
        () => draw({ category, severity }),
        `${category} sev ${severity}`
      );
    }
  }
});

test("low graphics quality still draws the identifying silhouette", () => {
  // detail:false may drop ornament, but the shape and the severity count are
  // information, not decoration - they must survive.
  for (const category of Object.keys(GLYPH_FOR_CATEGORY)) {
    const g = draw({ category, severity: 4, detail: false });
    const drew = g.calls.some((c) =>
      ["strokePath", "strokeCircle", "lineBetween"].includes(c.name));
    assert.ok(drew, `${category} drew no outline at low quality`);
    assert.ok(g.calls.filter((c) => c.name === "fillCircle").length >= 4,
      `${category} lost its severity pips at low quality`);
  }
});
