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
];

export const memoryById = (id) => MEMORIES.find((m) => m.id === id) || null;