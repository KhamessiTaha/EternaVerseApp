const seedrandom = require("seedrandom");

const CHUNK_SIZE = 1000;
const MAX_ANOMALIES_PER_UNIVERSE = 200; // Hard limit to prevent DB bloat

class AnomalyGenerator {
  constructor(universe, options = {}) {
    if (!universe) throw new Error("AnomalyGenerator requires a universe object");

    this.universe = universe;
    this.options = {
      anomalyProbabilityScale: options.anomalyProbabilityScale ?? 0.01,
      maxAnomalyPerStep: options.maxAnomalyPerStep ?? 5,
      seed: options.seed ?? universe?.seed ?? "default-seed",
      anomalyIdFactory: options.anomalyIdFactory ?? (() => `${universe._id.toString()}_${Date.now()}_${Math.floor(Math.random()*1e6)}`),
      difficultyModifier: options.difficultyModifier ?? 1.0,
      playerPosition: options.playerPosition ?? { x: 0, y: 0 },
      ...options,
    };

    this.rng = seedrandom(this.options.seed + "_anomaly");
    
    const uniConstants = universe.constants || {};
    this.constants = {
      observableGalaxies: uniConstants.observableGalaxies ?? 2e11,
    };
  }

  _rand() {
    return this.rng();
  }

  _clamp(v, min = -Infinity, max = Infinity) {
    return Math.max(min, Math.min(max, v));
  }

  _getChunkCoords(x, y) {
    return {
      chunkX: Math.floor(x / CHUNK_SIZE),
      chunkY: Math.floor(y / CHUNK_SIZE),
    };
  }

  getAnomalyTypes() {
    return [
      {
        id: "blackHoleMerger",
        probability: 0.001,
        condition: (cs) => cs.blackHoleCount > 1e5,
        effects: severity => ({ 
          stabilityImpact: -0.008 * severity,
          gravitationalWaveEnergy: 1e50 * severity,
          entropy: 5e6 * severity
        }),
        description: "Massive black hole merger detected",
        category: "gravitational"
      },
      {
        id: "darkEnergySurge",
        probability: 0.0004,
        condition: (cs, ageGyr) => ageGyr > 5,
        effects: severity => ({
          expansionBoost: 0.0008 * severity,
          stabilityImpact: -0.012 * severity,
          scaleFactorBump: 0.001 * severity
        }),
        description: "Dark energy fluctuation",
        category: "cosmological"
      },
      {
        id: "supernovaChain",
        probability: 0.0015,
        condition: (cs) => cs.starCount > 1e9,
        effects: severity => ({
          metallicityIncrease: 0.0005 * severity,
          starDeathCount: 100 * severity,
          stabilityImpact: -0.005 * severity,
          energyRelease: 1e51 * severity
        }),
        description: "Supernova cascade event",
        category: "stellar"
      },
      {
        id: "quantumFluctuation",
        probability: 0.0003,
        condition: () => true, // Always possible
        effects: severity => ({
          localEntropyDecrease: -1e6 * severity,
          stabilityImpact: -0.015 * severity,
          quantumCoherence: -0.01 * severity
        }),
        description: "Quantum vacuum instability",
        category: "quantum"
      },
      {
        id: "galacticCollision",
        probability: 0.0008,
        condition: (cs, ageGyr) => cs.galaxyCount > 1e6 && ageGyr > 2,
        effects: severity => ({
          starFormationBurst: 5000 * severity,
          stabilityImpact: -0.007 * severity,
          blackHoleFormation: 10 * severity
        }),
        description: "Major galactic collision",
        category: "structural"
      },
      {
        id: "cosmicVoid",
        probability: 0.0003,
        condition: (cs, ageGyr) => ageGyr > 3,
        effects: severity => ({
          galaxyLoss: 1000 * severity,
          stabilityImpact: -0.01 * severity,
          localExpansion: 0.001 * severity
        }),
        description: "Expanding cosmic void",
        category: "structural"
      },
      {
        id: "magneticReversal",
        probability: 0.0005,
        condition: (cs) => cs.galaxyCount > 1e5,
        effects: severity => ({
          stellarWindDisruption: 0.005 * severity,
          stabilityImpact: -0.004 * severity,
          habitabilityReduction: -100 * severity
        }),
        description: "Galactic magnetic field reversal",
        category: "electromagnetic"
      },
      {
        id: "darkMatterClump",
        probability: 0.0006,
        condition: (cs, ageGyr) => ageGyr > 1,
        effects: severity => ({
          gravitationalAnomaly: 0.01 * severity,
          stabilityImpact: -0.006 * severity,
          structureDistortion: 0.005 * severity
        }),
        description: "Dark matter density spike",
        category: "gravitational"
      }
    ];
  }

