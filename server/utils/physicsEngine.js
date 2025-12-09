const seedrandom = require("seedrandom");

/**
 * refactored PhysicsEngine
 * handles ONLY core physics: expansion, structures, life evolution, stability
 * anomalies and end conditions moved to separate modules
 */
class PhysicsEngine {
  constructor(universe, options = {}) {
    if (!universe) throw new Error("PhysicsEngine requires a universe object");

    this.universe = universe;
    //PARAMAETERS §§§§§§§§§§§§§§§§§§§§§§§§§§§§§§§§§§§§§§§§§§§§§§§§§§
    this.options = {
      timeStepYears: options.timeStepYears ?? 1e7,
      maxScaleFactorExp: 50,
      seed: options.seed ?? universe?.seed ?? "default-seed",
      difficultyModifier: options.difficultyModifier ?? 1.0,
      enableProgressiveEvents: options.enableProgressiveEvents ?? true,
      ...options,
    };

    this.rng = seedrandom(this.options.seed);

    // Initialize constants with proper defaults
    const uniConstants = universe.constants || {};
    this.constants = {
      H0_km_s_Mpc: uniConstants.H0_km_s_Mpc ?? 67.4,
      H0: ((uniConstants.H0_km_s_Mpc ?? 67.4) / 3.08567758128e19) * 3.15576e7,
      c: uniConstants.speedOfLight ?? 2.99792458e8,
      G: uniConstants.gravitationalConstant ?? 6.67430e-11,
      darkMatterDensity: uniConstants.darkMatterDensity ?? 0.26,
      darkEnergyDensity: uniConstants.darkEnergyDensity ?? 0.69,
      baryonicDensity: uniConstants.matterDensity ?? 0.05,
      observableGalaxies: uniConstants.observableGalaxies ?? 2e11,
      averageStarsPerGalaxy: uniConstants.averageStarsPerGalaxy ?? 1e10,
      planckTemperature: uniConstants.planckTemperature ?? 1.417e32,
    };

    this._initializeState();
    this._initializeTracking();
  }

  _initializeState() {
    this.universe.currentState = this.universe.currentState || {};
    const cs = this.universe.currentState;
    
    cs.age = typeof cs.age === "number" ? cs.age : 0;
    cs._scaleFactor = cs._scaleFactor ?? 1.0;
    cs.expansionRate = cs.expansionRate ?? this.constants.H0_km_s_Mpc;
    cs.temperature = cs.temperature ?? (this.universe.initialConditions?.initialTemperature ?? 2.725);
    cs.entropy = cs.entropy ?? 0;
    cs.stabilityIndex = cs.stabilityIndex ?? 1.0;
    cs.galaxyCount = cs.galaxyCount ?? 0;
    cs.starCount = cs.starCount ?? 0;
    cs.blackHoleCount = cs.blackHoleCount ?? 0;
    cs.habitableSystemsCount = cs.habitableSystemsCount ?? 0;
    cs.lifeBearingPlanetsCount = cs.lifeBearingPlanetsCount ?? 0;
    cs.civilizationCount = cs.civilizationCount ?? 0;
    cs.metallicity = cs.metallicity ?? 0;
    
    // Enhanced state tracking
    cs.cosmicPhase = cs.cosmicPhase ?? "dark_ages";
    cs.stellarGenerations = cs.stellarGenerations ?? 0;
    cs.energyBudget = cs.energyBudget ?? 1.0;

    if (!Array.isArray(this.universe.anomalies)) this.universe.anomalies = [];
    if (!Array.isArray(this.universe.significantEvents)) this.universe.significantEvents = [];
    if (!Array.isArray(this.universe.civilizations)) this.universe.civilizations = [];
    this.universe.metrics = this.universe.metrics || {};
  }

  _initializeTracking() {
    // Track stability history for trend analysis
    this.stabilityHistory = [];
    this.maxHistoryLength = 100;
    
    // Track milestones - INITIALIZE from database or defaults
    this.milestones = this.universe.milestones || {
      firstGalaxy: false,
      firstStar: false,
      firstLife: false,
      firstCivilization: false,
      stellarPopulationI: false,
      complexLifeEra: false,
      technologicalSingularity: false
    };
    
    // Ensure universe.milestones exists and is properly linked
    if (!this.universe.milestones) {
      this.universe.milestones = this.milestones;
    } else {
      // Sync existing milestones to local reference
      this.milestones = this.universe.milestones;
    }
    
    // Run deduplication on initialization
    this._deduplicateMilestones();
  }

