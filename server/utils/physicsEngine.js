const seedrandom = require("seedrandom");
const mongoose = require("mongoose");

/**
 * Physics Engine for Universe Simulation
 * Handles global cosmic-scale anomalies that affect universe metrics
 * These are NOT rendered as map markers - they're simulation events only
 */
class PhysicsEngine {
  constructor(universe) {
    this.universe = universe;
    this.timeStep = 1e8; // 100 million years per step
    this.rng = seedrandom(universe.seed);
    
    this.constants = {
      H0: 67.4 / 3.09e19, // Hubble constant in per second
      c: 299792458, // Speed of light (m/s)
      G: 6.674e-11, // Gravitational constant
      darkMatterDensity: 0.26, // Ωm
      darkEnergyDensity: 0.69, // ΩΛ (updated value)
      baryonicDensity: 0.05, // Ωb
      criticalDensity: 8.62e-27, // kg/m³
      planckTemperature: 1.417e32, // Kelvin
      observableGalaxies: 2e12,
      averageStarsPerGalaxy: 1e11,
      solarMass: 1.989e30, // kg
    };

    // Initialize simulation state if not present
    if (!this.universe.currentState) {
      this.universe.currentState = {
        age: 0,
        expansionRate: this.constants.H0,
        temperature: this.constants.planckTemperature,
        entropy: 0,
        galaxyCount: 0,
        starCount: 0,
        blackHoleCount: 0,
        habitableSystemsCount: 0,
        lifeBearingPlanetsCount: 0,
        civilizationCount: 0,
        stabilityIndex: 1.0,
        totalMass: 0,
        totalEnergy: 0
      };
    }
  }

  /**
   * Update cosmic expansion using Friedmann equation
   */
  updateExpansion() {
    const { H0, darkMatterDensity, darkEnergyDensity, baryonicDensity } = this.constants;
    
    this.universe.currentState.age += this.timeStep;
    const ageInSeconds = this.universe.currentState.age * 365.25 * 24 * 3600;
    
    // Scale factor: a(t) = exp(H0 * t) for exponential expansion
    const scaleFactor = Math.exp(H0 * ageInSeconds);
    
    // Friedmann equation: H(t)² = H0² * (Ωm/a³ + ΩΛ)
    const matterTerm = (darkMatterDensity + baryonicDensity) / Math.pow(scaleFactor, 3);
    const darkEnergyTerm = darkEnergyDensity;
    const currentHubble = H0 * Math.sqrt(matterTerm + darkEnergyTerm);
    
    this.universe.currentState.expansionRate = currentHubble;
    
    // CMB temperature evolution: T(t) = T0 / a(t)
    // Current CMB is 2.725 K at 13.8 Gyr
    const currentAge = 13.8e9; // years
    const T0 = 2.725 * Math.exp(H0 * currentAge * 365.25 * 24 * 3600);
    this.universe.currentState.temperature = T0 / scaleFactor;
    
    // Entropy increases with expansion
    this.universe.currentState.entropy += Math.log(scaleFactor) * 1e10;
  }

  /**
   * Update structure formation (galaxies, stars, black holes)
   */
  updateStructures() {
    const age = this.universe.currentState.age;
    
    // No structure formation before recombination (~380,000 years)
    if (age < 3.8e5) return;
    
    // Galaxy formation rate (peaks at 2-3 billion years)
    const galaxyPeakAge = 2.5e9;
    const galaxyWidth = 2e9;
    const galaxyFormationRate = Math.exp(-Math.pow((age - galaxyPeakAge) / galaxyWidth, 2));
    
    // Asymptotic approach to target galaxy count
    const targetGalaxies = this.constants.observableGalaxies * 
      Math.min(Math.pow(age / 13.8e9, 2), 1);
    
    const galaxyGrowthRate = (targetGalaxies - this.universe.currentState.galaxyCount) * 
      galaxyFormationRate * (this.timeStep / 1e9);
    
    this.universe.currentState.galaxyCount += Math.max(0, galaxyGrowthRate);
    
    // Star formation rate (peaks around 3.5 billion years, declines after)
    const starPeakAge = 3.5e9;
    const starWidth = 4e9;
    const starFormationRate = Math.exp(-Math.pow((age - starPeakAge) / starWidth, 2));
    
    const targetStars = this.universe.currentState.galaxyCount * 
      this.constants.averageStarsPerGalaxy;
    
    const starGrowthRate = (targetStars - this.universe.currentState.starCount) * 
      starFormationRate * (this.timeStep / 1e9);
    
    this.universe.currentState.starCount += Math.max(0, starGrowthRate);
    
    // Black hole formation: ~0.01% of massive stars (>20 solar masses)
    // Assume 1% of stars are massive enough
    const massiveStarFraction = 0.01;
    const blackHoleProbability = 0.1; // 10% of massive stars become black holes
    
    this.universe.currentState.blackHoleCount = 
      this.universe.currentState.starCount * massiveStarFraction * blackHoleProbability;
    
    // Update total mass estimate
    const avgStarMass = 0.5 * this.constants.solarMass; // Average star is ~0.5 solar masses
    this.universe.currentState.totalMass = 
      this.universe.currentState.starCount * avgStarMass;
  }

