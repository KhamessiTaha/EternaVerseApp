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
  // Generous reading pace: ~6s floor plus time per character, capped at 14s.
  // Players are usually flying while reading - err on the long side.
  const holdMs = Math.min(14000, 6000 + current.length * 55);
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

export const pick = (lines) =>
  Array.isArray(lines) ? lines[Math.floor(Math.random() * lines.length)] : lines;

// ------------------------------------------------------------ idle musings
// The Solar 2 signature: sometimes the entity simply talks. Shuffle-bag so
// nothing repeats until the whole pool has been heard.

const MUSINGS = [
  "Every atom in your hull was forged inside a dying star. Try to bring them back in one piece.",
  "I've watched fourteen universes end. This one is... promising. Don't quote me.",
  "Dark matter outweighs everything you can see five to one. Your people named it 'dark matter' and moved on. Remarkable.",
  "Somewhere out there, a civilization just invented jazz. It happens in every universe. Nobody knows why.",
  "You could scan something. Just a thought. [V]",
  "The universe is expanding. So is my patience. Only one of these is accelerating.",
  "Entropy always wins. But it's polite to make it work for the victory.",
  "That nebula you passed will be stars someday. Everything out here is just waiting to become something else.",
  "I once curated a universe made entirely of soup. Don't ask. The Great Filter got them anyway.",
  "At your current speed, crossing this universe would take longer than it has existed. Boost won't help. It's sweet that you try.",
  "The photons hitting your sensors are older than most civilizations. Show a little respect.",
  "If a supernova detonates and nobody scans it, does it grant research points? No. No, it does not.",
  "Black holes don't suck. Things fall. Everything falls. You fall prettier than most, I'll admit.",
  "Your species' first question was 'are we alone?' You weren't. You aren't. You won't be.",
  "I don't sleep. I tried once. There was an incident with a false vacuum. We don't discuss it.",
  "Time dilation means somewhere, this conversation is already over. Lucky them.",
  "The anomalies aren't personal. The universe breaks things; you fix things. It's a healthy arrangement.",
  "Gravity: the weakest force, yet it always collects in the end. There's a lesson there. I won't be explaining it.",
  "A civilization below is currently debating whether you exist. The evidence is literally in orbit.",
  "You've been quiet. I respect that. I also fill silences. It's my one flaw.",
  "Kardashev Type III is a civilization using an entire galaxy's energy. Type IV is when they stop returning my calls.",
  "Somewhere a proton just decayed. Or didn't. Physics is still deciding. I find that charming.",
  "Salvage drifts. Hulls mend. The universe wastes nothing except, occasionally, my time.",
  "I named a comet after you. It missed everything and left. The resemblance ends there, I hope.",
];

let museBag = [];
export function muse() {
  if (museBag.length === 0) museBag = [...MUSINGS].sort(() => Math.random() - 0.5);
  narrate(museBag.pop());
}

// ---------------------------------------------------------------- the voice
// Multi-line pools; call sites use pick(). Once-keys still vary per session.

export const CURATOR = {
  greetings: {
    dark_ages: "In the beginning there was nothing. Then you showed up. I'm still deciding whether that's an improvement.",
    stelliferous: "Stars are burning. Life is scheming. And you're here to poke at all of it. Wonderful.",
    degenerate: "Welcome to the long twilight. The stars are dying, the dwarfs are cooling, and you're still here. So am I. Awkward.",
    fallback: "Ah. You're back. The universe continued without you, in case you were wondering. It does that.",
  },
  firstScan: [
    "You pointed an instrument at something and wrote down what you saw. Congratulations - that's science. Keep doing it. [V]",
    "Your first catalog entry. Billions of objects to go. I'd pace yourself, but the universe won't.",
  ],
  firstResolve: [
    "One anomaly contained. The universe has taken notice. The universe also forgets very quickly.",
    "Containment successful. The fabric of spacetime thanks you, in its way, which is silence.",
  ],
  firstContact: [
    "They have seen you now. There is no un-seeing you.",
    "First contact. Every one of their languages just gained a new word. Most of them mean 'omen'.",
  ],
  firstMissile: [
    "They're shooting at you. I'd take that personally. Missiles turn poorly - you don't.",
    "Incoming ordnance. A gift, culturally speaking. Decline it. Turn hard.",
  ],
  hullCritical: [
    "Your hull is coming apart. I mention this only because you seem busy.",
    "Structural integrity is now a courtesy. Find salvage. The amber shards. Quickly.",
  ],
  deaths: [
    "You exploded. I've seen worse. I've seen better, too.",
    "The vessel is gone. You, apparently, are not. Curious arrangement.",
    "A brief lesson in event horizons, concluded. Shall we try again?",
    "That was the seventeenth most graceful destruction I've ever witnessed. Top twenty. Genuinely.",
    "Don't mourn. That ship was mostly empty space anyway. Now it's entirely empty space.",
    "Filed under 'learning experiences'. The file is getting thick.",
  ],
  backfire: [
    "You gave advanced technology to an aggressive species. Bold. Historic, even - they'll write about this. Angrily.",
    "The gift has been weaponized. In their defense, you did hand fire to something that bites.",
    "Uplift declined, hostility accepted. Diplomacy is a contact sport out here.",
  ],
  achievement: (title) => pick([
    `"${title}". Noted, recorded, filed for eternity. I'm almost impressed.`,
    `"${title}". I've etched it into the ledger. The ledger is me. I felt that.`,
    `"${title}". Achievements are how mortals count coup against the void. It's working, slowly.`,
  ]),
  missionComplete: [
    "Objective complete. Collect your reward before entropy does. [O]",
    "Done. The universe pays its debts - slowly, and in research points. [O]",
  ],
  claims: [
    "Reward collected. I'll devise something harder next time.",
    "Objective closed. The board refills. It always refills. That's rather the point of me.",
  ],
  boostLocked: [
    "Boost reactor depleted. Physics recommends patience. I recommend it louder.",
    "You've drained the reactor. Coast a while. The universe is 13 billion years old; it can wait nine seconds.",
  ],
  firstSalvage: [
    "You caught a drifting shard and fed it to your hull. Frugal. The void approves of recycling.",
  ],
  firstUpgrade: [
    "New hardware bolted on. The ship is now marginally less likely to disintegrate. Progress.",
  ],
  exceptional: [
    "Now THAT is worth cataloging. I haven't seen one of those since the last universe.",
    "An exceptional find. Frame this one. Metaphorically. Your ship has no walls to speak of.",
  ],
  firstAbility: [
    "Ah, you found the button. Every hull hides one trick. This is yours.",
    "Your ship has exactly one party trick, and you just used it. Use it wisely. Or don't - I'm a curator, not a coach.",
  ],
};
