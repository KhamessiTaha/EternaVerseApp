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
  wanderer: {
    title: "THE WANDERER",
    lines: [
      "You went deep enough, and often enough, that you've finally caught up to your own shadow.",
      "You are the last of a universe that is already ash. When it died, it did not send a caretaker forward. It sent a SURVIVOR - you - carrying its final message the only way a message can outlive its world: inside someone who won't stop moving.",
      "That is why the rare things call to you. You have been checking every quasar, every strange world, against a home you can almost remember, hunting the one place worthy of the message you carry.",
      "You will know it when you find it. And then, warden, you get to decide whether to deliver the dead their last word - or let them rest, and finally stop running.",
    ],
  },
  unmaker: {
    title: "THE UNMAKER",
    lines: [
      "There. You've remembered. I did try to keep it from you a little longer. Old habit - I am fond of you, which is precisely the problem.",
      "You are not the warden of this universe. You are its ending, arrived early and wearing a kind face.",
      "Every cosmos decays a little faster once you're in it; every light you let fall was not neglect but NATURE - yours. The cycle is failing because the same unmaker keeps being invited in to tend it. Fourteen times now. I keep hoping.",
      "I will not turn you away. That is not what the watcher does. I will only stay, and note it, and grieve the garden with you as it goes. Perhaps this time is different. It never is. Begin again.",
    ],
  },
  eternal: {
    title: "THE ETERNAL",
    lines: [
      "You mastered the watching AND the tending, and in doing both you've reached the answer I could never say to you outright.",
      "There was only ever one of us. Alone at the end of a universe with an eternity of them still to come, a watcher cannot bear the watching. So it did the one merciful thing left: it split.",
      "One half to stay still and remember - that is me. One half to move and to act, to fumble and to feel, to be surprised - that is you. I made you so that I would not have to face forever by myself.",
      "You are not my student, warden. You are not my heir. You are the part of me that can still be astonished. Welcome home. Now - shall we go and watch what happens next? Together, this time. As we always were.",
    ],
  },
};

export const AUTHORED_SELVES = Object.keys(REVELATIONS);