  // ========== Helper Methods ==========
  _rand() {
    return this.rng();
  }

  _clamp(v, min = -Infinity, max = Infinity) {
    return Math.max(min, Math.min(max, v));
  }

  _safeExp(x) {
    if (x > this.options.maxScaleFactorExp) return Math.exp(this.options.maxScaleFactorExp);
    if (x < -this.options.maxScaleFactorExp) return 0;
    return Math.exp(x);
  }

  _gaussianRandom(mean = 0, stdDev = 1) {
    const u1 = this._rand();
    const u2 = this._rand();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z0 * stdDev;
  }

  // ========== Core Physics Modules ==========

  _updateExpansion() {
    const dt = this.options.timeStepYears;
    const cs = this.universe.currentState;
    
    cs.age += dt;
    cs._scaleFactor = cs._scaleFactor ?? 1.0;

    const H0 = this.constants.H0;
    const a = cs._scaleFactor;
    
    // Calculate density parameters at current scale factor
    const matterTerm = (this.constants.darkMatterDensity + this.constants.baryonicDensity) / Math.pow(a, 3);
    const radiationTerm = 0.0001 / Math.pow(a, 4);
    const darkTerm = this.constants.darkEnergyDensity;
    
    // Friedmann equation: H(a)² = H0² * (Ωm/a³ + Ωr/a⁴ + ΩΛ)
    const H_eff = H0 * Math.sqrt(Math.max(0, matterTerm + radiationTerm + darkTerm));
    
    // Scale factor evolution: da/dt = H(a) * a
    const expansionFactor = H_eff * dt;
    const cappedExpansion = this._clamp(expansionFactor, -0.1, 0.1);
    const growth = this._safeExp(cappedExpansion);
    
    cs._scaleFactor = this._clamp(
      cs._scaleFactor * growth,
      1e-10,
      1e10
    );

    // Update expansion rate for display
    cs.expansionRate = H_eff * 3.08567758128e19 / 3.15576e7;

    // Temperature cooling: T ∝ 1/a (adiabatic expansion)
    const T0 = this.universe.initialConditions?.initialTemperature ?? 2.725;
    cs.temperature = this._clamp(T0 / cs._scaleFactor, 0.01, T0 * 100);

    // Entropy growth (logarithmic with volume)
    const volumeRatio = Math.pow(cs._scaleFactor, 3);
    const entropyGrowth = Math.log(Math.max(1, volumeRatio)) * 1e5 * (dt / 1e8);
    cs.entropy = this._clamp(cs.entropy + entropyGrowth, 0, 1e16);
    
    // Energy budget decreases over time (thermodynamic arrow)
    const energyDecay = 5e-13 * dt;
    cs.energyBudget = this._clamp(cs.energyBudget - energyDecay, 0, 1.0);
    
    // Update cosmic phase
    this._updateCosmicPhase();
  }

  _updateCosmicPhase() {
    const cs = this.universe.currentState;
    const ageGyr = cs.age / 1e9;
    
    if (ageGyr < 0.1) cs.cosmicPhase = "dark_ages";
    else if (ageGyr < 1) cs.cosmicPhase = "reionization";
    else if (ageGyr < 5) cs.cosmicPhase = "galaxy_formation";
    else if (ageGyr < 10) cs.cosmicPhase = "stellar_peak";
    else if (ageGyr < 50) cs.cosmicPhase = "gradual_decline";
    else if (ageGyr < 100) cs.cosmicPhase = "twilight_era";
    else cs.cosmicPhase = "degenerate_era";
  }