  /**
   * Update life evolution metrics
   */
  updateLifeEvolution() {
    const age = this.universe.currentState.age;
    
    // Life requires:
    // 1. Stars with planetary systems (>1 Gyr for metallicity)
    // 2. Suitable temperature range
    // 3. Time for evolution (>3 Gyr)
    
    if (age < 1e9) return;
    
    // Metallicity builds up over time as stars die and enrich ISM
    const metallicity = Math.min((age - 1e9) / 1e10, 1);
    
    // Habitable zone fraction increases with metallicity
    // Rocky planets need metals
    const habitableZoneFraction = 0.02 * metallicity; // 2% at full metallicity
    
    this.universe.currentState.habitableSystemsCount = 
      this.universe.currentState.starCount * habitableZoneFraction;
    
    // Life emergence probability (Drake equation inspired)
    // Very conservative estimates
    const temperatureSuitability = this.getTemperatureSuitability();
    const timeFactor = Math.min((age - 3e9) / 1e10, 1); // Life needs time
    const lifeProbability = 1e-8 * temperatureSuitability * metallicity * timeFactor;
    
    this.universe.currentState.lifeBearingPlanetsCount = 
      this.universe.currentState.habitableSystemsCount * lifeProbability;
    
    // Civilization emergence (even rarer)
    // Requires: complex life + intelligence + technology
    if (age > 5e9) {
      const civProbability = 1e-6; // 1 in a million life-bearing planets
      this.universe.currentState.civilizationCount = 
        Math.floor(this.universe.currentState.lifeBearingPlanetsCount * civProbability);
    }
  }

  /**
   * Calculate temperature suitability for life (0-1)
   */
  getTemperatureSuitability() {
    const temp = this.universe.currentState.temperature;
    const optimalTemp = 300; // K (Earth-like)
    const tolerance = 100; // K
    
    // Gaussian falloff around optimal temperature
    return Math.exp(-Math.pow((temp - optimalTemp) / tolerance, 2));
  }

  /**
   * Update overall universe stability index
   */
  updateStability() {
    const age = this.universe.currentState.age;
    
    // Factors affecting stability:
    
    // 1. Entropy (increases = less stable)
    const entropyFactor = Math.exp(-this.universe.currentState.entropy / 1e14);
    
    // 2. Structure formation (organized matter = more stable)
    const expectedGalaxies = this.constants.observableGalaxies * 
      Math.min(age / 13.8e9, 1);
    const structureFactor = Math.min(
      this.universe.currentState.galaxyCount / Math.max(expectedGalaxies, 1), 
      1
    );
    
    // 3. Dark energy dominance (causes accelerated expansion = less stable long-term)
    const scaleFactor = Math.exp(this.constants.H0 * age * 365.25 * 24 * 3600);
    const matterDensity = this.constants.darkMatterDensity / Math.pow(scaleFactor, 3);
    const darkEnergyDensity = this.constants.darkEnergyDensity;
    const densityRatio = matterDensity / (matterDensity + darkEnergyDensity);
    const darkEnergyFactor = densityRatio; // Higher matter ratio = more stable
    
    // 4. Temperature stability (extreme temps = unstable)
    const temperatureFactor = this.getTemperatureSuitability();
    
    // Combine factors (weighted average)
    this.universe.currentState.stabilityIndex = (
      entropyFactor * 0.2 +
      structureFactor * 0.3 +
      darkEnergyFactor * 0.3 +
      temperatureFactor * 0.2
    );
    
    // Clamp to [0, 1]
    this.universe.currentState.stabilityIndex = Math.max(0, 
      Math.min(1, this.universe.currentState.stabilityIndex)
    );
  }

