const mongoose = require("mongoose");

// Sub-schemas for better organization
const constantsSchema = new mongoose.Schema({
  // Fundamental Forces
  gravitationalConstant: { 
    type: Number, 
    default: 6.67430e-11,
    validate: {
      validator: function(v) {
        return v >= 6.67e-11 && v <= 6.68e-11;
      },
      message: 'G must be within viable universe range'
    }
  },
  speedOfLight: { 
    type: Number, 
    default: 299792458, 
    validate: {
      validator: function(v) {
        return v >= 299000000 && v <= 300000000;
      },
      message: 'c must be within viable universe range'
    }
  },
  planckConstant: { 
    type: Number, 
    default: 6.626e-34 
  },
  fineStructureConstant: { 
    type: Number, 
    default: 0.007297 
  },
  
  // Coupling Constants
  strongCouplingConstant: { 
    type: Number, 
    default: 0.1179 
  },
  weakCouplingConstant: { 
    type: Number, 
    default: 1.166e-5 
  },
  
  // Cosmological Parameters
  darkEnergyDensity: { 
    type: Number, 
    default: 0.7 
  },
  darkMatterDensity: { 
    type: Number, 
    default: 0.26 
  },
  matterDensity: { 
    type: Number, 
    default: 0.04 
  },
  
  // Particle Masses
  electronMass: { 
    type: Number, 
    default: 9.1093837e-31 
  },
  protonMass: { 
    type: Number, 
    default: 1.67262192e-27 
  }
});

const anomalySchema = new mongoose.Schema({
  type: {
    type: String,
    enum: [
      'quantumTunneling',
      'darkEnergySurge',
      'blackHoleMerger',
      'supernovaChain',
      'falseVacuumDecay',
      'cosmicStringCollision'
    ]
  },
  severity: {
    type: Number,
    min: 1,
    max: 10
  },
  location: {
    x: Number,
    y: Number,
    z: Number
  },
  radius: Number,
  timestamp: Date,
  resolved: Boolean,
  effects: [{
    parameter: String,
    magnitude: Number,
    duration: Number
  }]
});

const civilizationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['Type0', 'Type1', 'Type2', 'Type3']
  },
  location: {
    galaxyId: String,
    coordinates: {
      x: Number,
      y: Number,
      z: Number
    }
  },
  developmentLevel: Number,
  technologicalProgress: Number,
  survivability: Number
});

const universeSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  name: { 
    type: String, 
    required: true,
    unique: true 
  },
  seed: {
    type: String,
    required: true,
    unique: true
  },
  difficulty: { 
    type: String, 
    enum: ["Beginner", "Intermediate", "Advanced"], 
    required: true 
  },
  
  // Physics Configuration
  constants: constantsSchema,
  
  // Initial Conditions
  initialConditions: {
    matterAntimatterRatio: { type: Number, default: 1.0000001 },
    quantumFluctuations: { type: Number, default: 1e-5 },
    cosmicInflationRate: { type: Number, default: 1.0 },
    initialTemperature: { type: Number, default: 1e32 }, // Kelvin
    initialDensity: { type: Number, default: 1e97 } // kg/m³
  },
  
  // Current State
  currentState: {
    age: { type: Number, default: 0 },
    temperature: { type: Number, default: 2.725 }, // Current CMB temperature
    expansionRate: { type: Number, default: 67.4 }, // km/s/Mpc
    entropy: { type: Number, default: 0 },
    stabilityIndex: { type: Number, default: 1.0 },
    timeDialation: { type: Number, default: 1.0 },
    
    // Structure Formation
    galaxyCount: { type: Number, default: 0 },
    starCount: { type: Number, default: 0 },
    blackHoleCount: { type: Number, default: 0 },
    
    // Life and Civilization
    habitableSystemsCount: { type: Number, default: 0 },
    lifeBearingPlanetsCount: { type: Number, default: 0 },
    civilizationCount: { type: Number, default: 0 }
  },
  
  // Dynamic Elements
  anomalies: [anomalySchema],
  civilizations: [civilizationSchema],
  
  // Timeline Events
  significantEvents: [{
    timestamp: Date,
    type: String,
    description: String,
    effects: Object
  }],
  
  // Performance Metrics
  metrics: {
    stabilityScore: { type: Number, default: 1 },
    complexityIndex: { type: Number, default: 1 },
    lifePotentialIndex: { type: Number, default: 0 },
    playerInterventions: { type: Number, default: 0 },
    anomalyResolutionRate: { type: Number, default: 0 }
  },
  
  // Meta Information
  status: {
    type: String,
    enum: ['active', 'paused', 'ended'],
    default: 'active'
  },
  endCondition: {
    type: String,
    enum: ['ongoing', 'heat-death', 'big-crunch', 'vacuum-decay', 'player-reset']
  },
  createdAt: { type: Date, default: Date.now },
  lastModified: { type: Date, default: Date.now }
}, {
  timestamps: true
});

const Universe = mongoose.model("Universe", universeSchema);
module.exports = Universe;