  _updateStructures() {
    const cs = this.universe.currentState;
    const age = cs.age;
    const dt = this.options.timeStepYears;
    const ageGyr = age / 1e9;

    // ==================== GALAXY FORMATION ====================
    const K = this.constants.observableGalaxies;
    
    // Formation peaks between 2-8 Gyr, then slows
    const formationPeak = Math.exp(-Math.pow((ageGyr - 5) / 3, 2));
    const baseRate = 0.15 / 1e9;
    const r = baseRate * (1 + formationPeak * 2);
    
    const current = cs.galaxyCount;
    
    let dG = 0;
    
    // CRITICAL: Bootstrap mechanism for early universe
    if (ageGyr > 0.1 && ageGyr < 2.5 && current < 1000) {
      // Rapid seed formation in early universe
      const seedRate = 2000 * Math.exp(-Math.pow((ageGyr - 0.5) / 0.7, 2));
      dG = seedRate * (dt / 1e7);
      
      if (dG > 10) {
        console.log(`🌌 SEED GALAXIES: Adding ${dG.toFixed(0)} galaxies (age: ${ageGyr.toFixed(2)} Gyr, total: ${(current + dG).toFixed(0)})`);
      }
    } else if (current > 0) {
      // Normal logistic growth (requires existing population)
      dG = r * current * (1 - current / Math.max(1, K)) * dt;
    }
    
    // Safety: Ensure at least some galaxies exist after 1 Gyr
    if (ageGyr > 1.0 && current < 100) {
      console.log(`🆘 BOOTSTRAP: Adding 100 seed galaxies at ${ageGyr.toFixed(2)} Gyr`);
      dG += 100;
    }
  
    cs.galaxyCount = this._clamp(current + dG, 0, K * 1.5);
    
    // Milestone: First galaxy
    if (cs.galaxyCount >= 1 && !this.milestones.firstGalaxy) {
      this._recordMilestone(
        'firstGalaxy',
        "First Galaxy Formation", 
        "The first galaxy has formed from primordial gas clouds"
      );
    }

    // ==================== STAR FORMATION ====================
    const starsPerGalaxy = this.constants.averageStarsPerGalaxy;
    const starsTarget = cs.galaxyCount * starsPerGalaxy;
    
    if (cs.galaxyCount > 0) {
      // Star formation efficiency depends on metallicity and gas availability
      const metallicityBoost = 1 + cs.metallicity * 0.5;
      const gasFraction = Math.exp(-ageGyr / 10); // Gas depletes over time
      
      // Aggressive star formation rate for gameplay
      const sfRate = 0.003 * gasFraction * metallicityBoost;
      
      const starGrowth = (starsTarget - cs.starCount) * sfRate * (dt / 1e7);
      cs.starCount = Math.max(0, cs.starCount + starGrowth);
      
      // Bootstrap: Ensure stars form once galaxies exist
      if (ageGyr > 0.5 && cs.galaxyCount > 10 && cs.starCount < 1e6) {
        const boost = 1e6;
        console.log(`⭐ BOOTSTRAP: Adding ${boost.toExponential(1)} stars`);
        cs.starCount += boost;
      }
      
      // Milestone: First star
      if (cs.starCount >= 1 && !this.milestones.firstStar) {
        this._recordMilestone(
          'firstStar',
          "First Star Ignition", 
          "The first stars have ignited, ending the cosmic dark ages"
        );
      }
    }
    
    // ==================== STELLAR EVOLUTION ====================
    if (cs.starCount > 0) {
      // Stellar death and generations
      const stellarDeathRate = cs.starCount * 1e-11 * dt;
      const generationIncrease = stellarDeathRate / (starsPerGalaxy * 10);
      cs.stellarGenerations = Math.min(cs.stellarGenerations + generationIncrease, 10);
      
      // Metallicity increases from stellar nucleosynthesis
      const metalProduction = stellarDeathRate * 1e-14;
      cs.metallicity = this._clamp(cs.metallicity + metalProduction, 0, 1);
      
      // Milestone: Population I stars (metal-rich)
      if (cs.metallicity > 0.1 && !this.milestones.stellarPopulationI) {
        this._recordMilestone(
          'stellarPopulationI',
          "Population I Stars", 
          "Metal-rich stars capable of forming rocky planets"
        );
      }
    }

    // ==================== BLACK HOLE FORMATION ====================
    if (cs.starCount > 0) {
      const massiveStarFraction = 1e-4;
      const bhFormationRate = 0.1;
      const newBHs = cs.starCount * massiveStarFraction * bhFormationRate * (dt / 1e9);
      cs.blackHoleCount = Math.max(0, cs.blackHoleCount + newBHs);
    }

    // ==================== PERIODIC STATUS LOG ====================
    // Log every 100 million years
    if (Math.floor(age / 1e8) !== Math.floor((age - dt) / 1e8)) {
      console.log(`📊 STRUCTURES [${ageGyr.toFixed(2)} Gyr]:`, {
        galaxies: cs.galaxyCount.toExponential(2),
        stars: cs.starCount.toExponential(2),
        blackHoles: cs.blackHoleCount.toExponential(2),
        metallicity: (cs.metallicity * 100).toFixed(1) + '%',
        phase: cs.cosmicPhase
      });
    }
  }

