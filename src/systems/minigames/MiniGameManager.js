/**
 * MiniGameManager
 *
 * Central manager for all mini-games.
 * Handles:
 * - Game registration
 * - Instance creation and lifecycle
 * - Result processing (affects universe, NOT tightly coupled to anomalies)
 * - Event routing
 *
 * Usage:
 * const manager = new MiniGameManager();
 * manager.register(MyAwesomeGame);
 * const gameInstance = await manager.start('my-game', { difficulty: 'hard' });
 */

import {
  MiniGameState,
  MiniGameError,
  MiniGameEvent
} from './MiniGameConstants.js';

export class MiniGameManager {
  constructor() {
    // Registry of mini-game classes
    this._registry = new Map();

    // Currently running game instance
    this._activeGame = null;

    // Game result handlers (can be registered for custom behavior)
    this._resultHandlers = new Map();

    // Global event listeners
    this._globalListeners = new Map();

    // Update loop
    this._updateInterval = null;
    this._isRunning = false;
  }

  // ============================================================
  // REGISTRATION
  // ============================================================

  /**
   * Register a mini-game class
   * @param {Class} GameClass - Must extend MiniGame
   * @param {Object} options - Game metadata/options
   */
  register(GameClass, options = {}) {
    // Validate it's a proper game class
    const instance = new GameClass({}, {});

    if (!instance.id || !instance.name) {
      throw new Error(
        `Invalid mini-game: must have id and name properties`
      );
    }

    if (this._registry.has(instance.id)) {
      console.warn(`Mini-game '${instance.id}' already registered, overwriting`);
    }

    this._registry.set(instance.id, {
      Class: GameClass,
      id: instance.id,
      name: instance.name,
      description: instance.description || '',
      ...options
    });

    console.log(`✓ Registered mini-game: ${instance.name} (${instance.id})`);
  }

  /**
   * Get all registered games
   * @returns {Array} Array of game metadata
   */
  getRegisteredGames() {
    return Array.from(this._registry.values());
  }

  /**
   * Check if a game is registered
   * @param {string} gameId
   * @returns {boolean}
   */
  isRegistered(gameId) {
    return this._registry.has(gameId);
  }

  /**
   * Get game metadata without starting
   * @param {string} gameId
   * @returns {Object|null}
   */
  getGameInfo(gameId) {
    return this._registry.get(gameId) || null;
  }

  // ============================================================
  // LIFECYCLE
  // ============================================================

  /**
   * Start a mini-game
   * @param {string} gameId - Registered game ID
   * @param {Object} gameConfig - Game-specific config
   * @param {Object} context - Shared context (universe data, callbacks, etc.)
   * @returns {Promise<MiniGame>} The game instance
   */
  async start(gameId, gameConfig = {}, context = {}) {
    // Validation
    if (!this._registry.has(gameId)) {
      throw new Error(`${MiniGameError.NOT_REGISTERED}: ${gameId}`);
    }

    if (this._activeGame && this._activeGame.getState() === MiniGameState.RUNNING) {
      throw new Error(MiniGameError.ALREADY_RUNNING);
    }

    try {
      const GameClass = this._registry.get(gameId).Class;

      // Create new instance
      this._activeGame = new GameClass(gameConfig, context);

      // Register global event listeners
      this._activeGame.on(MiniGameEvent.COMPLETED, (result) => {
        this._onGameComplete(result);
      });

      // Start the game
      await this._activeGame.start();

      // Start update loop if not running
      if (!this._isRunning) {
        this._startUpdateLoop();
      }

      return this._activeGame;
    } catch (error) {
      this._activeGame = null;
      throw new Error(`Failed to start ${gameId}: ${error.message}`);
    }
  }

  /**
   * Stop and cleanup active game
   */
  async stop() {
    if (this._activeGame) {
      await this._activeGame.cleanup();
      this._activeGame = null;
    }
  }

  /**
   * Get currently active game
   * @returns {MiniGame|null}
   */
  getActiveGame() {
    return this._activeGame;
  }

  // ============================================================
  // UPDATE LOOP
  // ============================================================

  /**
   * Start update loop
   * @private
   */
  _startUpdateLoop() {
    if (this._isRunning) return;

    this._isRunning = true;
    let lastTime = Date.now();

    const tick = () => {
      const now = Date.now();
      const deltaTime = Math.min(now - lastTime, 50); // Cap at 50ms
      lastTime = now;

      if (this._activeGame) {
        this._activeGame.tick(deltaTime);

        // Stop loop if game completed
        if (
          this._activeGame.getState() === MiniGameState.COMPLETED ||
          this._activeGame.getState() === MiniGameState.DESTROYED
        ) {
          this._isRunning = false;
          return;
        }
      }

      this._updateInterval = requestAnimationFrame(tick);
    };

    this._updateInterval = requestAnimationFrame(tick);
  }

  /**
   * Stop update loop
   * @private
   */
  _stopUpdateLoop() {
    if (this._updateInterval) {
      cancelAnimationFrame(this._updateInterval);
      this._updateInterval = null;
    }
    this._isRunning = false;
  }

  // ============================================================
  // RESULT HANDLING
  // ============================================================

  /**
   * Register a result handler
   * Handlers process game results and return impact object
   * @param {string} resultType - 'success', 'partial', 'failed', 'abandoned'
   * @param {Function} handler - (result) => ({ stabilityBoost, scoreBoost, ... })
   */
  registerResultHandler(resultType, handler) {
    this._resultHandlers.set(resultType, handler);
  }

  /**
   * Called when game completes
   * @private
   */
  _onGameComplete(result) {
    // Get handler for this result type
    const handler = this._resultHandlers.get(result.resultType);

    if (handler) {
      try {
        // Call handler to process result
        const impact = handler(result);

        // Emit result with impact
        this._emitGlobal(MiniGameEvent.COMPLETED, {
          ...result,
          impact
        });

        console.log(`Game complete: ${result.gameName}`, { result, impact });
      } catch (error) {
        console.error('Result handler error:', error);
      }
    } else {
      this._emitGlobal(MiniGameEvent.COMPLETED, result);
    }

    // Schedule cleanup
    this._scheduleCleanup();
  }

  /**
   * Schedule cleanup after a delay
   * @private
   */
  _scheduleCleanup() {
    setTimeout(async () => {
      await this.stop();
    }, 500); // Allow UI to show result
  }

  // ============================================================
  // EVENT SYSTEM
  // ============================================================

  /**
   * Listen to global mini-game events
   * @param {string} eventType
   * @param {Function} callback
   */
  on(eventType, callback) {
    if (!this._globalListeners.has(eventType)) {
      this._globalListeners.set(eventType, []);
    }
    this._globalListeners.get(eventType).push(callback);

    return () => {
      const listeners = this._globalListeners.get(eventType) || [];
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }

  /**
   * Emit global event
   * @private
   */
  _emitGlobal(eventType, data) {
    const listeners = this._globalListeners.get(eventType) || [];
    listeners.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('Global event listener error:', error);
      }
    });
  }

  // ============================================================
  // UTILITIES
  // ============================================================

  /**
   * Debug - log all registered games
   */
  logRegisteredGames() {
    console.group('Registered Mini-Games');
    this.getRegisteredGames().forEach(game => {
      console.log(`• ${game.name} (${game.id})`);
    });
    console.groupEnd();
  }

  /**
   * Cleanup manager
   */
  destroy() {
    this._stopUpdateLoop();
    if (this._activeGame) {
      this._activeGame.cleanup();
    }
    this._registry.clear();
    this._resultHandlers.clear();
    this._globalListeners.clear();
  }
}

export default MiniGameManager;
