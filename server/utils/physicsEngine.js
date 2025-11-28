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
    
    // Use universe constants if available, otherwise use defaults
    this.constants = {
      H0: 67.4 / 3.09e19, // Hubble constant in per second
      c: universe.constants?.speedOfLight || 299792458,
      G: universe.constants?.gravitationalConstant || 6.67430e-11,
      darkMatterDensity: universe.constants?.darkMatterDensity || 0.26,
      darkEnergyDensity: universe.constants?.darkEnergyDensity || 0.7,
      baryonicDensity: universe.constants?.matterDensity || 0.04,
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
        expansionRate: this.constants.H0 * 3.09e19, // Convert to km/s/Mpc
        temperature: universe.initialConditions?.initialTemperature || this.constants.planckTemperature,
        entropy: 0,
        stabilityIndex: 1.0,
        timeDialation: 1.0,
        galaxyCount: 0,
        starCount: 0,
        blackHoleCount: 0,
        habitableSystemsCount: 0,
        lifeBearingPlanetsCount: 0,
        civilizationCount: 0
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
    
    // Store in km/s/Mpc (standard cosmological unit)
    this.universe.currentState.expansionRate = currentHubble * 3.09e19;
    
    // CMB temperature evolution: T(t) = T0 / a(t)
    const currentAge = 13.8e9; // years
    const T0 = 2.725 * Math.exp(H0 * currentAge * 365.25 * 24 * 3600);
    this.universe.currentState.temperature = T0 / scaleFactor;
    
    // Entropy increases with expansion (Boltzmann entropy)
    const volumeRatio = Math.pow(scaleFactor, 3);
    this.universe.currentState.entropy += Math.log(volumeRatio) * 1e12;
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
    const massiveStarFraction = 0.01;
    const blackHoleProbability = 0.1; // 10% of massive stars become black holes
    
    this.universe.currentState.blackHoleCount = 
      this.universe.currentState.starCount * massiveStarFraction * blackHoleProbability;
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
    const habitableZoneFraction = 0.02 * metallicity; // 2% at full metallicity
    
    this.universe.currentState.habitableSystemsCount = 
      this.universe.currentState.starCount * habitableZoneFraction;
    
    // Life emergence probability (Drake equation inspired)
    const temperatureSuitability = this.getTemperatureSuitability();
    const timeFactor = Math.min((age - 3e9) / 1e10, 1);
    const lifeProbability = 1e-8 * temperatureSuitability * metallicity * timeFactor;
    
    this.universe.currentState.lifeBearingPlanetsCount = 
      this.universe.currentState.habitableSystemsCount * lifeProbability;
    
    // Civilization emergence weird formula (RARE)
    if (age > 5e9) {
      const civProbability = 1e-6;
      const potentialCivs = Math.floor(
        this.universe.currentState.lifeBearingPlanetsCount * civProbability
      );
      
      this.universe.currentState.civilizationCount = potentialCivs;
      
      // Update civilizations array if needed
      this.updateCivilizations(potentialCivs);
    }
  }

  /**
   * Update civilizations array with proper typing
   */
  updateCivilizations(targetCount) {
    if (!this.universe.civilizations) {
      this.universe.civilizations = [];
    }
    
    const currentCount = this.universe.civilizations.length;
    
    if (currentCount < targetCount) {
      const newCivsNeeded = targetCount - currentCount;
      
      for (let i = 0; i < newCivsNeeded; i++) {
        const civType = this.determineCivilizationType();
        
        this.universe.civilizations.push({
          type: civType,
          location: {
            galaxyId: `galaxy_${Math.floor(this.rng() * this.universe.currentState.galaxyCount)}`,
            coordinates: {
              x: (this.rng() - 0.5) * 100000,
              y: (this.rng() - 0.5) * 100000,
              z: (this.rng() - 0.5) * 10000
            }
          },
          developmentLevel: this.rng(),
          technologicalProgress: this.rng(),
          survivability: 0.5 + this.rng() * 0.5
        });
      }
    }
  }

  /**
   * Determine civilization type based on age and random factors
   */
  determineCivilizationType() {
    const age = this.universe.currentState.age;
    const rand = this.rng();
    
    if (age < 8e9) return 'Type0'; // Young universe, only Type 0
    if (rand < 0.7) return 'Type0';
    if (rand < 0.95) return 'Type1';
    if (rand < 0.99) return 'Type2';
    return 'Type3'; // Very rare
  }

  /**
   * Calculate temperature suitability for life (0-1)
   */
  getTemperatureSuitability() {
    const temp = this.universe.currentState.temperature;
    const optimalTemp = 300; // K (Earth-like)
    const tolerance = 100; // K
    
    return Math.exp(-Math.pow((temp - optimalTemp) / tolerance, 2));
  }

  /**
   * Update overall universe stability index
   */
  updateStability() {
    const age = this.universe.currentState.age;
    
    // 1. Entropy (increases = less stable)
    const entropyFactor = Math.exp(-this.universe.currentState.entropy / 1e14);
    
    // 2. Structure formation (organized matter = more stable)
    const expectedGalaxies = this.constants.observableGalaxies * 
      Math.min(age / 13.8e9, 1);
    const structureFactor = Math.min(
      this.universe.currentState.galaxyCount / Math.max(expectedGalaxies, 1), 
      1
    );
    
    // 3. Dark energy dominance
    const scaleFactor = Math.exp(this.constants.H0 * age * 365.25 * 24 * 3600);
    const matterDensity = this.constants.darkMatterDensity / Math.pow(scaleFactor, 3);
    const darkEnergyDensity = this.constants.darkEnergyDensity;
    const densityRatio = matterDensity / (matterDensity + darkEnergyDensity);
    const darkEnergyFactor = densityRatio;
    
    // 4. Temperature stability
    const temperatureFactor = this.getTemperatureSuitability();
    
    // 5. Anomaly impact
    const unresolvedAnomalies = this.universe.anomalies?.filter(a => !a.resolved).length || 0;
    const anomalyFactor = Math.max(0, 1 - (unresolvedAnomalies * 0.05));
    
    // Combine factors
    this.universe.currentState.stabilityIndex = (
      entropyFactor * 0.15 +
      structureFactor * 0.25 +
      darkEnergyFactor * 0.25 +
      temperatureFactor * 0.15 +
      anomalyFactor * 0.2
    );
    
    this.universe.currentState.stabilityIndex = Math.max(0, 
      Math.min(1, this.universe.currentState.stabilityIndex)
    );
    
    // Update metrics
    if (!this.universe.metrics) {
      this.universe.metrics = {};
    }
    this.universe.metrics.stabilityScore = this.universe.currentState.stabilityIndex;
    this.universe.metrics.complexityIndex = this.calculateComplexityIndex();
    this.universe.metrics.lifePotentialIndex = this.calculateLifePotentialIndex();
  }

  /**
   * Calculate complexity index based on structure
   */
  calculateComplexityIndex() {
    const galaxyFactor = Math.log10(this.universe.currentState.galaxyCount + 1) / 12;
    const starFactor = Math.log10(this.universe.currentState.starCount + 1) / 23;
    const civFactor = Math.log10(this.universe.currentState.civilizationCount + 1) / 3;
    
    return Math.min(1, (galaxyFactor + starFactor + civFactor) / 3);
  }

  /**
   * Calculate life potential index
   */
  calculateLifePotentialIndex() {
    if (this.universe.currentState.habitableSystemsCount === 0) return 0;
    
    const habitableFraction = this.universe.currentState.habitableSystemsCount / 
      Math.max(this.universe.currentState.starCount, 1);
    const temperatureFactor = this.getTemperatureSuitability();
    const stabilityFactor = this.universe.currentState.stabilityIndex;
    
    return Math.min(1, (habitableFraction * 1000 + temperatureFactor + stabilityFactor) / 3);
  }

  /**
   * Generate GLOBAL simulation anomalies (not rendered in-game)
   */
  generateGlobalAnomalies() {
    const age = this.universe.currentState.age;
    
    // Base probability scales with universe activity
    const activityLevel = this.universe.currentState.galaxyCount / 
      this.constants.observableGalaxies;
    
    // Only generate anomalies probabilistically
    if (this.rng() > 0.01 * activityLevel) return;
    
    const anomalyDefinitions = {
      blackHoleMerger: {
        probability: 0.3,
        condition: () => this.universe.currentState.blackHoleCount > 1e6,
        effects: (severity) => ({
          gravitationalWaves: true,
          energyRelease: severity * 1e47,
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
      quantumTunneling: {
        probability: 0.1,
        condition: () => true,
        effects: (severity) => ({
          localEntropyDecrease: -severity * 1e8,
          stabilityImpact: -0.03 * severity
        }),
        description: 'Quantum vacuum instability'
      },
      falseVacuumDecay: {
        probability: 0.02,
        condition: () => age > 10e9, // Only in mature universes
        effects: (severity) => ({
          catastrophicEvent: true,
          stabilityImpact: -0.5 * severity
        }),
        description: 'False vacuum decay event'
      },
      cosmicStringCollision: {
        probability: 0.08,
        condition: () => age < 1e9, // Early universe
        effects: (severity) => ({
          gravitationalWaves: true,
          stabilityImpact: -0.015 * severity
        }),
        description: 'Cosmic string collision'
      }
    };

    const newAnomalies = [];
    
    Object.entries(anomalyDefinitions).forEach(([type, config]) => {
      if (this.rng() < config.probability && config.condition()) {
        const severity = Math.ceil(this.rng() * 10);
        const effectsData = config.effects(severity);
        
        const anomaly = {
          _id: new mongoose.Types.ObjectId(),
          type,
          severity,
          location: {
            x: (this.rng() - 0.5) * 100000,
            y: (this.rng() - 0.5) * 100000,
            z: (this.rng() - 0.5) * 10000
          },
          radius: 1000 * severity,
          timestamp: new Date(this.universe.currentState.age * 31557600000),
          resolved: false,
          effects: Object.entries(effectsData).map(([parameter, magnitude]) => ({
            parameter,
            magnitude,
            duration: severity * 1e8 // years
          }))
        };
        
        newAnomalies.push(anomaly);
        
        // Apply effects immediately
        this.applyAnomalyEffects(effectsData);
        
        // Record significant event
        this.recordSignificantEvent(type, config.description, effectsData);
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
  applyAnomalyEffects(effects) {
    if (effects.stabilityImpact) {
      this.universe.currentState.stabilityIndex += effects.stabilityImpact;
      this.universe.currentState.stabilityIndex = Math.max(0, 
        Math.min(1, this.universe.currentState.stabilityIndex)
      );
    }
    
    if (effects.expansionBoost) {
      this.universe.currentState.expansionRate *= (1 + effects.expansionBoost);
    }
    
    if (effects.localEntropyDecrease) {
      this.universe.currentState.entropy += effects.localEntropyDecrease;
    }
    
    if (effects.starDeathCount) {
      this.universe.currentState.starCount -= effects.starDeathCount;
      this.universe.currentState.starCount = Math.max(0, this.universe.currentState.starCount);
    }
    
    if (effects.catastrophicEvent) {
      // Major universe-altering event
      this.universe.currentState.stabilityIndex *= 0.5;
    }
  }

  /**
   * Record significant events in timeline
   */
  recordSignificantEvent(type, description, effects) {
    if (!this.universe.significantEvents) {
      this.universe.significantEvents = [];
    }
    
    this.universe.significantEvents.push({
      timestamp: new Date(this.universe.currentState.age * 31557600000),
      type,
      description,
      effects
    });
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
    
    // Update last modified timestamp
    this.universe.lastModified = new Date();
    
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
      expansionRate: `${this.universe.currentState.expansionRate.toFixed(2)} km/s/Mpc`,
      temperature: `${this.universe.currentState.temperature.toFixed(2)} K`,
      galaxies: this.universe.currentState.galaxyCount.toExponential(2),
      stars: this.universe.currentState.starCount.toExponential(2),
      blackHoles: this.universe.currentState.blackHoleCount.toExponential(2),
      habitableSystems: this.universe.currentState.habitableSystemsCount.toExponential(2),
      lifeBearingPlanets: this.universe.currentState.lifeBearingPlanetsCount.toExponential(2),
      civilizations: this.universe.currentState.civilizationCount,
      stability: `${(this.universe.currentState.stabilityIndex * 100).toFixed(1)}%`,
      complexity: `${(this.universe.metrics?.complexityIndex * 100).toFixed(1)}%`,
      lifePotential: `${(this.universe.metrics?.lifePotentialIndex * 100).toFixed(1)}%`,
      globalAnomalies: this.universe.anomalies?.filter(a => !a.resolved).length || 0,
      significantEvents: this.universe.significantEvents?.length || 0
    };
  }

  /**
   * Check for universe end conditions
   */
  checkEndConditions() {
    const age = this.universe.currentState.age;
    const stability = this.universe.currentState.stabilityIndex;
    
    if (stability < 0.1) {
      this.universe.status = 'ended';
      this.universe.endCondition = 'vacuum-decay';
      return true;
    }
    
    if (age > 1e14) { // 100 trillion years
      this.universe.status = 'ended';
      this.universe.endCondition = 'heat-death';
      return true;
    }
    
    return false;
  }
}

module.exports = PhysicsEngine;