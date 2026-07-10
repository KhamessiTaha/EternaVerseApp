// src/components/game/narrator.js
//
// The Curator: an omniscient narrator in the Solar 2 tradition - dry,
// ancient, faintly amused by you. Module singleton (same pattern as
// settings/loadout stores) so both Phaser systems and React can speak
// through it; NarratorOverlay renders whatever is currently being said.
// One line at a time, queued, auto-paced by line length.

let listeners = new Set();
let queue = [];
let current = null;
const said = new Set();

const emit = () => listeners.forEach((fn) => fn(current));

function pump() {
  if (current || queue.length === 0) return;
  current = queue.shift();
  emit();
  const holdMs = Math.min(9500, 4200 + current.length * 35);
  setTimeout(() => {
    current = null;
    emit();
    setTimeout(pump, 600); // breath between lines
  }, holdMs);
}

/** Say a line (queued; at most 3 waiting - the Curator doesn't backlog). */
export function narrate(text) {
  if (queue.length >= 3) queue.shift();
  queue.push(text);
  pump();
}

/** Say a line only once per session (first-time guidance, greetings). */
export function narrateOnce(key, text) {
  if (said.has(key)) return;
  said.add(key);
  narrate(text);
}

export function onNarration(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const pick = (lines) => lines[Math.floor(Math.random() * lines.length)];

// ---------------------------------------------------------------- the voice

export const CURATOR = {
  greetings: {
    dark_ages: "In the beginning there was nothing. Then you showed up. I'm still deciding whether that's an improvement.",
    stelliferous: "Stars are burning. Life is scheming. And you're here to poke at all of it. Wonderful.",
    fallback: "Ah. You're back. The universe continued without you, in case you were wondering. It does that.",
  },
  firstScan: "You pointed an instrument at something and wrote down what you saw. Congratulations - that's science. Keep doing it. [V]",
  firstResolve: "One anomaly contained. The universe has taken notice. The universe also forgets very quickly.",
  firstContact: "They have seen you now. There is no un-seeing you.",
  firstMissile: "They're shooting at you. I'd take that personally. Missiles turn poorly - you don't.",
  hullCritical: "Your hull is coming apart. I mention this only because you seem busy.",
  idleHint: "That scanner works, you know. Point it at a galaxy. [V]",
  deaths: [
    "You exploded. I've seen worse. I've seen better, too.",
    "The vessel is gone. You, apparently, are not. Curious arrangement.",
    "A brief lesson in event horizons, concluded. Shall we try again?",
  ],
  backfire: "You gave advanced technology to an aggressive species. Bold. Historic, even - they'll write about this. Angrily.",
  achievement: (title) => `"${title}". Noted, recorded, filed for eternity. I'm almost impressed.`,
  missionComplete: "Objective complete. Collect your reward before entropy does. [O]",
};
