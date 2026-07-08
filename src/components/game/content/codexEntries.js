// src/components/game/content/codexEntries.js
//
// Codex flavor text - accurate astronomy, written for a curious reader.
// Keyed by objectClass; anomaly types included. This copy is a first-class
// deliverable: it is the payoff for the cosmology audience.
export const CODEX_ENTRIES = {
  E0: "A nearly spherical elliptical galaxy. Ellipticals are dynamically 'hot' - their stars swarm on randomized orbits rather than a shared disk - and shine with the amber light of old stellar populations, having exhausted most of their star-forming gas long ago.",
  E1: "A slightly flattened elliptical. The En number encodes apparent flattening: 10x(1 - b/a). Ellipticals grow through mergers, which scramble ordered rotation into random stellar orbits.",
  E2: "An elliptical with modest apparent flattening. Its smooth, featureless light profile hides one of the universe's densest central objects: virtually every large elliptical hosts a supermassive black hole.",
  E3: "A moderately flattened elliptical galaxy dominated by ancient, metal-rich stars. With little cold gas left, star formation here effectively ended billions of years ago.",
  E4: "A visibly elongated elliptical. Some apparent shapes are projection effects - a true triaxial spheroid seen edge-on - which is why classification uses statistical samples, not single images.",
  E5: "A strongly flattened elliptical, its stars supported more by anisotropic velocity dispersion than by rotation - the signature of a violent merger history.",
  E6: "A highly elongated elliptical, rare in the field and commoner in rich clusters, where repeated gravitational encounters strip gas and quench star formation.",
  E7: "The most flattened class of true elliptical. Beyond E7, disks appear and the object is classed as lenticular - the hinge of Hubble's tuning-fork diagram.",
  S0: "A lenticular galaxy: a disk like a spiral's, but smooth and armless, its star-forming gas exhausted or stripped. Lenticulars are commonest in cluster cores, where ram-pressure stripping by hot intracluster gas shuts star formation down.",
  Sa: "An early-type spiral with a dominant central bulge and tightly wound arms. The arms are density waves - traffic jams of stars and gas - not fixed structures; individual stars drift through them.",
  Sb: "An intermediate spiral balancing bulge and disk, its arms threaded with pink HII regions where new stars ionize the hydrogen around them. The Andromeda Galaxy is the classic Sb.",
  Sc: "A late-type spiral: small bulge, loose brilliant arms, prodigious star formation. The blue glow is the light of short-lived O and B stars only a few million years old.",
  SBa: "A barred spiral with a prominent stellar bar and tightly wound arms. The bar is a self-sustaining stellar wave that funnels gas toward the nucleus - fuel for starbursts and black-hole growth.",
  SBb: "A barred spiral of intermediate wind. Bars are common - roughly two-thirds of nearby disk galaxies show one, including the Milky Way, an SBbc.",
  SBc: "A loosely wound barred spiral, all disk and bar with barely a bulge - vigorous star formation strung along open, ragged arms.",
  Irr: "An irregular galaxy with no coherent disk or spheroid - often the debris of tidal interactions, or a dwarf too small to organize its gas. The Magellanic Clouds are the local archetypes.",
  nebula: "A vast cloud of interstellar gas and dust glowing in emission lines - hydrogen's red H-alpha above all - energized by the ultraviolet light of hot young stars embedded within it. Stellar nurseries and stellar graveyards alike take this form.",
  quasar: "A quasi-stellar object: the blazing accretion disk of a supermassive black hole devouring matter at the center of a distant galaxy, outshining its hundred billion stars from a region not much larger than the solar system. The relativistic jets can stretch for hundreds of thousands of light-years.",
  merger: "Two galaxies caught in the act of collision. Stars almost never touch - the gulfs between them are too vast - but gas clouds slam together, igniting starbursts, while tidal forces draw out immense bridges and tails of stars.",
  // Anomaly intel entries
  blackHoleMerger: "Scan telemetry of an ongoing black-hole merger: two event horizons in a death spiral, radiating orbital energy as gravitational waves that ring spacetime like a struck bell.",
  darkEnergySurge: "A localized fluctuation in vacuum energy density. Dark energy - the accelerant of cosmic expansion - is uniform to exquisite precision; a surge like this should not be possible, which is precisely why it must be contained.",
  supernovaChain: "A cascade of core-collapse supernovae propagating through a star-forming region: each blast wave compresses neighboring clouds past the Jeans limit, triggering the next generation of doomed massive stars.",
  quantumFluctuation: "A macroscopic quantum vacuum instability - virtual particle pairs failing to annihilate on schedule. Local entropy runs backward in pockets, which the second law of thermodynamics takes personally.",
  galacticCollision: "Intel on a major galactic collision in progress: tidal disruption on a hundred-kiloparsec scale, star formation flaring along the shock fronts.",
  cosmicVoid: "An expanding underdense region - matter streaming away toward surrounding filaments and walls. Voids are the universe's dominant volume; this one is growing faster than structure formation allows.",
  magneticReversal: "A galaxy-scale magnetic field reversing polarity. Galactic dynamos ordinarily evolve over billions of years; a reversal this fast disrupts cosmic-ray confinement and stellar-wind boundaries across the disk.",
  darkMatterClump: "A dark-matter density spike detectable only by its gravitational lensing signature. Whatever dark matter is - and it is five-sixths of all matter - it does not usually clump this hard.",
  cosmicString: "A candidate topological defect: a one-dimensional fault line in spacetime left over from a symmetry-breaking phase transition in the first instants after the Big Bang. Width: subatomic. Mass per kilometer: mountainous.",
  quantumTunneling: "A region exhibiting macroscopic quantum tunneling - matter crossing classically forbidden energy barriers in bulk. Vacuum decay scenarios begin with exactly this signature.",
};

export const getCodexEntry = (objectClass) =>
  CODEX_ENTRIES[objectClass] ??
  "An uncataloged phenomenon. Observational data insufficient - further study required.";
