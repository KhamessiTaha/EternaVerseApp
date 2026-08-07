// src/components/game/content/revelations.js
//
// The summit payoff: when your Memories resolve, the Curator names what the
// presence in the vessel IS. v1 authors the two opposite poles. Adding a self
// later is just another key here (+ its memories).
export const REVELATIONS = {
  observer: {
    title: "THE OBSERVER",
    lines: [
      "So. You've gathered enough of yourself to hold the question and not flinch.",
      "You were never the pilot of this vessel, warden. You are what looks THROUGH it.",
      "A universe unobserved is only a held breath - possibility that never has to choose. You are the eye it grew so it could exhale into being. You do not watch the cosmos. You are the reason there is one to watch.",
      "Every galaxy you named, you called out of the maybe and into the real. Keep looking. It only exists as far as you can see.",
    ],
  },
  gardener: {
    title: "THE GARDENER",
    lines: [
      "You've remembered enough to bear the weight of it. Good. You'll need to.",
      "You are not from here. You are what the LAST universe sent forward when it knew it was dying - a caretaker, packed into a vessel, aimed at the dark.",
      "Every people you lift toward the stars is cargo you're carrying past an ending that already happened once. That is why you cannot leave a light to go out. It isn't mercy. It's the mission you were made from.",
      "I know, because something made me the same way. Welcome, heir. There is a great deal of garden left.",
    ],
  },
};

export const AUTHORED_SELVES = Object.keys(REVELATIONS);