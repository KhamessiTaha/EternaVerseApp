// src/components/game/content/insights.js
//
// Insight chains: sets of Memories that share a real-science thread. Recover
// every Memory in a chain and the Curator connects the dots - a burst of
// Recollection and a logged Insight. Each pole has one completable on its own
// lean; "The Two Halves" is the secret, reachable only via the deep+balanced
// Eternal path (its memories only surface to a warden who explored AND mastered).
export const INSIGHTS = [
  {
    id: "participatory",
    title: "The Participatory Universe",
    memoryIds: ["o-witness", "o-eye", "o-horizon"],
    text: "Measurement, mind, and horizon - you've connected them. To observe is not to stand apart from the cosmos but to help decide it. The eye and the seen are one act. You have understood the deepest strangeness of physics and, I think, of yourself.",
  },
  {
    id: "inheritance",
    title: "The Long Inheritance",
    memoryIds: ["g-tend", "g-forward", "g-heir"],
    text: "Tending, smuggling life past the ending, being tended in turn - it forms a chain, doesn't it? Each caretaker made by the last, each universe seeded from the one before. You are one link in an inheritance older than time itself.",
  },
  {
    id: "signal",
    title: "The Last Signal",
    memoryIds: ["w-deep", "w-signal", "w-alone"],
    text: "The descending, the anomalous call, the loneliness of the searcher - together they spell it out. You are looking for a listener. Somewhere in you is a message and the terrible patience of the last one left to carry it.",
  },
  {
    id: "accounting",
    title: "The Cold Accounting",
    memoryIds: ["u-cold", "u-wake", "u-face"],
    text: "The cold, the tearing wake, the face in the pattern - you've done the sum. Entropy is not malice, only arithmetic, and the arithmetic keeps arriving wherever you do. Some truths are worse for being understood clearly.",
  },
  {
    id: "two-halves",
    title: "The Two Halves",
    memoryIds: ["e-two", "e-mirror"],
    text: "You held both halves at once and saw the seam. The watcher and the wanderer, the knowing and the making - entangled, never truly two. This is the secret under all the others, and you found it the only way it can be found: by being enough of everything to look.",
  },
];

export const insightById = (id) => INSIGHTS.find((i) => i.id === id) || null;