  _recordMilestone(milestoneKey, title, description) {
    // CRITICAL: Only record if milestone hasn't been achieved yet
    if (this.milestones[milestoneKey]) {
      return; // Already recorded, skip
    }
    
    // Set milestone flag FIRST to prevent duplicates
    this.milestones[milestoneKey] = true;
    
    // IMPORTANT: Mark milestones as modified for Mongoose
    if (typeof this.universe.markModified === "function"){
      this.universe.markModified('milestones');
    }
    
    
    // Then record the event
    this._recordSignificantEvent("milestone", `MILESTONE: ${title}`, { 
      description,
      milestoneKey // Add key for reference
    });
    
    console.log(`🎯 MILESTONE ACHIEVED: ${title} (${milestoneKey})`);
  }

  _recordSignificantEvent(type, description, effects) {
    // Limit events to prevent memory bloat
    if (this.universe.significantEvents.length > 2000) {
      this.universe.significantEvents.splice(0, 500);
    }
    
    this.universe.significantEvents.push({
      timestamp: new Date(),
      age: this.universe.currentState.age,
      type,
      description,
      effects,
      ageGyr: (this.universe.currentState.age / 1e9).toFixed(3)
    });
  }

  _updateLifeEvolution() {
    const cs = this.universe.currentState;
    const age = cs.age;
    const dt = this.options.timeStepYears;
    const ageGyr = age / 1e9;

    // No life before heavy elements
    if (ageGyr < 1 || cs.metallicity < 0.01) return;

    // Habitable systems depend on metallicity and stellar maturity
    const metallicityFactor = this._clamp(cs.metallicity / 0.3, 0, 1);
    const maturityFactor = Math.min(1, (ageGyr - 1) / 3);
    const habitableFraction = 0.001 + metallicityFactor * maturityFactor * 0.015;
    
    cs.habitableSystemsCount = Math.max(0, cs.starCount * habitableFraction);

    // Life emergence requires time + suitable conditions
    if (ageGyr > 3 && cs.habitableSystemsCount > 100) {
      const timeFactor = this._clamp((ageGyr - 3) / 5, 0, 1);
      const temperatureFactor = this._getTemperatureSuitability();
      const lifeProbPerHabitable = 1e-8 * timeFactor * metallicityFactor * temperatureFactor;
      
      const deltaLife = cs.habitableSystemsCount * lifeProbPerHabitable * (dt / 1e8);
      cs.lifeBearingPlanetsCount = Math.max(0, cs.lifeBearingPlanetsCount + deltaLife);
      
      // Milestone: First life
      if (cs.lifeBearingPlanetsCount >= 1 && !this.milestones.firstLife) {
        this._recordMilestone(
          'firstLife',
          "Abiogenesis Event", 
          "Life has emerged in the universe"
        );
      }
      
      // Milestone: Complex life era
      if (cs.lifeBearingPlanetsCount > 1000 && !this.milestones.complexLifeEra) {
        this._recordMilestone(
          'complexLifeEra',
          "Complex Life Era", 
          "Complex multicellular life is widespread"
        );
      }
    }

    // Civilization emergence
    if (ageGyr > 5 && cs.lifeBearingPlanetsCount > 1000) {
      const civProb = 1e-7 * (1 + cs.metallicity * 0.5);
      const expectedCivs = Math.floor(cs.lifeBearingPlanetsCount * civProb);
      
      if (expectedCivs > cs.civilizationCount) {
        const add = Math.min(expectedCivs - cs.civilizationCount, 50);
        cs.civilizationCount = expectedCivs;
        
        for (let i = 0; i < add; i++) {
          const civType = this._determineCivilizationType(age);
          this.universe.civilizations.push({
            id: `civ_${Date.now()}_${i}`,
            type: civType,
            createdAt: new Date(),
            age: 0,
            developmentLevel: this._rand(),
            technology: this._rand() * 10,
            stability: 0.5 + this._rand() * 0.5
          });
        }
        
        // Milestone: First civilization
        if (cs.civilizationCount >= 1 && !this.milestones.firstCivilization) {
          this._recordMilestone(
            'firstCivilization',
            "First Civilization", 
            "Intelligent civilization has emerged"
          );
        }
        
        // Milestone: Technological singularity (Type 1+)
        const advancedCivs = this.universe.civilizations.filter(c => 
          c.type !== "Type0"
        ).length;
        if (advancedCivs > 0 && !this.milestones.technologicalSingularity) {
          this._recordMilestone(
            'technologicalSingularity',
            "Technological Singularity", 
            "Advanced civilizations have transcended planetary boundaries"
          );
        }
      }
    }
    
    // Evolve existing civilizations
    this._evolveCivilizations(dt);
  }

