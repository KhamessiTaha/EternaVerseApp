// ml/generate_dataset.js - IMPROVED VERSION
const fs = require("fs");
const path = require("path");
const seedrandom = require("seedrandom");
const PhysicsEngine = require("../utils/physicsEngine");

const OUT_DIR = path.resolve(__dirname);
const OUT_JSONL = path.join(OUT_DIR, "training_samples.jsonl");
const STATS_FILE = path.join(OUT_DIR, "dataset_stats.json");

// ============================================================================
// FEATURE SCHEMA - Keep this order IDENTICAL in training & inference
// ============================================================================
const FEATURE_SCHEMA = [
  'age',
  'galaxyCount', 
  'starCount',
  'blackHoleCount',
  'expansionRate',
  'temperature',
  'entropy',
  'habitableSystemsCount',
  'lifeBearingPlanetsCount',
  'civilizationCount',
  'metallicity',
  'stellarGenerations',
  'stabilityIndex',
  'energyBudget',
  'darkEnergyDensity',
  'darkMatterDensity',
  'matterDensity',
  'cosmicInflationRate',
  'quantumFluctuations',
  'matterAntimatterRatio',
  'scaleFactor'
];

const TARGET_SCHEMA = [
  'age',
  'galaxyCount',
  'starCount', 
  'blackHoleCount',
  'expansionRate',
  'temperature',
  'entropy',
  'habitableSystemsCount',
  'lifeBearingPlanetsCount',
  'civilizationCount',
  'metallicity',
  'stellarGenerations',
  'stabilityIndex',
  'energyBudget'
];