  autoCleanup() {
    const currentTotal = this.universe.anomalies.length;
    
    if (currentTotal >= MAX_ANOMALIES_PER_UNIVERSE) {
      console.log(`🧹 Auto-cleanup: ${currentTotal} anomalies (limit: ${MAX_ANOMALIES_PER_UNIVERSE})`);
      
      const cutoffTime = Date.now() - 5 * 60 * 1000;
      const before = this.universe.anomalies.length;
      
      this.universe.anomalies = this.universe.anomalies.filter(a => {
        if (!a.resolved) return true;
        const resolvedTime = new Date(a.resolvedAt || a.timestamp).getTime();
        return resolvedTime > cutoffTime;
      });
      
      const removed = before - this.universe.anomalies.length;
      console.log(`   Removed ${removed} old anomalies, ${this.universe.anomalies.length} remaining`);
      
      return removed;
    }
    
    return 0;
  }

  generateAnomalies() {
    const cs = this.universe.currentState;
    const ageGyr = cs.age / 1e9;
    
    this.autoCleanup();
    
    if (this.universe.anomalies.length >= MAX_ANOMALIES_PER_UNIVERSE) {
      console.log(`⚠️ Anomaly limit reached (${MAX_ANOMALIES_PER_UNIVERSE}), skipping generation`);
      return [];
    }
    
    const activity = Math.min(1, cs.galaxyCount / Math.max(1, this.constants.observableGalaxies));
    const baseProb = this.options.anomalyProbabilityScale * activity;

    console.log(`🎲 Anomaly generation check:`, {
      ageGyr: ageGyr.toFixed(2),
      galaxyCount: cs.galaxyCount.toExponential(2),
      starCount: cs.starCount.toExponential(2),
      activity: activity.toFixed(4),
      baseProb: baseProb.toFixed(6),
      existingAnomalies: this.universe.anomalies.length
    });

    const anomalyTypes = this.getAnomalyTypes();
    const created = [];
    const cap = Math.max(1, Math.floor(this.options.maxAnomalyPerStep));

    for (const def of anomalyTypes) {
      if (!def.condition(cs, ageGyr)) {
        console.log(`   ❌ ${def.id}: condition not met`);
        continue;
      }
      
      // Balanced probability: aims for 1-5% chance per eligible type per step
      const prob = def.probability * baseProb * 10000;
      const roll = this._rand();
      
      console.log(`   🎲 ${def.id}: prob=${prob.toFixed(6)}, roll=${roll.toFixed(6)}, ${roll < prob ? '✅ SPAWN' : '❌ skip'}`);
      
      if (roll < prob) {
        const severity = 1 + Math.floor(this._rand() * 3);
        const effects = def.effects(severity);
        
        // Spawn near player (within 1-4 chunks)
        const playerPos = this.options.playerPosition || { x: 0, y: 0 };
        const playerChunk = this._getChunkCoords(playerPos.x, playerPos.y);
        
        const minDistance = 1;
        const maxDistance = 4;
        
        const angle = this._rand() * Math.PI * 2;
        const distance = minDistance + this._rand() * (maxDistance - minDistance);
        
        const targetChunkX = playerChunk.chunkX + Math.floor(Math.cos(angle) * distance);
        const targetChunkY = playerChunk.chunkY + Math.floor(Math.sin(angle) * distance);
        
        const x = targetChunkX * CHUNK_SIZE + this._rand() * CHUNK_SIZE;
        const y = targetChunkY * CHUNK_SIZE + this._rand() * CHUNK_SIZE;
        
        const anomaly = {
          id: this.options.anomalyIdFactory(),
          type: def.id,
          category: def.category,
          severity,
          timestamp: new Date(),
          resolved: false,
          effectsRaw: effects,
          location: { x, y, z: (this._rand() - 0.5) * 1e4 },
          radius: 1000 * severity,
          description: def.description,
          decayRate: 0.001 * this._rand(),
        };
        
        created.push(anomaly);
        
        if (created.length >= cap) break;
      }
    }

    if (created.length > 0) {
      const playerChunk = this._getChunkCoords(this.options.playerPosition.x, this.options.playerPosition.y);
      console.log(`✨ Generated ${created.length} anomalies near player chunk (${playerChunk.chunkX}, ${playerChunk.chunkY})`);
      created.forEach(a => {
        console.log(`   → ${a.type} (severity: ${a.severity}) at (${a.location.x.toFixed(0)}, ${a.location.y.toFixed(0)})`);
      });
    }
    
    return created;
  }