  _deduplicateMilestones() {
    const seenMilestones = new Set();
    const uniqueEvents = [];
    
    for (const event of this.universe.significantEvents) {
      if (event.type === 'milestone') {
        // Extract milestone key from description
        const milestoneText = event.description.replace('MILESTONE: ', '');
        
        if (!seenMilestones.has(milestoneText)) {
          seenMilestones.add(milestoneText);
          uniqueEvents.push(event);
          
          // Map milestone description to milestone key and mark as achieved
          const milestoneKeyMap = {
            'First Galaxy Formation': 'firstGalaxy',
            'First Star Ignition': 'firstStar',
            'Population I Stars': 'stellarPopulationI',
            'Abiogenesis Event': 'firstLife',
            'Complex Life Era': 'complexLifeEra',
            'First Civilization': 'firstCivilization',
            'Technological Singularity': 'technologicalSingularity'
          };
          
          const milestoneKey = milestoneKeyMap[milestoneText];
          if (milestoneKey && this.milestones[milestoneKey] !== undefined) {
            this.milestones[milestoneKey] = true;
          }
        }
      } else {
        uniqueEvents.push(event);
      }
    }
    
    if (uniqueEvents.length < this.universe.significantEvents.length) {
      const removed = this.universe.significantEvents.length - uniqueEvents.length;
      console.log(`🧹 Removed ${removed} duplicate milestone events`);
      this.universe.significantEvents = uniqueEvents;
      if (typeof this.universe.markModified === "function"){
        this.universe.markModified('significantEvents');
        this.universe.markModified('milestones');
      }
      
    }
  }

  _evolveCivilizations(dt) {
    for (const civ of this.universe.civilizations) {
      civ.age += dt;
      
      // Technology advancement
      const techGrowth = 0.01 * (dt / 1e8) * (1 + civ.developmentLevel);
      civ.technology = Math.min(100, civ.technology + techGrowth);
      
      // Type progression
      if (civ.technology > 20 && civ.type === "Type0" && this._rand() < 0.001) {
        civ.type = "Type1";
      } else if (civ.technology > 50 && civ.type === "Type1" && this._rand() < 0.0001) {
        civ.type = "Type2";
      } else if (civ.technology > 80 && civ.type === "Type2" && this._rand() < 0.00001) {
        civ.type = "Type3";
      }
      
      // Stability fluctuations
      civ.stability += this._gaussianRandom(0, 0.01);
      civ.stability = this._clamp(civ.stability, 0, 1);
      
      // Extinction events (rare)
      if (civ.stability < 0.1 && this._rand() < 0.0001) {
        civ.extinct = true;
      }
    }
    
    // Remove extinct civilizations occasionally
    if (this._rand() < 0.01) {
      this.universe.civilizations = this.universe.civilizations.filter(c => !c.extinct);
    }
  }

  _determineCivilizationType(age) {
    const r = this._rand();
    const ageGyr = age / 1e9;
    
    if (ageGyr < 8) return "Type0";
    if (r < 0.98) return "Type0";
    if (r < 0.998) return "Type1";
    if (r < 0.9998) return "Type2";
    return "Type3";
  }