  /**
   * Generate GLOBAL simulation anomalies (not rendered in-game)
   * These affect universe-wide metrics and are stored in DB
   */
  generateGlobalAnomalies() {
    const age = this.universe.currentState.age;
    
    // Base probability scales with universe activity
    const activityLevel = this.universe.currentState.galaxyCount / 
      this.constants.observableGalaxies;
    
    // Only generate anomalies probabilistically
    if (this.rng() > 0.01 * activityLevel) return; // 1% chance per step when active
    
    const anomalyDefinitions = {
      blackHoleMerger: {
        probability: 0.3,
        condition: () => this.universe.currentState.blackHoleCount > 1e6,
        effects: (severity) => ({
          gravitationalWaves: true,
          energyRelease: severity * 1e47, // Joules
          stabilityImpact: -0.01 * severity
        }),
        description: 'Supermassive black hole merger detected'
      },
      darkEnergySurge: {
        probability: 0.15,
        condition: () => age > 5e9,
        effects: (severity) => ({
          expansionBoost: severity * 0.001,
          stabilityImpact: -0.02 * severity
        }),
        description: 'Dark energy density fluctuation'
      },
      supernovaChain: {
        probability: 0.35,
        condition: () => this.universe.currentState.starCount > 1e20,
        effects: (severity) => ({
          metallicityIncrease: severity * 0.001,
          starDeathCount: severity * 1000,
          stabilityImpact: -0.005 * severity
        }),
        description: 'Cascading supernova events'
      },
      quantumVacuumFluctuation: {
        probability: 0.1,
        condition: () => true, // Can happen anytime
        effects: (severity) => ({
          localEntropyDecrease: -severity * 1e8,
          stabilityImpact: -0.03 * severity
        }),
        description: 'Quantum vacuum instability'
      },
      gammaRayBurst: {
        probability: 0.25,
        condition: () => this.universe.currentState.starCount > 1e19,
        effects: (severity) => ({
          energyRelease: severity * 1e44,
          radiationSpike: true,
          stabilityImpact: -0.008 * severity
        }),
        description: 'Gamma-ray burst detected'
      }
    };

    const newAnomalies = [];
    
    Object.entries(anomalyDefinitions).forEach(([type, config]) => {
      // Check probability and conditions
      if (this.rng() < config.probability && config.condition()) {
        const severity = Math.ceil(this.rng() * 10);
        const effects = config.effects(severity);
        
        const anomaly = {
          _id: new mongoose.Types.ObjectId(),
          type,
          severity,
          effects,
          description: config.description,
          timestamp: new Date(this.universe.currentState.age * 31557600000), // Convert years to ms
          resolved: false,
          isGlobal: true // Mark as global simulation anomaly
        };
        
        newAnomalies.push(anomaly);
        
        // Apply effects to universe state
        this.applyAnomalyEffects(anomaly);
      }
    });
    
    if (newAnomalies.length > 0) {
      if (!this.universe.anomalies) {
        this.universe.anomalies = [];
      }
      this.universe.anomalies.push(...newAnomalies);
    }
  }

  /**
   * Apply anomaly effects to universe state
   */
  applyAnomalyEffects(anomaly) {
    const effects = anomaly.effects;
    
    if (effects.stabilityImpact) {
      this.universe.currentState.stabilityIndex += effects.stabilityImpact;
      this.universe.currentState.stabilityIndex = Math.max(0, 
        Math.min(1, this.universe.currentState.stabilityIndex)
      );
    }
    
    if (effects.expansionBoost) {
      this.universe.currentState.expansionRate *= (1 + effects.expansionBoost);
    }
    
    if (effects.metallicityIncrease) {
      // Could track metallicity separately if needed
    }
    
    if (effects.localEntropyDecrease) {
      this.universe.currentState.entropy += effects.localEntropyDecrease;
    }
    
    if (effects.starDeathCount) {
      this.universe.currentState.starCount -= effects.starDeathCount;
      this.universe.currentState.starCount = Math.max(0, this.universe.currentState.starCount);
    }
  }

  /**
   * Main simulation step
   */
  simulateStep() {
    this.updateExpansion();
    this.updateStructures();
    this.updateLifeEvolution();
    this.updateStability();
    this.generateGlobalAnomalies();
    
    return this.universe;
  }

  /**
   * Simulate multiple steps
   */
  simulateSteps(steps = 1) {
    for (let i = 0; i < steps; i++) {
      this.simulateStep();
    }
    return this.universe;
  }

  /**
   * Get current universe statistics
   */
  getStatistics() {
    return {
      age: `${(this.universe.currentState.age / 1e9).toFixed(2)} Gyr`,
      expansionRate: `${(this.universe.currentState.expansionRate * 3.09e19).toFixed(2)} km/s/Mpc`,
      temperature: `${this.universe.currentState.temperature.toFixed(2)} K`,
      galaxies: this.universe.currentState.galaxyCount.toExponential(2),
      stars: this.universe.currentState.starCount.toExponential(2),
      blackHoles: this.universe.currentState.blackHoleCount.toExponential(2),
      civilizations: this.universe.currentState.civilizationCount,
      stability: `${(this.universe.currentState.stabilityIndex * 100).toFixed(1)}%`,
      globalAnomalies: this.universe.anomalies?.filter(a => a.isGlobal && !a.resolved).length || 0
    };
  }
}

module.exports = PhysicsEngine;