// ============================================================================
// NORMALIZATION RANGES
// ============================================================================
const NORMALIZATION_RANGES = {
  age: { min: 0, max: 2e10, log: false },
  galaxyCount: { min: 0, max: 3e11, log: true },
  starCount: { min: 0, max: 1e24, log: true },
  blackHoleCount: { min: 0, max: 1e20, log: true },
  expansionRate: { min: 0, max: 200, log: false },
  temperature: { min: 0.01, max: 1e6, log: true },
  entropy: { min: 0, max: 1e16, log: true },
  habitableSystemsCount: { min: 0, max: 1e18, log: true },
  lifeBearingPlanetsCount: { min: 0, max: 1e15, log: true },
  civilizationCount: { min: 0, max: 1e8, log: true },
  metallicity: { min: 0, max: 1, log: false },
  stellarGenerations: { min: 0, max: 10, log: false },
  stabilityIndex: { min: 0, max: 1, log: false },
  energyBudget: { min: 0, max: 1, log: false },
  darkEnergyDensity: { min: 0.5, max: 0.9, log: false },
  darkMatterDensity: { min: 0.1, max: 0.4, log: false },
  matterDensity: { min: 0.01, max: 0.15, log: false },
  cosmicInflationRate: { min: 0.1, max: 3, log: false },
  quantumFluctuations: { min: 1e-7, max: 1e-3, log: true },
  matterAntimatterRatio: { min: 0.9, max: 1.2, log: false },
  scaleFactor: { min: 1, max: 1e10, log: true }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function normalizeValue(value, key) {
  const range = NORMALIZATION_RANGES[key];
  if (!range) {
    console.warn(`No normalization range for ${key}, using raw value`);
    return value;
  }
  
  let normalized = value;
  
  if (range.log && value > 0) {
    normalized = Math.log10(value + 1);
    const logMin = Math.log10(range.min + 1);
    const logMax = Math.log10(range.max + 1);
    normalized = (normalized - logMin) / (logMax - logMin);
  } else {
    normalized = (value - range.min) / (range.max - range.min);
  }
  
  return Math.max(-0.1, Math.min(1.1, normalized));
}

function extractFeatures(universe) {
  const s = universe.currentState || {};
  const c = universe.constants || {};
  const ic = universe.initialConditions || {};
  
  const raw = {
    age: s.age || 0,
    galaxyCount: s.galaxyCount || 0,
    starCount: s.starCount || 0,
    blackHoleCount: s.blackHoleCount || 0,
    expansionRate: s.expansionRate || 0,
    temperature: s.temperature || 2.725,
    entropy: s.entropy || 0,
    habitableSystemsCount: s.habitableSystemsCount || 0,
    lifeBearingPlanetsCount: s.lifeBearingPlanetsCount || 0,
    civilizationCount: s.civilizationCount || 0,
    metallicity: s.metallicity || 0,
    stellarGenerations: s.stellarGenerations || 0,
    stabilityIndex: s.stabilityIndex || 1.0,
    energyBudget: s.energyBudget || 1.0,
    darkEnergyDensity: c.darkEnergyDensity ?? 0.69,
    darkMatterDensity: c.darkMatterDensity ?? 0.26,
    matterDensity: c.matterDensity ?? 0.05,
    cosmicInflationRate: ic.cosmicInflationRate ?? 1.0,
    quantumFluctuations: ic.quantumFluctuations ?? 1e-5,
    matterAntimatterRatio: ic.matterAntimatterRatio ?? 1.0000001,
    scaleFactor: s._scaleFactor || 1.0
  };
  
  const normalized = FEATURE_SCHEMA.map(key => normalizeValue(raw[key], key));
  return { raw, normalized };
}

function extractTargets(universe) {
  const s = universe.currentState || {};
  
  const raw = {
    age: s.age || 0,
    galaxyCount: s.galaxyCount || 0,
    starCount: s.starCount || 0,
    blackHoleCount: s.blackHoleCount || 0,
    expansionRate: s.expansionRate || 0,
    temperature: s.temperature || 2.725,
    entropy: s.entropy || 0,
    habitableSystemsCount: s.habitableSystemsCount || 0,
    lifeBearingPlanetsCount: s.lifeBearingPlanetsCount || 0,
    civilizationCount: s.civilizationCount || 0,
    metallicity: s.metallicity || 0,
    stellarGenerations: s.stellarGenerations || 0,
    stabilityIndex: s.stabilityIndex || 1.0,
    energyBudget: s.energyBudget || 1.0
  };
  
  const normalized = TARGET_SCHEMA.map(key => normalizeValue(raw[key], key));
  return { raw, normalized };
}

function createRealisticUniverse(seed, rng) {
  const darkEnergyDensity = 0.65 + rng() * 0.1;
  const darkMatterDensity = 0.20 + rng() * 0.15;
  const matterDensity = 0.03 + rng() * 0.04;
  const cosmicInflationRate = 0.5 + rng() * 2.0;
  const quantumFluctuations = Math.pow(10, -6 + rng() * 3);
  const matterAntimatterRatio = 1.0 + (rng() - 0.5) * 0.0001;
  
  return {
    seed,
    constants: {
      gravitationalConstant: 6.6743e-11,
      speedOfLight: 299792458,
      planckConstant: 6.626e-34,
      darkEnergyDensity,
      darkMatterDensity,
      matterDensity,
      H0_km_s_Mpc: 67.4,
      observableGalaxies: 2e11,
      averageStarsPerGalaxy: 1e10
    },
    initialConditions: {
      matterAntimatterRatio,
      quantumFluctuations,
      cosmicInflationRate,
      initialTemperature: 1e32,
      initialDensity: 1e97
    },
    currentState: {
      age: 0,
      galaxyCount: 0,
      starCount: 0,
      blackHoleCount: 0,
      temperature: 2.725,
      entropy: 0,
      metallicity: 0,
      stellarGenerations: 0,
      stabilityIndex: 1.0,
      energyBudget: 1.0,
      _scaleFactor: 1.0,
      expansionRate: 67.4
    },
    anomalies: [],
    significantEvents: [],
    civilizations: [],
    metrics: {},
    milestones: {
      firstGalaxy: false,
      firstStar: false,
      firstLife: false,
      firstCivilization: false,
      stellarPopulationI: false,
      complexLifeEra: false,
      technologicalSingularity: false
    }
  };
}

function updateStats(stats, rawFeatures, rawTargets, phase) {
  for (const key of FEATURE_SCHEMA) {
    if (!stats.featureRanges[key]) {
      stats.featureRanges[key] = { min: Infinity, max: -Infinity };
    }
    const val = rawFeatures[key];
    if (val < stats.featureRanges[key].min) stats.featureRanges[key].min = val;
    if (val > stats.featureRanges[key].max) stats.featureRanges[key].max = val;
  }
  
  for (const key of TARGET_SCHEMA) {
    if (!stats.targetRanges[key]) {
      stats.targetRanges[key] = { min: Infinity, max: -Infinity };
    }
    const val = rawTargets[key];
    if (val < stats.targetRanges[key].min) stats.targetRanges[key].min = val;
    if (val > stats.targetRanges[key].max) stats.targetRanges[key].max = val;
  }
  
  stats.phaseDistribution[phase] = (stats.phaseDistribution[phase] || 0) + 1;
}

// ============================================================================
// MAIN GENERATION FUNCTION
// ============================================================================

async function generateSyntheticDataset(nSamples = 10000, options = {}) {
  const {
    mode = "diverse",
    stepsPerUniverse = 50,
    earlyUniverseBias = 0.3,
    outputRaw = false
  } = options;
  
  console.log(`\n🔬 Generating ${nSamples} synthetic training samples...`);
  console.log(`   Mode: ${mode === "diverse" ? "Diverse universes" : "Sequential trajectories"}`);
  console.log(`   Steps per universe: ${mode === "diverse" ? 1 : stepsPerUniverse}`);
  console.log(`   Early universe bias: ${(earlyUniverseBias * 100).toFixed(0)}%\n`);
  
  const out = fs.createWriteStream(OUT_JSONL, { flags: "w" });
  const stats = {
    totalSamples: 0,
    universes: 0,
    featureRanges: {},
    targetRanges: {},
    phaseDistribution: {}
  };
  
  let generated = 0;
  let uniCount = 0;
  
  if (mode === "diverse") {
    while (generated < nSamples) {
      uniCount++;
      const seed = `synth_${Date.now()}_${uniCount}_${Math.random().toString(36).slice(2)}`;
      const rng = seedrandom(seed);
      
      const uni = createRealisticUniverse(seed, rng);
      
      const shouldFastForward = rng() > earlyUniverseBias;
      const fastForwardSteps = shouldFastForward ? Math.floor(rng() * 150) : 0;
      
      if (fastForwardSteps > 0) {
        const tempEngine = new PhysicsEngine(JSON.parse(JSON.stringify(uni)), {
          timeStepYears: 1e8,
          seed: seed + "_ff"
        });
        tempEngine.simulateSteps(fastForwardSteps);
        Object.assign(uni.currentState, tempEngine.universe.currentState);
      }
      
      const engine = new PhysicsEngine(uni, {
        timeStepYears: 1e7,
        seed: seed + "_sim"
      });
      
      const featuresData = extractFeatures(engine.universe);
      engine.simulateStep();
      const targetsData = extractTargets(engine.universe);
      
      const sample = {
        features: featuresData.normalized,
        targets: targetsData.normalized,
        meta: {
          seed,
          universeIndex: uniCount,
          ageGyr: (featuresData.raw.age / 1e9).toFixed(3),
          phase: engine.universe.currentState.cosmicPhase
        }
      };
      
      if (outputRaw) {
        sample.raw_features = featuresData.raw;
        sample.raw_targets = targetsData.raw;
      }
      
      out.write(JSON.stringify(sample) + "\n");
      updateStats(stats, featuresData.raw, targetsData.raw, engine.universe.currentState.cosmicPhase);
      
      generated++;
      if (generated % 1000 === 0) {
        process.stdout.write(`   Generated: ${generated.toLocaleString()} / ${nSamples.toLocaleString()} (${((generated/nSamples)*100).toFixed(1)}%)\r`);
      }
    }
  } else {
    while (generated < nSamples) {
      uniCount++;
      const seed = `synth_${Date.now()}_${uniCount}_${Math.random().toString(36).slice(2)}`;
      const rng = seedrandom(seed);
      
      let uni = createRealisticUniverse(seed, rng);
      
      const shouldFastForward = rng() > earlyUniverseBias;
      const fastForwardSteps = shouldFastForward ? Math.floor(rng() * 100) : 0;
      
      if (fastForwardSteps > 0) {
        const tempEngine = new PhysicsEngine(JSON.parse(JSON.stringify(uni)), {
          timeStepYears: 1e8,
          seed: seed + "_ff"
        });
        tempEngine.simulateSteps(fastForwardSteps);
        uni = tempEngine.universe;
      }
      
      const engine = new PhysicsEngine(uni, {
        timeStepYears: 1e7,
        seed: seed + "_sim"
      });
      
      for (let step = 0; step < stepsPerUniverse && generated < nSamples; step++) {
        const featuresData = extractFeatures(engine.universe);
        engine.simulateStep();
        const targetsData = extractTargets(engine.universe);
        
        const sample = {
          features: featuresData.normalized,
          targets: targetsData.normalized,
          meta: {
            seed,
            universeIndex: uniCount,
            step,
            ageGyr: (featuresData.raw.age / 1e9).toFixed(3),
            phase: engine.universe.currentState.cosmicPhase
          }
        };
        
        if (outputRaw) {
          sample.raw_features = featuresData.raw;
          sample.raw_targets = targetsData.raw;
        }
        
        out.write(JSON.stringify(sample) + "\n");
        updateStats(stats, featuresData.raw, targetsData.raw, engine.universe.currentState.cosmicPhase);
        
        generated++;
        if (generated % 1000 === 0) {
          process.stdout.write(`   Generated: ${generated.toLocaleString()} / ${nSamples.toLocaleString()} (${((generated/nSamples)*100).toFixed(1)}%)\r`);
        }
      }
    }
  }
  
  out.end();
  stats.totalSamples = generated;
  stats.universes = uniCount;
  
  fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
  
  console.log(`\n\n✅ Dataset generation complete!`);
  console.log(`   Total samples: ${generated.toLocaleString()}`);
  console.log(`   Universes simulated: ${uniCount.toLocaleString()}`);
  console.log(`   Output file: ${OUT_JSONL}`);
  console.log(`   Statistics: ${STATS_FILE}`);
  console.log(`\n📊 Phase distribution:`);
  Object.entries(stats.phaseDistribution).forEach(([phase, count]) => {
    console.log(`   ${phase}: ${count} (${((count/generated)*100).toFixed(1)}%)`);
  });
}

// ============================================================================
// CLI
// ============================================================================

(async function main() {
  const args = process.argv.slice(2);
  const nSamples = parseInt(args[0]) || 10000;
  const mode = args[1] || "diverse";
  const stepsPerUniverse = parseInt(args[2]) || 50;
  const outputRaw = args.includes("--raw");
  
  if (!["diverse", "trajectories"].includes(mode)) {
    console.error("❌ Mode must be 'diverse' or 'trajectories'");
    process.exit(1);
  }
  
  try {
    if (fs.existsSync(OUT_JSONL)) {
      console.log(`⚠️  Overwriting existing file: ${OUT_JSONL}`);
    }
    
    await generateSyntheticDataset(nSamples, {
      mode,
      stepsPerUniverse,
      outputRaw,
      earlyUniverseBias: 0.3
    });
    
    console.log(`\n✨ Next steps:`);
    console.log(`   1. Review ${STATS_FILE} to verify data ranges`);
    console.log(`   2. Train your ML model using ${OUT_JSONL}`);
    console.log(`   3. Use the same FEATURE_SCHEMA order for inference!\n`);
    
  } catch (err) {
    console.error("\n❌ Error:", err.message);
    console.error(err.stack);
    process.exit(1);
  }
})();

module.exports = {
  FEATURE_SCHEMA,
  TARGET_SCHEMA,
  NORMALIZATION_RANGES,
  normalizeValue,
  extractFeatures,
  extractTargets
};