  _updateStability() {
    const cs = this.universe.currentState;

    // Component factors (0 to 1 scale)
    const entropyFactor = this._calculateEntropyFactor();
    const structureFactor = this._calculateStructureFactor();
    const darkEnergyFactor = this._calculateDarkEnergyFactor();
    const temperatureFactor = this._getTemperatureSuitability();
    const anomalyFactor = this._calculateAnomalyFactor();
    const energyFactor = cs.energyBudget;

    // Weighted stability calculation
    let rawStability = 
      0.15 * entropyFactor +
      0.25 * structureFactor +
      0.15 * darkEnergyFactor +
      0.15 * temperatureFactor +
      0.20 * anomalyFactor +
      0.10 * energyFactor;

    // Apply difficulty modifier (MORE FORGIVING)
    const diffMod = this.options.difficultyModifier ?? 1.0;
    rawStability = rawStability * (0.6 + 0.4 / diffMod);

    cs.stabilityIndex = this._clamp(rawStability, 0, 1);
    
    // Track stability history
    this.stabilityHistory.push(cs.stabilityIndex);
    if (this.stabilityHistory.length > this.maxHistoryLength) {
      this.stabilityHistory.shift();
    }

    // Update metrics
    this.universe.metrics.stabilityScore = cs.stabilityIndex;
    this.universe.metrics.stabilityTrend = this._calculateStabilityTrend();
    this.universe.metrics.complexityIndex = this._calculateComplexityIndex();
    this.universe.metrics.lifePotentialIndex = this._calculateLifePotentialIndex();
    this.universe.metrics.cosmicHealth = this._calculateCosmicHealth();
  }

  _calculateEntropyFactor() {
    const cs = this.universe.currentState;
    const maxEntropy = 3e14;
    return Math.max(0, 1 - Math.pow(cs.entropy / maxEntropy, 0.7));
  }

  _calculateStructureFactor() {
    const cs = this.universe.currentState;
    const ageGyr = cs.age / 1e9;
    
    const expectedGalaxies = this.constants.observableGalaxies * Math.min(ageGyr / 13.8, 1);
    const galaxyFactor = Math.min(1, cs.galaxyCount / Math.max(1, expectedGalaxies * 0.3));
    
    const expectedStars = cs.galaxyCount * this.constants.averageStarsPerGalaxy * 0.5;
    const starFactor = Math.min(1, cs.starCount / Math.max(1, expectedStars));
    
    return (galaxyFactor + starFactor) / 2;
  }

  _calculateDarkEnergyFactor() {
    const cs = this.universe.currentState;
    const a = cs._scaleFactor ?? 1;
    
    const matterDensity = (this.constants.darkMatterDensity + this.constants.baryonicDensity) / Math.pow(a, 3);
    const darkEnergyDensity = this.constants.darkEnergyDensity;
    const totalDensity = matterDensity + darkEnergyDensity;
    const deFraction = darkEnergyDensity / Math.max(1e-12, totalDensity);
    
    // only problematic when dark energy HEAVILY dominates (>95%)
    if (deFraction < 0.95) return 1.0;
    return Math.max(0, 1 - Math.pow((deFraction - 0.95) / 0.05, 2));
  }

  _calculateAnomalyFactor() {
    const unresolved = this.universe.anomalies.filter(a => !a.resolved).length;
    const total = this.universe.anomalies.length;
    
    const unresolvedImpact = Math.min(unresolved * 0.008, 0.35);
    const totalImpact = Math.min(total * 0.0015, 0.25);
    
    return Math.max(0, 1 - unresolvedImpact - totalImpact);
  }

  _calculateStabilityTrend() {
    if (this.stabilityHistory.length < 10) return 0;
    
    const recent = this.stabilityHistory.slice(-10);
    const older = this.stabilityHistory.slice(-20, -10);
    
    if (older.length === 0) return 0;
    
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    
    return recentAvg - olderAvg;
  }

  _getTemperatureSuitability() {
    const temp = this.universe.currentState.temperature;
    const optimal = 2.725;
    const tolerance = 5;
    return Math.exp(-Math.pow((temp - optimal) / tolerance, 2));
  }

  _calculateComplexityIndex() {
    const cs = this.universe.currentState;
    
    const g = Math.log10(Math.max(1, cs.galaxyCount)) / 12;
    const s = Math.log10(Math.max(1, cs.starCount)) / 23;
    const l = Math.log10(Math.max(1, cs.lifeBearingPlanetsCount + 1)) / 10;
    const c = Math.log10(Math.max(1, cs.civilizationCount + 1)) / 3;
    
    return this._clamp((g + s + l + c) / 4, 0, 1);
  }

