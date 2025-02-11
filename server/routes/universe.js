const express = require("express");
const Universe = require("../models/Universe");
const verifyToken = require("../middleware/authMiddleware");

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
    });

    await newUniverse.save();
    res.status(201).json({ message: "Universe created successfully", universe: newUniverse });
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
    const universe = await Universe.findOne({ _id: req.params.id, userId: req.user.id });
    if (!universe) return res.status(404).json({ message: "Universe not found" });
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
      { $set: req.body },
      { new: true }
    );
    if (!updatedUniverse) return res.status(404).json({ message: "Universe not found" });
    res.json({ message: "Universe updated successfully", universe: updatedUniverse });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE a universe
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    await Universe.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    res.json({ message: "Universe deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
