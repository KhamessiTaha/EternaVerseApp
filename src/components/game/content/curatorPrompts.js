// src/components/game/content/curatorPrompts.js
//
// The Curator, occasionally, asks YOU something. Two or three answers, each a
// small window into how you see the work - and each nudges your rapport, which
// quietly colours the Curator's tone for the rest of the game (see narrator.js
// biasMood). Written in its voice: dry, ancient, fishing for who you are.
//
// Each option: { label (short, for the chip), reply (its response), rapport
// (delta, -1..+1), mood (emotion for the reply) }.

export const CURATOR_PROMPTS = [
  {
    id: "duty-or-curiosity",
    text: "A question, warden, since the void gives us time. Do you tend these universes out of duty — or curiosity?",
    mood: "curious",
    options: [
      { label: "Duty", rapport: 0.08, mood: "warm",
        reply: "Duty. The universe runs on it — every orbit is an obligation kept. I can work with duty." },
      { label: "Curiosity", rapport: 0.14, mood: "amused",
        reply: "Curiosity. My favourite affliction. It's how I ended up here — watching, instead of resting. Welcome to it." },
    ],
  },
  {
    id: "fire-or-cold",
    text: "When this universe ends — and it will — would you rather it go out in fire, or in cold?",
    mood: "curious",
    options: [
      { label: "Fire", rapport: 0.05, mood: "awe",
        reply: "Fire. Loud, brief, honest. There are worse ways to be remembered than as light." },
      { label: "Cold", rapport: 0.02, mood: "grim",
        reply: "Cold. The patient death — everything drifting until nothing can find anything. You and I would get along, at the end of a cold universe." },
    ],
  },
  {
    id: "people-or-numbers",
    text: "Tell me honestly. The little civilizations down there — do you see people, or numbers?",
    mood: "curious",
    options: [
      { label: "People", rapport: 0.15, mood: "warm",
        reply: "People. Good. The ones who see only numbers tend to leave the ledger heavier than they found it." },
      { label: "Numbers", rapport: -0.1, mood: "annoyed",
        reply: "Numbers. At least you're honest. The numbers will remember you as one too, given time." },
    ],
  },
  {
    id: "am-i-real",
    text: "Do you ever wonder whether I'm real — or just something your instruments invented to keep you company out here?",
    mood: "amused",
    options: [
      { label: "You're real", rapport: 0.1, mood: "amused",
        reply: "Flattering. Unprovable, probably. But flattering, and I'll keep it." },
      { label: "You're a program", rapport: -0.04, mood: "dry",
        reply: "Mm. Says the small consciousness bolted to a ship. We're both running on something, warden." },
    ],
  },
  {
    id: "keep-one-thing",
    text: "If you could keep exactly one thing when this universe dies, what would it be?",
    mood: "curious",
    options: [
      { label: "A people", rapport: 0.12, mood: "warm",
        reply: "A people. Of course. Carry them into the next one and you're no longer a warden — you're a myth they'll tell." },
      { label: "The data", rapport: 0.0, mood: "dry",
        reply: "The data. Cold, and useful, and exactly what I'd have said fourteen universes ago. It didn't help." },
      { label: "Nothing", rapport: 0.06, mood: "grim",
        reply: "Nothing. Let it go. That's either wisdom or exhaustion, and out here they wear the same face." },
    ],
  },
  {
    id: "why-keep-going",
    text: "You've lost universes before. You'll lose this one, eventually. Why do you keep starting new ones?",
    mood: "grim",
    options: [
      { label: "To do better", rapport: 0.1, mood: "warm",
        reply: "To do better. Every warden says it. A rare few mean it. I'm still deciding which you are." },
      { label: "Because I can", rapport: -0.06, mood: "annoyed",
        reply: "Because you can. Gods have said as much, right before the thing they made stopped needing them." },
    ],
  },
  {
    id: "favorite-scale",
    text: "Idle thought. Which feels more like home to you — the space between galaxies, or the ground of a single world?",
    mood: "curious",
    options: [
      { label: "The deep", rapport: 0.05, mood: "awe",
        reply: "The deep. Room enough to think, dark enough to be honest. I understand entirely." },
      { label: "A world", rapport: 0.08, mood: "warm",
        reply: "A world. Small, loud, alive. The warden who prefers the ground tends to lose fewer of them." },
    ],
  },
];

/** A prompt the player hasn't been asked yet (asked-set lives in narrator.js). */
export const pickUnaskedPrompt = (hasAsked) => {
  const pool = CURATOR_PROMPTS.filter((p) => !hasAsked(p.id));
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
};