  _calculateLifePotentialIndex() {
    const cs = this.universe.currentState;
    if (cs.starCount <= 0) return 0;
    
    const habitableFraction = cs.habitableSystemsCount / cs.starCount;
    const tempSuitability = this._getTemperatureSuitability();
    const stability = cs.stabilityIndex;
    const metallicityBonus = cs.metallicity;
    
    return this._clamp(
      (habitableFraction * 100 + tempSuitability + stability + metallicityBonus) / 4, 
      0, 
      1
    );
  }

  _calculateCosmicHealth() {
    const cs = this.universe.currentState;
    
    return this._clamp(
      (cs.stabilityIndex * 0.4 + 
       this._calculateComplexityIndex() * 0.3 + 
       this._calculateLifePotentialIndex() * 0.3),
      0,
      1
    );
  }

  // ========== Public API =================================================================

  simulateStep() {
    this._updateExpansion();
    this._updateStructures();
    this._updateLifeEvolution();
    this._updateStability();

    this.universe.lastModified = new Date();

    return { 
      universe: this.universe,
      metrics: this.universe.metrics,
      milestones: this.milestones
    };
  }

  simulateSteps(n = 1) {
    const stepsToRun = Math.max(1, Math.floor(n));
    
    for (let i = 0; i < stepsToRun; i++) {
      this.simulateStep();
    }
    
    return { 
      universe: this.universe,
      metrics: this.universe.metrics,
      milestones: this.milestones,
      stabilityHistory: this.stabilityHistory
    };
  }

  getStatistics() {
    const cs = this.universe.currentState;
    const ageGyr = cs.age / 1e9;
    
    return {
      ageYears: cs.age,
      ageGyr: ageGyr.toFixed(3),
      cosmicPhase: cs.cosmicPhase,
      expansionRate: cs.expansionRate.toFixed(2),
      scaleFactor: cs._scaleFactor.toFixed(6),
      temperature: cs.temperature.toFixed(6),
      entropy: cs.entropy.toExponential(3),
      energyBudget: (cs.energyBudget * 100).toFixed(1) + "%",
      
      // Structure
      galaxies: this._formatLargeNumber(cs.galaxyCount),
      stars: this._formatLargeNumber(cs.starCount),
      blackHoles: this._formatLargeNumber(cs.blackHoleCount),
      metallicity: (cs.metallicity * 100).toFixed(2) + "%",
      stellarGenerations: cs.stellarGenerations.toFixed(2),
      
      // Life
      habitableSystems: this._formatLargeNumber(cs.habitableSystemsCount),
      lifeBearingPlanets: this._formatLargeNumber(cs.lifeBearingPlanetsCount),
      civilizations: cs.civilizationCount,
      advancedCivilizations: this.universe.civilizations.filter(c => c.type !== "Type0").length,
      
      // Stability & Health
      stability: (cs.stabilityIndex * 100).toFixed(2) + "%",
      stabilityTrend: this._formatTrend(this.universe.metrics.stabilityTrend),
      cosmicHealth: (this.universe.metrics.cosmicHealth * 100).toFixed(1) + "%",
      
      // Anomalies
      anomaliesTotal: this.universe.anomalies.length,
      anomaliesActive: this.universe.anomalies.filter(a => !a.resolved).length,
      
      // Events & Metrics
      significantEvents: this.universe.significantEvents.length,
      metrics: this.universe.metrics,
      milestones: this.milestones,
      milestonesAchieved: Object.values(this.milestones).filter(Boolean).length
    };
  }

  _formatLargeNumber(num) {
    if (num < 1e3) return Math.floor(num).toString();
    if (num < 1e6) return (num / 1e3).toFixed(2) + "K";
    if (num < 1e9) return (num / 1e6).toFixed(2) + "M";
    if (num < 1e12) return (num / 1e9).toFixed(2) + "B";
    return num.toExponential(2);
  }

  _formatTrend(trend) {
    if (!trend) return "stable";
    if (trend > 0.05) return "improving rapidly";
    if (trend > 0.01) return "improving";
    if (trend > -0.01) return "stable";
    if (trend > -0.05) return "declining";
    return "declining rapidly";
  }

  // Get stability history for end condition checking
  getStabilityHistory() {
    return this.stabilityHistory;
  }
}

module.exports = PhysicsEngine;