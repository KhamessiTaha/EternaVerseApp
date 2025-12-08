const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const AnomalySchema = new Schema({
  id: { type: String, required: true, index: true },
  type: { type: String, required: true, index: true },
  category: { type: String, enum: ["gravitational", "cosmological", "stellar", "quantum", "structural", "electromagnetic"], index: true },
  severity: { type: Number, default: 1, min: 1, max: 5 },
  timestamp: { type: Date, default: Date.now, index: true },
  resolved: { type: Boolean, default: false, index: true },
  resolvedAt: { type: Date, default: null },
  effectsRaw: { type: Schema.Types.Mixed, default: {} },
  location: {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
    z: { type: Number, default: 0 }
  },
  radius: { type: Number, default: 0 },
  description: { type: String },
  decayRate: { type: Number, default: 0 }
}, { _id: false });

const CivilisationSchema = new Schema({
  id: { type: String, required: true },
  type: { type: String, enum: ["Type0", "Type1", "Type2", "Type3"], default: "Type0" },
  createdAt: { type: Date, default: Date.now },
  age: { type: Number, default: 0 },
  developmentLevel: { type: Number, default: 0, min: 0, max: 1 },
  technology: { type: Number, default: 0, min: 0, max: 100 },
  stability: { type: Number, default: 0.5, min: 0, max: 1 },
  extinct: { type: Boolean, default: false }
}, { _id: false });

const SignificantEventSchema = new Schema({
  timestamp: { type: Date, default: Date.now },
  age: { type: Number, required: true },
  ageGyr: { type: String },
  type: { type: String, required: true },
  description: { type: String },
  effects: { type: Schema.Types.Mixed }
}, { _id: false });

const MilestonesSchema = new Schema({
  firstGalaxy: { type: Boolean, default: false },
  firstStar: { type: Boolean, default: false },
  firstLife: { type: Boolean, default: false },
  firstCivilization: { type: Boolean, default: false },
  stellarPopulationI: { type: Boolean, default: false },
  complexLifeEra: { type: Boolean, default: false },
  technologicalSingularity: { type: Boolean, default: false }
}, { _id: false });

const ConstantsSchema = new Schema({
  H0_km_s_Mpc: { type: Number, default: 67.4 },
  speedOfLight: { type: Number, default: 2.99792458e8 },
  gravitationalConstant: { type: Number, default: 6.6743e-11 },
  darkMatterDensity: { type: Number, default: 0.26 },
  darkEnergyDensity: { type: Number, default: 0.69 },
  matterDensity: { type: Number, default: 0.05 },
  observableGalaxies: { type: Number, default: 2e11 },
  averageStarsPerGalaxy: { type: Number, default: 1e10 },
  planckTemperature: { type: Number, default: 1.417e32 }
}, { _id: false });

const CurrentStateSchema = new Schema({
  age: { type: Number, default: 0, min: 0 },
  _scaleFactor: { type: Number, default: 1.0, min: 0 },
  expansionRate: { type: Number, default: 67.4 },
  temperature: { type: Number, default: 2.725, min: 0 },
  entropy: { type: Number, default: 0, min: 0 },
  stabilityIndex: { type: Number, default: 1.0, min: 0, max: 1 },
  galaxyCount: { type: Number, default: 0, min: 0 },
  starCount: { type: Number, default: 0, min: 0 },
  blackHoleCount: { type: Number, default: 0, min: 0 },
  habitableSystemsCount: { type: Number, default: 0, min: 0 },
  lifeBearingPlanetsCount: { type: Number, default: 0, min: 0 },
  civilizationCount: { type: Number, default: 0, min: 0 },
  metallicity: { type: Number, default: 0, min: 0, max: 1 },
  cosmicPhase: { 
    type: String, 
    enum: ["dark_ages", "reionization", "galaxy_formation", "stellar_peak", "gradual_decline", "twilight_era", "degenerate_era"],
    default: "dark_ages" 
  },
  stellarGenerations: { type: Number, default: 0, min: 0 },
  energyBudget: { type: Number, default: 1.0, min: 0, max: 1 }
}, { _id: false });

