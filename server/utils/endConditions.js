/**
 * End Conditions Module
 * Handles all universe ending scenarios
 */

class EndConditions {
  constructor(universe, options = {}) {
    if (!universe) throw new Error("EndConditions requires a universe object");

    this.universe = universe;
    this.options = {
      difficultyModifier: options.difficultyModifier ?? 1.0,
      stabilityHistory: options.stabilityHistory || [],
      ...options
    };
  }

  /**
   * Check all end conditions and return if universe should end
   * @returns {boolean} - true if universe has ended
   */
  checkEndConditions() {
    const cs = this.universe.currentState;
    const ageGyr = cs.age / 1e9;
    
    // Adjust thresholds based on difficulty (higher difficulty = easier to end)
    const diffMod = this.options.difficultyModifier ?? 1.0;
    const stabilityThreshold = 0.05 / diffMod; // FIXED: Was 0.01, now 0.05 base (more forgiving)
    const heatDeathAge = 200 / diffMod; // FIXED: Was 150, now 200 (longer lifespan)
    
    // Critical instability (sustained low stability)
    if (cs.stabilityIndex < stabilityThreshold) {
      // Check if stability has been low for multiple steps
      const recentStability = this.options.stabilityHistory.slice(-10); // FIXED: check more history
      
      if (recentStability.length >= 10) {
        const avgRecent = recentStability.reduce((a, b) => a + b, 0) / recentStability.length;
        
        if (avgRecent < stabilityThreshold * 2) { // FIXED: Was 1.5, now 2.0 (more forgiving)
          this.universe.status = "ended";
          this.universe.endCondition = "instability-collapse";
          this.universe.endReason = `Sustained stability below ${(stabilityThreshold * 100).toFixed(1)}% for extended period`;
          this.universe.finalAge = ageGyr;
          return true;
        }
      }
    }
    
    // Heat death (extreme age AND low energy)
    // FIXED: Both conditions must be true, not just age
    if (ageGyr > heatDeathAge && cs.energyBudget < 0.05) {
      this.universe.status = "ended";
      this.universe.endCondition = "heat-death";
      this.universe.endReason = `Universe reached ${ageGyr.toFixed(1)} Gyr with energy exhausted - thermal equilibrium achieved`;
      this.universe.finalAge = ageGyr;
      return true;
    }
    
    // Stellar death scenario (mid-age with no stars)
    // FIXED: Only trigger if age is substantial AND stars depleted
    if (ageGyr > 80 && cs.starCount < 1e4 && cs.energyBudget < 0.08) {
      this.universe.status = "ended";
      this.universe.endCondition = "stellar-death";
      this.universe.endReason = "All stars have died - universe entering dark era";
      this.universe.finalAge = ageGyr;
      return true;
    }
    
    // Big Rip (runaway expansion)
    if (cs._scaleFactor > 1e9) {
      this.universe.status = "ended";
      this.universe.endCondition = "big-rip";
      this.universe.endReason = "Expansion exceeded critical threshold - universe torn apart";
      this.universe.finalAge = ageGyr;
      return true;
    }
    
    // Big Crunch (collapse - very rare)
    if (cs._scaleFactor < 1e-8) {
      this.universe.status = "ended";
      this.universe.endCondition = "big-crunch";
      this.universe.endReason = "Universe collapsed back to singularity";
      this.universe.finalAge = ageGyr;
      return true;
    }
    
    // Entropy death (maximum disorder)
    // FIXED: Increased threshold and added energy check
    if (cs.entropy > 2e15 && cs.energyBudget < 0.02) {
      this.universe.status = "ended";
      this.universe.endCondition = "maximum-entropy";
      this.universe.endReason = "Maximum entropy reached - no free energy remains";
      this.universe.finalAge = ageGyr;
      return true;
    }
    
    return false;
  }

  /**
   * Get warnings about approaching end conditions
   * @returns {Array} - array of warning objects
   */
  getWarnings() {
    const cs = this.universe.currentState;
    const ageGyr = cs.age / 1e9;
    const warnings = [];
    
    const diffMod = this.options.difficultyModifier ?? 1.0;
    const stabilityThreshold = 0.05 / diffMod;
    const heatDeathAge = 200 / diffMod;

    // Stability warning
    if (cs.stabilityIndex < stabilityThreshold * 3 && cs.stabilityIndex > stabilityThreshold) {
      warnings.push({
        severity: "high",
        type: "stability",
        message: `Stability approaching critical threshold (${(cs.stabilityIndex * 100).toFixed(1)}%)`,
        recommendation: "Resolve anomalies immediately to restore stability"
      });
    }

    // Age warning
    if (ageGyr > heatDeathAge * 0.8) {
      warnings.push({
        severity: "medium",
        type: "age",
        message: `Universe age approaching heat death threshold (${ageGyr.toFixed(1)} / ${heatDeathAge.toFixed(0)} Gyr)`,
        recommendation: "Maintain energy budget and stellar population"
      });
    }

    // Entropy warning
    if (cs.entropy > 1.5e15) {
      warnings.push({
        severity: "medium",
        type: "entropy",
        message: "Entropy levels dangerously high",
        recommendation: "Resolve quantum anomalies to restore order"
      });
    }

    // Energy warning
    if (cs.energyBudget < 0.15) {
      warnings.push({
        severity: "high",
        type: "energy",
        message: `Energy budget critically low (${(cs.energyBudget * 100).toFixed(1)}%)`,
        recommendation: "Prevent further anomalies and maintain stellar populations"
      });
    }

    // Expansion warning
    if (cs._scaleFactor > 1e8) {
      warnings.push({
        severity: "critical",
        type: "expansion",
        message: "Expansion rate approaching Big Rip scenario",
        recommendation: "Address dark energy anomalies immediately"
      });
    }

    return warnings;
  }

  /**
   * Get detailed end condition status
   * @returns {Object} - status of all end conditions
   */
  getEndConditionStatus() {
    const cs = this.universe.currentState;
    const ageGyr = cs.age / 1e9;
    const diffMod = this.options.difficultyModifier ?? 1.0;

    return {
      instabilityCollapse: {
        triggered: cs.stabilityIndex < (0.05 / diffMod),
        threshold: (0.05 / diffMod) * 100,
        current: cs.stabilityIndex * 100,
        percentToThreshold: (cs.stabilityIndex / (0.05 / diffMod)) * 100
      },
      heatDeath: {
        triggered: ageGyr > (200 / diffMod) && cs.energyBudget < 0.05,
        ageThreshold: 200 / diffMod,
        currentAge: ageGyr,
        energyThreshold: 5,
        currentEnergy: cs.energyBudget * 100,
        percentToAge: (ageGyr / (200 / diffMod)) * 100
      },
      bigRip: {
        triggered: cs._scaleFactor > 1e9,
        threshold: 1e9,
        current: cs._scaleFactor,
        percentToThreshold: (cs._scaleFactor / 1e9) * 100
      },
      bigCrunch: {
        triggered: cs._scaleFactor < 1e-8,
        threshold: 1e-8,
        current: cs._scaleFactor
      },
      maximumEntropy: {
        triggered: cs.entropy > 2e15 && cs.energyBudget < 0.02,
        threshold: 2e15,
        current: cs.entropy,
        percentToThreshold: (cs.entropy / 2e15) * 100
      }
    };
  }
}

module.exports = EndConditions;