// src/components/game/content/achievements.js
//
// Display-only mirror of the backend's utils/achievements.js catalog. The
// server is the sole authority on WHEN an achievement unlocks (it evaluates
// live universe state) - this file only supplies title/description/tier
// for rendering ids the server hands back.

export const ACHIEVEMENT_CATALOG = [
  { id: "genesis", tier: "bronze", title: "Genesis", description: "Witness the formation of the first galaxy." },
  { id: "first-light", tier: "bronze", title: "First Light", description: "Witness the ignition of the first star." },
  { id: "cradle-of-life", tier: "bronze", title: "Cradle of Life", description: "Witness the emergence of life." },
  { id: "not-alone", tier: "silver", title: "Not Alone", description: "Witness the rise of the first civilization." },
  { id: "stellar-age", tier: "bronze", title: "Stellar Age", description: "Reach a Population I stellar era." },
  { id: "cambrian-explosion", tier: "silver", title: "Cambrian Explosion", description: "Reach a complex-life era." },
  { id: "singularity", tier: "gold", title: "Singularity", description: "Witness a technological singularity." },
  { id: "great-filter", tier: "gold", title: "The Great Filter", description: "Witness a civilization pass the great filter." },
  { id: "ascension", tier: "platinum", title: "Ascension", description: "Witness a civilization transcend." },
  { id: "diplomat", tier: "silver", title: "Diplomat", description: "Observe 3 civilizations in a single universe." },
  { id: "benefactor", tier: "silver", title: "Benefactor", description: "Successfully uplift civilizations 3 times." },
  { id: "peacemaker", tier: "silver", title: "Peacemaker", description: "Pacify civilizations 3 times." },
  { id: "archivist", tier: "bronze", title: "Archivist", description: "Catalog 25 discoveries in a single universe." },
  { id: "taxonomist", tier: "gold", title: "Taxonomist", description: "Discover 8 distinct object classes." },
  { id: "anomaly-hunter", tier: "silver", title: "Anomaly Hunter", description: "Resolve 10 anomalies in a single universe." },
  { id: "well-equipped", tier: "gold", title: "Well Equipped", description: "Max every ship upgrade track." },
  { id: "on-mission", tier: "bronze", title: "On Mission", description: "Claim 5 objectives." },
  { id: "veteran-observer", tier: "silver", title: "Veteran Observer", description: "Guide a universe past 10 billion years." },
];

export const ACHIEVEMENT_MAP = Object.fromEntries(ACHIEVEMENT_CATALOG.map((a) => [a.id, a]));

export const TIER_STYLE = {
  starter: { text: "text-ink-faint", border: "border-line-bright" },
  bronze: { text: "text-[#c68a4a]", border: "border-[#c68a4a]/40" },
  silver: { text: "text-[#adb2c4]", border: "border-[#adb2c4]/40" },
  gold: { text: "text-accent", border: "border-accent/40" },
  platinum: { text: "text-good", border: "border-good/40" },
};