const MetricsSchema = new Schema({
  playerInterventions: { type: Number, default: 0 },
  anomalyResolutionRate: { type: Number, default: 0 },
  anomaliesResolved: { type: Number, default: 0 },
  stabilityScore: { type: Number, default: 1.0 },
  stabilityTrend: { type: Number, default: 0 },
  complexityIndex: { type: Number, default: 0 },
  lifePotentialIndex: { type: Number, default: 0 },
  cosmicHealth: { type: Number, default: 1.0 }
}, { _id: false });

const UniverseSchema = new Schema({
  name: { type: String, required: true, trim: true, index: true },
  seed: { 
    type: String, 
    default: () => Math.random().toString(36).slice(2),
    index: true,
    unique: false 
  },
  difficulty: { 
    type: String, 
    enum: ["Beginner", "Intermediate", "Advanced"], 
    default: "Beginner",
    index: true
  },
  constants: { type: ConstantsSchema, default: () => ({}) },
  initialConditions: {
    initialTemperature: { type: Number, default: 2.725 }
  },
  currentState: { type: CurrentStateSchema, default: () => ({}) },
  anomalies: { type: [AnomalySchema], default: [] },
  civilizations: { type: [CivilisationSchema], default: [] },
  significantEvents: { type: [SignificantEventSchema], default: [] },
  milestones: { type: MilestonesSchema, default: () => ({}) },
  metrics: { type: MetricsSchema, default: () => ({}) },

  status: { 
    type: String, 
    enum: ["running", "paused", "ended"], 
    default: "running",
    index: true
  },
  endCondition: { type: String, default: null },
  endReason: { type: String, default: null },

  createdAt: { type: Date, default: Date.now, index: true },
  lastModified: { type: Date, default: Date.now, index: true }
}, {
  timestamps: false, // We handle timestamps manually
  minimize: false // Don't remove empty objects
});

// Compound indexes for common queries
UniverseSchema.index({ status: 1, lastModified: -1 });
UniverseSchema.index({ difficulty: 1, status: 1 });

// Virtual for age in Gyr (convenient for queries)
UniverseSchema.virtual('ageGyr').get(function() {
  return this.currentState?.age ? (this.currentState.age / 1e9).toFixed(3) : '0.000';
});

// Virtual for active anomaly count
UniverseSchema.virtual('activeAnomalyCount').get(function() {
  return this.anomalies?.filter(a => !a.resolved).length || 0;
});

// Pre-save hook to update lastModified
UniverseSchema.pre('save', function(next) {
  this.lastModified = new Date();
  next();
});

// Method to get summary (without large arrays)
UniverseSchema.methods.getSummary = function() {
  return {
    _id: this._id,
    name: this.name,
    seed: this.seed,
    difficulty: this.difficulty,
    status: this.status,
    endCondition: this.endCondition,
    endReason: this.endReason,
    currentState: this.currentState,
    metrics: this.metrics,
    milestones: this.milestones,
    activeAnomalies: this.anomalies?.filter(a => !a.resolved).length || 0,
    totalAnomalies: this.anomalies?.length || 0,
    civilizationCount: this.civilizations?.length || 0,
    advancedCivilizations: this.civilizations?.filter(c => c.type !== "Type0").length || 0,
    createdAt: this.createdAt,
    lastModified: this.lastModified,
    ageGyr: this.ageGyr
  };
};

// Static method to cleanup old resolved anomalies across all universes
UniverseSchema.statics.cleanupAllResolvedAnomalies = async function(keepRecentMinutes = 60) {
  const cutoffTime = new Date(Date.now() - keepRecentMinutes * 60 * 1000);
  
  const universes = await this.find({ status: 'running' });
  let totalCleaned = 0;
  
  for (const uni of universes) {
    const before = uni.anomalies.length;
    
    uni.anomalies = uni.anomalies.filter(a => 
      !a.resolved || 
      !a.resolvedAt || 
      new Date(a.resolvedAt) > cutoffTime
    );
    
    const removed = before - uni.anomalies.length;
    
    if (removed > 0) {
      uni.markModified('anomalies');
      await uni.save();
      totalCleaned += removed;
    }
  }
  
  return totalCleaned;
};

module.exports = mongoose.model("Universe", UniverseSchema);