/**
 * Mini-Game Registry & Initialization
 *
 * Central place to:
 * - Register all mini-games
 * - Setup result handlers
 * - Initialize the mini-game manager
 *
 * Usage:
 * const manager = getMiniGameManager();
 * const game = await manager.start('quantum-stabilizer', { difficulty: 'hard' });
 */

import MiniGameManager from './MiniGameManager.js';
import { MiniGameResult, MiniGameDifficulty } from './MiniGameConstants.js';

// Import all mini-games
import { QuantumStabilizer } from './games/QuantumStabilizer.jsx';
// import { YourNextGame } from './games/YourNextGame.js';
// import { AnotherGame } from './games/AnotherGame.js';

/**
 * Initialize the mini-game system
 * Call this once during app startup
 */
export function initializeMiniGameSystem() {
  const manager = new MiniGameManager();

  // ============================================================
  // REGISTER MINI-GAMES
  // ============================================================

  manager.register(QuantumStabilizer, {
    category: 'stabilization',
    estimatedDuration: 60000
  });

  // Register more games as you create them
  // manager.register(YourNextGame);
  // manager.register(AnotherGame);

  // ============================================================
  // SETUP RESULT HANDLERS
  // ============================================================

  /**
   * SUCCESS - Game completed successfully
   * Award based on accuracy and score
   */
  manager.registerResultHandler(
    MiniGameResult.SUCCESS,
    (result) => {
      const accuracyBoost = (result.payload.accuracy / 100) * 0.08;
      const scoreBonus = Math.floor(result.payload.score * result.scoreMultiplier);

      return {
        stabilityBoost: (0.05 + accuracyBoost) * result.scoreMultiplier,
        scoreBoost: scoreBonus,
        anomalyResolved: true,
        message: `✓ Perfect stabilization! +${(accuracyBoost * 100).toFixed(1)}% stability boost`
      };
    }
  );

  /**
   * PARTIAL SUCCESS - Game completed but not perfectly
   * Partial resolution of anomaly
   */
  manager.registerResultHandler(
    MiniGameResult.PARTIAL_SUCCESS,
    (result) => {
      const accuracyBoost = (result.payload.accuracy / 100) * 0.04;

      return {
        stabilityBoost: (0.02 + accuracyBoost) * result.scoreMultiplier,
        scoreBoost: Math.floor(result.payload.score * 0.5),
        anomalyResolved: false,
        message: `~ Partial stabilization - anomaly weakened`
      };
    }
  );

  /**
   * FAILED - Game ended in failure
   * Negative impact on stability
   */
  manager.registerResultHandler(
    MiniGameResult.FAILED,
    (result) => {
      return {
        stabilityBoost: -0.03,
        scoreBoost: 0,
        anomalyResolved: false,
        message: `✗ Failed to stabilize - anomaly remains unstable`
      };
    }
  );

  /**
   * ABANDONED - Player quit the game
   * No impact, neutral outcome
   */
  manager.registerResultHandler(
    MiniGameResult.ABANDONED,
    (result) => {
      return {
        stabilityBoost: 0,
        scoreBoost: 0,
        anomalyResolved: false,
        message: `Ø Game abandoned`
      };
    }
  );

  console.log('✓ Mini-game system initialized');
  console.log(`✓ Registered games: ${manager.getRegisteredGames().map(g => g.name).join(', ')}`);

  return manager;
}

// Singleton instance
let _manager = null;

/**
 * Get the mini-game manager instance
 * Initializes on first call
 */
export function getMiniGameManager() {
  if (!_manager) {
    _manager = initializeMiniGameSystem();
  }
  return _manager;
}

export default MiniGameManager;
