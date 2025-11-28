const express = require("express");
const Universe = require("../models/Universe");
const verifyToken = require("../middleware/authMiddleware");
const PhysicsEngine = require("../utils/physicsEngine");

const router = express.Router();

// CREATE a new universe
router.post("/create", verifyToken, async (req, res) => {
  try {
    const { name, seed, difficulty, constants, initialConditions } = req.body;

    const newUniverse = new Universe({
      userId: req.user.id,
      name,
      seed,
      difficulty,
      constants,
      initialConditions,
      currentState: {
        age: 0,
        temperature: initialConditions?.initialTemperature || 1e32,
        expansionRate: 67.4,
        entropy: 0,
        stabilityIndex: 1.0,
        timeDialation: 1.0,
        galaxyCount: 0,
        starCount: 0,
        blackHoleCount: 0,
        habitableSystemsCount: 0,
        lifeBearingPlanetsCount: 0,
        civilizationCount: 0
      },
      metrics: {
        stabilityScore: 1,
        complexityIndex: 0,
        lifePotentialIndex: 0,
        playerInterventions: 0,
        anomalyResolutionRate: 0
      },
      status: 'active',
      endCondition: 'ongoing'
    });

    await newUniverse.save();
    res.status(201).json({ 
      message: "Universe created successfully", 
      universe: newUniverse 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all universes for the logged-in user
router.get("/", verifyToken, async (req, res) => {
  try {
    const universes = await Universe.find({ userId: req.user.id });
    res.json(universes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET a single universe by ID
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const universe = await Universe.findOne({ 
      _id: req.params.id, 
      userId: req.user.id 
    });
    
    if (!universe) {
      return res.status(404).json({ message: "Universe not found" });
    }
    
    res.json(universe);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE a universe's current state
router.put("/:id", verifyToken, async (req, res) => {
  try {
    const updatedUniverse = await Universe.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { 
        $set: {
          ...req.body,
          lastModified: new Date()
        }
      },
      { new: true, runValidators: true }
    );
    
    if (!updatedUniverse) {
      return res.status(404).json({ message: "Universe not found" });
    }
    
    res.json({ 
      message: "Universe updated successfully", 
      universe: updatedUniverse 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SIMULATE: Progress universe by N steps (with PhysicsEngine)
router.post("/:id/simulate", verifyToken, async (req, res) => {
  try {
    const { steps = 1 } = req.body;
    const universe = await Universe.findOne({ 
      _id: req.params.id, 
      userId: req.user.id 
    });

    if (!universe) {
      return res.status(404).json({ message: "Universe not found" });
    }

    // Check if universe has ended
    if (universe.status === 'ended') {
      return res.status(400).json({ 
        message: "Universe has ended", 
        endCondition: universe.endCondition 
      });
    }

    // Initialize Physics Engine and simulate
    const physicsEngine = new PhysicsEngine(universe);
    physicsEngine.simulateSteps(steps);

    // Check for end conditions
    physicsEngine.checkEndConditions();

    // Save updated universe
    universe.lastModified = new Date();
    await universe.save();

    res.json({ 
      message: `Universe simulated ${steps} step(s)`,
      currentState: universe.currentState,
      anomalies: universe.anomalies.filter(a => !a.resolved),
      metrics: universe.metrics,
      significantEvents: universe.significantEvents,
      statistics: physicsEngine.getStatistics()
    });
  } catch (err) {
    console.error("Simulation error:", err);
    res.status(500).json({ error: err.message });
  }
});

// RESOLVE PROCEDURAL ANOMALY (from game)
router.post("/:id/resolve-procedural-anomaly", verifyToken, async (req, res) => {
  try {
    const { type, severity, location } = req.body;
    const universe = await Universe.findOne({ 
      _id: req.params.id, 
      userId: req.user.id 
    });

    if (!universe) {
      return res.status(404).json({ message: "Universe not found" });
    }

    // Update metrics
    if (!universe.metrics) {
      universe.metrics = {};
    }
    
    universe.metrics.playerInterventions = (universe.metrics.playerInterventions || 0) + 1;
    
    // Calculate new resolution rate
    const totalAnomalies = universe.metrics.playerInterventions;
    universe.metrics.anomalyResolutionRate = 
      Math.min(1, (universe.metrics.playerInterventions / (totalAnomalies + 10)));

    // Small stability boost for resolving anomalies
    if (universe.currentState.stabilityIndex < 1) {
      universe.currentState.stabilityIndex = Math.min(
        1, 
        universe.currentState.stabilityIndex + 0.001
      );
    }

    universe.lastModified = new Date();
    await universe.save();

    res.json({ 
      message: "Procedural anomaly resolved",
      metrics: universe.metrics,
      stabilityBoost: 0.001
    });
  } catch (err) {
    console.error("Error resolving procedural anomaly:", err);
    res.status(500).json({ error: err.message });
  }
});

// RESOLVE GLOBAL ANOMALY (from DB)
router.patch("/:id/resolve-global-anomaly/:anomalyId", verifyToken, async (req, res) => {
  try {
    const { id, anomalyId } = req.params;
    const universe = await Universe.findOne({ 
      _id: id, 
      userId: req.user.id 
    });

    if (!universe) {
      return res.status(404).json({ message: "Universe not found" });
    }

    const anomaly = universe.anomalies.id(anomalyId);
    
    if (!anomaly) {
      return res.status(404).json({ message: "Anomaly not found" });
    }

    if (anomaly.resolved) {
      return res.status(400).json({ message: "Anomaly already resolved" });
    }

    // Mark as resolved
    anomaly.resolved = true;

    // Apply positive effects (reverse the negative impact)
    if (anomaly.effects && anomaly.effects.length > 0) {
      anomaly.effects.forEach(effect => {
        if (effect.parameter === 'stabilityImpact' && effect.magnitude < 0) {
          // Restore some stability
          universe.currentState.stabilityIndex = Math.min(
            1,
            universe.currentState.stabilityIndex + Math.abs(effect.magnitude) * 0.5
          );
        }
      });
    }

    // Update metrics
    universe.metrics.playerInterventions = (universe.metrics.playerInterventions || 0) + 1;

    universe.lastModified = new Date();
    await universe.save();

    res.json({ 
      message: "Global anomaly resolved", 
      anomaly,
      currentState: universe.currentState
    });
  } catch (err) {
    console.error("Error resolving global anomaly:", err);
    res.status(500).json({ error: err.message });
  }
});

// CLEANUP: Remove resolved anomalies
router.patch("/:id/cleanup-anomalies", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const universe = await Universe.findOne({ 
      _id: id, 
      userId: req.user.id 
    });

    if (!universe) {
      return res.status(404).json({ message: "Universe not found" });
    }

    const beforeCount = universe.anomalies.length;
    universe.anomalies = universe.anomalies.filter(a => !a.resolved);
    const afterCount = universe.anomalies.length;

    universe.lastModified = new Date();
    await universe.save();

    res.json({ 
      message: "Resolved anomalies cleaned up", 
      removed: beforeCount - afterCount,
      remaining: afterCount 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET STATISTICS: Detailed universe statistics
router.get("/:id/statistics", verifyToken, async (req, res) => {
  try {
    const universe = await Universe.findOne({ 
      _id: req.params.id, 
      userId: req.user.id 
    });

    if (!universe) {
      return res.status(404).json({ message: "Universe not found" });
    }

    const physicsEngine = new PhysicsEngine(universe);
    const statistics = physicsEngine.getStatistics();

    res.json({
      ...statistics,
      status: universe.status,
      endCondition: universe.endCondition,
      metrics: universe.metrics,
      anomalies: {
        total: universe.anomalies.length,
        resolved: universe.anomalies.filter(a => a.resolved).length,
        active: universe.anomalies.filter(a => !a.resolved).length
      },
      civilizations: {
        total: universe.civilizations.length,
        byType: {
          Type0: universe.civilizations.filter(c => c.type === 'Type0').length,
          Type1: universe.civilizations.filter(c => c.type === 'Type1').length,
          Type2: universe.civilizations.filter(c => c.type === 'Type2').length,
          Type3: universe.civilizations.filter(c => c.type === 'Type3').length
        }
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET TIMELINE: Significant events history
router.get("/:id/timeline", verifyToken, async (req, res) => {
  try {
    const universe = await Universe.findOne({ 
      _id: req.params.id, 
      userId: req.user.id 
    });

    if (!universe) {
      return res.status(404).json({ message: "Universe not found" });
    }

    const timeline = universe.significantEvents || [];
    
    res.json({
      events: timeline.sort((a, b) => 
        new Date(a.timestamp) - new Date(b.timestamp)
      ),
      totalEvents: timeline.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PAUSE/RESUME universe
router.patch("/:id/toggle-pause", verifyToken, async (req, res) => {
  try {
    const universe = await Universe.findOne({ 
      _id: req.params.id, 
      userId: req.user.id 
    });

    if (!universe) {
      return res.status(404).json({ message: "Universe not found" });
    }

    if (universe.status === 'ended') {
      return res.status(400).json({ 
        message: "Cannot pause/resume ended universe" 
      });
    }

    universe.status = universe.status === 'active' ? 'paused' : 'active';
    universe.lastModified = new Date();
    await universe.save();

    res.json({ 
      message: `Universe ${universe.status}`,
      status: universe.status 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// RESET universe to initial state
router.post("/:id/reset", verifyToken, async (req, res) => {
  try {
    const universe = await Universe.findOne({ 
      _id: req.params.id, 
      userId: req.user.id 
    });

    if (!universe) {
      return res.status(404).json({ message: "Universe not found" });
    }

    // Reset to initial state
    universe.currentState = {
      age: 0,
      temperature: universe.initialConditions?.initialTemperature || 1e32,
      expansionRate: 67.4,
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

    universe.anomalies = [];
    universe.civilizations = [];
    universe.significantEvents = [];
    
    universe.metrics = {
      stabilityScore: 1,
      complexityIndex: 0,
      lifePotentialIndex: 0,
      playerInterventions: 0,
      anomalyResolutionRate: 0
    };

    universe.status = 'active';
    universe.endCondition = 'ongoing';
    universe.lastModified = new Date();
    
    await universe.save();

    res.json({ 
      message: "Universe reset to initial state",
      universe 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE a universe
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const deleted = await Universe.findOneAndDelete({ 
      _id: req.params.id, 
      userId: req.user.id 
    });

    if (!deleted) {
      return res.status(404).json({ message: "Universe not found" });
    }

    res.json({ message: "Universe deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;