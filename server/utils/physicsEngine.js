const seedrandom = require("seedrandom");

class PhysicsEngine {
  constructor(universe) {
    this.universe = universe;
    this.timeStep = 1e9; // 1 million years per step
    this.rng = seedrandom(universe.seed);
    this.constants = {
      H0: 67.4 / (3.09e19), // Hubble Constant in per second
      c: 299792458, // Speed of light
      G: 6.674e-11, // Gravitational constant
      darkMatterDensity: 0.26,
      darkEnergyDensity: 0.74,
      criticalDensity: 8.62e-27, // kg/m³
      planckTemperature: 1.417e32, // Kelvin
      observableGalaxies: 2e12, // Approximate number of galaxies in observable universe
      averageStarsPerGalaxy: 1e11, // Average stars per galaxy
    };
  }

  updateExpansion() {
    const { H0, c } = this.constants;
    
    // Update age in years
    this.universe.currentState.age += this.timeStep;
    
    // Calculate scale factor (normalized to current time)
    const scaleFactor = Math.exp(H0 * this.universe.currentState.age * 365.25 * 24 * 3600);
    
    // Update expansion rate (H(t) = H0 * sqrt(Ωm/a³ + ΩΛ))
    const matterTerm = this.constants.darkMatterDensity / Math.pow(scaleFactor, 3);
    const darkEnergyTerm = this.constants.darkEnergyDensity;
    this.universe.currentState.expansionRate = H0 * Math.sqrt(matterTerm + darkEnergyTerm);
    
    // Temperature evolution (T ∝ 1/a)
    this.universe.currentState.temperature = 2.725 / scaleFactor; // Starting from current CMB temperature
    
    // Entropy increases logarithmically with universe expansion
    this.universe.currentState.entropy += Math.log(1 + (this.timeStep / this.universe.currentState.age));
  }

  updateStructures() {
    const age = this.universe.currentState.age;
    
    // No structure formation before 100 million years
    if (age < 1e8) return;
    
    // Galaxy formation rate (peaks at 2-3 billion years, then declines)
    const galaxyPeakAge = 2.5e9;
    const galaxyFormationRate = Math.exp(-(Math.pow(age - galaxyPeakAge, 2) / (2 * Math.pow(2e9, 2))));
    
    // Target total galaxies based on observable universe
    const targetGalaxies = this.constants.observableGalaxies * 
      Math.min(Math.pow(age / 13.8e9, 3), 1); // Scale based on current universe age
    
    // Smooth approach to target galaxy count
    const galaxyDelta = (targetGalaxies - this.universe.currentState.galaxyCount) * 
      (galaxyFormationRate * this.timeStep / 1e9);
    this.universe.currentState.galaxyCount += Math.max(0, galaxyDelta);
    
    // Star formation rate (peaks around 10 billion years)
    const starPeakAge = 10e9;
    const starFormationRate = Math.exp(-(Math.pow(age - starPeakAge, 2) / (2 * Math.pow(5e9, 2))));
    
    // Target stars based on average per galaxy
    const targetStars = this.universe.currentState.galaxyCount * 
      this.constants.averageStarsPerGalaxy;
    
    const starDelta = (targetStars - this.universe.currentState.starCount) * 
      (starFormationRate * this.timeStep / 1e9);
    this.universe.currentState.starCount += Math.max(0, starDelta);
    
    // Black hole formation (approximately 0.01% of stars end up as black holes)
    this.universe.currentState.blackHoleCount = this.universe.currentState.starCount * 0.0001;
  }

  updateLifeEvolution() {
    const age = this.universe.currentState.age;
    
    // No life before 1 billion years
    if (age < 1e9) return;
    
    // Metallicity builds up over time
    const metallicity = Math.min((age - 1e9) / 1e10, 1);
    
    // Only 1% of stars might support habitable zones
    const habitableZoneFraction = 0.01 * metallicity;
    
    // Calculate habitable systems
    this.universe.currentState.habitableSystemsCount = 
      this.universe.currentState.starCount * habitableZoneFraction;
    
    // Extremely rare chance for life to emerge (1 in 1 billion habitable systems)
    const lifeProbability = 1e-9 * this.getTemperatureSuitability() * metallicity;
    
    // Calculate life-bearing planets
    this.universe.currentState.lifeBearingPlanetsCount = 
      this.universe.currentState.habitableSystemsCount * lifeProbability;
    
    // Even rarer chance for civilizations (1 in 1 billion life-bearing planets)
    const civProbability = 1e-9;
    this.universe.currentState.civilizationCount = 
      Math.floor(this.universe.currentState.lifeBearingPlanetsCount * civProbability);
  }

  getTemperatureSuitability() {
    const temp = this.universe.currentState.temperature;
    const optimalTemp = 300; // K
    return Math.exp(-Math.pow((temp - optimalTemp) / 100, 2));
  }

  updateStability() {
    const age = this.universe.currentState.age;
    
    // Stability decreases very slowly over time due to entropy increase
    const entropyFactor = Math.exp(-this.universe.currentState.entropy / 1e12);
    
    // Structure formation contributes to stability
    const structureFactor = Math.min(this.universe.currentState.galaxyCount / 
      this.constants.observableGalaxies, 1);
    
    // Dark energy becomes more dominant over time
    const darkEnergyFactor = Math.exp(-age / 1e14);
    
    this.universe.currentState.stabilityIndex = 
      (entropyFactor + structureFactor + darkEnergyFactor) / 3;
  }

  generateAnomalies() {
    // Only generate anomalies every 100 million years on average
    if (this.rng() > this.timeStep / 1e8) return;
    
    const anomalyTypes = {
      blackHoleMerger: {
        probability: 0.4 * (this.universe.currentState.blackHoleCount / 1e8),
        effects: { gravitationalWaves: true }
      },
      darkEnergySurge: {
        probability: 0.1 * this.constants.darkEnergyDensity,
        effects: { expansionRateIncrease: true }
      },
      supernovaChain: {
        probability: 0.3 * (this.universe.currentState.starCount / 1e12),
        effects: { metalEnrichment: true }
      },
      quantumTunneling: {
        probability: 0.2,
        effects: { localEntropyDecrease: true }
      }
    };

    const newAnomalies = Object.entries(anomalyTypes)
      .filter(([_, data]) => this.rng() < data.probability)
      .map(([type, data]) => ({
        _id: new mongoose.Types.ObjectId(), // ✅ assign unique id
        type,
        severity: Math.round(this.rng() * 10),
        effects: data.effects,
        timestamp: new Date(this.universe.currentState.age * 1000),
        resolved: false,
        location: {
          x: this.rng() * 10000 - 5000,
          y: this.rng() * 10000 - 5000
        }
      }));
    this.universe.anomalies = [...this.universe.anomalies, ...newAnomalies];
  }

  simulateStep() {
    this.updateExpansion();
    this.updateStructures();
    this.updateLifeEvolution();
    this.updateStability();
    this.generateAnomalies();
    return this.universe;
  }
}

module.exports = PhysicsEngine;