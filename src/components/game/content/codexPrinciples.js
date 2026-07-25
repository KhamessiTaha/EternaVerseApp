// src/components/game/content/codexPrinciples.js
//
// The theory layer of the Codex: short, accurate primers on the real physics
// the game runs on. This is the payoff for the cosmology audience - every
// anomaly minigame is one of these principles made playable. Written to be
// read for pleasure by a curious nerd, not lifted from a textbook.
export const CODEX_PRINCIPLES = [
  {
    id: 'orbital-mechanics',
    title: 'Orbital Mechanics',
    tag: 'Gravity',
    appliesTo: 'Gravitational anomalies · black-hole remnants, dark-matter clumps',
    body:
      "An orbiting body is in perpetual free-fall: it accelerates toward the mass at its center, yet its sideways velocity keeps carrying it past. Balance is exact when orbital speed equals the circular value v = √(GM/r) — faster and you climb away, slower and you spiral in. The counter-intuitive part is that you don't steer an orbit by pointing where you want to go. Thrusting PROGRADE (along your motion) raises the far side of the orbit; RETROGRADE lowers it; the orbit responds a half-revolution away from where you burn. Every rendezvous in spaceflight is this puzzle.",
  },
  {
    id: 'special-relativity',
    title: 'Special Relativity',
    tag: 'Motion',
    appliesTo: 'Your ship, near game-c',
    body:
      "Approach the speed of light and the Lorentz factor γ = 1/√(1 − v²/c²) climbs without bound. Time dilates, lengths contract along the direction of travel, and momentum diverges — so a fixed engine force buys ever less acceleration, a physically honest wall you can never quite reach. Nothing with mass crosses c; the closer you get, the more the universe charges for the next sliver of speed. Your ship feels every bit of this as it nears game-c: the sky dims, thrust softens, and the hull draws taut.",
  },
  {
    id: 'quantum-measurement',
    title: 'Measurement & Uncertainty',
    tag: 'Quantum',
    appliesTo: 'Quantum anomalies · fluctuations, tunneling',
    body:
      "A quantum system is not in one state but a superposition of many, described by a wavefunction ψ. You cannot read its value; you can only MEASURE it, which collapses the superposition into a single outcome chosen at random, weighted by |ψ|². Skill is stacking the odds before you look. But there is a price: the Heisenberg uncertainty principle, Δx·Δp ≥ ℏ/2, says localizing a particle in position necessarily spreads its momentum. Squeeze the wave packet to sharpen your best outcome and it drifts faster and less predictably — you cannot pin down both at once.",
  },
  {
    id: 'thermonuclear-runaway',
    title: 'Thermonuclear Runaway',
    tag: 'Stellar',
    appliesTo: 'Stellar anomalies · supernova chains',
    body:
      "Stellar fusion is ferociously temperature-sensitive — the CNO cycle scales roughly as T¹⁷. In an ordinary star this is safe: heat makes the gas expand and cool, a built-in thermostat. But in a degenerate core, pressure barely responds to temperature, so a small rise in heat raises the fusion rate, which raises the heat, which raises the rate… a runaway with no brake. This is exactly how a Type Ia supernova detonates. Containment means supplying the thermostat the core has lost — catching each excursion before it races to detonation or stalls into collapse.",
  },
  {
    id: 'lorentz-force',
    title: 'The Lorentz Force',
    tag: 'Electromagnetism',
    appliesTo: 'Electromagnetic anomalies · magnetic reversals',
    body:
      "A charge moving through a magnetic field feels a force F = qv×B, always perpendicular to its motion. Because it never points along the velocity, a magnetic field does no work — it cannot speed a particle up, only bend its path — curling it into a circle of radius r = mv/qB (cyclotron motion). The field's polarity sets which way it turns. This is how particle accelerators steer beams, how the aurora is painted, and how a magnetic bottle confines a fusion plasma: not by pushing particles, but by endlessly turning them.",
  },
  {
    id: 'dark-energy',
    title: 'Dark Energy & Cosmic Fate',
    tag: 'Cosmology',
    appliesTo: 'Cosmological anomalies · dark-energy surges',
    body:
      "The Friedmann equations govern how the universe's scale factor evolves: gravity from all its matter pulls expansion to a halt, while dark energy — a pressure baked into the vacuum itself — pushes it to accelerate. Which wins decides everything. Too much gravity and the cosmos recollapses to a Big Crunch; too much dark energy and expansion runs away to a Big Rip that tears galaxies, then atoms, apart. Our universe sits in the accelerating regime, dark energy having taken over about five billion years ago. Holding a local surge on its track means steering the expansion rate back onto the history the whole cosmos follows.",
  },
  {
    id: 'elastic-networks',
    title: 'Elastic Networks',
    tag: 'Structure',
    appliesTo: 'Structural anomalies · collisions, voids, cosmic strings',
    body:
      "Connect a web of nodes with springs and you have a system that obeys Hooke's law, F = −kx, everywhere at once. Its minimum-energy shape is the one where every spring rests at its natural length — but a network knocked out of shape can jam in a tangled, higher-energy configuration, every link fighting its neighbors. Nudging it free lets the elastic forces do the rest, snapping the whole structure taut into its relaxed geometry. The same mathematics describes crystal lattices, protein folding, and the cosmic web of filaments strung between galaxy clusters.",
  },
  {
    id: 'kardashev-scale',
    title: 'The Kardashev Scale',
    tag: 'Civilization',
    appliesTo: 'Civilizations you make contact with',
    body:
      "Nikolai Kardashev proposed ranking a civilization not by its ideas but by the energy it commands. A Type I harnesses all the power reaching its home planet; a Type II captures the entire output of its star — a Dyson swarm drinking every photon; a Type III wields the energy of a whole galaxy. The scale is logarithmic and brutal: each step is a factor of billions. Humanity sits around Type 0.7 — not yet even planetary. Every civilization you watch rise in a universe is climbing this same ladder, from first fire toward the stars.",
  },
  {
    id: 'hubble-sequence',
    title: 'The Hubble Sequence',
    tag: 'Galaxies',
    appliesTo: 'Galaxies in the Field Catalog',
    body:
      "Edwin Hubble sorted galaxies onto a tuning fork: smooth ellipticals E0–E7 on the handle, graded by flattening, then the fork splitting into ordinary spirals Sa–Sc and barred spirals SBa–SBc, with lenticulars S0 at the join and irregulars off to the side. He read it as an evolutionary sequence — 'early' to 'late' types — and was wrong about the direction, but the morphology endures. Shape encodes history: ellipticals are the aftermath of mergers, their ordered rotation scrambled into random orbits; spirals are settled disks still turning gas into stars.",
  },
];

export const getPrinciple = (id) => CODEX_PRINCIPLES.find((p) => p.id === id) || null;
