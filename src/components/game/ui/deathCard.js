// src/components/game/ui/deathCard.js
//
// The run, as an image you can post.
//
// This is the acquisition channel. Everything else the game makes is only ever
// seen by the person who made it - a universe dies, a species reaches the
// stars, a chronicle freezes at the moment of death, and then one person looks
// at it and closes the tab.
//
// A card is that moment, in a form that travels. The share code on it is what
// makes it an invitation rather than a screenshot: someone reads the image,
// types seven characters, and plays the same cosmos.
//
// Drawn at 1200x630 - the Open Graph ratio - so it previews correctly when
// pasted into Discord, X, or a message.
import { sceneFor } from '../content/universeEnds';

const W = 1200;
const H = 630;

const INK = '#c9ccdb';
const FAINT = '#5a5f73';
const DIM = '#9497ad';
const ACCENT = '#dfa73f';
const GOOD = '#4fd1a5';
const CRIT = '#e0524a';

const mono = (size, weight = '') =>
  `${weight} ${size}px "IBM Plex Mono", ui-monospace, monospace`.trim();

const big = (n) => {
  if (!n) return '0';
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  return Math.round(n).toLocaleString();
};

/** A dim starfield, seeded off the code so a universe's card looks like itself. */
function drawStars(ctx, seedStr) {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rng = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };

  for (let i = 0; i < 260; i++) {
    const x = rng() * W;
    const y = rng() * H;
    const r = rng() * 1.4 + 0.3;
    ctx.globalAlpha = 0.15 + rng() * 0.5;
    ctx.fillStyle = rng() > 0.85 ? '#9fd8ff' : '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function stat(ctx, x, y, label, value, color = INK) {
  ctx.fillStyle = FAINT;
  ctx.font = mono(13);
  ctx.fillText(label.toUpperCase(), x, y);
  ctx.fillStyle = color;
  ctx.font = mono(26, '600');
  ctx.fillText(value, x, y + 32);
}

/**
 * Render the card. Returns a data URL (PNG).
 *
 * Reads the frozen chronicle where there is one, and falls back to the live
 * document for universes that ended before chronicles existed.
 */
export function renderDeathCard(universe) {
  const c = universe?.chronicle || {};
  const cs = universe?.currentState || {};
  const scene = sceneFor(universe?.endCondition);

  const name = c.name || universe?.name || 'Unnamed Universe';
  const code = c.shareCode || '—';
  const ageGyr = c.finalAgeGyr ?? Number(((cs.age || 0) / 1e9).toFixed(2));
  const ascended = c.ascended || (universe?.legacies || []);
  const met = c.civilizationsMet ?? 0;
  const lost = c.civilizationsLost ?? 0;
  const saved = c.civilizationsRescued ?? 0;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Ground + a wash of the death's own colour, so a heat death and a big rip
  // are different objects at a glance in a feed.
  ctx.fillStyle = '#08090f';
  ctx.fillRect(0, 0, W, H);
  drawStars(ctx, code + name);

  const wash = ctx.createLinearGradient(0, H, W, 0);
  wash.addColorStop(0, `${scene.resolveTo}00`);
  wash.addColorStop(1, `${scene.resolveTo}33`);
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = '#20232f';
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, W - 48, H - 48);

  // Header
  ctx.fillStyle = CRIT;
  ctx.font = mono(15, '600');
  ctx.fillText('UNIVERSE ENDED', 64, 92);

  ctx.fillStyle = INK;
  ctx.font = `300 58px "Inter", system-ui, sans-serif`;
  ctx.fillText(scene.title, 64, 154);

  ctx.fillStyle = DIM;
  ctx.font = mono(17);
  ctx.fillText(name, 64, 190);

  // The line that carries the feeling, wrapped by hand.
  ctx.fillStyle = FAINT;
  ctx.font = `italic 17px "Inter", system-ui, sans-serif`;
  const words = (scene.line || '').split(' ');
  let line = '';
  let ly = 232;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > W - 420) {
      ctx.fillText(line, 64, ly);
      ly += 24;
      line = w;
      if (ly > 292) break;
    } else line = test;
  }
  if (line && ly <= 292) ctx.fillText(line, 64, ly);

  // What it was
  stat(ctx, 64, 372, 'Final age', `${ageGyr} Gyr`);
  stat(ctx, 300, 372, 'Peoples met', String(met));
  stat(ctx, 520, 372, 'Saved', String(saved), saved ? GOOD : INK);
  stat(ctx, 700, 372, 'Lost', String(lost), lost ? CRIT : INK);
  stat(ctx, 880, 372, 'Galaxies', big(c.galaxies ?? cs.galaxyCount));

  // What outlived it - the headline, by name, if there is one.
  if (ascended.length > 0) {
    ctx.fillStyle = ACCENT;
    ctx.font = mono(13, '600');
    ctx.fillText('OUTLIVED IT', 64, 466);
    ctx.fillStyle = INK;
    ctx.font = `400 24px "Inter", system-ui, sans-serif`;
    const names = ascended.map((a) => a.designation || a.civId).slice(0, 2).join(' · ');
    ctx.fillText(names, 64, 500);
  }

  // The invitation.
  const boxW = 300;
  const boxX = W - 64 - boxW;
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(boxX, 430, boxW, 96);
  ctx.fillStyle = FAINT;
  ctx.font = mono(12);
  ctx.fillText('PLAY THIS UNIVERSE', boxX + 20, 460);
  ctx.fillStyle = ACCENT;
  ctx.font = mono(38, '600');
  ctx.fillText(code, boxX + 20, 502);

  ctx.fillStyle = FAINT;
  ctx.font = mono(13);
  ctx.fillText('ETERNAVERSE', 64, H - 52);

  return canvas.toDataURL('image/png');
}

/** Save the card. Browser downloads work here - this is the app, not a sandbox. */
export function downloadDeathCard(universe) {
  const url = renderDeathCard(universe);
  const a = document.createElement('a');
  a.href = url;
  const code = universe?.chronicle?.shareCode || 'universe';
  a.download = `eternaverse-${code}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
