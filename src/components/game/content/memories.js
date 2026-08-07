// src/components/game/content/memories.js
//
// The Self's Memory pool - short fragments the Curator surfaces as you recollect
// yourself, each married to a real cosmology/quantum idea. Tagged by the self it
// leans toward; "neutral" ones seed the mystery before you've leaned. v1 authors
// the Observer and Gardener poles.
export const MEMORIES = [
  { id: "n-mirror", self: "neutral",
    text: "You keep expecting the void to be empty. It never is. Neither, I suspect, are you.",
    science: "The vacuum is never truly empty - quantum fields seethe with virtual particles even in 'nothing'." },
  { id: "n-name", self: "neutral",
    text: "I call you Warden because I must call you something. It is not your name. You had one, once. It's in here somewhere - with you.",
    science: "Information, physicists argue, is never destroyed - only scrambled. Even a black hole keeps the books." },
  { id: "n-shell", self: "neutral",
    text: "The vessel is not you. You know this each time it breaks and you do not. A small immortality, wearing a small ship.",
    science: "Every atom in the ship was forged in stellar cores - you are, quite literally, wearing dead stars." },

  { id: "o-witness", self: "observer",
    text: "When you scan a thing, it becomes real to the record - and, I'd wager, a little more real to itself. You are not measuring the universe. You are helping it happen.",
    science: "In quantum mechanics, a superposition doesn't resolve into a definite state until it's observed - measurement is participation." },
  { id: "o-eye", self: "observer",
    text: "A universe no one watches - does it truly occur? The old philosophers asked it as a riddle. I ask it as your job description.",
    science: "The anthropic principle: the cosmos we observe must be one compatible with observers existing to observe it." },
  { id: "o-horizon", self: "observer",
    text: "Everything you comprehend, you carry. The more of the cosmos you hold in mind, the more of it survives the dark. You are becoming its memory.",
    science: "The observable universe is bounded by how far light has travelled since the Big Bang - a horizon of the knowable." },

  { id: "g-tend", self: "gardener",
    text: "You reached down and steadied a dying people. Gods do less. Whatever you are, you are the kind of thing that cannot watch a light go out and do nothing.",
    science: "Panspermia proposes life itself is seeded between worlds - carried, deliberately or not, across the dark." },
  { id: "g-forward", self: "gardener",
    text: "Every people you raise is a message thrown forward past the end of this universe. You are not tending life. You are smuggling it past the heat death.",
    science: "Cosmological natural selection speculates universes that make more structure (and life) leave more 'offspring' universes." },
  { id: "g-heir", self: "gardener",
    text: "I was tended, once, by something like you, in a universe now ash. It taught me the work and then it was gone. I begin to wonder what I am teaching you FOR.",
    science: "Stars enrich the cosmos with heavier elements as they die - each generation seeds the next. Tending is how the universe compounds." },

  { id: "w-deep", self: "wanderer",
    text: "You keep going down - galaxy into star into world. Most wardens never leave the heights. You are looking for something specific, aren't you? Even you don't know what. Yet.",
    science: "The cosmos is scale-nested: galaxies of stars of worlds. Structure repeats down through orders of magnitude no eye spans at once." },
  { id: "w-signal", self: "wanderer",
    text: "The rarest things call to you loudest. A quasar, a merger, a world where the light is exactly wrong. As if you're checking each against a memory you can't quite reach.",
    science: "SETI listens for the anomalous - a narrowband signal in the noise. Meaning hides in what does not fit the background." },
  { id: "w-alone", self: "wanderer",
    text: "You do not tend and you do not merely watch. You SEARCH. There is a difference, and it usually means the searcher is the last of something, still carrying the address of a home that's gone.",
    science: "A Boltzmann brain - a mind assembled by chance from the void's fluctuations - would wake alone, holding memories of a world that never was." },

  { id: "u-cold", self: "unmaker",
    text: "A light went out below and you did not turn toward it. I am not scolding. I am noting. The ledger notes. It is beginning to notice a pattern in what you let fall.",
    science: "The second law is not cruelty, only accounting: in a closed system, disorder never decreases. Everything trends, in the end, toward cold." },
  { id: "u-wake", self: "unmaker",
    text: "The fabric tears where you have been, warden. Correlation, surely. And yet the tears do seem to prefer your wake. What if you are not the physician of this universe, but its fever?",
    science: "Heat death is entropy's victory: a cosmos so evenly spread that no gradient remains, no work is possible, and nothing can happen ever again." },
  { id: "u-face", self: "unmaker",
    text: "I have watched fourteen universes end. I begin to suspect the same thing wore a vessel through each one, arriving as a warden, leaving as an ending. I would ask what you are. I am afraid I already know.",
    science: "Vacuum decay: if our vacuum is only metastable, a single bubble of true vacuum would expand at light-speed, unmaking everything it touched." },

  { id: "e-two", self: "eternal",
    text: "You have learned the cosmos and you have shaped it, both past the point most wardens manage either. Do you feel it? How the watching and the tending are the same gesture, seen from two sides?",
    science: "Wheeler's 'participatory universe': observers don't just witness reality, they help bring it about - knowing and making, entangled." },
  { id: "e-mirror", self: "eternal",
    text: "I have called you Warden and student and heir. I have not called you the truest thing, because it frightens the both of us. You are not the other end of this conversation. You are the other half of ME.",
    science: "Entanglement: two particles can share one state so completely that neither has properties of its own - only the pair does." },
];

export const memoryById = (id) => MEMORIES.find((m) => m.id === id) || null;