// src/components/game/narrator.js
//
// The Curator: an omniscient narrator in the Solar 2 tradition - dry,
// ancient, faintly amused by you. Module singleton (same pattern as
// settings/loadout stores) so both Phaser systems and React can speak
// through it; NarratorOverlay renders whatever is currently being said.
// One line at a time, queued, auto-paced by line length.

import { pickUnaskedPrompt } from "./content/curatorPrompts.js";

let listeners = new Set();
let historyListeners = new Set();
let promptListeners = new Set();
let queue = [];
let current = null;
let currentPrompt = null; // an active two-choice question, if any
let promptTimer = null;
const said = new Set();
const history = []; // everything the Curator has said this session (for the log)
let seq = 0;

const emit = () => listeners.forEach((fn) => fn(current));
const emitHistory = () => historyListeners.forEach((fn) => fn(history));
const emitPrompt = () => promptListeners.forEach((fn) => fn(currentPrompt));

// ----------------------------------------------------------------- rapport
// How the Curator regards YOU. Persisted GLOBALLY (not per-universe): the
// Curator is an eternal entity that remembers you across every universe it has
// watched you tend. Choices in its two-choice prompts nudge this, and it
// quietly biases the tone of ambient lines (biasMood).
const CUR_KEY = "eterna:curator";
let rapport = 0;
const askedPrompts = new Set();
(function loadRapport() {
  try {
    const s = JSON.parse(localStorage.getItem(CUR_KEY) || "null");
    if (s) { rapport = s.rapport || 0; (s.asked || []).forEach((id) => askedPrompts.add(id)); }
  } catch { /* first run / private mode */ }
})();
function saveRapport() {
  try { localStorage.setItem(CUR_KEY, JSON.stringify({ rapport, asked: [...askedPrompts] })); } catch { /* ignore */ }
}
export const getRapport = () => rapport;
export const hasAskedPrompt = (id) => askedPrompts.has(id);

// Warm rapport occasionally softens a neutral line to warm/amused; cold rapport
// sharpens it to annoyed. Only ever nudges the baseline "dry" tone, and only
// when a call site didn't set an explicit mood.
function biasMood(mood) {
  if (mood !== "dry") return mood;
  if (rapport > 0.3 && Math.random() < 0.35) return Math.random() < 0.5 ? "warm" : "amused";
  if (rapport < -0.3 && Math.random() < 0.35) return "annoyed";
  return "dry";
}

// The Curator's tone, inferred from the words when a call site doesn't set it.
// Mood drives the Eye's colour + motion, the text tint, and the voice-blip
// pitch - so a warning reads and SOUNDS different from an idle musing without
// having to retag hundreds of existing lines.
// Order matters: earlier patterns win. See content/curatorEmotions.js for the
// eight emotions these map to.
const MOOD_PATTERNS = [
  ["warning", /collapse|imminent|critical|dying|distress|incoming|supernova|detonat|unstable|\btear|fray|hostile|missile|shooting|weaponized|erupts|\bwar\b|danger|too fast/i],
  ["grim", /\bgone\b|\bdead\b|exploded|extinct|destroyed|ends here|lost to|\bfell\b|tragedy|too late|\bmourn|eulogy|no un-seeing|\bomen\b|silence|dark age/i],
  ["awe", /heavens|transcend|ascend|legacy|legend|worship|billion|magnificent|miracle|exceptional|reached the stars|first fire|the light|colossal|monument|forged inside/i],
  ["annoyed", /poisoned|weaponized|\bbold\b|historic|angrily|declined|must you|sweet that you|it bites|remarkable\.|nine seconds|patience/i],
  ["proud", /noted|recorded|etched|impressed|well done|\bprogress\b|worthy|ledger|achievement|congratulations|almost impressed/i],
  ["warm", /came down|worship the memory|held.*open|mercy|shepherd|your people|will never.*forget|faith/i],
  ["curious", /\?|wonder|curious|interesting|somewhere|debating|scheming|question|\bwhy\b/i],
  ["amused", /charming|adorable|frankly|honestly|I'll admit|top twenty|I once|I named|don't quote me|awkward|delegation|jazz/i],
];
export function deriveMood(text) {
  for (const [mood, re] of MOOD_PATTERNS) if (re.test(text)) return mood;
  return "dry"; // the Curator's baseline: dry, ancient, faintly amused
}