  applyAnomalyEffects(effects = {}) {
    const cs = this.universe.currentState;
    if (!effects) return;

    if (typeof effects.stabilityImpact === "number") {
      cs.stabilityIndex = this._clamp(cs.stabilityIndex + effects.stabilityImpact, 0, 1);
    }
    if (typeof effects.expansionBoost === "number") {
      cs.expansionRate = cs.expansionRate * (1 + effects.expansionBoost);
    }
    if (typeof effects.scaleFactorBump === "number") {
      cs._scaleFactor = cs._scaleFactor * (1 + effects.scaleFactorBump);
    }
    if (typeof effects.localEntropyDecrease === "number") {
      cs.entropy = Math.max(0, cs.entropy + effects.localEntropyDecrease);
    }
    if (typeof effects.entropy === "number") {
      cs.entropy = Math.max(0, cs.entropy + effects.entropy);
    }
    if (typeof effects.starDeathCount === "number") {
      cs.starCount = Math.max(0, cs.starCount - effects.starDeathCount);
    }
    if (typeof effects.starFormationBurst === "number") {
      cs.starCount = cs.starCount + effects.starFormationBurst;
    }
    if (typeof effects.metallicityIncrease === "number") {
      cs.metallicity = this._clamp(cs.metallicity + effects.metallicityIncrease, 0, 1);
    }
    if (typeof effects.galaxyLoss === "number") {
      cs.galaxyCount = Math.max(0, cs.galaxyCount - effects.galaxyLoss);
    }
    if (typeof effects.habitabilityReduction === "number") {
      cs.habitableSystemsCount = Math.max(0, cs.habitableSystemsCount - effects.habitabilityReduction);
    }
    if (typeof effects.blackHoleFormation === "number") {
      cs.blackHoleCount = cs.blackHoleCount + effects.blackHoleFormation;
    }
  }

  decayUnresolvedAnomalies() {
    for (const anomaly of this.universe.anomalies) {
      if (!anomaly.resolved && anomaly.decayRate) {
        if (this._rand() < anomaly.decayRate) {
          if (anomaly.severity > 1) {
            anomaly.severity -= 0.1;
            this.universe.currentState.stabilityIndex = this._clamp(
              this.universe.currentState.stabilityIndex + 0.001,
              0,
              1
            );
          }
        }
      }
    }
  }

  resolveAnomaly(anomalyId) {
    const anomaly = this.universe.anomalies.find(
      a => a.id === anomalyId || a._id?.toString() === anomalyId
    );
    
    if (!anomaly || anomaly.resolved) {
      return { success: false, reason: "Anomaly not found or already resolved" };
    }

    anomaly.resolved = true;
    anomaly.resolvedAt = new Date();
    
    const cs = this.universe.currentState;
    
    const baseBoost = 0.015;
    const severityMultiplier = anomaly.severity;
    const stabilityBoost = baseBoost * severityMultiplier;
    
    cs.stabilityIndex = this._clamp(cs.stabilityIndex + stabilityBoost, 0, 1);
    
    const entropyReduction = 3e6 * severityMultiplier;
    cs.entropy = Math.max(0, cs.entropy - entropyReduction);
    
    cs.energyBudget = this._clamp(cs.energyBudget + 0.002 * severityMultiplier, 0, 1);
    
    this.universe.metrics.playerInterventions = 
      (this.universe.metrics.playerInterventions || 0) + 1;
    this.universe.metrics.anomaliesResolved = 
      (this.universe.metrics.anomaliesResolved || 0) + 1;
    
    const totalAnomalies = this.universe.anomalies.length;
    const resolvedCount = this.universe.anomalies.filter(a => a.resolved).length;
    this.universe.metrics.anomalyResolutionRate = 
      totalAnomalies > 0 ? resolvedCount / totalAnomalies : 0;
    
    return { 
      success: true, 
      stabilityBoost, 
      entropyReduction,
      anomaly 
    };
  }

  getAnomalyStats() {
    const anomalies = this.universe.anomalies || [];
    const active = anomalies.filter(a => !a.resolved);
    const resolved = anomalies.filter(a => a.resolved);

    const severityBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const a of active) {
      const sev = Math.floor(a.severity);
      severityBreakdown[sev] = (severityBreakdown[sev] || 0) + 1;
    }

    const categoryBreakdown = {};
    for (const a of active) {
      categoryBreakdown[a.category] = (categoryBreakdown[a.category] || 0) + 1;
    }

    return {
      total: anomalies.length,
      active: active.length,
      resolved: resolved.length,
      severityBreakdown,
      categoryBreakdown
    };
  }
}

module.exports = AnomalyGenerator;