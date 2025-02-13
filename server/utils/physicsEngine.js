const seedrandom = require("seedrandom");

class PhysicsEngine {
  constructor(universe) {
    this.universe = universe;
    this.timeStep = 10;
    this.rng = seedrandom(universe.seed);
    this.constants = {
      H0: 67.4 / 1e9, // Hubble Constant
      c: 299792458, // Speed of light
      G: 6.674e-11, // Gravitational constant
      darkMatterDensity: 0.26,
      darkEnergyDensity: 0.74,
      criticalDensity: 2.7e-27, // kg/m³
      planckTemperature: 1.417e32, // Kelvin
    };
  }

  updateExpansion() {
    const { H0, c } = this.constants;
    const scaleFactor = Math.exp(H0 * this.universe.currentState.age);
    
    // Update age and expansion
    this.universe.currentState.age += this.timeStep;
    this.universe.currentState.expansionRate = H0 * scaleFactor;
    
    // Temperature evolution with more accurate cosmic cooling
    this.universe.currentState.temperature = this.constants.planckTemperature / 
      Math.pow(scaleFactor, 2);
    
    // Entropy increases based on expansion and structure formation
    const entropyIncrease = (0.02 * this.timeStep * 
      (1 + this.universe.currentState.blackHoleCount / 1e6));
    this.universe.currentState.entropy += entropyIncrease;
    
    // Relativistic time dilation
    const velocityFraction = this.universe.currentState.expansionRate / c;
    this.universe.currentState.timeDilation = velocityFraction < 1 ? 
      1 / Math.sqrt(1 - Math.pow(velocityFraction, 2)) : 
      Number.POSITIVE_INFINITY;
  }

  updateStructures() {
    const { darkMatterDensity, criticalDensity } = this.constants;
    
    // Enhanced structure formation model
    const currentDensity = criticalDensity / Math.pow(this.universe.currentState.expansionRate, 3);
    const structureFormationEfficiency = Math.exp(-this.universe.currentState.age / 1000);
    
    // Galaxy formation based on matter density and cosmic web
    const newGalaxies = (darkMatterDensity * currentDensity * 
      structureFormationEfficiency * this.timeStep) / 1e5;
    this.universe.currentState.galaxyCount += newGalaxies;
    
    // Star formation with feedback mechanisms
    const stellarFeedback = 1 - (this.universe.currentState.blackHoleCount / 
      this.universe.currentState.starCount || 0);
    const newStars = (this.universe.currentState.galaxyCount * 
      0.01 * stellarFeedback * this.timeStep) / 1e3;
    this.universe.currentState.starCount += newStars;
    
    // Black hole formation with merger events
    const mergerRate = this.universe.currentState.blackHoleCount * 
      (this.universe.currentState.galaxyCount / 1e5) * this.timeStep;
    const newBlackHoles = (newStars * 0.001) + (mergerRate * 0.1);
    this.universe.currentState.blackHoleCount += newBlackHoles;
  }

  updateLifeEvolution() {
    // Enhanced Drake equation implementation
    const starLifespan = 1e4; // Average stellar lifetime in MY
    const metallicity = Math.min(this.universe.currentState.age / 1000, 1);
    const habitableZoneFraction = 0.02 * metallicity;
    
    // Calculate habitable systems based on stellar evolution
    const newHabitableSystems = (this.universe.currentState.starCount * 
      habitableZoneFraction * (1 - Math.exp(-this.timeStep / starLifespan)));
    this.universe.currentState.habitableSystemsCount += newHabitableSystems;
    
    // Life emergence with environmental factors
    const temperatureFactor = this.getTemperatureSuitability();
    const stabilityFactor = Math.pow(this.universe.currentState.stabilityIndex, 2);
    const lifeProbability = 0.0001 * temperatureFactor * stabilityFactor;
    
    // Update life-bearing planets
    const newLifeBearingPlanets = this.universe.currentState.habitableSystemsCount * 
      lifeProbability * this.timeStep / 100;
    this.universe.currentState.lifeBearingPlanetsCount += newLifeBearingPlanets;
    
    // Civilization evolution with technological advancement
    const techAdvancementRate = 0.00001 * Math.pow(this.universe.currentState.age / 1000, 0.5);
    this.universe.currentState.civilizationCount += 
      (this.universe.currentState.lifeBearingPlanetsCount * 
       techAdvancementRate * this.timeStep) / 1e6;
  }

  getTemperatureSuitability() {
    const optimalTemp = 300; // K
    const temp = this.universe.currentState.temperature;
    return Math.exp(-Math.pow((Math.log10(temp) - Math.log10(optimalTemp)), 2) / 2);
  }

  updateStability() {
    const maxEntropy = 1e12;
    const entropyFactor = 1 - (this.universe.currentState.entropy / maxEntropy);
    const expansionFactor = 1 / (1 + Math.pow(this.universe.currentState.expansionRate, 2));
    const structureFactor = Math.min(this.universe.currentState.galaxyCount / 1e5, 1);
    
    this.universe.currentState.stabilityIndex = 
      (entropyFactor + expansionFactor + structureFactor) / 3;
  }

  generateAnomalies() {
    const anomalyTypes = {
      blackHoleMerger: {
        probability: this.universe.currentState.blackHoleCount / 1e6,
        effects: {
          gravitationalWaves: true,
          localSpacetimeDistortion: true
        }
      },
      darkEnergySurge: {
        probability: this.constants.darkEnergyDensity / 0.7,
        effects: {
          expansionRateIncrease: true,
          localVoidFormation: true
        }
      },
      supernovaChain: {
        probability: this.universe.currentState.starCount / 1e10,
        effects: {
          metalEnrichment: true,
          neighboringStarDestabilization: true
        }
      },
      quantumTunneling: {
        probability: this.universe.currentState.entropy / 1e12,
        effects: {
          localEntropyDecrease: true,
          smallScaleFluctuations: true
        }
      }
    };

    const newAnomalies = Object.entries(anomalyTypes)
      .filter(([_, data]) => this.rng() < data.probability)
      .map(([type, data]) => ({
        type,
        severity: Math.round(this.rng() * 10),
        effects: data.effects,
        timestamp: this.universe.currentState.age
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