function pump() {
  // A live prompt owns the channel - don't talk over a question you asked.
  if (current || currentPrompt || queue.length === 0) return;
  current = queue.shift();
  history.push(current);
  if (history.length > 80) history.shift();
  emit();
  emitHistory();
  // Generous pace: the typewriter needs time to finish, then a read buffer.
  // ~6.5s floor plus per-character time, capped at 15s.
  const holdMs = Math.min(15000, 6500 + current.text.length * 60);
  setTimeout(() => {
    current = null;
    emit();
    setTimeout(pump, 700); // breath between lines
  }, holdMs);
}

/** Say a line (queued; at most 3 waiting - the Curator doesn't backlog). */
export function narrate(text, mood) {
  if (queue.length >= 3) queue.shift();
  // Explicit mood wins; otherwise infer, then let rapport tint the baseline.
  const m = mood || biasMood(deriveMood(text));
  queue.push({ id: ++seq, text, mood: m, at: Date.now() });
  pump();
}

/** Say a line only once per session (first-time guidance, greetings). */
export function narrateOnce(key, text, mood) {
  if (said.has(key)) return;
  said.add(key);
  narrate(text, mood);
}

export function onNarration(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Subscribe to the transmissions log (fires immediately with the backlog). */
export function onCuratorHistory(fn) {
  historyListeners.add(fn);
  fn(history);
  return () => historyListeners.delete(fn);
}
export function getCuratorHistory() {
  return history;
}

// ------------------------------------------------------------ interaction
// The Curator asks you a two-choice question. Only fires when the channel is
// idle (never interrupts a line or another prompt). Auto-declines after a
// while so an ignored question doesn't sit forever.
export function onPrompt(fn) {
  promptListeners.add(fn);
  fn(currentPrompt);
  return () => promptListeners.delete(fn);
}

export function askCurator(prompt) {
  if (current || currentPrompt || !prompt) return false;
  currentPrompt = prompt;
  askedPrompts.add(prompt.id);
  saveRapport();
  emitPrompt();
  clearTimeout(promptTimer);
  promptTimer = setTimeout(() => {
    if (currentPrompt && currentPrompt.id === prompt.id) declineCurator();
  }, 17000);
  return true;
}

/** Answer the active prompt by option index - applies rapport + a reply. */
export function answerCurator(index) {
  if (!currentPrompt) return;
  const opt = currentPrompt.options[index];
  clearTimeout(promptTimer);
  currentPrompt = null;
  emitPrompt();
  if (!opt) { pump(); return; }
  rapport = Math.max(-1, Math.min(1, rapport + (opt.rapport || 0)));
  saveRapport();
  if (opt.reply) narrate(opt.reply, opt.mood);
  else pump();
}

/** Let the question pass unanswered (timeout, or player dismiss). */
export function declineCurator() {
  if (!currentPrompt) return;
  clearTimeout(promptTimer);
  currentPrompt = null;
  emitPrompt();
  narrate("No answer, then. I'll file the silence — it says as much as words, usually.", "dry");
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

// Mechanic teachings in the same voice - the Curator as reluctant tutor.
// Interleaved with musings so idle chatter also quietly teaches the game.
const TIPS = [
  "When two civilizations go to war, visit either one [G]. Arm a side, or make them stop. Both choices are remembered. Differently.",
  "Those amber shards drifting about are salvage. Fly through them; your hull mends. The universe litters, you profit.",
  "Hulls matter. The Bastion shrugs off anomaly exposure; the Tachyon is made of speed and regret. Choose in the Hangar.",
  "Your ship has one special ability on [SPACE]. Each hull's is different. The cooldown is not a suggestion.",
  "Treat a young civilization kindly and they may start worshipping you. Worshippers pay tribute. Gods have income streams.",
  "Objectives escalate: finish one and its successor asks more and pays more. The board never empties. I see to that.",
  "MINOR anomalies are field turbulence - small, honest work. CRITICAL ones bend the universe's actual numbers. Hunt accordingly.",
  "That gamma readout by your velocity? Lorentz factor. Past 1.3, your engines fight your own mass. Einstein wins every argument.",
  "The universe keeps simulating while you're gone. Leave. Come back. Read what happened. Some call that neglect; I call it delegation.",
  "Uplifting an aggressive species can backfire in proportion to the aggression meter. It says so right on the panel. Read panels.",
  "Critical anomalies pull. Gravitational ones drag you in; dark energy pushes you out. Your thrusters outmuscle both - barely.",
  "New ships unlock through achievements. The locked ones in the Hangar tell you exactly what they want from you. Ambition, itemized.",
];

let museBag = [];
let tipBag = [];
export function muse() {
  // Sometimes the Curator turns the silence into a question for YOU instead of
  // a musing - the moment the monologue becomes a conversation. Only when idle.
  if (!current && !currentPrompt && Math.random() < 0.3) {
    if (askCurator(pickUnaskedPrompt(hasAskedPrompt))) return;
  }
  // ~1 in 3 remaining idle lines is a teaching; the rest are atmosphere
  if (Math.random() < 0.35) {
    if (tipBag.length === 0) tipBag = [...TIPS].sort(() => Math.random() - 0.5);
    narrate(tipBag.pop());
    return;
  }
  if (museBag.length === 0) museBag = [...MUSINGS].sort(() => Math.random() - 0.5);
  narrate(museBag.pop());
}

// ---------------------------------------------------------------- the voice
// Multi-line pools; call sites use pick(). Once-keys still vary per session.

export const CURATOR = {
  // First Light: the scripted opening. A guaranteed, gentle anomaly spawns by
  // the player and the Curator walks them through resolving it - which cannot
  // be failed. This is the authored minute-one moment, so a new warden never
  // stares into empty void wondering what to do.
  firstLight: {
    intro: "There you are — and the universe with you. Young, hot, and already tearing at the seams. See that fracture, just off your prow? Fly to it and press [F] to mend it. Go on. I'll watch. Watching is rather my whole thing.",
    forgive: [
      "Not quite — but the young cosmos forgives a first attempt. Consider it mended. We'll call that skill and never speak of it again.",
      "Messy. Effective, though. The fracture is closed, which is what history will record. History is me.",
    ],
    resolve: [
      "There. Your first repair, in a universe that will beg for ten billion more. The rest is yours now — go find what's out there. Scan a galaxy with [V] when one catches your eye.",
      "Mended. Feel that? That was the universe deciding you're worth keeping around. Don't let it down. Off you go.",
    ],
  },
  genesis: {
    open: "So. A new warden, a fresh universe, and me to watch you fumble through both. I've left you a short list of first acts - top left. Complete them and I'll stop hovering. Mostly.",
    complete: "Move, scan, descend, speak, choose. That is the whole of it - the rest is just scale. You know the loop now. Everything from here is depth. Try not to drown.",
  },
  greetings: {
    dark_ages: "In the beginning there was nothing. Then you showed up. I'm still deciding whether that's an improvement.",
    reionization: "First light. The fog is burning off, the first stars are screaming into existence, and you've arrived just in time to take the credit. Welcome.",
    galaxy_formation: "The galaxies are still condensing out of the dark - proto-things, unfinished, luminous. A young universe, and you its first witness. Try not to break it before it's grown.",
    stellar_peak: "Stars are burning at their fullest. Life is scheming on a billion worlds. And you're here to poke at all of it. Wonderful.",
    gradual_decline: "The great star-forming is behind us now. Still bright, still busy - but the gas is thinning. Enjoy the light while it's generous.",
    twilight_era: "The long evening has begun. Red suns, cooling worlds, the last great civilizations arguing over the embers. A beautiful time to arrive. A sad one to stay.",
    degenerate_era: "Welcome to the long twilight. The stars are dying, the dwarfs are cooling, and you're still here. So am I. Awkward.",
    fallback: "Ah. You're back. The universe continued without you, in case you were wondering. It does that.",
  },
  firstScan: [
    "You pointed an instrument at something and wrote down what you saw. Congratulations - that's science. Keep doing it. [V]",
    "Your first catalog entry. Billions of objects to go. I'd pace yourself, but the universe won't.",
  ],
  // THE main goal, stated plainly once - the north star every session works
  // toward (The Ascension). Reinforced always by the Purpose panel.
  purpose: [
    "Here is the only goal that matters, warden. This universe will die - they all do. The single question worth answering is what you raise before it does. Find a people. Take them from first fire to the stars. Everything else is how you pass the time until then.",
    "You'll want a purpose out here, so I'll give you the true one: choose a people, and shepherd them all the way to transcendence before the dark takes this universe. Do that, and you'll have made the one thing that outlasts an ending.",
  ],
  needPeople: [
    "You've no chosen people yet. Find a civilization, meet them [G], and champion one - that's where the real game begins. The rest is prologue.",
    "Still no people to your name. Somewhere below, a species is taking its first steps. Go choose them, or the universe ends with nothing to show for you.",
  ],
  survey: {
    rhythm: [
      "Five in a row. There it is - the surveyor's rhythm. Keep the chain and the instruments warm up; they scan faster when they're not bored.",
      "A streak. You've found the flow every good cartographer eventually does. Don't stop now - momentum is the only currency the void respects.",
    ],
    hot: [
      "Ten unbroken. You're not exploring anymore, you're DEVOURING. I've curated tidier surveys, but never a hungrier one.",
      "A ten-chain. The catalog can barely keep up with you. Neither, frankly, can I.",
    ],
    blazing: [
      "The streak is incandescent. Slow down and you'll lose it; keep going and I'll run out of superlatives. Pick your poison.",
      "Still going. At this point the universe is just handing itself to you. Take it. Take all of it.",
    ],
  },
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
  surge: {
    start: [
      "The fabric is fraying - a whole cluster of it, right on top of you. An anomaly surge. Contain it or ride it out; either way it noticed you first.",
      "Rift storm. Several tears at once, and the universe is very much hoping you're the tidy sort. Get in there.",
      "There - the void just tore in a dozen places at once. This is the work, warden. All of it. At once. Have fun.",
    ],
    escalate: [
      "You're too slow. The tears are spreading - they always spread when ignored. Fewer choices now, and worse ones.",
      "It's growing. I did mention rifts breed. You have less time than you did, and I have less optimism.",
    ],
    contained: [
      "Contained. All of it, before it could root. THAT is what a warden is for - not the scanning, not the sightseeing. This.",
      "Surge sealed. The fabric holds because you made it. Enjoy the quiet; I'll arrange for it to end eventually.",
      "Every tear closed. I've watched wardens flee smaller storms. You stayed. Noted - and not in the usual ledger.",
    ],
    fizzled: [
      "The surge burned itself out while you were elsewhere. It'll leave scars, but it won't be your triumph. Pity.",
      "You let that one go. The universe healed the hard way, without you. It does that, when it must.",
    ],
  },
  slingshot: [
    "A textbook gravity assist. Newton would weep - with joy, I think. Hard to tell with Newton.",
    "You stole momentum from a star and it didn't even notice. That's the good kind of theft.",
    "Whipping around masses to go faster. Every probe humanity ever launched did the same. You're just prettier about it.",
    "That's how you cross a void, warden - let the universe's own gravity do the pushing. Elegant. Lazy. I approve of both.",
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
  war: {
    explainer: "A war, then. You have three options: arm a side [G], broker peace [G], or watch. The dead won't know which you chose. The survivors will.",
    armed: [
      "Weapons delivered. Somewhere, a factory cheers and a border town goes quiet. This is on both of us now.",
      "You've picked a side. History will call it foresight if they win. If they lose, history will call it something else.",
    ],
    brokered: [
      "Peace, purchased. The fleets turn home and both species owe you a debt they'll romanticize for centuries.",
      "You stopped a war with paperwork and research points. More than most gods manage, frankly.",
    ],
  },
  welcomeBack: [
    "Caught up? Good. It all happened whether you watched or not. That's rather the point of a universe.",
    "I kept notes while you were gone. I always keep notes. Welcome back, warden.",
    "The universe managed without you. Barely, I'd say, but I'm biased toward flattery.",
  ],
  rescue: [
    "You came down for them. Do you understand what that means to a people who thought the sky was empty? They will build ten thousand years of faith on this single hour.",
    "A whole world, saved by hand. Not with research spent from afar - with your own arrival. They will never, ever forget it.",
    "You descended into their dying light and held it open. That is not diplomacy, warden. That is legend.",
  ],
  petition: [
    "A civilization is calling out to you. They think you're listening. You might as well prove them right.",
    "Someone down there wants a decision from the sky. How it feels, to be prayed to and petitioned at once.",
    "A world has a request for its god. Do try to answer before they give up on you.",
    "They're hailing you, warden. Whatever you choose, they'll build a story around it. They always do.",
  ],
  events: {
    supernova: (dir) => pick([
      `A star to the ${dir} has begun its death spiral. Ninety seconds, give or take. Front-row seats are... educational. Briefly.`,
      `Stellar collapse imminent, ${dir} of you. Get close for the data. Then get very, very far.`,
    ]),
    supernovaCaptured: [
      "Spectral data captured. Now would be an excellent time to be somewhere else.",
      "You have the data. The star has seconds. Do the arithmetic while accelerating.",
    ],
    comet: (dir) => pick([
      `A comet is crossing to the ${dir}. Older than most civilizations, faster than most regrets. Skim it.`,
      `Comet inbound from the ${dir}. Its tail is full of usable ice. Its head is full of momentum. Respect both.`,
    ]),
    derelict: (dir) => pick([
      `A dead ship drifts to the ${dir}. Someone else's story, abandoned mid-sentence. Salvage rights are yours - finders keepers is universal law.`,
      `Derelict vessel, ${dir}. No life signs. No distress call. Just cargo, patience, and questions I recommend not asking.`,
    ]),
    derelictLooted: [
      "Salvage complete. The previous owners won't mind. The previous owners won't anything.",
      "Their hull feeds yours now. Out here, that's what passes for a eulogy.",
    ],
  },
};
